# heripo Research Radar

English | [한국어](./README-ko.md)

[![CI](https://github.com/heripo-lab/heripo-research-radar/actions/workflows/ci.yml/badge.svg)](https://github.com/heripo-lab/heripo-research-radar/actions/workflows/ci.yml)
[
![npm version](https://img.shields.io/npm/v/%40heripo%2Fresearch-radar?logo=npm&color=cb0000)
](https://www.npmjs.com/package/@heripo/research-radar)
![license](https://img.shields.io/github/license/heripo-lab/heripo-research-radar)
![node](https://img.shields.io/badge/node-%3E%3D24-brightgreen)

[Code of Conduct](./CODE_OF_CONDUCT.md) • [Security Policy](./SECURITY.md) • [Contributing](./CONTRIBUTING.md)

## What is this?

An AI-powered newsletter service for Korean cultural heritage. Built on [`@llm-newsletter-kit/core`](https://github.com/heripo-lab/llm-newsletter-kit-core), it's both a production service ([live at heripo.app](https://heripo.app/research-radar/subscribe)) and a reference implementation showing how to build automated newsletters with LLMs.

This package provides crawling, analysis, content generation, and email templates. The hosted service supplies database repositories, scheduling, subscriber management, and email delivery separately.

Previously reported service metrics were $0.2–1 per issue and 15% CTR. These are historical figures, not benchmarks for the current models or deployment.

**Technical highlights**:

- Type-safe TypeScript with strict interfaces
- Provider pattern for swapping components (Crawling/Analysis/Content/Email)
- 59 active crawling targets across heritage agencies, museums, academic societies
- Multi LLM providers: OpenAI GPT-5 (analysis) + selectable content generation (OpenAI / Anthropic / Google)
- Built-in retries, chain options, preview emails

**Links**: [Live service](https://heripo.app/research-radar/subscribe) • [Newsletter example](https://heripo.app/research-radar-newsletter-example.html) • [Core engine](https://github.com/heripo-lab/llm-newsletter-kit-core)

## Background

Created by archaeologist-turned-engineer Hongyeon Kim to answer: "Why must research rely on labor-intensive manual work?"

A personal script evolved into a production service after completing research on [Archaeological Informatization Using LLMs](https://poc.heripo.org). This repository open-sources the running service so developers can build
domain-specific newsletters without starting from scratch.

## License

Apache License 2.0 — see [LICENSE](./LICENSE) and [NOTICE](./NOTICE) for details.

## Citation & Attribution

If you fork this project to build your own newsletter service or use this code in your research, please include the following attribution:

```
Powered by LLM Newsletter Kit
```

We recommend adding this notice to your newsletter template footer or service documentation. This attribution helps support the project and its continued development.

### BibTeX Citation

For academic publications:

```bibtex
@software{heripo research radar,
  author = {Kim, Hongyeon},
  title = {heripo research radar},
  year = {2025},
  url = {https://github.com/heripo-lab/heripo-research-radar},
  note = {Apache License 2.0}
}
```

## Installation

```bash
npm install @heripo/research-radar '@llm-newsletter-kit/core@~3.0.0'
```

**Requirements**: Node.js >= 24 and an ESM application. The package exports `dist/index.js` and TypeScript declarations (`dist/index.d.ts`), with a JavaScript sourcemap. The core engine is a peer dependency; the current supported range is `~3.0.0`.

Article analysis requires an OpenAI API key. Content generation requires a key for the selected provider (OpenAI / Anthropic / Google); OpenAI can use the same key for both. Keys are passed explicitly to the library; load environment variables in your application.

## Quick Start

Implement the four repository interfaces for your storage layer, then call this application-level wrapper. The repositories in this example are supplied by the caller; no database adapter is bundled.

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
    console.log('No newsletter was created for this run.');
    return null;
  }

  console.log('Saved newsletter:', newsletterId);
  return newsletterId;
}
```

`generateNewsletter()` returns `Promise<string | number | null>`: the saved newsletter ID, or `null` when no issue is created (for example, when publication criteria are not met). Generation errors can reject the promise. The internal `createNewsletterGenerator()` factory is not exported.

### Repository contracts

All interfaces are exported from the package root and defined in [src/types/dependencies.ts](./src/types/dependencies.ts). Article and newsletter data types come from `@llm-newsletter-kit/core`.

| Repository             | Method                                         | Required result                                                                  |
| ---------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------- |
| `TaskRepository`       | `createTask()`                                 | `Promise<number>` — task ID, not a task record                                   |
|                        | `completeTask(taskId)`                         | `Promise<void>`                                                                  |
| `ArticleRepository`    | `findByUrls(urls)`                             | `Promise<ParsedTarget[]>` for deduplication                                      |
|                        | `saveCrawledArticles(articles, context)`       | `Promise<number>` — saved count; preserve task, target group, and target context |
|                        | `findUnscoredArticles()`                       | `Promise<UnscoredArticle[]>`                                                     |
|                        | `updateAnalysis(article)`                      | `Promise<void>`                                                                  |
|                        | `findCandidatesForNewsletter()`                | `Promise<ArticleForGenerateContent[]>`                                           |
| `TagRepository`        | `findAllTags()`                                | `Promise<string[]>`                                                              |
| `NewsletterRepository` | `getNextIssueOrder()`                          | `Promise<number>`                                                                |
|                        | `saveNewsletter({ newsletter, usedArticles })` | `Promise<{ id: string \| number }>`                                              |

Candidate selection belongs to your repository. Persist `usedArticles` associations as needed to exclude previously published content. Issue numbering is initialized before the pipeline starts; coordinate concurrent runs in your application or database. `TaskService` tracks an active task within one service instance, not across processes or separate `generateNewsletter()` calls.

### Optional generation settings

| Option                   | Behavior                                                                                                                                             |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `logger`                 | Core `AppLogger` implementation, such as `console`                                                                                                   |
| `publishDate`            | A real calendar date in `YYYY-MM-DD` format; invalid values throw. Defaults to the current date in `Asia/Seoul` (KST), regardless of server timezone |
| `customFetch`            | A `typeof fetch` implementation for crawling and parser API requests, such as a proxy adapter; does not configure LLM requests                       |
| `templateOptions`        | Default or KRAS newsletter branding and Markdown sections (see below)                                                                                |
| `promptProvider`         | Core `PromptProvider` overriding the package's own LLM prompts entirely; omit to use the package's prompts, which fall back to core's defaults       |
| `excavationReportSource` | Supplies 국가유산청 발굴조사 보고서 entries from the application; that board is then never crawled. Omit to crawl it as before                       |
| `previewNewsletter`      | Fetch a saved `Newsletter` and send it through a supplied core `EmailService`                                                                        |

`previewNewsletter` requires `fetchNewsletterForPreview: () => Promise<Newsletter>`, `emailService` (with `send(message)`), and `emailMessage` (core `EmailMessage` without `subject`, `html`, or `text`). The core fills those three fields and skips preview delivery when no newsletter was created. Ensure the callback fetches the issue saved by this run.

Production integration must also supply a scheduler, subscriber storage, bulk delivery, and unsubscribe handling. The daily parser health-check workflow does not generate or distribute newsletters.

## Architecture

**Pipeline**: Crawling → Analysis → Content Generation → Save

1. **Crawling**: Fetch articles from target websites
2. **Analysis**: LLM tags and scores articles
3. **Generation**: Create newsletter from top-scoring articles
4. **Save**: Store and optionally send preview email

Uses the **Provider-Service pattern** from `@llm-newsletter-kit/core`. See [core docs](https://github.com/heripo-lab/llm-newsletter-kit-core#architecture--flow) for flow diagrams.

## Configuration and models

Defaults below describe the checked-in code, not provider recommendations. This package uses AI SDK 7 and the OpenAI, Anthropic, and Google SDK adapters.

| Stage              | Provider  | Default model            |
| ------------------ | --------- | ------------------------ |
| Tag classification | OpenAI    | `gpt-5.6-luna`           |
| Image analysis     | OpenAI    | `gpt-5.6-terra`          |
| Importance scoring | OpenAI    | `gpt-5.6-terra`          |
| Content generation | OpenAI    | `gpt-5.6-sol`            |
| Content generation | Anthropic | `claude-sonnet-4-6`      |
| Content generation | Google    | `gemini-3.1-pro-preview` |

Select content generation with `contentGeneration: { provider, apiKey, model? }`. `model` overrides that provider's default. Analysis models are configured in [analysis.provider.ts](./src/providers/analysis.provider.ts).

[src/config/index.ts](./src/config/index.ts) defines Korean output (`outputLanguage: '한국어'`), the cultural heritage domain (`expertField: ['문화유산']`), brand name, `subscribePageUrl`, LLM `maxRetries: 5`, chain `stopAfterAttempt: 3`, and generation `temperature: 0.3`. Publication settings are `minimumArticleCountForIssue: 5` and `priorityArticleScoreThreshold: 8`; the core engine evaluates them. In the locked core 3.0.4 implementation, the count check skips **5 or fewer** candidates unless at least one has importance score >= 8. An empty candidate list is always skipped.

## Crawling targets and parsers

[src/config/crawling-targets.ts](./src/config/crawling-targets.ts) currently defines these board targets (multiple boards may belong to one organization):

| Group      | Active | Commented out |
| ---------- | -----: | ------------: |
| News       |     48 |            10 |
| Business   |      4 |             0 |
| Employment |      7 |             3 |
| **Total**  | **59** |        **13** |

The 13 commented targets are excluded from runtime configuration: one excavation status board is marked as low-value fragmented data, and 12 museum boards are marked as restricted by robots.txt. Their parser code remains in the repository.

Sources include the Korea Heritage Service, National Research Institute of Cultural Heritage, National Research Institute of Maritime Heritage, Korea Heritage Agency, Korea Association of Archaeological Heritage, archaeological societies, and national museums.

[src/parsers/](./src/parsers/) contains 20 organization-specific parser modules plus shared date and URL utilities. List parsers return `ParsedTargetListItem[]` (title, date, detail URL, date type, and optional source ID); detail parsers return Markdown `detailContent` and attachment/image flags. Parsers can be synchronous or asynchronous. KRAS, Yeongnam Archaeological Society, and maritime heritage sources use additional API requests for client-rendered content.

`CrawlingProvider` uses a maximum concurrency of 5 and wraps the supplied fetch to route KRAS public detail URLs to its detail API, while retaining public URLs in article metadata. When constructing your own pipeline, use the provider's fetch together with its target groups.

To display the active sources without crawling:

```typescript
import { getSourceList } from '@heripo/research-radar';

const groups = getSourceList(); // [{ id, name, sources: [{ id, name, url }] }]
```

`createCrawlingTargetGroups(customFetch?)`, `getSourceList()`, `contentOptions`, `newsletterConfig`, `llmConfig`, and `researchRadarPromptProvider` are public exports. `ExcavationReport` and `ExcavationReportSource` are exported as types. The package also exports the three provider classes, `DateService`, `TaskService`, and their public configuration/dependency types through [src/index.ts](./src/index.ts).

## Email templates

[src/templates/](./src/templates/) contains the responsive newsletter template, welcome email template, and shared logos, introduction, sanitization, and footer components. Templates include light/dark mode styles and heripo/KRAS variants. Markdown sections are converted with `safe-markdown2html`; welcome email names are sanitized with DOMPurify and CSS is inlined with `juice`.

`NewsletterTemplateOptions` supports:

| Option                  | Purpose                                                                                                                                            |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `isKrasNewsletter`      | Enable KRAS branding, the 50th-anniversary header, archaeology-first expertise, free-form introduction, and the brand name `한국고고학회 뉴스레터` |
| `krasNewsMarkdown`      | Society news before generated content                                                                                                              |
| `heripolabNewsMarkdown` | heripo lab news before generated content                                                                                                           |
| `krasNoticeMarkdown`    | Society notices after generated content                                                                                                            |
| `titleContext`          | Title-generation context, only when `isKrasNewsletter: true`; an empty string is ignored                                                           |
| `displayDate`           | Header date; `generateNewsletter()` replaces it with the date resolved by `DateService` when template options are supplied                         |

The three Markdown sections are available in either branding mode.

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

`generateWelcomeHTML(id, name, options?)` returns `Promise<string>` and only renders HTML. `siteUrl` defaults to `https://heripo.app`; unsubscribe links use `/research-radar/unsubscribe?id=...`. Newsletter templates retain Resend's `{{{RESEND_UNSUBSCRIBE_URL}}}` marker, which your delivery integration must resolve or replace. The raw newsletter template factory and shared HTML helpers are internal, not package-root exports.

## Development commands

```bash
# Install development dependencies from the lockfile
npm ci

# build
npm run clean              # remove dist/
npm run build              # clean dist/ and build with Rollup (ESM + types)

# type-check & lint
npm run lint               # lint source files
npm run lint:fix           # lint with autofix
npm run lint:ci            # quiet CI lint
npm run typecheck          # TypeScript type-check

# formatting
npm run format             # format src/ with Prettier
npm run format:check       # check src/ formatting
```

The build emits ESM, declarations, and a JavaScript sourcemap; runtime dependencies remain external. CI runs `npm ci`, `format:check`, `lint:ci`, `typecheck`, and `build` on Node.js 24.x for pull requests and manual dispatch. Formatting scripts cover `src/`; to check the READMEs explicitly, run `npx prettier --check README.md README-ko.md`. There is no `npm test` script.

For maintainers, `release` publishes to npm, while `release:patch`, `release:minor`, and `release:major` bump the version and publish. The version hooks build first and push commits/tags; `prepublishOnly` builds before publishing.

### Crawler Debugger

A web-based tool for testing crawling parsers during development. Built with Express.js and vanilla HTML/CSS/JS to minimize dependencies.

```bash
npm run dev:crawler        # Start at http://localhost:3333
npm run dev:crawler:proxy  # Load dev-tools/crawler-debugger/.env
```

For proxy use, create the gitignored `dev-tools/crawler-debugger/.env` file with your proxy endpoint:

```dotenv
PROXY_URL=http://127.0.0.1:8080
```

The library itself receives a `customFetch` function; it does not read `PROXY_URL`.

**Features**:

- Test `parseList()` and `parseDetail()` parsers via web UI
- View raw HTML source for debugging
- Copy parsed results as JSON
- 5-minute response cache (with skip/clear options)
- Timing info for fetch and parse operations

### Newsletter Preview

Preview rendered newsletter HTML with sample content.

```bash
npm run dev:newsletter-preview  # Start at http://localhost:3334
```

Use the UI controls, or open `/api/preview?kras=true&krasNews=true&krasNotice=true&heripolabNews=true` on port 3334. These query parameters belong to `/api/preview`, not the root UI URL. Each section switch includes sample Markdown; this preview does not call an LLM.

### Welcome Email Preview

Preview rendered welcome email HTML.

```bash
npm run dev:welcome-preview  # Start at http://localhost:3335
```

Use the UI controls, or open `/api/preview?kras=true&name=홍길동` on port 3335. No API key is needed for either HTML preview tool.

### Parser Health-Check

CLI tool that validates all active crawling parsers against live websites. Detects silent failures (empty results, broken selectors) caused by upstream website redesigns.

```bash
npm run health-check        # Run health-check
npm run health-check:proxy  # Load the same .env and pass --proxy
npm run health-check -- --skip-khs-excavation  # Skip KHS excavation report/site-open targets
```

**What it checks per target**:

- `parseList()`: Non-empty array; checks the first item for non-empty title/date and a detailUrl starting with `http`
- `parseDetail()`: Fetches the first detail item and checks trimmed `detailContent` length >= 20

Use repeatable `--skip-target=<id-or-name>` or `--skip-target <id-or-name>` to exclude targets by exact ID or name. `npm run health-check -- --help` lists options without crawling. This is a live-site smoke check of the first item per target, not full article validation; it does not invoke LLM analysis. The script exits with code 1 if any checked target fails.

**Output**: Console table summary + compact text summary for CI integrations.

**CI**: [.github/workflows/parser-health-check.yml](./.github/workflows/parser-health-check.yml) runs daily at 08:00 UTC (17:00 KST), or manually, on an `org-linux` runner with a 30-minute job timeout. It skips the two KHS excavation report/site-open targets (57 targets checked with the current configuration). Slack notifications require the `SLACK_BOT_TOKEN` secret and `SLACK_ALERT_DEV_CHANNEL` repository variable. Forks need a matching runner and notification configuration to use this workflow unchanged. The CLI also writes GitHub Actions outputs and a job summary when their environment variables are present.

## 🤝 Contributing

You can use this project in two ways:

1. Contribute directly to Heripo Research Radar: bug fixes, improvements, new crawl targets
2. Build your own newsletter: fork this repo and adapt it to your domain

See [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution workflow, dev setup, and PR guidelines.

## Forking for Your Domain

To build your own newsletter, update these files:

**1. Templates** (`src/templates/newsletter-html.ts`, `welcome-html.ts`, `shared.ts`):

- Logo URLs, brand colors (#D2691E, #E59866), contact info
- Platform intro and footer text
- Unsubscribe link format (currently Resend's `{{{RESEND_UNSUBSCRIBE_URL}}}`)

**2. Config** (`src/config/index.ts`):

```typescript
import type { NewsletterConfig } from '@heripo/research-radar';

export const newsletterConfig: NewsletterConfig = {
  brandName: 'Your Newsletter Name',
  subscribePageUrl: 'https://yourdomain.com/subscribe',
  publicationCriteria: {
    minimumArticleCountForIssue: 5,
    priorityArticleScoreThreshold: 8,
  },
};
```

**3. Crawling targets** (`src/config/crawling-targets.ts`):

- Replace Korean heritage sites with your domain sources
- Implement parsers in `src/parsers/`

**4. Switch content generation LLM provider** (optional):

Content generation supports **3 built-in providers** — just change `contentGeneration.provider`:

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

Default models: openai=`gpt-5.6-sol`, anthropic=`claude-sonnet-4-6`, google=`gemini-3.1-pro-preview`

To change analysis providers, update both `src/providers/analysis.provider.ts` (provider type and models) and `src/newsletter-generator.ts` (provider construction), using a compatible AI SDK provider. Also adapt domain-specific minimum-score rules in the analysis provider, output language and expert fields in config, package metadata, and the GitHub Actions runner/Slack settings for your fork.

**Search keywords**: `heripo`, `kimhongyeon`, `#D2691E`, `openai`, `gpt-5`, `contentGeneration`

## Why Code-Based?

The domain logic is inspectable in source: parser behavior, model selection, score rules, publication settings, and HTML templates can be versioned together. Repository and provider interfaces let applications integrate existing storage and delivery systems, while the core engine supplies orchestration and retry handling.

## Related Projects

- [`@llm-newsletter-kit/core`](https://github.com/heripo-lab/llm-newsletter-kit-core) — Domain-agnostic newsletter engine
- [Archaeological Informatization Using LLMs](https://poc.heripo.org) — Academic research (Korean)

## Sponsor

If you'd like to support heripo lab's open-source research, you can sponsor us through:

- [Open Collective](https://opencollective.com/heripo-project) for general project sponsorship.
- [fairy.hada.io/@heripo](https://fairy.hada.io/@heripo) for Korean individual supporters who prefer KRW payments.
