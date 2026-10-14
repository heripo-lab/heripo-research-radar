import type {
  ArticleForGenerateContent,
  Newsletter,
} from '@llm-newsletter-kit/core';

import { MockLanguageModelV4 } from 'ai/test';
import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { renderVerifiedDeadlineReminders } from '../src/deadlines/reminders';
import { collectNewsletterDeadlines } from '../src/deadlines/section';
import { researchRadarPromptProvider } from '../src/prompts';
import { ContentGenerateProvider } from '../src/providers/content-generate.provider';
import { DateService } from '../src/services/date.service';

const deadline = {
  title: '학술대회',
  kind: '발표 신청',
  date: '2026-10-18',
  time: null,
  timeZone: null,
  status: 'active' as const,
  evidence: '발표 신청은 2026-10-18 마감입니다.',
};
const article: ArticleForGenerateContent = {
  id: 1,
  title: '학술대회',
  url: 'https://example.com/a',
  detailContent: deadline.evidence,
  deadlines: [deadline],
  importanceScore: 9,
  targetUrl: 'https://example.com',
  contentType: 'News',
  hasAttachedImage: false,
  imageContextByLlm: null,
  tag1: null,
  tag2: null,
  tag3: null,
};

test('the unified section uses only included articles and grounded original-source deadlines', () => {
  const omitted = { ...article, id: 2, url: 'https://example.com/omitted' };
  const invented = { ...deadline, date: '2026-10-19' };
  const actual = collectNewsletterDeadlines(
    '[학술대회](https://example.com/a#details)',
    [{ ...article, deadlines: [deadline, invented] }, omitted],
    [],
  );
  assert.equal(actual.length, 1);
  assert.deepEqual(actual[0].deadline, deadline);
  assert.equal(
    collectNewsletterDeadlines('링크 없는 본문', [article], []).length,
    0,
  );
  assert.equal(
    collectNewsletterDeadlines('[구독](javascript:alert(1))', [article], [])
      .length,
    0,
  );
});

test('fresh G2B verification supersedes a cached revision without claiming another revision was included', () => {
  const url = (revision: string) =>
    `https://www.g2b.go.kr/link/PNPE027_01/single/?bidPbancNo=R26BK00123&bidPbancOrd=${revision}` as const;
  const current = { ...article, url: url('001') };
  const extended = { ...deadline, date: '2026-10-20' };
  const verified = {
    deadline: extended,
    url: url('002'),
    verificationStatus: 'verified' as const,
  };
  const merged = collectNewsletterDeadlines(
    `[기사](${url('001')})`,
    [current],
    [verified],
  );
  assert.deepEqual(merged, [verified]);
  assert.equal(
    collectNewsletterDeadlines(`[기사](${url('002')})`, [current], []).length,
    0,
  );
  assert.equal(
    collectNewsletterDeadlines(
      '[기사](https://example.com/a)',
      [article],
      [{ ...verified, verificationStatus: 'unverified' as 'verified' }],
    ).length,
    1,
  );
  const otherAction = { ...deadline, kind: '사전 등록' };
  const distinct = collectNewsletterDeadlines(
    `[기사](${url('001')})`,
    [current],
    [{ ...verified, deadline: otherAction }],
  );
  assert.deepEqual(distinct, [{ ...verified, deadline: otherAction }]);
});

for (const cancelled of [false, true]) {
  test(`renamed G2B ${cancelled ? 'cancellations' : 'extensions'} replace cached actions while preserving separately verified actions`, () => {
    const url = (notice: string, revision: string) =>
      `https://www.g2b.go.kr/link/PNPE027_01/single/?bidPbancNo=${notice}&bidPbancOrd=${revision}` as const;
    const bid = {
      ...deadline,
      title: '발굴조사 용역',
      kind: '입찰서 제출',
      date: '2026-10-17',
      evidence: '입찰서 제출은 2026-10-17 마감입니다.',
    };
    const registration = {
      ...bid,
      kind: '참가 등록',
      date: '2026-10-18',
      evidence: '참가 등록은 2026-10-18 마감입니다.',
    };
    const current = {
      ...article,
      title: bid.title,
      url: url('R26BK00123', '001'),
      detailContent: `${bid.evidence}\n${registration.evidence}`,
      deadlines: [bid, registration],
    };
    const separateNotice = {
      ...current,
      id: 2,
      url: url('R26BK00999', '001'),
      deadlines: [bid],
    };
    const latest = {
      deadline: {
        ...bid,
        title: cancelled ? '발굴조사 용역 취소' : '발굴조사 용역 정정',
        kind: '입찰서  제출',
        date: cancelled ? null : '2026-10-20',
        status: cancelled ? ('cancelled' as const) : ('active' as const),
        evidence: cancelled
          ? '입찰서 제출이 취소되었습니다.'
          : '입찰서 제출은 2026-10-20 마감입니다.',
      },
      url: url('R26BK00123', '002'),
      verificationStatus: 'verified' as const,
    };
    const verifiedRegistration = {
      deadline: registration,
      url: latest.url,
      verificationStatus: 'verified' as const,
    };
    const merged = collectNewsletterDeadlines(
      `[기사](${current.url})\n[별도 공고](${separateNotice.url})`,
      [current, separateNotice],
      [latest, verifiedRegistration],
    );
    assert.deepEqual(merged, [
      latest,
      verifiedRegistration,
      {
        deadline: bid,
        url: separateNotice.url,
        verificationStatus: 'verified',
      },
    ]);
    const markdown = renderVerifiedDeadlineReminders(
      merged.filter((item) => item.url !== separateNotice.url),
      '2026-10-13',
      new Date('2026-10-13T00:00:00Z'),
    );
    assert.ok(!markdown.includes('2026-10-17'));
    assert.ok(markdown.includes('참가 등록'));
    assert.equal(markdown.includes('2026-10-20'), !cancelled);
    assert.ok(!markdown.includes('발굴조사 용역 취소'));
  });
}

test('a refreshed source holds unmatched cached actions even outside G2B', () => {
  const other = {
    deadline: { ...deadline, title: '별도 학술대회', date: '2026-10-20' },
    url: article.url,
    verificationStatus: 'verified' as const,
  };
  assert.deepEqual(
    collectNewsletterDeadlines(
      '[기사](https://example.com/a)',
      [article],
      [other],
    ),
    [other],
  );
});

for (const cancelled of [false, true]) {
  for (const revision of ['001', '002']) {
    test(`G2B kind drift holds stale actions for ${cancelled ? 'cancellation' : 'extension'} at revision ${revision}`, () => {
      const url = (notice: string, order: string) =>
        `https://www.g2b.go.kr/link/PNPE027_01/single/?bidPbancNo=${notice}&bidPbancOrd=${order}` as const;
      const bid = {
        ...deadline,
        title: '발굴조사 용역',
        kind: '입찰서 제출',
        date: '2026-10-17',
        evidence: '입찰서 제출은 2026-10-17 마감입니다.',
      };
      const current = {
        ...article,
        url: url('R26BK00123', '001'),
        detailContent: bid.evidence,
        deadlines: [bid],
      };
      const other = { ...current, id: 2, url: url('R26BK00999', '001') };
      const latest = {
        deadline: {
          ...bid,
          kind: cancelled ? '입찰 취소' : '입찰 마감',
          date: cancelled ? null : '2026-10-20',
          status: cancelled ? ('cancelled' as const) : ('active' as const),
          evidence: cancelled
            ? '입찰이 취소되었습니다.'
            : '입찰 마감은 2026-10-20입니다.',
        },
        url: url('R26BK00123', revision),
        verificationStatus: 'verified' as const,
      };
      const content = `[입찰](${current.url})\n[다른 공고](${other.url})`;
      const merged = collectNewsletterDeadlines(
        content,
        [current, other],
        [latest],
      );
      assert.deepEqual(merged, [
        latest,
        { deadline: bid, url: other.url, verificationStatus: 'verified' },
      ]);
      const own = renderVerifiedDeadlineReminders(
        merged.filter((item) => item.url !== other.url),
        '2026-10-13',
        new Date('2026-10-13T00:00:00Z'),
      );
      assert.equal(cancelled ? own === '' : own.includes('2026-10-20'), true);
      assert.ok(!own.includes('2026-10-17'));
      // Unverified data cannot claim precedence over a collected source.
      assert.deepEqual(
        collectNewsletterDeadlines(
          content,
          [current],
          [{ ...latest, verificationStatus: 'unverified' as 'verified' }],
        ),
        [{ deadline: bid, url: current.url, verificationStatus: 'verified' }],
      );
    });
  }
}

test('current and historical deadlines share one linked card, followed by exactly one sharing notice', async () => {
  let saved: Newsletter | undefined;
  const unexpected = async () => {
    throw new Error('Unexpected external effect');
  };
  const historic = {
    deadline: { ...deadline, title: '과거 안내', date: '2026-10-15' },
    url: 'https://example.com/old' as const,
    verificationStatus: 'verified' as const,
  };
  const provider = new ContentGenerateProvider(
    new MockLanguageModelV4(),
    {
      findByUrls: unexpected,
      saveCrawledArticles: unexpected,
      findUnscoredArticles: unexpected,
      updateAnalysis: unexpected,
      findCandidatesForNewsletter: unexpected,
    },
    {
      getNextIssueOrder: async () => 336,
      saveNewsletter: async ({ newsletter }) => {
        saved = newsletter;
        return { id: 336 };
      },
    },
    {
      isKrasNewsletter: true,
      verifiedDeadlineReminders: [historic],
      krasNoticeMarkdown: '학회 하단 안내를 보존합니다.',
    },
    '한국고고학회 뉴스레터',
  );
  const newsletter: Newsletter = {
    title: '학술대회 연구 발표 신청 안내',
    content:
      '[학술대회](https://example.com/a)\n\n## 📌 마무리\n\n오늘의 소식을 정리했습니다.',
    htmlBody: provider.htmlTemplate.html.replace(
      '{{NEWSLETTER_CONTENT}}',
      '<p id="original" style="font-size: 16px">원래 기사 본문</p>',
    ),
    date: '2026-10-13',
    issueOrder: 336,
  };
  const event = {
    ...deadline,
    type: 'event' as const,
    kind: '개최',
    endDate: '2026-10-19',
    endTime: null,
    evidence: '학술대회는 2026년 10월 18일부터 19일까지 개최합니다.',
  };
  await provider.saveNewsletter({
    newsletter,
    usedArticles: [
      {
        ...article,
        detailContent: `${deadline.evidence}\n${event.evidence}`,
        deadlines: [deadline, event],
      },
    ],
  });
  const document = new JSDOM(saved!.htmlBody).window.document;
  const cards = document.querySelectorAll(
    '[data-research-radar-unified-deadlines]',
  );
  assert.equal(cards.length, 1);
  const links = [...cards[0].querySelectorAll('td a')].map((link) =>
    link.getAttribute('href'),
  );
  assert.deepEqual(links, [
    'https://example.com/old',
    'https://example.com/a',
    'https://example.com/a',
  ]);
  assert.ok(saved!.content.includes('2026-10-18 ~ 2026-10-19'));
  assert.ok(cards[0].textContent.includes('2026-10-18 ~ 2026-10-19'));
  assert.equal(cards[0].querySelectorAll('td strong').length, 3);
  assert.ok(cards[0].getAttribute('style')!.includes('background-color'));
  const share = document.querySelector('[data-research-radar-closing] > p')!;
  assert.ok(share.textContent.includes('이 소식이 도움이'));
  assert.ok(cards[0].compareDocumentPosition(share) & 4);
  assert.equal(
    document.querySelector('#original')?.getAttribute('style'),
    'font-size: 16px',
  );
  assert.ok(saved!.htmlBody.includes('학회 하단 안내를 보존합니다.'));
  assert.ok(
    saved!.content.indexOf('다가오는 일정·마감') <
      saved!.content.indexOf('이 소식이 도움이'),
  );
  assert.equal(newsletter.content.includes('다가오는 일정·마감'), false);
});

test('an issue without eligible deadlines has no empty card and still ends with sharing', async () => {
  let saved: Newsletter | undefined;
  const unexpected = async () => {
    throw new Error('Unexpected external effect');
  };
  const provider = new ContentGenerateProvider(
    new MockLanguageModelV4(),
    {
      findByUrls: unexpected,
      saveCrawledArticles: unexpected,
      findUnscoredArticles: unexpected,
      updateAnalysis: unexpected,
      findCandidatesForNewsletter: unexpected,
    },
    {
      getNextIssueOrder: async () => 1,
      saveNewsletter: async ({ newsletter }) => {
        saved = newsletter;
        return { id: 1 };
      },
    },
    { verifiedDeadlineReminders: [] },
  );
  await provider.saveNewsletter({
    newsletter: {
      title: '마감 없는 연구 성과 소식',
      content: '[연구](https://example.com/a)',
      htmlBody: provider.htmlTemplate.html,
      date: '2026-10-13',
      issueOrder: 1,
    },
    usedArticles: [
      { ...article, deadlines: [{ ...deadline, status: 'cancelled' }] },
    ],
  });
  assert.ok(!saved!.htmlBody.includes('data-research-radar-unified-deadlines'));
  assert.ok(!saved!.content.includes('다가오는 일정·마감'));
  assert.ok(saved!.content.includes('이 소식이 도움이'));
  assert.equal(
    renderVerifiedDeadlineReminders(
      [
        {
          deadline: { ...deadline, date: '2026-10-21' },
          url: article.url,
          verificationStatus: 'verified',
        },
      ],
      '2026-10-13',
    ),
    '',
  );
});

for (const isKrasNewsletter of [false, true]) {
  for (const shareNoticeMarkdown of [
    '함께 읽을 동료에게 전달해주세요. [소식 공유 안내](https://example.com/share)',
    '',
  ]) {
    test(`saved sharing notices respect ${shareNoticeMarkdown ? 'custom text' : 'explicit suppression'} in ${isKrasNewsletter ? 'KRAS' : 'Radar'} mode`, async () => {
      let saved: Newsletter | undefined;
      const unexpected = async () => {
        throw new Error('Unexpected external effect');
      };
      const provider = new ContentGenerateProvider(
        new MockLanguageModelV4(),
        {
          findByUrls: unexpected,
          saveCrawledArticles: unexpected,
          findUnscoredArticles: unexpected,
          updateAnalysis: unexpected,
          findCandidatesForNewsletter: unexpected,
        },
        {
          getNextIssueOrder: async () => 1,
          saveNewsletter: async ({ newsletter }) => {
            saved = newsletter;
            return { id: 1 };
          },
        },
        {
          isKrasNewsletter,
          shareNoticeMarkdown,
          verifiedDeadlineReminders: [],
        },
      );
      await provider.saveNewsletter({
        newsletter: {
          title: '학술대회 연구 발표 신청 안내',
          content: '[학술대회](https://example.com/a)',
          htmlBody: provider.htmlTemplate.html,
          date: '2026-10-13',
          issueOrder: 1,
        },
        usedArticles: [article],
      });
      const document = new JSDOM(saved!.htmlBody).window.document;
      const closing = document.querySelector('[data-research-radar-closing]')!;
      const card = closing.querySelector(
        '[data-research-radar-unified-deadlines]',
      )!;
      assert.ok(card);
      assert.ok(!closing.textContent.includes('이 소식이 도움이 되셨다면'));
      assert.ok(!saved!.content.includes('이 소식이 도움이 되셨다면'));
      assert.equal(
        saved!.content.includes('<!-- research-radar-share-notice -->'),
        Boolean(shareNoticeMarkdown),
      );
      if (shareNoticeMarkdown) {
        assert.ok(saved!.content.endsWith(shareNoticeMarkdown));
        const share = closing.querySelector(
          'a[href="https://example.com/share"]',
        )!;
        assert.ok(share);
        assert.equal(
          closing.querySelectorAll('a[href="https://example.com/share"]')
            .length,
          1,
        );
        assert.ok(card.compareDocumentPosition(share) & 4);
      } else {
        assert.equal(closing.querySelectorAll(':scope > p').length, 0);
        assert.ok(!saved!.content.includes(provider.subscribePageUrl));
      }
    });
  }
}

test('generation instructions delegate deadline summaries and sharing to deterministic composition', () => {
  const prompt = researchRadarPromptProvider.contentGenerate!
    .generateNewsletter!.system!({
    newsletterBrandName: '한국고고학회 뉴스레터',
    expertFields: ['고고학'],
    outputLanguage: '한국어',
    targetArticles: [article],
    dateService: new DateService('2026-10-13'),
    freeFormIntro: true,
    subscribePageUrl: 'https://heripo.app/research-radar/subscribe',
  });
  assert.ok(!prompt.includes('임박한 주요 일정 및 마감:'));
  assert.ok(!prompt.includes('이 소식이 도움이 되셨다면'));
  assert.ok(prompt.includes('일정·마감 표 뒤에 코드가 한 번만 넣는다'));
  assert.ok(prompt.includes('향후 7일 이내'));
});

test('explicit closing times already passed are excluded without inventing an untimed cutoff', () => {
  const entry = {
    deadline: { ...deadline, date: '2026-10-13', time: '18:00' },
    url: article.url,
    verificationStatus: 'verified' as const,
  };
  const now = new Date('2026-10-13T09:00:01Z');
  assert.equal(renderVerifiedDeadlineReminders([entry], '2026-10-13', now), '');
  assert.ok(
    renderVerifiedDeadlineReminders(
      [{ ...entry, deadline: { ...entry.deadline, time: '18:01' } }],
      '2026-10-13',
      now,
    ).includes('18:01'),
  );
  assert.ok(
    renderVerifiedDeadlineReminders(
      [{ ...entry, deadline: { ...entry.deadline, time: null } }],
      '2026-10-13',
      now,
    ).includes('오늘 마감'),
  );
  assert.ok(
    renderVerifiedDeadlineReminders(
      [{ ...entry, deadline: { ...entry.deadline, timeZone: 'UTC' } }],
      '2026-10-13',
      now,
    ).includes('18:00 (UTC)'),
  );
});

test('duplicate model-generated deadline blocks and early sharing links fail before saving', async () => {
  const unexpected = async () => {
    throw new Error('Unexpected persistence');
  };
  const provider = new ContentGenerateProvider(
    new MockLanguageModelV4(),
    {
      findByUrls: unexpected,
      saveCrawledArticles: unexpected,
      findUnscoredArticles: unexpected,
      updateAnalysis: unexpected,
      findCandidatesForNewsletter: unexpected,
    },
    { getNextIssueOrder: async () => 1, saveNewsletter: unexpected },
    { verifiedDeadlineReminders: [] },
  );
  for (const content of [
    '**임박한 주요 일정 및 마감:**\n- 행사',
    '## ⏰ 다가오는 마감\n- 신청',
    '## ⏰ 다가오는 일정·마감\n- 행사',
    '[구독하기](https://heripo.app/research-radar/subscribe)',
  ]) {
    await assert.rejects(
      provider.saveNewsletter({
        newsletter: {
          title: '주요 연구 안내',
          content,
          htmlBody: provider.htmlTemplate.html,
          date: '2026-10-13',
          issueOrder: 1,
        },
        usedArticles: [],
      }),
      /Generated body contains/,
    );
  }
});

test('collection preserves deadline/event identity and a fresh event cancellation holds the old event', () => {
  const same = {
    ...deadline,
    kind: '안내',
    evidence: '2026-10-18에 등록 마감과 행사가 있습니다.',
  };
  const event = { ...same, type: 'event' as const };
  const included = {
    ...article,
    detailContent: same.evidence,
    deadlines: [same, event],
  };
  const content = `[학술대회](${article.url})`;
  assert.equal(collectNewsletterDeadlines(content, [included], []).length, 2);
  const cancelled = {
    ...event,
    kind: '개최 취소',
    date: null,
    status: 'cancelled' as const,
  };
  const latest = {
    deadline: cancelled,
    url: article.url,
    verificationStatus: 'verified' as const,
  };
  const result = collectNewsletterDeadlines(content, [included], [latest]);
  assert.deepEqual(result, [latest]);
  assert.equal(
    renderVerifiedDeadlineReminders(
      result,
      '2026-10-13',
      new Date('2026-10-13T00:00:00Z'),
    ),
    '',
  );
});
