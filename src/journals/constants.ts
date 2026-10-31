// Kept free of imports: the prompt reads these, and the section reads the
// prompt's category order.

/**
 * Heading of the journal issue section. It names papers rather than journals
 * so papers from other sources can join it later, and it stays distinct from
 * any heading the model writes.
 */
export const JOURNAL_ISSUE_SECTION_HEADING = '📖 새로 나온 논문';

/**
 * `contentType` of a journal issue article the section renders itself.
 *
 * The article still goes to the generation model, like any other candidate, so
 * a new issue can lead the title and briefing on the same terms as other news.
 * The marker tells the prompt not to write it into a body section; the table
 * is rendered from the injected data instead.
 */
export const JOURNAL_ISSUE_CONTENT_TYPE = `자동 섹션: ${JOURNAL_ISSUE_SECTION_HEADING}`;
