import type {
  AppLogger,
  CrawlingProvider as CoreCrawlingProvider,
  CrawlingTarget,
  CrawlingTargetGroup,
  ParsedTarget,
  UrlString,
} from '@llm-newsletter-kit/core';

import type {
  ArticleRepository,
  ExcavationReportSource,
} from '../types/dependencies';

import { createCrawlingTargetGroups, robotsExemptOrigins } from '~/config';
import { createRobotsAwareFetch } from '~/crawling/robots';
import { createAlioFetch } from '~/parsers/alio.parser';
import { createExcavationReportFetch } from '~/parsers/excavation.parser';
import { createGojobsFetch } from '~/parsers/gojobs.parser';
import { createKrasFetch } from '~/parsers/kras.parser';

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
    excavationReportSource?: ExcavationReportSource,
    logger?: AppLogger,
    publicDataApiKey?: string,
  ) {
    // robots.txt is checked first, so a disallowed request is never sent — not
    // even through a proxy. The injected and KRAS adapters sit inside it: their
    // requests either bypass the network entirely or are rewritten to a URL
    // that still gets checked.
    const withRobots = createRobotsAwareFetch(customFetch ?? fetch, {
      exemptOrigins: robotsExemptOrigins,
      onBlocked: ({ url, rule, userAgent }) => {
        logger?.info({
          event: 'crawl.robots.blocked',
          data: { url, rule, userAgent },
        });
      },
    });

    const withKras = createKrasFetch(withRobots);

    // The two public job boards are read from data.go.kr open APIs. Without a
    // key they answer with an empty list and make no request, so the targets
    // stay configured and simply collect nothing.
    const withPublicJobs = createAlioFetch(
      createGojobsFetch(withKras, { apiKey: publicDataApiKey ?? '' }),
      { apiKey: publicDataApiKey ?? '' },
    );

    // When the application supplies excavation reports, that board is served
    // from the injected source and never requested over the network. Every
    // other target keeps going through the same fetch as before.
    this.customFetch = excavationReportSource
      ? createExcavationReportFetch(withPublicJobs, excavationReportSource)
      : withPublicJobs;

    this.crawlingTargetGroups = createCrawlingTargetGroups(this.customFetch);
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
