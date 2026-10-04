import type { LanguageModel } from 'ai';

import type { HeritageBidTriageOptions } from '../src/crawling/heritage-triage';
import type {
  ContentGenerationConfig,
  NewsletterGeneratorDependencies,
  NewsletterModelConfig,
} from '../src/newsletter-generator';

import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import * as core from '@llm-newsletter-kit/core';
import { MockLanguageModelV4 } from 'ai/test';
import assert from 'node:assert/strict';
import { mock, test } from 'node:test';

import { llmConfig } from '../src/config';
import { AnalysisProvider } from '../src/providers/analysis.provider';

// Stop at the engine boundary: real providers are constructed, but crawling,
// LLM queries, persistence and email delivery must never run.
type EngineConfig = ConstructorParameters<typeof core.GenerateNewsletter>[0];
let captured: EngineConfig;
let triageModel: LanguageModel;
mock.module('@llm-newsletter-kit/core', {
  // Keep compatibility with the minimum supported Node.js 24.15 test runner.
  namedExports: {
    ...core,
    GenerateNewsletter: class {
      contentGenerateProvider: EngineConfig['contentGenerateProvider'];
      constructor(config: EngineConfig) {
        captured = config;
        this.contentGenerateProvider = config.contentGenerateProvider;
      }
      generate() {
        return Promise.resolve('test-issue');
      }
    },
  },
});
mock.module('../src/crawling/heritage-triage.ts', {
  // Keep compatibility with the minimum supported Node.js 24.15 test runner.
  namedExports: {
    createHeritageBidTriage: (options: HeritageBidTriageOptions) => {
      triageModel = options.model;
      return async () => [];
    },
  },
});
const { generateNewsletter } = await import('../src/newsletter-generator');

const unexpected = () => {
  throw new Error('Unexpected crawling, repository or email operation');
};
const dependencies: NewsletterGeneratorDependencies = {
  openAIApiKey: 'test-openai-key',
  customFetch: unexpected,
  taskRepository: { createTask: unexpected, completeTask: unexpected },
  articleRepository: {
    findByUrls: unexpected,
    saveCrawledArticles: unexpected,
    findUnscoredArticles: unexpected,
    updateAnalysis: unexpected,
    findCandidatesForNewsletter: unexpected,
  },
  tagRepository: { findAllTags: unexpected },
  newsletterRepository: {
    getNextIssueOrder: async () => 1,
    saveNewsletter: unexpected,
  },
  previewNewsletter: {
    fetchNewsletterForPreview: unexpected,
    emailService: { send: unexpected },
    emailMessage: { from: 'test@example.com', to: 'test@example.com' },
  },
};

async function configure(
  options: Pick<
    NewsletterGeneratorDependencies,
    'models' | 'contentGeneration'
  > = {},
) {
  assert.equal(
    await generateNewsletter({ ...dependencies, ...options }),
    'test-issue',
  );
  return {
    heritageBidTriage: triageModel,
    classifyTags: captured.analysisProvider.classifyTagOptions.model,
    analyzeImages: captured.analysisProvider.analyzeImagesOptions.model,
    determineImportance: captured.analysisProvider.determineScoreOptions.model,
    generateNewsletter: captured.contentGenerateProvider.model,
  };
}

function assertOpenAI(model: LanguageModel, modelId: string) {
  assert.equal(typeof model, 'object');
  if (typeof model === 'string') throw new Error('Unresolved model ID');
  assert.equal(model.provider, 'openai.responses');
  assert.equal(model.modelId, modelId);
}

const stages = Object.keys(llmConfig.models) as (keyof NewsletterModelConfig)[];

test('string overrides resolve to OpenAI models at all five stages', async () => {
  const ids = {
    heritageBidTriage: 'triage-id',
    classifyTags: 'tags-id',
    analyzeImages: 'images-id',
    determineImportance: 'importance-id',
    generateNewsletter: 'newsletter-id',
  };
  const actual = await configure({ models: ids });
  for (const stage of stages) assertOpenAI(actual[stage], ids[stage]);
});

test('provider objects and current SDK mocks retain identity at all five stages', async () => {
  const anthropic = createAnthropic({ apiKey: 'test-anthropic-key' });
  const google = createGoogleGenerativeAI({ apiKey: 'test-google-key' });
  const openai = createOpenAI({ apiKey: 'test-openai-key' });
  const models = {
    heritageBidTriage: anthropic('triage'),
    classifyTags: google('tags'),
    analyzeImages: openai('images'),
    determineImportance: new MockLanguageModelV4({
      provider: 'custom',
      modelId: 'importance',
    }),
    generateNewsletter: anthropic('newsletter'),
  };
  const actual = await configure({ models });
  for (const stage of stages) assert.strictEqual(actual[stage], models[stage]);
});

test('omitted, empty and explicitly undefined configuration retain all defaults', async () => {
  for (const models of [
    undefined,
    {},
    Object.fromEntries(stages.map((stage) => [stage, undefined])),
  ]) {
    const actual = await configure({ models });
    for (const stage of stages)
      assertOpenAI(actual[stage], llmConfig.models[stage]);
  }
});

test('partial configuration overrides only its selected stage', async () => {
  const model = new MockLanguageModelV4();
  const actual = await configure({ models: { classifyTags: model } });
  assert.strictEqual(actual.classifyTags, model);
  for (const stage of stages.filter((stage) => stage !== 'classifyTags')) {
    assertOpenAI(actual[stage], llmConfig.models[stage]);
  }
});

const legacyDefaults = {
  openai: 'gpt-6-sol',
  anthropic: 'claude-sonnet-4-6',
  google: 'gemini-3.1-pro-preview',
};
for (const provider of ['openai', 'anthropic', 'google'] as const) {
  test(`legacy ${provider} path retains default and custom model selection`, async () => {
    for (const model of [undefined, 'legacy-custom-id']) {
      const contentGeneration: ContentGenerationConfig = {
        provider,
        apiKey: 'test-key',
        model,
      };
      const actual = await configure({
        models: { generateNewsletter: undefined },
        contentGeneration,
      });
      const selected = actual.generateNewsletter;
      assert.equal(typeof selected, 'object');
      if (typeof selected === 'string') throw new Error('Unresolved model ID');
      assert.equal(selected.modelId, model ?? legacyDefaults[provider]);
      assert.ok(selected.provider.startsWith(provider));
      for (const stage of stages.filter(
        (stage) => stage !== 'generateNewsletter',
      )) {
        assertOpenAI(actual[stage], llmConfig.models[stage]);
      }
    }
  });
  test(`string and object newsletter overrides take precedence over legacy ${provider}`, async () => {
    const model = new MockLanguageModelV4({
      provider: 'custom',
      modelId: 'content',
    });
    for (const generateNewsletter of ['preferred-id', model]) {
      const actual = await configure({
        models: { generateNewsletter },
        contentGeneration: {
          provider,
          apiKey: 'test-key',
          model: 'ignored-id',
        },
      });
      if (typeof generateNewsletter === 'string')
        assertOpenAI(actual.generateNewsletter, generateNewsletter);
      else assert.strictEqual(actual.generateNewsletter, model);
    }
  });
}

test('public AnalysisProvider OpenAI factory overload remains compatible', () => {
  const provider = new AnalysisProvider(
    createOpenAI({ apiKey: 'test-key' }),
    dependencies.articleRepository,
    dependencies.tagRepository,
  );
  assertOpenAI(
    provider.classifyTagOptions.model,
    llmConfig.models.classifyTags,
  );
  assertOpenAI(
    provider.analyzeImagesOptions.model,
    llmConfig.models.analyzeImages,
  );
  assertOpenAI(
    provider.determineScoreOptions.model,
    llmConfig.models.determineImportance,
  );
});
