import type { PromptProvider } from '@llm-newsletter-kit/core';

import { classifyTagsPrompt } from './classify-tags';

/**
 * Research Radar's LLM prompt overrides.
 *
 * Each builder here **replaces** core's built-in prompt for that stage rather
 * than extending it — a `PromptBuilder` returns the whole prompt string. That is
 * deliberate: core's defaults instruct the model to use emoticons, render
 * importance as star ratings, and add share-of-coverage statistics, all of which
 * this newsletter removes. Appending contradicting rules to those defaults
 * degrades the output, so a replacement is written from scratch instead.
 *
 * **Contract a replacement must still satisfy.** Core's output schema is fixed,
 * and `generateNewsletter` regenerates the whole newsletter whenever the model
 * reports a failure. A replacement prompt has to steer the model toward:
 *
 * - `title`: 20–70 characters
 * - `isWrittenInOutputLanguage`, `copyrightVerified`, `factAccuracy`: true
 * - `titleContext` (KRAS mode): the phrase must appear in the title
 *
 * Core caps that loop at 5 attempts, so a prompt that ignores the contract costs
 * up to 5 full generations on the most expensive model in the pipeline.
 *
 * Tune these against real articles with core's playground
 * (`npm run playground:generate-newsletter` in ../llm-newsletter-kit-core) and
 * diff them against the defaults for free with `playground:verify-prompts`.
 * The playground loads this module from `dist`, so run `npm run build` here
 * after every edit — its source cannot be imported directly across repos
 * because of the `~/*` path alias.
 */
export const researchRadarPromptProvider: PromptProvider = {
  analysis: {
    classifyTags: classifyTagsPrompt,
  },
};

export {
  HERITAGE_DOMAIN_TAGS,
  toHeritageDomainTag,
  type HeritageDomainTag,
} from './classify-tags';
