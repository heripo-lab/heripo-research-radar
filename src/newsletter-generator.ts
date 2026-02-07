/**
 * Uses two LLM providers:
 * - OpenAI (gpt-5-mini, gpt-5.1): Article analysis (tag classification, image analysis, importance scoring)
 * - Google Generative AI (gemini-3-pro-preview): Newsletter content generation
 *
 * For details on switching providers, see README.md section:
 * "⚠️ Fork하여 나만의 뉴스레터 만들기 > 4. LLM 프로바이더 변경"
 */
import type {
  AppLogger,
  EmailMessage,
  EmailService,
  Newsletter,
} from '@llm-newsletter-kit/core';

import type {
  ArticleRepository,
  NewsletterRepository,
  TagRepository,
  TaskRepository,
} from './types/dependencies';

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { GenerateNewsletter } from '@llm-newsletter-kit/core';

import { contentOptions, llmConfig } from './config';
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
 * Newsletter generator dependencies interface
 */
export interface NewsletterGeneratorDependencies {
  /** OpenAI API key (used for article analysis: tag classification, image analysis, importance scoring) */
  openAIApiKey: string;

  /** Google Generative AI API key (used for newsletter content generation) */
  googleGenerativeAIApiKey: string;

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
 *   googleGenerativeAIApiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
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
function createNewsletterGenerator(
  dependencies: NewsletterGeneratorDependencies,
) {
  const openai = createOpenAI({
    apiKey: dependencies.openAIApiKey,
  });

  const google = createGoogleGenerativeAI({
    apiKey: dependencies.googleGenerativeAIApiKey,
  });

  const dateService = new DateService();

  const taskService = new TaskService(dependencies.taskRepository);

  const crawlingProvider = new CrawlingProvider(dependencies.articleRepository);

  const analysisProvider = new AnalysisProvider(
    openai,
    dependencies.articleRepository,
    dependencies.tagRepository,
  );

  const contentGenerateProvider = new ContentGenerateProvider(
    google,
    dependencies.articleRepository,
    dependencies.newsletterRepository,
  );

  return new GenerateNewsletter({
    contentOptions,
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
 *   googleGenerativeAIApiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
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
