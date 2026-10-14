import {
  type ExtractArticleDeadlinesConfig,
  type ExtractArticleDeadlinesResult,
  extractArticleDeadlines,
} from '@llm-newsletter-kit/core';

import { extractDeadlinesPrompt } from '../prompts/extract-deadlines';

export type ResearchRadarDeadlineExtractionConfig = Omit<
  ExtractArticleDeadlinesConfig,
  'outputLanguage'
> & { outputLanguage?: string };

/** Shared by host-managed backfill and targeted source verification. No DB writes. */
export function extractResearchRadarDeadlines(
  config: ResearchRadarDeadlineExtractionConfig,
): Promise<ExtractArticleDeadlinesResult> {
  return extractArticleDeadlines({
    ...config,
    outputLanguage: config.outputLanguage ?? '한국어',
    promptBuilder: config.promptBuilder ?? extractDeadlinesPrompt,
  });
}
