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
 * Template customization options for newsletter HTML generation
 *
 * These options allow customizing the newsletter template with additional
 * content sections and variant-specific rendering.
 */
export interface NewsletterTemplateOptions {
  /**
   * When true, renders the newsletter in KRAS (Korean Archaeological Society) variant.
   * This flag controls template-level branching for KRAS-specific layout and content.
   */
  isKrasNewsletter?: boolean;

  /**
   * Markdown content for KRAS news section.
   * Converted to HTML and injected into the newsletter template.
   */
  krasNewsMarkdown?: string;

  /**
   * Markdown content for heripo lab news section.
   * Converted to HTML and injected into the newsletter template.
   */
  heripolabNewsMarkdown?: string;
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
