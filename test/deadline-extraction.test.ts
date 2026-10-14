import { MockLanguageModelV4 } from 'ai/test';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { extractResearchRadarDeadlines } from '../src/deadlines/extract';
import { AnalysisProvider } from '../src/providers/analysis.provider';

test('extracts grounded Korean deadlines through the local core and preserves them in analysis updates', async () => {
  const deadline = {
    title: '학술대회 발표 신청',
    kind: '발표 신청',
    date: '2026-11-13',
    time: null,
    timeZone: null,
    status: 'active' as const,
    evidence: '발표 신청 마감은 2026-11-13입니다.',
  };
  const model = new MockLanguageModelV4({
    doGenerate: {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            deadlines: [
              { type: 'deadline', endDate: null, endTime: null, ...deadline },
            ],
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
  const result = await extractResearchRadarDeadlines({
    model,
    maxRetries: 0,
    article: { title: '학술대회', detailContent: deadline.evidence },
  });
  assert.deepEqual(result.deadlines, [deadline]);
  assert.ok(
    JSON.stringify(model.doGenerateCalls[0].prompt).includes(
      '23:59를 채우지 않는다',
    ),
  );
  let updated: unknown;
  const unexpected = () => {
    throw new Error('Unexpected call');
  };
  const provider = new AnalysisProvider(
    {
      classifyTags: model,
      analyzeImages: model,
      determineImportance: model,
      extractDeadlines: model,
    },
    {
      findByUrls: unexpected,
      saveCrawledArticles: unexpected,
      findUnscoredArticles: unexpected,
      findCandidatesForNewsletter: unexpected,
      updateAnalysis: async (article) => {
        updated = article;
      },
    },
    { findAllTags: unexpected },
  );
  const article = {
    id: 1,
    title: '학술대회',
    detailContent: deadline.evidence,
    hasAttachedImage: false,
    imageContextByLlm: null,
    tag1: '고고학',
    tag2: null,
    tag3: null,
    importanceScore: 9,
    targetUrl: 'https://example.com/board' as const,
    deadlines: result.deadlines,
  };
  await provider.update(article);
  assert.deepEqual(updated, article);
  await provider.update({ ...article, deadlines: [] });
  assert.deepEqual(updated, { ...article, deadlines: [] });
});

test('empty originals need no model call', async () => {
  const model = new MockLanguageModelV4();
  assert.deepEqual(
    await extractResearchRadarDeadlines({
      model,
      article: { title: ' ', detailContent: '\n' },
    }),
    { deadlines: [], usage: undefined },
  );
  assert.equal(model.doGenerateCalls.length, 0);
});

test('explicit event opt-in extracts conference periods separately from registration deadlines', async () => {
  const registration = {
    type: 'deadline' as const,
    title: '학술대회',
    kind: '사전 등록',
    date: '2026-11-13',
    time: null,
    timeZone: null,
    endDate: null,
    endTime: null,
    status: 'active' as const,
    evidence: '사전 등록은 2026-11-13 마감입니다.',
  };
  const event = {
    ...registration,
    type: 'event' as const,
    kind: '개최',
    date: '2026-11-21',
    endDate: '2026-11-22',
    evidence: '학술대회는 2026년 11월 21일부터 22일까지 개최합니다.',
  };
  for (const includeEvents of [false, true]) {
    const model = new MockLanguageModelV4({
      doGenerate: {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ deadlines: [registration, event] }),
          },
        ],
        finishReason: { unified: 'stop', raw: undefined },
        warnings: [],
        usage: {
          inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 1, text: 1, reasoning: 0 },
        },
      },
    });
    const result = await extractResearchRadarDeadlines({
      model,
      includeEvents,
      maxRetries: 0,
      article: {
        title: '학술대회',
        detailContent: `${registration.evidence}\n${event.evidence}`,
      },
    });
    assert.equal(result.deadlines.length, includeEvents ? 2 : 1);
    if (includeEvents)
      assert.deepEqual(result.deadlines, [registration, event]);
    else assert.ok(result.deadlines.every((item) => item.type !== 'event'));
    const prompt = JSON.stringify(model.doGenerateCalls[0].prompt);
    assert.ok(
      prompt.includes(
        includeEvents ? '발굴 현장 공개' : 'type: event를 반환하지 않는다',
      ),
    );
  }
});
