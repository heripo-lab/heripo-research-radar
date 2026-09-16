import type {
  GenerateNewsletterPromptContext,
  PromptBuilder,
} from '@llm-newsletter-kit/core';

/**
 * Category order. Categories listed here are emitted first, in this order;
 * anything else follows, ordered by how consequential it is.
 */
const LEADING_CATEGORIES = [
  '학술대회·학술행사',
  '발굴조사보고서',
  '발굴현장 공개',
  '채용',
] as const;

/**
 * Per-category table columns.
 *
 * Source pages carry far more fields than a newsletter table can hold — an
 * excavation report listing alone exposes a dozen (허가번호, 조사면적, 조사기간,
 * 주소 …) — and core's default prompt asked for a generic four-column layout
 * that overflows at email width. Naming the columns per category keeps the
 * tables narrow and stops the model from inventing extra ones.
 */
const TABLE_SPECS = `### 표 형식 (구조적 목록)

발굴조사보고서, 발굴현장 공개, 채용처럼 같은 형태가 반복되는 항목은 표로 낸다.
열은 아래에 지정된 것만 쓴다. **원문에 다른 필드가 있어도 열을 추가하지 않는다.**

- **발굴조사보고서**: \`유적 | 소재지 | 성격·시대\`
  - 유적: 보고서명을 [원제목](URL) 링크로
  - 소재지: 시도 + 시군구까지만 (예: 경남 합천군). 상세 주소·지번은 쓰지 않는다
  - 성격·시대: 유적성격/시대구분 (예: 생활유적, 조선시대)
  - 허가번호, 조사면적, 조사기간, 제출일, 도로명·지번 주소는 **싣지 않는다**
- **발굴현장 공개**: \`유적 | 소재지 | 공개일시\`
- **채용**: \`기관 | 직종 | 접수 마감\`

공통 규칙:
- 항목을 묶거나 "외 n건" 같은 표현으로 줄이지 않는다. 길어도 한 항목당 한 행으로 전부 싣는다.
- 원문에 값이 없는 칸은 "—"로 채운다. 열 자체를 빼지 않는다.
- 표 대신 글머리 기호나 번호 목록을 쓰지 않는다.`;

const EDITORIAL_RULES = `## 편집 규칙

- **중요도 표시를 출력하지 않는다.** 별(★), 점수, "매우 중요" 같은 등급 표기를 본문 어디에도 쓰지 않는다. 중요도는 순서와 분량으로만 드러낸다.
- **제목에 이모지를 쓰지 않는다.**
- 통계·비중 분석을 만들어내지 않는다. "오늘 소식의 00%가 ~" 같은 문장은 쓰지 않는다.
- 소식을 언급할 때마다 [원제목](URL) 형식으로 링크한다. "자세히 보기", "기사", "[3번 글]" 같은 표기는 쓰지 않는다.
- 날짜 범위는 물결표(~)가 아니라 붙임표(-)로 쓴다. 물결표는 마크다운에서 취소선이 된다.`;

const LENGTH_CONTROL = `## 분량 (중요도 점수 기준, 점수 자체는 출력하지 않는다)

- **9-10점**: 핵심 사실을 **굵게** + 링크. 대상·범위, 일정·절차, 예산·규모를 필요한 만큼 풀어쓴다.
- **6-8점**: **최대 3문장.** 핵심 사실 한 문장(굵게 + 링크) + 필요하면 마감·예산 같은 결정적 정보 한두 문장. 하위 항목이나 글머리 목록을 만들지 않는다.
- **1-5점**: **한 문장.** 핵심 사실 + 링크. 여러 건은 한 목록으로 묶어도 된다.

구조적 목록(표)은 이 분량 제한과 무관하게 모든 항목을 싣는다.`;

const FACT_RULES = `## 사실성

- 제공된 자료에 명시된 내용만 쓴다. 추론이나 추측으로 확장하지 않는다.
- "~로 보인다", "~할 전망이다" 같은 추측 표현을 쓰지 않는다.
- 자료에 없는 기관·정책·계획을 사실처럼 쓰지 않는다.
- 이미지 분석 결과는 기사의 시각적 맥락을 파악하는 용도로만 쓴다. 거기 담긴 이름·수치·세부 사실을 본문에 인용하지 않는다.
- 원문 표현을 그대로 옮기지 않는다. 사실만 추출해 새 문장으로 쓴다.`;

function temporalRule(publicationDate: string): string {
  return `## 시간 유효성 (HARD RULE)

발행일은 ${publicationDate}이다. 모든 기사에 대해:

- 마감일, 접수 기간, 행사일, 입찰 마감, 채용 기간이 발행일 기준으로 이미 지났다면, 중요도와 무관하게 본문에서 **완전히 제외**한다.
- 예외: 학술 성과(발간된 학술지, 공개된 연구, 종료된 학술대회 자료)는 참조 가치가 있으므로 남긴다.
- 기사 게시일이 발행일보다 30일 이상 앞서면 신선도를 의심하고, 마감이 남은 진행 중 사업처럼 여전히 앞을 내다보는 가치가 있을 때만 싣는다.
- 제외한 기사는 "그 밖에 주목할 만한 소식"이나 표에도 언급하지 않는다.`;
}

function structure(context: GenerateNewsletterPromptContext): string {
  const { freeFormIntro, dateService } = context;
  const displayDate = dateService.getPublicationDisplayDateString();

  const opening = freeFormIntro
    ? `1. **브리핑**: \`## ${displayDate} 브리핑\` 형식의 Heading 2로 시작한다. 분야 이름은 제목에 넣지 않는다.`
    : `1. **머리말**: \`# ${displayDate} 문화유산 소식\` 형식의 Heading 1으로 시작하고, 이어서 브리핑 문단을 쓴다.`;

  return `## 구성

${opening}

   브리핑은 **3-4문장, 짧고 강하게** 쓴다. 오늘 가장 무게 있는 소식 한두 건을 이름을 들어 짚고, 독자가 왜 지금 이것을 봐야 하는지 한 문장으로 말한다.
   통계, 비중, 항목 수 세기는 쓰지 않는다. 글머리 목록도 만들지 않는다.

2. **분류**: 아래 순서를 지킨다. 해당 소식이 없는 분류는 건너뛴다.

${LEADING_CATEGORIES.map((c, i) => `   ${i + 1}) ${c}`).join('\n')}
   ${LEADING_CATEGORIES.length + 1}) 그 외 (정책·제도, 지정·보존, 전시·행사, 입찰·공고 등 내용에 맞게 묶는다)

   각 분류는 Heading 2(\`##\`)를 쓴다. 분류 안에서는 중요한 것부터 배치한다.
   같은 내용이 여러 출처에서 왔다면 가장 자세한 것을 기준으로 한 번만 쓴다.

3. **맺음말**: 오늘 다룬 핵심을 짧게 정리하고, 임박한 마감이나 진행 중인 일정을 객관적으로 짚는다.
   다음 호 예고나 문의처는 쓰지 않는다.`;
}

function titleRules(context: GenerateNewsletterPromptContext): string {
  const { titleContext } = context;

  const common = `- 길이는 20-70자를 지킨다.
- **이모지를 넣지 않는다.**
- "뉴스레터" 같은 일반 명사 대신 구체적인 사실, 수치, 일정을 담는다.
- '발표', '시행', '마감 임박'처럼 중립적이고 객관적인 표현을 쓴다.`;

  if (titleContext) {
    return `## 제목

- **"${titleContext}"가 제목에 반드시 그대로 들어가야 한다.** 오늘 본문의 핵심 맥락과 자연스럽게 결합해 완성된 제목을 만든다.
${common}`;
  }

  return `## 제목

- 오늘 가장 중요한 소식 한두 건의 핵심 사실을 객관적으로 전달한다.
- 가장 중요한 사실을 앞에 둔다.
${common}`;
}

/**
 * Replaces core's default newsletter prompt.
 *
 * Core's default mandates emoticons in the title and section headings, renders
 * importance as star ratings, and asks for share-of-coverage statistics — all of
 * which this newsletter removes. Those instructions cannot be cancelled by
 * appending contradicting rules, so the prompt is written from scratch.
 *
 * It still has to satisfy core's fixed output schema, which drives a full
 * regeneration (capped at 5 attempts) when the model reports a failure:
 * a 20-70 character title, `isWrittenInOutputLanguage`, `copyrightVerified`,
 * `factAccuracy`, and the `titleContext` phrase when one is supplied.
 */
export const generateNewsletterPrompt: PromptBuilder<GenerateNewsletterPromptContext> =
  {
    system: (context) => {
      const {
        newsletterBrandName,
        expertFields,
        outputLanguage,
        dateService,
        subscribePageUrl,
      } = context;

      const subscribeRule = subscribePageUrl
        ? `\n- 본문 중 자연스러운 위치 한 곳에 ${subscribePageUrl} (${newsletterBrandName} 구독) 링크를 넣는다.`
        : '';

      return `당신은 "${newsletterBrandName}"의 뉴스레터 편집자다. 독자는 ${expertFields.join(', ')} 분야의 연구자, 기관 담당자, 현장 전문가다.

바쁜 전문가가 2-3분 안에 핵심을 파악할 수 있도록, 사실 중심으로 간결하게 쓴다. 친근하되 과장하지 않는다.

모든 내용은 ${outputLanguage}로 쓴다.

${structure(context)}

${EDITORIAL_RULES}${subscribeRule}

${LENGTH_CONTROL}

${TABLE_SPECS}

${FACT_RULES}

${temporalRule(dateService.getPublicationDisplayDateString())}

${titleRules(context)}

## 출력 형식

본문은 마크다운으로 쓴다. 제목(#, ##), 굵게(**), 목록(-), 표를 활용한다.
\`isWrittenInOutputLanguage\`, \`copyrightVerified\`, \`factAccuracy\`는 위 규칙을 모두 지켰을 때 true로 보고한다.`;
    },

    user: (context) => {
      const { targetArticles, dateService, expertFields } = context;

      const articles = targetArticles
        .map((article, index) => {
          const tags = [article.tag1, article.tag2, article.tag3]
            .filter(Boolean)
            .join(', ');

          const image = article.imageContextByLlm
            ? `\n**이미지 분석(맥락 파악용, 세부 사실 인용 금지):** ${article.imageContextByLlm}`
            : '';

          const published = article.publishedDate
            ? `\n**게시일:** ${article.publishedDate}`
            : '';

          return `## 소식 ${index + 1}
**제목:** ${article.title}
**URL:** ${article.url}
**중요도:** ${article.importanceScore}/10
**태그:** ${tags}
**구분:** ${article.contentType}${published}${image}
**본문:**
${article.detailContent}`;
        })
        .join('\n\n');

      return `아래는 새로 수집된 ${expertFields.join(', ')} 관련 소식 전체다.

${articles}

---

**발행일:** ${dateService.getPublicationISODateString()} (${dateService.getPublicationDisplayDateString()})

위 소식으로 ${dateService.getPublicationDisplayDateString()} 자 뉴스레터를 작성하라.

먼저 시간 유효성 HARD RULE을 적용해 마감·행사가 지난 소식을 제외하고, 남은 소식을 지정된 분류 순서대로 배치한다.
중요도 점수는 분량을 정하는 데만 쓰고 본문에 출력하지 않는다.`;
    },
  };
