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
 * cannot crowd out archaeological coverage. `기타` — material that is not
 * heritage at all — is capped lowest, because the scoring prompt's academic-value
 * floor is domain-blind and would otherwise lift things like a general journal's
 * call for papers into the top half of the scale.
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
  기타: 5,
};

/**
 * Origins exempted from the robots.txt check.
 *
 * Each entry deliberately overrides what the site publishes, so it needs a
 * reason and should be revisited when that site's robots.txt changes.
 *
 * - `http://www.yngogo.or.kr` (영남고고학회): its board is rendered from
 *   `/module/ntt/unity/selectNttListAjax.ink`, and robots.txt carries a blanket
 *   `Disallow: /module`. The rule reads as protecting an internal path rather
 *   than the public board it happens to serve, and there is no other route to
 *   the listing, so the society's boards are collected under this exemption.
 */
export const robotsExemptOrigins: readonly string[] = [
  'http://www.yngogo.or.kr',
  // data.go.kr open APIs. robots.txt governs crawlers reading a site's
  // documents; these are authorised API calls made with a registered service
  // key, and the terms that bind them are the service's own. The host does not
  // publish a robots.txt at all: its gateway answers any unknown path — that
  // one included — with HTTP 400 and `NO_OPENAPI_SERVICE_ERROR`, so every run
  // was spending a request to be told the file does not exist. The adapters
  // rewrite 나라일터/알리오/나라장터 board URLs to this origin and the gate sits
  // inside them, which is how an API call ended up being asked about at all.
  'https://apis.data.go.kr',
];

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
