import type {
  DateService as CoreDateService,
  IsoDateString,
} from '@llm-newsletter-kit/core';

/**
 * Date service implementation
 * - Provides current date and display date strings
 * - Always returns Korea Standard Time (KST, Asia/Seoul) regardless of server timezone
 */
export class DateService implements CoreDateService {
  /**
   * Get current date in ISO format (YYYY-MM-DD)
   * - Always returns date in Korea Standard Time (UTC+9)
   * @returns ISO date string (e.g., "2024-10-15")
   */
  getCurrentISODateString(): IsoDateString {
    // Use Intl.DateTimeFormat to get date in Korea timezone
    // 'en-CA' locale returns YYYY-MM-DD format by default
    const kstDate = new Date().toLocaleDateString('en-CA', {
      timeZone: 'Asia/Seoul',
    });
    return kstDate as IsoDateString;
  }

  /**
   * Get formatted display date string
   * - Always returns date in Korea Standard Time (UTC+9)
   * @returns Korean formatted date (e.g., "2024년 10월 15일")
   */
  getDisplayDateString(): string {
    const formatter = new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    return formatter.format(new Date());
  }
}
