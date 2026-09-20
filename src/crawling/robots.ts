/**
 * robots.txt enforcement for crawling.
 *
 * Applied at the fetch layer, the same seam the KRAS and excavation-report
 * adapters use, so core's crawling pipeline is untouched: a disallowed request
 * is answered locally with an empty document instead of being sent, and the
 * target simply yields no articles. The refusal is reported through
 * `onBlocked`, not as a fetch failure — see {@link createRobotsGate} for why
 * that distinction matters.
 */

/** One `Allow:` or `Disallow:` line. */
export type RobotsRule = {
  allow: boolean;
  path: string;
};

/** Consecutive `User-agent:` lines and the rules that follow them. */
export type RobotsGroup = {
  agents: string[];
  rules: RobotsRule[];
};

export type RobotsBlockInfo = {
  url: string;
  userAgent: string;
  /** The rule that denied the request, e.g. `Disallow: /`. */
  rule: string;
};

export type RobotsAwareFetchOptions = {
  /** Called when a request is refused. Intended for logging. */
  onBlocked?: (info: RobotsBlockInfo) => void;
  /** Timeout for fetching robots.txt itself. @default 10000 */
  timeoutMs?: number;
  /**
   * Origins exempted from the check, e.g. `http://www.yngogo.or.kr`.
   *
   * These are deliberate overrides of a site's stated policy, so keep the list
   * short, record why each entry is there, and revisit it when a site's
   * robots.txt changes. Requests to these origins are sent without ever
   * consulting robots.txt.
   */
  exemptOrigins?: readonly string[];
};

/**
 * Parses robots.txt into user-agent groups.
 *
 * Unknown fields (Sitemap, Crawl-delay, Host) and malformed lines are skipped —
 * 국가유산청 serves a `Disaloow:` typo, which must not be read as a rule.
 * Consecutive `User-agent:` lines share one rule block, per the spec.
 */
export function parseRobotsTxt(text: string): RobotsGroup[] {
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | null = null;
  let previousLineWasAgent = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.split('#')[0].trim();

    if (!line) {
      continue;
    }

    const separator = line.indexOf(':');

    if (separator === -1) {
      continue;
    }

    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (field === 'user-agent') {
      if (!previousLineWasAgent || !current) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }

      current.agents.push(value.toLowerCase());
      previousLineWasAgent = true;
      continue;
    }

    if (field === 'allow' || field === 'disallow') {
      current?.rules.push({ allow: field === 'allow', path: value });
    }

    previousLineWasAgent = false;
  }

  return groups;
}

/** Matches a robots path pattern, supporting `*` wildcards and a `$` anchor. */
function matchesPattern(pattern: string, path: string): boolean {
  if (pattern === '') {
    return false;
  }

  const anchored = pattern.endsWith('$');
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const segments = body.split('*');
  let position = 0;

  for (const [index, segment] of segments.entries()) {
    if (index === 0) {
      if (!path.startsWith(segment)) {
        return false;
      }

      position = segment.length;
      continue;
    }

    if (segment === '') {
      // Trailing wildcard: anything left over matches, unless `$` demands the end.
      if (index === segments.length - 1) {
        return !anchored;
      }

      continue;
    }

    const found = path.indexOf(segment, position);

    if (found === -1) {
      return false;
    }

    position = found + segment.length;
  }

  return anchored ? position === path.length : true;
}

/** Picks the group for this user agent: a named match first, then `*`. */
function selectGroup(
  groups: RobotsGroup[],
  userAgent: string,
): RobotsGroup | null {
  const normalized = userAgent.toLowerCase();

  const named = groups.find((group) =>
    group.agents.some((agent) => agent !== '*' && normalized.includes(agent)),
  );

  return named ?? groups.find((group) => group.agents.includes('*')) ?? null;
}

/**
 * Decides whether a path may be requested.
 *
 * The most specific matching rule wins; `Allow` wins a tie. A user agent with no
 * matching group, and a group with no matching rule, are both allowed.
 *
 * @param pathWithQuery - Path including the query string, e.g. `/bbs/list.do?key=1`
 */
export function isPathAllowed(
  groups: RobotsGroup[],
  userAgent: string,
  pathWithQuery: string,
): { allowed: true } | { allowed: false; rule: string } {
  const group = selectGroup(groups, userAgent);

  if (!group) {
    return { allowed: true };
  }

  let best: RobotsRule | null = null;

  for (const rule of group.rules) {
    if (!matchesPattern(rule.path, pathWithQuery)) {
      continue;
    }

    if (
      !best ||
      rule.path.length > best.path.length ||
      (rule.path.length === best.path.length && rule.allow)
    ) {
      best = rule;
    }
  }

  if (!best || best.allow) {
    return { allowed: true };
  }

  return { allowed: false, rule: `Disallow: ${best.path}` };
}

function resolveRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input;
  }

  return input instanceof URL ? input.href : input.url;
}

/** Reads the User-Agent from an outgoing request, whatever shape the headers take. */
function resolveUserAgent(
  input: RequestInfo | URL,
  init?: RequestInit,
): string {
  const headers =
    init?.headers ?? (input instanceof Request ? input.headers : undefined);

  if (!headers) {
    return '*';
  }

  if (headers instanceof Headers) {
    return headers.get('user-agent') ?? '*';
  }

  if (Array.isArray(headers)) {
    const found = headers.find(([key]) => key.toLowerCase() === 'user-agent');
    return found?.[1] ?? '*';
  }

  const entry = Object.entries(headers).find(
    ([key]) => key.toLowerCase() === 'user-agent',
  );

  return entry?.[1] ?? '*';
}

export type RobotsVerdict =
  { allowed: true } | { allowed: false; rule: string };

export type RobotsGate = {
  /** Whether this URL may be requested, per its origin's robots.txt. */
  isAllowed: (url: string, userAgent?: string) => Promise<RobotsVerdict>;
  /** Fetch that answers disallowed requests locally instead of sending them. */
  fetch: typeof fetch;
};

/**
 * Builds a robots.txt gate: a verdict function and a fetch that enforces it,
 * sharing one per-origin cache.
 *
 * robots.txt is fetched once per origin and the in-flight promise is shared, so
 * concurrent requests to the same site cause a single lookup. The lookup itself
 * bypasses the check.
 *
 * **Fails open.** A missing (4xx), unreachable, or unparseable robots.txt allows
 * the request. A transient outage should not silently empty the newsletter, and
 * 404 already means "no restrictions" under the standard. Blocked requests are
 * reported through `onBlocked` rather than logged here.
 */
export function createRobotsGate(
  baseFetch: typeof fetch = fetch,
  options: RobotsAwareFetchOptions = {},
): RobotsGate {
  const { onBlocked, timeoutMs = 10_000, exemptOrigins = [] } = options;
  const cache = new Map<string, Promise<RobotsGroup[]>>();

  const exempt = new Set(
    exemptOrigins.map((origin) => {
      try {
        return new URL(origin).origin;
      } catch {
        return origin;
      }
    }),
  );

  const loadRobots = (origin: string): Promise<RobotsGroup[]> => {
    const cached = cache.get(origin);

    if (cached) {
      return cached;
    }

    const pending = (async (): Promise<RobotsGroup[]> => {
      try {
        const response = await baseFetch(`${origin}/robots.txt`, {
          redirect: 'follow',
          signal: AbortSignal.timeout(timeoutMs),
        });

        if (!response.ok) {
          return [];
        }

        const body = await response.text();

        // Some sites answer robots.txt with their HTML 404 page.
        return body.trimStart().startsWith('<') ? [] : parseRobotsTxt(body);
      } catch {
        return [];
      }
    })();

    cache.set(origin, pending);
    return pending;
  };

  const isAllowed = async (
    requestUrl: string,
    userAgent = '*',
  ): Promise<RobotsVerdict> => {
    let url: URL;

    try {
      url = new URL(requestUrl);
    } catch {
      return { allowed: true };
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { allowed: true };
    }

    if (url.pathname === '/robots.txt') {
      return { allowed: true };
    }

    if (exempt.has(url.origin)) {
      return { allowed: true };
    }

    const groups = await loadRobots(url.origin);

    return isPathAllowed(groups, userAgent, url.pathname + url.search);
  };

  const gatedFetch: typeof fetch = async (input, init) => {
    const requestUrl = resolveRequestUrl(input);
    const userAgent = resolveUserAgent(input, init);
    const verdict = await isAllowed(requestUrl, userAgent);

    if (verdict.allowed) {
      return baseFetch(input, init);
    }

    onBlocked?.({ url: requestUrl, userAgent, rule: verdict.rule });

    // An empty document rather than a 4xx. A site's crawling policy is not a
    // fault on our side, but core cannot tell the difference: it turns any
    // non-2xx list response into a thrown error and logs
    // `crawl.list.fetch.failed` at error level, which applications forward to
    // their alerting. Fourteen targets are disallowed at all times, so every
    // run raised fourteen alerts that no one could act on, and real fetch
    // failures were buried among them.
    //
    // Answering 200 with no content makes the target yield nothing, which is
    // what being disallowed means. The refusal is not hidden: it is still
    // reported through `onBlocked`, which the provider logs as
    // `crawl.robots.blocked`, and the health-check decides what to skip from
    // `isAllowed` rather than from this status. Every parser in this package
    // returns an empty list for this body.
    return new Response(
      `<!-- Blocked by robots.txt (${verdict.rule}) - ${new URL(requestUrl).origin}/robots.txt -->`,
      {
        status: 200,
        statusText: 'Blocked by robots.txt',
        headers: { 'content-type': 'text/html; charset=utf-8' },
      },
    );
  };

  return { isAllowed, fetch: gatedFetch };
}

/**
 * Wraps a fetch so that requests disallowed by the origin's robots.txt are
 * answered with an empty document instead of sent. See {@link createRobotsGate}.
 */
export function createRobotsAwareFetch(
  baseFetch: typeof fetch = fetch,
  options: RobotsAwareFetchOptions = {},
): typeof fetch {
  return createRobotsGate(baseFetch, options).fetch;
}
