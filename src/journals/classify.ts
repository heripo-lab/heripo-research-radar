import type { JournalIssue } from '../types/dependencies';

import { type LanguageModel, Output, generateText, jsonSchema } from 'ai';

/** Fields shown in the table, in display order. */
export const JOURNAL_PAPER_FIELDS = ['고고학', '역사학', '문화유산'] as const;

export type JournalPaperField = (typeof JOURNAL_PAPER_FIELDS)[number];

/**
 * One verdict per paper: a table field, a short topic for an unrelated paper,
 * or `null` for a paper the model did not place — it stays in the table.
 */
export type JournalPaperVerdict =
  { field: JournalPaperField | null } | { field: '기타'; topic: string | null };

/**
 * Classifies every paper of an issue, in paper order, or returns null when no
 * classification could be made — the section then lists every paper.
 */
export type JournalPaperClassifier = (
  issue: JournalIssue,
) => Promise<JournalPaperVerdict[] | null>;

export type JournalPaperClassifierOptions = {
  /** Same model that scores article importance. */
  model: LanguageModel;
  /**
   * Milliseconds before the classification gives up and falls back. It runs
   * while saving a fully generated issue, so a stalled provider must not hold
   * it.
   * @default 60000
   */
  timeoutMs?: number;
  /** Reports an issue that fell back to listing every paper. */
  onFallback?: (reason: string, issue: JournalIssue) => void;
};

/**
 * Asks for paper indices per field, never for titles or authors.
 *
 * Rendering stays on the injected papers, so the model can only place a paper;
 * it cannot rename one or alter its authors. The only text it supplies is the
 * short topic label of a paper it judged unrelated.
 */
const CLASSIFY_SCHEMA = jsonSchema<{
  archaeology: number[];
  history: number[];
  heritage: number[];
  other: { index: number; topic: string }[];
}>({
  type: 'object',
  properties: {
    archaeology: {
      type: 'array',
      items: { type: 'integer' },
      description: '고고학 논문 번호',
    },
    history: {
      type: 'array',
      items: { type: 'integer' },
      description: '역사학 논문 번호',
    },
    heritage: {
      type: 'array',
      items: { type: 'integer' },
      description: '문화유산 논문 번호',
    },
    other: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          index: { type: 'integer' },
          topic: {
            type: 'string',
            description: '논문 주제를 2-12자로 요약한 명사구',
          },
        },
        required: ['index', 'topic'],
        additionalProperties: false,
      },
      description: '세 분야와 연관성이 낮은 논문',
    },
  },
  required: ['archaeology', 'history', 'heritage', 'other'],
  additionalProperties: false,
});

const SYSTEM_PROMPT = `너는 한국 고고학·문화유산 뉴스레터에 소개할 학술지 신간 논문을 분야별로 나눈다.

독자는 고고학·문화유산 연구자, 발굴·조사기관 종사자, 학예 인력, 관련 전공 학생이다.
모든 논문을 정확히 한 분야에 넣는다. 제목·저자는 바꿀 수 없고, 너는 번호만 나눈다.

- archaeology(고고학): 유적·유구·유물, 발굴조사, 고고학 이론·방법, 고고과학 분석
- history(역사학): 문헌사·고대사·중세사·근현대사, 사료 연구, 역사지리
- heritage(문화유산): 문화유산 보존·수리·보존과학, 건축유산, 미술사, 민속·무형유산, 박물관, 유산 정책·관리·활용
- other(기타): 위 세 분야와 연관성이 많이 떨어지는 논문. 예: 현대 사회·경제·정책, 일반 자연과학·공학, 현대 문학, 관광·지역개발
  - other에 넣은 논문은 topic에 주제를 2-12자 명사구로 쓴다 (예: "섬 지역 어업 경제", "해양 생태계 변화")

여러 분야에 걸치면 가장 가까운 분야 하나만 고른다. 앞선 분야(고고학 → 역사학 → 문화유산)에
조금이라도 걸치면 other로 보내지 말고 그 분야에 넣는다. other는 독자가 거의 관심 없을 논문만이다.`;

function buildUserPrompt(issue: JournalIssue): string {
  const lines = issue.papers.map((paper, index) => {
    const keywords = [
      ...new Set(paper.keywords.map((k) => k.trim()).filter(Boolean)),
    ].join(', ');
    const abstract = [...(paper.abstract ?? '').replace(/\s+/g, ' ').trim()]
      .slice(0, 200)
      .join('');
    return `${index}. ${paper.title.replace(/\s+/g, ' ').trim()}${keywords ? ` · 키워드: ${keywords}` : ''}${abstract ? ` · 초록: ${abstract}` : ''}`;
  });
  return `학술지 「${issue.journalName.trim()}」 ${issue.publishedYear}년 ${issue.publishedMonth}월 호의 논문 ${issue.papers.length}편을 분야별로 나눠라.\n\n${lines.join('\n')}`;
}

function normalizeTopic(topic: string): string | null {
  const normalized = topic.replace(/\s+/g, ' ').trim();
  return normalized && [...normalized].length <= 30 ? normalized : null;
}

/**
 * Builds the classifier that orders an issue's papers into 고고학 → 역사학 →
 * 문화유산 rows and collapses the unrelated rest into a topic summary.
 *
 * It never fails the newsletter: an error, a timeout or an answer with no
 * usable index falls back to null, and the section lists every paper. A paper
 * the model left out or named twice is kept in the table rather than
 * collapsed, so a malformed answer can only show more, never hide a paper.
 */
export const createJournalPaperClassifier = (
  options: JournalPaperClassifierOptions,
): JournalPaperClassifier => {
  const fallback = (issue: JournalIssue, reason: string) => {
    options.onFallback?.(reason, issue);
    return null;
  };

  return async (issue) => {
    if (issue.papers.length === 0) return [];
    const timeoutMs = options.timeoutMs ?? 60_000;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const { output } = await Promise.race([
        generateText({
          model: options.model,
          output: Output.object({ schema: CLASSIFY_SCHEMA }),
          system: SYSTEM_PROMPT,
          prompt: buildUserPrompt(issue),
          abortSignal: controller.signal,
        }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new Error(`classification timed out after ${timeoutMs}ms`));
          }, timeoutMs);
        }),
      ]);

      const count = issue.papers.length;
      const usable = (index: number) =>
        Number.isInteger(index) && index >= 0 && index < count;
      const seen = new Map<number, number>();
      const note = (index: number) =>
        seen.set(index, (seen.get(index) ?? 0) + 1);
      const assigned = new Map<number, JournalPaperVerdict>();

      const fields: [number[], JournalPaperField][] = [
        [output.archaeology, '고고학'],
        [output.history, '역사학'],
        [output.heritage, '문화유산'],
      ];
      for (const [indices, field] of fields)
        for (const index of indices ?? []) {
          if (!usable(index)) continue;
          note(index);
          assigned.set(index, { field });
        }
      for (const { index, topic } of output.other ?? []) {
        if (!usable(index)) continue;
        note(index);
        assigned.set(index, { field: '기타', topic: normalizeTopic(topic) });
      }

      if (assigned.size === 0)
        return fallback(issue, 'no usable index in the classification');

      // A paper the model skipped or placed twice is shown rather than hidden,
      // without a field it was never reliably given.
      return issue.papers.map((_, index) =>
        seen.get(index) === 1 ? assigned.get(index)! : { field: null },
      );
    } catch (error) {
      return fallback(
        issue,
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      clearTimeout(timer);
    }
  };
};
