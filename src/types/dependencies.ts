import type {
  ArticleForGenerateContent,
  ArticleForUpdateByAnalysis,
  CrawlingTarget,
  CrawlingTargetGroup,
  IsoDateString,
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
 * A single excavation report supplied by the application instead of crawled.
 *
 * Field names mirror what the 국가유산청 report board exposes, so an application
 * that already stores these rows can hand them over without reshaping them.
 */
export interface ExcavationReport {
  /**
   * The board's own identifier (`ecexmRcno`). Used both as the article's unique
   * id and to build its public detail URL, so it must match the value the board
   * uses — otherwise previously crawled reports are re-saved as duplicates.
   * @example "202609157717"
   */
  externalId: string;

  /**
   * Report title (보고서명).
   * @example "태안 태안읍성 -남문지 및 연지-"
   */
  title: string;

  /**
   * Submission date (제출일) in ISO format (YYYY-MM-DD).
   * @example "2026-09-15"
   */
  submittedDate: IsoDateString;

  /**
   * Report detail fields as label/value pairs, rendered into the article body in
   * insertion order. Supply whatever the source holds — 허가번호, 유적명,
   * 발간기관, 조사시도시군구, 조사기간, 유적성격/시대구분 and so on.
   * Empty values are skipped.
   */
  fields: Record<string, string | null | undefined>;

  /**
   * Whether the report has a downloadable file. Defaults to true, matching the
   * crawled parser.
   */
  hasAttachedFile?: boolean;
}

/**
 * Supplies excavation reports from the application instead of crawling them.
 *
 * When provided, the 국가유산청 발굴조사 보고서 board is served from this
 * function and never requested over the network; the rest of the crawl is
 * unaffected. When omitted, the board is crawled as before.
 *
 * Called at most once per generation run.
 */
export type ExcavationReportSource = () => Promise<ExcavationReport[]>;

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
   * Injected from DateService.getPublicationDisplayDateString() at generation time.
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
  DefaultNewsletterTemplateOptions | KrasNewsletterTemplateOptions;

/**
 * Options for generating the welcome email HTML.
 *
 * When `isKrasNewsletter` is `true`, KRAS-specific branding and content are applied.
 * When `isKrasNewsletter` is `false` or omitted, standard heripo branding is used.
 */
export interface WelcomeTemplateOptions {
  /** When true, apply KRAS (Korean Archaeological Society) branding */
  isKrasNewsletter?: boolean;

  /** Site base URL for constructing links (default: 'https://heripo.app') */
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
