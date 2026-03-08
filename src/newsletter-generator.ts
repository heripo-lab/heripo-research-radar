/**
 * Uses OpenAI for article analysis and a configurable provider (OpenAI / Anthropic / Google) for content generation.
 *
 * Content generation provider is selected via `contentGeneration.provider` in dependencies.
 */
import type {
  AppLogger,
  EmailMessage,
  EmailService,
  Newsletter,
} from '@llm-newsletter-kit/core';
import type { LanguageModel } from 'ai';

import type { ContentOptions } from './config';
import type {
  ArticleRepository,
  NewsletterRepository,
  NewsletterTemplateOptions,
  TagRepository,
  TaskRepository,
} from './types/dependencies';

import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { GenerateNewsletter } from '@llm-newsletter-kit/core';

import { contentOptions, llmConfig, newsletterConfig } from './config';
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
 * - openai: `gpt-5.4`
 * - anthropic: `claude-sonnet-4-6`
 * - google: `gemini-3.1-pro-preview`
 */
export type ContentGenerationConfig =
  | { provider: 'openai'; apiKey: string; model?: string }
  | { provider: 'anthropic'; apiKey: string; model?: string }
  | { provider: 'google'; apiKey: string; model?: string };

/**
 * Newsletter generator dependencies interface
 */
export interface NewsletterGeneratorDependencies {
  /** OpenAI API key (used for article analysis: tag classification, image analysis, importance scoring) */
  openAIApiKey: string;

  /** Content generation LLM configuration (provider + API key + optional model) */
  contentGeneration: ContentGenerationConfig;

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
      return provider(config.model ?? 'gpt-5.4');
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

  const dateService = new DateService(dependencies.publishDate);

  const taskService = new TaskService(dependencies.taskRepository);

  const crawlingProvider = new CrawlingProvider(
    dependencies.articleRepository,
    dependencies.customFetch,
  );

  const analysisProvider = new AnalysisProvider(
    openai,
    dependencies.articleRepository,
    dependencies.tagRepository,
  );

  // Inject display date from DateService into template options
  const templateOptions: NewsletterTemplateOptions | undefined =
    dependencies.templateOptions
      ? {
          ...dependencies.templateOptions,
          displayDate: dateService.getDisplayDateString(),
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

  const contentModel = createContentGenerationModel(
    dependencies.contentGeneration,
  );

  const contentGenerateProvider = new ContentGenerateProvider(
    contentModel,
    dependencies.articleRepository,
    dependencies.newsletterRepository,
    templateOptions,
    resolvedBrandName,
  );

  return new GenerateNewsletter({
    contentOptions: resolvedContentOptions,
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
