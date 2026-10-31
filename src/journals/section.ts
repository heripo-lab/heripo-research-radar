import type { JournalIssue, JournalIssuePaper } from '../types/dependencies';
import type { JournalPaperSelection } from './select';

import { escapeLabel } from '../deadlines/reminders';
import { formatVolumeIssue } from '../parsers/journal-issue.parser';
import {
  LEADING_CATEGORIES,
  TRAILING_CATEGORY,
} from '../prompts/generate-newsletter';
import {
  JOURNAL_ISSUE_CONTENT_TYPE,
  JOURNAL_ISSUE_SECTION_HEADING,
} from './constants';

export { JOURNAL_ISSUE_CONTENT_TYPE, JOURNAL_ISSUE_SECTION_HEADING };

/** Authors listed per paper before the rest are counted. */
const AUTHOR_LIMIT = 3;

/** Topic labels named in the summary of papers left out of the table. */
const TOPIC_LIMIT = 5;

export type JournalIssueSectionEntry = {
  issue: JournalIssue;
  /** Which papers to show, or null to list every paper in source order. */
  selection: JournalPaperSelection | null;
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
 * Renders one issue: the papers its readers would care about as a table, most
 * interesting first, and the rest as a count with their topics. Table rows plus
 * that count always equal the paper count.
 */
function renderIssue({ issue, selection }: JournalIssueSectionEntry): string {
  const lines = [issueHeading(issue), ''];
  const featured = selection
    ? selection.featured
    : issue.papers.map((_, index) => index);
  const others = selection?.others ?? [];
  const topics = topicSummary(others.map(({ topic }) => topic));

  if (featured.length > 0) {
    lines.push('| 논문 | 저자 |', '| --- | --- |');
    for (const index of featured) {
      const paper = issue.papers[index];
      lines.push(
        `| ${paperLink(paper)} | ${cell(formatAuthors(paper.authors))} |`,
      );
    }
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
        : '이번 호에는 소개할 만한 논문이 없었습니다.',
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
 * New journal issues are academic news, so they follow 학술대회·학술행사 and
 * come before 발굴조사보고서. The headings come from the prompt's category
 * order, so a section missing that day moves the journals before the next one
 * present: 발굴현장 공개, 채용·공고, then 사업·입찰 and 마무리. The categories
 * the model names itself cannot be matched, so on a day with none of the fixed
 * ones the journals land after them. Without any anchor they go at the end of
 * the body.
 */
export const JOURNAL_ISSUE_SECTION_ANCHORS = [
  ...LEADING_CATEGORIES.slice(
    LEADING_CATEGORIES.indexOf('📋 발굴조사보고서 (신규 제출)'),
  ),
  TRAILING_CATEGORY,
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
 *
 * The body separates its sections with an `<hr>` before each heading. That
 * rule stays above the journal section, so the same rule is repeated between
 * the section and the heading it was placed before.
 */
export function insertJournalIssueHtml(
  document: Document,
  section: Element,
  fallback: Element,
): void {
  const headings = [...document.querySelectorAll('h2')];
  const target =
    JOURNAL_ISSUE_SECTION_ANCHORS.map((anchor) =>
      headings.find(
        (element) =>
          element.textContent?.replace(/\s+/g, ' ').trim() === anchor,
      ),
    ).find((heading) => heading !== undefined) ?? fallback;
  const rule = target.previousElementSibling;
  target.before(section);
  if (rule?.tagName === 'HR') target.before(rule.cloneNode(true));
}
