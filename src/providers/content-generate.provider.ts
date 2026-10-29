import type {
  ArticleForGenerateContent,
  ContentGenerateProvider as CoreContentGenerateProvider,
  HtmlTemplate,
  IsoDateString,
  Newsletter,
  UrlString,
} from '@llm-newsletter-kit/core';
import type { LanguageModel } from 'ai';

import type { DeadlineReminderSelector } from '../deadlines/select';
import type { JournalIssueLoader } from '../journals/loader';
import type { JournalPaperSelector } from '../journals/select';
import type {
  ArticleRepository,
  JournalIssue,
  NewsletterRepository,
  NewsletterTemplateOptions,
} from '../types/dependencies';

import { JSDOM } from 'jsdom';
import juice from 'juice';

import { createNewsletterHtmlTemplate } from '~/templates/newsletter-html';

import { llmConfig, newsletterConfig } from '../config';
import {
  eligibleDeadlineReminders,
  escapeLabel,
  formatDeadlineReminders,
  renderVerifiedDeadlineReminders,
} from '../deadlines/reminders';
import { collectNewsletterDeadlines } from '../deadlines/section';
import {
  insertJournalIssueHtml,
  insertJournalIssueMarkdown,
  renderJournalIssueSection,
} from '../journals/section';
import { JOURNAL_ISSUE_LIST_URL } from '../parsers/journal-issue.parser';

/**
 * Injected journal issues are rendered by the provider rather than written by
 * the model: each is a table of up to twenty titles and author lists, which
 * the model would have to copy exactly.
 */
export type JournalIssueRendering = {
  /** The run's injected issues, matched to candidates by URL. */
  load: JournalIssueLoader;
  /** Picks the papers readers would care about; omitted, every paper is listed. */
  select?: JournalPaperSelector;
  /** Reports that the issues could not be loaded, so the model got them. */
  onUnavailable?: (reason: string) => void;
};

/**
 * Content generation provider implementation
 * - LLM-based newsletter content generation
 * - HTML template provisioning
 * - Newsletter persistence
 */
export class ContentGenerateProvider implements CoreContentGenerateProvider {
  private _issueOrder: number | null = null;
  private readonly deadlineRemindersMarkdown: string;
  private heldJournalIssues: {
    article: ArticleForGenerateContent;
    issue: JournalIssue;
  }[] = [];

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
    /** Chooses displayed reminders; omitted, the first rows by date display. */
    private readonly selectDeadlineReminders?: DeadlineReminderSelector,
    private readonly journalIssues?: JournalIssueRendering,
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
    const candidates =
      await this.articleRepository.findCandidatesForNewsletter();
    this.heldJournalIssues = [];

    const journalCandidates = candidates.filter(
      (article) => article.targetUrl === JOURNAL_ISSUE_LIST_URL,
    );
    if (!this.journalIssues || journalCandidates.length === 0) {
      return candidates;
    }

    // An issue this run cannot load is left to the model, as before; it is
    // never dropped.
    let issues: JournalIssue[];
    try {
      issues = await this.journalIssues.load();
    } catch (error) {
      this.journalIssues.onUnavailable?.(
        error instanceof Error ? error.message : String(error),
      );
      return candidates;
    }
    const issuesByUrl = new Map(issues.map((issue) => [issue.url, issue]));
    this.heldJournalIssues = journalCandidates.flatMap((article) => {
      const issue = issuesByUrl.get(article.url);
      return issue ? [{ article, issue }] : [];
    });
    const held = new Set(this.heldJournalIssues.map(({ article }) => article));
    return candidates.filter((article) => !held.has(article));
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
      /^\s*(?:\*\*임박한 주요 일정 및 마감:|##\s+⏰\s*다가오는 (?:일정\s*·\s*마감|마감))/m.test(
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
        ? await this.renderDeadlineReminders(reminders, newsletter.date)
        : this.deadlineRemindersMarkdown ||
          (await this.renderDeadlineReminders(reminders, newsletter.date));
    const journalMarkdown = await this.renderJournalIssues();
    const share =
      this.templateOptions?.shareNoticeMarkdown ??
      `이 소식이 도움이 되셨다면 동료 연구자에게도 소개해주시면 좋겠습니다. [${escapeLabel(this.newsletterBrandName)} 구독하기](${this.subscribePageUrl})`;
    // Render only the closing block with the original stylesheet. Keep core's
    // already-rendered article body, separators, title and announcements intact.
    const closingDocument = new JSDOM(
      juice(
        createNewsletterHtmlTemplate({
          ...this.templateOptions,
          deadlineRemindersMarkdown: markdown,
          shareNoticeMarkdown: share,
          journalIssuesMarkdown: journalMarkdown,
        }),
      ),
    ).window.document;
    const dom = new JSDOM(newsletter.htmlBody);
    const document = dom.window.document;
    const closing = document.querySelector('[data-research-radar-closing]');
    if (!closing) throw new Error('Newsletter closing block not found');
    const journalSection = closingDocument.querySelector(
      '[data-research-radar-journal-issues]',
    );
    if (journalSection) {
      insertJournalIssueHtml(
        document,
        document.importNode(journalSection, true),
        closing,
      );
    }
    closing.outerHTML = closingDocument.querySelector(
      '[data-research-radar-closing]',
    )!.outerHTML;
    // Core hands back only the candidates the model saw; the held-aside
    // journal articles are part of this issue too.
    const usedIds = new Set(usedArticles.map((article) => article.id));
    return this.newsletterRepository.saveNewsletter({
      ...input,
      usedArticles: [
        ...usedArticles,
        ...this.heldJournalIssues
          .map(({ article }) => article)
          .filter((article) => !usedIds.has(article.id)),
      ],
      newsletter: {
        ...newsletter,
        content: `${insertJournalIssueMarkdown(newsletter.content, journalMarkdown)}${markdown ? `\n\n<!-- research-radar-deadline-reminders -->\n${markdown}` : ''}${share ? `\n\n<!-- research-radar-share-notice -->\n${share}` : ''}`,
        htmlBody: dom.serialize(),
      },
    });
  }

  private async renderJournalIssues(): Promise<string> {
    if (this.heldJournalIssues.length === 0) return '';
    const select = this.journalIssues?.select;
    const entries = await Promise.all(
      this.heldJournalIssues.map(async ({ issue }) => ({
        issue,
        selection: select ? await select(issue) : null,
      })),
    );
    return renderJournalIssueSection(entries);
  }

  private async renderDeadlineReminders(
    reminders: Parameters<typeof renderVerifiedDeadlineReminders>[0],
    publicationDate: IsoDateString,
  ): Promise<string> {
    if (!this.selectDeadlineReminders)
      return renderVerifiedDeadlineReminders(reminders, publicationDate);
    const rows = eligibleDeadlineReminders(reminders, publicationDate);
    return formatDeadlineReminders(
      await this.selectDeadlineReminders(rows, publicationDate),
    );
  }
}
