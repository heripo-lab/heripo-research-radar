/**
 * Uses the required OpenAI key for every default model. Each task accepts an
 * OpenAI model-ID override, while the compatibility content-generation option
 * can still select Anthropic or Google.
 *
 * `models.generateNewsletter` takes precedence over `contentGeneration`.
 */
import type {
  AppLogger,
  EmailMessage,
  EmailService,
  Newsletter,
  PromptProvider,
} from '@llm-newsletter-kit/core';
import type { LanguageModel } from 'ai';

import type { ContentOptions } from './config';
import type {
  ArticleRepository,
  ExcavationReportSource,
  NewsletterRepository,
  NewsletterTemplateOptions,
  TagRepository,
  TaskRepository,
} from './types/dependencies';

import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { GenerateNewsletter } from '@llm-newsletter-kit/core';

import { createHeritageBidTriage } from '~/crawling/heritage-triage';

import { contentOptions, llmConfig, newsletterConfig } from './config';
import { researchRadarPromptProvider } from './prompts';
import { AnalysisProvider } from './providers/analysis.provider';
import { ContentGenerateProvider } from './providers/content-generate.provider';
import { CrawlingProvider } from './providers/crawling.provider';
import { DateService } from './services/date.service';
import { TaskService } from './services/task.service';

/**
 * Preview newsletter configuration options
 */
export interface PreviewNewsletterOptions {
  /** Function to fetch newsletter for preview */
  fetchNewsletterForPreview: () => Promise<Newsletter>;

  /** Email sending service */
  emailService: EmailService;

  /** Email message configuration (subject, html, text are auto-generated) */
  emailMessage: Omit<EmailMessage, 'subject' | 'html' | 'text'>;
}

/**
 * Content generation LLM provider configuration.
 * Choose one of the three supported providers and supply the API key.
 * Each provider uses a sensible default model that can be overridden.
 *
 * Default models:
 * - openai: `gpt-6-sol`
 * - anthropic: `claude-sonnet-4-6`
 * - google: `gemini-3.1-pro-preview`
 */
export type ContentGenerationConfig =
  | { provider: 'openai'; apiKey: string; model?: string }
  | { provider: 'anthropic'; apiKey: string; model?: string }
  | { provider: 'google'; apiKey: string; model?: string };

/**
 * OpenAI model IDs used by each LLM task.
 *
 * Omitted values use the defaults from `llmConfig.models`. Content generation
 * can still use a non-OpenAI provider through the legacy `contentGeneration`
 * option; `models.generateNewsletter` takes precedence when both are supplied.
 */
export interface NewsletterModelConfig {
  heritageBidTriage?: string;
  classifyTags?: string;
  analyzeImages?: string;
  determineImportance?: string;
  generateNewsletter?: string;
}

/**
 * Newsletter generator dependencies interface
 */
export interface NewsletterGeneratorDependencies {
  /** OpenAI API key used by every default model. */
  openAIApiKey: string;

  /** OpenAI model overrides for every LLM task (optional). */
  models?: NewsletterModelConfig;

  /**
   * Non-OpenAI content generation configuration (optional).
   *
   * Prefer `models.generateNewsletter`, which uses the required `openAIApiKey`.
   * This remains available for Anthropic/Google compatibility.
   */
  contentGeneration?: ContentGenerationConfig;

  /** Task management repository */
  taskRepository: TaskRepository;

  /** Article management repository */
  articleRepository: ArticleRepository;

  /** Tag management repository */
  tagRepository: TagRepository;

  /** Newsletter management repository */
  newsletterRepository: NewsletterRepository;

  /** Logger (optional) */
  logger?: AppLogger;

  /** Preview email configuration (optional) */
  previewNewsletter?: PreviewNewsletterOptions;

  /**
   * Publication date override in ISO format (optional).
   * When provided, this date is used as the newsletter's publication date instead of the current date.
   * Useful for generating a newsletter today but publishing it on a future date.
   * @example "2025-02-12"
   */
  publishDate?: string;

  /** Newsletter template customization options (optional) */
  templateOptions?: NewsletterTemplateOptions;

  /** Custom fetch function for crawling (e.g., proxy-based fetch). Optional. */
  customFetch?: typeof fetch;

  /**
   * Supplies 국가유산청 발굴조사 보고서 entries from the application (optional).
   *
   * When provided, that board is read from this function and never crawled,
   * which lets an application that already stores the reports reuse them. Omit
   * it to keep crawling the board as before. No other target is affected.
   */
  excavationReportSource?: ExcavationReportSource;

  /**
   * data.go.kr service key for the 나라일터 and 알리오 job boards (optional).
   *
   * Pass the encoded key exactly as the portal supplies it. Both boards are read
   * through open APIs rather than scraped; omit the key and they collect
   * nothing while every other target is unaffected.
   */
  publicDataApiKey?: string;

  /**
   * LLM prompt overrides (optional).
   *
   * When provided, this replaces Research Radar's own prompt provider entirely
   * rather than merging with it. Omit it to use the package's tuned prompts,
   * which in turn fall back to core's defaults for any stage they do not define.
   */
  promptProvider?: PromptProvider;
}

/**
 * Newsletter generator factory function
 *
 * @param dependencies - Repository implementations and options
 * @returns Configured newsletter generator instance
 *
 * @example
 * ```typescript
 * const generator = createNewsletterGenerator({
 *   openAIApiKey: process.env.OPENAI_API_KEY,
 *   contentGeneration: {
 *     provider: 'anthropic',
 *     apiKey: process.env.ANTHROPIC_API_KEY,
 *   },
 *   taskRepository: new PrismaTaskRepository(prisma),
 *   articleRepository: new PrismaArticleRepository(prisma),
 *   tagRepository: new PrismaTagRepository(prisma),
 *   newsletterRepository: new PrismaNewsletterRepository(prisma),
 *   logger: customLogger, // optional
 *   previewNewsletter: { // optional
 *     fetchNewsletterForPreview: async () => { ... },
 *     emailService: emailService,
 *     emailMessage: { from: '...', to: '...' },
 *   },
 * });
 *
 * const newsletterId = await generator.generate();
 * ```
 */
function createContentGenerationModel(
  config: ContentGenerationConfig,
): LanguageModel {
  switch (config.provider) {
    case 'openai': {
      const provider = createOpenAI({ apiKey: config.apiKey });
      return provider(config.model ?? 'gpt-6-sol');
    }
    case 'anthropic': {
      const provider = createAnthropic({ apiKey: config.apiKey });
      return provider(config.model ?? 'claude-sonnet-4-6');
    }
    case 'google': {
      const provider = createGoogleGenerativeAI({ apiKey: config.apiKey });
      return provider(config.model ?? 'gemini-3.1-pro-preview');
    }
  }
}

function createNewsletterGenerator(
  dependencies: NewsletterGeneratorDependencies,
) {
  const openai = createOpenAI({
    apiKey: dependencies.openAIApiKey,
  });
  const modelIds = {
    ...llmConfig.models,
    ...dependencies.models,
  };

  const dateService = new DateService(dependencies.publishDate);

  const taskService = new TaskService(dependencies.taskRepository);

  const crawlingProvider = new CrawlingProvider(
    dependencies.articleRepository,
    dependencies.customFetch,
    dependencies.excavationReportSource,
    dependencies.logger,
    dependencies.publicDataApiKey,
    // 나라장터 publishes about 1,500 notices per 48-hour window, so which ones
    // reach per-article scoring is decided here, 100 titles per request. The
    // deterministic filter stays behind it as the fallback.
    createHeritageBidTriage({
      model: openai(modelIds.heritageBidTriage),
      onFallback: (reason, batchSize) => {
        dependencies.logger?.info({
          event: 'crawl.g2b.triage.fallback',
          data: { reason, batchSize },
        });
      },
    }),
  );

  const analysisProvider = new AnalysisProvider(
    {
      classifyTags: openai(modelIds.classifyTags),
      analyzeImages: openai(modelIds.analyzeImages),
      determineImportance: openai(modelIds.determineImportance),
    },
    dependencies.articleRepository,
    dependencies.tagRepository,
  );

  // Inject display date from DateService into template options
  const templateOptions: NewsletterTemplateOptions | undefined =
    dependencies.templateOptions
      ? {
          ...dependencies.templateOptions,
          displayDate: dateService.getPublicationDisplayDateString(),
        }
      : undefined;
  let resolvedContentOptions: ContentOptions = { ...contentOptions };
  let resolvedBrandName = newsletterConfig.brandName;

  if (templateOptions?.isKrasNewsletter) {
    resolvedContentOptions = {
      ...resolvedContentOptions,
      expertField: ['고고학 우선적 문화유산'],
      freeFormIntro: true,
      titleContext: templateOptions.titleContext || undefined,
    };
    resolvedBrandName = '한국고고학회 뉴스레터';
  }

  const contentModel = dependencies.models?.generateNewsletter
    ? openai(modelIds.generateNewsletter)
    : dependencies.contentGeneration
      ? createContentGenerationModel(dependencies.contentGeneration)
      : openai(modelIds.generateNewsletter);

  const contentGenerateProvider = new ContentGenerateProvider(
    contentModel,
    dependencies.articleRepository,
    dependencies.newsletterRepository,
    templateOptions,
    resolvedBrandName,
  );

  return new GenerateNewsletter({
    contentOptions: resolvedContentOptions,
    promptProvider: dependencies.promptProvider ?? researchRadarPromptProvider,
    dateService,
    taskService,
    crawlingProvider,
    analysisProvider,
    contentGenerateProvider,
    options: {
      llm: {
        maxRetries: llmConfig.maxRetries,
      },
      chain: {
        stopAfterAttempt: llmConfig.chainStopAfterAttempt,
      },
      logger: dependencies.logger,
      previewNewsletter: dependencies.previewNewsletter,
    },
  });
}

/**
 * Newsletter generation execution function
 *
 * @param dependencies - Repository implementations and options
 * @returns Generated newsletter ID
 *
 * @example
 * ```typescript
 * const newsletterId = await generateNewsletter({
 *   openAIApiKey: process.env.OPENAI_API_KEY,
 *   contentGeneration: {
 *     provider: 'anthropic',
 *     apiKey: process.env.ANTHROPIC_API_KEY,
 *   },
 *   taskRepository: new PrismaTaskRepository(prisma),
 *   articleRepository: new PrismaArticleRepository(prisma),
 *   tagRepository: new PrismaTagRepository(prisma),
 *   newsletterRepository: new PrismaNewsletterRepository(prisma),
 * });
 * ```
 */
export async function generateNewsletter(
  dependencies: NewsletterGeneratorDependencies,
) {
  const generator = createNewsletterGenerator(dependencies);

  // Initialize issueOrder right before calling generate()
  await generator['contentGenerateProvider'].initializeIssueOrder();

  return generator.generate();
}
