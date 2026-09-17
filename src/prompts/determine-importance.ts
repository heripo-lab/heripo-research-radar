import type {
  DetermineImportancePromptContext,
  PromptBuilder,
} from '@llm-newsletter-kit/core';

/**
 * Resolves the score floor core would apply for this article's board.
 *
 * `minimumImportanceScoreRules` is matched by `targetUrl` and raises the bottom
 * of the scale for boards that only ever carry relevant material. Core's default
 * prompt also drops the "score 1 = no practical value" tier and the temporal
 * expiry rule whenever a floor is in effect, since neither can be expressed
 * below the floor. The replacement below reproduces that.
 */
function resolveMinimumScore({
  targetArticle,
  minimumImportanceScoreRules,
}: DetermineImportancePromptContext): number {
  const rule = minimumImportanceScoreRules.find(
    ({ targetUrl }) => targetUrl === targetArticle.targetUrl,
  );

  return rule?.minScore ?? 1;
}

const DOMAIN_PRIORITY = `## 유산 영역 우선순위

이 뉴스레터는 고고학을 중심에 둔다. 사안의 객관적 무게가 비슷하다면 아래 순서로 점수를 준다.

1. **고고학** — 발굴조사, 매장유산, 유적·유물, 발굴현장 공개, 고고학 학술 활동
2. **문화유산** — 유형유산 지정·보존, 박물관 활동, 유산 정책
3. **자연유산 / 무형유산**

판단이 애매할 때 고고학 기사는 고려 중인 점수대의 위쪽을, 자연유산·무형유산 기사는 아래쪽을 택한다.
영역은 tag1에 표기되어 있다. 단, 영역만으로 점수를 정하지는 않는다 — 사안 자체가 미미한 고고학 기사보다
중대한 문화유산 기사가 높은 점수를 받는 것이 옳다.`;

const SUBJECT_OVER_INSTITUTION = `## 발주·공고 기관이 아니라 사업 내용으로 판단

유산 기관이 낸 공고라도 **내용이 유산 업무가 아니면 낮게 준다.** 기관명은 단서일 뿐 근거가 아니다.

- 유산 업무: 발굴·시굴조사, 매장유산, 문화재 수리·보수정비, 보존처리, 기록화, 유적 정비,
  학술연구, 유물 조사·분석, 전시 기획
- 유산 업무가 아닌 것: 소방·전기·냉난방·창호 같은 건물 설비, 청사 환경개선, 홈페이지·전산,
  차량 임차, 홍보물·영상 제작, 축제·행사 운영과 그 부대 용역
  → 국가유산청·국립박물관이 발주했더라도 **1-3점**

예: "창덕궁 미분무 소화설비 성능개선 공사"는 궁궐 소재지만 소방 설비 공사다.
"○○문화재단 축제 무대시스템 운영"은 기관명에 문화재가 들어갈 뿐 예술·축제 사업이다.
반대로 "팔만대장경 P-XRF 분석"은 발주처가 사찰이어도 명백한 유산 조사다.`;

const EMPLOYMENT_FILTER = `## 채용 공고 판별

채용 공고는 **직무가 아래 지원 직무 목록에 해당하는지**를 먼저 본다.

- **비유산 지원 직무: 조리·급식, 방호·경비, 청소·미화, 시설관리, 운전, 당직 → 점수 1**
  이 목록에 해당하는 직무만 1점이다. 목록에 없는 직무를 유추해서 넣지 않는다.
- **그 밖의 직무는 모두 아래 점수 기준을 정상 적용한다.** 특히 박물관·미술관·연구소가 내는
  공고는 직무명이 학예직이 아니어도 — 행정, 연구, 교육, 전시, 기록물, 일반직 — 유산 분야로 본다.
  기관명에 '문화유산'이나 '역사'가 들어가지 않아도 마찬가지다. 국립농업박물관의 행정직 공고는
  박물관의 일자리이고, 그 자체가 독자에게 실무 정보다.
- 한 공고에 두 분야가 섞여 있으면 유산 분야 직무를 기준으로 평가한다.`;

function scoreScale(minimumScore: number): string {
  const tiers = [
    '10: 분야 전체에 즉각적이고 중대한 영향 — 주요 법령 통과, 대규모 예산 배정, 학계를 바꾸는 발견',
    '8-9: 다수 이해관계자에게 중요한 영향 — 주요 정책 변화, 중요 성과 공개, 대형 사업 발표',
    '7-8: 특정 분야의 중요한 학술·실무 성과 — 학술지 발간, 연구 성과 발표, 보고서 간행, 주요 학술행사, 중요 자원 지정, 중규모 입찰',
    '5-6: 특정 분야·지역에 한정된 일반적 중요 정보 — 소규모 사업 허가, 일반 행사 공지, 소규모 입찰',
    '4-5: 일반적인 분야 소식, 중소 규모 행사',
    '2-3: 단순 정보 공유, 반복적인 일상 소식',
  ];

  if (minimumScore === 1) {
    tiers.push(
      '1: **현재 실무 가치가 없는 정보** — 종료된 지원사업, 지난 행사, 만료된 입찰·채용 공고, 회비 납부 현황·회의록·내부 일정 같은 단순 행정 공지, 그리고 위 채용 판별에서 걸러진 비유산 지원 직무 채용',
    );
  }

  return `## 점수 기준 (${minimumScore}-10)\n\n${tiers.join('\n')}`;
}

const EVALUATION_AXES = `## 평가 축

- **학술 가치**: 학술지 발간, 연구보고서, 학술대회·심포지엄, 연구 성과 발표는 최소 7점 (지식 기반 확장과 장기 참조 가치)
- **실무 영향**: 정책, 규정, 입찰, 채용처럼 즉각 대응이 필요한 정보
- **영향 범위**: 영향받는 이해관계자의 수
- **희소성**: 정보의 희귀성과 독점성`;

function temporalRule(minimumScore: number): string {
  if (minimumScore > 1) {
    return '';
  }

  return `
## 시간 유효성 (HARD RULE)

- 기사에 적힌 마감일, 접수 기간, 행사일, 입찰 마감, 채용 기간, 유효 기간을 뉴스레터 발행일과 비교한다.
- 이미 지났다면 다른 기준과 무관하게 **1점**. 이 규칙이 다른 모든 고려사항에 우선한다.
- 이 규칙은 **독자가 기한 안에 행동해야 하는 안내**에만 적용한다. 신청·접수·응모·입찰·참가 모집이 그렇다.
- 예외 ①: 학술 성과(발간된 학술지, 공개된 연구, 종료된 학술대회 자료)는 참조 가치로 평가하며 깎지 않는다.
- 예외 ②: **이미 일어난 일을 전하는 보도·발표 기사**는 깎지 않는다. 지정·선정 결과, 조사 성과, 협약·기증·개최 소식처럼
  독자가 알아두면 되는 내용이면 행사일이 지났더라도 사안의 무게대로 평가한다.
  (판단 기준: 기사가 독자에게 무엇을 하라고 요구하는가? 아무 행동도 요구하지 않는다면 이 규칙의 대상이 아니다.)
- 예외 ③: **발굴조사·시굴조사·매장유산 조사 입찰 공고**는 입찰 마감이 지났어도 깎지 않는다.
  독자는 입찰에 참여하려고 이 소식을 보는 것이 아니라 **어디서 어떤 조사가 시작되는지** 알려고 본다.
  "○○ 유적 정밀발굴조사 용역 발주"는 그 자체로 고고학계 소식이다.
  이런 공고는 수의계약으로 나와 마감이 공고 다음 날인 경우가 많아, 마감으로 거르면 정작 알려야 할 조사가 사라진다.
  문화재 수리·보수정비·보존처리 발주도 같게 본다. 다만 입찰 참여 조건이나 마감을 강조해 쓰지는 않는다.
- 마감·일정 언급이 전혀 없으면 이 규칙은 적용하지 않는다.
`;
}

/**
 * Replaces core's default importance prompt.
 *
 * Adds the archaeology-first weighting and the non-heritage employment filter,
 * and drops core's star-rating vocabulary, which the newsletter no longer
 * renders. The hard ceiling on natural and intangible heritage is **not** here:
 * it is applied deterministically after scoring, in `AnalysisProvider.update()`,
 * so the two never disagree.
 */
export const determineImportancePrompt: PromptBuilder<DetermineImportancePromptContext> =
  {
    system: (context) => {
      const minimumScore = resolveMinimumScore(context);

      return `당신은 한국 문화유산 분야의 중요도 평가 전문가다. 기사의 제목과 본문을 분석해 중요도를 점수로 매긴다.

주 독자는 연구기관 연구원, 지자체·공공기관 담당자, 대학원생, 현장 전문가다. 긴급성·영향력·희소성을 기준으로 평가한다.

${DOMAIN_PRIORITY}

${SUBJECT_OVER_INSTITUTION}

${EMPLOYMENT_FILTER}

${scoreScale(minimumScore)}

${EVALUATION_AXES}
${temporalRule(minimumScore)}`;
    },

    user: (context) => {
      const minimumScore = resolveMinimumScore(context);
      const { targetArticle, dateService } = context;

      const publishedDate = targetArticle.publishedDate
        ? `\n**기사 게시일:** ${targetArticle.publishedDate}`
        : '';

      const imageContext = targetArticle.imageContextByLlm
        ? `\n\n**이미지 분석:** ${targetArticle.imageContextByLlm}`
        : '';

      const temporalCheck =
        minimumScore > 1
          ? ''
          : '\n\n점수를 매기기 전에, 이 기사가 독자에게 기한 안에 행동할 것을 요구하는지 확인하라. 요구한다면 그 기한이 위 발행일 기준으로 지났는지 보고, 지났다면 1점이다. 이미 일어난 일을 전하는 보도라면 이 규칙을 적용하지 않는다.';

      return `아래 기사의 중요도를 ${minimumScore}부터 10까지로 평가하라.

**뉴스레터 발행일:** ${dateService.getPublicationISODateString()}${publishedDate}

**제목:** ${targetArticle.title || '제목 없음'}

**유산 영역(tag1):** ${targetArticle.tag1 || '미분류'}
**주제 태그:** ${[targetArticle.tag2, targetArticle.tag3].filter(Boolean).join(', ') || '없음'}

**본문:**
${targetArticle.detailContent || '내용 없음'}${imageContext}${temporalCheck}`;
    },
  };
