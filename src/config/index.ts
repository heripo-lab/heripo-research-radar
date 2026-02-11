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
  subscribePageUrl: 'https://heripo.com/research-radar/subscribe',
  publicationCriteria: {
    minimumArticleCountForIssue: 5,
    priorityArticleScoreThreshold: 8,
  },
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
export { crawlingTargetGroups } from './crawling-targets';
