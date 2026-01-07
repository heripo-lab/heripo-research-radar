import type { Cheerio } from 'cheerio';

import {
  DateType,
  type ParsedTargetDetail,
  type ParsedTargetListItem,
} from '@llm-newsletter-kit/core';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';

import { cleanUrl, getDate } from './utils';

const LIST_API_URL =
  'http://www.yngogo.or.kr/module/ntt/unity/selectNttListAjax.ink';
const DETAIL_API_URL =
  'http://www.yngogo.or.kr/module/ntt/unity/selectNttDetailAjax.ink';
const BASE_URL = 'http://www.yngogo.or.kr';

// User-Agent list used by real browsers
const USER_AGENTS = [
  // Windows - Chrome, Edge, Firefox
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',

  // macOS - Chrome, Safari, Firefox
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:126.0) Gecko/20100101 Firefox/126.0',

  // Linux - Chrome, Firefox
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:126.0) Gecko/20100101 Firefox/126.0',

  // Additional common combinations
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
];

// Pick a random User-Agent
const getRandomUserAgent = () =>
  USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

/**
 * Parse list page from 영남고고학회 (Yeongnam Archaeological Society)
 * Uses internal API since the table is rendered via CSR
 * @see https://www.yngogo.or.kr
 */
export const parseYngogoList = async (
  _html: string,
  menuSeq: string,
  bbsSeq: string,
  sitecntntsSeq: string,
): Promise<ParsedTargetListItem[]> => {
  // Fetch from internal API (CSR workaround)
  const response = await fetch(LIST_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': getRandomUserAgent(),
    },
    body: new URLSearchParams({
      siteSeq: '32000001030',
      bbsSeq,
      pageIndex: '1',
      menuSeq,
      pageMode: 'B',
      sitecntntsSeq,
      tabTyCode: 'dataManage',
      mngrAt: 'N',
      searchCondition: '',
      searchKeyword: '',
      nttSeq: '',
    }),
  });

  const html = await response.text();
  const $ = cheerio.load(html);
  const posts: ParsedTargetListItem[] = [];

  $('.basic-table01 tr').each((_index, element) => {
    const columns = $(element).find('td');
    if (columns.length === 0) {
      return;
    }

    const titleElement = columns.eq(1).find('a');
    const uniqId = getUniqId(titleElement);
    const detailUrl = `${BASE_URL}/subList/${menuSeq}?pmode=detail&nttSeq=${uniqId}&bbsSeq=${bbsSeq}&sitecntntsSeq=${sitecntntsSeq}`;

    const title = titleElement.text()?.trim() ?? '';

    const date = getDate(columns.eq(3).text().trim());

    posts.push({
      uniqId,
      title,
      date,
      detailUrl: cleanUrl(detailUrl),
      dateType: DateType.REGISTERED,
    });
  });

  return posts;
};

/**
 * Parse detail page from 영남고고학회 (Yeongnam Archaeological Society)
 * Uses internal API since the detail page is rendered via CSR
 */
export const parseYngogoDetail = async (
  _html: string,
  menuSeq: string,
  bbsSeq: string,
  nttSeq: string,
  sitecntntsSeq: string,
): Promise<ParsedTargetDetail> => {
  // Fetch from internal API (CSR workaround)
  const response = await fetch(DETAIL_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': getRandomUserAgent(),
    },
    body: new URLSearchParams({
      siteSeq: '32000001030',
      bbsSeq,
      nttSeq,
      pageIndex: '1',
      ordrSe: 'D',
      searchCnd: 'frstRegistPnttm',
      checkNttSeq: '',
      menuSeq,
      mngrAt: 'N',
      parntsNttSeq: '',
      secretAt: '',
      searchAt: '',
      sitecntntsSeq,
      cmntUseAt: 'N',
      atchFilePosblAt: 'Y',
      atchFilePosblCo: '3',
      listCount: '10',
      searchCondition: '1',
      searchKeyword: '',
    }),
  });

  const html = await response.text();
  const $ = cheerio.load(html);

  const content = $('.conM_txt');

  return {
    detailContent: new TurndownService().turndown(content.html() ?? ''),
    hasAttachedFile: $('#atchFile_div').length > 0,
    hasAttachedImage: content.find('img').length > 0,
  };
};

function getUniqId(element: Cheerio<any>) {
  // fnView('1005200642', 'admin', '', '',''); - extract first param
  return (element.attr('onclick') ?? '').match(/fnView\('([^']*)'/)?.[1] ?? '';
}

/**
 * Extract nttSeq from CSR page HTML
 * The URL query parameter is embedded in the page script
 */
export function extractNttSeq(html: string): string {
  // Pattern: nttSeq=1005200644 or nttSeq='1005200644'
  const match = html.match(/nttSeq[=:]['"]?(\d+)/);
  return match?.[1] ?? '';
}
