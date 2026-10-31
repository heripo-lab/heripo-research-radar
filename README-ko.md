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
- 문화유산 기관, 박물관, 학회 등 활성 크롤링 타겟 73개 (robots.txt로 런타임 필터링)와 애플리케이션이 주입하는 학술지 신간 권호
- 모든 LLM 작업에 OpenAI GPT-6 기본값 적용 및 작업별 모델 재정의 지원
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
npm install @heripo/research-radar '@llm-newsletter-kit/core@~3.1.1'
```

**요구사항**: Node.js 24.x에서는 24.22.1 이상, 또는 Node.js 26.12.1 이상과 ESM 애플리케이션이 필요합니다. Node.js 25는 지원하지 않습니다. 패키지는 `dist/index.js`, TypeScript 선언 파일(`dist/index.d.ts`), JavaScript 소스맵을 제공합니다. Core 엔진은 peer dependency이며 현재 지원 범위는 `~3.1.1`입니다. 최근 제목 중복 방지와 원문 근거 기반 마감일 추출을 위해 core 3.1.1 이상이 필요합니다. 이 버전에는 Radar가 의존하는 크롤링 타임아웃 재시도 처리와 생성 자가검증 재시도 상한도 포함됩니다.

기사 분석에는 OpenAI API 키가 필요합니다. 콘텐츠 생성에는 선택한 프로바이더(OpenAI / Anthropic / Google)의 키가 필요하며, OpenAI를 선택하면 같은 키를 사용할 수 있습니다. 라이브러리에 키를 명시적으로 전달하므로 환경변수 로딩은 애플리케이션에서 처리하세요.

### 전이 의존성 보안

이 저장소의 `package-lock.json`은 개발과 CI에서 audit한 의존성 버전을 고정합니다. 소비자는 자신의 잠금 파일을 사용하므로 이 라이브러리 업데이트만으로 기존의 취약한 전이 의존성이 교체된다고 보장할 수 없습니다. 현재 AI SDK와 Cheerio의 의존성 범위는 여전히 `undici` 7.29.0을 허용합니다.

npm 애플리케이션에서는 다음 설정을 **애플리케이션 루트의 `package.json`**에 병합해 수정된 undici 7.x를 요구하세요. 설치된 라이브러리의 overrides는 npm이 무시합니다([npm overrides 문서](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#overrides)). 이 선택자는 jsdom이 사용하는 undici 8.x에는 적용되지 않습니다.

```json
{
  "overrides": {
    "undici@>=7.0.0 <7.30.0": "^7.30.0"
  }
}
```

`npm install` 실행 후 `npm ls undici`와 `npm audit`으로 확인하고 애플리케이션의 갱신된 잠금 파일을 커밋하세요. 애플리케이션이 undici 7.x를 직접 의존성으로 선언했다면 해당 범위도 `^7.30.0`으로 올리세요. 이 저장소의 audit 통과는 소비자의 의존성 트리에 대한 보안 보장이 아닙니다.

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

### 최근 제목과 원문 마감 추출

이 API는 배포된 core 3.1.1 패키지를 사용합니다. 피어 의존성 범위는
`~3.1.1`이며 `npm ci`로 로컬 core 연결 없이 잠금 파일의 패키지를 설치합니다.

- 선택적 `NewsletterRepository.findRecentPublishedTitles({ fromInclusive, toExclusive })`를
  구현하면 제목 중복 방지를 켭니다. Radar는 발행일 직전 7일의 날짜 범위를
  전달하며 발행일 자체는 제외합니다. 같은 뉴스레터·독자 대상의 실제 발행
  제목만 반환하고 초안·발송 실패는 제외하세요. core는 정규화한 제목을 비교하고
  최대 두 번 제목만 다시 생성합니다.
- `extractDeadlineOptions: {}`를 전달하면 중요도 모델로 기사 분석 중 마감을
  추출하며, `{ model }`로 별도의 OpenAI 모델 ID/AI SDK 모델을 지정할 수 있습니다.
  `updateAnalysis`에서 `article.deadlines`를 저장하세요. `[]`는 근거 있는 마감 없음,
  `undefined`는 미추출·실패입니다. 원문이 바뀌면 캐시를 지워야 합니다.
  옵션을 생략하면 기존 분석 호출을 유지합니다.
- `extractDeadlineOptions`에 `includeEvents: true`를 추가하면 학술대회·강연·발굴
  현장 공개 일정도 추출합니다. 등록 마감과 개최 일정은 별도 항목이며, 행사는
  `type: 'event'`, 시작 `date`·`time`, 선택적 종료 `endDate`·`endTime`을 보존합니다.
  시각은 추측하지 않습니다. 기본값은 마감만 추출하며, 옵션을 꺼도 분석에서 기존
  이벤트 캐시는 보존합니다. 과거 기사에 행사를 추가하려면 빈 배열을 포함한 기존
  캐시를 재추출해야 합니다.
- `extractResearchRadarDeadlines({ model, article: { title, detailContent } })`는
  호스트의 백필·검증에도 같은 원문 추출을 제공합니다. 이 함수와
  `refreshResearchRadarDeadlines()`에도 `includeEvents: true`를 전달하면 행사를
  포함합니다. URL 조회나 재안내 활성화는 하지 않습니다.

재안내는 실제 발행한 뉴스레터에 포함된 기사만 호스트에서 활성화합니다.
core의 `usedArticles`는 편집 과정에서 빠진 기사도 포함하는 후보 배열이므로
실제 게재의 근거가 아닙니다. 호스트는 최근 60일 실제 게재 기사만 일회성
백필 대상으로 선정하고, 마감을 별도로 저장한 뒤 임박한 재안내만 골라 전달합니다.
과거 뉴스레터 본문 전체는 생성 컨텍스트에 넣지 않습니다.

재안내 직전에 `refreshResearchRadarDeadlines({ source: { title, url, targetUrl },
model, customFetch?, publicDataApiKey? })`를 호출하세요. 기존 수집과 동일한
어댑터·robots 규칙으로 등록된 상세 원문을 확인하며 전체 네트워크 제한 시간은
15초입니다. 채용 API는 해당 공고만, 나라장터는 해당 공고번호의 차수만 조회하며
최신 차수의 URL을 반환합니다. 일간 목록 수집·입찰 선별·점수 산정·저장은 실행하지
않습니다. 원문 읽기만 필요하면 `fetchResearchRadarDeadlineSource()`를 쓸 수
있으며 성공 상태는 `status: 'fetched'`입니다.

날짜·시각은 인용 근거의 실제 표기와 대조합니다. 원문 해시가 같아도 이전 캐시의
근거가 현재 검증 기준을 통과하지 못하면 다시 추출하며, 지원되지 않는 값은 재안내를 보류합니다.

- `status: 'verified'`는 최신 기사·마감, `sourceHash`, `checkedAt`, 모델 사용량을
  반환합니다. 명시적 연장은 변경 날짜로, 명시적 취소는 `status: 'cancelled'`로
  추출합니다. 성공한 재확인의 `previous: { sourceHash, deadlines }`를 전달하면
  새로 조회한 원문 해시와 행사 추출 모드가 같을 때만 재추출을 생략합니다.
  반환된 `includeEvents`도 `previous`에 보존하세요. 모드 정보가 없으면 기존 마감
  전용 캐시로 보므로, 행사 추출을 켜면 같은 원문도 다시 추출합니다. 다른 추출
  정책을 바꾸면 이 캐시도 무효화하세요.
- `status: 'unverified'`는 마감 없이 사유만 반환합니다. 날짜 소실, 접속 실패,
  미지원 게시판, 추출 실패는 재안내 보류이며 저장한 행동을 취소하지 않습니다.
  원문 확인이 성공해도 과거의 모든 행동이 확인된 것은 아니므로 호스트에서
  각 행동을 대응시키고 빠진 행동은 보류해야 합니다. 다른 URL의 별도 공지는
  이 단건 확인 범위에 포함하지 않습니다.

호스트가 고른 검증된 행동을 `renderVerifiedDeadlineReminders(reminders,
publicationDate)`에 전달하고 결과를 `templateOptions.deadlineRemindersMarkdown`에
넣으세요. D-3부터 오늘까지의 일정·마감을 먼저 고르고, 남는 자리에 종료일이
확인된 진행 중 행사를 넣습니다. 각 그룹은 날짜·시각순으로 정렬하며 전체 최대
10건을 표시합니다(`DEADLINE_REMINDER_LEAD_DAYS`, `DEADLINE_REMINDER_LIMIT`). 명시된 기간·시각만 쓰고 23:59를 만들지
않습니다. 섹션명은 **다가오는 일정·마감**이며 당일에는 **오늘 마감**, **오늘 개최**,
**오늘 공개**, 진행 중 행사에는 **진행 중**을 표시합니다. 행사 시작 시각을 접수
마감으로 취급하지 않으며, 명시된 종료 시각만 당일 만료 판정에 사용합니다.
종료일이 없으면 시작일까지만 표시합니다. 생성 후 저장할 Markdown과 HTML에 붙이므로
본문 생성 컨텍스트가 늘어나지 않습니다. 재안내 일정 선정, 반복 방지와 발행 이력은
호스트가 관리합니다. 빈 섹션은 생략합니다.

새 연동에서는 원문을 재확인한 과거 행동을
`templateOptions.verifiedDeadlineReminders`로 전달하세요. 생성 본문에 실제 링크가
실린 기사의 원문 기반 일정·마감과 합쳐 표시 대상 최대 10건을 링크가 있는
한 섹션에 표시합니다. `generateNewsletter()`는 중요도 판단 모델에 표시 대상 전체를
보여주고 그중 10건을 고르게 합니다. 모델은 후보 번호만 답하며, 독자가 행동할 수
있는 일정을 우선하고 오늘 일정과 함께 D-1~D-3 일정도 고르게 넣고 여러 기관이
알린 같은 행사는 하나만 남깁니다. 제목·날짜·링크는 항상 검증된 행에서 렌더링하며,
오류, 60초 시간 초과, 쓸 수 없는 응답이면 날짜순 앞 10건을 표시합니다. 모델이 덜
고르면 모델이 중복으로 지목한 후보를 빼고 날짜순으로 채웁니다. 재안내 항목에
`recentReminderCount`를 넣으면 최근 7일 동안 몇 번 안내했는지 선택에 반영합니다. 중복 식별에는 유형도 포함하므로 등록 마감과 개최 일정이
서로 덮어쓰지 않습니다. 행사는 시작·종료 날짜와 시각도 식별에 포함하여 같은
제목·종류의 여러 개최 일정을 보존합니다. 기존 마감 행동의 중복 제거 정책은
유지합니다. 재검증된 원문에서는 새로 확인한 행동만 표시 대상으로 삼고,
대응되지 않은 캐시 마감은 보류합니다. 자유 문자열인 `title`·`kind`로 활성 상태나
취소를 추측하지 않습니다. 나라장터 수정본은 공고번호로 같은 원문임을 판단합니다.
같은 원문의 서로 다른 행동을 표시하려면 각 행동의 재검증 결과를 전달하세요.
재검증 결과를 전달하지 않은 다른 원문은 기사에서 근거를 확인한 마감을 계속 사용합니다.
기존 `deadlineRemindersMarkdown` 옵션도 유지합니다.
프롬프트는 마무리에 별도 일정 목록을 만들지 않고, 동료 소개·공유 문구는 강조된
일정·마감 표 뒤에 한 번만 배치합니다. 표시할 항목이 없으면 빈 섹션을 만들지 않습니다.
`templateOptions.shareNoticeMarkdown`을 지정하면 저장 Markdown과 HTML 모두에
해당 문구를 씁니다. 생략하면 기본 안내를, 빈 문자열이면 안내를 표시하지 않습니다.

### 선택적 생성 설정

| 옵션                     | 동작                                                                                                                                     |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `logger`                 | `console` 등 core의 `AppLogger` 구현                                                                                                     |
| `publishDate`            | 실제 달력에 존재하는 `YYYY-MM-DD` 날짜. 잘못된 값은 오류 발생. 생략하면 서버 시간대와 무관하게 `Asia/Seoul`(KST)의 현재 날짜 사용        |
| `customFetch`            | 크롤링과 파서 내부 API 요청에 사용할 `typeof fetch` 구현(예: 프록시 어댑터). LLM 요청에는 적용되지 않음                                  |
| `templateOptions`        | 기본/KRAS 브랜딩과 Markdown 섹션 설정(아래 참고)                                                                                         |
| `promptProvider`         | 패키지 자체 LLM 프롬프트를 통째로 대체하는 core `PromptProvider`. 생략하면 패키지 프롬프트를 쓰고, 정의되지 않은 단계는 core 기본값 사용 |
| `excavationReportSource` | 국가유산청 발굴조사 보고서를 애플리케이션이 주입. 주입하면 해당 게시판은 크롤링하지 않음. 생략하면 기존대로 크롤링                       |
| `journalIssueSource`     | KCI 등 새로 발간된 학술지 권호를 애플리케이션이 주입. 권호 하나가 기사 하나가 됨. 생략하면 해당 타깃은 수집하지 않음                     |
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

아래 기본값은 현재 코드의 설정이며 프로바이더 추천 목록이 아닙니다. `openAIApiKey`는 필수이며 모든 기본 모델에 사용됩니다.

| 단계               | 프로바이더 | 기본 모델    |
| ------------------ | ---------- | ------------ |
| 나라장터 공고 선별 | OpenAI     | `gpt-6-luna` |
| 태그 분류          | OpenAI     | `gpt-6-luna` |
| 이미지 분석        | OpenAI     | `gpt-6-sol`  |
| 중요도 평가        | OpenAI     | `gpt-6-sol`  |
| 뉴스레터 생성      | OpenAI     | `gpt-6-sol`  |

`models`로 각 작업의 모델을 독립적으로 덮어쓸 수 있습니다. 각 값은 OpenAI 모델 ID 문자열 또는 설치된 `ai` 패키지의 공개 타입인 `LanguageModel`을 받습니다. 문자열은 `openAIApiKey`를 사용하고, 프로바이더 모델 객체는 그대로 전달되어 자체 프로바이더 설정을 사용합니다. 생략하거나 `undefined`로 전달한 필드는 `llmConfig.models`의 기본값을 유지합니다.

```typescript
await generateNewsletter({
  ...repositories,
  openAIApiKey,
  models: {
    heritageBidTriage: 'gpt-6-luna',
    classifyTags: 'gpt-6-luna',
    analyzeImages: 'gpt-6-sol',
    determineImportance: 'gpt-6-sol',
    generateNewsletter: 'gpt-6-sol',
  },
});
```

모델 ID 문자열과 프로바이더 객체를 함께 사용할 수 있습니다:

```typescript
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

const anthropic = createAnthropic({ apiKey: anthropicApiKey });
const google = createGoogleGenerativeAI({ apiKey: googleApiKey });

await generateNewsletter({
  ...repositories,
  openAIApiKey,
  models: {
    heritageBidTriage: 'gpt-6-luna',
    classifyTags: google('gemini-3.1-pro-preview'),
    analyzeImages: google('gemini-3.1-pro-preview'),
    determineImportance: anthropic('claude-sonnet-4-6'),
    generateNewsletter: anthropic('claude-sonnet-4-6'),
  },
});
```

Anthropic·Google로 뉴스레터를 생성하는 기존 `contentGeneration: { provider, apiKey, model? }` 경로도 호환성을 위해 유지합니다. 두 설정을 함께 전달하면 `models.generateNewsletter`가 우선합니다. `models.generateNewsletter`를 생략하거나 `undefined`로 전달하면 기존 `contentGeneration`의 프로바이더·모델 선택을 사용합니다. 두 설정 모두 없으면 `llmConfig.models.generateNewsletter`를 사용합니다. 모든 단계에 모델 객체를 전달해도 `openAIApiKey`는 계속 필수입니다.

[src/config/index.ts](./src/config/index.ts)에는 한국어 출력(`outputLanguage: '한국어'`), 문화유산 분야(`expertField: ['문화유산']`), 브랜드명, `subscribePageUrl`, LLM `maxRetries: 5`, 체인 `stopAfterAttempt: 3`, 생성 `temperature: 0.3`이 정의되어 있습니다. 발행 설정은 `minimumArticleCountForIssue: 5`, `priorityArticleScoreThreshold: 8`이며 core 엔진에서 판정합니다. 잠금 파일의 core 3.1.1 구현은 중요도 8 이상 기사가 없을 때 후보가 **5개 이하이면 생략**합니다. 후보가 없으면 항상 생략합니다.

## 크롤링 대상과 파서

[src/config/crawling-targets.ts](./src/config/crawling-targets.ts)의 현재 게시판 타겟 수입니다. 하나의 기관에 여러 타겟이 있을 수 있습니다.

| 그룹             |   활성 | 주석 처리 |
| ---------------- | -----: | --------: |
| 뉴스(News)       |     56 |         1 |
| 입찰(Business)   |      5 |         0 |
| 채용(Employment) |     12 |         0 |
| **합계**         | **73** |     **1** |

주석 처리된 것은 발굴조사 현황공개 1개뿐입니다. 정보가 파편적이고 뉴스레터 가치가 낮습니다. robots.txt가 제한하는 게시판도 설정에는 그대로 두고 런타임 검사에서 거부하므로, 사이트별 정책을 설정 파일에 손으로 반영할 필요가 없습니다. 현재 정책 기준으로 73개 중 14개가 거부됩니다.

타깃 3개는 크롤링이 아니라 data.go.kr 오픈 API에서 읽습니다. 채용 그룹의 나라일터(`PblJobService`)·알리오(`recruitment`), 입찰 그룹의 나라장터(`BidPublicInfoService`)입니다. 인증키는 `publicDataApiKey`로 주입하며, 생략하면 해당 타깃은 요청 없이 빈 목록을 반환합니다. 세 게시판은 전국 공공부문 채용과 조달 공고를 모두 담고 있어 분석 단계 이전에 걸러냅니다. 채용 게시판은 `src/crawling/heritage-job-filter.ts`를 쓰며 제외어가 모두 직무 명사라 패턴으로 버팁니다(약 2%, 하루 2.6건 통과). 나라장터는 `src/crawling/heritage-triage.ts`가 제목 100건씩을 저렴한 모델에 묻습니다. 한국어에서 유산 여부는 부분문자열로 판정할 수 없기 때문이며, 배치가 실패하면 기존 정규식이 폴백으로 판단합니다.

새로 발간된 학술지 권호는 크롤링하지 않습니다. 애플리케이션이 `journalIssueSource`로 주입하고(heripo-web은 KCI 논문 카탈로그에서 읽음) `KCI_학술지_신간` 타깃이 이를 그대로 제공하므로, 타깃 URL로는 요청하지 않습니다. 권호 하나가 기사 하나가 됩니다. `uniqId`는 권호의 `externalId`, URL은 권호의 `url`입니다. `usedArticles`에는 애플리케이션의 기사 ID와 URL만 실리므로, 저장된 뉴스레터가 소개한 권호는 `saveCrawledArticles`에서 저장해 둔 `uniqId`나 권호 URL로 기록합니다. 채점 단계가 읽는 기사 본문에는 여러 논문이 공유한 키워드와 함께 수록 논문 전체의 저자·키워드·300자로 자른 초록이 들어갑니다. 출처를 주지 않으면 빈 목록을 반환합니다. 기존 국립문화유산연구원 헤리티지:역사와 과학·보존과학연구 게시판 크롤링을 대체합니다.

이 권호들은 생성 모델이 쓰지 않습니다. `ContentGenerateProvider`가 후보에서 빼 두었다가 `📖 새로 나온 학술지` 섹션을 직접 렌더링해 `🎓 학술대회·학술행사` 뒤, `📋 발굴조사보고서 (신규 제출)` 앞에 넣습니다. 그 섹션이 없으면 다음 고정 분류(`⛏️ 발굴현장 공개`, `💼 채용·공고`, `📑 사업·입찰 공고`, `📌 마무리` 순) 중 처음 나오는 섹션 앞에 넣습니다. 권호마다 KCI 권호 목차로 링크하고, 독자가 관심 가질 논문을 관심이 큰 순서대로 저자와 함께 표로 보여주며, 나머지는 편수와 주제로 줄입니다. 기준은 학문 분야가 아니라 독자(KRAS 모드에서는 한국고고학회 회원)의 관심입니다. 역사학 논문이라도 뺄 수 있고 고고학이 아니어도 실을 수 있습니다. 중요도 모델은 논문 번호를 고르고 순서를 정하며 뺀 논문의 주제만 붙이고, 제목·링크·저자는 주입 데이터 그대로 씁니다. 선별이 실패하거나 시간이 초과되면 모든 논문을 표에 싣고, 권호를 불러오지 못하면 해당 기사는 일반 후보로 모델에 넘깁니다. 따로 뺀 기사는 `usedArticles`에 다시 붙이므로 모델이 보지 않았어도 소개 이력에 남습니다. 그 결과 제목·브리핑·마무리에는 학술지가 언급되지 않고, 학술지 권호는 발행 기준 건수에 포함되지 않습니다.

크롤링 요청은 네트워크에 나가기 전에 robots.txt 검사(`src/crawling/robots.ts`)를 거칩니다. 금지된 요청은 전송하지 않고 거부하며, robots.txt가 없거나 조회에 실패하면 허용합니다. 검사에서 제외할 origin은 `src/config/index.ts`의 `robotsExemptOrigins`에 사유와 함께 명시합니다.

국가유산청, 국립문화유산연구원, 국립해양유산연구소, 국가유산진흥원, 한국문화유산협회, 고고학회, 국립박물관 등이 수집 대상입니다.

[src/parsers/](./src/parsers/)에는 파서 모듈 24개(기관별 23개와 학술지 권호 주입 어댑터)와 공통 날짜·URL 유틸리티가 있습니다. 목록 파서는 `ParsedTargetListItem[]`(제목, 날짜, 상세 URL, 날짜 유형, 선택적 원문 ID)을, 상세 파서는 Markdown `detailContent`와 첨부파일·이미지 유무를 반환합니다. 동기·비동기 파서를 모두 지원합니다. 한국고고학회, 영남고고학회, 국립해양유산연구소는 클라이언트 렌더링 콘텐츠를 읽기 위해 API를 추가 호출합니다.

`CrawlingProvider`의 최대 동시 크롤링 수는 5입니다. 전달된 fetch를 감싸 한국고고학회의 공개 상세 URL 요청을 상세 API로 연결하면서 기사 메타데이터에는 공개 URL을 유지합니다. 파이프라인을 직접 구성할 때는 provider의 fetch와 타겟 그룹을 함께 사용하세요.

크롤링 없이 활성 출처 목록을 조회할 수 있습니다.

```typescript
import { getSourceList } from '@heripo/research-radar';

const groups = getSourceList(); // [{ id, name, sources: [{ id, name, url }] }]
```

`createCrawlingTargetGroups(customFetch?)`, `getSourceList()`, `contentOptions`, `newsletterConfig`, `llmConfig`, `researchRadarPromptProvider`, `JOURNAL_ISSUE_LIST_URL`(애플리케이션이 저장한 학술지 권호 기사를 찾는 데 쓰는 대상 URL)은 공개 API입니다. `ExcavationReport`, `ExcavationReportSource`, `JournalIssue`, `JournalIssuePaper`, `JournalIssueSource`는 타입으로 export됩니다. Provider 클래스 3개, `DateService`, `TaskService`, 공개 설정·의존성 타입도 [src/index.ts](./src/index.ts)에서 export합니다.

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
npm run typecheck          # 소스와 테스트 TypeScript 타입 체크
npm test                   # 외부 호출 없는 모델 설정 회귀 테스트

# 포맷팅
npm run format             # src/ 코드 포맷
npm run format:check       # src/ 포맷 검사
```

빌드는 ESM·타입 선언·JavaScript 소스맵을 생성하며 런타임 의존성은 외부 의존성으로 유지합니다. CI는 PR과 수동 실행 시 Node.js 24와 26의 최소 지원 버전(24.22.1과 26.12.1), 최신 24.x, 최신 26.x에서 `npm ci`, `format:check`, `lint:ci`, `typecheck`, `npm test`, `build`를 수행합니다. 포맷 스크립트 범위는 `src/`이며 README는 `npx prettier --check README.md README-ko.md`로 별도 검사합니다. `npm test`는 Node의 실험적 모듈 모킹과 설치된 AI SDK 테스트 도구를 사용하며 LLM 호출·크롤링·이메일 발송을 하지 않습니다.

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

**크롤링 타겟별 검증 항목**:

- `parseList()`: 비어있지 않은 배열인지, 첫 항목의 title/date가 비어있지 않고 detailUrl이 `http`로 시작하는지 확인
- `parseDetail()`: 첫 상세 항목을 조회하여 양끝 공백을 제거한 `detailContent`가 20자 이상인지 확인

공공정보 API(알리오·나라일터·나라장터)는 `PUBLIC_DATA_API_KEY`를 포함해 목록 엔드포인트에 `numOfRows=1`로 직접 요청하고 HTTP 200 응답 여부만 확인합니다. 나라장터는 용역·공사 엔드포인트를 각각 확인합니다. 응답 본문·결과 코드·목록·상세 내용은 검증하지 않으며, 키가 없으면 세 타겟을 건너뜁니다.

정확한 ID 또는 이름으로 제외하려면 `--skip-target=<id-or-name>` 또는 `--skip-target <id-or-name>`을 반복해서 사용하세요. `npm run health-check -- --help`로 크롤링 없이 옵션을 볼 수 있습니다. 대상별 첫 항목을 검사하는 실제 사이트 스모크 체크이며 전체 기사 검증이나 LLM 분석을 수행하지는 않습니다. 검사 대상 중 하나라도 실패하면 종료 코드 1을 반환합니다.

**출력**: 콘솔 테이블 요약 + CI 연동을 위한 compact 텍스트 서머리

**CI**: [.github/workflows/parser-health-check.yml](./.github/workflows/parser-health-check.yml)은 매일 UTC 08:00(KST 17:00) 또는 수동으로 실행되며, `org-linux` 러너와 30분 작업 제한을 사용합니다. 국가유산청 발굴조사 보고서·현장공개 2개를 제외합니다. 크롤링 타겟의 헬스체크는 운영과 동일하게 robots.txt 게이트와 KRAS 상세 어댑터를 조합하므로, 거부되는 게시판은 실패가 아니라 건너뜀으로 보고됩니다. 현재 설정에서는 17개 건너뜀(실제 게시판이 없는 학술지 권호 주입 타깃 포함), 53개 검사입니다. 상세 검사는 목록의 최대 3개 항목까지 시도하므로, 맨 위 글 하나가 읽히지 않아도 타깃이 실패하지 않습니다. Slack 알림에는 `SLACK_BOT_TOKEN` secret과 `SLACK_ALERT_DEV_CHANNEL` 저장소 변수가 필요합니다. 포크에서 그대로 실행하려면 같은 러너 및 알림 구성이 필요합니다. CLI는 관련 환경변수가 있으면 GitHub Actions 출력과 작업 요약도 기록합니다.

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

**4. 콘텐츠 생성 LLM 프로바이더 변경** (레거시 호환):

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

호환 경로 기본 모델: openai=`gpt-6-sol`, anthropic=`claude-sonnet-4-6`, google=`gemini-3.1-pro-preview`

분석 프로바이더를 변경하려면 호환되는 AI SDK 모델 객체를 `models.classifyTags`, `models.analyzeImages`, `models.determineImportance`로 전달하세요. 분석 provider의 도메인별 최소 점수 규칙, 설정의 출력 언어·전문 분야, 패키지 메타데이터, GitHub Actions 러너·Slack 설정도 포크에 맞게 조정하세요.

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
