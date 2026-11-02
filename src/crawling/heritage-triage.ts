import type { HeritageBidVerdictStore } from '../types/dependencies';

import {
  type JSONSchema7,
  type LanguageModel,
  NoObjectGeneratedError,
  Output,
  generateText,
  jsonSchema,
} from 'ai';
import { createHash } from 'node:crypto';

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
  signal?: AbortSignal,
) => Promise<boolean[]>;

export type HeritageBidTriageOptions = {
  /** Cheap model; this stage sorts, it does not judge. */
  model: LanguageModel;
  /** Candidates per request. @default 100 */
  batchSize?: number;
  /**
   * Batches in flight at once.
   *
   * Sized against core's fetch timeout, not for throughput. This runs inside
   * `createG2bFetch`, and core aborts a crawl fetch after 10 seconds on the
   * first attempt. A 48-hour window is 22 batches: at 4 at a time that is six
   * waves and about 48 seconds, which never completes; in one wave it measures
   * 7.9 seconds and fits.
   * @default 24
   */
  concurrency?: number;
  /**
   * Keeps verdicts between runs.
   *
   * The in-memory cache below only spans one `generateNewsletter()` call, which
   * is enough for core's retry but not for tomorrow: the window is 48 hours and
   * the run is daily, so half of what arrives was already judged yesterday.
   * Omit it and that half is judged again.
   */
  store?: HeritageBidVerdictStore;
  /** Reports a batch that fell back to {@link isHeritageBidCandidate}. */
  onFallback?: (reason: string, batchSize: number) => void;
  /** Reports a store call that failed; the run then judges normally. */
  onStoreError?: (reason: string, operation: 'load' | 'save') => void;
  /** Reports where each call's verdicts came from. */
  onCacheStats?: (stats: HeritageBidTriageStats) => void;
};

/** Where one triage call's verdicts came from. */
export type HeritageBidTriageStats = {
  /** Candidates asked about. */
  candidates: number;
  /** Answered from this run's own memory, including core's earlier attempts. */
  fromMemory: number;
  /** Answered from {@link HeritageBidVerdictStore}, so not billed. */
  fromStore: number;
  /** Sent to the model. */
  judged: number;
};

const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_CONCURRENCY = 24;

/**
 * Asks for the indices to keep rather than a verdict per row.
 *
 * A boolean array has to line up with the input to mean anything, and a model
 * that returns 99 or 101 entries for 100 rows shifts every verdict after the
 * mistake without failing. Indices carry their own alignment, and anything out
 * of range or repeated is discarded rather than trusted.
 */
const KEEP_JSON_SCHEMA: JSONSchema7 = {
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
};

const KEEP_SCHEMA = jsonSchema<{ keep: number[] }>(KEEP_JSON_SCHEMA);

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

/**
 * The three fields the model is shown, normalized once.
 *
 * The verdict cache keys on exactly this, so a candidate that reads identically
 * to the model is the same candidate to the cache. Deriving both from here is
 * what keeps them from drifting: keying on less than the model sees merges two
 * notices that it judged separately, and the second verdict silently overwrites
 * the first — within a single run, not only across retries.
 */
function identityOf(candidate: HeritageBidCandidate): [string, string, string] {
  return [
    candidate.institution.trim(),
    candidate.title.trim(),
    candidate.classification?.trim() ?? '',
  ];
}

function buildUserPrompt(candidates: HeritageBidCandidate[]): string {
  const lines = candidates.map((candidate, index) => {
    const [institution, title, classification] = identityOf(candidate);

    return (
      `${index}. [${institution}] ${title}` +
      (classification ? ` <${classification}>` : '')
    );
  });

  return `다음 ${candidates.length}건 중 국가유산 업무와 관련될 가능성이 있는 공고의 번호만 골라라.\n\n${lines.join('\n')}`;
}

/**
 * Reads the index list out of whatever shape the response arrived in.
 *
 * The output spec parses JSON but does not enforce the schema, so a model that
 * answers with the bare `[0, 2]` instead of `{"keep": [0, 2]}` reaches us as a
 * perfectly valid result whose `.keep` is `undefined`. Both shapes mean the
 * same thing and both are accepted.
 *
 * Every element must be an integer, or the whole list is refused. Dropping the
 * bad ones instead would turn `[0, "2"]` into `[0]`, which keeps row 0, rejects
 * row 2 and is indistinguishable downstream from a model that considered row 2
 * and said no — `usable` is true, so the out-of-range guard never fires, the
 * batch counts as the model's own work and the store persists it. `["0", "2"]`
 * is the same failure with every row silently rejected.
 */
function readKeep(value: unknown): number[] | undefined {
  const keep = Array.isArray(value)
    ? value
    : ((value ?? undefined) as { keep?: unknown } | undefined)?.keep;

  if (!Array.isArray(keep)) {
    return undefined;
  }

  // An empty list stays legitimate: a batch of road works has nothing to keep.
  return keep.every((index) => Number.isInteger(index))
    ? (keep as number[])
    : undefined;
}

/**
 * Recovers the index list from a response the output spec could not parse.
 *
 * Structured output is not uniform across providers: a model may fence its
 * JSON, or — where the provider has no native schema support and the JSON tool
 * was declined — answer in plain text. Falling straight back to
 * {@link isHeritageBidCandidate} in those cases would quietly reinstate the
 * regex this stage exists to replace, so the response is given one honest
 * second reading first.
 *
 * Only parsed JSON counts. Scraping integers out of prose would read
 * "100건 중 3번과 15번" as keeping rows 100, 3 and 15, which looks like a
 * verdict and is not one.
 */
function salvageKeep(text: string | undefined): number[] | undefined {
  if (!text) {
    return undefined;
  }

  const unfenced = text
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '');
  const start = unfenced.search(/[[{]/);

  if (start === -1) {
    return undefined;
  }

  const end = unfenced.lastIndexOf(unfenced[start] === '[' ? ']' : '}');

  if (end <= start) {
    return undefined;
  }

  try {
    return readKeep(JSON.parse(unfenced.slice(start, end + 1)));
  } catch {
    return undefined;
  }
}

/**
 * One batch's verdicts, and whether the model made them.
 *
 * A fallback verdict is still worth keeping for the rest of the run so core's
 * retry does not pay for the batch again, but it is the regex's answer, not the
 * model's. Persisting it would fix the regex's known blind spots — 영양 하담고택,
 * 윤선도원림 판석보 — onto those notices for as long as the rows live.
 */
type BatchVerdicts = { verdicts: boolean[]; fromModel: boolean };

/** Applies the deterministic filter, which is what triage falls back to. */
function deterministicVerdicts(
  candidates: HeritageBidCandidate[],
): BatchVerdicts {
  return {
    verdicts: candidates.map((candidate) => isHeritageBidCandidate(candidate)),
    fromModel: false,
  };
}

async function triageBatch(
  candidates: HeritageBidCandidate[],
  { model, onFallback }: HeritageBidTriageOptions,
  signal?: AbortSignal,
): Promise<BatchVerdicts> {
  let keep: number[] | undefined;

  try {
    const result = await generateText({
      model,
      output: Output.object({ schema: KEEP_SCHEMA }),
      system: SYSTEM_PROMPT,
      prompt: buildUserPrompt(candidates),
      abortSignal: signal,
      // The mode core settled on after Anthropic truncated structured output
      // containing quotation marks. This schema holds only integers, but the
      // JSON tool is the path Claude is known to answer reliably, and other
      // providers ignore the key.
      providerOptions: { anthropic: { structuredOutputMode: 'jsonTool' } },
    });

    let output: unknown;

    try {
      output = result.output;
    } catch {
      // `output` is a getter, and it throws when the step produced nothing the
      // spec could read at all — a provider that answered with a tool call, or
      // with no text. The raw text is still on the result either way.
      output = undefined;
    }

    keep = readKeep(output) ?? salvageKeep(result.text);
  } catch (error) {
    // A cancelled crawl must fail the fetch, not quietly answer from the regex:
    // core has already given up on this attempt, and returning a list now would
    // hand it a result it is no longer waiting for. The signal is the ground
    // truth rather than the error's shape, which the AI SDK may have wrapped.
    if (signal?.aborted) {
      throw error;
    }

    // Other providers reject inside `generateText` instead, carrying the raw
    // text on the error rather than on a result.
    keep = NoObjectGeneratedError.isInstance(error)
      ? salvageKeep(error.text)
      : undefined;

    if (keep === undefined) {
      onFallback?.(
        error instanceof Error ? error.message : String(error),
        candidates.length,
      );

      return deterministicVerdicts(candidates);
    }
  }

  if (keep === undefined) {
    onFallback?.('the response held no readable index list', candidates.length);

    return deterministicVerdicts(candidates);
  }

  const verdicts = new Array<boolean>(candidates.length).fill(false);
  let usable = false;

  for (const index of keep) {
    if (Number.isInteger(index) && index >= 0 && index < candidates.length) {
      verdicts[index] = true;
      usable = true;
    }
  }

  // An empty selection is a legitimate answer for a batch of road works, but
  // a selection that is entirely out of range is a malformed response wearing
  // the right shape, and it must not read as "reject everything".
  if (!usable && keep.length > 0) {
    onFallback?.('every returned index was out of range', candidates.length);

    return deterministicVerdicts(candidates);
  }

  return { verdicts, fromModel: true };
}

/**
 * Identifies what the verdicts in a store were made by.
 *
 * A verdict is only reusable while the thing that produced it is unchanged, so
 * the fingerprint covers the selection rules (the system prompt), the shape the
 * answer is asked for (the user prompt line and the schema) and the model. Edit
 * any of them and every key changes, which retires the old rows instead of
 * silently serving yesterday's judgement under today's rules. The alternative —
 * a version constant bumped by hand — is one edit away from being wrong, and
 * the failure is invisible.
 */
function fingerprintOf(model: LanguageModel): string {
  const modelIdentity =
    typeof model === 'string' ? model : `${model.provider}:${model.modelId}`;

  return createHash('sha256')
    .update(
      [
        SYSTEM_PROMPT,
        // Rendering one empty row pins the line format and `identityOf` along
        // with the instruction, without pinning the batch size.
        buildUserPrompt([{ institution: '', title: '' }]),
        JSON.stringify(KEEP_JSON_SCHEMA),
        modelIdentity,
      ].join('\u0000'),
    )
    .digest('hex');
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
 * Verdicts are cached in two places. The in-memory map spans one run and exists
 * for core's retry: core aborts the first attempt at 10 seconds and tries again
 * with a longer budget, and without it every attempt would pay for the whole
 * window. An optional {@link HeritageBidVerdictStore} spans runs, which is what
 * the 48-hour window and a daily schedule need — half of each window was judged
 * yesterday, and almost all of that half is rejections, which never reach the
 * article table and so cannot be recognised any other way.
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
  const {
    batchSize = DEFAULT_BATCH_SIZE,
    concurrency = DEFAULT_CONCURRENCY,
    store,
    onStoreError,
    onCacheStats,
  } = options;

  const fingerprint = fingerprintOf(options.model);

  // Keying on exactly what the model is shown is what keeps the cache honest:
  // key on less and two notices it judged separately become one, and the second
  // verdict silently overwrites the first. The hash keeps every key the same
  // length, because the store is asked about some 2,100 of them at once.
  const keyOf = (candidate: HeritageBidCandidate) =>
    createHash('sha256')
      .update([fingerprint, ...identityOf(candidate)].join('\u0000'))
      .digest('hex');

  const verdicts = new Map<string, boolean>();
  /** Model verdicts this process has not handed to the store yet. */
  const unsaved = new Set<string>();

  return async (candidates, signal) => {
    if (candidates.length === 0) {
      return [];
    }

    const keys = new Map(candidates.map((c) => [c, keyOf(c)] as const));
    const fromMemory = candidates.filter((c) =>
      verdicts.has(keys.get(c)!),
    ).length;

    if (store) {
      const missing = [
        ...new Set(
          candidates
            .map((c) => keys.get(c)!)
            .filter((key) => !verdicts.has(key)),
        ),
      ];

      if (missing.length > 0) {
        try {
          // Awaited, unlike the write: the whole point is to judge less, and a
          // verdict that arrives after the batches are built saves nothing.
          for (const [key, verdict] of await store.load(missing)) {
            verdicts.set(key, verdict);
          }
        } catch (error) {
          // A store that is down must not stop the crawl; the run simply pays
          // for what it could not read.
          onStoreError?.(
            error instanceof Error ? error.message : String(error),
            'load',
          );
        }
      }
    }

    const fromStore =
      candidates.filter((c) => verdicts.has(keys.get(c)!)).length - fromMemory;

    const pending = candidates.filter((c) => !verdicts.has(keys.get(c)!));
    const batches: HeritageBidCandidate[][] = [];

    for (let index = 0; index < pending.length; index += batchSize) {
      batches.push(pending.slice(index, index + batchSize));
    }

    let next = 0;

    const workers = Array.from(
      { length: Math.min(concurrency, batches.length) },
      async () => {
        while (next < batches.length) {
          const batch = batches[next++];
          const decided = await triageBatch(batch, options, signal);

          batch.forEach((candidate, index) => {
            const key = keys.get(candidate)!;

            verdicts.set(key, decided.verdicts[index]);

            if (decided.fromModel) {
              unsaved.add(key);
            }
          });
        }
      },
    );

    // A rejection here propagates out of the fetch, which is what an aborted
    // crawl needs; completed batches stay cached for the next attempt.
    await Promise.all(workers);

    onCacheStats?.({
      candidates: candidates.length,
      fromMemory,
      fromStore,
      judged: pending.length,
    });

    if (store && unsaved.size > 0 && !signal?.aborted) {
      const pendingWrite = new Map(
        [...unsaved].map((key) => [key, verdicts.get(key)!] as const),
      );

      unsaved.clear();

      // Deliberately not awaited. This runs inside the crawl fetch that core
      // times out at 10 seconds, and the saving is meant to make that budget
      // easier to hit, not harder; the run continues for minutes afterwards, so
      // the write has time to land.
      void store.save(pendingWrite).catch((error: unknown) => {
        for (const key of pendingWrite.keys()) {
          unsaved.add(key);
        }

        onStoreError?.(
          error instanceof Error ? error.message : String(error),
          'save',
        );
      });
    }

    return candidates.map((c) => verdicts.get(keys.get(c)!) ?? false);
  };
};
