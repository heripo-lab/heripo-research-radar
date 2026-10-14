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
    assert.ok(
      saved?.content.startsWith(
        `오늘 생성한 본문\n\n<!-- research-radar-deadline-reminders -->\n${markdown}`,
      ),
    );
    assert.ok(
      saved!.content.indexOf('이 소식이 도움이') >
        saved!.content.indexOf('다가오는 일정·마감'),
    );
    assert.ok(
      saved!.htmlBody.indexOf('이 소식이 도움이') >
        saved!.htmlBody.indexOf('다가오는 일정·마감'),
    );
    assert.equal(saved!.htmlBody.split('이 소식이 도움이').length, 2);
    assert.equal(saved?.htmlBody.split('다가오는 일정·마감').length, 2);
    assert.ok(
      saved?.htmlBody.indexOf('다가오는 일정·마감')! >
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
      '⏰ 다가오는 일정·마감',
    );
    assert.equal(sections[0].querySelectorAll('td a[href]').length, 1);
  }
});

test('today distinguishes a deadline, conference and site visit without treating the event start as a cutoff', () => {
  const today = { ...deadline, date: '2026-10-13' };
  const publicVisit: ArticleDeadline = {
    ...today,
    type: 'event',
    title: '발굴 현장 공개',
    kind: '현장 공개',
    time: '10:00',
    endDate: '2026-10-13',
    endTime: '16:00',
    timeZone: 'Asia/Seoul',
  };
  const conference: ArticleDeadline = {
    ...today,
    type: 'event',
    title: '학술대회',
    kind: '개최',
    time: '14:00',
  };
  const now = new Date('2026-10-13T03:00:00Z'); // 12:00 KST, after the visit started.
  const markdown = renderVerifiedDeadlineReminders(
    [
      { ...reminder, deadline: today },
      { ...reminder, deadline: publicVisit },
      { ...reminder, deadline: conference },
    ],
    '2026-10-13',
    now,
  );
  assert.ok(markdown.includes('## ⏰ 다가오는 일정·마감'));
  assert.ok(markdown.includes('| 안내 | 일정 |'));
  assert.ok(markdown.includes('오늘 마감'));
  assert.ok(markdown.includes('오늘 개최'));
  assert.ok(markdown.includes('10:00 ~ 16:00 (Asia/Seoul) · 오늘 공개'));
  assert.equal(
    renderVerifiedDeadlineReminders(
      [{ ...reminder, deadline: publicVisit }],
      '2026-10-13',
      new Date('2026-10-13T07:00:00Z'),
    ),
    '',
  );
});

test('event periods remain visible while ongoing and reject expired, cancelled or invalid periods', () => {
  const event: ArticleDeadline = {
    ...deadline,
    type: 'event',
    title: '현장 공개',
    kind: '현장 공개',
    date: '2026-10-12',
    endDate: '2026-10-14',
    endTime: null,
  };
  const upcoming = {
    ...event,
    title: '학술대회',
    kind: '개최',
    date: '2026-10-14',
    endDate: '2026-10-15',
  };
  const now = new Date('2026-10-13T03:00:00Z');
  const markdown = renderVerifiedDeadlineReminders(
    [
      { ...reminder, deadline: event },
      { ...reminder, deadline: upcoming },
    ],
    '2026-10-13',
    now,
  );
  assert.ok(markdown.includes('2026-10-12 ~ 2026-10-14 · 진행 중'));
  assert.ok(markdown.includes('2026-10-14 ~ 2026-10-15 · D-1'));
  assert.ok(!markdown.includes('23:59'));
  for (const invalid of [
    { ...event, endDate: '2026-10-11' },
    { ...event, endDate: '2026-02-30' },
    { ...event, endDate: null },
    { ...event, status: 'cancelled' as const },
    { ...event, date: '2026-10-21', endDate: '2026-10-22' },
    {
      ...event,
      date: '2026-10-13',
      time: '16:00',
      endDate: '2026-10-13',
      endTime: '10:00',
    },
    { ...event, date: '2026-10-13', endDate: null, endTime: '16:00' },
  ])
    assert.equal(
      renderVerifiedDeadlineReminders(
        [{ ...reminder, deadline: invalid }],
        '2026-10-13',
        now,
      ),
      '',
    );
});

test('deadline and event entries with identical free-form labels remain separate', () => {
  const same = { ...deadline, title: '학술대회', kind: '안내' };
  const event = { ...same, type: 'event' as const };
  const markdown = renderVerifiedDeadlineReminders(
    [
      { ...reminder, deadline: same },
      { ...reminder, deadline: event },
      { ...reminder, deadline: event },
    ],
    '2026-10-13',
    new Date('2026-10-13T00:00:00Z'),
  );
  assert.equal(
    markdown.split('\n').filter((line) => line.startsWith('| [')).length,
    2,
  );
});

test('old ongoing events cannot push out a tomorrow deadline or a today event at the five-row limit', () => {
  const ongoing = Array.from(
    { length: 5 },
    (_, index): VerifiedDeadlineReminder => ({
      ...reminder,
      deadline: {
        ...deadline,
        type: 'event',
        title: `진행 행사 ${index}`,
        kind: '공개',
        date: `2026-09-0${index + 1}`,
        endDate: '2026-10-30',
        endTime: null,
      },
    }),
  );
  const tomorrow = {
    ...reminder,
    deadline: { ...deadline, title: '내일 신청 마감', date: '2026-10-15' },
  };
  const today: VerifiedDeadlineReminder = {
    ...reminder,
    deadline: {
      ...deadline,
      type: 'event',
      title: '오늘 학술대회',
      kind: '개최',
      date: '2026-10-14',
    },
  };
  const markdown = renderVerifiedDeadlineReminders(
    [...ongoing, tomorrow, today],
    '2026-10-14',
    new Date('2026-10-14T00:00:00Z'),
  );
  assert.ok(markdown.includes('내일 신청 마감'));
  assert.ok(markdown.includes('오늘 학술대회'));
  assert.ok(
    markdown.indexOf('오늘 학술대회') < markdown.indexOf('내일 신청 마감'),
  );
  assert.ok(
    markdown.indexOf('내일 신청 마감') < markdown.indexOf('진행 행사 0'),
  );
  const rows = markdown.split('\n').filter((line) => line.startsWith('| ['));
  assert.equal(rows.length, 5);
  assert.equal(rows.filter((line) => line.includes('진행 중')).length, 3);
});

test('five upcoming entries use all slots ahead of an ongoing event', () => {
  const upcoming = Array.from(
    { length: 5 },
    (_, index): VerifiedDeadlineReminder => ({
      ...reminder,
      deadline: {
        ...deadline,
        title: `신청 마감 ${index}`,
        date: `2026-10-${15 + index}`,
      },
    }),
  );
  const ongoing: VerifiedDeadlineReminder = {
    ...reminder,
    deadline: {
      ...deadline,
      type: 'event',
      title: '지난달 시작한 행사',
      kind: '공개',
      date: '2026-09-01',
      endDate: '2026-10-30',
    },
  };
  const markdown = renderVerifiedDeadlineReminders(
    [ongoing, ...upcoming.reverse()],
    '2026-10-14',
    new Date('2026-10-14T00:00:00Z'),
  );
  for (let index = 0; index < 5; index++)
    assert.ok(markdown.includes(`신청 마감 ${index}`));
  assert.ok(!markdown.includes('지난달 시작한 행사'));
  assert.ok(markdown.indexOf('신청 마감 0') < markdown.indexOf('신청 마감 4'));
});
