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

/**
 * Google Form where authors of papers outside KCI ask to have them introduced
 * in the journal section. The form is the 한국고고학회 newsletter's, so the
 * notices pointing to it are shown in KRAS mode only.
 */
export const PAPER_SUBMISSION_FORM_URL = 'https://forms.gle/iGHhUH6gpfQ6PzqZ6';

/** Markdown appended to the journal section in KRAS mode. */
export const PAPER_SUBMISSION_NOTICE = `KCI에 등재되지 않은 학위논문이나 KCI 수준에 준하는 학술지 논문도 이 섹션에서 소개합니다. 단독저자·제1저자·교신저자라면 게재 또는 학위 수여 후 6개월 이내에 [신규 논문 소개 신청](${PAPER_SUBMISSION_FORM_URL})으로 알려주세요. 논문 1편당 한 번 신청할 수 있으며, 검토를 거쳐 소개합니다.`;

/** Label of the block that lists submitted papers after the KCI issues. */
export const SUBMITTED_PAPERS_LABEL = '저자 신청 논문';
