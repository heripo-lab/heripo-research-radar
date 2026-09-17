import {
  DateType,
  type ParsedTargetDetail,
  type ParsedTargetListItem,
} from '@llm-newsletter-kit/core';

import { isHeritageBidCandidate } from '~/crawling/heritage-job-filter';

const API_BASE = 'https://apis.data.go.kr/1230000/ad/BidPublicInfoService';
const SITE_BASE = 'https://www.g2b.go.kr';

/**
 * Public 나라장터 board URL used as this target's list page.
 *
 * Core fetches a target's `url` directly, so this stands in for the API calls:
 * `createG2bFetch` recognises it and queries the 조달청 open API instead, which
 * keeps the service key and the time window out of the configuration.
 */
export const G2B_LIST_URL = `${SITE_BASE}/co/co/ococ/CoOcOc.do`;

/** Public notice URL, which is also what readers of the newsletter follow. */
export const buildG2bDetailUrl = (notice: string, order: string): string =>
  `${SITE_BASE}/link/PNPE027_01/single/?bidPbancNo=${notice}&bidPbancOrd=${order}`;

/**
 * Business categories collected.
 *
 * 나라장터 splits its operations by 업무구분 and a notice only answers on the
 * matching one. Heritage work appears as 용역 (발굴조사, 학술연구, 보존처리) and
 * 공사 (수리, 정비); 물품 and 외자 carry none, so they are not requested.
 */
const OPERATIONS = ['Servc', 'Cnstwk'] as const;

/** `YYYYMMDDHHMM`, the format `inqryBgnDt` and `inqryEndDt` expect. */
function toApiDateTime(date: Date): string {
  return date.toISOString().replace(/[-:T]/g, '').slice(0, 12);
}

/** `2026-09-15 13:42:20` to ISO `2026-09-15`. */
function toIsoDate(value: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '');
  return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
}

/** One notice as the 조달청 API returns it. Only the fields used here. */
type G2bNotice = {
  bidNtceNo?: string;
  bidNtceOrd?: string;
  bidNtceNm?: string;
  bidNtceDt?: string;
  bidClseDt?: string;
  opengDt?: string;
  ntceInsttNm?: string;
  dminsttNm?: string;
  ntceKindNm?: string;
  srvceDivNm?: string;
  presmptPrce?: string;
  asignBdgtAmt?: string;
  cntrctCnclsMthdNm?: string;
  sucsfbidMthdNm?: string;
  bidNtceDtlUrl?: string;
  ntceInsttOfclNm?: string;
  ntceInsttOfclTelNo?: string;
  pubPrcrmntLrgClsfcNm?: string;
  pubPrcrmntMidClsfcNm?: string;
  /** Added locally, not part of the API response. */
  businessDivision?: string;
};

type G2bListResponse = {
  response?: {
    header?: { resultCode?: string };
    body?: { totalCount?: number; items?: G2bNotice[] };
  };
};

export type G2bFetchOptions = {
  /** data.go.kr service key, already URL-encoded as the portal supplies it. */
  apiKey: string;
  /**
   * How many hours back to request.
   *
   * 나라장터 carries every public procurement notice in the country — about
   * 1,000 a day across 용역 and 공사 alone — so unlike the boards this package
   * scrapes, the window is what keeps the first run affordable. At 48 hours the
   * first run scores roughly 26 notices, the same order as a steady day once
   * duplicates are recognised, and a run that is missed once is still covered
   * by the next.
   * @default 48
   */
  windowHours?: number;
  /** Rows per request; the service caps a page at 999. @default 999 */
  rowsPerPage?: number;
  /** Pages to walk per business category. @default 4 */
  maxPages?: number;
};

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

/**
 * Serves the 나라장터 target from the 조달청 open API.
 *
 * The list page is answered by querying both business categories and merging
 * them. Detail requests are answered from that same response — the list carries
 * every field the article body needs, so no second round trip is made and the
 * daily quota of 1,000 calls is barely touched.
 */
export const createG2bFetch = (
  baseFetch: typeof fetch = fetch,
  options: G2bFetchOptions,
): typeof fetch => {
  const { apiKey, windowHours = 48, rowsPerPage = 999, maxPages = 4 } = options;

  /** Notices from the most recent list call, keyed by `<bidNtceNo>:<bidNtceOrd>`. */
  const noticeCache = new Map<string, G2bNotice>();

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

    if (url.pathname === new URL(G2B_LIST_URL).pathname) {
      if (!apiKey) {
        // Without a key the board is simply not collected: answer with an empty
        // payload so the parsers yield nothing and no request is made.
        return jsonResponse({ items: [] });
      }

      const end = new Date();
      const begin = new Date(end.getTime() - windowHours * 60 * 60 * 1000);
      const collected: G2bNotice[] = [];

      for (const operation of OPERATIONS) {
        for (let page = 1; page <= maxPages; page++) {
          const response = await baseFetch(
            `${API_BASE}/getBidPblancListInfo${operation}?serviceKey=${apiKey}` +
              `&numOfRows=${rowsPerPage}&pageNo=${page}&type=json&inqryDiv=1` +
              `&inqryBgnDt=${toApiDateTime(begin)}&inqryEndDt=${toApiDateTime(end)}`,
            init,
          );

          if (!response.ok) {
            break;
          }

          const body = (await response.json()) as G2bListResponse;
          const batch = body.response?.body?.items ?? [];

          for (const notice of batch) {
            collected.push({
              ...notice,
              businessDivision: operation === 'Servc' ? '용역' : '공사',
            });
          }

          if (batch.length < rowsPerPage) {
            break;
          }
        }
      }

      noticeCache.clear();
      for (const notice of collected) {
        noticeCache.set(`${notice.bidNtceNo}:${notice.bidNtceOrd}`, notice);
      }

      return jsonResponse({ items: collected });
    }

    if (url.pathname === '/link/PNPE027_01/single/') {
      const key = `${url.searchParams.get('bidPbancNo')}:${url.searchParams.get('bidPbancOrd')}`;
      const notice = noticeCache.get(key);

      if (notice) {
        return jsonResponse({ item: notice });
      }
    }

    return baseFetch(input, init);
  };
};

function parseJson<T>(body: string): T | null {
  try {
    return JSON.parse(body) as T;
  } catch {
    return null;
  }
}

/** Renders a notice's fields as the article body. */
function renderG2bContent(notice: G2bNotice): string {
  const won = (value: string | undefined) => {
    const amount = Number(value);
    return Number.isFinite(amount) && amount > 0
      ? `${amount.toLocaleString('ko-KR')}원`
      : '';
  };

  const lines = [
    ['업무구분', notice.businessDivision],
    ['공고종류', notice.ntceKindNm],
    ['용역구분', notice.srvceDivNm],
    ['공고기관', notice.ntceInsttNm],
    ['수요기관', notice.dminsttNm],
    [
      '분류',
      [notice.pubPrcrmntLrgClsfcNm, notice.pubPrcrmntMidClsfcNm]
        .filter(Boolean)
        .join(' > '),
    ],
    ['추정가격', won(notice.presmptPrce)],
    ['배정예산', won(notice.asignBdgtAmt)],
    ['계약방법', notice.cntrctCnclsMthdNm],
    ['낙찰방법', notice.sucsfbidMthdNm],
    ['공고일시', notice.bidNtceDt],
    ['입찰마감', notice.bidClseDt],
    ['개찰일시', notice.opengDt],
    [
      '공고번호',
      [notice.bidNtceNo, notice.bidNtceOrd].filter(Boolean).join('-'),
    ],
    [
      '담당자',
      [notice.ntceInsttOfclNm, notice.ntceInsttOfclTelNo]
        .filter(Boolean)
        .join(' '),
    ],
  ]
    .filter(([, value]) => value)
    .map(([label, value]) => `- **${label}**: ${String(value).trim()}`);

  return [`## ${notice.bidNtceNm ?? ''}`, '', ...lines].join('\n').trim();
}

/** Parses the merged list response, keeping only heritage-related notices. */
export const parseG2bList = (body: string): ParsedTargetListItem[] => {
  const parsed = parseJson<{ items?: G2bNotice[] }>(body);
  const posts: ParsedTargetListItem[] = [];
  const seen = new Set<string>();

  for (const notice of parsed?.items ?? []) {
    const title = notice.bidNtceNm?.trim();
    const number = notice.bidNtceNo;
    const order = notice.bidNtceOrd ?? '000';

    if (!title || !number) {
      continue;
    }

    const key = `${number}:${order}`;

    if (seen.has(key)) {
      continue;
    }

    const heritage = isHeritageBidCandidate({
      institution: `${notice.ntceInsttNm ?? ''} ${notice.dminsttNm ?? ''}`,
      title,
      classification: notice.pubPrcrmntMidClsfcNm,
    });

    if (!heritage) {
      continue;
    }

    seen.add(key);

    posts.push({
      uniqId: key,
      title,
      date: toIsoDate(notice.bidNtceDt),
      detailUrl: notice.bidNtceDtlUrl || buildG2bDetailUrl(number, order),
      dateType: DateType.REGISTERED,
    });
  }

  return posts;
};

/** Parses a cached notice into the article body. */
export const parseG2bDetail = (body: string): ParsedTargetDetail => {
  const parsed = parseJson<{ item?: G2bNotice }>(body);

  return {
    detailContent: parsed?.item ? renderG2bContent(parsed.item) : '',
    hasAttachedFile: true,
    hasAttachedImage: false,
  };
};
