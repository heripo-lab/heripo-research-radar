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
      content: [{ type: 'text', text: JSON.stringify({ deadlines }) }],
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
