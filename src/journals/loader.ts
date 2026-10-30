import type { JournalIssue, JournalIssueSource } from '../types/dependencies';

/** Memoized access to one run's injected journal issues. */
export type JournalIssueLoader = () => Promise<JournalIssue[]>;

/**
 * Shares one call of the application's source between the crawl, which turns
 * issues into articles, and generation, which renders them as tables.
 *
 * A rejected call is forgotten, so a failure while crawling does not decide
 * what generation sees: the next caller asks the source again. A call that
 * does not settle within `timeoutMs` is rejected and forgotten the same way,
 * so a stalled source cannot hold generation, which has no request timeout of
 * its own.
 *
 * @param timeoutMs - Milliseconds before a source call is given up
 */
export function createJournalIssueLoader(
  source: JournalIssueSource,
  timeoutMs = 60_000,
): JournalIssueLoader {
  let pending: Promise<JournalIssue[]> | null = null;

  return () => {
    if (pending) return pending;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const call: Promise<JournalIssue[]> = Promise.race([
      source(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(`journal issue source timed out after ${timeoutMs}ms`),
            ),
          timeoutMs,
        );
      }),
    ])
      .catch((error: unknown) => {
        if (pending === call) pending = null;
        throw error;
      })
      .finally(() => clearTimeout(timer));
    pending = call;
    return call;
  };
}
