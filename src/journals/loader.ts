import type { JournalIssue, JournalIssueSource } from '../types/dependencies';

/** Memoized access to one run's injected journal issues. */
export type JournalIssueLoader = () => Promise<JournalIssue[]>;

/**
 * Shares one call of the application's source between the crawl, which turns
 * issues into articles, and generation, which renders them as tables.
 *
 * A rejected call is forgotten, so a failure while crawling does not decide
 * what generation sees: the next caller asks the source again.
 */
export function createJournalIssueLoader(
  source: JournalIssueSource,
): JournalIssueLoader {
  let pending: Promise<JournalIssue[]> | null = null;

  return () =>
    (pending ??= source().catch((error: unknown) => {
      pending = null;
      throw error;
    }));
}
