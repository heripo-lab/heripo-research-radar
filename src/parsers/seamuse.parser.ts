import {
  DateType,
  type ParsedTargetDetail,
  type ParsedTargetListItem,
} from '@llm-newsletter-kit/core';
import TurndownService from 'turndown';

const BASE_URL = 'https://www.seamuse.go.kr';

interface SeamuseListItem {
  nttId: number;
  nttSj: string;
  frstRegisterPnttm: string;
  atchFileId: string;
}

interface SeamuseListResponse {
  resultList: SeamuseListItem[];
}

interface SeamuseDetailResult {
  nttCn: string;
  nttSj: string;
  atchFileId: string;
}

interface SeamuseDetailResponse {
  result: SeamuseDetailResult;
  files: unknown[];
}

/**
 * Extracts the nttId from seamuse.go.kr detail page HTML.
 * The page contains a JS init call like: noticeFunc.infoInit(4394)
 * or og:url meta tag: https://www.seamuse.go.kr/news/notice/info/4394
 */
export const extractNttId = (html: string): string => {
  // Try og:url meta tag first
  const ogUrlMatch = html.match(
    /property="og:url"\s+content="[^"]*\/info\/(\d+)"/,
  );
  if (ogUrlMatch) {
    return ogUrlMatch[1];
  }

  // Fallback: JS init call pattern like infoInit(4394)
  const initMatch = html.match(/\.infoInit\((\d+)\)/);
  if (initMatch) {
    return initMatch[1];
  }

  return '';
};

/**
 * Parses the list page from seamuse.go.kr (국립해양유산연구소).
 * The site uses client-side rendering — list data is fetched from a JSON API.
 * URL pattern: /news/notice/list/1 → API: POST /news/notice/listData/1
 *
 * @param listDataPath - API path segment (e.g., "/news/notice" or "/resources/academiccultural")
 * @param infoPathPrefix - Detail page path prefix (e.g., "/news/notice/info")
 */
export const parseSeamuseList = async (
  _html: string,
  listDataPath: string,
  infoPathPrefix: string,
  customFetch?: typeof fetch,
): Promise<ParsedTargetListItem[]> => {
  const response = await (customFetch ?? fetch)(
    `${BASE_URL}${listDataPath}/listData/1`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: '',
    },
  );

  const data: SeamuseListResponse = await response.json();
  const posts: ParsedTargetListItem[] = [];

  for (const item of data.resultList) {
    posts.push({
      uniqId: String(item.nttId),
      title: item.nttSj?.trim() ?? '',
      date: item.frstRegisterPnttm ?? '',
      detailUrl: `${BASE_URL}${infoPathPrefix}/${item.nttId}`,
      dateType: DateType.REGISTERED,
    });
  }

  return posts;
};

/**
 * Parses the detail page from seamuse.go.kr.
 * The site uses client-side rendering — detail data is fetched from a JSON API.
 * URL pattern: /news/notice/info/4394 → API: GET /news/notice/infoData/4394?nttId=4394
 *
 * @param infoDataPath - API path segment (e.g., "/news/notice")
 */
export const parseSeamuseDetail = async (
  html: string,
  infoDataPath: string,
  customFetch?: typeof fetch,
): Promise<ParsedTargetDetail> => {
  const nttId = extractNttId(html);

  if (!nttId) {
    return {
      detailContent: '',
      hasAttachedFile: false,
      hasAttachedImage: false,
    };
  }

  const response = await (customFetch ?? fetch)(
    `${BASE_URL}${infoDataPath}/infoData/${nttId}?nttId=${nttId}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );

  const data: SeamuseDetailResponse = await response.json();
  const content = data.result.nttCn ?? '';

  return {
    detailContent: new TurndownService().turndown(content),
    hasAttachedFile: (data.files?.length ?? 0) > 0,
    hasAttachedImage: content.includes('<img'),
  };
};
