import {
  DateType,
  type ParsedTargetDetail,
  type ParsedTargetListItem,
} from '@llm-newsletter-kit/core';

import type {
  JournalIssue,
  JournalIssuePaper,
  JournalIssueSource,
} from '~/types/dependencies';

/**
 * Board URL of the journal issue target.
 *
 * There is no list page behind it: the adapter below answers it from the
 * application's injected issues and never sends it. It points at KCI because
 * that is where the issues come from, and it is what the source list shows.
 */
export const JOURNAL_ISSUE_LIST_URL =
  'https://www.kci.go.kr/kciportal/main.kci';

/** Abstract length kept per paper, so a large issue stays a bounded input. */
const ABSTRACT_MAX_LENGTH = 300;

/** Keywords listed in the issue summary. */
const KEYWORD_SUMMARY_LIMIT = 15;

/**
 * Marks a response body as injected issue data rather than scraped HTML, so
 * the parsers below can tell the two apart without guessing.
 */
const INJECTED_MARKER = '@heripo/research-radar:journal-issues';

type InjectedListPayload = {
  marker: typeof INJECTED_MARKER;
  issues: JournalIssue[];
};

type InjectedDetailPayload = {
  marker: typeof INJECTED_MARKER;
  issue: JournalIssue;
};

function parseInjectedPayload<T extends { marker: string }>(
  body: string,
): T | null {
  if (!body.includes(INJECTED_MARKER)) {
    return null;
  }

  try {
    const parsed = JSON.parse(body) as T;
    return parsed.marker === INJECTED_MARKER ? parsed : null;
  } catch {
    return null;
  }
}

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function requestHref(input: string | URL | Request): string {
  return typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.href
      : input.url;
}

/**
 * Settles with `promise`, or rejects once `signal` aborts. The promise keeps
 * running; only this request stops waiting for it, as a network fetch would.
 */
function untilAborted<T>(promise: Promise<T>, signal?: AbortSignal | null) {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(resolve, reject).finally(() => {
      signal.removeEventListener('abort', onAbort);
    });
  });
}

/**
 * Serves the journal issue target from an injected source.
 *
 * Core's crawling chain always fetches a target's list URL and then each detail
 * URL, so the substitution happens at the fetch layer — the same seam
 * `createExcavationReportFetch` uses. Unlike that board there is nothing to
 * crawl instead, so the list URL is always answered here: with no source it is
 * an empty list and no request is made. Detail requests are matched against
 * the URLs of the issues already served; anything else is delegated.
 *
 * `source` is called once and its result reused for the detail requests that
 * follow. The adapter sits outermost on the fetch every target shares, so only
 * the list request ever waits on the source: other requests are matched
 * against issues already served, without awaiting, so a slow or failing source
 * cannot stall or break the rest of the crawl. Core requests this target's
 * details only after its list has parsed. A failed source is retried on the
 * next list request. The list request honors its abort signal, so core's
 * request timeout ends this target even when the source never settles.
 *
 * @param baseFetch - Fetch to delegate every other request to
 * @param source - Supplies the issues for this run
 */
export const createJournalIssueFetch = (
  baseFetch: typeof fetch = fetch,
  source?: JournalIssueSource,
): typeof fetch => {
  let pending: Promise<JournalIssue[]> | null = null;
  const issuesByUrl = new Map<string, JournalIssue>();
  const loadIssues = () =>
    (pending ??= (source ? source() : Promise.resolve([])).then(
      (issues) => {
        for (const issue of issues) issuesByUrl.set(issue.url, issue);
        return issues;
      },
      (error: unknown) => {
        pending = null;
        throw error;
      },
    ));

  return async (input, init) => {
    const href = requestHref(input);

    if (href === JOURNAL_ISSUE_LIST_URL) {
      return jsonResponse({
        marker: INJECTED_MARKER,
        issues: await untilAborted(loadIssues(), init?.signal),
      } satisfies InjectedListPayload);
    }

    const issue = issuesByUrl.get(href);
    if (issue) {
      return jsonResponse({
        marker: INJECTED_MARKER,
        issue,
      } satisfies InjectedDetailPayload);
    }

    return baseFetch(input, init);
  };
};

/** "제59권 제3호", or whichever part the journal numbers. */
export function formatVolumeIssue(issue: JournalIssue): string {
  const label = (value: string, unit: string) => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    return /^\d+$/.test(trimmed) ? `제${trimmed}${unit}` : trimmed;
  };

  // Some journals register the publication year as the volume on KCI
  // (한국고고학보 2026-3), which would read as "제2026권".
  const volume =
    issue.volume.trim() === String(issue.publishedYear) ? '' : issue.volume;

  return [label(volume, '권'), label(issue.issue, '호')]
    .filter(Boolean)
    .join(' ');
}

export function formatJournalIssueTitle(issue: JournalIssue): string {
  const volumeIssue = formatVolumeIssue(issue);

  return [
    issue.journalName.trim(),
    volumeIssue,
    `발간 (${issue.publishedYear}년 ${issue.publishedMonth}월)`,
  ]
    .filter(Boolean)
    .join(' ');
}

/** Keyword counts by paper. A keyword repeated within one paper counts once. */
function countKeywords(papers: JournalIssuePaper[]) {
  const counts = new Map<string, number>();

  for (const paper of papers) {
    const keywords = new Set(
      paper.keywords.map((keyword) => keyword.trim()).filter(Boolean),
    );
    for (const keyword of keywords) {
      counts.set(keyword, (counts.get(keyword) ?? 0) + 1);
    }
  }

  return [...counts]
    .map(([keyword, paperCount]) => ({ keyword, paperCount }))
    .sort(
      (a, b) =>
        b.paperCount - a.paperCount || a.keyword.localeCompare(b.keyword, 'ko'),
    );
}

function truncate(text: string, maxLength: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const characters = [...normalized];

  return characters.length > maxLength
    ? `${characters.slice(0, maxLength).join('')}…`
    : normalized;
}

/** Renders an issue as the article body: summary, keywords, then every paper. */
export function renderJournalIssueContent(issue: JournalIssue): string {
  const volumeIssue = formatVolumeIssue(issue);
  const lines = [
    '## 학술지 권호 정보',
    '',
    `- **학술지**: ${issue.journalName.trim()}`,
    `- **발행**: ${issue.publishedYear}년 ${issue.publishedMonth}월`,
    ...(volumeIssue ? [`- **권호**: ${volumeIssue}`] : []),
    `- **수록 논문**: ${issue.papers.length}편`,
  ];

  // Counts are per paper and overlap, so they are not summed into a total.
  // Only keywords shared by several papers say anything about the issue; when
  // every keyword is unique the summary would just be the alphabetical head of
  // the list, so it is left out.
  const keywords = countKeywords(issue.papers)
    .filter(({ paperCount }) => paperCount > 1)
    .slice(0, KEYWORD_SUMMARY_LIMIT);
  if (keywords.length > 0) {
    lines.push(
      '',
      '## 여러 논문이 다룬 키워드',
      '',
      keywords
        .map(({ keyword, paperCount }) => `${keyword}(${paperCount}편)`)
        .join(', '),
    );
  }

  lines.push('', '## 수록 논문', '');
  issue.papers.forEach((paper, index) => {
    lines.push(`${index + 1}. **[${paper.title.trim()}](${paper.url})**`);

    const authors = paper.authors.map((name) => name.trim()).filter(Boolean);
    if (authors.length > 0) {
      lines.push(`   - 저자: ${authors.join(', ')}`);
    }

    const keywords = [
      ...new Set(paper.keywords.map((k) => k.trim()).filter(Boolean)),
    ];
    if (keywords.length > 0) {
      lines.push(`   - 키워드: ${keywords.join(', ')}`);
    }

    const abstract = paper.abstract?.trim();
    if (abstract) {
      lines.push(`   - 초록: ${truncate(abstract, ABSTRACT_MAX_LENGTH)}`);
    }
  });

  return lines.join('\n');
}

export const parseJournalIssueList = (html: string): ParsedTargetListItem[] => {
  const injected = parseInjectedPayload<InjectedListPayload>(html);

  if (!injected) {
    return [];
  }

  return injected.issues.map((issue) => ({
    uniqId: issue.externalId,
    title: formatJournalIssueTitle(issue),
    date: issue.registeredDate,
    detailUrl: issue.url,
    dateType: DateType.REGISTERED,
  }));
};

export const parseJournalIssueDetail = (html: string): ParsedTargetDetail => {
  const injected = parseInjectedPayload<InjectedDetailPayload>(html);

  return {
    detailContent: injected ? renderJournalIssueContent(injected.issue) : '',
    hasAttachedFile: false,
    hasAttachedImage: false,
  };
};
