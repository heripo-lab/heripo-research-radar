import type { AppLogger } from '@llm-newsletter-kit/core';

import type {
  ExcavationReportSource,
  JournalIssueSource,
} from '../types/dependencies';
import type { HeritageBidTriage } from './heritage-triage';

import { robotsExemptOrigins } from '../config';
import { createAlioFetch } from '../parsers/alio.parser';
import { createExcavationReportFetch } from '../parsers/excavation.parser';
import { createG2bFetch } from '../parsers/g2b.parser';
import { createGojobsFetch } from '../parsers/gojobs.parser';
import { createJournalIssueFetch } from '../parsers/journal-issue.parser';
import { createKrasFetch } from '../parsers/kras.parser';
import { createRobotsAwareFetch } from './robots';

export interface ResearchRadarFetchOptions {
  customFetch?: typeof fetch;
  excavationReportSource?: ExcavationReportSource;
  journalIssueSource?: JournalIssueSource;
  logger?: AppLogger;
  publicDataApiKey?: string;
  bidTriage?: HeritageBidTriage;
  /** Query a notice number rather than relying on the daily list cache. */
  refreshG2bDetails?: boolean;
}

/** Shared network/adapters path for daily crawling and single-source refresh. */
export function createResearchRadarFetch({
  customFetch,
  excavationReportSource,
  journalIssueSource,
  logger,
  publicDataApiKey,
  bidTriage,
  refreshG2bDetails,
}: ResearchRadarFetchOptions = {}): typeof fetch {
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
  const withPublicJobs = createG2bFetch(
    createAlioFetch(
      createGojobsFetch(withKras, {
        apiKey: publicDataApiKey ?? '',
        onError: (reason) => {
          logger?.error({
            event: 'crawl.gojobs.list.failed',
            data: { reason },
          });
        },
      }),
      {
        apiKey: publicDataApiKey ?? '',
        onError: (reason) => {
          logger?.error({
            event: 'crawl.alio.list.failed',
            data: { reason },
          });
        },
      },
    ),
    {
      apiKey: publicDataApiKey ?? '',
      triage: bidTriage,
      refreshDetails: refreshG2bDetails,
      onError: (reason) => {
        logger?.error({
          event: 'crawl.g2b.list.failed',
          data: { reason },
        });
      },
    },
  );

  // When the application supplies excavation reports, that board is served
  // from the injected source and never requested over the network. Every
  // other target keeps going through the same fetch as before.
  const withExcavationReports = excavationReportSource
    ? createExcavationReportFetch(withPublicJobs, excavationReportSource)
    : withPublicJobs;

  // Journal issues have no live board to fall back to, so this adapter is
  // always installed: without a source the target is an empty list and its
  // URL is never requested.
  return createJournalIssueFetch(withExcavationReports, journalIssueSource);
}

/**
 * Fetch for downloading article images during image analysis, built only
 * when the application injects its own fetch.
 *
 * Images are requested from the boards and the CDNs they embed, so they go
 * through the application's fetch — a proxy or TLS workaround a board needs
 * applies to its images too — behind a robots.txt gate. A disallowed image is
 * answered with an HTML placeholder, which core skips as not an image. The
 * board adapters are left out: they only rewrite list and detail URLs, never
 * image URLs.
 *
 * Core checks that each image URL and redirect hop points at a public
 * address before calling this fetch, and robots.txt is looked up on the same
 * host and may not redirect off it. Checking the address as the connection is
 * made is up to the injected fetch: core does it only on its own default
 * download, which is why this is not built without an injected fetch.
 */
export function createImageFetch(
  customFetch: typeof fetch,
  logger?: AppLogger,
): typeof fetch {
  return createRobotsAwareFetch(customFetch, {
    exemptOrigins: robotsExemptOrigins,
    // Image hosts come from article bodies, so robots.txt must not redirect
    // the request to another host.
    sameHostRedirectsOnly: true,
    onBlocked: ({ url, rule, userAgent }) => {
      logger?.info({
        event: 'analysis.images.robots.blocked',
        data: { url, rule, userAgent },
      });
    },
  });
}
