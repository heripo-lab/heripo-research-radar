import type {
  ArticleForGenerateContent,
  Newsletter,
} from '@llm-newsletter-kit/core';

import type { JournalIssue } from '../src/types/dependencies';

import { MockLanguageModelV4 } from 'ai/test';
import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createJournalPaperClassifier } from '../src/journals/classify';
import { createJournalIssueLoader } from '../src/journals/loader';
import {
  insertJournalIssueMarkdown,
  renderJournalIssueSection,
} from '../src/journals/section';
import { JOURNAL_ISSUE_LIST_URL } from '../src/parsers/journal-issue.parser';
import { ContentGenerateProvider } from '../src/providers/content-generate.provider';

const paper = (index: number, authors = [`저자${index}`]) => ({
  title: `논문${index}`,
  authors,
  keywords: [],
  abstract: null,
  url: `https://www.kci.go.kr/kciportal/ci/sereArticleSearch/ciSereArtiView.kci?sereArticleSearchBean.artiId=ART${index}`,
});
const issue: JournalIssue = {
  externalId: 'journal|2026|9|2026|3',
  url: 'https://www.kci.go.kr/kciportal/po/search/poSereArtiList.kci?sereId=000699&volIsseId=VOL1',
  journalName: '한국고고학보',
  publishedYear: 2026,
  publishedMonth: 9,
  volume: '2026',
  issue: '3',
  registeredDate: '2026-10-15',
  papers: [0, 1, 2, 3, 4, 5].map((index) => paper(index)),
};

const answer = (value: unknown) =>
  new MockLanguageModelV4({
    doGenerate: {
      content: [{ type: 'text', text: JSON.stringify(value) }],
      finishReason: { unified: 'stop', raw: undefined },
      usage: {
        inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 1, text: 1, reasoning: 0 },
      },
      warnings: [],
    },
  });

/** Table rows (excluding header and separator) of a rendered issue. */
const tableRows = (markdown: string) =>
  markdown.split('\n').filter((line) => /^\| (?!분야|논문|---)/.test(line));

test('논문을 고고학 → 역사학 → 문화유산 순 표로 보여주고 나머지는 편수와 주제로 줄인다', async () => {
  const classify = createJournalPaperClassifier({
    model: answer({
      archaeology: [3, 0],
      history: [5],
      heritage: [1],
      other: [
        { index: 2, topic: '섬 지역 어업 경제' },
        { index: 4, topic: '해양 생태계 변화' },
      ],
    }),
  });
  const markdown = renderJournalIssueSection([
    { issue, verdicts: await classify(issue) },
  ]);

  assert.match(
    markdown,
    /^## 📖 새로 나온 학술지\n\n\*\*\[한국고고학보 제3호\]\(https:\/\/www\.kci\.go\.kr\/.+VOL1\)\*\* · 2026년 9월 · 논문 6편/,
  );
  assert.deepEqual(
    tableRows(markdown).map((row) => row.split(' | ')[0]),
    ['| 고고학', '| 고고학', '| 역사학', '| 문화유산'],
  );
  // 같은 분야 안에서는 원래 순서를 지킨다.
  assert.match(tableRows(markdown)[0], /논문0/);
  assert.match(tableRows(markdown)[1], /논문3/);
  assert.match(
    markdown,
    /그 밖에 섬 지역 어업 경제, 해양 생태계 변화 등을 다룬 논문 2편이 함께 실렸습니다\./,
  );
});

test('범위 밖·중복·누락 번호의 논문은 숨기지 않고 분야 없이 표에 남긴다', async () => {
  const classify = createJournalPaperClassifier({
    model: answer({
      archaeology: [0, 99, -1, 1.5],
      history: [1],
      heritage: [1],
      other: [{ index: 2, topic: '해양 생태' }],
    }),
  });
  const verdicts = await classify(issue);
  const markdown = renderJournalIssueSection([{ issue, verdicts }]);
  const rows = tableRows(markdown);

  // 1번은 두 분야에 들어갔고 3~5번은 빠졌다.
  assert.equal(rows.filter((row) => row.startsWith('| — |')).length, 4);
  assert.equal(rows.length + 1, issue.papers.length);
  assert.match(markdown, /논문 1편이 함께 실렸습니다/);
});

for (const [name, model] of [
  [
    '오류',
    new MockLanguageModelV4({
      doGenerate: async () => {
        throw new Error('provider down');
      },
    }),
  ],
  [
    '시간 초과',
    new MockLanguageModelV4({ doGenerate: () => new Promise(() => {}) }),
  ],
  [
    '쓸 수 있는 번호 없음',
    answer({ archaeology: [99], history: [], heritage: [], other: [] }),
  ],
] as const) {
  test(`분류 ${name} 시 모든 논문을 분야 없이 표로 보여준다`, async () => {
    const reasons: string[] = [];
    const classify = createJournalPaperClassifier({
      model,
      timeoutMs: 20,
      onFallback: (reason) => reasons.push(reason),
    });
    const verdicts = await classify(issue);
    const markdown = renderJournalIssueSection([{ issue, verdicts }]);

    assert.equal(verdicts, null);
    assert.equal(reasons.length, 1);
    assert.match(markdown, /\| 논문 \| 저자 \|/);
    assert.equal(tableRows(markdown).length, issue.papers.length);
  });
}

test('모든 논문이 기타면 표 없이 주제만 알리고, 저자가 많으면 줄이고, 표 칸을 이스케이프한다', () => {
  const crowded = {
    ...issue,
    papers: [paper(0, ['가', '나', '다', '라', '마']), paper(1)],
  };
  crowded.papers[0].title = 'A|B 비교';

  const allOther = renderJournalIssueSection([
    {
      issue: crowded,
      verdicts: [
        { field: '기타', topic: '섬 관광' },
        { field: '기타', topic: '섬 관광' },
      ],
    },
  ]);
  assert.doesNotMatch(allOther, /\| 논문/);
  assert.match(allOther, /논문 2편\n\n섬 관광 등을 다룬 논문이 실렸습니다\./);

  const listed = renderJournalIssueSection([
    { issue: crowded, verdicts: null },
  ]);
  assert.match(listed, /\| 가, 나, 다 외 2명 \|/);
  assert.match(listed, /\[A\\\|B 비교\]/);
});

test('섹션은 사업·입찰 앞, 없으면 마무리 앞, 둘 다 없으면 끝에 넣는다', () => {
  const section = '## 📖 새로 나온 학술지\n\n내용';
  assert.equal(
    insertJournalIssueMarkdown(
      '## 🎓 학술\n\nA\n\n## 📑 사업·입찰 공고\n\nB\n\n## 📌 마무리\n\nC',
      section,
    ),
    `## 🎓 학술\n\nA\n\n${section}\n\n## 📑 사업·입찰 공고\n\nB\n\n## 📌 마무리\n\nC`,
  );
  assert.equal(
    insertJournalIssueMarkdown('A\n\n## 📌 마무리\n\nC', section),
    `A\n\n${section}\n\n## 📌 마무리\n\nC`,
  );
  assert.equal(insertJournalIssueMarkdown('A\n', section), `A\n\n${section}`);
  assert.equal(insertJournalIssueMarkdown('A', ''), 'A');
});

test('로더는 출처를 한 번만 부르고 실패한 호출은 잊는다', async () => {
  let calls = 0;
  const load = createJournalIssueLoader(async () => {
    calls += 1;
    if (calls === 1) throw new Error('down');
    return [issue];
  });
  await assert.rejects(load());
  assert.deepEqual(await load(), [issue]);
  assert.deepEqual(await load(), [issue]);
  assert.equal(calls, 2);
});

const article = (
  id: number,
  overrides: Partial<ArticleForGenerateContent> = {},
): ArticleForGenerateContent => ({
  id,
  title: `기사${id}`,
  url: `https://example.com/${id}`,
  detailContent: '본문',
  importanceScore: 8,
  targetUrl: 'https://example.com',
  contentType: 'news',
  hasAttachedImage: false,
  imageContextByLlm: null,
  tag1: null,
  tag2: null,
  tag3: null,
  ...overrides,
});
const journalArticle = article(10, {
  url: issue.url,
  targetUrl: JOURNAL_ISSUE_LIST_URL,
});
const unknownJournal = article(11, {
  url: 'https://www.kci.go.kr/unknown',
  targetUrl: JOURNAL_ISSUE_LIST_URL,
});
const unexpected = () => {
  throw new Error('unexpected');
};

function providerWith(
  load: () => Promise<JournalIssue[]>,
  onSave: (input: {
    newsletter: Newsletter;
    usedArticles: ArticleForGenerateContent[];
  }) => void = () => {},
) {
  return new ContentGenerateProvider(
    new MockLanguageModelV4(),
    {
      findByUrls: unexpected,
      saveCrawledArticles: unexpected,
      findUnscoredArticles: unexpected,
      updateAnalysis: unexpected,
      findCandidatesForNewsletter: async () => [
        article(1),
        journalArticle,
        unknownJournal,
      ],
    },
    {
      getNextIssueOrder: async () => 1,
      saveNewsletter: async (input) => {
        onSave(input);
        return { id: 1 };
      },
    },
    { isKrasNewsletter: true, verifiedDeadlineReminders: [] },
    undefined,
    undefined,
    {
      load,
      classify: createJournalPaperClassifier({
        model: answer({
          archaeology: [0, 1, 2],
          history: [],
          heritage: [3, 4],
          other: [{ index: 5, topic: '해양 생태' }],
        }),
      }),
    },
  );
}

test('주입 권호는 모델 후보에서 빼서 사업·입찰 앞 표로 렌더링하고 사용 기사에 되붙인다', async () => {
  let saved:
    | { newsletter: Newsletter; usedArticles: ArticleForGenerateContent[] }
    | undefined;
  const provider = providerWith(
    async () => [issue],
    (input) => (saved = input),
  );

  const candidates = await provider.fetchArticleCandidates();
  // 출처에 없는 권호는 모델에게 그대로 넘긴다.
  assert.deepEqual(
    candidates.map((candidate) => candidate.id),
    [1, 11],
  );

  const content =
    '## 🎓 학술\n\n[기사1](https://example.com/1)\n\n## 📑 사업·입찰 공고\n\n| 사업 |\n\n## 📌 마무리\n\n정리';
  await provider.saveNewsletter({
    newsletter: {
      title: '제목',
      content,
      htmlBody: provider.htmlTemplate.html.replace(
        '{{NEWSLETTER_CONTENT}}',
        '<h2>🎓 학술</h2><p>기사1</p><h2>📑 사업·입찰 공고</h2><p>입찰</p><h2>📌 마무리</h2><p>정리</p>',
      ),
      date: '2026-10-29',
      issueOrder: 1,
    },
    usedArticles: candidates,
  });

  assert.ok(saved);
  assert.deepEqual(
    saved.usedArticles.map((used) => used.id),
    [1, 11, 10],
  );
  assert.ok(
    saved.newsletter.content.indexOf('## 📖 새로 나온 학술지') <
      saved.newsletter.content.indexOf('## 📑 사업·입찰 공고'),
  );
  assert.ok(
    saved.newsletter.content.indexOf('## 🎓 학술') <
      saved.newsletter.content.indexOf('## 📖 새로 나온 학술지'),
  );

  const document = new JSDOM(saved.newsletter.htmlBody).window.document;
  const section = document.querySelector(
    '[data-research-radar-journal-issues]',
  );
  assert.ok(section);
  assert.equal(
    section.nextElementSibling?.textContent?.trim(),
    '📑 사업·입찰 공고',
  );
  assert.equal(section.querySelectorAll(':scope tbody tr').length, 5);
  assert.match(section.textContent ?? '', /해양 생태 등을 다룬 논문 1편/);
});

test('권호를 불러오지 못하면 모든 학술지 기사를 모델에게 넘긴다', async () => {
  const provider = providerWith(async () => {
    throw new Error('catalog down');
  });
  assert.deepEqual(
    (await provider.fetchArticleCandidates()).map((candidate) => candidate.id),
    [1, 10, 11],
  );
});
