import {
  DateType,
  type ParsedTargetDetail,
  type ParsedTargetListItem,
} from '@llm-newsletter-kit/core';
import * as cheerio from 'cheerio';

import { isHeritageJobCandidate } from '~/crawling/heritage-job-filter';

const API_BASE = 'https://apis.data.go.kr/1760000/PblJobService';
const SITE_BASE = 'https://www.gojobs.go.kr';

/**
 * Public 나라일터 board URL used as this target's list page.
 *
 * Core fetches a target's `url` directly, so this stands in for the API call:
 * `createGojobsFetch` recognises it and queries `/getList` instead, which keeps
 * the service key and the date window out of the checked-in configuration.
 */
export const GOJOBS_LIST_URL = `${SITE_BASE}/apmList.do`;

/** Public posting URL, which is also what readers of the newsletter follow. */
export const buildGojobsDetailUrl = (idx: string): string =>
  `${SITE_BASE}/apmView.do?empmnsn=${idx}`;

/** `yyyy-mm-dd`, the format `Begin_de` and `End_de` expect. */
function toApiDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** `yyyymmdd` (as the API returns dates) to ISO `yyyy-mm-dd`. */
function toIsoDate(compact: string): string {
  return /^\d{8}$/.test(compact)
    ? `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`
    : '';
}

/** `resultCode` the service returns on success. */
const SUCCESS_RESULT_CODE = '00';

export type GojobsFetchOptions = {
  /** data.go.kr service key, already URL-encoded as the portal supplies it. */
  apiKey: string;
  /**
   * How many days back to request.
   *
   * The board turns over slowly — about 2.6 heritage-related postings a day —
   * and the run is daily, so a week covers several missed runs while keeping
   * the first run small. It also limits how many already-closed postings come
   * in, since those cost a scoring call only to be dropped as expired.
   * @default 7
   */
  windowDays?: number;
  /**
   * Rows per request.
   *
   * The service honours large pages: a month of postings, around 2,600, arrives
   * in a single 3-second response, so one request covers the window. Paging it
   * out at 100 rows took 13 sequential requests and overran the 30 seconds the
   * health-check allows a fetch.
   * @default 3000
   */
  rowsPerPage?: number; /** Reports why a list request failed; core only sees the 502. */
  onError?: (reason: string) => void;
};

/**
 * Serves the 나라일터 target from the 인사혁신처 open API.
 *
 * The board carries every public-sector vacancy in the country, and its
 * documented `Kwrd` search parameter is ignored by the service, so the whole
 * date window is requested and narrowed in `parseGojobsList`. `Begin_de` and
 * `End_de` do work and keep that window bounded.
 *
 * Detail requests to the public posting URL are answered from `/getItem`, which
 * returns the announcement body directly — no HTML page is fetched.
 */
export const createGojobsFetch = (
  baseFetch: typeof fetch = fetch,
  options: GojobsFetchOptions,
): typeof fetch => {
  const { apiKey, windowDays = 7, rowsPerPage = 3000, onError } = options;

  return async (input, init) => {
    const requestUrl =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;

    let url: URL;

    try {
      url = new URL(requestUrl);
    } catch {
      return baseFetch(input, init);
    }

    if (url.origin !== SITE_BASE) {
      return baseFetch(input, init);
    }

    if (!apiKey) {
      // Without a key the board is simply not collected: answer with an empty
      // payload so the parsers yield nothing and no request is made.
      return new Response('<response><body><items/></body></response>', {
        status: 200,
        headers: { 'content-type': 'application/xml' },
      });
    }

    if (url.pathname === '/apmList.do') {
      const end = new Date();
      const begin = new Date(end.getTime() - windowDays * 24 * 60 * 60 * 1000);

      const response = await baseFetch(
        `${API_BASE}/getList?serviceKey=${apiKey}&numOfRows=${rowsPerPage}` +
          `&pageNo=1&Begin_de=${toApiDate(begin)}&End_de=${toApiDate(end)}`,
        init,
      );

      if (!response.ok) {
        return response;
      }

      // data.go.kr answers its own errors with HTTP 200 and a result code, so a
      // rejected key or a service outage arrives looking like a successful
      // response with no postings in it. Passing that through made the board
      // report zero vacancies and the run look healthy, which is how two days
      // of an empty 나라일터 went unnoticed. Fail instead, the same way the
      // 나라장터 adapter does.
      const xml = await response.text();
      const resultCode = /<resultCode>\s*([^<]*)<\/resultCode>/.exec(xml)?.[1];

      if (
        resultCode !== undefined &&
        resultCode.trim() !== SUCCESS_RESULT_CODE
      ) {
        const reason = `나라일터 list returned resultCode ${resultCode.trim()}`;

        onError?.(reason);

        return new Response(reason, { status: 502, statusText: 'Bad Gateway' });
      }

      return new Response(xml, {
        status: 200,
        headers: { 'content-type': 'application/xml' },
      });
    }

    if (url.pathname === '/apmView.do') {
      const idx = url.searchParams.get('empmnsn');

      if (idx) {
        return baseFetch(
          `${API_BASE}/getItem?serviceKey=${apiKey}&idx=${idx}`,
          init,
        );
      }
    }

    return baseFetch(input, init);
  };
};

function textOf(
  $: cheerio.CheerioAPI,
  item: Parameters<cheerio.CheerioAPI>[0],
  tag: string,
): string {
  return $(item).find(tag).first().text().trim();
}

/**
 * Parses `/getList` responses, keeping only heritage-related postings.
 *
 * Several concatenated pages may arrive in one body; Cheerio's XML mode reads
 * them as a single document, which is what the fetch above relies on.
 */
export const parseGojobsList = (xml: string): ParsedTargetListItem[] => {
  const $ = cheerio.load(xml, { xml: true });
  const posts: ParsedTargetListItem[] = [];
  const seen = new Set<string>();

  $('item').each((_, element) => {
    const idx = textOf($, element, 'idx');
    const title = textOf($, element, 'title');
    const institution = textOf($, element, 'insttname');

    if (!idx || !title || seen.has(idx)) {
      return;
    }

    if (!isHeritageJobCandidate({ institution, title })) {
      return;
    }

    seen.add(idx);

    posts.push({
      uniqId: idx,
      title,
      date: toIsoDate(textOf($, element, 'regdate')),
      detailUrl: buildGojobsDetailUrl(idx),
      dateType: DateType.REGISTERED,
    });
  });

  return posts;
};

/** Parses a `/getItem` response into the article body. */
export const parseGojobsDetail = (xml: string): ParsedTargetDetail => {
  const $ = cheerio.load(xml, { xml: true });
  const item = $('item').first();
  const field = (tag: string) => item.find(tag).first().text().trim();

  const lines = [
    ['기관', field('insttname')],
    ['지역', field('areaname')],
    ['공고일', toIsoDate(field('regdate'))],
    ['마감일', toIsoDate(field('enddate'))],
  ]
    .filter(([, value]) => value)
    .map(([label, value]) => `- **${label}**: ${value}`);

  const contents = field('contents');

  return {
    detailContent: [`## ${field('title')}`, '', ...lines, '', contents]
      .join('\n')
      .trim(),
    hasAttachedFile: true,
    hasAttachedImage: false,
  };
};
