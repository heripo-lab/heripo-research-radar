import type { JournalIssue } from '../src/types/dependencies';

import { DateType } from '@llm-newsletter-kit/core';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createCrawlingTargetGroups } from '../src/config';
import { createResearchRadarFetch } from '../src/crawling/source-fetch';
import {
  JOURNAL_ISSUE_LIST_URL,
  createJournalIssueFetch,
  formatJournalIssueTitle,
  parseJournalIssueDetail,
  parseJournalIssueList,
  renderJournalIssueContent,
} from '../src/parsers/journal-issue.parser';

const issue: JournalIssue = {
  externalId: 'journal-1|2026|9|59|3',
  url: 'https://heripo.app/papers/issues/journal-1-2026-9-59-3',
  journalName: '헤리티지:역사와 과학',
  publishedYear: 2026,
  publishedMonth: 9,
  volume: '59',
  issue: '3',
  registeredDate: '2026-10-28',
  papers: [
    {
      title: '풍납토성 출토 기와의 제작 기법',
      authors: ['홍길동', '김철수'],
      keywords: ['기와', '풍납토성', '기와'],
      abstract: '가'.repeat(400),
      url: 'https://www.kci.go.kr/kciportal/ci/sereArticleSearch/ciSereArtiView.kci?sereArticleSearchBean.artiId=ART1',
    },
    {
      title: '석조문화유산 보존처리 사례',
      authors: [],
      keywords: ['기와', ' 보존처리 '],
      abstract: null,
      url: 'https://www.kci.go.kr/kciportal/ci/sereArticleSearch/ciSereArtiView.kci?sereArticleSearchBean.artiId=ART2',
    },
  ],
};

const unexpectedFetch: typeof fetch = () => {
  throw new Error('Unexpected network request');
};

test('주입한 권호를 목록과 상세로 제공하고 출처는 한 번만 호출한다', async () => {
  let calls = 0;
  const journalFetch = createJournalIssueFetch(unexpectedFetch, async () => {
    calls += 1;
    return [issue];
  });

  const list = parseJournalIssueList(
    await (await journalFetch(JOURNAL_ISSUE_LIST_URL)).text(),
  );
  assert.deepEqual(list, [
    {
      uniqId: issue.externalId,
      title: '헤리티지:역사와 과학 제59권 제3호 발간 (2026년 9월)',
      date: '2026-10-28',
      detailUrl: issue.url,
      dateType: DateType.REGISTERED,
    },
  ]);

  const detail = parseJournalIssueDetail(
    await (await journalFetch(new URL(issue.url))).text(),
  );
  assert.equal(calls, 1);
  assert.equal(detail.hasAttachedFile, false);
  assert.match(detail.detailContent, /- \*\*수록 논문\*\*: 2편/);
  // 같은 논문 안의 중복 키워드는 한 번만 센다.
  assert.match(detail.detailContent, /기와\(2편\), 보존처리, 풍납토성/);
  assert.match(
    detail.detailContent,
    /1\. \*\*\[풍납토성 출토 기와의 제작 기법\]\(https:\/\/www\.kci\.go\.kr\/.+ART1\)\*\*/,
  );
  assert.match(detail.detailContent, /저자: 홍길동, 김철수/);
  assert.match(detail.detailContent, new RegExp(`초록: 가{300}…`));
  assert.doesNotMatch(detail.detailContent, /가{301}/);
});

test('발행 연도와 같은 권은 제목과 본문에서 생략한다', () => {
  const yearVolume = { ...issue, volume: '2026', issue: '3' };

  assert.equal(
    formatJournalIssueTitle(yearVolume),
    '헤리티지:역사와 과학 제3호 발간 (2026년 9월)',
  );
  assert.match(renderJournalIssueContent(yearVolume), /- \*\*권호\*\*: 제3호/);
});

test('출처가 없으면 요청 없이 빈 목록을 돌려준다', async () => {
  const journalFetch = createJournalIssueFetch(unexpectedFetch);

  const response = await journalFetch(JOURNAL_ISSUE_LIST_URL);
  assert.deepEqual(parseJournalIssueList(await response.text()), []);
});

test('주입한 권호가 아닌 요청은 다음 fetch로 넘긴다', async () => {
  const requested: string[] = [];
  const journalFetch = createJournalIssueFetch(
    async (input) => {
      requested.push(String(input));
      return new Response('<html></html>');
    },
    async () => [issue],
  );

  await journalFetch(issue.url);
  await journalFetch(JOURNAL_ISSUE_LIST_URL);
  await journalFetch('https://www.kci.go.kr/kciportal/other.kci');

  // 목록을 받기 전의 상세 요청은 주입 데이터로 판단할 수 없어 그대로 넘긴다.
  assert.deepEqual(requested, [
    issue.url,
    'https://www.kci.go.kr/kciportal/other.kci',
  ]);
  assert.deepEqual(parseJournalIssueDetail('<html></html>').detailContent, '');
});

test('출처가 실패하면 목록만 실패하고 다른 요청은 계속되며 다음 목록 요청에서 다시 시도한다', async () => {
  const requested: string[] = [];
  let calls = 0;
  const journalFetch = createJournalIssueFetch(
    async (input) => {
      requested.push(String(input));
      return new Response('<html></html>');
    },
    async () => {
      calls += 1;
      if (calls === 1) throw new Error('catalog unavailable');
      return [issue];
    },
  );

  await assert.rejects(
    journalFetch(JOURNAL_ISSUE_LIST_URL),
    /catalog unavailable/,
  );
  await journalFetch('https://www.khs.go.kr/board');
  assert.deepEqual(requested, ['https://www.khs.go.kr/board']);

  const list = parseJournalIssueList(
    await (await journalFetch(JOURNAL_ISSUE_LIST_URL)).text(),
  );
  assert.equal(calls, 2);
  assert.equal(list.length, 1);
});

test('출처가 끝나지 않아도 다른 요청은 기다리지 않는다', async () => {
  const journalFetch = createJournalIssueFetch(
    async () => new Response('ok'),
    () => new Promise(() => {}),
  );

  void journalFetch(JOURNAL_ISSUE_LIST_URL);
  const response = await journalFetch('https://www.khs.go.kr/board');
  assert.equal(await response.text(), 'ok');
});

test('운영 크롤링 fetch는 출처 없이도 권호 대상을 네트워크로 보내지 않는다', async () => {
  const sourceFetch = createResearchRadarFetch({
    customFetch: unexpectedFetch,
  });
  const target = createCrawlingTargetGroups(sourceFetch)
    .flatMap((group) => group.targets)
    .find((candidate) => candidate.url === JOURNAL_ISSUE_LIST_URL);

  assert.ok(target);
  const response = await sourceFetch(target.url);
  assert.deepEqual(await target.parseList(await response.text()), []);
});
