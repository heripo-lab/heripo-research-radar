import type { ArticleDeadline } from '@llm-newsletter-kit/core';

import type { ResearchRadarDeadlineSource } from '../src/deadlines/refresh';

import { MockLanguageModelV4 } from 'ai/test';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  fetchResearchRadarDeadlineSource,
  refreshResearchRadarDeadlines,
} from '../src/deadlines/refresh';
import { ALIO_LIST_URL, buildAlioDetailUrl } from '../src/parsers/alio.parser';
import {
  G2B_LIST_URL,
  buildG2bDetailUrl,
  createG2bFetch,
} from '../src/parsers/g2b.parser';
import { GOJOBS_LIST_URL } from '../src/parsers/gojobs.parser';

const source: ResearchRadarDeadlineSource = {
  title: '학술대회 발표 신청',
  targetUrl: 'https://www.kras.or.kr/sub/notice',
  url: 'https://www.kras.or.kr/sub/notice/detail?id=123',
};
const deadline: ArticleDeadline = {
  title: '학술대회 발표 신청',
  kind: '발표 신청',
  date: '2026-11-20',
  time: null,
  timeZone: null,
  status: 'active',
  evidence: '발표 신청 마감을 2026-11-13에서 2026-11-20으로 연장합니다.',
};
function deadlineModel(deadlines: ArticleDeadline[]) {
  return new MockLanguageModelV4({
    doGenerate: {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            deadlines: deadlines.map((item) => ({
              type: 'deadline',
              endDate: null,
              endTime: null,
              ...item,
            })),
          }),
        },
      ],
      finishReason: { unified: 'stop', raw: undefined },
      usage: {
        inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 1, text: 1, reasoning: 0 },
      },
      warnings: [],
    },
  });
}
function krasFetch(body: string, title = source.title) {
  const calls: string[] = [];
  const customFetch: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push(url);
    assert.ok(init?.signal);
    assert.equal(init?.redirect, 'error');
    if (url.endsWith('/robots.txt'))
      return new Response('User-agent: *\nAllow: /');
    assert.equal(url, 'https://www.kras.or.kr/api/boards/detail/123');
    return Response.json({
      item: { id: 123, board_slug: 'notice', title, body: `<p>${body}</p>` },
    });
  };
  return { customFetch, calls };
}

test('extension uses the fresh original only, and unchanged sources still fetch but reuse extraction', async () => {
  const { customFetch, calls } = krasFetch(deadline.evidence);
  const model = deadlineModel([deadline]);
  const first = await refreshResearchRadarDeadlines({
    source,
    model,
    customFetch,
    maxRetries: 0,
  });
  assert.equal(first.status, 'verified');
  if (first.status !== 'verified') throw new Error('Expected verification');
  assert.deepEqual(first.deadlines, [deadline]);
  assert.equal(first.article.title, source.title);
  assert.ok(first.article.detailContent.includes('2026-11-20'));
  assert.deepEqual(calls, [
    'https://www.kras.or.kr/robots.txt',
    'https://www.kras.or.kr/api/boards/detail/123',
  ]);
  const second = await refreshResearchRadarDeadlines({
    source,
    model,
    customFetch,
    previous: first,
    maxRetries: 0,
  });
  assert.equal(second.status, 'verified');
  assert.equal(model.doGenerateCalls.length, 1);
  assert.equal(calls.length, 4);

  const changed = {
    ...deadline,
    date: '2026-11-27',
    evidence: '발표 신청 마감을 2026-11-27으로 다시 연장합니다.',
  };
  const otherModel = deadlineModel([changed]);
  const third = await refreshResearchRadarDeadlines({
    source,
    model: otherModel,
    ...krasFetch(changed.evidence),
    previous: first,
    maxRetries: 0,
  });
  assert.equal(third.status, 'verified');
  if (third.status !== 'verified') throw new Error('Expected verification');
  assert.notEqual(third.sourceHash, first.sourceHash);
  assert.deepEqual(third.deadlines, [changed]);
  assert.equal(otherModel.doGenerateCalls.length, 1);
});

test('a fresh title-only cancellation is supported even if the old body still lists a deadline', async () => {
  const title = '학술대회 발표 신청이 취소되었습니다';
  const cancelled = {
    ...deadline,
    status: 'cancelled' as const,
    date: null,
    evidence: title,
  };
  const result = await refreshResearchRadarDeadlines({
    source,
    model: deadlineModel([cancelled]),
    ...krasFetch(deadline.evidence, title),
    maxRetries: 0,
  });
  assert.equal(result.status, 'verified');
  if (result.status !== 'verified') throw new Error('Expected verification');
  assert.equal(result.article.title, title);
  assert.deepEqual(result.deadlines, [cancelled]);
});

test('missing deadlines and model failures are unverified rather than cancellation', async () => {
  for (const { model, reason } of [
    { model: deadlineModel([]), reason: 'no-supported-deadlines' },
    { model: new MockLanguageModelV4(), reason: 'extraction-failed' },
  ]) {
    const result = await refreshResearchRadarDeadlines({
      source,
      model,
      ...krasFetch('자세한 일정은 추후 안내합니다.'),
      maxRetries: 0,
    });
    assert.equal(result.status, 'unverified');
    if (result.status !== 'unverified') throw new Error('Expected hold');
    assert.equal(result.reason, reason);
    assert.ok(!('deadlines' in result));
  }
});

test('robots denial and non-success HTTP never trigger deadline extraction', async () => {
  for (const blocked of [false, true]) {
    const calls: string[] = [];
    const model = deadlineModel([deadline]);
    const result = await refreshResearchRadarDeadlines({
      source,
      model,
      customFetch: async (input) => {
        const url = String(input);
        calls.push(url);
        return url.endsWith('/robots.txt')
          ? new Response(`User-agent: *\n${blocked ? 'Disallow' : 'Allow'}: /`)
          : new Response('Not found', { status: 404 });
      },
    });
    assert.equal(result.status, 'unverified');
    assert.equal(model.doGenerateCalls.length, 0);
    assert.equal(calls.length, blocked ? 1 : 2);
  }
});

test('robots HTML metadata never becomes the article headline', async () => {
  const result = await fetchResearchRadarDeadlineSource({
    source: {
      title: '학술대회 발표 신청',
      targetUrl: 'https://www.kaah.kr/news',
      url: 'https://www.kaah.kr/news/123',
    },
    customFetch: async (input) =>
      String(input).endsWith('/robots.txt')
        ? new Response('<html><title>신청이 취소되었습니다</title></html>')
        : new Response(
            '<div class="content">발표 신청 마감은 2026-11-20입니다.</div>',
          ),
  });
  assert.equal(result.status, 'fetched');
  if (result.status !== 'fetched') throw new Error('Expected source');
  assert.equal(result.article.title, '학술대회 발표 신청');
});

test('unsupported, cross-origin and list URLs are rejected before network access', async () => {
  const unexpected = () => {
    throw new Error('Unexpected request');
  };
  for (const input of [
    { ...source, targetUrl: 'https://www.kras.or.kr/unknown' as const },
    { ...source, url: 'https://example.com/article' as const },
    { ...source, url: source.targetUrl },
    {
      ...source,
      targetUrl: G2B_LIST_URL as `https://${string}`,
      url: `${G2B_LIST_URL}?page=2` as `https://${string}`,
    },
  ]) {
    const result = await fetchResearchRadarDeadlineSource({
      source: input,
      customFetch: unexpected,
    });
    assert.equal(result.status, 'unverified');
  }
});

test('the time budget returns even when a custom fetch ignores its signal', async () => {
  const result = await fetchResearchRadarDeadlineSource({
    source,
    timeoutMs: 20,
    customFetch: async () => new Promise<Response>(() => {}),
  });
  assert.equal(result.status, 'unverified');
  await assert.rejects(
    fetchResearchRadarDeadlineSource({ source, timeoutMs: 0 }),
    /timeoutMs/,
  );
});

test('job-board refresh requests only the exact detail API, without the daily list', async () => {
  for (const alio of [false, true]) {
    const calls: URL[] = [];
    const selected: ResearchRadarDeadlineSource = alio
      ? {
          title: '연구원 채용',
          targetUrl: ALIO_LIST_URL as `https://${string}`,
          url: buildAlioDetailUrl(42) as `https://${string}`,
        }
      : {
          title: '연구원 채용',
          targetUrl: GOJOBS_LIST_URL as `https://${string}`,
          url: 'https://www.gojobs.go.kr/apmView.do?empmnsn=42',
        };
    const result = await fetchResearchRadarDeadlineSource({
      source: selected,
      publicDataApiKey: 'test-key',
      customFetch: async (input) => {
        const url = new URL(String(input));
        calls.push(url);
        assert.ok(url.pathname.endsWith(alio ? '/detail' : '/getItem'));
        assert.equal(url.searchParams.get(alio ? 'sn' : 'idx'), '42');
        return alio
          ? Response.json({
              resultCode: 200,
              result: {
                recrutPblntSn: 42,
                recrutPbancTtl: '연구원 채용',
                pbancEndYmd: '20261120',
              },
            })
          : new Response(
              '<response><body><items><item><title>연구원 채용</title><enddate>20261120</enddate></item></items></body></response>',
            );
      },
    });
    assert.equal(result.status, 'fetched');
    assert.equal(calls.length, 1);
  }
});

function noticeResponse(items: object[], totalCount = items.length) {
  return Response.json({
    response: { header: { resultCode: '00' }, body: { totalCount, items } },
  });
}
test('나라장터 refresh loads only one notice number and uses the latest revision/cancellation', async () => {
  const number = 'R26BK00123456';
  const calls: URL[] = [];
  const result = await fetchResearchRadarDeadlineSource({
    source: {
      title: '발굴조사 용역',
      targetUrl: G2B_LIST_URL as `https://${string}`,
      url: buildG2bDetailUrl(number, '000') as `https://${string}`,
    },
    publicDataApiKey: 'test-key',
    customFetch: async (input) => {
      const url = new URL(String(input));
      calls.push(url);
      assert.equal(url.searchParams.get('inqryDiv'), '2');
      assert.equal(url.searchParams.get('bidNtceNo'), number);
      assert.equal(url.searchParams.has('inqryBgnDt'), false);
      return noticeResponse(
        url.pathname.endsWith('Servc')
          ? [
              {
                bidNtceNo: number,
                bidNtceOrd: '000',
                bidNtceNm: '발굴조사 용역',
                bidClseDt: '2026-11-13 18:00',
              },
              {
                bidNtceNo: number,
                bidNtceOrd: '002',
                bidNtceNm: '발굴조사 용역 취소',
                ntceKindNm: '취소공고',
              },
              {
                bidNtceNo: number,
                bidNtceOrd: '001',
                bidNtceNm: '발굴조사 용역 연장',
                bidClseDt: '2026-11-20 18:00',
              },
            ]
          : [],
      );
    },
  });
  assert.equal(result.status, 'fetched');
  if (result.status !== 'fetched') throw new Error('Expected source');
  assert.equal(calls.length, 2);
  assert.equal(result.article.title, '발굴조사 용역 취소');
  assert.ok(result.article.detailContent.includes('취소공고'));
  assert.equal(result.article.url, buildG2bDetailUrl(number, '002'));
});

test('나라장터 incomplete revisions or partial HTTP failure hold verification', async () => {
  for (const incomplete of [false, true]) {
    const result = await fetchResearchRadarDeadlineSource({
      source: {
        title: '발굴조사 용역',
        targetUrl: G2B_LIST_URL as `https://${string}`,
        url: 'https://www.g2b.go.kr/link/PNPE027_01/single/?bidPbancNo=R26BK00123456&bidPbancOrd=000',
      },
      publicDataApiKey: 'test-key',
      customFetch: async (input) =>
        new URL(String(input)).pathname.endsWith('Servc')
          ? noticeResponse([
              {
                bidNtceNo: 'R26BK00123456',
                bidNtceOrd: '000',
                bidNtceNm: '발굴조사 용역',
                bidClseDt: '2026-11-20 18:00',
              },
            ])
          : incomplete
            ? noticeResponse([], 3)
            : new Response('Unavailable', { status: 503 }),
    });
    assert.equal(result.status, 'unverified');
  }
});

test('the default 나라장터 fetch preserves the uncached-detail fallback without a number query', async () => {
  let calls = 0;
  const wrapped = createG2bFetch(
    async () => {
      calls++;
      return new Response('original detail');
    },
    { apiKey: 'test-key' },
  );
  assert.equal(
    await (await wrapped(buildG2bDetailUrl('R26BK00123456', '000'))).text(),
    'original detail',
  );
  assert.equal(calls, 1);
});

test('unchanged source hashes cannot reuse legacy deadlines with invented dates or times', async () => {
  const response = krasFetch(deadline.evidence);
  const current = await fetchResearchRadarDeadlineSource({
    source,
    ...response,
  });
  assert.equal(current.status, 'fetched');
  if (current.status !== 'fetched') throw Error('Expected fetched source');
  const invented = {
    ...deadline,
    date: '2026-11-27',
    time: '18:00',
    timeZone: 'Asia/Seoul',
  };
  const model = deadlineModel([deadline]);
  const repaired = await refreshResearchRadarDeadlines({
    source,
    model,
    ...krasFetch(deadline.evidence),
    previous: { sourceHash: current.sourceHash, deadlines: [invented] },
    maxRetries: 0,
  });
  assert.equal(repaired.status, 'verified');
  if (repaired.status !== 'verified')
    throw Error('Expected repaired extraction');
  assert.deepEqual(repaired.deadlines, [deadline]);
  assert.equal(model.doGenerateCalls.length, 1);
  const rejected = await refreshResearchRadarDeadlines({
    source,
    model: deadlineModel([invented]),
    ...krasFetch(deadline.evidence),
    maxRetries: 0,
  });
  assert.equal(rejected.status, 'unverified');
  if (rejected.status !== 'unverified') throw Error('Expected held reminder');
  assert.equal(rejected.reason, 'no-supported-deadlines');
});

test('visible headline-only cancellation invalidates a cache even with unchanged generic metadata', async () => {
  const source: ResearchRadarDeadlineSource = {
    title: '학술대회 발표 신청',
    targetUrl: 'https://www.kaah.kr/news',
    url: 'https://www.kaah.kr/news/123',
  };
  const active: ArticleDeadline = {
    ...deadline,
    date: '2026-11-20',
    evidence: '발표 신청은 2026-11-20까지 접수합니다.',
  };
  for (const tag of ['h1', 'div class="subject"']) {
    const originalHeading = source.title;
    const cancelledHeading = '학술대회 발표 신청 취소 안내';
    const closing = tag.startsWith('div') ? 'div' : tag;
    const fetchFor =
      (heading: string): typeof fetch =>
      async (input) =>
        String(input).endsWith('/robots.txt')
          ? new Response('User-agent: *\nAllow: /')
          : new Response(
              `<html><head><title>한국상고사학회</title><meta property="og:title" content="한국상고사학회"></head><body><header><h1>사이트 로고</h1></header><${tag}>${heading}</${closing}><div class="content">${active.evidence}</div></body></html>`,
            );
    const original = await fetchResearchRadarDeadlineSource({
      source,
      customFetch: fetchFor(originalHeading),
    });
    assert.equal(original.status, 'fetched');
    if (original.status !== 'fetched') throw new Error('Expected source');
    const cancelled: ArticleDeadline = {
      ...active,
      status: 'cancelled',
      date: null,
      evidence: cancelledHeading,
    };
    const model = deadlineModel([cancelled]);
    const result = await refreshResearchRadarDeadlines({
      source,
      customFetch: fetchFor(cancelledHeading),
      model,
      previous: { sourceHash: original.sourceHash, deadlines: [active] },
    });
    assert.equal(result.status, 'verified');
    if (result.status !== 'verified') throw new Error('Expected cancellation');
    assert.notEqual(result.sourceHash, original.sourceHash);
    assert.ok(result.article.title.includes(cancelledHeading));
    assert.ok(!result.article.title.includes('사이트 로고'));
    assert.deepEqual(result.deadlines, [cancelled]);
    assert.equal(model.doGenerateCalls.length, 1);
    const again = await refreshResearchRadarDeadlines({
      source,
      customFetch: fetchFor(cancelledHeading),
      model,
      previous: result,
    });
    assert.equal(again.status, 'verified');
    assert.equal(model.doGenerateCalls.length, 1);
  }
});

test('source refresh includes events and invalidates deadline-only caches on opt-in', async () => {
  const event: ArticleDeadline = {
    ...deadline,
    type: 'event',
    title: '학술대회',
    kind: '개최',
    date: '2026-11-21',
    endDate: '2026-11-22',
    endTime: null,
    evidence: '학술대회는 2026년 11월 21일부터 22일까지 개최합니다.',
  };
  const body = `${deadline.evidence}\n${event.evidence}`;
  const model = deadlineModel([deadline, event]);
  const first = await refreshResearchRadarDeadlines({
    source,
    model,
    ...krasFetch(body),
    maxRetries: 0,
  });
  assert.equal(first.status, 'verified');
  if (first.status !== 'verified') throw new Error('Expected verification');
  assert.deepEqual(first.deadlines, [deadline]);
  // Legacy previous objects have no mode metadata and must not hide events.
  const enabled = await refreshResearchRadarDeadlines({
    source,
    model,
    ...krasFetch(body),
    maxRetries: 0,
    includeEvents: true,
    previous: { sourceHash: first.sourceHash, deadlines: first.deadlines },
  });
  assert.equal(enabled.status, 'verified');
  if (enabled.status !== 'verified') throw new Error('Expected verification');
  assert.equal(enabled.includeEvents, true);
  assert.equal(enabled.deadlines.length, 2);
  assert.deepEqual(enabled.deadlines[1], event);
  assert.equal(model.doGenerateCalls.length, 2);
  const reused = await refreshResearchRadarDeadlines({
    source,
    model,
    ...krasFetch(body),
    maxRetries: 0,
    includeEvents: true,
    previous: enabled,
  });
  assert.equal(reused.status, 'verified');
  assert.equal(model.doGenerateCalls.length, 2);
  const disabled = await refreshResearchRadarDeadlines({
    source,
    model,
    ...krasFetch(body),
    maxRetries: 0,
    previous: enabled,
  });
  assert.equal(disabled.status, 'verified');
  if (disabled.status !== 'verified') throw new Error('Expected verification');
  assert.deepEqual(disabled.deadlines, [deadline]);
  assert.equal(model.doGenerateCalls.length, 3);
  assert.deepEqual(enabled.deadlines[1], event); // Caller-owned cache remains intact.
});
