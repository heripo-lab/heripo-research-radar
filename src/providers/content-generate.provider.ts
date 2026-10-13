import type {
  ArticleForGenerateContent,
  ContentGenerateProvider as CoreContentGenerateProvider,
  HtmlTemplate,
  IsoDateString,
  Newsletter,
  UrlString,
} from '@llm-newsletter-kit/core';
import type { LanguageModel } from 'ai';

import type {
  ArticleRepository,
  NewsletterRepository,
  NewsletterTemplateOptions,
} from '../types/dependencies';

import { JSDOM } from 'jsdom';
import juice from 'juice';

import { createNewsletterHtmlTemplate } from '~/templates/newsletter-html';

import { llmConfig, newsletterConfig } from '../config';
import {
  escapeLabel,
  renderVerifiedDeadlineReminders,
} from '../deadlines/reminders';
import { collectNewsletterDeadlines } from '../deadlines/section';

/**
 * Content generation provider implementation
 * - LLM-based newsletter content generation
 * - HTML template provisioning
 * - Newsletter persistence
 */
export class ContentGenerateProvider implements CoreContentGenerateProvider {
  private _issueOrder: number | null = null;
  private readonly deadlineRemindersMarkdown: string;

  readonly model: LanguageModel;

  readonly fetchRecentTitles?: CoreContentGenerateProvider['fetchRecentTitles'];

  /** HTML template with markers for title and content injection */
  htmlTemplate: HtmlTemplate;

  /** Newsletter brand name (defaults to config, can be overridden via constructor) */
  newsletterBrandName: string;

  constructor(
    model: LanguageModel,
    private readonly articleRepository: ArticleRepository,
    private readonly newsletterRepository: NewsletterRepository,
    private readonly templateOptions?: NewsletterTemplateOptions,
    brandName?: string,
  ) {
    this.model = model;
    this.deadlineRemindersMarkdown =
      templateOptions?.deadlineRemindersMarkdown?.trim() ?? '';
    if (newsletterRepository.findRecentPublishedTitles) {
      const findTitles =
        newsletterRepository.findRecentPublishedTitles.bind(
          newsletterRepository,
        );
      this.fetchRecentTitles = (publicationDate) => {
        const start = new Date(`${publicationDate}T00:00:00Z`);
        start.setUTCDate(start.getUTCDate() - 7);
        return findTitles({
          fromInclusive: start.toISOString().slice(0, 10) as IsoDateString,
          toExclusive: publicationDate,
        });
      };
    }
    this.newsletterBrandName = brandName ?? newsletterConfig.brandName;
    this.htmlTemplate = {
      html: createNewsletterHtmlTemplate(templateOptions),
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
    const { newsletter, usedArticles } = input;
    // Reject conflicting model output before any persistence, rather than
    // silently publishing a second schedule block or misplaced sharing link.
    if (
      /^\s*(?:\*\*임박한 주요 일정 및 마감:|##\s+⏰\s*다가오는 마감)/m.test(
        newsletter.content,
      )
    )
      throw new Error('Generated body contains an additional deadline summary');
    if (newsletter.content.includes(this.subscribePageUrl))
      throw new Error(
        'Generated body contains the sharing link before the closing block',
      );
    const reminders = collectNewsletterDeadlines(
      newsletter.content,
      usedArticles,
      this.templateOptions?.verifiedDeadlineReminders ?? [],
    );
    const markdown =
      this.templateOptions?.verifiedDeadlineReminders !== undefined
        ? renderVerifiedDeadlineReminders(reminders, newsletter.date)
        : this.deadlineRemindersMarkdown ||
          renderVerifiedDeadlineReminders(reminders, newsletter.date);
    const share = `이 소식이 도움이 되셨다면 동료 연구자에게도 소개해주시면 좋겠습니다. [${escapeLabel(this.newsletterBrandName)} 구독하기](${this.subscribePageUrl})`;
    // Render only the closing block with the original stylesheet. Keep core's
    // already-rendered article body, separators, title and announcements intact.
    const closingDocument = new JSDOM(
      juice(
        createNewsletterHtmlTemplate({
          ...this.templateOptions,
          deadlineRemindersMarkdown: markdown,
          shareNoticeMarkdown: share,
        }),
      ),
    ).window.document;
    const dom = new JSDOM(newsletter.htmlBody);
    const document = dom.window.document;
    const closing = document.querySelector('[data-research-radar-closing]');
    if (!closing) throw new Error('Newsletter closing block not found');
    closing.outerHTML = closingDocument.querySelector(
      '[data-research-radar-closing]',
    )!.outerHTML;
    return this.newsletterRepository.saveNewsletter({
      ...input,
      newsletter: {
        ...newsletter,
        content: `${newsletter.content}${markdown ? `\n\n<!-- research-radar-deadline-reminders -->\n${markdown}` : ''}\n\n<!-- research-radar-share-notice -->\n${share}`,
        htmlBody: dom.serialize(),
      },
    });
  }
}
