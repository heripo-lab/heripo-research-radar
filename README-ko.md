# 헤리포 리서치 레이더 (heripo Research Radar)

[English](./README.md) | 한국어

[![CI](https://github.com/heripo-lab/heripo-research-radar/actions/workflows/ci.yml/badge.svg)](https://github.com/heripo-lab/heripo-research-radar/actions/workflows/ci.yml)
[
![npm version](https://img.shields.io/npm/v/%40heripo%2Fresearch-radar?logo=npm&color=cb0000)
](https://www.npmjs.com/package/@heripo/research-radar)
![license](https://img.shields.io/github/license/heripo-lab/heripo-research-radar)
![node](https://img.shields.io/badge/node-%3E%3D22-brightgreen)

[행동 강령](./CODE_OF_CONDUCT.md) • [보안 정책](./SECURITY.md) • [기여 가이드](./CONTRIBUTING.md)

## 이게 뭔가요?

한국 문화유산 분야를 위한 AI 기반 뉴스레터 서비스입니다. [`@llm-newsletter-kit/core`](https://github.com/heripo-lab/llm-newsletter-kit-core)를 기반으로 만들어진 **실제 운영 서비스**([heripo.com](https://heripo.com/research-radar/subscribe))이자, LLM으로 자동화된 뉴스레터를 만드는 방법을 보여주는 **참조 구현**입니다.

**운영 메트릭**:
- **비용**: 발행당 $0.2-1
- **운영**: 완전 자동 24/7 운영 (사람 개입 불필요)
- **참여율**: 클릭률 15%

**기술적 특징**:
- 엄격한 타입 시스템의 TypeScript
- 교체 가능한 Provider 패턴 (Crawling/Analysis/Content/Email)
- 문화유산 기관, 박물관, 학회 등 66개 크롤링 타겟
- LLM 기반 분석 (GPT-5 모델)
- 재시도, 체인 옵션, 미리보기 이메일 내장

**링크**: [라이브 서비스](https://heripo.com/research-radar/subscribe) • [뉴스레터 예시](https://heripo.com/research-radar-newsletter-example.html) • [Core 엔진](https://github.com/heripo-lab/llm-newsletter-kit-core)

## 배경

고고학을 전공한 소프트웨어 엔지니어 김홍연이 "왜 연구에는 이렇게 많은 수작업이 필요할까?"라는 질문에서 출발했습니다.

[대형 언어 모델(LLM)을 활용한 고고학 정보화 연구](https://poc.heripo.com)를 마친 후, 개인용 스크립트를 프로덕션 서비스로 발전시켰습니다. 이 저장소는 실제 운영 중인 서비스를 오픈소스로 공개해 다른 개발자들이 도메인별 뉴스레터를 쉽게 시작할 수 있도록 돕습니다.

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
npm install @heripo/research-radar @llm-newsletter-kit/core
```

**요구사항**: Node.js >= 22, OpenAI API 키

**참고**: `@llm-newsletter-kit/core`는 peer dependency이므로 별도로 설치해야 합니다.

## 빠른 시작

```typescript
import { generateNewsletter } from '@heripo/research-radar';

const newsletterId = await generateNewsletter({
  openAIApiKey: process.env.OPENAI_API_KEY,

  // Repository 인터페이스 구현 (src/types/dependencies.ts 참조)
  taskRepository: {
    createTask: async () => db.tasks.create({ status: 'running' }),
    completeTask: async (id) => db.tasks.update(id, { status: 'completed' }),
  },

  articleRepository: {
    findByUrls: async (urls) => db.articles.findByUrls(urls),
    saveCrawledArticles: async (articles, ctx) => db.articles.save(articles, ctx),
    findUnscoredArticles: async () => db.articles.findUnscored(),
    updateAnalysis: async (article) => db.articles.updateAnalysis(article),
    findCandidatesForNewsletter: async () => db.articles.findCandidates(),
  },

  tagRepository: {
    findAllTags: async () => db.tags.findAll(),
  },

  newsletterRepository: {
    getNextIssueOrder: async () => db.newsletters.getNextOrder(),
    saveNewsletter: async (data) => db.newsletters.save(data),
  },

  // 옵션: 커스텀 로거 및 미리보기
  logger: console,
  previewNewsletter: {
    fetchNewsletterForPreview: async () => db.newsletters.latest(),
    emailService: resendEmailService,
    emailMessage: { from: 'news@example.com', to: 'preview@example.com' },
  },
});
```

**Repository 인터페이스**는 `src/types/dependencies.ts`에 정의되어 있으며, 각 메서드의 입출력 타입은 JSDoc으로 명시되어 있습니다.

## 아키텍처

**파이프라인**: 크롤링 → 분석 → 콘텐츠 생성 → 저장

1. **크롤링**: 대상 웹사이트에서 기사 수집
2. **분석**: LLM으로 기사 태깅 및 점수 매기기
3. **생성**: 고득점 기사로 뉴스레터 작성
4. **저장**: 뉴스레터 저장 및 미리보기 전송 (선택)

`@llm-newsletter-kit/core`의 **Provider-Service 패턴**을 사용합니다. 자세한 흐름 다이어그램은 [core 문서](https://github.com/heripo-lab/llm-newsletter-kit-core#architecture--flow)를 참고하세요.

## 구성 요소

**설정** (`src/config/`): 브랜드명, 언어, LLM 설정 (재시도, temperature)

**타겟** (`src/config/crawling-targets.ts`): 66개 소스 (뉴스 52, 입찰 4, 채용 10)

**파서** (`src/parsers/`): 기관별 커스텀 추출기 (khs.parser.ts, museum.parser.ts 등)

**템플릿** (`src/templates/newsletter-html.ts`): 라이트/다크 모드 지원 반응형 이메일

## 개발 명령어

```bash
# 빌드
npm run build              # dist/ 정리 및 Rollup으로 빌드 (CJS + ESM + types)

# 타입 체크 & 린트
npm run lint               # 소스 파일 린트
npm run lint:fix           # 린트 및 자동 수정
npm run typecheck          # TypeScript 타입 체크

# 포맷팅
npm run format             # Prettier로 코드 포맷
```

### 크롤러 디버거

개발 중 크롤링 파서를 테스트하기 위한 웹 기반 도구입니다. 의존성 최소화를 위해 Express.js + 바닐라 HTML/CSS/JS로 구현했습니다.

```bash
npm run dev:crawler        # http://localhost:3333 에서 시작
```

**기능**:
- `parseList()`, `parseDetail()` 파서를 웹 UI에서 테스트
- 디버깅용 원본 HTML 소스 보기
- 파싱 결과를 JSON으로 복사
- 5분 응답 캐시 (skip/clear 옵션)
- fetch 및 parse 작업 타이밍 정보

## 🤝 기여하기

이 프로젝트는 두 가지 방식으로 활용할 수 있습니다:

1. **헤리포 리서치 레이더에 직접 기여**: 버그 수정, 기능 개선, 크롤링 대상 추가 등
2. **나만의 뉴스레터 만들기**: 이 프로젝트를 포크해서 내 도메인에 맞는 뉴스레터 구축

기여 방법, 개발 환경 설정, PR 가이드 등은 [CONTRIBUTING.md](./CONTRIBUTING.md)를 참고하세요.

## 나만의 도메인으로 포크하기

내 뉴스레터를 만들려면 다음 파일을 수정하세요:

**1. 템플릿** (`src/templates/newsletter-html.ts`):
- 로고 URL, 브랜드 색상 (#D2691E, #E59866), 연락처
- 플랫폼 소개 및 푸터 텍스트
- 수신거부 링크 형식 (현재 Resend의 `{{{RESEND_UNSUBSCRIBE_URL}}}`)

**2. 설정** (`src/config/index.ts`):
```typescript
brandName: '내 뉴스레터 이름'
subscribeUrl: 'https://yourdomain.com/subscribe'
```

**3. 크롤링 타겟** (`src/config/crawling-targets.ts`):
- 한국 문화유산 사이트를 내 도메인의 소스로 교체
- `src/parsers/`에 파서 구현

**4. LLM 프로바이더 변경** (옵션):

OpenAI 대신 Anthropic/Gemini/Ollama를 사용하려면:
- `src/newsletter-generator.ts`: `createOpenAI()`를 해당 프로바이더로 변경
- `src/providers/analysis.provider.ts`: 모델명 변경 (현재 `gpt-5-mini`, `gpt-5.1`)
- `src/providers/content-generate.provider.ts`: 모델명 변경

[Vercel AI SDK provider](https://sdk.vercel.ai/providers)를 모두 사용할 수 있습니다.

**검색 키워드**: `heripo`, `김홍연`, `#D2691E`, `openai`, `gpt-5`

## 왜 코드 기반일까?

코드 기반 자동화는 고급 AI 기법을 활용해 **뛰어난 결과물**을 만들어냅니다:

**No-code 플랫폼**: 범용 콘텐츠, 제한된 기본 기능
**이 키트**: 자기성찰, 사고 과정, 다단계 검증 워크플로우

**핵심 장점**:
- **품질**: 정교한 프롬프팅 전략, 커스텀 검증 파이프라인
- **비용 제어**: 단계별 모델 선택, 토큰 제한, 재시도 로직
- **유연성**: Provider 인터페이스로 컴포넌트 자유롭게 교체 (Crawling/Analysis/Content/Email)
- **운영**: 재시도, 미리보기 이메일, CI/CD 통합 내장
- **독립성**: 오픈소스, 자체 호스팅 가능, 모든 LLM 프로바이더 지원

**설계 철학**:
- 코드는 로직 담당 (오케스트레이션, 중복 제거)
- AI는 추론 담당 (분석, 점수 매기기, 콘텐츠 생성)
- 아키텍처는 연결 담당 (교체 가능한 Provider)

## 관련 프로젝트

- [`@llm-newsletter-kit/core`](https://github.com/heripo-lab/llm-newsletter-kit-core) — 도메인 독립적인 뉴스레터 엔진
- [대형 언어 모델(LLM)을 활용한 고고학 정보화 연구](https://poc.heripo.com) — 학술 연구
