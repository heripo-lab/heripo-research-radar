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

export function escapeLabel(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/[\\`*_{}[\]()|!#]/g, '\\$&');
}

const clockPattern = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;
const fullClock = (time: string) => (time.length === 5 ? `${time}:00` : time);
function calendarMs(date: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NaN;
  const ms = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === date
    ? ms
    : NaN;
}

/** Deterministic deadlines/events, no LLM context. Host owns selection and history. */
export function renderVerifiedDeadlineReminders(
  reminders: VerifiedDeadlineReminder[],
  publicationDate: IsoDateString,
  now = new Date(),
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
      const isEvent = deadline.type === 'event';
      const ms = calendarMs(deadline.date);
      const endDate = isEvent
        ? (deadline.endDate ?? deadline.date)
        : deadline.date;
      const endMs = calendarMs(endDate);
      if (!Number.isFinite(ms) || !Number.isFinite(endMs) || endMs < ms)
        return [];
      if (
        (!isEvent && (deadline.endDate || deadline.endTime)) ||
        (deadline.endTime && !deadline.endDate)
      )
        return [];
      if (
        (deadline.time && !clockPattern.test(deadline.time)) ||
        (deadline.endTime && !clockPattern.test(deadline.endTime))
      )
        return [];
      if (
        isEvent &&
        endDate === deadline.date &&
        deadline.time &&
        deadline.endTime &&
        fullClock(deadline.endTime) < fullClock(deadline.time)
      )
        return [];
      const days = (ms - publicationMs) / 86_400_000;
      // Events remain eligible through a known end date; a start time is never
      // treated as an application cutoff. Unknown endpoints stay unknown.
      if (days > 7 || endMs < publicationMs || !deadline.title.trim())
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
        const closingTime = isEvent ? deadline.endTime : deadline.time;
        if (closingTime) {
          const parts = new Intl.DateTimeFormat('en', {
            timeZone: deadline.timeZone ?? 'Asia/Seoul',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hourCycle: 'h23',
          }).formatToParts(now);
          const values = Object.fromEntries(
            parts.map(({ type, value }) => [type, value]),
          );
          const localNow = `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second}`;
          const closes = `${endDate} ${fullClock(closingTime)}`;
          if (closes <= localNow) return [];
        }
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
        // The five-row limit must not let older ongoing events displace
        // today's or upcoming deadlines/events. Ongoing events fill spare rows.
        Number(a.days < 0) - Number(b.days < 0) ||
        a.ms - b.ms ||
        (a.reminder.deadline.time ?? '23:59:59').localeCompare(
          b.reminder.deadline.time ?? '23:59:59',
        ),
    );
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const { reminder, days, url } of rows) {
    const d = reminder.deadline;
    const key = JSON.stringify([
      url,
      d.type ?? 'deadline',
      d.title,
      d.kind,
      d.date,
      d.time,
      d.endDate ?? null,
      d.endTime ?? null,
    ]);
    if (seen.has(key)) continue;
    seen.add(key);
    const isEvent = d.type === 'event';
    const time = d.time ? ` ${d.time}` : '';
    const end =
      isEvent && d.endDate
        ? d.endDate !== d.date
          ? ` ~ ${d.endDate}${d.endTime ? ` ${d.endTime}` : ''}`
          : d.endTime
            ? ` ~ ${d.endTime}`
            : ''
        : '';
    const zone =
      (d.time || (isEvent && d.endTime)) && d.timeZone
        ? ` (${escapeLabel(d.timeZone)})`
        : '';
    const timing =
      days > 0
        ? `D-${days}`
        : days < 0
          ? '진행 중'
          : isEvent
            ? /공개/.test(d.kind)
              ? '오늘 공개'
              : '오늘 개최'
            : '오늘 마감';
    const label = d.title.includes(d.kind) ? d.title : `${d.title} · ${d.kind}`;
    lines.push(
      `| [${escapeLabel(label)}](${url}) | **${d.date}${time}${end}${zone} · ${timing}** |`,
    );
    if (lines.length === 5) break;
  }
  return lines.length
    ? `## ⏰ 다가오는 일정·마감\n\n| 안내 | 일정 |\n| --- | --- |\n${lines.join('\n')}`
    : '';
}
