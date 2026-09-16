# 헤리포 리서치 레이더 (heripo Research Radar)

[English](./README.md) | 한국어

[![CI](https://github.com/heripo-lab/heripo-research-radar/actions/workflows/ci.yml/badge.svg)](https://github.com/heripo-lab/heripo-research-radar/actions/workflows/ci.yml)
[
![npm version](https://img.shields.io/npm/v/%40heripo%2Fresearch-radar?logo=npm&color=cb0000)
](https://www.npmjs.com/package/@heripo/research-radar)
![license](https://img.shields.io/github/license/heripo-lab/heripo-research-radar)
![node](https://img.shields.io/badge/node-%3E%3D24-brightgreen)

[행동 강령](./CODE_OF_CONDUCT.md) • [보안 정책](./SECURITY.md) • [기여 가이드](./CONTRIBUTING.md)

## 이게 뭔가요?

한국 문화유산 분야를 위한 AI 기반 뉴스레터 서비스입니다. [`@llm-newsletter-kit/core`](https://github.com/heripo-lab/llm-newsletter-kit-core)를 기반으로 만들어진 **실제 운영 서비스**([heripo.app](https://heripo.app/research-radar/subscribe))이자, LLM으로 자동화된 뉴스레터를 만드는 방법을 보여주는 **참조 구현**입니다.

이 패키지는 크롤링, 분석, 콘텐츠 생성, 이메일 템플릿을 제공합니다. 운영 서비스의 데이터베이스 저장소, 스케줄링, 구독자 관리, 이메일 발송은 별도로 연동합니다.

기존에 보고된 운영 수치는 발행당 $0.2–1, 클릭률 15%입니다. 현재 모델이나 배포 환경에서 측정한 벤치마크가 아닌 과거 운영 수치입니다.

**기술적 특징**:

- 엄격한 타입 시스템의 TypeScript
- 교체 가능한 Provider 패턴 (Crawling/Analysis/Content/Email)
- 문화유산 기관, 박물관, 학회 등 활성 크롤링 타겟 59개
- 멀티 LLM 프로바이더: OpenAI GPT-5 (분석) + 선택 가능한 콘텐츠 생성 (OpenAI / Anthropic / Google)
- 재시도, 체인 옵션, 미리보기 이메일 내장

**링크**: [라이브 서비스](https://heripo.app/research-radar/subscribe) • [뉴스레터 예시](https://heripo.app/research-radar-newsletter-example.html) • [Core 엔진](https://github.com/heripo-lab/llm-newsletter-kit-core)

## 배경

고고학을 전공한 소프트웨어 엔지니어 김홍연이 "왜 연구에는 이렇게 많은 수작업이 필요할까?"라는 질문에서 출발했습니다.

[대형 언어 모델(LLM)을 활용한 고고학 정보화 연구](https://poc.heripo.org)를 마친 후, 개인용 스크립트를 프로덕션 서비스로 발전시켰습니다. 이 저장소는 실제 운영 중인 서비스를 오픈소스로 공개해 다른 개발자들이 도메인별 뉴스레터를 쉽게 시작할 수 있도록 돕습니다.

## 라이선스

Apache License 2.0 - 자세한 내용은 [LICENSE](./LICENSE)와 [NOTICE](./NOTICE) 파일을 참고하세요.

## 인용 및 저작자 표시 (Citation & Attribution)

이 프로젝트를 포크해서 자신만의 뉴스레터 서비스를 만들거나 연구에 활용하실 때는 다음 문구를 명시해 주세요:

```
Powered by LLM Newsletter Kit
```

뉴스레터 템플릿 푸터나 서비스 문서에 이 문구를 추가해 주시면 프로젝트의 지속적인 개발에 도움이 됩니다.

### BibTeX 인용

학술 논문에서 인용하시는 경우:

```bibtex
@software{heripo research radar,
  author = {Kim, Hongyeon},
  title = {heripo research radar},
  year = {2025},
  url = {https://github.com/heripo-lab/heripo-research-radar},
  note = {Apache License 2.0}
}
```

## 설치

```bash
npm install @heripo/research-radar '@llm-newsletter-kit/core@~3.0.0'
```

**요구사항**: Node.js >= 24와 ESM 애플리케이션. 패키지는 `dist/index.js`, TypeScript 선언 파일(`dist/index.d.ts`), JavaScript 소스맵을 제공합니다. Core 엔진은 peer dependency이며 현재 지원 범위는 `~3.0.0`입니다.

기사 분석에는 OpenAI API 키가 필요합니다. 콘텐츠 생성에는 선택한 프로바이더(OpenAI / Anthropic / Google)의 키가 필요하며, OpenAI를 선택하면 같은 키를 사용할 수 있습니다. 라이브러리에 키를 명시적으로 전달하므로 환경변수 로딩은 애플리케이션에서 처리하세요.

## 빠른 시작

저장소 인터페이스 4개를 구현한 뒤 아래 애플리케이션 함수를 호출하세요. 예제의 저장소 구현은 호출자가 제공하며, 패키지에 데이터베이스 어댑터가 포함되어 있지는 않습니다.

```typescript
import {
  type ArticleRepository,
  type NewsletterRepository,
  type TagRepository,
  type TaskRepository,
  generateNewsletter,
} from '@heripo/research-radar';

export async function runNewsletter(repositories: {
  taskRepository: TaskRepository;
  articleRepository: ArticleRepository;
  tagRepository: TagRepository;
  newsletterRepository: NewsletterRepository;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is required');

  const newsletterId = await generateNewsletter({
    ...repositories,
    openAIApiKey: apiKey,
    contentGeneration: { provider: 'openai', apiKey },
    logger: console,
  });

  if (newsletterId === null) {
    console.log('이번 실행에서는 뉴스레터가 생성되지 않았습니다.');
    return null;
  }

  console.log('저장된 뉴스레터:', newsletterId);
  return newsletterId;
}
```

`generateNewsletter()`의 반환 타입은 `Promise<string | number | null>`입니다. 저장된 뉴스레터 ID를 반환하며, 발행 조건 미충족 등으로 생성되지 않으면 `null`을 반환합니다. 생성 중 오류가 발생하면 Promise가 reject될 수 있습니다. 내부 팩토리인 `createNewsletterGenerator()`는 외부로 export하지 않습니다.

### Repository 계약

모든 인터페이스는 패키지 루트에서 export하며 [src/types/dependencies.ts](./src/types/dependencies.ts)에 정의되어 있습니다. 기사와 뉴스레터 데이터 타입은 `@llm-newsletter-kit/core`에서 제공합니다.

| Repository             | 메서드                                         | 반환 계약                                                 |
| ---------------------- | ---------------------------------------------- | --------------------------------------------------------- |
| `TaskRepository`       | `createTask()`                                 | `Promise<number>` — 레코드가 아닌 작업 ID                 |
|                        | `completeTask(taskId)`                         | `Promise<void>`                                           |
| `ArticleRepository`    | `findByUrls(urls)`                             | 중복 확인을 위한 `Promise<ParsedTarget[]>`                |
|                        | `saveCrawledArticles(articles, context)`       | 저장 건수 `Promise<number>`; 작업·그룹·타겟 컨텍스트 보존 |
|                        | `findUnscoredArticles()`                       | `Promise<UnscoredArticle[]>`                              |
|                        | `updateAnalysis(article)`                      | `Promise<void>`                                           |
|                        | `findCandidatesForNewsletter()`                | `Promise<ArticleForGenerateContent[]>`                    |
| `TagRepository`        | `findAllTags()`                                | `Promise<string[]>`                                       |
| `NewsletterRepository` | `getNextIssueOrder()`                          | `Promise<number>`                                         |
|                        | `saveNewsletter({ newsletter, usedArticles })` | `Promise<{ id: string \| number }>`                       |

후보 기사 선정은 저장소 구현의 책임입니다. 이미 발행한 기사를 제외할 수 있도록 필요에 따라 `usedArticles` 연결 정보를 저장하세요. 회차는 파이프라인 시작 전에 초기화되며, 동시 실행 조정은 애플리케이션이나 DB에서 처리해야 합니다. `TaskService`의 실행 상태 관리는 인스턴스 내부에 한정되므로 다른 프로세스나 별도의 `generateNewsletter()` 호출까지 잠그지는 않습니다.

### 선택적 생성 설정

| 옵션                     | 동작                                                                                                                                     |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `logger`                 | `console` 등 core의 `AppLogger` 구현                                                                                                     |
| `publishDate`            | 실제 달력에 존재하는 `YYYY-MM-DD` 날짜. 잘못된 값은 오류 발생. 생략하면 서버 시간대와 무관하게 `Asia/Seoul`(KST)의 현재 날짜 사용        |
| `customFetch`            | 크롤링과 파서 내부 API 요청에 사용할 `typeof fetch` 구현(예: 프록시 어댑터). LLM 요청에는 적용되지 않음                                  |
| `templateOptions`        | 기본/KRAS 브랜딩과 Markdown 섹션 설정(아래 참고)                                                                                         |
| `promptProvider`         | 패키지 자체 LLM 프롬프트를 통째로 대체하는 core `PromptProvider`. 생략하면 패키지 프롬프트를 쓰고, 정의되지 않은 단계는 core 기본값 사용 |
| `excavationReportSource` | 국가유산청 발굴조사 보고서를 애플리케이션이 주입. 주입하면 해당 게시판은 크롤링하지 않음. 생략하면 기존대로 크롤링                       |
| `previewNewsletter`      | 저장된 `Newsletter`를 조회하고 전달한 core `EmailService`로 미리보기 발송                                                                |

`previewNewsletter`에는 `fetchNewsletterForPreview: () => Promise<Newsletter>`, `emailService`(`send(message)` 구현), `emailMessage`(core `EmailMessage`에서 `subject`, `html`, `text`를 제외한 값)가 필요합니다. 세 필드는 core가 채우며, 생성된 뉴스레터가 없으면 미리보기를 발송하지 않습니다. 조회 콜백은 이번 실행에서 저장한 회차를 반환하도록 구현하세요.

운영 환경에는 스케줄러, 구독자 저장소, 전체 구독자 대상 발송, 수신거부 처리를 추가로 연결해야 합니다. 일간 파서 헬스체크 워크플로우는 뉴스레터 생성·배포 작업이 아닙니다.

## 아키텍처

**파이프라인**: 크롤링 → 분석 → 콘텐츠 생성 → 저장

1. **크롤링**: 대상 웹사이트에서 기사 수집
2. **분석**: LLM으로 기사 태깅 및 점수 매기기
3. **생성**: 고득점 기사로 뉴스레터 작성
4. **저장**: 뉴스레터 저장 및 미리보기 전송 (선택)

`@llm-newsletter-kit/core`의 **Provider-Service 패턴**을 사용합니다. 자세한 흐름 다이어그램은 [core 문서](https://github.com/heripo-lab/llm-newsletter-kit-core#architecture--flow)를 참고하세요.

## 설정과 모델

아래 기본값은 현재 코드의 설정이며 프로바이더 추천 목록이 아닙니다. 이 패키지는 AI SDK 7과 OpenAI·Anthropic·Google SDK 어댑터를 사용합니다.

| 단계        | 프로바이더 | 기본 모델                |
| ----------- | ---------- | ------------------------ |
| 태그 분류   | OpenAI     | `gpt-5.6-luna`           |
| 이미지 분석 | OpenAI     | `gpt-5.6-terra`          |
| 중요도 평가 | OpenAI     | `gpt-5.6-terra`          |
| 콘텐츠 생성 | OpenAI     | `gpt-5.6-sol`            |
| 콘텐츠 생성 | Anthropic  | `claude-sonnet-4-6`      |
| 콘텐츠 생성 | Google     | `gemini-3.1-pro-preview` |

`contentGeneration: { provider, apiKey, model? }`로 콘텐츠 생성 프로바이더를 선택합니다. `model`은 해당 프로바이더의 기본값을 덮어씁니다. 분석 모델은 [analysis.provider.ts](./src/providers/analysis.provider.ts)에 설정되어 있습니다.

[src/config/index.ts](./src/config/index.ts)에는 한국어 출력(`outputLanguage: '한국어'`), 문화유산 분야(`expertField: ['문화유산']`), 브랜드명, `subscribePageUrl`, LLM `maxRetries: 5`, 체인 `stopAfterAttempt: 3`, 생성 `temperature: 0.3`이 정의되어 있습니다. 발행 설정은 `minimumArticleCountForIssue: 5`, `priorityArticleScoreThreshold: 8`이며 core 엔진에서 판정합니다. 잠금 파일의 core 3.0.4 구현은 중요도 8 이상 기사가 없을 때 후보가 **5개 이하이면 생략**합니다. 후보가 없으면 항상 생략합니다.

## 크롤링 대상과 파서

[src/config/crawling-targets.ts](./src/config/crawling-targets.ts)의 현재 게시판 타겟 수입니다. 하나의 기관에 여러 타겟이 있을 수 있습니다.

| 그룹             |   활성 | 주석 처리 |
| ---------------- | -----: | --------: |
| 뉴스(News)       |     48 |        10 |
| 입찰(Business)   |      4 |         0 |
| 채용(Employment) |      7 |         3 |
| **합계**         | **59** |    **13** |

주석 처리된 13개는 실행 시 제외됩니다. 발굴조사 현황공개 1개는 정보가 파편적이고 뉴스레터 가치가 낮다는 주석이 있으며, 박물관 게시판 12개는 robots.txt 제한으로 비활성화되어 있습니다. 관련 파서 코드는 저장소에 남아 있습니다.

국가유산청, 국립문화유산연구원, 국립해양유산연구소, 국가유산진흥원, 한국문화유산협회, 고고학회, 국립박물관 등이 수집 대상입니다.

[src/parsers/](./src/parsers/)에는 기관별 파서 모듈 20개와 공통 날짜·URL 유틸리티가 있습니다. 목록 파서는 `ParsedTargetListItem[]`(제목, 날짜, 상세 URL, 날짜 유형, 선택적 원문 ID)을, 상세 파서는 Markdown `detailContent`와 첨부파일·이미지 유무를 반환합니다. 동기·비동기 파서를 모두 지원합니다. 한국고고학회, 영남고고학회, 국립해양유산연구소는 클라이언트 렌더링 콘텐츠를 읽기 위해 API를 추가 호출합니다.

`CrawlingProvider`의 최대 동시 크롤링 수는 5입니다. 전달된 fetch를 감싸 한국고고학회의 공개 상세 URL 요청을 상세 API로 연결하면서 기사 메타데이터에는 공개 URL을 유지합니다. 파이프라인을 직접 구성할 때는 provider의 fetch와 타겟 그룹을 함께 사용하세요.

크롤링 없이 활성 출처 목록을 조회할 수 있습니다.

```typescript
import { getSourceList } from '@heripo/research-radar';

const groups = getSourceList(); // [{ id, name, sources: [{ id, name, url }] }]
```

`createCrawlingTargetGroups(customFetch?)`, `getSourceList()`, `contentOptions`, `newsletterConfig`, `llmConfig`, `researchRadarPromptProvider`는 공개 API입니다. `ExcavationReport`, `ExcavationReportSource`는 타입으로 export됩니다. Provider 클래스 3개, `DateService`, `TaskService`, 공개 설정·의존성 타입도 [src/index.ts](./src/index.ts)에서 export합니다.

## 이메일 템플릿

[src/templates/](./src/templates/)에는 반응형 뉴스레터, 웰컴 이메일, 공통 로고·소개·텍스트 정화·푸터 컴포넌트가 있습니다. 라이트/다크 모드 스타일과 heripo/KRAS 변형을 제공합니다. Markdown 섹션은 `safe-markdown2html`로 변환하고, 웰컴 이메일의 이름은 DOMPurify로 정화하며 CSS는 `juice`로 인라인 처리합니다.

`NewsletterTemplateOptions` 옵션은 다음과 같습니다.

| 옵션                    | 용도                                                                                                     |
| ----------------------- | -------------------------------------------------------------------------------------------------------- |
| `isKrasNewsletter`      | KRAS 브랜딩, 50주년 헤더, 고고학 우선 전문 분야, 자유 형식 도입부, `한국고고학회 뉴스레터` 브랜드명 적용 |
| `krasNewsMarkdown`      | 생성된 본문 앞에 학회 소식 삽입                                                                          |
| `heripolabNewsMarkdown` | 생성된 본문 앞에 heripo lab 소식 삽입                                                                    |
| `krasNoticeMarkdown`    | 생성된 본문 뒤에 학회 공지 삽입                                                                          |
| `titleContext`          | 제목 생성에 참고할 맥락. `isKrasNewsletter: true`일 때만 허용하며 빈 문자열은 무시                       |
| `displayDate`           | 헤더 날짜. 템플릿 옵션이 전달되면 `generateNewsletter()`가 `DateService`에서 계산한 날짜로 교체          |

Markdown 섹션 3개는 두 브랜딩 모드에서 모두 사용할 수 있습니다.

```typescript
import {
  type NewsletterTemplateOptions,
  generateWelcomeHTML,
} from '@heripo/research-radar';

const templateOptions: NewsletterTemplateOptions = {
  isKrasNewsletter: true,
  titleContext: '한국고고학전국대회',
  krasNewsMarkdown: '학회 소식을 입력하세요.',
  krasNoticeMarkdown: '학회 공지사항을 입력하세요.',
};

const welcomeHtml = await generateWelcomeHTML('subscriber-id', '홍길동', {
  isKrasNewsletter: true,
  siteUrl: 'https://heripo.app',
});
```

`generateWelcomeHTML(id, name, options?)`는 `Promise<string>`을 반환하며 HTML만 생성합니다. `siteUrl` 기본값은 `https://heripo.app`이며 수신거부 링크 경로는 `/research-radar/unsubscribe?id=...`입니다. 뉴스레터의 Resend `{{{RESEND_UNSUBSCRIBE_URL}}}` 마커는 발송 연동에서 해석하거나 교체해야 합니다. 원본 뉴스레터 템플릿 팩토리와 공통 HTML 헬퍼는 패키지 루트에서 export하지 않습니다.

## 개발 명령어

```bash
# 잠금 파일 기준 개발 의존성 설치
npm ci

# 빌드
npm run clean              # dist/ 삭제
npm run build              # dist/ 정리 및 Rollup으로 빌드 (ESM + types)

# 타입 체크 & 린트
npm run lint               # 소스 파일 린트
npm run lint:fix           # 린트 및 자동 수정
npm run lint:ci            # CI용 quiet 린트
npm run typecheck          # TypeScript 타입 체크

# 포맷팅
npm run format             # src/ 코드 포맷
npm run format:check       # src/ 포맷 검사
```

빌드는 ESM·타입 선언·JavaScript 소스맵을 생성하며 런타임 의존성은 외부 의존성으로 유지합니다. CI는 PR과 수동 실행 시 Node.js 24.x에서 `npm ci`, `format:check`, `lint:ci`, `typecheck`, `build`를 수행합니다. 포맷 스크립트 범위는 `src/`이며 README는 `npx prettier --check README.md README-ko.md`로 별도 검사합니다. `npm test` 스크립트는 없습니다.

유지보수용 `release`는 npm에 배포하며, `release:patch`, `release:minor`, `release:major`는 버전을 올린 뒤 배포합니다. 버전 훅은 먼저 빌드하고 커밋·태그를 push하며, `prepublishOnly`는 배포 전에 빌드합니다.

### 크롤러 디버거

개발 중 크롤링 파서를 테스트하기 위한 웹 기반 도구입니다. 의존성 최소화를 위해 Express.js + 바닐라 HTML/CSS/JS로 구현했습니다.

```bash
npm run dev:crawler        # http://localhost:3333 에서 시작
npm run dev:crawler:proxy  # dev-tools/crawler-debugger/.env 로딩
```

프록시를 사용하려면 git에서 제외되는 `dev-tools/crawler-debugger/.env` 파일에 프록시 주소를 설정하세요.

```dotenv
PROXY_URL=http://127.0.0.1:8080
```

라이브러리는 `PROXY_URL`을 읽지 않고 `customFetch` 함수를 전달받습니다.

**기능**:

- `parseList()`, `parseDetail()` 파서를 웹 UI에서 테스트
- 디버깅용 원본 HTML 소스 보기
- 파싱 결과를 JSON으로 복사
- 5분 응답 캐시 (skip/clear 옵션)
- fetch 및 parse 작업 타이밍 정보

### 뉴스레터 미리보기

샘플 콘텐츠로 렌더링된 뉴스레터 HTML을 미리 볼 수 있습니다.

```bash
npm run dev:newsletter-preview  # http://localhost:3334 에서 시작
```

UI 컨트롤을 사용하거나 3334 포트의 `/api/preview?kras=true&krasNews=true&krasNotice=true&heripolabNews=true`를 여세요. 쿼리 파라미터는 루트 UI 주소가 아닌 `/api/preview`에 적용됩니다. 섹션 스위치는 샘플 Markdown을 삽입하며 LLM은 호출하지 않습니다.

### 웰컴 이메일 미리보기

렌더링된 웰컴 이메일 HTML을 미리 볼 수 있습니다.

```bash
npm run dev:welcome-preview  # http://localhost:3335 에서 시작
```

UI 컨트롤을 사용하거나 3335 포트의 `/api/preview?kras=true&name=홍길동`을 여세요. 두 HTML 미리보기 도구 모두 API 키가 필요하지 않습니다.

### 파서 헬스체크

모든 활성 크롤링 파서를 실제 웹사이트에 대해 검증하는 CLI 도구입니다. 웹사이트 리디자인으로 인한 파서의 조용한 실패(빈 결과, 깨진 셀렉터)를 조기에 감지합니다.

```bash
npm run health-check        # 헬스체크 실행
npm run health-check:proxy  # 같은 .env 로딩 및 --proxy 전달
npm run health-check -- --skip-khs-excavation  # 국가유산청 발굴조사 보고서/현장공개 제외
```

**타겟별 검증 항목**:

- `parseList()`: 비어있지 않은 배열인지, 첫 항목의 title/date가 비어있지 않고 detailUrl이 `http`로 시작하는지 확인
- `parseDetail()`: 첫 상세 항목을 조회하여 양끝 공백을 제거한 `detailContent`가 20자 이상인지 확인

정확한 ID 또는 이름으로 제외하려면 `--skip-target=<id-or-name>` 또는 `--skip-target <id-or-name>`을 반복해서 사용하세요. `npm run health-check -- --help`로 크롤링 없이 옵션을 볼 수 있습니다. 대상별 첫 항목을 검사하는 실제 사이트 스모크 체크이며 전체 기사 검증이나 LLM 분석을 수행하지는 않습니다. 검사 대상 중 하나라도 실패하면 종료 코드 1을 반환합니다.

**출력**: 콘솔 테이블 요약 + CI 연동을 위한 compact 텍스트 서머리

**CI**: [.github/workflows/parser-health-check.yml](./.github/workflows/parser-health-check.yml)은 매일 UTC 08:00(KST 17:00) 또는 수동으로 실행되며, `org-linux` 러너와 30분 작업 제한을 사용합니다. 국가유산청 발굴조사 보고서·현장공개 2개를 제외하므로 현재 설정에서는 57개를 검사합니다. Slack 알림에는 `SLACK_BOT_TOKEN` secret과 `SLACK_ALERT_DEV_CHANNEL` 저장소 변수가 필요합니다. 포크에서 그대로 실행하려면 같은 러너 및 알림 구성이 필요합니다. CLI는 관련 환경변수가 있으면 GitHub Actions 출력과 작업 요약도 기록합니다.

## 🤝 기여하기

이 프로젝트는 두 가지 방식으로 활용할 수 있습니다:

1. **헤리포 리서치 레이더에 직접 기여**: 버그 수정, 기능 개선, 크롤링 대상 추가 등
2. **나만의 뉴스레터 만들기**: 이 프로젝트를 포크해서 내 도메인에 맞는 뉴스레터 구축

기여 방법, 개발 환경 설정, PR 가이드 등은 [CONTRIBUTING.md](./CONTRIBUTING.md)를 참고하세요.

## 나만의 도메인으로 포크하기

내 뉴스레터를 만들려면 다음 파일을 수정하세요:

**1. 템플릿** (`src/templates/newsletter-html.ts`, `welcome-html.ts`, `shared.ts`):

- 로고 URL, 브랜드 색상 (#D2691E, #E59866), 연락처
- 플랫폼 소개 및 푸터 텍스트
- 수신거부 링크 형식 (현재 Resend의 `{{{RESEND_UNSUBSCRIBE_URL}}}`)

**2. 설정** (`src/config/index.ts`):

```typescript
import type { NewsletterConfig } from '@heripo/research-radar';

export const newsletterConfig: NewsletterConfig = {
  brandName: '내 뉴스레터 이름',
  subscribePageUrl: 'https://yourdomain.com/subscribe',
  publicationCriteria: {
    minimumArticleCountForIssue: 5,
    priorityArticleScoreThreshold: 8,
  },
};
```

**3. 크롤링 타겟** (`src/config/crawling-targets.ts`):

- 한국 문화유산 사이트를 내 도메인의 소스로 교체
- `src/parsers/`에 파서 구현

**4. 콘텐츠 생성 LLM 프로바이더 변경** (옵션):

콘텐츠 생성은 **3개 내장 프로바이더**를 지원합니다 — `contentGeneration.provider`만 바꾸면 됩니다:

```typescript
import type { ContentGenerationConfig } from '@heripo/research-radar';

const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey) throw new Error('GOOGLE_API_KEY is required');

const contentGeneration: ContentGenerationConfig = {
  provider: 'google',
  apiKey,
  model: 'gemini-3.1-pro-preview',
};
```

기본 모델: openai=`gpt-5.6-sol`, anthropic=`claude-sonnet-4-6`, google=`gemini-3.1-pro-preview`

분석 프로바이더를 변경하려면 호환되는 AI SDK 프로바이더에 맞춰 `src/providers/analysis.provider.ts`의 프로바이더 타입·모델과 `src/newsletter-generator.ts`의 생성 코드를 함께 변경하세요. 분석 provider의 도메인별 최소 점수 규칙, 설정의 출력 언어·전문 분야, 패키지 메타데이터, GitHub Actions 러너·Slack 설정도 포크에 맞게 조정하세요.

**검색 키워드**: `heripo`, `김홍연`, `#D2691E`, `openai`, `gpt-5`, `contentGeneration`

## 왜 코드 기반일까?

파서 동작, 모델 선택, 점수 규칙, 발행 설정, HTML 템플릿을 코드에서 확인하고 함께 버전 관리할 수 있습니다. Repository와 Provider 인터페이스로 기존 저장소·발송 시스템을 연동하고, core 엔진에서 실행 흐름과 재시도를 처리합니다.

## 관련 프로젝트

- [`@llm-newsletter-kit/core`](https://github.com/heripo-lab/llm-newsletter-kit-core) — 도메인 독립적인 뉴스레터 엔진
- [대형 언어 모델(LLM)을 활용한 고고학 정보화 연구](https://poc.heripo.org) — 학술 연구

## 후원

heripo lab의 오픈소스 연구를 후원하려면 다음 경로를 이용할 수 있습니다:

- [Open Collective](https://opencollective.com/heripo-project): 전반적인 프로젝트 후원
- [fairy.hada.io/@heripo](https://fairy.hada.io/@heripo): 한국인 개인 후원자를 위한 원화 결제
