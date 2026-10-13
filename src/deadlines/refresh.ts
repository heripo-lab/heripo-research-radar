import type { ArticleDeadline, UrlString } from '@llm-newsletter-kit/core';
import type { LanguageModelUsage } from 'ai';

import { isArticleDeadlineGrounded } from '@llm-newsletter-kit/core';
import * as cheerio from 'cheerio';
import { createHash } from 'node:crypto';

import { createCrawlingTargetGroups } from '../config';
import { createResearchRadarFetch } from '../crawling/source-fetch';
import { ALIO_LIST_URL } from '../parsers/alio.parser';
import { buildG2bDetailUrl } from '../parsers/g2b.parser';
import { G2B_LIST_URL } from '../parsers/g2b.parser';
import { GOJOBS_LIST_URL } from '../parsers/gojobs.parser';
import {
  type ResearchRadarDeadlineExtractionConfig,
  extractResearchRadarDeadlines,
} from './extract';

export interface ResearchRadarDeadlineSource {
  title: string;
  url: UrlString;
  /** Original board URL retained when the article was collected. */
  targetUrl: UrlString;
}

export type DeadlineVerificationFailure =
  | 'unsupported-source'
  | 'invalid-source-url'
  | 'source-unavailable'
  | 'empty-source'
  | 'no-supported-deadlines'
  | 'extraction-failed';

type FetchedSource = {
  status: 'fetched';
  article: { title: string; detailContent: string; url: UrlString };
  sourceHash: string;
  checkedAt: string;
};
type UnverifiedSource = {
  status: 'unverified';
  reason: DeadlineVerificationFailure;
  checkedAt: string;
};
export type ResearchRadarDeadlineSourceResult =
  FetchedSource | UnverifiedSource;
export type ResearchRadarDeadlineRefreshResult =
  | (Omit<FetchedSource, 'status'> & {
      status: 'verified';
      deadlines: ArticleDeadline[];
      usage: LanguageModelUsage | undefined;
    })
  | UnverifiedSource;

export interface ResearchRadarDeadlineSourceOptions {
  source: ResearchRadarDeadlineSource;
  customFetch?: typeof fetch;
  publicDataApiKey?: string;
  /** Total budget for the original page and parser API requests, not LLM calls. */
  timeoutMs?: number;
}
export type ResearchRadarDeadlineRefreshConfig =
  ResearchRadarDeadlineSourceOptions &
    Omit<ResearchRadarDeadlineExtractionConfig, 'article'> & {
      /** Cache only a successful extraction from this source. A fresh fetch is mandatory. */
      previous?: { sourceHash: string; deadlines: ArticleDeadline[] };
    };

const failure = (reason: DeadlineVerificationFailure): UnverifiedSource => ({
  status: 'unverified',
  reason,
  checkedAt: new Date().toISOString(),
});
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Fresh API, metadata and visible headings retain headline-only source changes. */
function readTitle(body: string): string {
  try {
    const data: unknown = JSON.parse(body);
    if (isRecord(data)) {
      const post = isRecord(data.item)
        ? data.item
        : isRecord(data.result)
          ? data.result
          : undefined;
      if (post) {
        for (const key of ['title', 'recrutPbancTtl', 'nttSj', 'bidNtceNm']) {
          if (typeof post[key] === 'string') return post[key].trim();
        }
      }
    }
  } catch {
    /* Ordinary HTML and XML sources. */
  }
  const $ = cheerio.load(body);
  // A site's metadata can stay generic while the visible post headline changes.
  // Preserve both so a headline-only cancellation invalidates the source cache
  // and reaches extraction, including titles outside the parser's body selector.
  const headings = $(
    'h1, h2, h3, h4, h5, h6, .board-view-top, .board-view-title, .view-title, .view_tit, .viewTitle, .bbs_title, .subject',
  )
    .filter(
      (_, node) =>
        !$(node).closest(
          'header, nav, footer, aside, [hidden], [aria-hidden="true"]',
        ).length,
    )
    .map((_, node) => $(node).text().replace(/\s+/g, ' ').trim())
    .get();
  return [
    ...new Set(
      [
        $('meta[property="og:title"]').attr('content')?.trim(),
        $('item title').first().text().trim(),
        $('title').first().text().trim(),
        ...headings,
      ].filter(Boolean),
    ),
  ].join('\n');
}

/**
 * Fetches only the registered detail source and any API requests its parser
 * requires. Does not enumerate lists, look up existing URLs, score, or save.
 */
export async function fetchResearchRadarDeadlineSource({
  source,
  customFetch = fetch,
  publicDataApiKey,
  timeoutMs = 15_000,
}: ResearchRadarDeadlineSourceOptions): Promise<ResearchRadarDeadlineSourceResult> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0)
    throw new Error('timeoutMs must be positive');
  let url: URL;
  let board: URL;
  try {
    url = new URL(source.url);
    board = new URL(source.targetUrl);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.origin !== board.origin
    ) {
      return failure('invalid-source-url');
    }
  } catch {
    return failure('invalid-source-url');
  }

  if (
    [G2B_LIST_URL, GOJOBS_LIST_URL, ALIO_LIST_URL].some((list) => {
      const endpoint = new URL(list);
      return (
        url.origin === endpoint.origin && url.pathname === endpoint.pathname
      );
    })
  )
    return failure('invalid-source-url');

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new Error('Source verification timed out')),
    timeoutMs,
  );
  let currentTitle = '';
  let latestUrl: UrlString = source.url;
  const boundedFetch: typeof fetch = async (input, init) => {
    const requested = new URL(
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );
    if (
      requested.username ||
      requested.password ||
      (requested.origin !== board.origin &&
        requested.origin !== 'https://apis.data.go.kr')
    ) {
      throw new Error('Unexpected source origin');
    }
    controller.signal.throwIfAborted();
    const inherited =
      init?.signal ?? (input instanceof Request ? input.signal : undefined);
    const response = await customFetch(input, {
      ...init,
      redirect: 'error',
      cache: 'no-store',
      signal: inherited
        ? AbortSignal.any([controller.signal, inherited])
        : controller.signal,
    });
    if (!response.ok) throw new Error('Source request failed');
    const body = await response.clone().text();
    if (requested.pathname !== '/robots.txt') {
      const title = readTitle(body);
      if (title) currentTitle = title;
    }
    return response;
  };
  const sourceFetch = createResearchRadarFetch({
    customFetch: boundedFetch,
    publicDataApiKey,
    refreshG2bDetails: true,
  });
  const groups = createCrawlingTargetGroups(sourceFetch);
  const targets = groups.flatMap((group) => group.targets);
  const target = targets.find(
    (candidate) => candidate.url === source.targetUrl,
  );
  if (!target) {
    clearTimeout(timer);
    return failure('unsupported-source');
  }
  if (
    targets.some(
      (candidate) => candidate.url.split('#')[0] === source.url.split('#')[0],
    )
  ) {
    clearTimeout(timer);
    return failure('invalid-source-url');
  }

  const read = async (): Promise<ResearchRadarDeadlineSourceResult> => {
    const response = await sourceFetch(source.url);
    if (!response.ok) return failure('source-unavailable');
    const raw = await response.text();
    const parsed = await target.parseDetail(raw);
    controller.signal.throwIfAborted();
    const detailContent = parsed.detailContent.trim();
    const title =
      currentTitle ||
      /^#{1,6}\s+(.+)$/m.exec(detailContent)?.[1] ||
      source.title;
    if (!detailContent && !currentTitle) return failure('empty-source');
    // G2B's adapter synthesizes its response after boundedFetch, so read its
    // latest revision/title here as well.
    if (board.hostname === 'www.g2b.go.kr') {
      const data: unknown = JSON.parse(raw);
      if (
        isRecord(data) &&
        isRecord(data.item) &&
        typeof data.item.bidNtceNo === 'string' &&
        typeof data.item.bidNtceOrd === 'string'
      ) {
        latestUrl = buildG2bDetailUrl(
          data.item.bidNtceNo,
          data.item.bidNtceOrd,
        ) as UrlString;
      }
    }
    const sourceHash = createHash('sha256')
      .update(
        JSON.stringify([source.targetUrl, latestUrl, title, detailContent]),
      )
      .digest('hex');
    return {
      status: 'fetched',
      article: { title, detailContent, url: latestUrl },
      sourceHash,
      checkedAt: new Date().toISOString(),
    };
  };
  let rejectTimeout: (() => void) | undefined;
  try {
    const aborted = new Promise<never>((_, reject) => {
      rejectTimeout = () => reject(new Error('Source verification timed out'));
      controller.signal.addEventListener('abort', rejectTimeout, {
        once: true,
      });
    });
    return await Promise.race([read(), aborted]);
  } catch {
    return failure('source-unavailable');
  } finally {
    if (rejectTimeout)
      controller.signal.removeEventListener('abort', rejectTimeout);
    controller.abort();
    clearTimeout(timer);
  }
}

/** Only explicit, grounded results are verified. Missing dates are never cancellation. */
export async function refreshResearchRadarDeadlines(
  config: ResearchRadarDeadlineRefreshConfig,
): Promise<ResearchRadarDeadlineRefreshResult> {
  const source = await fetchResearchRadarDeadlineSource(config);
  if (source.status === 'unverified') return source;
  try {
    const extracted =
      config.previous?.sourceHash === source.sourceHash &&
      config.previous.deadlines.length &&
      config.previous.deadlines.every((deadline) =>
        isArticleDeadlineGrounded(deadline, source.article),
      )
        ? { deadlines: config.previous.deadlines, usage: undefined }
        : await extractResearchRadarDeadlines({
            model: config.model,
            article: source.article,
            outputLanguage: config.outputLanguage,
            maxRetries: config.maxRetries,
            promptBuilder: config.promptBuilder,
          });
    if (!extracted.deadlines.length) return failure('no-supported-deadlines');
    return { ...source, status: 'verified', ...extracted };
  } catch {
    return failure('extraction-failed');
  }
}
