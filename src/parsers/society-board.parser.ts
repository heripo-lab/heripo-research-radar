import {
  DateType,
  type ParsedTargetDetail,
  type ParsedTargetListItem,
} from '@llm-newsletter-kit/core';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';

import { cleanUrl, getDate } from './utils';

/**
 * 한국고고학회와 호서고고학회는 같은 업체가 만든 같은 템플릿을 쓴다.
 * 게시판 목록과 상세가 모두 `/api/boards` JSON으로 렌더링되고 응답 모양이
 * 동일하므로, 사이트별 파서는 여기에 base URL만 묶어 둔다.
 */
export const KRAS_SITE_BASE_URL = 'https://www.kras.or.kr';
export const HSAS_SITE_BASE_URL = 'https://www.hsas.or.kr';

/** 상세 요청을 API로 돌려줄 사이트 목록. */
const SOCIETY_BOARD_SITE_BASE_URLS = [
  KRAS_SITE_BASE_URL,
  HSAS_SITE_BASE_URL,
] as const;

type SocietyBoardApiPost = {
  id: string | number;
  board_slug: string;
  title?: string | null;
  publish_date?: string | null;
  created_at?: string | null;
  body?: string | null;
  attachments?: unknown[] | null;
  is_secret?: number | string | boolean | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isSocietyBoardApiPost = (value: unknown): value is SocietyBoardApiPost =>
  isRecord(value) &&
  (typeof value.id === 'string' || typeof value.id === 'number') &&
  typeof value.board_slug === 'string';

/**
 * 회원이 쓴 비밀글은 목록에는 `is_secret: 1`과 가려진 제목(`🔒 비밀글입니다.`)
 * 으로 나오지만, 상세 API는 401과 `비밀글입니다. 작성자 본인만 열람할 수
 * 있습니다.`를 돌려준다. 게시판의 `allow_secret`은 이를 막지 못한다 —
 * `alert` 게시판은 `allow_secret: 0`인데도 비밀글이 올라와 있다.
 *
 * 코어는 4xx를 재시도 불가 오류로 보고 `crawl.detail.fetch.failed`를 error로
 * 남기므로, 상세를 요청하기 전에 목록에서 걸러 파서 장애처럼 보이지 않게 한다.
 * 비밀글이 나중에 공개되면 저장된 적이 없으므로 그날 정상적으로 수집된다.
 */
const isSecretPost = (post: SocietyBoardApiPost): boolean => {
  const value = post.is_secret;

  if (value == null) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;

  const normalized = value.trim().toLowerCase();
  return normalized !== '' && normalized !== '0' && normalized !== 'false';
};

const parseJson = (html: string): unknown => {
  try {
    return JSON.parse(html);
  } catch {
    return undefined;
  }
};

const getPostDate = (post: SocietyBoardApiPost) =>
  getDate((post.publish_date ?? post.created_at ?? '').slice(0, 10));

const toListItem = (
  post: SocietyBoardApiPost,
  siteBaseUrl: string,
): ParsedTargetListItem => {
  const detailUrl = new URL(
    `/sub/${encodeURIComponent(post.board_slug)}/detail?id=${encodeURIComponent(String(post.id))}`,
    siteBaseUrl,
  );

  return {
    uniqId: String(post.id),
    title: post.title?.trim() ?? '',
    date: getPostDate(post),
    detailUrl: cleanUrl(detailUrl.href),
    dateType: DateType.REGISTERED,
  };
};

const parseApiList = (
  html: string,
  siteBaseUrl: string,
): ParsedTargetListItem[] | undefined => {
  const data = parseJson(html);

  if (!isRecord(data) || !Array.isArray(data.items)) {
    return undefined;
  }

  return data.items
    .filter(isSocietyBoardApiPost)
    .filter((post) => !isSecretPost(post))
    .map((post) => toListItem(post, siteBaseUrl));
};

const parseApiDetail = (html: string): ParsedTargetDetail | undefined => {
  const data = parseJson(html);

  if (!isRecord(data) || !isSocietyBoardApiPost(data.item)) {
    return undefined;
  }

  const item = data.item;
  const content = cheerio.load(item.body ?? '')('body');
  content.find('div.snsbox').remove();

  return {
    detailContent: new TurndownService().turndown(content.html() ?? ''),
    hasAttachedFile: (item.attachments?.length ?? 0) > 0,
    hasAttachedImage: content.find('img').length > 0,
  };
};

/**
 * 이 템플릿을 쓰는 사이트는 게시글 상세 내용을 API로 렌더링한다.
 * 기사 출처에는 공개 상세 URL을 유지하고, 크롤러가 해당 URL을 요청하면
 * 같은 사이트의 상세 API 응답을 가져오도록 처리한다.
 */
export const createSocietyBoardFetch =
  (
    baseFetch: typeof fetch = fetch,
    siteBaseUrls: readonly string[] = SOCIETY_BOARD_SITE_BASE_URLS,
  ): typeof fetch =>
  async (input, init) => {
    const requestUrl =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const origins = new Set(
      siteBaseUrls.map((siteBaseUrl) => new URL(siteBaseUrl).origin),
    );
    const url = new URL(requestUrl, siteBaseUrls[0]);
    const isBoardDetailUrl =
      origins.has(url.origin) &&
      /^\/sub\/[^/]+\/detail$/.test(url.pathname) &&
      url.searchParams.has('id');

    if (isBoardDetailUrl) {
      const id = encodeURIComponent(url.searchParams.get('id') ?? '');
      // 상대 경로로 들어왔을 수도 있으므로 요청이 향하던 사이트로 보낸다.
      return baseFetch(`${url.origin}/api/boards/detail/${id}`, init);
    }

    return baseFetch(input, init);
  };

export const parseSocietyBoardList = (
  html: string,
  siteBaseUrl: string,
): ParsedTargetListItem[] => {
  const apiPosts = parseApiList(html, siteBaseUrl);
  if (apiPosts) {
    return apiPosts;
  }

  const $ = cheerio.load(html);
  const posts: ParsedTargetListItem[] = [];

  $('.post-item').each((index, element) => {
    const title = $(element).find('.col-title').text().trim();
    const date = $(element).find('.col-date').text().trim();
    const onclick = $(element).attr('onclick') ?? '';
    const relativeHref = onclick.match(
      /location\.href\s*=\s*["']([^"']+)["']/,
    )?.[1];

    if (!relativeHref) {
      return;
    }

    const fullUrl = new URL(relativeHref, siteBaseUrl);

    posts.push({
      uniqId: fullUrl.searchParams.get('id') ?? undefined,
      title,
      date: getDate(date),
      detailUrl: cleanUrl(fullUrl.href),
      dateType: DateType.REGISTERED,
    });
  });

  return posts;
};

/**
 * 목록이 클라이언트에서 렌더링되는 게시판을 API로 파싱한다.
 */
export const parseSocietyBoardListFromApi = async (
  _html: string,
  boardSlug: string,
  siteBaseUrl: string,
  customFetch?: typeof fetch,
): Promise<ParsedTargetListItem[]> => {
  const response = await (customFetch ?? fetch)(
    `${siteBaseUrl}/api/boards?board=${encodeURIComponent(boardSlug)}&page=1&limit=50`,
    {
      headers: {
        Accept: 'application/json',
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `Society board list API returned HTTP ${response.status}: ${siteBaseUrl}/${boardSlug}`,
    );
  }

  return parseSocietyBoardList(await response.text(), siteBaseUrl);
};

export const parseSocietyBoardDetail = (html: string): ParsedTargetDetail => {
  const apiDetail = parseApiDetail(html);
  if (apiDetail) {
    return apiDetail;
  }

  const $ = cheerio.load(html);

  const content = $('.detail-body').first();
  content.find('div.snsbox').remove();

  return {
    detailContent: new TurndownService().turndown(content.html() ?? ''),
    hasAttachedFile: $('.detail-attachments .attachment-item').length > 0,
    hasAttachedImage: content.find('img').length > 0,
  };
};
