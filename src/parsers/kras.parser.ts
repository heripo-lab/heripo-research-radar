import type {
  ParsedTargetDetail,
  ParsedTargetListItem,
} from '@llm-newsletter-kit/core';

import {
  KRAS_SITE_BASE_URL,
  parseSocietyBoardDetail,
  parseSocietyBoardList,
  parseSocietyBoardListFromApi,
} from './society-board.parser';

/**
 * 크롤링 타겟과 API 요청 어댑터가 이 값을 함께 사용한다.
 */
export { KRAS_SITE_BASE_URL };

export const parseKrasList = (html: string): ParsedTargetListItem[] =>
  parseSocietyBoardList(html, KRAS_SITE_BASE_URL);

export const parseKrasListFromApi = (
  html: string,
  boardSlug: string,
  customFetch?: typeof fetch,
): Promise<ParsedTargetListItem[]> =>
  parseSocietyBoardListFromApi(
    html,
    boardSlug,
    KRAS_SITE_BASE_URL,
    customFetch,
  );

export const parseKrasDetail = (html: string): ParsedTargetDetail =>
  parseSocietyBoardDetail(html);
