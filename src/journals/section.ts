import type { JournalIssue, JournalIssuePaper } from '../types/dependencies';
import type { JournalPaperVerdict } from './classify';

import { escapeLabel } from '../deadlines/reminders';
import { formatVolumeIssue } from '../parsers/journal-issue.parser';
import { JOURNAL_PAPER_FIELDS } from './classify';

/** Heading of the journal issue section. Distinct from any 학술지 heading the model writes. */
export const JOURNAL_ISSUE_SECTION_HEADING = '📖 새로 나온 학술지';

/** Authors listed per paper before the rest are counted. */
const AUTHOR_LIMIT = 3;

/** Topic labels named in the summary of unrelated papers. */
const TOPIC_LIMIT = 5;

export type JournalIssueSectionEntry = {
  issue: JournalIssue;
  /** One verdict per paper, or null to list every paper unclassified. */
  verdicts: JournalPaperVerdict[] | null;
};

/**
 * Escapes a plain table cell: a `|` would end the cell, a newline the row.
 * Link labels go through `escapeLabel`, which already covers both.
 */
function cell(value: string): string {
  return value.replace(/\s+/g, ' ').trim().replace(/\|/g, '\\|');
}

function formatAuthors(authors: string[]): string {
  const names = authors.map((name) => name.trim()).filter(Boolean);
  if (names.length === 0) return '—';
  return names.length > AUTHOR_LIMIT
    ? `${names.slice(0, AUTHOR_LIMIT).join(', ')} 외 ${names.length - AUTHOR_LIMIT}명`
    : names.join(', ');
}

function paperLink(paper: JournalIssuePaper): string {
  return `[${escapeLabel(paper.title.trim())}](${paper.url})`;
}

function issueHeading(issue: JournalIssue): string {
  const label = [issue.journalName.trim(), formatVolumeIssue(issue)]
    .filter(Boolean)
    .join(' ');
  return `**[${escapeLabel(label)}](${issue.url})** · ${issue.publishedYear}년 ${issue.publishedMonth}월 · 논문 ${issue.papers.length}편`;
}

function topicSummary(topics: (string | null)[]): string {
  const named = [
    ...new Set(topics.filter((topic): topic is string => Boolean(topic))),
  ];
  if (named.length === 0) return '';
  return named.slice(0, TOPIC_LIMIT).map(escapeLabel).join(', ');
}

/**
 * Renders one issue: its papers related to the newsletter's fields as a table
 * ordered 고고학 → 역사학 → 문화유산 (unplaced papers last), and the unrelated
 * rest as a count with their topics. Table rows plus that count always equal
 * the paper count.
 */
function renderIssue({ issue, verdicts }: JournalIssueSectionEntry): string {
  const lines = [issueHeading(issue), ''];

  if (!verdicts) {
    lines.push('| 논문 | 저자 |', '| --- | --- |');
    for (const paper of issue.papers)
      lines.push(
        `| ${paperLink(paper)} | ${cell(formatAuthors(paper.authors))} |`,
      );
    return lines.join('\n');
  }

  const order = [...JOURNAL_PAPER_FIELDS, null] as const;
  const rows = issue.papers
    .map((paper, index) => ({ paper, verdict: verdicts[index] }))
    .filter(({ verdict }) => verdict.field !== '기타')
    .sort(
      (a, b) =>
        order.indexOf(a.verdict.field as (typeof order)[number]) -
        order.indexOf(b.verdict.field as (typeof order)[number]),
    );
  const others = verdicts.filter(
    (verdict): verdict is { field: '기타'; topic: string | null } =>
      verdict.field === '기타',
  );
  const topics = topicSummary(others.map((verdict) => verdict.topic));

  if (rows.length > 0) {
    lines.push('| 분야 | 논문 | 저자 |', '| --- | --- | --- |');
    for (const { paper, verdict } of rows)
      lines.push(
        `| ${verdict.field ?? '—'} | ${paperLink(paper)} | ${cell(formatAuthors(paper.authors))} |`,
      );
    if (others.length > 0)
      lines.push(
        '',
        topics
          ? `그 밖에 ${topics} 등을 다룬 논문 ${others.length}편이 함께 실렸습니다.`
          : `그 밖에 논문 ${others.length}편이 함께 실렸습니다.`,
      );
  } else {
    lines.push(
      topics
        ? `${topics} 등을 다룬 논문이 실렸습니다.`
        : '고고학·역사학·문화유산과 거리가 있는 논문이 실렸습니다.',
    );
  }

  return lines.join('\n');
}

/** Renders the whole section, or '' when there is no issue to show. */
export function renderJournalIssueSection(
  entries: JournalIssueSectionEntry[],
): string {
  if (entries.length === 0) return '';
  return [
    `## ${JOURNAL_ISSUE_SECTION_HEADING}`,
    '',
    ...entries.flatMap((entry, index) =>
      index === 0 ? [renderIssue(entry)] : ['', renderIssue(entry)],
    ),
  ].join('\n');
}

/**
 * Headings the section is placed before, in order of preference.
 *
 * 사업·입찰 runs last so it does not bury academic news; placing journals after
 * it would bury them in turn. Without that section the journals go before
 * 마무리, and without either at the end of the body.
 */
export const JOURNAL_ISSUE_SECTION_ANCHORS = [
  '📑 사업·입찰 공고',
  '📌 마무리',
] as const;

/** Inserts the section Markdown before the first anchor heading found. */
export function insertJournalIssueMarkdown(
  content: string,
  section: string,
): string {
  if (!section) return content;
  for (const anchor of JOURNAL_ISSUE_SECTION_ANCHORS) {
    const match = new RegExp(
      `^##\\s+${anchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`,
      'm',
    ).exec(content);
    if (match)
      return `${content.slice(0, match.index)}${section}\n\n${content.slice(match.index)}`;
  }
  return `${content.trimEnd()}\n\n${section}`;
}

/**
 * Inserts the rendered section before the first anchor `<h2>` found, or before
 * `fallback` (the closing block) when neither heading is present.
 */
export function insertJournalIssueHtml(
  document: Document,
  section: Element,
  fallback: Element,
): void {
  const headings = [...document.querySelectorAll('h2')];
  for (const anchor of JOURNAL_ISSUE_SECTION_ANCHORS) {
    const heading = headings.find(
      (element) => element.textContent?.replace(/\s+/g, ' ').trim() === anchor,
    );
    if (heading) {
      heading.before(section);
      return;
    }
  }
  fallback.before(section);
}
