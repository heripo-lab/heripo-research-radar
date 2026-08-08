import {
  DateType,
  type ParsedTargetDetail,
  type ParsedTargetListItem,
} from '@llm-newsletter-kit/core';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';

import { cleanUrl, getDate } from './utils';

/**
 * 현재는 임시 테스트 도메인(https://kras-home.llaputa.net)을 사용한다.
 * 리뉴얼 사이트가 공식 오픈하면 기존 공식 도메인(https://www.kras.or.kr)으로
 * 이 값만 변경한다.
 * 크롤링 타겟과 API 요청 어댑터가 이 값을 함께 사용한다.
 */
export const KRAS_SITE_BASE_URL = 'https://kras-home.llaputa.net';

type KrasApiPost = {
  id: string | number;
  board_slug: string;
  title?: string | null;
  publish_date?: string | null;
  created_at?: string | null;
  body?: string | null;
  attachments?: unknown[] | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isKrasApiPost = (value: unknown): value is KrasApiPost =>
  isRecord(value) &&
  (typeof value.id === 'string' || typeof value.id === 'number') &&
  typeof value.board_slug === 'string';

const parseJson = (html: string): unknown => {
  try {
    return JSON.parse(html);
  } catch {
    return undefined;
  }
};

const getKrasPostDate = (post: KrasApiPost) =>
  getDate((post.publish_date ?? post.created_at ?? '').slice(0, 10));

const toKrasListItem = (post: KrasApiPost): ParsedTargetListItem => {
  const detailUrl = new URL(
    `/sub/${encodeURIComponent(post.board_slug)}/detail?id=${encodeURIComponent(String(post.id))}`,
    KRAS_SITE_BASE_URL,
  );

  return {
    uniqId: String(post.id),
    title: post.title?.trim() ?? '',
    date: getKrasPostDate(post),
    detailUrl: cleanUrl(detailUrl.href),
    dateType: DateType.REGISTERED,
  };
};

const parseKrasApiList = (html: string): ParsedTargetListItem[] | undefined => {
  const data = parseJson(html);

  if (!isRecord(data) || !Array.isArray(data.items)) {
    return undefined;
  }

  return data.items.filter(isKrasApiPost).map(toKrasListItem);
};

const parseKrasApiDetail = (html: string): ParsedTargetDetail | undefined => {
  const data = parseJson(html);

  if (!isRecord(data) || !isKrasApiPost(data.item)) {
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
 * 새 사이트는 게시글 상세 내용을 API로 렌더링한다.
 * 기사 출처에는 공개 상세 URL을 유지하고, 크롤러가 해당 URL을 요청하면
 * 상세 API 응답을 가져오도록 처리한다.
 */
export const createKrasFetch =
  (baseFetch: typeof fetch = fetch): typeof fetch =>
  async (input, init) => {
    const requestUrl =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const url = new URL(requestUrl, KRAS_SITE_BASE_URL);
    const isKrasDetailUrl =
      url.origin === new URL(KRAS_SITE_BASE_URL).origin &&
      /^\/sub\/[^/]+\/detail$/.test(url.pathname) &&
      url.searchParams.has('id');

    if (isKrasDetailUrl) {
      const id = encodeURIComponent(url.searchParams.get('id') ?? '');
      return baseFetch(`${KRAS_SITE_BASE_URL}/api/boards/detail/${id}`, init);
    }

    return baseFetch(input, init);
  };

export const parseKrasList = (html: string): ParsedTargetListItem[] => {
  const $ = cheerio.load(html);
  const posts: ParsedTargetListItem[] = [];

  const apiPosts = parseKrasApiList(html);
  if (apiPosts) {
    return apiPosts;
  }

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

    const fullUrl = new URL(relativeHref, KRAS_SITE_BASE_URL);

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
 * KRAS API를 통해 목록이 클라이언트에서 렌더링되는 게시판을 파싱한다.
 */
export const parseKrasListFromApi = async (
  _html: string,
  boardSlug: string,
  customFetch?: typeof fetch,
): Promise<ParsedTargetListItem[]> => {
  const response = await (customFetch ?? fetch)(
    `${KRAS_SITE_BASE_URL}/api/boards?board=${encodeURIComponent(boardSlug)}&page=1&limit=50`,
    {
      headers: {
        Accept: 'application/json',
      },
    },
  );

  if (!response.ok) {
    throw new Error(`KRAS list API returned HTTP ${response.status}`);
  }

  return parseKrasList(await response.text());
};

export const parseKrasDetail = (html: string): ParsedTargetDetail => {
  const apiDetail = parseKrasApiDetail(html);
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
