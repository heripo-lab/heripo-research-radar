import type { GenerateNewsletterConfig } from '@llm-newsletter-kit/core';

/**
 * Content options type extracted from core GenerateNewsletterConfig
 */
export type ContentOptions = GenerateNewsletterConfig<any>['contentOptions'];

/**
 * Newsletter brand configuration type
 */
export interface NewsletterConfig {
  brandName: string;
  subscribePageUrl: string;
  publicationCriteria: {
    minimumArticleCountForIssue: number;
    priorityArticleScoreThreshold: number;
  };
}

/**
 * Newsletter content configuration
 */
export const contentOptions: ContentOptions = {
  outputLanguage: '한국어',
  expertField: ['문화유산'],
};

/**
 * Newsletter brand configuration
 */
export const newsletterConfig: NewsletterConfig = {
  brandName: '문화유산 리서치 레이더',
  subscribePageUrl: 'https://heripo.app/research-radar/subscribe',
  publicationCriteria: {
    minimumArticleCountForIssue: 5,
    priorityArticleScoreThreshold: 8,
  },
};

/**
 * Maximum importance score per heritage domain (`tag1`).
 *
 * The newsletter is archaeology-first: archaeology and cultural heritage keep
 * the full 1-10 range, while natural and intangible heritage are capped so they
 * cannot crowd out archaeological coverage.
 *
 * The cap is applied deterministically after scoring, in
 * `AnalysisProvider.update()`, rather than asked for in the prompt, so the
 * ceiling always holds. It never reaches 1: a score of 1 means "exclude from the
 * newsletter" in the consuming application's candidate query, so capping to 1
 * would delete these articles instead of demoting them.
 *
 * Domains absent from this map are not capped.
 */
export const maximumImportanceScoreByDomain: Record<string, number> = {
  자연유산: 6,
  무형유산: 6,
};

/**
 * LLM configuration
 */
export const llmConfig = {
  maxRetries: 5,
  chainStopAfterAttempt: 3,
  generation: {
    temperature: 0.3,
  },
};

/**
 * Crawling target configuration
 */
export { createCrawlingTargetGroups } from './crawling-targets';

/**
 * Source list for public display (no parser dependencies)
 */
export {
  getSourceList,
  type SourceGroup,
  type SourceItem,
} from './crawling-targets';
