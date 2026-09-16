import {
  DateType,
  type ParsedTargetDetail,
  type ParsedTargetListItem,
} from '@llm-newsletter-kit/core';

import { isHeritageJobCandidate } from '~/crawling/heritage-job-filter';

const API_BASE = 'https://apis.data.go.kr/1051000/recruitment';
const SITE_BASE = 'https://job.alio.go.kr';

/**
 * Public 알리오 board URL used as this target's list page.
 *
 * As with 나라일터, core fetches this URL and `createAlioFetch` answers it from
 * the 재정경제부 open API, keeping the service key out of the configuration.
 */
export const ALIO_LIST_URL = `${SITE_BASE}/recruit.do`;

/** Public posting URL. */
export const buildAlioDetailUrl = (serial: string | number): string =>
  `${SITE_BASE}/recruitview.do?idx=${serial}`;

/** `yyyymmdd` to ISO `yyyy-mm-dd`. */
function toIsoDate(compact: string): string {
  return /^\d{8}$/.test(compact)
    ? `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`
    : '';
}

/** One posting as the 재정경제부 API returns it. Only the fields used here. */
type AlioRecruitment = {
  recrutPblntSn: number;
  instNm?: string;
  ncsCdLst?: string;
  ncsCdNmLst?: string;
  hireTypeNmLst?: string;
  workRgnNmLst?: string;
  recrutSeNm?: string;
  recrutNope?: number;
  pbancBgngYmd?: string;
  pbancEndYmd?: string;
  recrutPbancTtl?: string;
  srcUrl?: string;
  aplyQlfcCn?: string;
  prefCn?: string;
  scrnprcdrMthdExpln?: string;
};

type AlioListResponse = {
  resultCode?: number;
  totalCount?: number;
  result?: AlioRecruitment[];
};

/** `/detail` returns a single object where `/list` returns an array. */
type AlioDetailResponse = {
  resultCode?: number;
  result?: AlioRecruitment;
};

export type AlioFetchOptions = {
  /** data.go.kr service key, already URL-encoded as the portal supplies it. */
  apiKey: string;
  /**
   * Rows per request.
   *
   * Every open posting on the board — 579 at the time of writing — arrives in
   * one 2-second response, so the whole board is a single request. That also
   * suits this service's daily quota of 1,000 calls, an order of magnitude
   * below 나라일터.
   * @default 3000
   */
  rowsPerPage?: number;
};

/**
 * Serves the 알리오 target from the 재정경제부 open API.
 *
 * This board only covers 공기업 and 준정부기관, so heritage postings are rare —
 * 국가유산청 and the national museums publish through 나라일터 instead. It is
 * collected anyway because a body like 국립농업박물관 does appear here, and the
 * NCS job codes make filtering cheap and precise.
 *
 * Only postings still open (`ongoingYn=Y`) are requested.
 */
export const createAlioFetch = (
  baseFetch: typeof fetch = fetch,
  options: AlioFetchOptions,
): typeof fetch => {
  const { apiKey, rowsPerPage = 3000 } = options;

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
      // Without a key the board is simply not collected. See gojobs.parser.ts.
      return Response.json({ result: [] } satisfies AlioListResponse);
    }

    if (url.pathname === '/recruit.do') {
      return baseFetch(
        `${API_BASE}/list?serviceKey=${apiKey}&resultType=json` +
          `&numOfRows=${rowsPerPage}&pageNo=1&ongoingYn=Y`,
        init,
      );
    }

    if (url.pathname === '/recruitview.do') {
      const serial = url.searchParams.get('idx');

      if (serial) {
        return baseFetch(
          `${API_BASE}/detail?serviceKey=${apiKey}&resultType=json&sn=${serial}`,
          init,
        );
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

/** Renders a posting's fields as the article body. */
function renderAlioContent(record: AlioRecruitment): string {
  const lines = [
    ['기관', record.instNm],
    ['직무분야', record.ncsCdNmLst],
    ['고용형태', record.hireTypeNmLst],
    ['채용구분', record.recrutSeNm],
    ['근무지역', record.workRgnNmLst],
    ['모집인원', record.recrutNope ? `${record.recrutNope}명` : ''],
    [
      '공고기간',
      [record.pbancBgngYmd, record.pbancEndYmd]
        .map((value) => toIsoDate(value ?? ''))
        .filter(Boolean)
        .join(' - '),
    ],
    ['원문', record.srcUrl],
  ]
    .filter(([, value]) => value)
    .map(([label, value]) => `- **${label}**: ${String(value).trim()}`);

  const sections = [
    ['지원자격', record.aplyQlfcCn],
    ['우대사항', record.prefCn],
    ['전형방법', record.scrnprcdrMthdExpln],
  ]
    .filter(([, value]) => value?.trim())
    .flatMap(([label, value]) => [
      '',
      `### ${label}`,
      '',
      String(value).trim(),
    ]);

  return [`## ${record.recrutPbancTtl ?? ''}`, '', ...lines, ...sections]
    .join('\n')
    .trim();
}

/** Parses the aggregated list response, keeping only heritage-related postings. */
export const parseAlioList = (body: string): ParsedTargetListItem[] => {
  const parsed = parseJson<AlioListResponse>(body);
  const posts: ParsedTargetListItem[] = [];

  for (const record of parsed?.result ?? []) {
    const title = record.recrutPbancTtl?.trim();

    if (!title || record.recrutPblntSn == null) {
      continue;
    }

    const heritage = isHeritageJobCandidate({
      institution: record.instNm ?? '',
      title,
      categoryCodes: (record.ncsCdLst ?? '').split(',').filter(Boolean),
    });

    if (!heritage) {
      continue;
    }

    posts.push({
      uniqId: String(record.recrutPblntSn),
      title,
      date: toIsoDate(record.pbancBgngYmd ?? ''),
      detailUrl: buildAlioDetailUrl(record.recrutPblntSn),
      dateType: DateType.REGISTERED,
    });
  }

  return posts;
};

/** Parses a `/detail` response into the article body. */
export const parseAlioDetail = (body: string): ParsedTargetDetail => {
  const parsed = parseJson<AlioDetailResponse>(body);
  const record = parsed?.result;

  return {
    detailContent: record ? renderAlioContent(record) : '',
    hasAttachedFile: true,
    hasAttachedImage: false,
  };
};
