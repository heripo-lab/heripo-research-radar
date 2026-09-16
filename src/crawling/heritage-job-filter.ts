/**
 * Deterministic pre-filter for public job-posting APIs.
 *
 * Both sources return every public-sector vacancy in the country — roughly
 * 1,300 postings per fortnight from 나라일터 alone — so the newsletter pipeline
 * must not see them all. Scoring is an LLM call per article, and asking it to
 * reject thousands of unrelated postings would be slow, expensive, and noisy.
 *
 * This cuts by rule first, and deliberately errs toward keeping things: a
 * posting survives if its institution is a heritage body **or** its title names
 * a heritage job. The remaining judgement — a heritage institution hiring for a
 * non-heritage role, or a borderline field — is left to the importance prompt,
 * which reads the full posting.
 */

/** Institutions whose name alone settles the domain. */
const HERITAGE_INSTITUTION =
  /국가유산청|국립문화유산연구원|국립해양유산연구소|한국전통문화대학교|국가유산진흥원|국립고궁박물관|궁능유적본부|국립[가-힣]*박물관|[가-힣]{2,}시립박물관|[가-힣]{2,}군립박물관|역사박물관|민속박물관|문화유산|국가유산|문화재단|[가-힣]{2,}유적|[가-힣]{2,}유물|고고|발굴/;

/** Job titles that settle the domain regardless of the institution. */
const HERITAGE_JOB =
  /학예|고고|발굴|매장유산|보존처리|보존과학|문화재|국가유산|문화유산|유물|고건축|전통건축|수리기술|전통문화|무형유산|천연기념물|전시기획|큐레이터|학예연구/;

/**
 * Roles excluded even at a heritage institution.
 *
 * A museum hiring a cleaner or a security guard is not heritage news. This is
 * the same distinction the importance prompt makes, applied here so the obvious
 * cases never cost an LLM call.
 */
const NON_HERITAGE_ROLE =
  /미화|청소|방호|경비|청원경찰|조리|취사|영양사|시설관리|시설물|기계설비|전기설비|조경|운전|당직|소방|보건|간호|집배|매점|카페|주차|경리|경호/;

/** NCS job categories that can plausibly carry heritage work (재정경제부 API). */
export const HERITAGE_NCS_CODES: readonly string[] = [
  'R600004', // 교육.자연.사회과학 — 고고학·역사학 연구직
  'R600008', // 문화.예술.디자인.방송 — 학예·전시
  'R600022', // 인쇄.목재.가구.공예 — 보존처리·전통공예
  'R600025', // 연구
];

export type HeritageJobCandidate = {
  /** Hiring institution. */
  institution: string;
  /** Posting title. */
  title: string;
  /**
   * NCS job categories, when the source publishes them.
   *
   * These **narrow** the match, never widen it. Categories like 연구 and
   * 교육.자연.사회과학 cover every research body in the country, so treating a
   * category as evidence of heritage work lets 한국에너지공단 and
   * 한국환경연구원 through. A posting must still be recognised by its
   * institution or its title; the categories only rule out a name that matched
   * for unrelated work.
   */
  categoryCodes?: readonly string[];
};

/**
 * Whether a posting should reach the analysis stage.
 *
 * @returns true when the posting looks heritage-related and is not one of the
 *   excluded support roles
 */
export function isHeritageJobCandidate({
  institution,
  title,
  categoryCodes = [],
}: HeritageJobCandidate): boolean {
  if (NON_HERITAGE_ROLE.test(title)) {
    return false;
  }

  const named =
    HERITAGE_INSTITUTION.test(institution) || HERITAGE_JOB.test(title);

  if (!named) {
    return false;
  }

  if (categoryCodes.length === 0) {
    return true;
  }

  return categoryCodes.some((code) => HERITAGE_NCS_CODES.includes(code));
}
