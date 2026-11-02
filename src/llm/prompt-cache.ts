import { type LanguageModel, wrapLanguageModel } from 'ai';

/**
 * What one call read from, or wrote to, the provider's prompt cache.
 *
 * The figures come from the AI SDK's provider-neutral usage, so an OpenAI
 * cached prefix and an Anthropic cache hit are reported the same way.
 */
export type PromptCacheUsage = {
  provider: string;
  modelId: string;
  /** Prompt tokens served from the cache. */
  cacheRead: number;
  /** Prompt tokens written into the cache. */
  cacheWrite: number;
  /** Prompt tokens billed at the full rate. */
  noCache: number;
};

export type PromptCachingOptions = {
  /** Reports each call's cache figures; without it nothing proves the cache works. */
  onUsage?: (usage: PromptCacheUsage) => void;
};

const EPHEMERAL = { type: 'ephemeral' } as const;

/**
 * Serves as both the cache mode and the breakpoint marker.
 *
 * `explicit` is the only value `prompt_cache_breakpoint` accepts, and it is
 * also the `prompt_cache_options` mode that makes OpenAI honour the marker
 * instead of placing its own.
 */
const OPENAI_EXPLICIT = { mode: 'explicit' } as const;

/**
 * Whether this model takes developer-placed cache breakpoints.
 *
 * GPT-5.6 introduced `prompt_cache_options` and `prompt_cache_breakpoint`;
 * models before it reject both and keep their own automatic caching, so the
 * gate is a version comparison rather than an allow-list of model names that
 * would need editing on every release.
 */
export const supportsOpenAICacheBreakpoints = (modelId: string): boolean => {
  const version = /^(?:openai\/)?gpt-(\d+)(?:\.(\d+))?(?:-.+)?$/u.exec(modelId);

  if (!version) {
    return false;
  }

  const major = Number(version[1]);
  const minor = Number(version[2] ?? 0);

  return major > 5 || (major === 5 && minor >= 6);
};

/**
 * Puts both providers' cache breakpoints on the instruction block, and reports
 * what hit.
 *
 * All of this exists because the two providers cache on opposite defaults, and
 * the prompts are already shaped for it — core sends each stage's long
 * instruction as `instructions`, which the AI SDK turns into a system message
 * ahead of the article.
 *
 * **Anthropic caches nothing** without an explicit `cache_control` breakpoint,
 * so the same prompt that repeats cheaply on GPT was billed in full on Claude,
 * every article.
 *
 * **OpenAI caches the wrong thing.** GPT-5.6 and later default to implicit
 * mode, which puts the breakpoint at the end of the latest eligible message —
 * here the article. Writes cost 1.25× the uncached input rate, and the article
 * differs on every call, so that write is paid for and never read back. Asking
 * for explicit mode moves the breakpoint to the instruction block, which is
 * the part that actually repeats. `prompt_cache_key` is deliberately not set:
 * OpenAI routes GPT-5.6+ automatically, and a constant key would work against
 * us anyway, since triage alone sends 22 requests at once against a guideline
 * of roughly 15 per minute per key.
 *
 * The breakpoint goes on the last system message for both providers rather
 * than anywhere later: the prefix up to and including the marked block is what
 * gets cached, so marking the user turn would cache the article too and never
 * hit twice.
 *
 * Wrapping is unconditional on purpose. `providerOptions` is namespaced, so
 * each provider ignores the other's key, and an application that injects its
 * own `LanguageModel` into any slot gets the same treatment without having to
 * know which provider this package expected. A caller that has already chosen
 * `promptCacheOptions` keeps its own choice.
 *
 * Anthropic will not cache a block below a minimum length, and that minimum is
 * **per model** — published figures differ by several times between the small
 * and large models, so do not hard-code one here or reason from a remembered
 * number. A block under it is processed without caching rather than rejected,
 * which is why no length check is made: a breakpoint that cannot fire costs
 * nothing, and a length check against the wrong number would disable one that
 * could. The rendered scoring prompt is around 5,200 characters and the
 * 나라장터 triage prompt is 832; whether either clears the configured model's
 * minimum is answered by `cacheWrite` in the reported usage, not by this
 * comment.
 */
export const withPromptCaching = (
  model: LanguageModel,
  { onUsage }: PromptCachingOptions = {},
): LanguageModel => {
  if (typeof model === 'string') {
    // A bare model id carries no provider configuration to wrap; the caller
    // resolves it against a provider first.
    return model;
  }

  return wrapLanguageModel({
    model,
    middleware: {
      transformParams: ({ params, model: wrapped }) => {
        let lastSystemIndex = -1;

        params.prompt.forEach((message, index) => {
          if (message.role === 'system') {
            lastSystemIndex = index;
          }
        });

        if (lastSystemIndex === -1) {
          return Promise.resolve(params);
        }

        // Older OpenAI models reject these fields outright, and a caller that
        // set a mode of its own has already decided this question.
        const markForOpenAI =
          supportsOpenAICacheBreakpoints(wrapped.modelId) &&
          params.providerOptions?.openai?.promptCacheOptions === undefined;

        const prompt = params.prompt.map((message, index) =>
          index === lastSystemIndex
            ? {
                ...message,
                providerOptions: {
                  ...message.providerOptions,
                  anthropic: {
                    ...message.providerOptions?.anthropic,
                    cacheControl: EPHEMERAL,
                  },
                  ...(markForOpenAI && {
                    openai: {
                      ...message.providerOptions?.openai,
                      promptCacheBreakpoint: OPENAI_EXPLICIT,
                    },
                  }),
                },
              }
            : message,
        );

        return Promise.resolve({
          ...params,
          prompt,
          // Without the mode, OpenAI keeps placing its own breakpoint after
          // the article in addition to honouring the one above.
          ...(markForOpenAI && {
            providerOptions: {
              ...params.providerOptions,
              openai: {
                ...params.providerOptions?.openai,
                promptCacheOptions: OPENAI_EXPLICIT,
              },
            },
          }),
        });
      },

      wrapGenerate: async ({ doGenerate, model: wrapped }) => {
        const result = await doGenerate();

        const { cacheRead, cacheWrite, noCache } = result.usage.inputTokens;

        onUsage?.({
          provider: wrapped.provider,
          modelId: wrapped.modelId,
          cacheRead: cacheRead ?? 0,
          cacheWrite: cacheWrite ?? 0,
          noCache: noCache ?? 0,
        });

        return result;
      },
    },
  });
};
