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

import type { VerifiedDeadlineReminder } from '../deadlines/reminders';

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
 * One paper in an injected journal issue.
 */
export interface JournalIssuePaper {
  /** Paper title. */
  title: string;

  /** Author names in publication order. */
  authors: string[];

  /** Author keywords. Blank and repeated keywords are ignored. */
  keywords: string[];

  /**
   * Abstract shown to the scoring and generation models, in the original
   * language when the source has one. Truncated before it reaches them.
   */
  abstract?: string | null;

  /** Public page for the paper, such as its KCI article page. */
  url: string;
}

/**
 * A newly published journal issue (권호) supplied by the application.
 *
 * Each issue becomes one article whose body lists every paper it carries, so a
 * twenty-paper issue is scored and introduced once rather than twenty times.
 */
export interface JournalIssue {
  /**
   * Stable identifier for the issue, such as
   * `{journalId}|{year}|{month}|{volume}|{issue}`. It becomes the article's
   * `uniqId` and reaches `saveCrawledArticles`, so the application can store
   * it with the article. `usedArticles` carry only the article's own id and
   * URL, so that stored value (or the issue `url`) is how the application maps
   * a saved newsletter back to the issues it introduced. Keep it independent
   * of the paper list, or a later snapshot of the same issue looks like a new
   * one.
   */
  externalId: string;

  /**
   * Public page readers follow from the newsletter. It is also the article's
   * URL, so it must be stable for the issue: previously saved issues are
   * recognized by it and not saved again.
   */
  url: string;

  /** Journal name, e.g. "헤리티지:역사와 과학". */
  journalName: string;

  /** Publication year. */
  publishedYear: number;

  /** Publication month, 1-12. */
  publishedMonth: number;

  /** Volume (권). Empty when the journal numbers issues only. */
  volume: string;

  /** Issue number (호). Empty when the journal numbers volumes only. */
  issue: string;

  /**
   * Date the issue became available to the application, in ISO format
   * (YYYY-MM-DD, Korean time) — for example when its papers were first
   * collected. Used as the article's registered date.
   * @example "2026-10-28"
   */
  registeredDate: IsoDateString;

  /** Every paper in the issue, in the order to list them. */
  papers: JournalIssuePaper[];
}

/**
 * Supplies newly published journal issues from the application, such as those
 * collected from KCI.
 *
 * The journal issue target has no live board behind it: when this is omitted
 * the target collects nothing and makes no request. Called at most once per
 * generation run.
 */
export type JournalIssueSource = () => Promise<JournalIssue[]>;

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
   * Deterministic reminder section from renderVerifiedDeadlineReminders().
   * Appended to saved Markdown and HTML after generation; never fed to the LLM.
   */
  deadlineRemindersMarkdown?: string;

  /** Freshly verified historical deadlines/events, merged with included articles. */
  verifiedDeadlineReminders?: VerifiedDeadlineReminder[];

  /**
   * Custom colleague-sharing Markdown, placed after the unified deadline section
   * in both saved Markdown and HTML. Omit for the default; use '' to suppress it.
   */
  shareNoticeMarkdown?: string;

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
   * Titles of actually published issues in [fromInclusive, toExclusive).
   * Scope the query to this newsletter/audience; exclude drafts and failed sends.
   * Providing this method enables the preceding seven calendar days title guard.
   */
  findRecentPublishedTitles?(range: {
    fromInclusive: IsoDateString;
    toExclusive: IsoDateString;
  }): Promise<string[]>;

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
