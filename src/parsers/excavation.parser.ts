import type { Cheerio } from 'cheerio';

import {
  DateType,
  type ParsedTargetDetail,
  type ParsedTargetListItem,
} from '@llm-newsletter-kit/core';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';

import type {
  ExcavationReport,
  ExcavationReportSource,
} from '~/types/dependencies';

import { getDate } from './utils';

const EXCAVATION_BASE_URL = 'https://www.e-minwon.go.kr';

/** List page of the 국가유산청 발굴조사 보고서 board. */
export const EXCAVATION_REPORT_LIST_URL = `${EXCAVATION_BASE_URL}/ge/ee/getListEcexmRptp.do`;

/** Public detail URL for one report, keyed by its board id (`ecexmRcno`). */
export const buildExcavationReportDetailUrl = (externalId: string): string =>
  `${EXCAVATION_BASE_URL}/ge/ee/getEcexmRptp.do?ecexmRcno=${externalId}`;

/**
 * Marks a response body as injected report data rather than scraped HTML, so
 * the parsers below can tell the two apart without guessing.
 */
const INJECTED_MARKER = '@heripo/research-radar:excavation-reports';

type InjectedListPayload = {
  marker: typeof INJECTED_MARKER;
  reports: ExcavationReport[];
};

type InjectedDetailPayload = {
  marker: typeof INJECTED_MARKER;
  report: ExcavationReport;
};

function parseInjectedPayload<T extends { marker: string }>(
  body: string,
): T | null {
  if (!body.includes(INJECTED_MARKER)) {
    return null;
  }

  try {
    const parsed = JSON.parse(body) as T;
    return parsed.marker === INJECTED_MARKER ? parsed : null;
  } catch {
    return null;
  }
}

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

/**
 * Serves the 발굴조사 보고서 board from an injected source instead of the live
 * site, leaving every other request untouched.
 *
 * Core's crawling chain always fetches a target's list URL and then each detail
 * URL, so the substitution happens at the fetch layer — the same seam
 * `createKrasFetch` uses. `source` is called once and its result reused for the
 * detail requests that follow.
 *
 * @param baseFetch - Fetch to delegate every other request to
 * @param source - Supplies the reports for this run
 */
export const createExcavationReportFetch = (
  baseFetch: typeof fetch = fetch,
  source: ExcavationReportSource,
): typeof fetch => {
  let pending: Promise<ExcavationReport[]> | null = null;
  const loadReports = () => (pending ??= source());

  return async (input, init) => {
    const requestUrl =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const url = new URL(requestUrl, EXCAVATION_BASE_URL);

    if (url.origin !== new URL(EXCAVATION_BASE_URL).origin) {
      return baseFetch(input, init);
    }

    if (url.pathname === new URL(EXCAVATION_REPORT_LIST_URL).pathname) {
      const reports = await loadReports();
      return jsonResponse({
        marker: INJECTED_MARKER,
        reports,
      } satisfies InjectedListPayload);
    }

    if (url.pathname === '/ge/ee/getEcexmRptp.do') {
      const externalId = url.searchParams.get('ecexmRcno');
      const report = (await loadReports()).find(
        (candidate) => candidate.externalId === externalId,
      );

      if (report) {
        return jsonResponse({
          marker: INJECTED_MARKER,
          report,
        } satisfies InjectedDetailPayload);
      }
    }

    return baseFetch(input, init);
  };
};

/** Renders a report's fields as the article body. */
function renderExcavationReportContent(report: ExcavationReport): string {
  const lines = Object.entries(report.fields)
    .filter(([, value]) => value != null && String(value).trim() !== '')
    .map(([label, value]) => `- **${label}**: ${String(value).trim()}`);

  return ['## 발굴조사 보고서 정보', '', ...lines].join('\n');
}

export const parseExcavationStatusList = (
  html: string,
): ParsedTargetListItem[] => {
  const $ = cheerio.load(html);
  const posts: ParsedTargetListItem[] = [];
  const baseUrl = 'https://www.e-minwon.go.kr';

  $('table.td_left tbody tr.list_tr').each((index, element) => {
    const columns = $(element).find('td');
    if (columns.length === 0) {
      return;
    }

    const titleElement = columns.eq(1).find('a');
    const relativeHref = titleElement.attr('href');

    if (!relativeHref) {
      return;
    }

    const uniqId = getUniqIdFromExcavationItem(titleElement);
    const title =
      titleElement.attr('title')?.trim() ?? titleElement.text().trim() ?? '';
    const date = getDate(columns.eq(4).text().trim());

    const detailUrl = `${baseUrl}/ge/ee/getEcexmPrmsnAply.do?ecexmRcno=${uniqId}`;

    posts.push({
      uniqId,
      title,
      date,
      detailUrl,
      dateType: DateType.REGISTERED,
    });
  });

  return posts;
};

export const parseExcavationReportList = (
  html: string,
): ParsedTargetListItem[] => {
  const injected = parseInjectedPayload<InjectedListPayload>(html);

  if (injected) {
    return injected.reports.map((report) => ({
      uniqId: report.externalId,
      title: report.title,
      date: report.submittedDate,
      detailUrl: buildExcavationReportDetailUrl(report.externalId),
      dateType: DateType.REGISTERED,
    }));
  }

  const $ = cheerio.load(html);
  const posts: ParsedTargetListItem[] = [];
  const baseUrl = 'https://www.e-minwon.go.kr';

  $('table.td_left tbody tr.list_tr').each((index, element) => {
    const columns = $(element).find('td');
    if (columns.length === 0) {
      return;
    }

    const titleElement = columns.eq(2).find('a');
    const relativeHref = titleElement.attr('href');

    if (!relativeHref) {
      return;
    }

    const uniqId = getUniqIdFromExcavationItem(titleElement);
    const title =
      titleElement.attr('title')?.trim() ?? titleElement.text().trim() ?? '';
    const date = getDate(columns.eq(6).text().trim());

    const detailUrl = `${baseUrl}/ge/ee/getEcexmRptp.do?ecexmRcno=${uniqId}`;

    posts.push({
      uniqId,
      title,
      date,
      detailUrl,
      dateType: DateType.REGISTERED,
    });
  });

  return posts;
};

export const parseExcavationSiteList = (
  html: string,
): ParsedTargetListItem[] => {
  const $ = cheerio.load(html);
  const posts: ParsedTargetListItem[] = [];
  const baseUrl = 'https://www.e-minwon.go.kr';

  $('table.td_left tbody tr.list_tr').each((index, element) => {
    const columns = $(element).find('td');
    if (columns.length === 0) {
      return;
    }

    const titleElement = columns.eq(1).find('a');
    const relativeHref = titleElement.attr('href');

    if (!relativeHref) {
      return;
    }

    const uniqId = getUniqIdFromExcavationItem(titleElement);
    const title =
      titleElement.attr('title')?.trim() ?? titleElement.text().trim() ?? '';
    const date = getDate(columns.eq(4).text().trim());

    const detailUrl = `${baseUrl}/ge/ee/getLinkGrndsRls.do?grndsRlsSeqc=${uniqId}`;

    posts.push({
      uniqId,
      title,
      date,
      detailUrl,
      dateType: DateType.DURATION,
    });
  });

  return posts;
};

export const parseExcavationStatusDetail = (
  html: string,
): ParsedTargetDetail => {
  const $ = cheerio.load(html);

  const content = $('table.td_left').parent();

  return {
    detailContent: new TurndownService().turndown(content.html() ?? ''),
    hasAttachedFile: false,
    hasAttachedImage: false,
  };
};

export const parseExcavationReportDetail = (
  html: string,
): ParsedTargetDetail => {
  const injected = parseInjectedPayload<InjectedDetailPayload>(html);

  if (injected) {
    return {
      detailContent: renderExcavationReportContent(injected.report),
      hasAttachedFile: injected.report.hasAttachedFile ?? true,
      hasAttachedImage: false,
    };
  }

  const $ = cheerio.load(html);

  const content = $('table.td_left').parent();

  const trList = content.find('table tbody tr');
  trList.each((index, element) => {
    if (trList.length === index + 1) {
      $(element).remove();
    }
  });

  return {
    detailContent: new TurndownService().turndown(content.html() ?? ''),
    hasAttachedFile: true,
    hasAttachedImage: false,
  };
};

export const parseExcavationSiteDetail = (html: string): ParsedTargetDetail => {
  const $ = cheerio.load(html);

  const content = $('div.board_view').parent();

  const dlList = content.find('div dl');
  dlList.each((index, element) => {
    if (dlList.length === index + 1) {
      $(element).remove();
    }
  });

  return {
    detailContent: new TurndownService().turndown(content.html() ?? ''),
    hasAttachedFile: true,
    hasAttachedImage: false,
  };
};

function getUniqIdFromExcavationItem(element: Cheerio<any>) {
  return (
    (element.attr('onclick') ?? '').match(/dataSelected\('(.*)'\)/)?.[1] ?? ''
  );
}
