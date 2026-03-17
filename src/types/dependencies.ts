import type {
  ArticleForGenerateContent,
  ArticleForUpdateByAnalysis,
  CrawlingTarget,
  CrawlingTargetGroup,
  Newsletter,
  ParsedTarget,
  UnscoredArticle,
  UrlString,
} from '@llm-newsletter-kit/core';

/**
 * Repository interface for task management
 */
export interface TaskRepository {
  /**
   * Create and save a new task
   * @returns Created task ID
   */
  createTask(): Promise<number>;

  /**
   * Complete a task
   * @param taskId Task ID to complete
   */
  completeTask(taskId: number): Promise<void>;
}

/**
 * Repository interface for article management
 */
export interface ArticleRepository {
  /**
   * Find existing articles by URLs
   * @param urls URLs to query
   * @returns Previously saved articles
   */
  findByUrls(urls: UrlString[]): Promise<ParsedTarget[]>;

  /**
   * Save crawled articles
   * @param articles Articles to save
   * @param context Task context information
   * @returns Number of saved articles
   */
  saveCrawledArticles<TaskId>(
    articles: ParsedTarget[],
    context: {
      taskId: TaskId;
      targetGroup: Omit<CrawlingTargetGroup, 'targets'>;
      target: CrawlingTarget;
    },
  ): Promise<number>;

  /**
   * Find unscored articles (targets for analysis)
   * @returns Articles without scores
   */
  findUnscoredArticles(): Promise<UnscoredArticle[]>;

  /**
   * Update article with analysis results
   * @param article Article information to update
   */
  updateAnalysis(article: ArticleForUpdateByAnalysis): Promise<void>;

  /**
   * Find candidate articles for newsletter generation
   * @returns Candidate articles
   */
  findCandidatesForNewsletter(): Promise<ArticleForGenerateContent[]>;
}

/**
 * Repository interface for tag management
 */
export interface TagRepository {
  /**
   * Find all existing tags
   * @returns Tag name list
   */
  findAllTags(): Promise<string[]>;
}

/**
 * Base template options shared by all newsletter variants.
 */
interface BaseNewsletterTemplateOptions {
  /**
   * Markdown content for KRAS news section.
   * Converted to HTML and injected into the newsletter template.
   */
  krasNewsMarkdown?: string;

  /**
   * Markdown content for KRAS notice section.
   * Converted to HTML and injected into the newsletter template.
   */
  krasNoticeMarkdown?: string;

  /**
   * Markdown content for heripo lab news section.
   * Converted to HTML and injected into the newsletter template.
   */
  heripolabNewsMarkdown?: string;

  /**
   * Display date string for the newsletter header (e.g. "2026년 2월 12일").
   * Injected from DateService.getDisplayDateString() at generation time.
   */
  displayDate?: string;
}

/**
 * Template options for the default (heripo) newsletter variant.
 */
interface DefaultNewsletterTemplateOptions extends BaseNewsletterTemplateOptions {
  isKrasNewsletter?: false;
}

/**
 * Template options for the KRAS (Korean Archaeological Society) newsletter variant.
 *
 * When isKrasNewsletter is true, additional KRAS-specific options become available:
 * - titleContext: Context string to prioritize in newsletter title generation
 */
interface KrasNewsletterTemplateOptions extends BaseNewsletterTemplateOptions {
  isKrasNewsletter: true;

  /**
   * Context string to prioritize when generating the newsletter title.
   * Only available in KRAS mode. When provided, the LLM will consider this value
   * as the top priority along with the generated newsletter content for title creation.
   * An empty string is treated as undefined (no context).
   */
  titleContext?: string;
}

/**
 * Template customization options for newsletter HTML generation.
 *
 * Uses a discriminated union on `isKrasNewsletter`:
 * - When `isKrasNewsletter` is `true`: KRAS-specific options (titleContext) are available.
 * - When `isKrasNewsletter` is `false` or omitted: Only base options are available.
 */
export type NewsletterTemplateOptions =
  | DefaultNewsletterTemplateOptions
  | KrasNewsletterTemplateOptions;

/**
 * Options for generating the welcome email HTML.
 *
 * When `isKrasNewsletter` is `true`, KRAS-specific branding and content are applied.
 * When `isKrasNewsletter` is `false` or omitted, standard heripo branding is used.
 */
export interface WelcomeTemplateOptions {
  /** When true, apply KRAS (Korean Archaeological Society) branding */
  isKrasNewsletter?: boolean;

  /** Site base URL for constructing links (default: 'https://heripo.com') */
  siteUrl?: string;
}

/**
 * Repository interface for newsletter management
 */
export interface NewsletterRepository {
  /**
   * Get the next issue order number
   * @returns Next issue order
   */
  getNextIssueOrder(): Promise<number>;

  /**
   * Save newsletter
   * @param input - Input parameters
   * @param input.newsletter - Newsletter data
   * @param input.usedArticles - List of used articles
   * @returns Saved newsletter ID
   */
  saveNewsletter(input: {
    newsletter: Newsletter;
    usedArticles: ArticleForGenerateContent[];
  }): Promise<{ id: string | number }>;
}
