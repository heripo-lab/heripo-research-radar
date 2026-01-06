import type { OpenAIProvider } from '@ai-sdk/openai';
import type {
  ArticleForGenerateContent,
  ContentGenerateProvider as CoreContentGenerateProvider,
  HtmlTemplate,
  Newsletter,
  UrlString,
} from '@llm-newsletter-kit/core';

import type {
  ArticleRepository,
  NewsletterRepository,
} from '../types/dependencies';

import { createNewsletterHtmlTemplate } from '~/templates/newsletter-html';

import { crawlingTargetGroups, llmConfig, newsletterConfig } from '../config';

/**
 * Content generation provider implementation
 * - LLM-based newsletter content generation
 * - HTML template provisioning
 * - Newsletter persistence
 */
export class ContentGenerateProvider implements CoreContentGenerateProvider {
  private _issueOrder: number | null = null;

  model: ReturnType<OpenAIProvider>;

  constructor(
    private readonly openai: OpenAIProvider,
    private readonly articleRepository: ArticleRepository,
    private readonly newsletterRepository: NewsletterRepository,
  ) {
    this.model = this.openai('gpt-5.1');
  }

  /** LLM temperature setting for content generation */
  temperature = llmConfig.generation.temperature;

  /** Newsletter brand name */
  newsletterBrandName = newsletterConfig.brandName;

  /** Subscribe page URL */
  subscribePageUrl = newsletterConfig.subscribePageUrl as UrlString;

  /** Publication criteria (minimum article count, priority score threshold) */
  publicationCriteria = newsletterConfig.publicationCriteria;

  /**
   * Get current issue order
   * @throws Error if issue order not initialized
   */
  get issueOrder(): number {
    if (this._issueOrder === null) {
      throw new Error(
        'issueOrder not initialized. Call initializeIssueOrder() first.',
      );
    }
    return this._issueOrder;
  }

  /**
   * Initialize issue order before newsletter generation
   */
  async initializeIssueOrder(): Promise<void> {
    this._issueOrder = await this.newsletterRepository.getNextIssueOrder();
  }

  /**
   * Fetch candidate articles for newsletter generation
   * @returns Articles eligible for inclusion in the newsletter
   */
  async fetchArticleCandidates(): Promise<ArticleForGenerateContent[]> {
    return this.articleRepository.findCandidatesForNewsletter();
  }

  /** HTML template with markers for title and content injection */
  htmlTemplate: HtmlTemplate = {
    html: createNewsletterHtmlTemplate(
      crawlingTargetGroups.flatMap((group) => group.targets),
    ),
    markers: {
      title: 'NEWSLETTER_TITLE',
      content: 'NEWSLETTER_CONTENT',
    },
  };

  /**
   * Save generated newsletter to the repository
   * @param input - Newsletter data and used articles
   * @returns Saved newsletter ID
   */
  async saveNewsletter(input: {
    newsletter: Newsletter;
    usedArticles: ArticleForGenerateContent[];
  }): Promise<{ id: string | number }> {
    return this.newsletterRepository.saveNewsletter(input);
  }
}
