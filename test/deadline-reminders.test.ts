import type { ArticleDeadline, Newsletter } from '@llm-newsletter-kit/core';

import type { VerifiedDeadlineReminder } from '../src/deadlines/reminders';

import { MockLanguageModelV4 } from 'ai/test';
import { JSDOM } from 'jsdom';
import juice from 'juice';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { renderVerifiedDeadlineReminders } from '../src/deadlines/reminders';
import { ContentGenerateProvider } from '../src/providers/content-generate.provider';

const deadline: ArticleDeadline = {
  title: '학술대회 발표 신청',
  kind: '발표 신청',
  date: '2026-10-20',
  time: null,
  timeZone: null,
  status: 'active',
  evidence: '2026-10-20 마감',
};
const reminder: VerifiedDeadlineReminder = {
  deadline,
  url: 'https://www.kras.or.kr/sub/notice/detail?id=123',
  verificationStatus: 'verified',
};

test('reminders are ordered, deduplicated and capped at five, with no invented closing time', () => {
  const reminders = Array.from(
    { length: 7 },
    (_, index): VerifiedDeadlineReminder => ({
      ...reminder,
      deadline: {
        ...deadline,
        title: `신청 ${index}`,
        date: `2026-10-${20 - index}`,
      },
    }),
  );
  const markdown = renderVerifiedDeadlineReminders(
    [reminders[6], ...reminders],
    '2026-10-13',
  );
  assert.equal(
    markdown.split('\n').filter((line) => line.startsWith('| [')).length,
    5,
  );
  assert.ok(markdown.indexOf('신청 6') < markdown.indexOf('신청 5'));
  assert.ok(!markdown.includes('신청 0'));
  assert.ok(!markdown.includes('23:59'));
  assert.ok(markdown.includes('D-1'));
});

test('only verified upcoming active deadlines display; empty sections disappear', () => {
  const variants: VerifiedDeadlineReminder[] = [
    { ...reminder, deadline: { ...deadline, date: '2026-10-12' } },
    { ...reminder, deadline: { ...deadline, date: '2026-11-13' } },
    { ...reminder, deadline: { ...deadline, date: null } },
    { ...reminder, deadline: { ...deadline, date: '2026-02-30' } },
    { ...reminder, deadline: { ...deadline, status: 'cancelled' } },
    { ...reminder, url: 'javascript:alert(1)' as `https://${string}` },
    { ...reminder, verificationStatus: 'unverified' as 'verified' },
  ];
  assert.equal(renderVerifiedDeadlineReminders(variants, '2026-10-13'), '');
});

test('source time and timezone are preserved and unsafe Markdown cannot add rows or links', () => {
  const markdown = renderVerifiedDeadlineReminders(
    [
      {
        ...reminder,
        deadline: {
          ...deadline,
          title: '[신청](javascript:alert(1)) | <img>\n새 행',
          time: '18:30',
          timeZone: 'Asia/Seoul',
        },
      },
    ],
    '2026-10-13',
  );
  assert.ok(markdown.includes('18:30 (Asia/Seoul)'));
  assert.ok(markdown.includes('&lt;img&gt;'));
  assert.equal(
    markdown.split('\n').filter((line) => line.startsWith('| [')).length,
    1,
  );
});

test('distinct actions from the same article remain identifiable', () => {
  const markdown = renderVerifiedDeadlineReminders(
    [
      {
        ...reminder,
        deadline: { ...deadline, title: '학술대회', kind: '발표 신청' },
      },
      {
        ...reminder,
        deadline: { ...deadline, title: '학술대회', kind: '사전 등록' },
      },
    ],
    '2026-10-13',
  );
  assert.ok(markdown.includes('학술대회 · 발표 신청'));
  assert.ok(markdown.includes('학술대회 · 사전 등록'));
});

test('both branding modes append reminders once to HTML and saved Markdown without mutating generation input', async () => {
  const markdown = renderVerifiedDeadlineReminders([reminder], '2026-10-13');
  for (const isKrasNewsletter of [false, true] as const) {
    let saved: Newsletter | undefined;
    const unexpected = () => {
      throw new Error('Unexpected call');
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
      { isKrasNewsletter, deadlineRemindersMarkdown: markdown },
    );
    const newsletter: Newsletter = {
      title: '발굴조사 최신 연구 성과 공개 안내 뉴스레터',
      content: '오늘 생성한 본문',
      htmlBody: provider.htmlTemplate.html,
      date: '2026-10-13',
      issueOrder: 1,
    };
    await provider.saveNewsletter({ newsletter, usedArticles: [] });
    assert.equal(newsletter.content, '오늘 생성한 본문');
    assert.equal(saved?.content, `오늘 생성한 본문\n\n${markdown}`);
    assert.equal(saved?.htmlBody.split('다가오는 마감').length, 2);
    assert.ok(
      saved?.htmlBody.indexOf('다가오는 마감')! >
        saved?.htmlBody.indexOf('{{NEWSLETTER_CONTENT}}')!,
    );
    assert.ok(!provider.htmlTemplate.html.includes('23:59'));
    const document = new JSDOM(juice(saved!.htmlBody)).window.document;
    const sections = document.querySelectorAll(
      '[data-research-radar-deadline-reminders]',
    );
    assert.equal(sections.length, 1);
    assert.equal(
      sections[0].querySelector('h2')?.textContent,
      '⏰ 다가오는 마감',
    );
    assert.equal(sections[0].querySelectorAll('td a[href]').length, 1);
  }
});
