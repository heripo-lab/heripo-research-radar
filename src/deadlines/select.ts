import type { IsoDateString } from '@llm-newsletter-kit/core';

import { type LanguageModel, Output, generateText, jsonSchema } from 'ai';

import {
  DEADLINE_REMINDER_LIMIT,
  type EligibleDeadlineReminder,
} from './reminders';

/**
 * Chooses which eligible reminders the unified section displays.
 *
 * Returns a subset of the given rows in their original display order.
 */
export type DeadlineReminderSelector = (
  rows: EligibleDeadlineReminder[],
  publicationDate: IsoDateString,
) => Promise<EligibleDeadlineReminder[]>;

export type DeadlineReminderSelectorOptions = {
  /** Same model that scores article importance. */
  model: LanguageModel;
  /**
   * Milliseconds before the selection gives up and falls back. It runs while
   * saving a fully generated issue, so a stalled provider must not hold it.
   * @default 60000
   */
  timeoutMs?: number;
  /** Reports a selection that fell back to the first rows by date. */
  onFallback?: (reason: string, candidateCount: number) => void;
  /** Reports a model selection and its token usage. */
  onSelected?: (info: {
    candidateCount: number;
    selectedCount: number;
    usage: unknown;
  }) => void;
};

/**
 * Asks for the indices to display, never for titles, dates or links.
 *
 * Rendering stays on the verified rows, so the model can only leave a row out;
 * it cannot invent an action or alter one. Indices out of range or repeated
 * are discarded rather than trusted.
 */
const SELECT_SCHEMA = jsonSchema<{ select: number[] }>({
  type: 'object',
  properties: {
    select: {
      type: 'array',
      items: { type: 'integer' },
      description: '뉴스레터에 안내할 일정·마감 후보의 번호',
    },
  },
  required: ['select'],
  additionalProperties: false,
});

const systemPrompt = (
  limit: number,
) => `너는 한국 고고학·문화유산 뉴스레터의 "다가오는 일정·마감" 안내를 고른다.

독자는 고고학·문화유산 연구자, 발굴·조사기관 종사자, 학예 인력, 관련 전공 학생이다.
후보는 모두 원문에서 다시 확인한 일정이다. 날짜·제목은 바꿀 수 없고, 너는 번호만 고른다.

고르는 규칙:
- 최대 ${limit}개를 고른다. 같은 행사 중복을 빼고도 후보가 ${limit}개 이상 남으면 반드시 ${limit}개를 채운다.
- 같은 행사 중복을 뺀 후보가 ${limit}개 미만이면 중복만 빼고 모두 고른다. 후순위 일정도 자리가 남으면 뺄 이유가 없다.
- 같은 행사나 같은 마감을 가리키는 후보는 하나만 고른다. 게시 기관이 달라 제목 표현이 조금 달라도 날짜와 내용이 같으면 같은 행사다.
- 독자가 행동할 수 있는 일정을 우선한다: 학술대회·발표·논문 신청, 공모·지원사업 신청, 채용 접수, 발굴 현장 공개, 발굴·시굴·지표조사와 국가유산 수리·보존처리 입찰, 강연·답사 참가 신청.
- 문화유산과 관련이 약한 일반 시설·장비·전산 입찰, 행사 운영 대행은 후순위로 둔다.
- 오늘 마감·개최는 마지막 기회이므로 중요한 것을 우선 포함한다. 다만 오늘 일정만으로 채우지 말고 D-1~D-3 일정도 고르게 포함해 독자가 미리 준비할 수 있게 한다.
- "진행 중"인 장기 전시·행사는 남는 자리에만 넣는다. 최근 여러 번 안내된 일정은 더 뒤로 미룬다.
- 번호의 순서는 상관없다. 표시 순서는 날짜순으로 따로 정해진다.`;

function timingOf({ days, reminder }: EligibleDeadlineReminder): string {
  if (days > 0) return `D-${days}`;
  if (days < 0) return '진행 중';
  return reminder.deadline.type === 'event' ? '오늘 개최' : '오늘 마감';
}

function sourceOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}

function buildUserPrompt(
  rows: EligibleDeadlineReminder[],
  publicationDate: IsoDateString,
  limit: number,
): string {
  const lines = rows.map((row, index) => {
    const { deadline, recentReminderCount } = row.reminder;
    const period =
      deadline.type === 'event' && deadline.endDate
        ? deadline.endDate !== deadline.date
          ? `${deadline.date} ~ ${deadline.endDate}`
          : deadline.date
        : deadline.date;
    const recent = recentReminderCount
      ? ` · 최근 7일 ${recentReminderCount}회 안내`
      : '';
    return `${index}. [${timingOf(row)}] ${period} · ${deadline.type === 'event' ? '행사' : '마감'} · ${deadline.kind} · ${deadline.title.replace(/\s+/g, ' ')} · ${sourceOf(row.url)}${recent}`;
  });
  return `발행일 ${publicationDate}. 다음 ${rows.length}건 중 안내할 일정을 최대 ${limit}개 골라 번호로 답하라.\n\n${lines.join('\n')}`;
}

/**
 * Builds the model selection that replaces "first rows by date".
 *
 * Several sources often announce the same 학술대회, and a busy day can hold
 * fifteen same-day bids, so the earliest rows are a poor proxy for what readers
 * need. The model judges relevance and duplicates; everything that decides
 * whether a row may appear at all stays in {@link eligibleDeadlineReminders}.
 *
 * It never fails the newsletter: an error, an empty answer or unusable indices
 * fall back to the first rows by date.
 */
export const createDeadlineReminderSelector = (
  options: DeadlineReminderSelectorOptions,
): DeadlineReminderSelector => {
  const limit = DEADLINE_REMINDER_LIMIT;
  const fallback = (
    rows: EligibleDeadlineReminder[],
    reason: string,
  ): EligibleDeadlineReminder[] => {
    options.onFallback?.(reason, rows.length);
    return rows.slice(0, limit);
  };

  return async (rows, publicationDate) => {
    // One row leaves nothing to choose or deduplicate.
    if (rows.length <= 1) return rows;
    try {
      const { output, usage } = await generateText({
        model: options.model,
        output: Output.object({ schema: SELECT_SCHEMA }),
        system: systemPrompt(limit),
        prompt: buildUserPrompt(rows, publicationDate, limit),
        abortSignal: AbortSignal.timeout(options.timeoutMs ?? 60_000),
      });
      const chosen = new Set<number>();
      for (const index of output.select) {
        if (chosen.size === limit) break;
        if (Number.isInteger(index) && index >= 0 && index < rows.length)
          chosen.add(index);
      }
      // Every candidate is a verified, current action, so an empty section is
      // a malformed answer rather than a judgement that nothing matters.
      if (!chosen.size)
        return fallback(rows, 'no usable index in the selection');
      options.onSelected?.({
        candidateCount: rows.length,
        selectedCount: chosen.size,
        usage,
      });
      return rows.filter((_, index) => chosen.has(index));
    } catch (error) {
      return fallback(
        rows,
        error instanceof Error ? error.message : String(error),
      );
    }
  };
};
