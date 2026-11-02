import type { HeritageBidVerdictStore } from '../src/types/dependencies';

import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createHeritageBidTriage } from '../src/crawling/heritage-triage';

// Two of these match no inclusion pattern in `isHeritageBidCandidate` — a
// 고택 commissioned by a 지자체 and a temple's own analysis contract — which is
// why triage exists. They are also what tells a model verdict apart from the
// fallback in every assertion below.
const candidates = [
  { institution: '영양군', title: '영양 하담고택 보수정비사업' },
  { institution: '한국도로공사', title: '고속도로 비탈면 정비공사' },
  { institution: '해인사 장경도량', title: '팔만대장경 P-XRF 분석' },
];

const KEPT = [true, false, true];
const REGEX_FALLBACK = [false, false, false];

/** Counts requests so a cache hit is visible as a call that never happened. */
function countingFetch(respond: () => Response) {
  const state = { calls: 0 };
  const fetchImpl = (() => {
    state.calls += 1;
    return Promise.resolve(respond());
  }) as unknown as typeof fetch;

  return { state, fetchImpl };
}

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function openAiModel(text: string | null, modelId = 'gpt-6-luna') {
  const { state, fetchImpl } = countingFetch(() =>
    text === null
      ? new Response('upstream exploded', { status: 500 })
      : json({
          id: 'r',
          object: 'response',
          created_at: 1,
          model: modelId,
          status: 'completed',
          output: [
            {
              type: 'message',
              id: 'm',
              role: 'assistant',
              status: 'completed',
              content: [{ type: 'output_text', text, annotations: [] }],
            },
          ],
          usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
        }),
  );

  return {
    state,
    model: createOpenAI({ apiKey: 'test-key', fetch: fetchImpl })(modelId),
  };
}

function anthropicModel(content: unknown[], stopReason: string) {
  const { state, fetchImpl } = countingFetch(() =>
    json({
      id: 'msg',
      type: 'message',
      role: 'assistant',
      model: 'claude-sonnet-4-6',
      content,
      stop_reason: stopReason,
      usage: { input_tokens: 1, output_tokens: 1 },
    }),
  );

  return {
    state,
    model: createAnthropic({ apiKey: 'test-key', fetch: fetchImpl })(
      'claude-sonnet-4-6',
    ),
  };
}

// Structured output is not uniform across providers, and every shape below is
// one a real provider produces. Accepting only the first used to hand the batch
// back to the regex, which is the filter triage replaced.
test('a verdict is read whatever shape the provider answers in', async () => {
  const shapes: [
    string,
    { model: Parameters<typeof createHeritageBidTriage>[0]['model'] },
  ][] = [
    ['OpenAI native structured output', openAiModel('{"keep":[0,2]}')],
    ['OpenAI bare array instead of the schema object', openAiModel('[0, 2]')],
    [
      "Anthropic's JSON tool",
      anthropicModel(
        [{ type: 'tool_use', id: 't', name: 'json', input: { keep: [0, 2] } }],
        'tool_use',
      ),
    ],
    [
      'Anthropic fenced text',
      anthropicModel(
        [{ type: 'text', text: '```json\n{"keep": [0, 2]}\n```' }],
        'end_turn',
      ),
    ],
  ];

  for (const [label, { model }] of shapes) {
    const triage = createHeritageBidTriage({ model });

    assert.deepEqual(await triage(candidates), KEPT, label);
  }
});

test('prose carrying stray numbers falls back instead of inventing a verdict', async () => {
  // Scraping integers out of "3건 중 1번과 3번" would keep rows 3 and 1, which
  // looks like a verdict and is not one.
  const fallbacks: string[] = [];
  const { model } = openAiModel('3건 중 1번과 3번이 국가유산 업무로 보입니다.');
  const triage = createHeritageBidTriage({
    model,
    onFallback: (reason) => fallbacks.push(reason),
  });

  assert.deepEqual(await triage(candidates), REGEX_FALLBACK);
  assert.equal(fallbacks.length, 1);
});

/** An in-memory stand-in for the application's store. */
function fakeStore(rows = new Map<string, boolean>()) {
  let settled = Promise.resolve();

  const store: HeritageBidVerdictStore = {
    load: (keys) =>
      Promise.resolve(
        new Map(
          keys.flatMap((key) =>
            rows.has(key) ? [[key, rows.get(key)!] as const] : [],
          ),
        ),
      ),
    save: (verdicts) => {
      settled = settled.then(() => {
        for (const [key, verdict] of verdicts) rows.set(key, verdict);
      });

      return settled;
    },
  };

  return { store, rows, drain: () => settled };
}

test('a second run reads yesterday’s verdicts instead of paying again', async () => {
  const { store, rows, drain } = fakeStore();

  const first = openAiModel('{"keep":[0,2]}');
  const stats: unknown[] = [];
  const run = createHeritageBidTriage({
    model: first.model,
    store,
    onCacheStats: (value) => stats.push(value),
  });

  assert.deepEqual(await run(candidates), KEPT);
  await drain();
  assert.equal(first.state.calls, 1);
  assert.equal(rows.size, candidates.length);
  assert.deepEqual(stats, [
    { candidates: 3, fromMemory: 0, fromStore: 0, judged: 3 },
  ]);

  // A fresh instance is a fresh process as far as the in-memory cache goes.
  // The answer must now come from the store, and the model must not be asked —
  // note this one would answer differently if it were.
  const second = openAiModel('{"keep":[1]}');
  const later = createHeritageBidTriage({ model: second.model, store });

  assert.deepEqual(await later(candidates), KEPT);
  assert.equal(second.state.calls, 0);
});

test('a fallback verdict is reused within the run but never persisted', async () => {
  const { store, rows, drain } = fakeStore();
  const broken = openAiModel(null);
  const triage = createHeritageBidTriage({ model: broken.model, store });

  assert.deepEqual(await triage(candidates), REGEX_FALLBACK);
  await drain();
  // Persisting these would fix the regex's own blind spots onto 영양 하담고택
  // and 팔만대장경 for as long as the rows live.
  assert.equal(rows.size, 0);

  const retried = broken.state.calls;
  assert.deepEqual(await triage(candidates), REGEX_FALLBACK);
  assert.equal(broken.state.calls, retried, 'the retry reused memory');
});

test('switching the model retires the stored verdicts rather than reusing them', async () => {
  const { store, rows, drain } = fakeStore();
  const luna = openAiModel('{"keep":[0,2]}', 'gpt-6-luna');

  await createHeritageBidTriage({ model: luna.model, store })(candidates);
  await drain();
  assert.equal(rows.size, 3);

  const terra = openAiModel('{"keep":[0,2]}', 'gpt-6-terra');

  assert.deepEqual(
    await createHeritageBidTriage({ model: terra.model, store })(candidates),
    KEPT,
  );
  await drain();
  assert.equal(terra.state.calls, 1, 'the other model had to be asked');
  assert.equal(rows.size, 6, 'both generations of keys are kept');
});

test('a store that is down lets the run judge normally', async () => {
  const errors: [string, string][] = [];
  const { model, state } = openAiModel('{"keep":[0,2]}');
  const triage = createHeritageBidTriage({
    model,
    store: {
      load: () => Promise.reject(new Error('store is down')),
      save: () => Promise.reject(new Error('store is down')),
    },
    onStoreError: (reason, operation) => errors.push([operation, reason]),
  });

  assert.deepEqual(await triage(candidates), KEPT);
  assert.equal(state.calls, 1);
  await new Promise(setImmediate);
  assert.deepEqual(errors.map(([operation]) => operation).sort(), [
    'load',
    'save',
  ]);
});

test('a partly non-integer index list is refused rather than trimmed', async () => {
  // `[0, "2"]` trimmed to `[0]` keeps row 0 and rejects row 2, which is exactly
  // what a real verdict rejecting row 2 looks like: `usable` is true, so the
  // out-of-range guard stays quiet and the store persists it as the model's.
  for (const body of ['{"keep":[0,"2"]}', '{"keep":["0","2"]}']) {
    const { store, rows, drain } = fakeStore();
    const fallbacks: string[] = [];
    const { model } = openAiModel(body);
    const triage = createHeritageBidTriage({
      model,
      store,
      onFallback: (reason) => fallbacks.push(reason),
    });

    assert.deepEqual(await triage(candidates), REGEX_FALLBACK, body);
    await drain();
    assert.equal(fallbacks.length, 1, body);
    assert.equal(rows.size, 0, `${body} must not be persisted`);
  }
});

test('an empty index list stays a real verdict and is persisted', async () => {
  // A batch of road works has nothing to keep, and that answer is worth saving;
  // it is only indistinguishable from the fallback by what reaches the store.
  const { store, rows, drain } = fakeStore();
  const fallbacks: string[] = [];
  const { model, state } = openAiModel('{"keep":[]}');
  const triage = createHeritageBidTriage({
    model,
    store,
    onFallback: (reason) => fallbacks.push(reason),
  });

  assert.deepEqual(await triage(candidates), [false, false, false]);
  await drain();
  assert.equal(state.calls, 1);
  assert.deepEqual(fallbacks, []);
  assert.equal(rows.size, candidates.length);
});
