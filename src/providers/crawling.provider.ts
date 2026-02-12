import type {
  CrawlingProvider as CoreCrawlingProvider,
  CrawlingTarget,
  CrawlingTargetGroup,
  ParsedTarget,
  UrlString,
} from '@llm-newsletter-kit/core';

import type { ArticleRepository } from '../types/dependencies';

import { createCrawlingTargetGroups } from '~/config';

/**
 * Crawling provider implementation
 * - Defines crawling targets
 * - Saves crawling results
 * - Fetches existing articles
 */
export class CrawlingProvider implements CoreCrawlingProvider {
  /** Maximum number of concurrent crawling operations */
  maxConcurrency = 5;

  /** Optional custom fetch function (e.g., proxy-based fetch) */
  customFetch?: typeof fetch;

  /** Crawling target groups configuration */
  crawlingTargetGroups: CrawlingTargetGroup[];

  constructor(
    private readonly articleRepository: ArticleRepository,
    customFetch?: typeof fetch,
  ) {
    this.customFetch = customFetch;
    this.crawlingTargetGroups = createCrawlingTargetGroups(customFetch);
  }

  /**
   * Fetch existing articles by URLs to avoid duplicate crawling
   * @param articleUrls - URLs to check
   * @returns Existing articles
   */
  async fetchExistingArticlesByUrls(
    articleUrls: UrlString[],
  ): Promise<ParsedTarget[]> {
    return this.articleRepository.findByUrls(articleUrls);
  }

  /**
   * Save crawled articles to the repository
   * @param articles - Articles to save
   * @param context - Task context (task ID, target group, target)
   * @returns Number of saved articles
   */
  async saveCrawledArticles<TaskId>(
    articles: ParsedTarget[],
    context: {
      taskId: TaskId;
      targetGroup: Omit<CrawlingTargetGroup, 'targets'>;
      target: CrawlingTarget;
    },
  ): Promise<number> {
    return this.articleRepository.saveCrawledArticles(articles, context);
  }
}
