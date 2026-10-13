import type {
  ArticleDeadline,
  IsoDateString,
  UrlString,
} from '@llm-newsletter-kit/core';

import { DateService } from '../services/date.service';

/** Host-selected, published action matched against a freshly verified source. */
export interface VerifiedDeadlineReminder {
  deadline: ArticleDeadline;
  url: UrlString;
  verificationStatus: 'verified';
}

function escapeLabel(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/[\\`*_{}[\]()|!#]/g, '\\$&');
}

/** Deterministic display, no LLM context. Host owns D-7/D-1 selection and history. */
export function renderVerifiedDeadlineReminders(
  reminders: VerifiedDeadlineReminder[],
  publicationDate: IsoDateString,
): string {
  const date = new DateService(publicationDate).getPublicationISODateString();
  const publicationMs = Date.parse(`${date}T00:00:00Z`);
  const rows = reminders
    .flatMap((reminder) => {
      const { deadline } = reminder;
      if (
        reminder.verificationStatus !== 'verified' ||
        deadline.status !== 'active' ||
        !deadline.date ||
        !/^\d{4}-\d{2}-\d{2}$/.test(deadline.date)
      )
        return [];
      const ms = Date.parse(`${deadline.date}T00:00:00Z`);
      if (
        !Number.isFinite(ms) ||
        new Date(ms).toISOString().slice(0, 10) !== deadline.date
      )
        return [];
      const days = (ms - publicationMs) / 86_400_000;
      if (days < 0 || days > 7 || !deadline.title.trim()) return [];
      if (
        deadline.time &&
        !/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(deadline.time)
      )
        return [];
      let url: URL;
      try {
        url = new URL(reminder.url);
        if (
          !['http:', 'https:'].includes(url.protocol) ||
          url.username ||
          url.password
        )
          return [];
        if (deadline.timeZone)
          new Intl.DateTimeFormat('en', { timeZone: deadline.timeZone });
      } catch {
        return [];
      }
      return [
        {
          reminder,
          days,
          ms,
          url: url.href.replace(/[()]/g, (value) => encodeURIComponent(value)),
        },
      ];
    })
    .sort(
      (a, b) =>
        a.ms - b.ms ||
        (a.reminder.deadline.time ?? '23:59:59').localeCompare(
          b.reminder.deadline.time ?? '23:59:59',
        ),
    );
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const { reminder, days, url } of rows) {
    const d = reminder.deadline;
    const key = JSON.stringify([url, d.title, d.kind, d.date, d.time]);
    if (seen.has(key)) continue;
    seen.add(key);
    const time = d.time
      ? ` ${d.time}${d.timeZone ? ` (${escapeLabel(d.timeZone)})` : ''}`
      : '';
    const label = d.title.includes(d.kind) ? d.title : `${d.title} · ${d.kind}`;
    lines.push(
      `| [${escapeLabel(label)}](${url}) | ${d.date}${time} · ${days ? `D-${days}` : '오늘 마감'} |`,
    );
    if (lines.length === 5) break;
  }
  return lines.length
    ? `## ⏰ 다가오는 마감\n\n| 안내 | 마감 |\n| --- | --- |\n${lines.join('\n')}`
    : '';
}
