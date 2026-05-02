import {
  DateType,
  type ParsedTargetDetail,
  type ParsedTargetListItem,
} from '@llm-newsletter-kit/core';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';

import { cleanUrl, getDate } from './utils';

export const parseKaahList = (html: string): ParsedTargetListItem[] => {
  const $ = cheerio.load(html);
  const posts: ParsedTargetListItem[] = [];

  $('table.board-table-list tbody tr').each((index, element) => {
    const columns = $(element).find('td');
    if (columns.length === 0) {
      return;
    }

    const titleElement = columns.eq(1).find('a');
    const relativeHref = titleElement.attr('href');

    if (!relativeHref) {
      return;
    }

    const fullUrl = new URL(relativeHref);
    const detailUrl = fullUrl.href;
    const uniqId = fullUrl.pathname.split('/').pop() ?? undefined;

    const title = titleElement.text()?.trim() ?? '';
    const date = getDate(columns.eq(columns.length - 2).text().trim());

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

export const parseKaahPlaceList = (html: string): ParsedTargetListItem[] => {
  const $ = cheerio.load(html);
  const posts: ParsedTargetListItem[] = [];

  $('div.page-con-box div.data-list').each((index, element) => {
    const titleEl = $(element).find('div.con');
    const dateEl = $(element).find('div.title');

    const relativeHref = titleEl.find('div a').attr('href');

    if (!relativeHref) {
      return;
    }

    const fullUrl = new URL(relativeHref);
    const detailUrl = fullUrl.href;
    const uniqId = fullUrl.pathname.split('/').pop() ?? undefined;

    const title = titleEl.find('div a').text()?.trim() ?? '';
    const date = getDate(
      `${dateEl.find('div.year').text().trim()}-${dateEl.find('div.date').text().trim()}`,
    );

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

export const parseKaahDetail = (html: string): ParsedTargetDetail => {
  const $ = cheerio.load(html);

  const content = $('div.content');

  return {
    detailContent: new TurndownService().turndown(content.html() ?? ''),
    hasAttachedFile: $('div.board-view-file div.file-list').length > 0,
    hasAttachedImage: content.find('img').length > 0,
  };
};

export const parseKaahPlaceDetail = (html: string): ParsedTargetDetail => {
  const $ = cheerio.load(html);

  const content = $('div.board-view-top');

  return {
    detailContent: new TurndownService().turndown(content.html() ?? ''),
    hasAttachedFile: $('div.board-view-file div.file-list').length > 0,
    hasAttachedImage: content.find('img').length > 0,
  };
};
