import type { ArticleForGenerateContent } from '@llm-newsletter-kit/core';

import type { VerifiedDeadlineReminder } from './reminders';

import { isArticleDeadlineGrounded } from '@llm-newsletter-kit/core';
import { JSDOM } from 'jsdom';
import safeMarkdown2Html from 'safe-markdown2html';

function canonicalSourceUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return null;
    url.hash = '';
    url.searchParams.sort();
    return `${url.host}${decodeURI(url.pathname)}${url.search}`;
  } catch {
    return null;
  }
}

function sourceKey(value: string): string | null {
  const canonical = canonicalSourceUrl(value);
  if (!canonical) return null;
  try {
    const url = new URL(value);
    const numbers = url.searchParams.getAll('bidPbancNo');
    if (
      url.host === 'www.g2b.go.kr' &&
      url.pathname === '/link/PNPE027_01/single/' &&
      numbers.length === 1 &&
      /^[a-zA-Z0-9]{1,40}$/.test(numbers[0])
    )
      return `g2b:${numbers[0]}`;
    return canonical;
  } catch {
    return null;
  }
}

const normalize = (value: string) =>
  value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\p{P}\p{S}\s]/gu, '');

/** Fresh source verification supersedes caches; unmatched cached actions are held. */
export function collectNewsletterDeadlines(
  content: string,
  articles: ArticleForGenerateContent[],
  verified: VerifiedDeadlineReminder[],
): VerifiedDeadlineReminder[] {
  const document = new JSDOM(
    safeMarkdown2Html(content, {
      window: new JSDOM('').window,
      linkTargetBlank: true,
      fixMalformedUrls: true,
      fixBoldSyntax: true,
      convertStrikethrough: true,
    }),
  ).window.document;
  const included = new Set(
    [...document.querySelectorAll('a[href]')]
      .map((link) => canonicalSourceUrl(link.getAttribute('href')!))
      .filter(Boolean),
  );
  const identity = (item: VerifiedDeadlineReminder) => {
    const source = sourceKey(item.url);
    // Deduplicate collected actions only. Free-form labels never decide which
    // cached actions can supplement a freshly verified source.
    return JSON.stringify([
      source,
      item.deadline.type ?? 'deadline',
      source?.startsWith('g2b:') ? null : normalize(item.deadline.title),
      normalize(item.deadline.kind),
      // Event occurrences may share a name and kind but have different periods.
      // Deadline actions retain the existing identity across date extensions.
      ...(item.deadline.type === 'event'
        ? [
            item.deadline.date,
            item.deadline.time,
            item.deadline.endDate ?? null,
            item.deadline.endTime ?? null,
          ]
        : []),
    ]);
  };
  const result = verified.filter(
    (item) => item.verificationStatus === 'verified' && sourceKey(item.url),
  );
  const refreshedSources = new Set(result.map((item) => sourceKey(item.url)));
  const seen = new Set(result.map(identity));
  for (const article of articles) {
    // Inclusion stays revision-specific even though reminders share a notice number.
    if (!included.has(canonicalSourceUrl(article.url))) continue;
    // A different kind can be a renamed or cancelled action, not necessarily
    // another action. Never refill this source with unmatched cached deadlines.
    // Distinct actions remain eligible when each is freshly verified.
    if (refreshedSources.has(sourceKey(article.url))) continue;
    for (const deadline of article.deadlines ?? []) {
      if (!isArticleDeadlineGrounded(deadline, article)) continue;
      const item: VerifiedDeadlineReminder = {
        deadline,
        url: article.url,
        verificationStatus: 'verified',
      };
      const key = identity(item);
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}
