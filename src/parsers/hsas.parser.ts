import type {
  ParsedTargetDetail,
  ParsedTargetListItem,
} from '@llm-newsletter-kit/core';

import {
  HSAS_SITE_BASE_URL,
  parseSocietyBoardDetail,
  parseSocietyBoardList,
  parseSocietyBoardListFromApi,
} from './society-board.parser';

/**
 * 개편된 호서고고학회 사이트는 한국고고학회와 같은 템플릿을 쓴다.
 * 목록·상세 모두 `/api/boards` JSON으로 렌더링되므로 공용 파서에 base URL만
 * 묶어 쓴다. 상세 URL은 `createSocietyBoardFetch`가 API로 돌려준다.
 */
export { HSAS_SITE_BASE_URL };

export const parseHsasList = (html: string): ParsedTargetListItem[] =>
  parseSocietyBoardList(html, HSAS_SITE_BASE_URL);

export const parseHsasListFromApi = (
  html: string,
  boardSlug: string,
  customFetch?: typeof fetch,
): Promise<ParsedTargetListItem[]> =>
  parseSocietyBoardListFromApi(
    html,
    boardSlug,
    HSAS_SITE_BASE_URL,
    customFetch,
  );

export const parseHsasDetail = (html: string): ParsedTargetDetail =>
  parseSocietyBoardDetail(html);
