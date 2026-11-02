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
 * Marks the instruction block so Anthropic caches it, and reports what hit.
 *
 * Both halves of this exist because the two providers cache on opposite
 * defaults. The prompts are already shaped for it — core sends each stage's
 * long instruction as `instructions`, which the AI SDK turns into a system
 * message ahead of the article — so OpenAI's automatic prefix cache has been
 * hitting that block all along at no cost to us. Anthropic caches **nothing**
 * without an explicit `cache_control` breakpoint, so the same prompt that is
 * free to repeat on GPT is billed in full on Claude, every article.
 *
 * The breakpoint goes on the last system message rather than anywhere later:
 * Anthropic caches the prefix up to and including the marked block, so marking
 * the user turn would cache the article too and never hit twice.
 *
 * Wrapping is unconditional on purpose. `providerOptions` is namespaced, so
 * OpenAI and Google ignore the Anthropic key, and an application that injects
 * its own `LanguageModel` into any slot gets the same treatment without having
 * to know which provider this package expected. Anthropic will not cache a
 * block below its own minimum (1,024 tokens, 2,048 on the small models) and
 * says so by simply not reporting a cache write — it is not an error, so no
 * length check is made here. In practice the scoring and generation prompts
 * clear it comfortably and the 나라장터 triage prompt does not.
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
      transformParams: ({ params }) => {
        let lastSystemIndex = -1;

        params.prompt.forEach((message, index) => {
          if (message.role === 'system') {
            lastSystemIndex = index;
          }
        });

        if (lastSystemIndex === -1) {
          return Promise.resolve(params);
        }

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
                },
              }
            : message,
        );

        return Promise.resolve({ ...params, prompt });
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
