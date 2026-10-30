import type { JournalIssue } from '../types/dependencies';

import { type LanguageModel, Output, generateText, jsonSchema } from 'ai';

/** Which papers of an issue the table shows, and which it summarizes. */
export type JournalPaperSelection = {
  /** Paper indices shown in the table, most interesting first. */
  featured: number[];
  /** Papers collapsed into a count and topic summary, in paper order. */
  others: { index: number; topic: string | null }[];
};

/**
 * Picks the papers the newsletter's readers would want to see, or returns null
 * when no selection could be made — the section then lists every paper.
 */
export type JournalPaperSelector = (
  issue: JournalIssue,
) => Promise<JournalPaperSelection | null>;

export type JournalPaperSelectorOptions = {
  /** Same model that scores article importance. */
  model: LanguageModel;
  /**
   * Who reads the newsletter, e.g. "한국고고학회 회원". Interest is judged for
   * them rather than by academic discipline.
   */
  audience: string;
  /**
   * Milliseconds before the selection gives up and falls back. It runs while
   * saving a fully generated issue, so a stalled provider must not hold it.
   * @default 60000
   */
  timeoutMs?: number;
  /** Reports an issue that fell back to listing every paper. */
  onFallback?: (reason: string, issue: JournalIssue) => void;
};

/**
 * Asks for paper indices, never for titles or authors.
 *
 * Rendering stays on the injected papers, so the model can only choose and
 * order them; it cannot rename one or alter its authors. The only text it
 * supplies is the short topic label of a paper it left out of the table.
 */
const SELECT_SCHEMA = jsonSchema<{
  featured: number[];
  others: { index: number; topic: string }[];
}>({
  type: 'object',
  properties: {
    featured: {
      type: 'array',
      items: { type: 'integer' },
      description: '독자가 관심 가질 논문 번호. 관심이 클 것부터',
    },
    others: {
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
      description: '독자의 관심사에서 멀어 요약만 할 논문',
    },
  },
  required: ['featured', 'others'],
  additionalProperties: false,
});

const systemPrompt = (
  audience: string,
) => `너는 ${audience}에게 보내는 뉴스레터에서 학술지 신간 논문 중 무엇을 표로 소개할지 고른다.

기준은 학문 분야가 아니라 **${audience}이(가) 이 논문을 찾아 읽어볼 만큼 관심을 가질까**다.
제목·저자는 바꿀 수 없고, 너는 번호만 고른다. 모든 논문을 featured나 others 중 정확히 한 곳에 넣는다.

- featured: 독자가 관심을 가질 논문. 관심이 클 것부터 순서대로 넣는다.
  - 고고학이 아니어도 독자의 연구·실무에 닿으면 넣는다. 예: 고대 환경·기후 복원, 연대측정·성분분석 같은 분석 기법,
    인골·동물 유존체, 고지도·지명 연구, 전통 건축·토목 기술, 유적·유물을 다루는 문헌사·미술사, 매장유산 제도·정책,
    문화유산 보존처리, 디지털 기록·GIS·AI의 유산 적용
  - 다루는 대상이 독자의 관심 시대·지역·자료와 직접 맞닿는지 본다.
- others: 독자의 관심사에서 멀어 제목을 나열할 필요가 없는 논문. topic에 주제를 2-12자 명사구로 쓴다.
  - 역사학·인문학이라도 독자와 거리가 멀면 여기에 넣는다. 예: 근현대 외교·정치사, 사상사·철학, 현대 문학 비평,
    현대 사회·경제·교육·관광 정책, 유산과 무관한 언어학
  - 애매하면 featured에 넣는다. others는 독자가 거의 찾아보지 않을 논문만이다.`;

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
  return `학술지 「${issue.journalName.trim()}」 ${issue.publishedYear}년 ${issue.publishedMonth}월 호의 논문 ${issue.papers.length}편을 나눠라.\n\n${lines.join('\n')}`;
}

function normalizeTopic(topic: string): string | null {
  const normalized = topic.replace(/\s+/g, ' ').trim();
  return normalized && [...normalized].length <= 30 ? normalized : null;
}

/**
 * Builds the selector that shows an issue's papers its readers would care
 * about as a table, most interesting first, and collapses the rest into a
 * topic summary.
 *
 * It never fails the newsletter: an error, a timeout or an answer with no
 * usable index falls back to null, and the section lists every paper. A paper
 * the model left out, named in both lists or summarized twice is shown in the
 * table after the chosen ones rather than collapsed, so a malformed answer can
 * only show more, never hide a paper.
 */
export const createJournalPaperSelector = (
  options: JournalPaperSelectorOptions,
): JournalPaperSelector => {
  const fallback = (issue: JournalIssue, reason: string) => {
    options.onFallback?.(reason, issue);
    return null;
  };

  return async (issue) => {
    if (issue.papers.length === 0) return { featured: [], others: [] };
    const timeoutMs = options.timeoutMs ?? 60_000;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const { output } = await Promise.race([
        generateText({
          model: options.model,
          output: Output.object({ schema: SELECT_SCHEMA }),
          system: systemPrompt(options.audience),
          prompt: buildUserPrompt(issue),
          abortSignal: controller.signal,
        }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new Error(`selection timed out after ${timeoutMs}ms`));
          }, timeoutMs);
        }),
      ]);

      const count = issue.papers.length;
      const usable = (index: number) =>
        Number.isInteger(index) && index >= 0 && index < count;
      const featured: number[] = [];
      for (const index of output.featured ?? [])
        if (usable(index) && !featured.includes(index)) featured.push(index);
      const topics = new Map<number, string | null>();
      const repeated = new Set<number>();
      for (const { index, topic } of output.others ?? []) {
        if (!usable(index) || featured.includes(index)) continue;
        if (topics.has(index)) repeated.add(index);
        else topics.set(index, normalizeTopic(topic));
      }
      // A paper summarized twice is ambiguous, so it is shown rather than hidden.
      for (const index of repeated) topics.delete(index);

      if (featured.length === 0 && topics.size === 0)
        return fallback(issue, 'no usable index in the selection');

      for (let index = 0; index < count; index++)
        if (!featured.includes(index) && !topics.has(index))
          featured.push(index);

      return {
        featured,
        others: [...topics]
          .map(([index, topic]) => ({ index, topic }))
          .sort((a, b) => a.index - b.index),
      };
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
