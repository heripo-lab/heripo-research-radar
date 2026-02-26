import { DateType, type ParsedTargetListItem } from '@llm-newsletter-kit/core';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';

import { cleanUrl, getDate } from './utils';

export const parseKhsList = (html: string): ParsedTargetListItem[] => {
  const $ = cheerio.load(html);
  const posts: ParsedTargetListItem[] = [];
  const baseUrl = 'https://www.khs.go.kr';

  $('table.tbl tbody tr').each((index, element) => {
    const columns = $(element).find('td');
    if (columns.length === 0) {
      return;
    }

    const titleElement = columns.eq(1).find('a.b_tit');
    const relativeHref = titleElement.attr('href');

    if (!relativeHref) {
      return;
    }

    const fullUrl = new URL(relativeHref, baseUrl);
    const detailUrl = fullUrl.href;
    const uniqId = fullUrl.searchParams.get('id') ?? undefined;

    const title =
      titleElement.find('span').first().text()?.trim() ??
      titleElement.text()?.trim() ??
      '';
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

export const parseKhsGalleryList = (html: string): ParsedTargetListItem[] => {
  const $ = cheerio.load(html);
  const posts: ParsedTargetListItem[] = [];
  const baseUrl = 'https://www.khs.go.kr';

  $('ul.board-list > li').each((index, element) => {
    const linkElement = $(element).find('a').first();
    const relativeHref = linkElement.attr('href');

    if (!relativeHref) {
      return;
    }

    const fullUrl = new URL(relativeHref, baseUrl);
    const detailUrl = fullUrl.href;
    const uniqId = fullUrl.searchParams.get('nttId') ?? undefined;

    const imgElement = $(element).find('img');
    const titleElement = $(element).find('strong');
    const dateElement = $(element).find('dl dd');

    const title =
      imgElement.attr('alt')?.replace(/\s*이미지$/, '') ||
      titleElement.text()?.trim() ||
      '';
    const date = getDate(dateElement.first().text().trim());

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

export const parseKhsLawList = (html: string): ParsedTargetListItem[] => {
  const $ = cheerio.load(html);
  const posts: ParsedTargetListItem[] = [];
  const baseUrl = 'https://www.khs.go.kr';

  $('table.tbl tbody tr').each((index, element) => {
    const columns = $(element).find('td');
    if (columns.length === 0) {
      return;
    }

    const titleElement = columns.eq(1).find('a.b_tit');
    const relativeHref = titleElement.attr('href');

    if (!relativeHref) {
      return;
    }

    const fullUrl = new URL(relativeHref, baseUrl);
    const detailUrl = fullUrl.href;
    const uniqId = fullUrl.searchParams.get('id') ?? undefined;

    const title =
      titleElement.find('span').first().text()?.trim() ??
      titleElement.text().trim() ??
      '';
    const date = getDate(columns.eq(4).text().trim());
    const hasEndDate = date.includes('~');

    posts.push({
      uniqId,
      title,
      date,
      detailUrl: cleanUrl(detailUrl),
      dateType: hasEndDate ? DateType.DURATION : DateType.REGISTERED,
    });
  });

  return posts;
};

export const parseKhsTenderList = (html: string): ParsedTargetListItem[] => {
  const $ = cheerio.load(html);
  const posts: ParsedTargetListItem[] = [];
  const baseUrl = 'https://www.khs.go.kr';

  $('table.tbl tbody tr').each((index, element) => {
    const columns = $(element).find('td');
    if (columns.length === 0) return;

    const titleElement = columns.eq(1).find('a.b_tit');
    const relativeHref = titleElement.attr('href');
    if (!relativeHref) return;

    const fullUrl = new URL(relativeHref, baseUrl);
    const detailUrl = fullUrl.href;
    const uniqId = fullUrl.searchParams.get('id') ?? undefined;

    const title =
      titleElement.find('span').first().text()?.trim() ||
      titleElement.text().trim();
    const date = getDate(columns.eq(4).text().trim());

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

export const parseKhsDetail = async (html: string) => {
  const $ = cheerio.load(html);

  const content = $('div.board-view-content');
  const fileCount = $('.file-container ul.box-group-area li').length;

  return {
    detailContent: new TurndownService().turndown(content.html() ?? ''),
    hasAttachedFile: fileCount > 0,
    hasAttachedImage: content.find('img').length > 0,
  };
};
