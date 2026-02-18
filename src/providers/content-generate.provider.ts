import type { GoogleGenerativeAIProvider } from '@ai-sdk/google';
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
  NewsletterTemplateOptions,
} from '../types/dependencies';

import { createNewsletterHtmlTemplate } from '~/templates/newsletter-html';

import {
  createCrawlingTargetGroups,
  llmConfig,
  newsletterConfig,
} from '../config';

/**
 * Content generation provider implementation
 * - LLM-based newsletter content generation (Google Generative AI)
 * - HTML template provisioning
 * - Newsletter persistence
 */
export class ContentGenerateProvider implements CoreContentGenerateProvider {
  private _issueOrder: number | null = null;

  model: ReturnType<GoogleGenerativeAIProvider>;

  /** HTML template with markers for title and content injection */
  htmlTemplate: HtmlTemplate;

  /** Newsletter brand name (defaults to config, can be overridden via constructor) */
  newsletterBrandName: string;

  constructor(
    private readonly google: GoogleGenerativeAIProvider,
    private readonly articleRepository: ArticleRepository,
    private readonly newsletterRepository: NewsletterRepository,
    templateOptions?: NewsletterTemplateOptions,
    brandName?: string,
  ) {
    this.model = this.google('gemini-3-pro-preview');
    this.newsletterBrandName = brandName ?? newsletterConfig.brandName;
    this.htmlTemplate = {
      html: createNewsletterHtmlTemplate(
        createCrawlingTargetGroups().flatMap((group) => group.targets),
        templateOptions,
      ),
      markers: {
        title: 'NEWSLETTER_TITLE',
        content: 'NEWSLETTER_CONTENT',
      },
    };
  }

  /** LLM temperature setting for content generation */
  temperature = llmConfig.generation.temperature;

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
