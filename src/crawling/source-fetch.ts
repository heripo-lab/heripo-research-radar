import type { AppLogger } from '@llm-newsletter-kit/core';

import type { ExcavationReportSource } from '../types/dependencies';
import type { HeritageBidTriage } from './heritage-triage';

import { robotsExemptOrigins } from '../config';
import { createAlioFetch } from '../parsers/alio.parser';
import { createExcavationReportFetch } from '../parsers/excavation.parser';
import { createG2bFetch } from '../parsers/g2b.parser';
import { createGojobsFetch } from '../parsers/gojobs.parser';
import { createKrasFetch } from '../parsers/kras.parser';
import { createRobotsAwareFetch } from './robots';

export interface ResearchRadarFetchOptions {
  customFetch?: typeof fetch;
  excavationReportSource?: ExcavationReportSource;
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
  return excavationReportSource
    ? createExcavationReportFetch(withPublicJobs, excavationReportSource)
    : withPublicJobs;
}
