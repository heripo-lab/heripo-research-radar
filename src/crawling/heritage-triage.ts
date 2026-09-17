import { type LanguageModel, Output, generateText, jsonSchema } from 'ai';

import {
  type HeritageBidCandidate,
  isHeritageBidCandidate,
} from '~/crawling/heritage-job-filter';

/**
 * Decides which 나라장터 notices are worth scoring, one batch at a time.
 *
 * Returns one verdict per candidate, in the order they were given.
 */
export type HeritageBidTriage = (
  candidates: HeritageBidCandidate[],
) => Promise<boolean[]>;

export type HeritageBidTriageOptions = {
  /** Cheap model; this stage sorts, it does not judge. */
  model: LanguageModel;
  /** Candidates per request. @default 100 */
  batchSize?: number;
  /** Batches in flight at once. @default 4 */
  concurrency?: number;
  /** Reports a batch that fell back to {@link isHeritageBidCandidate}. */
  onFallback?: (reason: string, batchSize: number) => void;
};

const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_CONCURRENCY = 4;

/**
 * Asks for the indices to keep rather than a verdict per row.
 *
 * A boolean array has to line up with the input to mean anything, and a model
 * that returns 99 or 101 entries for 100 rows shifts every verdict after the
 * mistake without failing. Indices carry their own alignment, and anything out
 * of range or repeated is discarded rather than trusted.
 */
const KEEP_SCHEMA = jsonSchema<{ keep: number[] }>({
  type: 'object',
  properties: {
    keep: {
      type: 'array',
      items: { type: 'integer' },
      description: '국가유산 업무와 관련될 가능성이 있는 공고의 번호',
    },
  },
  required: ['keep'],
  additionalProperties: false,
});

const SYSTEM_PROMPT = `너는 대한민국 나라장터 입찰공고를 국가유산 뉴스레터용으로 선별한다.

이것은 **선별** 단계이지 평가 단계가 아니다. 중요도와 기사 가치는 뒤의 채점
단계가 공고 전문을 읽고 따로 판단한다. 따라서 여기서는 재현율을 우선하여
**조금이라도 국가유산 업무일 가능성이 있으면 포함**한다. 애매하면 포함한다.

포함할 것:
- 발굴조사, 시굴조사, 지표조사, 입회조사, 매장유산 관련 사업
- 국가유산·문화재의 수리, 보수, 정비, 복원, 이전, 해체
- 보존처리, 보존과학, 기록화, 정밀실측, 학술연구, 종합정비계획
- 고택, 종택, 재사, 서원, 향교, 사찰, 읍성, 산성, 고분, 왕릉, 원림, 명승 등
  지정·비지정 유산을 대상으로 하는 사업
- 박물관·미술관의 전시, 소장품·유물 관리, 수장고 업무
- 국가유산을 대상으로 한 재난방지·방재·소방 시설

제외할 것:
- 유산과 무관한 토목, 임업, 도로, 상하수도, 조경 사업
- 청소, 경비, 급식, 셔틀, 현수막 등 일반 지원 용역
- 유산과 무관한 건물의 일반 시설 유지관리
- 축제·행사의 운영 대행, 무대·음향·홍보물 등 행사 지원 그 자체

단, 국가유산의 지정·승격·등록처럼 유산 자체에 일어난 일을 기념하거나
알리는 사업은 행사 형식이더라도 포함한다.

중요: **발주 기관이 국가유산 기관이 아니어도 사업 내용이 유산이면 포함한다.**
지자체가 발주하는 고택 보수, 읍성 정비, 산불 피해 국가유산 복원이 여기 해당한다.
반대로 발주 기관이 유산 기관이어도 내용이 무관하면 제외한다.

주의: 한국어 부분문자열에 속지 마라. '생산성'은 산성이 아니고, '재사용'은
재사가 아니며, '서원구'는 서원이 아니다.`;

function buildUserPrompt(candidates: HeritageBidCandidate[]): string {
  const lines = candidates.map(
    (candidate, index) =>
      `${index}. [${candidate.institution.trim()}] ${candidate.title.trim()}` +
      (candidate.classification ? ` <${candidate.classification.trim()}>` : ''),
  );

  return `다음 ${candidates.length}건 중 국가유산 업무와 관련될 가능성이 있는 공고의 번호만 골라라.\n\n${lines.join('\n')}`;
}

/** Applies the deterministic filter, which is what triage falls back to. */
function deterministicVerdicts(candidates: HeritageBidCandidate[]): boolean[] {
  return candidates.map((candidate) => isHeritageBidCandidate(candidate));
}

async function triageBatch(
  candidates: HeritageBidCandidate[],
  { model, onFallback }: HeritageBidTriageOptions,
): Promise<boolean[]> {
  try {
    const { output } = await generateText({
      model,
      output: Output.object({ schema: KEEP_SCHEMA }),
      system: SYSTEM_PROMPT,
      prompt: buildUserPrompt(candidates),
    });

    const verdicts = new Array<boolean>(candidates.length).fill(false);
    let usable = false;

    for (const index of output.keep) {
      if (Number.isInteger(index) && index >= 0 && index < candidates.length) {
        verdicts[index] = true;
        usable = true;
      }
    }

    // An empty selection is a legitimate answer for a batch of road works, but
    // a selection that is entirely out of range is a malformed response wearing
    // the right shape, and it must not read as "reject everything".
    if (!usable && output.keep.length > 0) {
      onFallback?.('every returned index was out of range', candidates.length);
      return deterministicVerdicts(candidates);
    }

    return verdicts;
  } catch (error) {
    onFallback?.(
      error instanceof Error ? error.message : String(error),
      candidates.length,
    );

    return deterministicVerdicts(candidates);
  }
}

/**
 * Builds the LLM triage that replaces the regex as 나라장터's gate.
 *
 * 나라장터 carries about 1,000 용역 and 공사 notices a day, so a 48-hour window
 * holds roughly 1,500 — far too many to score one by one, which is why a
 * deterministic filter stood here first. But heritage vocabulary cannot be
 * settled by substring: `산불` is forestry in 산불예방 숲가꾸기 and heritage work
 * in 안동 산불피해 국가유산 복원, and widening the other way collides just as
 * badly (`산성` matches 생산성, `재사` matches 재사용). Judging 100 titles per
 * request costs about 15 calls a day, so the judgement can be made by something
 * that reads them.
 *
 * It never fails open: an error, or a response whose indices are unusable, falls
 * back to {@link isHeritageBidCandidate} for that batch rather than admitting
 * every notice into per-article scoring. Omitting triage entirely leaves the
 * deterministic filter in charge, which is how the health-check runs without an
 * LLM key.
 */
export const createHeritageBidTriage = (
  options: HeritageBidTriageOptions,
): HeritageBidTriage => {
  const { batchSize = DEFAULT_BATCH_SIZE, concurrency = DEFAULT_CONCURRENCY } =
    options;

  return async (candidates) => {
    if (candidates.length === 0) {
      return [];
    }

    const batches: HeritageBidCandidate[][] = [];

    for (let index = 0; index < candidates.length; index += batchSize) {
      batches.push(candidates.slice(index, index + batchSize));
    }

    const results = new Array<boolean[]>(batches.length);
    let next = 0;

    const workers = Array.from(
      { length: Math.min(concurrency, batches.length) },
      async () => {
        while (next < batches.length) {
          const current = next++;
          results[current] = await triageBatch(batches[current], options);
        }
      },
    );

    await Promise.all(workers);

    return results.flat();
  };
};
