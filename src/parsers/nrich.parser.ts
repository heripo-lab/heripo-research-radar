import type { Cheerio } from 'cheerio';

import {
  DateType,
  type ParsedTargetDetail,
  type ParsedTargetListItem,
} from '@llm-newsletter-kit/core';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';

import { cleanUrl, getDate } from './utils';

export const parseNrichNoticeList = (html: string): ParsedTargetListItem[] => {
  const $ = cheerio.load(html);
  const posts: ParsedTargetListItem[] = [];
  const baseUrl = 'https://www.nrich.go.kr';

  $('ul.list-body li').each((index, element) => {
    if ($(element).hasClass('bg-notice')) {
      return;
    }

    const titleElement = $(element).find('.col2 a.cont-link');
    const relativeHref = titleElement.attr('href');

    if (!relativeHref) {
      return;
    }

    const fullUrl = new URL(`/kor/${relativeHref}`, baseUrl);
    const detailUrl = fullUrl.href;
    const uniqId = fullUrl.searchParams.get('bbs_idx') ?? undefined;

    const title = titleElement.text()?.trim() ?? '';
    const date = getDate($(element).find('.col5 .cont-txt').text().trim());

    if (posts.length < 10) {
      posts.push({
        uniqId,
        title,
        date,
        detailUrl: cleanUrl(detailUrl),
        dateType: DateType.REGISTERED,
      });
    }
  });

  return posts;
};

export const parseNrichMajorEventList = (
  html: string,
): ParsedTargetListItem[] => {
  const $ = cheerio.load(html);
  const posts: ParsedTargetListItem[] = [];

  $('ul.list-body li').each((index, element) => {
    const linkElement = $(element).find('a[onclick]').first();
    const uniqId = getUniqIdFromNrichMajorEvent(linkElement);
    const detailUrl = `https://www.nrich.go.kr/kor/majorView.do?menuIdx=286&bbs_idx=${uniqId}`;

    const title = $(element).find('.info-tit strong.tit').text().trim();

    let dateText = '';
    $(element)
      .find('.info-detail .detail-box')
      .each((i, box) => {
        const boxTitle = $(box).find('span.tit').text().trim();
        if (boxTitle === '행사기간') {
          dateText = $(box).find('span.cont').text().trim();
        }
      });

    const dateSplit = getDate(dateText).split(' ~ ');
    const startDate = dateSplit[0];
    const endDate = dateSplit[1];
    const hasEndDate = startDate !== endDate;

    if (uniqId) {
      posts.push({
        uniqId,
        title,
        date: hasEndDate ? `${startDate} ~ ${endDate}` : startDate,
        detailUrl: cleanUrl(detailUrl),
        dateType: hasEndDate ? DateType.DURATION : DateType.REGISTERED,
      });
    }
  });

  return posts;
};

export const parseNrichJournalList = (html: string): ParsedTargetListItem[] => {
  const $ = cheerio.load(html);
  const posts: ParsedTargetListItem[] = [];
  const baseUrl = 'https://www.nrich.go.kr';

  $('ul.list-body li').each((index, element) => {
    const titleElement = $(element).find('.col2 a.cont-link');
    const relativeHref = titleElement.attr('href');

    if (!relativeHref) {
      return;
    }

    const fullUrl = new URL(`${relativeHref}`, baseUrl);
    const detailUrl = fullUrl.href;
    const uniqId = fullUrl.searchParams.get('idx') ?? undefined;

    const title = titleElement.text()?.trim() ?? '';
    const date = getDate($(element).find('.col3 .cont-txt').text().trim());

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

export const parseNrichPortalList = (html: string): ParsedTargetListItem[] => {
  const $ = cheerio.load(html);
  const posts: ParsedTargetListItem[] = [];
  const baseUrl = 'https://portal.nrich.go.kr';

  $('table.tbl02 tbody tr').each((index, element) => {
    const columns = $(element).find('td');
    if (columns.length === 0) {
      return;
    }

    const titleElement = columns.eq(1).find('a');
    const relativeHref = titleElement.attr('href');

    if (!relativeHref) {
      return;
    }

    const fullUrl = new URL(`/kor/${relativeHref}`, baseUrl);
    const detailUrl = fullUrl.href;
    const uniqId = fullUrl.searchParams.get('bbs_idx') ?? undefined;

    const title =
      titleElement.attr('title')?.trim() ?? titleElement.text()?.trim() ?? '';
    const date = getDate(columns.eq(2).text().trim());

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

export const parseNrichNoticeDetail = (html: string): ParsedTargetDetail => {
  const $ = cheerio.load(html);

  const content = $('.view-content .info-txt');

  return {
    detailContent: new TurndownService().turndown(content.html() ?? ''),
    hasAttachedFile: $('.board-file').length > 0,
    hasAttachedImage: content.find('img').length > 0,
  };
};

export const parseNrichMajorEventDetail = (
  html: string,
): ParsedTargetDetail => {
  const $ = cheerio.load(html);

  const content = $('.view-content');

  return {
    detailContent: new TurndownService().turndown(content.html() ?? ''),
    hasAttachedFile: false,
    hasAttachedImage: content.find('img').length > 0,
  };
};

export const parseNrichJournalDetail = (html: string): ParsedTargetDetail => {
  const $ = cheerio.load(html);
  $('script, style').remove();

  const articles: string[] = [];

  // 리스트의 각 항목을 순회하면서 논문 정보 추출
  $('ul.list-body li').each((index, element) => {
    const number = $(element).find('.col1 .cont-txt').text().trim();
    const titleElement = $(element).find('.col2 a.cont-link');
    const title = titleElement.text().trim();
    const author = $(element).find('.col3 .cont-txt').text().trim();

    if (title && author) {
      articles.push(`${number}. **${title}**\n   저자: ${author}`);
    }
  });

  const content =
    articles.length > 0 ? `## 논문 목록\n\n${articles.join('\n\n')}` : '';

  return {
    detailContent: content,
    hasAttachedFile: true,
    hasAttachedImage: false,
  };
};

export const parseNrichPortalDetail = (html: string): ParsedTargetDetail => {
  const $ = cheerio.load(html);

  const content = $('div.detail_Area2');

  return {
    detailContent: new TurndownService().turndown(content.html() ?? ''),
    hasAttachedFile: false,
    hasAttachedImage: content.find('img').length > 0,
  };
};

function getUniqIdFromNrichMajorEvent(element: Cheerio<any>) {
  return (
    (element.attr('onclick') ?? '').match(/fnViewPage\('(.*)'\)/)?.[1] ?? ''
  );
}
