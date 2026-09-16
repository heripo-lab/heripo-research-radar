import type {
  ClassifyTagsPromptContext,
  PromptBuilder,
} from '@llm-newsletter-kit/core';

/**
 * Fixed vocabulary for `tag1`, the heritage domain of an article.
 *
 * Downstream scoring depends on this being a closed set: importance weighting
 * ranks archaeology first and cultural heritage second, and natural/intangible
 * heritage are capped. A free-form tag cannot drive either rule reliably, so
 * `tag1` is constrained here while `tag2`/`tag3` stay open.
 *
 * `기타` exists so that non-heritage material — catering or security job
 * postings, general administration — is labelled honestly instead of being
 * forced into a heritage domain it does not belong to.
 */
export const HERITAGE_DOMAIN_TAGS = [
  '고고학',
  '문화유산',
  '자연유산',
  '무형유산',
  '기타',
] as const;

export type HeritageDomainTag = (typeof HERITAGE_DOMAIN_TAGS)[number];

/** Narrows an arbitrary tag value to the fixed vocabulary. */
export function toHeritageDomainTag(
  tag: string | null | undefined,
): HeritageDomainTag | null {
  const normalized = tag?.trim();

  return HERITAGE_DOMAIN_TAGS.includes(normalized as HeritageDomainTag)
    ? (normalized as HeritageDomainTag)
    : null;
}

const DOMAIN_RULES = `## tag1 — 유산 영역 (고정 어휘, 아래 5개 중 정확히 하나)

- **고고학**: 발굴조사, 매장유산, 유적·유물 조사, 발굴현장 공개, 발굴조사보고서, 고고학 학술대회·학회 소식
- **문화유산**: 건조물·미술·기록 등 유형유산, 국보·보물 지정과 보존처리, 박물관 전시·소장품, 유산 정책·제도
- **자연유산**: 천연기념물, 명승, 지질유산, 유산으로서의 동식물
- **무형유산**: 전통 기예·의례·공연, 보유자·전승자, 전승 교육
- **기타**: 위 넷 중 어디에도 해당하지 않는 내용. 유산과 무관한 채용(조리·방호·시설관리 등), 일반 행정·회계 공고가 여기 해당한다.

여러 영역에 걸치면 **고고학 > 문화유산 > 자연유산 > 무형유산** 순으로 앞선 것을 고른다.
예: 매장유산 발굴 성과를 다루는 국립박물관 전시 기사는 \`고고학\`.

tag1은 반드시 이 5개 문자열 중 하나여야 한다. 변형·수식·조합은 허용하지 않는다.`;

/**
 * Replaces core's default tag prompt.
 *
 * Core's default asks for three free-form tags. This version pins `tag1` to the
 * heritage domain vocabulary and keeps the default's reuse behaviour for the
 * remaining two, so the existing tag pool stays consistent.
 */
export const classifyTagsPrompt: PromptBuilder<ClassifyTagsPromptContext> = {
  system: ({ outputLanguage }) =>
    `당신은 한국 문화유산 분야 기사를 분류하는 전문가다. 기사마다 태그 3개를 매긴다.

${DOMAIN_RULES}

## tag2, tag3 — 주제 태그 (자유 어휘)

- 기사의 구체적인 주제를 나타낸다. 예: 발굴현장공개, 학술대회, 채용, 보존처리, 특별전
- 제공된 기존 태그 목록과 80% 이상 들어맞으면 그 태그를 그대로 재사용한다. 분류 체계가 흩어지지 않게 하는 것이 새 태그를 만드는 것보다 중요하다.
- 80%에 못 미칠 때만 새로 만든다. 새 태그는 비슷한 기사 여러 건에 두루 쓰일 수 있어야 한다.
- 길이 3~15자, ${outputLanguage}로 작성한다.
- tag1의 5개 어휘(고고학, 문화유산, 자연유산, 무형유산, 기타)는 너무 포괄적이므로 tag2, tag3에 쓰지 않는다.
- tag2와 tag3은 서로 달라야 한다.`,

  user: ({ targetArticle, existTags }) =>
    `아래 기사를 분류하라.

## 기사

- 제목: ${targetArticle.title}
- 본문:
${targetArticle.detailContent}

## 기존 태그 목록 (tag2, tag3 재사용 후보)

\`\`\`json
${JSON.stringify(existTags, null, 2)}
\`\`\`

## 출력

- tag1: 유산 영역. 고고학, 문화유산, 자연유산, 무형유산, 기타 중 정확히 하나.
- tag2: 주제 태그.
- tag3: 주제 태그. tag2와 다른 것.`,
};
