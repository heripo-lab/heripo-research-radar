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

/**
 * Heritage subjects as they appear in a 나라장터 notice title.
 *
 * Wider than {@link HERITAGE_JOB} because a bid names the work rather than a
 * role: 발굴조사, 보수정비, 기록화 and so on.
 */
const HERITAGE_BID_SUBJECT =
  /발굴조사|시굴조사|표본조사|입회조사|지표조사|매장유산|매장문화재|고분군|폐사지|문화재\s*수리|국가유산\s*수리|보존처리|보존과학|학예|고고|고건축|단청|석조문화재|목조문화재|전통건축|유적\s*정비|유물|기록화/;

/**
 * Work excluded from a 나라장터 notice regardless of who issued it.
 *
 * 나라장터 carries every public procurement notice in the country, and heritage
 * vocabulary collides badly with civil engineering and event support: 급경사지
 * 정밀조사 is landslide risk, not archaeology, and a museum's 건설폐기물 처리 or
 * a 문화재단's 축제 셔틀버스 is not heritage work either. These are the cases
 * that need no judgement — anything arguable is left to the importance prompt.
 *
 * A word whose meaning turns on how it is used does not belong here, because
 * this check runs before every inclusion signal and cannot be argued back.
 * `드론` is narrowed to `드론쇼` for that reason: 국가유산 방재드론 스테이션 운영
 * is heritage disaster response. Dropped outright for the same reason:
 * `재선충` (남양주 홍릉과 유릉 소나무재선충병 긴급 예방사업 is care of a
 * 조선왕릉's historic landscape), `산불` (안동 산불피해 국가유산 복원(안동
 * 국탄댁), 청송 만세루 산불피해 복원사업, and 국가유산 재난방지시설
 * 구축(산불소화시설) are all heritage restoration or disaster prevention),
 * `숲가꾸기` (the same 역사경관림 care as 재선충), and `소독`/`방역` (의림지
 * 역사박물관 수장고 및 유물 소독 is collection conservation). All of them now
 * reach the importance prompt, which reads the whole notice.
 *
 * Dropping them does not widen intake on its own: this list only decides notices
 * that already carry an inclusion signal, and the 산불·숲가꾸기 forestry notices
 * it used to catch carry none — over a two-week sample of 10,199 notices it
 * admitted no new ones. What it changes is that those titles can now be argued
 * for at all: 의림지 역사박물관 수장고 및 유물 소독 passes on `유물`, and
 * 국가유산 재난방지시설 구축(산불소화시설) passes when 국가유산청 issues it.
 * Where the issuer is a 지자체 and the title carries no subject term — 안동
 * 산불피해 국가유산 복원(안동 국탄댁) — the notice still fails, on the
 * inclusion side rather than here.
 */
const NON_HERITAGE_BID =
  /급경사지|사방댐|관정|제설|건설폐기물|생활폐기물|폐아스콘|석면|청소|경비|방호|급식|조리|셔틀|현수막|드론쇼|키오스크|주차/;

/**
 * 나라장터 procurement classifications that settle the domain on their own.
 *
 * The taxonomy carries one heritage category, and it catches notices no
 * vocabulary would: 팔만대장경 P-XRF 분석, issued by 해인사 장경도량, matches
 * neither the institution nor the title patterns. It is only a supplement —
 * 공사 notices carry no classification at all, so it cannot replace them.
 */
const HERITAGE_PROCUREMENT_CLASSIFICATIONS = ['문화재 조사/발굴 및 수리'];

export type HeritageBidCandidate = {
  /** Issuing and requesting institutions, joined. */
  institution: string;
  /** Notice title. */
  title: string;
  /** `pubPrcrmntMidClsfcNm`, when the notice carries one. */
  classification?: string | null;
};

/**
 * Whether a 나라장터 notice should reach the analysis stage.
 *
 * Deliberately loose. Of roughly 1,000 notices a day this keeps about ten, and
 * the remaining judgement — a heritage institution procuring fire alarms, a
 * 문화재단 running a festival — is left to the importance prompt, which reads
 * the whole notice. Tightening it here cost real articles: an earlier attempt
 * to exclude 보수정비 also dropped 영양 하담고택 보수정비사업 and 보길도
 * 윤선도원림 판석보 보수정비공사.
 */
export function isHeritageBidCandidate({
  institution,
  title,
  classification,
}: HeritageBidCandidate): boolean {
  if (NON_HERITAGE_BID.test(title)) {
    return false;
  }

  if (
    classification &&
    HERITAGE_PROCUREMENT_CLASSIFICATIONS.includes(classification.trim())
  ) {
    return true;
  }

  return (
    HERITAGE_INSTITUTION.test(institution) || HERITAGE_BID_SUBJECT.test(title)
  );
}
