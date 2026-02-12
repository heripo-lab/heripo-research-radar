import { DateType, type ParsedTargetListItem } from '@llm-newsletter-kit/core';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';

import { cleanUrl, getDate } from './utils';

export const parseKhsList = (html: string): ParsedTargetListItem[] => {
  const $ = cheerio.load(html);
  const posts: ParsedTargetListItem[] = [];
  const baseUrl = 'https://www.khs.go.kr';

  $('table.list_t01 tbody tr').each((index, element) => {
    const columns = $(element).find('td');
    if (columns.length === 0) {
      return;
    }

    const titleElement = columns.eq(1).find('a');
    const relativeHref = titleElement.attr('href');

    if (!relativeHref) {
      return;
    }

    const fullUrl = new URL(relativeHref, baseUrl);
    const detailUrl = fullUrl.href;
    const uniqId = fullUrl.searchParams.get('id') ?? undefined;

    const title =
      titleElement.attr('title')?.trim() ?? titleElement.text()?.trim() ?? '';
    const date = getDate(columns.eq(3).text().trim());
    const endDate = getDate(columns.eq(4).text().trim());
    const hasEndDate = new Date(endDate) > new Date();

    posts.push({
      uniqId,
      title,
      date: hasEndDate ? `${date} ~ ${endDate}` : date,
      detailUrl: cleanUrl(detailUrl),
      dateType: hasEndDate ? DateType.DURATION : DateType.REGISTERED,
    });
  });

  return posts;
};

export const parseKhsGalleryList = (html: string): ParsedTargetListItem[] => {
  const $ = cheerio.load(html);
  const posts: ParsedTargetListItem[] = [];
  const baseUrl = 'https://www.khs.go.kr';

  $('ul.photo_board li a').each((index, element) => {
    const relativeHref = $(element).attr('href');

    if (!relativeHref) {
      return;
    }

    const fullUrl = new URL(relativeHref, baseUrl);
    const detailUrl = fullUrl.href;
    const uniqId = fullUrl.searchParams.get('nttId') ?? undefined;

    const children = $(element).find('div');

    const imgElement = children.eq(0).find('img');
    const titleElement = children.eq(1).find('strong');
    const dateElement = children.eq(2).find('span');

    const title = imgElement.attr('alt') || titleElement.text() || '';
    const date = getDate(dateElement.text().trim());

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

  $('table.b_list tbody tr').each((index, element) => {
    const columns = $(element).find('td');
    if (columns.length === 0) {
      return;
    }

    const titleElement = columns.eq(1).find('a');
    const relativeHref = titleElement.attr('href');

    if (!relativeHref) {
      return;
    }

    const fullUrl = new URL(relativeHref, baseUrl);
    const detailUrl = fullUrl.href;
    const uniqId = fullUrl.searchParams.get('id') ?? undefined;

    const title =
      titleElement.attr('title')?.trim() ?? titleElement.text().trim() ?? '';
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

  $('table.b_list tbody tr').each((index, element) => {
    const columns = $(element).find('td');
    if (columns.length === 0) return;

    const titleElement = columns.eq(1).find('a.b_tit');
    const relativeHref = titleElement.attr('href');
    if (!relativeHref) return;

    const fullUrl = new URL(relativeHref, baseUrl);
    const detailUrl = fullUrl.href;
    const uniqId = fullUrl.searchParams.get('id') ?? undefined;

    const title = titleElement.text().trim();
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

  const content = $('div.b_content');
  const fileCount = $('dl.b_file dd ul li').length;

  return {
    detailContent: new TurndownService().turndown(content.html() ?? ''),
    hasAttachedFile: fileCount > 0,
    hasAttachedImage: content.find('img').length > 0,
  };
};
