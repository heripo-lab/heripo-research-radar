import type {
  ArticleForGenerateContent,
  Newsletter,
} from '@llm-newsletter-kit/core';

import type { JournalIssue } from '../src/types/dependencies';

import { MockLanguageModelV4 } from 'ai/test';
import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createJournalIssueLoader } from '../src/journals/loader';
import {
  JOURNAL_ISSUE_CONTENT_TYPE,
  insertJournalIssueHtml,
  insertJournalIssueMarkdown,
  journalIssueLinks,
  removeJournalIssueMentionsHtml,
  removeJournalIssueMentionsMarkdown,
  renderJournalIssueSection,
} from '../src/journals/section';
import { createJournalPaperSelector } from '../src/journals/select';
import { JOURNAL_ISSUE_LIST_URL } from '../src/parsers/journal-issue.parser';
import { researchRadarPromptProvider } from '../src/prompts';
import { ContentGenerateProvider } from '../src/providers/content-generate.provider';
import { DateService } from '../src/services/date.service';

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
  markdown.split('\n').filter((line) => /^\| (?!논문 \||---)/.test(line));

test('관심 가질 논문을 관심 순 표로 보여주고 나머지는 편수와 주제로 줄인다', async () => {
  const select = createJournalPaperSelector({
    audience: '한국고고학회 회원',
    model: answer({
      featured: [3, 0, 5, 1],
      others: [
        { index: 4, topic: '해양 생태계 변화' },
        { index: 2, topic: '섬 지역 어업 경제' },
      ],
    }),
  });
  const markdown = renderJournalIssueSection([
    { issue, selection: await select(issue) },
  ]);

  assert.match(
    markdown,
    /^## 📖 새로 나온 논문\n\n\*\*\[한국고고학보 제3호\]\(https:\/\/www\.kci\.go\.kr\/.+VOL1\)\*\* · 2026년 9월 · 논문 6편\n\n\| 논문 \| 저자 \|/,
  );
  assert.deepEqual(
    tableRows(markdown).map((row) => /논문(\d)/.exec(row)?.[1]),
    ['3', '0', '5', '1'],
  );
  // 주제는 논문 순서대로 요약한다.
  assert.match(
    markdown,
    /그 밖에 섬 지역 어업 경제, 해양 생태계 변화 등을 다룬 논문 2편이 함께 실렸습니다\./,
  );
});

test('범위 밖·중복·누락 번호의 논문은 숨기지 않고 고른 논문 뒤에 표로 남긴다', async () => {
  const select = createJournalPaperSelector({
    audience: '한국고고학회 회원',
    model: answer({
      featured: [2, 99, -1, 1.5, 2, 1],
      others: [
        { index: 1, topic: '양쪽에 넣음' },
        { index: 3, topic: '해양 생태' },
        { index: 4, topic: '문화유산 연구' },
        { index: 4, topic: '보존 기술' },
      ],
    }),
  });
  const selection = await select(issue);
  const rows = tableRows(renderJournalIssueSection([{ issue, selection }]));

  // 1번은 양쪽에, 4번은 others에 두 번 들어가 표에 남고, 0·5번은 빠져 뒤에 붙는다.
  assert.deepEqual(selection, {
    featured: [2, 1, 0, 4, 5],
    others: [{ index: 3, topic: '해양 생태' }],
  });
  assert.equal(rows.length + 1, issue.papers.length);
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
  ['쓸 수 있는 번호 없음', answer({ featured: [99], others: [] })],
] as const) {
  test(`선별 ${name} 시 모든 논문을 원래 순서대로 표에 싣는다`, async () => {
    const reasons: string[] = [];
    const select = createJournalPaperSelector({
      audience: '한국고고학회 회원',
      model,
      timeoutMs: 20,
      onFallback: (reason) => reasons.push(reason),
    });
    const selection = await select(issue);
    const markdown = renderJournalIssueSection([{ issue, selection }]);

    assert.equal(selection, null);
    assert.equal(reasons.length, 1);
    assert.deepEqual(
      tableRows(markdown).map((row) => /논문(\d)/.exec(row)?.[1]),
      ['0', '1', '2', '3', '4', '5'],
    );
  });
}

test('관심 논문이 없으면 표 없이 주제만 알리고, 저자가 많으면 줄이고, 표 칸을 이스케이프한다', () => {
  const crowded = {
    ...issue,
    papers: [paper(0, ['가', '나', '다', '라', '마']), paper(1)],
  };
  crowded.papers[0].title = 'A|B 비교';

  const allOther = renderJournalIssueSection([
    {
      issue: crowded,
      selection: {
        featured: [],
        others: [
          { index: 0, topic: '섬 관광' },
          { index: 1, topic: '섬 관광' },
        ],
      },
    },
  ]);
  assert.doesNotMatch(allOther, /\| 논문/);
  assert.match(allOther, /논문 2편\n\n섬 관광 등을 다룬 논문이 실렸습니다\./);

  const listed = renderJournalIssueSection([
    { issue: crowded, selection: null },
  ]);
  assert.match(listed, /\| 가, 나, 다 외 2명 \|/);
  assert.match(listed, /\[A\\\|B 비교\]/);
});

test('섹션은 학술대회 뒤 발굴조사보고서 앞에 넣고, 그 분류가 없으면 다음 고정 분류 앞에 넣는다', () => {
  const section = '## 📖 새로 나온 논문\n\n내용';
  const body = (...headings: string[]) =>
    headings.map((heading) => `## ${heading}\n\n본문`).join('\n\n');
  const placed = (...headings: string[]) =>
    insertJournalIssueMarkdown(body(...headings), section)
      .split('\n')
      .filter((line) => line.startsWith('## '))
      .map((line) => line.slice(3));

  assert.deepEqual(
    placed(
      '🎓 학술대회·학술행사',
      '📋 발굴조사보고서 (신규 제출)',
      '⛏️ 발굴현장 공개',
      '📑 사업·입찰 공고',
      '📌 마무리',
    ),
    [
      '🎓 학술대회·학술행사',
      '📖 새로 나온 논문',
      '📋 발굴조사보고서 (신규 제출)',
      '⛏️ 발굴현장 공개',
      '📑 사업·입찰 공고',
      '📌 마무리',
    ],
  );
  assert.deepEqual(
    placed('🎓 학술대회·학술행사', '⛏️ 발굴현장 공개', '💼 채용·공고'),
    [
      '🎓 학술대회·학술행사',
      '📖 새로 나온 논문',
      '⛏️ 발굴현장 공개',
      '💼 채용·공고',
    ],
  );
  // 모델이 이름 붙인 분류는 기준으로 쓸 수 없어 그 뒤의 고정 분류 앞에 들어간다.
  assert.deepEqual(placed('🏛️ 정책·제도', '📌 마무리'), [
    '🏛️ 정책·제도',
    '📖 새로 나온 논문',
    '📌 마무리',
  ]);
});

test('HTML 섹션은 다음 섹션과의 사이에도 구분선을 둔다', () => {
  const { document } = new JSDOM(
    '<p>학술</p><hr class="rule"><h2>📋 발굴조사보고서 (신규 제출)</h2><p>보고서</p><div id="closing"></div>',
  ).window;
  const section = document.createElement('div');
  section.id = 'journals';
  insertJournalIssueHtml(
    document,
    section,
    document.querySelector('#closing')!,
  );
  assert.deepEqual(
    [...document.body.children].map((element) =>
      element.id ? `#${element.id}` : element.tagName.toLowerCase(),
    ),
    ['p', 'hr', '#journals', 'hr', 'h2', 'p', '#closing'],
  );
  assert.equal(document.querySelectorAll('hr.rule').length, 2);

  // 기준 제목이 없으면 마무리 블록 앞에 넣고, 앞에 구분선이 없으면 더하지 않는다.
  const { document: bare } = new JSDOM('<p>본문</p><div id="closing"></div>')
    .window;
  const fallback = bare.createElement('div');
  fallback.id = 'journals';
  insertJournalIssueHtml(bare, fallback, bare.querySelector('#closing')!);
  assert.deepEqual(
    [...bare.body.children].map((element) =>
      element.id ? `#${element.id}` : element.tagName.toLowerCase(),
    ),
    ['p', '#journals', '#closing'],
  );
});

test('섹션은 사업·입찰 앞, 없으면 마무리 앞, 둘 다 없으면 끝에 넣는다', () => {
  const section = '## 📖 새로 나온 논문\n\n내용';
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

test('로더는 끝나지 않는 출처 호출을 시간 초과로 끊고 다음 호출에서 다시 묻는다', async () => {
  let calls = 0;
  const load = createJournalIssueLoader(() => {
    calls += 1;
    return calls === 1 ? new Promise(() => {}) : Promise.resolve([issue]);
  }, 10);
  await assert.rejects(load(), /timed out after 10ms/);
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
let removedMentions = 0;
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
      onBodyMentionsRemoved: (removed) => (removedMentions += removed),
      select: createJournalPaperSelector({
        audience: '한국고고학회 회원',
        model: answer({
          featured: [0, 1, 2, 3, 4],
          others: [{ index: 5, topic: '해양 생태' }],
        }),
      }),
    },
  );
}

test('주입 권호는 자동 섹션 표시를 달아 모델 후보로 넘기고, 사업·입찰 앞 표로 렌더링한다', async () => {
  let saved:
    | { newsletter: Newsletter; usedArticles: ArticleForGenerateContent[] }
    | undefined;
  const provider = providerWith(
    async () => [issue],
    (input) => (saved = input),
  );

  const candidates = await provider.fetchArticleCandidates();
  // 주입 권호도 다른 소식과 같은 후보다. 표시만 달아 본문 섹션에 쓰지 않게 하고,
  // 출처에 없는 권호는 일반 기사로 그대로 넘긴다.
  assert.deepEqual(
    candidates.map((candidate) => [candidate.id, candidate.contentType]),
    [
      [1, article(1).contentType],
      [10, JOURNAL_ISSUE_CONTENT_TYPE],
      [11, unknownJournal.contentType],
    ],
  );
  const prompt =
    researchRadarPromptProvider.contentGenerate!.generateNewsletter!;
  const context = {
    newsletterBrandName: '한국고고학회 뉴스레터',
    expertFields: ['고고학'],
    outputLanguage: '한국어',
    targetArticles: candidates,
    dateService: new DateService('2026-10-29'),
    freeFormIntro: true,
    subscribePageUrl: 'https://heripo.app/research-radar/subscribe',
  };
  assert.match(
    prompt.system!(context),
    /`구분`이 `자동 섹션: 📖 새로 나온 논문`인 소식은 어느 분류에도 넣지 않는다/,
  );
  const listed = prompt.user!(context);
  assert.match(
    listed,
    /\*\*구분:\*\* 자동 섹션: 📖 새로 나온 논문 — 이 소식은 `## 📖 새로 나온 논문` 섹션에 표로 자동으로 실린다/,
  );
  assert.equal(listed.match(/자동으로 실린다/g)?.length, 1);

  // 모델이 지시와 달리 본문에 권호를 쓴 줄은 저장 전에 지운다.
  const content = `## 📮 브리핑\n\n오늘 소식\n\n## 🎓 학술\n\n[기사1](https://example.com/1)\n\n[권호 소식](${issue.url})\n\n## 📑 사업·입찰 공고\n\n| 사업 |\n\n## 📌 마무리\n\n정리`;
  await provider.saveNewsletter({
    newsletter: {
      title: '제목',
      content,
      htmlBody: provider.htmlTemplate.html.replace(
        '{{NEWSLETTER_CONTENT}}',
        `<h2>📮 브리핑</h2><p>오늘 소식</p><h2>🎓 학술</h2><p>기사1</p><p><a href="${issue.url}">권호 소식</a></p><h2>📑 사업·입찰 공고</h2><p>입찰</p><h2>📌 마무리</h2><p>정리</p>`,
      ),
      date: '2026-10-29',
      issueOrder: 1,
    },
    usedArticles: candidates,
  });

  assert.ok(saved);
  assert.deepEqual(
    saved.usedArticles.map((used) => used.id),
    [1, 10, 11],
  );
  assert.equal(removedMentions, 1);
  assert.doesNotMatch(saved.newsletter.content, /권호 소식/);
  assert.doesNotMatch(saved.newsletter.htmlBody, /권호 소식/);
  assert.ok(
    saved.newsletter.content.indexOf('## 📖 새로 나온 논문') <
      saved.newsletter.content.indexOf('## 📑 사업·입찰 공고'),
  );
  assert.ok(
    saved.newsletter.content.indexOf('## 🎓 학술') <
      saved.newsletter.content.indexOf('## 📖 새로 나온 논문'),
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

test('모델이 본문 섹션에 쓴 권호·논문 줄은 지우고 브리핑의 언급은 남긴다', () => {
  const links = journalIssueLinks([issue]);
  const toc = issue.url.replace('&', '&amp;');
  const body = [
    `## 🎓 학술대회·학술행사`,
    ``,
    `[학술대회](https://example.com/1) 안내입니다.`,
    `[한국고고학보 제3호](${toc}) 발간 소식입니다.`,
    ``,
    `## 📚 학술지 소식`,
    ``,
    `| 논문 | 저자 |`,
    `| --- | --- |`,
    `| [${issue.papers[0].title}](${issue.papers[0].url}) | 홍길동 |`,
    ``,
    `## 📌 마무리`,
    ``,
    `정리`,
  ];
  const briefing = [
    `## 📮 2026년 10월 31일 브리핑`,
    ``,
    `오늘은 [한국고고학보 제3호](${issue.url})가 나왔습니다.`,
    ``,
  ];
  // KRAS 모드는 브리핑으로, 일반 모드는 H1 머리말 다음 브리핑으로 시작한다.
  for (const opening of [[], ['# 2026년 10월 31일 문화유산 소식', '']]) {
    const markdown = [...opening, ...briefing, ...body].join('\n');
    const result = removeJournalIssueMentionsMarkdown(markdown, links);
    assert.equal(result.removed, 2);
    assert.match(result.content, /오늘은 \[한국고고학보 제3호\]/);
    assert.match(result.content, /## 📮 2026년 10월 31일 브리핑/);
    assert.match(result.content, /\[학술대회\]\(https:\/\/example\.com\/1\)/);
    assert.doesNotMatch(result.content, /발간 소식입니다/);
    // 표 행이 모두 빠진 섹션은 제목과 표 머리까지 지운다.
    assert.doesNotMatch(result.content, /학술지 소식|\| 논문 \| 저자 \|/);
    assert.match(result.content, /## 📌 마무리\n\n정리$/);
  }
  const plain = [...briefing, ...body].join('\n');
  assert.deepEqual(removeJournalIssueMentionsMarkdown(plain, new Set()), {
    content: plain,
    removed: 0,
  });

  // 템플릿이 본문 앞뒤에 넣는 공지는 건드리지 않는다.
  const { document } = new JSDOM(
    `<h2>학회 소식</h2><p><a href="${toc}">공지 속 권호</a></p>` +
      `<h2>heripo lab 소식</h2><p>소식</p>` +
      `<div data-research-radar-body="">` +
      `<h1>2026년 10월 31일 문화유산 소식</h1>` +
      `<hr><h2>📮 2026년 10월 31일 브리핑</h2><p>오늘은 <a href="${toc}">한국고고학보</a></p>` +
      `<hr><h2>🎓 학술대회·학술행사</h2><p><a href="https://example.com/1">학술대회</a></p><p><a href="${toc}">발간</a></p>` +
      `<hr><h2>📚 학술지 소식</h2><table><thead><tr><th>논문</th></tr></thead><tbody><tr><td><a href="${issue.papers[0].url}">논문</a></td></tr></tbody></table>` +
      `<hr><h2>📌 마무리</h2><p>정리</p>` +
      `</div>` +
      `<div data-research-radar-closing=""></div>` +
      `<h2>학회 안내</h2><p><a href="${toc}">안내 속 권호</a></p>`,
  ).window;
  assert.equal(removeJournalIssueMentionsHtml(document, links), 2);
  const describe = (parent: Element) =>
    [...parent.children].map(
      (element) => `${element.tagName.toLowerCase()}:${element.textContent}`,
    );
  assert.deepEqual(
    describe(document.querySelector('[data-research-radar-body]')!),
    [
      'h1:2026년 10월 31일 문화유산 소식',
      'hr:',
      'h2:📮 2026년 10월 31일 브리핑',
      'p:오늘은 한국고고학보',
      'hr:',
      'h2:🎓 학술대회·학술행사',
      'p:학술대회',
      'hr:',
      'h2:📌 마무리',
      'p:정리',
    ],
  );
  assert.match(document.body.textContent ?? '', /공지 속 권호/);
  assert.match(document.body.textContent ?? '', /안내 속 권호/);

  // 문단으로 감싼 목록 항목도 항목째 지우고, 다른 항목과 목록은 남긴다.
  const { document: listed } = new JSDOM(
    `<div data-research-radar-body=""><h2>📮 브리핑</h2><p>오늘</p>` +
      `<h2>🎓 학술</h2><ul><li><p><a href="${toc}">학술지 소식</a></p></li><li><p>다른 소식</p></li></ul></div>`,
  ).window;
  assert.equal(removeJournalIssueMentionsHtml(listed, links), 1);
  assert.deepEqual(
    [...listed.querySelectorAll('li')].map((item) => item.textContent),
    ['다른 소식'],
  );

  // 본문 영역이 없는 문서는 손대지 않는다.
  const { document: bare } = new JSDOM(
    `<h2>📮 브리핑</h2><h2>🎓 학술</h2><p><a href="${toc}">발간</a></p>`,
  ).window;
  assert.equal(removeJournalIssueMentionsHtml(bare, links), 0);
});
