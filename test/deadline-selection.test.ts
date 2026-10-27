import type { ArticleDeadline, Newsletter } from '@llm-newsletter-kit/core';

import type { VerifiedDeadlineReminder } from '../src/deadlines/reminders';

import { MockLanguageModelV4 } from 'ai/test';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { eligibleDeadlineReminders } from '../src/deadlines/reminders';
import { createDeadlineReminderSelector } from '../src/deadlines/select';
import { ContentGenerateProvider } from '../src/providers/content-generate.provider';

const deadline: ArticleDeadline = {
  title: '학술대회 발표 신청',
  kind: '발표 신청',
  date: '2026-10-13',
  time: null,
  timeZone: null,
  status: 'active',
  evidence: '2026-10-13 마감',
};
const now = new Date('2026-10-13T00:00:00Z');
const candidates = Array.from(
  { length: 14 },
  (_, index): VerifiedDeadlineReminder => ({
    deadline: {
      ...deadline,
      title: `신청 ${index}`,
      date: `2026-10-${13 + (index % 4)}`,
    },
    url: `https://example.com/${index}`,
    verificationStatus: 'verified',
    ...(index === 3 && { recentReminderCount: 2 }),
  }),
);
candidates[1] = {
  ...candidates[1],
  deadline: {
    ...candidates[1].deadline,
    type: 'event',
    kind: '개최',
    time: '10:00',
    endDate: candidates[1].deadline.date,
    endTime: '12:00',
    timeZone: 'Asia/Seoul',
  },
};
const rows = eligibleDeadlineReminders(candidates, '2026-10-13', now);

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

test('the model chooses rows by index; display keeps date order and the ten-row cap', async () => {
  const model = answer({
    select: [13, 0, 0, 2, -1, 99, 1.5, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    duplicates: [],
  });
  const selected: number[] = [];
  const select = createDeadlineReminderSelector({
    model,
    onSelected: ({ selectedCount }) => selected.push(selectedCount),
    onFallback: () => assert.fail('unexpected fallback'),
  });
  const result = await select(rows, '2026-10-13');
  assert.deepEqual(
    result,
    rows.filter((_, index) => [13, 0, 2, 4, 5, 6, 7, 8, 9, 10].includes(index)),
  );
  assert.deepEqual(selected, [10]);
  const prompt = JSON.stringify(model.doGenerateCalls[0].prompt);
  assert.ok(prompt.includes('[오늘 마감]'));
  assert.ok(prompt.includes('[D-3]'));
  assert.ok(prompt.includes('최근 7일 2회 안내'));
  assert.ok(prompt.includes('같은 행사'));
  assert.ok(prompt.includes('중복만 빼고 모두 고른다'));
  assert.ok(prompt.includes('10:00 ~ 12:00 (Asia/Seoul)'));
  assert.ok(prompt.includes('https://example.com/13'));
});

test('a short selection is filled by date without restoring named duplicates', async () => {
  const filled: number[] = [];
  const select = createDeadlineReminderSelector({
    model: answer({ select: [5], duplicates: [0, 1, 5, 99] }),
    onSelected: ({ filledCount }) => filled.push(filledCount),
    onFallback: () => assert.fail('unexpected fallback'),
  });
  const result = await select(rows, '2026-10-13');
  assert.equal(result.length, 10);
  assert.ok(result.includes(rows[5]));
  assert.ok(!result.includes(rows[0]));
  assert.ok(!result.includes(rows[1]));
  assert.deepEqual(filled, [9]);
  const few = await createDeadlineReminderSelector({
    model: answer({ select: [0], duplicates: [1] }),
  })(rows.slice(0, 4), '2026-10-13');
  assert.deepEqual(few, [rows[0], rows[2], rows[3]]);
});

for (const [name, model] of [
  ['an empty answer', answer({ select: [], duplicates: [] })],
  ['only unusable indices', answer({ select: [-1, 99], duplicates: [] })],
  [
    'a model that ignores cancellation',
    new MockLanguageModelV4({ doGenerate: () => new Promise(() => {}) }),
  ],
  [
    'a stalled model',
    new MockLanguageModelV4({
      doGenerate: ({ abortSignal }) =>
        new Promise((_, reject) =>
          abortSignal?.addEventListener('abort', () =>
            reject(new Error('aborted')),
          ),
        ),
    }),
  ],
  [
    'a model error',
    new MockLanguageModelV4({
      doGenerate: async () => {
        throw new Error('rate limited');
      },
    }),
  ],
] as const) {
  test(`${name} falls back to the first rows by date`, async () => {
    const reasons: string[] = [];
    const select = createDeadlineReminderSelector({
      model,
      timeoutMs: 50,
      onFallback: (reason) => reasons.push(reason),
    });
    assert.deepEqual(await select(rows, '2026-10-13'), rows.slice(0, 10));
    assert.equal(reasons.length, 1);
  });
}

test('a single row is displayed without asking the model', async () => {
  const model = answer({ select: [] });
  const select = createDeadlineReminderSelector({ model });
  assert.deepEqual(
    await select(rows.slice(0, 1), '2026-10-13'),
    rows.slice(0, 1),
  );
  assert.equal(model.doGenerateCalls.length, 0);
});

test('saving renders only the selected verified rows', async () => {
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
    { verifiedDeadlineReminders: candidates },
    undefined,
    async (eligible) => eligible.filter((row) => row.url.endsWith('/5')),
  );
  await provider.saveNewsletter({
    newsletter: {
      title: '학술대회 연구 발표 신청 안내',
      content: '오늘 생성한 본문',
      htmlBody: provider.htmlTemplate.html,
      date: '2026-10-13',
      issueOrder: 1,
    },
    usedArticles: [],
  });
  const rendered = saved!.content
    .split('\n')
    .filter((line) => line.startsWith('| ['));
  assert.deepEqual(rendered.length, 1);
  assert.ok(rendered[0].includes('신청 5'));
});
