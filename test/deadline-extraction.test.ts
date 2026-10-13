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
        { type: 'text', text: JSON.stringify({ deadlines: [deadline] }) },
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
