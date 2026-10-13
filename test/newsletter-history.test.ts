import type {
  ArticleForGenerateContent,
  Newsletter,
} from '@llm-newsletter-kit/core';

import type {
  ArticleRepository,
  NewsletterRepository,
} from '../src/types/dependencies';

import {
  GenerateNewsletter,
  NewsletterTitleValidationError,
} from '@llm-newsletter-kit/core';
import { MockLanguageModelV4 } from 'ai/test';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { researchRadarPromptProvider } from '../src/prompts';
import { AnalysisProvider } from '../src/providers/analysis.provider';
import { ContentGenerateProvider } from '../src/providers/content-generate.provider';
import { DateService } from '../src/services/date.service';
import { TaskService } from '../src/services/task.service';

const oldTitle = '한국고고학회 학술대회 발표 신청 접수 시작 안내';
const newTitle = '국립박물관 발굴 유물 연구보고서 신규 공개 안내';
const content = '## 📮 오늘의 소식\n발굴 유물 연구보고서가 공개되었습니다.';
const article: ArticleForGenerateContent = {
  id: 1,
  title: '발굴 유물 연구보고서',
  detailContent: '연구보고서가 공개되었습니다.',
  hasAttachedImage: false,
  imageContextByLlm: null,
  tag1: '고고학',
  tag2: '학술',
  tag3: '보고서',
  importanceScore: 9,
  contentType: 'News',
  targetUrl: 'https://example.com/board',
  url: 'https://example.com/article',
};
const unexpected = () => {
  throw new Error('Unexpected network or repository operation');
};
const articles: ArticleRepository = {
  findByUrls: unexpected,
  saveCrawledArticles: unexpected,
  findUnscoredArticles: async () => [],
  updateAnalysis: unexpected,
  findCandidatesForNewsletter: async () => [article],
};
function response(output: object) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(output) }],
    finishReason: { unified: 'stop' as const, raw: undefined },
    usage: {
      inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 1, text: 1, reasoning: 0 },
    },
    warnings: [],
  };
}

test('title history covers exactly seven preceding calendar days and preserves repository this', async () => {
  const calls: unknown[] = [];
  const repo: NewsletterRepository = {
    getNextIssueOrder: async () => 1,
    saveNewsletter: unexpected,
    async findRecentPublishedTitles(range) {
      assert.strictEqual(this, repo);
      calls.push(range);
      return [oldTitle];
    },
  };
  const provider = new ContentGenerateProvider(
    new MockLanguageModelV4(),
    articles,
    repo,
  );
  assert.deepEqual(await provider.fetchRecentTitles!('2026-01-03'), [oldTitle]);
  assert.deepEqual(await provider.fetchRecentTitles!('2024-03-01'), [oldTitle]);
  assert.deepEqual(calls, [
    { fromInclusive: '2025-12-27', toExclusive: '2026-01-03' },
    { fromInclusive: '2024-02-23', toExclusive: '2024-03-01' },
  ]);
  const legacy = new ContentGenerateProvider(
    new MockLanguageModelV4(),
    articles,
    { getNextIssueOrder: async () => 1, saveNewsletter: unexpected },
  );
  assert.equal(legacy.fetchRecentTitles, undefined);
});

for (const exhausted of [false, true]) {
  test(`linked core title guard ${exhausted ? 'refuses an exhausted duplicate' : 'repairs only the title'}`, async () => {
    const model = new MockLanguageModelV4({
      doGenerate: [
        response({
          title: oldTitle,
          content,
          isWrittenInOutputLanguage: true,
          copyrightVerified: true,
          factAccuracy: true,
        }),
        response({
          title: exhausted ? oldTitle : newTitle,
          isWrittenInOutputLanguage: true,
          factAccuracy: true,
        }),
        response({
          title: oldTitle,
          isWrittenInOutputLanguage: true,
          factAccuracy: true,
        }),
      ],
    });
    const saved: Newsletter[] = [];
    const provider = new ContentGenerateProvider(model, articles, {
      getNextIssueOrder: async () => 1,
      findRecentPublishedTitles: async (range) => {
        assert.deepEqual(range, {
          fromInclusive: '2026-10-06',
          toExclusive: '2026-10-13',
        });
        return [oldTitle];
      },
      saveNewsletter: async ({ newsletter, usedArticles }) => {
        saved.push(newsletter);
        assert.deepEqual(usedArticles, [article]);
        return { id: 'issue' };
      },
    });
    await provider.initializeIssueOrder();
    const engine = new GenerateNewsletter({
      contentOptions: { outputLanguage: '한국어', expertField: ['문화유산'] },
      promptProvider: researchRadarPromptProvider,
      dateService: new DateService('2026-10-13'),
      taskService: new TaskService({
        createTask: async () => 1,
        completeTask: async () => {},
      }),
      crawlingProvider: {
        crawlingTargetGroups: [],
        fetchExistingArticlesByUrls: unexpected,
        saveCrawledArticles: unexpected,
      },
      analysisProvider: new AnalysisProvider(
        {
          classifyTags: model,
          analyzeImages: model,
          determineImportance: model,
        },
        articles,
        { findAllTags: async () => [] },
      ),
      contentGenerateProvider: provider,
      options: { llm: { maxRetries: 0 }, chain: { stopAfterAttempt: 3 } },
    });
    if (exhausted) {
      await assert.rejects(engine.generate(), NewsletterTitleValidationError);
      assert.equal(saved.length, 0);
      assert.equal(model.doGenerateCalls.length, 3);
    } else {
      assert.equal(await engine.generate(), 'issue');
      assert.equal(saved[0].title, newTitle);
      assert.equal(saved[0].content, content);
      assert.ok(
        saved[0].htmlBody.includes('발굴 유물 연구보고서가 공개되었습니다.'),
      );
      assert.equal(model.doGenerateCalls.length, 2);
      assert.ok(
        JSON.stringify(model.doGenerateCalls[1].prompt).includes(
          '비고고학 입찰',
        ),
      );
    }
  });
}
