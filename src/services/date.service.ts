import type {
  DateService as CoreDateService,
  IsoDateString,
} from '@llm-newsletter-kit/core';

/**
 * Date service implementation
 * - Provides newsletter publication date strings (ISO and localized display form)
 * - Always returns Korea Standard Time (KST, Asia/Seoul) regardless of server timezone
 * - Accepts optional publishDate to override "today" (e.g., generating today's run for tomorrow's publication)
 */
export class DateService implements CoreDateService {
  private readonly targetDate: Date;

  /**
   * @param publishDate - Optional ISO date string (YYYY-MM-DD) representing the newsletter
   *                      publication date. If omitted, the current wall-clock time (KST)
   *                      is used. Pass tomorrow's date when building the issue the night before.
   * @throws {Error} If publishDate is not in YYYY-MM-DD format or is not a real calendar date.
   */
  constructor(publishDate?: string) {
    if (publishDate !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(publishDate)) {
        throw new Error(
          `Invalid publishDate format: "${publishDate}". Expected YYYY-MM-DD (e.g., "2025-02-12").`,
        );
      }

      const date = new Date(publishDate + 'T00:00:00+09:00');

      // Round-trip check: format back to YYYY-MM-DD in KST and compare.
      // Catches invalid dates like "2025-02-30" that JS silently normalizes to "2025-03-02".
      const roundTrip = date.toLocaleDateString('en-CA', {
        timeZone: 'Asia/Seoul',
      });

      if (roundTrip !== publishDate) {
        throw new Error(
          `Invalid publishDate: "${publishDate}" is not a real calendar date.`,
        );
      }

      this.targetDate = date;
    } else {
      this.targetDate = new Date();
    }
  }

  /**
   * Get the newsletter publication date in ISO format (YYYY-MM-DD).
   * - Always returns date in Korea Standard Time (UTC+9)
   * @returns ISO date string (e.g., "2024-10-15")
   */
  getPublicationISODateString(): IsoDateString {
    // Use Intl.DateTimeFormat to get date in Korea timezone
    // 'en-CA' locale returns YYYY-MM-DD format by default
    const kstDate = this.targetDate.toLocaleDateString('en-CA', {
      timeZone: 'Asia/Seoul',
    });
    return kstDate as IsoDateString;
  }

  getCurrentISODateString(): IsoDateString {
    return this.getPublicationISODateString();
  }

  /**
   * Get the newsletter publication date as a localized display string.
   * - Always returns date in Korea Standard Time (UTC+9)
   * @returns Korean formatted date (e.g., "2024년 10월 15일")
   */
  getPublicationDisplayDateString(): string {
    const formatter = new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    return formatter.format(this.targetDate);
  }

  getDisplayDateString(): string {
    return this.getPublicationDisplayDateString();
  }
}
