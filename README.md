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
- 73 active crawling targets across heritage agencies, museums, academic societies, filtered at runtime by robots.txt, plus newly published journal issues injected by the application
- OpenAI GPT-6 defaults for every LLM task, with per-task model overrides
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
npm install @heripo/research-radar '@llm-newsletter-kit/core@~3.1.1'
```

**Requirements**: Node.js 24.22.1 or newer within 24.x, or >= 26.12.1, and an ESM application. Node.js 25 is not supported. The package exports `dist/index.js` and TypeScript declarations (`dist/index.d.ts`), with a JavaScript sourcemap. The core engine is a peer dependency; the current supported range is `~3.1.1`. Core 3.1.1 is required for recent-title guarding and source-grounded deadline extraction. It also includes the crawl-timeout retry handling and generation self-verification retry cap required by Radar.

An OpenAI API key is always required and supplies all default models. The optional compatibility path for Anthropic or Google newsletter generation additionally requires that provider's key. Keys are passed explicitly to the library; load environment variables in your application.

### Transitive dependency security

This repository's `package-lock.json` resolves the audited dependencies for development and CI. Consumers use their own lockfiles, so upgrading this library alone does not guarantee that an existing vulnerable transitive dependency is replaced. The current AI SDK and Cheerio dependency ranges still allow `undici` 7.29.0.

For npm applications, merge the following into the **application's root `package.json`** to require a patched undici 7.x version. Overrides declared by an installed library are ignored by npm ([npm overrides documentation](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#overrides)). The selector leaves undici 8.x, used by jsdom, unchanged.

```json
{
  "overrides": {
    "undici@>=7.0.0 <7.30.0": "^7.30.0"
  }
}
```

Run `npm install`, inspect `npm ls undici`, and run `npm audit`, then commit the application's updated lockfile. If your application directly depends on undici 7.x, update that direct dependency to `^7.30.0` as well. A clean audit of this repository does not certify a consumer's dependency graph.

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

### Recent titles and source deadlines

These APIs use the published core 3.1.1 package. The peer dependency requires
`~3.1.1`, and `npm ci` installs the locked package without a local core link.

- Implement optional `NewsletterRepository.findRecentPublishedTitles({ fromInclusive, toExclusive })`
  to enable the title guard. Radar supplies the seven calendar days before the
  publication date (exclusive). Return titles only from actually published issues
  of the same newsletter/audience. Drafts and failed sends are excluded. The core
  compares normalized titles and allows at most two title-only repairs.
- Pass `extractDeadlineOptions: {}` to extract deadlines during article analysis
  with the importance model, or `{ model }` for a separate OpenAI ID/AI SDK model.
  Persist `article.deadlines` in `updateAnalysis`: `[]` means extracted without
  supported deadlines; `undefined` means not extracted/failed. Clear the cache
  when the source changes. Omit the option to keep existing analysis calls.
- Add `includeEvents: true` to `extractDeadlineOptions` to also extract conference,
  workshop and public site visit schedules. Registration cutoffs and attendance
  dates are distinct entries. Events retain `type: 'event'`, start `date`/`time`,
  and optional `endDate`/`endTime`; missing times are never invented.
  The default remains deadline-only. Analysis preserves existing event caches
  when the flag is disabled. Re-extract historical caches, including empty
  arrays, when enabling events for previously analyzed articles.
- `extractResearchRadarDeadlines({ model, article: { title, detailContent } })`
  provides the same original-source extraction for host-managed backfill and
  verification. Pass `includeEvents: true` here and to
  `refreshResearchRadarDeadlines()` to include events. It does not fetch URLs
  or activate reminders.

The host activates reminders only after an article is actually included in a
published issue. Core's `usedArticles` is the candidate array, including articles
the editor may omit; it is not evidence of actual inclusion. The host selects
actually included articles from the preceding 60 days for the one-time backfill,
stores deadlines separately, and selects only imminent reminders for each issue.
Historical issue bodies are not passed into generation.

Before reminding, call `refreshResearchRadarDeadlines({ source: { title, url,
targetUrl }, model, customFetch?, publicDataApiKey? })`. It fetches the registered
detail through the same adapters and robots rules as crawling, with a 15-second
total network budget. Job APIs fetch one posting; 나라장터 queries only that
notice number's revisions and returns the latest revision's URL. No daily list,
triage, scoring or persistence runs. `fetchResearchRadarDeadlineSource()` is
available separately for source-only reads (`status: 'fetched'`).

Dates and times must match their verbatim evidence. Even an unchanged source
hash cannot reuse a cache that fails the current grounding rules; it is extracted
again. Unsupported values hold the reminder.

- `status: 'verified'` includes the fresh article, deadlines, `sourceHash`,
  `checkedAt` and model usage. Explicit extensions use the new date; explicit
  cancellations have `status: 'cancelled'`. Passing `previous: { sourceHash,
deadlines }` from a successful refresh skips extraction only if a fresh fetch
  has the same hash and event extraction mode. Preserve the returned
  `includeEvents` metadata in `previous`; absent metadata means deadline-only,
  so enabling events forces extraction even if the source hash is unchanged.
  Invalidate this cache when other extraction policy changes.
- `status: 'unverified'` includes a reason, without deadlines. Missing dates,
  access failures, unsupported boards and extraction failures hold reminders;
  they never cancel a stored action. Even a verified source does not confirm all
  past actions: the host must match each action and hold unmatched ones. A
  separate announcement at another URL is outside this targeted check.

Pass host-selected verified actions to
`renderVerifiedDeadlineReminders(reminders, publicationDate)` and place its result
in `templateOptions.deadlineRemindersMarkdown`. Active deadlines/events from
D-3 through today take priority; ongoing events through a known end date fill
any remaining slots. Each group is ordered by date and time, with at most ten
entries overall (`DEADLINE_REMINDER_LEAD_DAYS`, `DEADLINE_REMINDER_LIMIT`). It preserves supplied periods and times
without inventing 23:59. The heading is **다가오는 일정·마감**. Today's entries say
**오늘 마감**, **오늘 개최** or **오늘 공개**, while ongoing events say **진행 중**.
An event's start time is not a cutoff: only its stated end time expires it during
the end date. Without an end date, it is listed only through its start date. The provider appends it to saved Markdown and HTML after
generation, so reminders add no article-generation context. The host owns
reminder scheduling, repeat suppression and publication history. Empty sections are omitted.

Prefer `templateOptions.verifiedDeadlineReminders` with freshly verified historical
actions. The provider merges these with source-grounded deadlines from articles
actually linked in the generated body and displays at most ten eligible
deadlines/events in one linked section. `generateNewsletter()` asks the
importance model to choose those rows from every eligible entry: it answers with
candidate indices only, favours actions readers can take, keeps D-1 to D-3
alongside today's entries and drops the same event announced by several
sources. Titles, dates and links are always rendered from the verified rows,
and an error, a 60-second timeout or an unusable answer falls back to the first
ten by date. A short selection is filled in date order, skipping the rows the
model named as duplicates. Set
`recentReminderCount` on a reminder to tell the selection how many issues in
the past week already listed it. Deduplication includes the
entry type, so a registration cutoff cannot replace an attendance schedule.
Event identity also includes the start/end dates and times, preserving separate
occurrences with the same title and kind. Deadline action deduplication is unchanged.
For a refreshed source,
only freshly verified actions are eligible: unmatched cached actions are held,
never inferred to be active or cancelled from free-form `title` or `kind` labels.
G2B revisions share a source identity by notice number. Pass each distinct action
as a freshly verified result to retain multiple actions from that source. Other
sources without supplied verification continue using grounded article deadlines.
The older
`deadlineRemindersMarkdown` option remains available for pre-rendered sections.
The generation prompt no longer produces a separate closing schedule list.
The colleague-sharing notice follows the highlighted schedule/deadline section
in both saved Markdown and HTML; no eligible entries means no empty section.
Set `templateOptions.shareNoticeMarkdown` to customize this notice in both
formats, omit it for the default, or pass an empty string to suppress it.

### Optional generation settings

| Option                   | Behavior                                                                                                                                             |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `logger`                 | Core `AppLogger` implementation, such as `console`                                                                                                   |
| `publishDate`            | A real calendar date in `YYYY-MM-DD` format; invalid values throw. Defaults to the current date in `Asia/Seoul` (KST), regardless of server timezone |
| `customFetch`            | A `typeof fetch` implementation for crawling and parser API requests, such as a proxy adapter; does not configure LLM requests                       |
| `templateOptions`        | Default or KRAS newsletter branding and Markdown sections (see below)                                                                                |
| `promptProvider`         | Core `PromptProvider` overriding the package's own LLM prompts entirely; omit to use the package's prompts, which fall back to core's defaults       |
| `excavationReportSource` | Supplies 국가유산청 발굴조사 보고서 entries from the application; that board is then never crawled. Omit to crawl it as before                       |
| `journalIssueSource`     | Supplies newly published journal issues (such as KCI) from the application, one article per issue. Omit and that target collects nothing             |
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

Defaults below describe the checked-in code, not provider recommendations. `openAIApiKey` is required and supplies every default model.

| Stage                 | Provider | Default model |
| --------------------- | -------- | ------------- |
| Heritage bid triage   | OpenAI   | `gpt-6-luna`  |
| Tag classification    | OpenAI   | `gpt-6-luna`  |
| Image analysis        | OpenAI   | `gpt-6-sol`   |
| Importance scoring    | OpenAI   | `gpt-6-sol`   |
| Newsletter generation | OpenAI   | `gpt-6-sol`   |

Override any task independently with `models`. Each value accepts an OpenAI model ID string or the installed `ai` package's public `LanguageModel` type. Strings use `openAIApiKey`; provider model objects are passed through unchanged and use their own provider configuration. Omitted or `undefined` fields retain the defaults in `llmConfig.models`:

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

Mix model ID strings and provider objects in the same configuration:

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

The optional `contentGeneration: { provider, apiKey, model? }` compatibility path still supports Anthropic and Google for newsletter generation. `models.generateNewsletter` takes precedence when both are supplied. If `models.generateNewsletter` is omitted or `undefined`, the existing `contentGeneration` provider/model selection applies; without either option, generation uses `llmConfig.models.generateNewsletter`. `openAIApiKey` remains required even when supplying model objects for every stage.

[src/config/index.ts](./src/config/index.ts) defines Korean output (`outputLanguage: '한국어'`), the cultural heritage domain (`expertField: ['문화유산']`), brand name, `subscribePageUrl`, LLM `maxRetries: 5`, chain `stopAfterAttempt: 3`, and generation `temperature: 0.3`. Publication settings are `minimumArticleCountForIssue: 5` and `priorityArticleScoreThreshold: 8`; the core engine evaluates them. In the locked core 3.1.1 implementation, the count check skips **5 or fewer** candidates unless at least one has importance score >= 8. An empty candidate list is always skipped.

## Crawling targets and parsers

[src/config/crawling-targets.ts](./src/config/crawling-targets.ts) currently defines these board targets (multiple boards may belong to one organization):

| Group      | Active | Commented out |
| ---------- | -----: | ------------: |
| News       |     56 |             1 |
| Business   |      5 |             0 |
| Employment |     12 |             0 |
| **Total**  | **73** |         **1** |

Only the excavation status board stays commented out, as low-value fragmented data. Boards that a site's robots.txt restricts are configured normally and refused at runtime by the robots.txt check, so the configuration does not have to track each site's policy by hand. With current policies 14 of the 73 targets are refused.

Three targets are read from data.go.kr open APIs instead of scraped: 나라일터 (`PblJobService`) and 알리오 (`recruitment`) under Employment, and 나라장터 (`BidPublicInfoService`) under Business. Each is a single round of requests, and `publicDataApiKey` supplies the service key — omit it and they answer with an empty list without making a request. The boards carry every public-sector vacancy and procurement notice in the country, so both are narrowed before analysis. The job boards use `src/crawling/heritage-job-filter.ts`, whose exclusions are role nouns and hold up as patterns; roughly 2% of postings survive, about 2.6 a day. 나라장터 instead uses `src/crawling/heritage-triage.ts`, which asks a cheap model about 100 titles per request: heritage vocabulary cannot be settled by substring in Korean, and the deterministic filter remains behind it as the fallback when a batch fails.

Newly published journal issues are not crawled. The application supplies them through `journalIssueSource` — heripo-web reads them from its KCI paper catalog — and the `KCI_학술지_신간` target serves them from that source, so its URL is never requested. Each issue (권호) becomes one article: its `uniqId` is the issue's `externalId` and its URL the issue's `url`. `usedArticles` carry only the application's article id and URL, so the application records which issues a saved newsletter introduced through the `uniqId` it stored in `saveCrawledArticles`, or through the issue URL. The article body, which scoring sees, lists every paper with its authors, keywords and an abstract truncated to 300 characters, after the keywords several papers share. Without a source the target answers with an empty list. This replaces the former crawl of the 국립문화유산연구원 헤리티지:역사와 과학 and 보존과학연구 boards.

The generation model never writes about these issues. `ContentGenerateProvider` takes them out of its candidates and renders a `📖 새로 나온 학술지` section itself, placed after `🎓 학술대회·학술행사` and before `📋 발굴조사보고서 (신규 제출)`. When that section is missing it goes before the next fixed category present (`⛏️ 발굴현장 공개`, `💼 채용·공고`, `📑 사업·입찰 공고`, then `📌 마무리`). Each issue links to its KCI table of contents and shows, as a table with their authors, the papers its readers would want to read, most interesting first; the rest are collapsed into a count and their topics. The criterion is the readers' interest, not academic discipline — a 역사학 paper can be left out and a non-archaeology one shown — and the readers are 한국고고학회 회원 in KRAS mode. The importance model only chooses and orders paper indices and names the topics of the papers it leaves out — titles, links and authors come from the injected data. If the selection fails or times out, every paper is listed; if the run cannot load the issues, the articles go to the model as ordinary candidates. The held-aside articles are appended to `usedArticles`, so they are recorded with the issue even though the model never saw them. As a result the title, briefing and 마무리 do not mention journals, and journal issues do not count toward the publication criteria.

Crawling fetches pass through that check (`src/crawling/robots.ts`) before reaching the network: a disallowed request is refused rather than sent, and a missing or unreachable robots.txt allows it. `robotsExemptOrigins` in `src/config/index.ts` lists origins exempted from the check, each with its reason.

Sources include the Korea Heritage Service, National Research Institute of Cultural Heritage, National Research Institute of Maritime Heritage, Korea Heritage Agency, Korea Association of Archaeological Heritage, archaeological societies, and national museums.

[src/parsers/](./src/parsers/) contains 24 parser modules (23 organization-specific, plus the injected journal issue adapter) plus shared date and URL utilities. List parsers return `ParsedTargetListItem[]` (title, date, detail URL, date type, and optional source ID); detail parsers return Markdown `detailContent` and attachment/image flags. Parsers can be synchronous or asynchronous. KRAS, Yeongnam Archaeological Society, and maritime heritage sources use additional API requests for client-rendered content.

`CrawlingProvider` uses a maximum concurrency of 5 and wraps the supplied fetch to route KRAS public detail URLs to its detail API, while retaining public URLs in article metadata. When constructing your own pipeline, use the provider's fetch together with its target groups.

To display the active sources without crawling:

```typescript
import { getSourceList } from '@heripo/research-radar';

const groups = getSourceList(); // [{ id, name, sources: [{ id, name, url }] }]
```

`createCrawlingTargetGroups(customFetch?)`, `getSourceList()`, `contentOptions`, `newsletterConfig`, `llmConfig`, `researchRadarPromptProvider`, and `JOURNAL_ISSUE_LIST_URL` (the journal issue target's URL, for finding the issue articles an application saved) are public exports. `ExcavationReport`, `ExcavationReportSource`, `JournalIssue`, `JournalIssuePaper`, and `JournalIssueSource` are exported as types. The package also exports the three provider classes, `DateService`, `TaskService`, and their public configuration/dependency types through [src/index.ts](./src/index.ts).

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
npm run typecheck          # TypeScript type-check (source and tests)
npm test                   # offline model configuration regression tests

# formatting
npm run format             # format src/ with Prettier
npm run format:check       # check src/ formatting
```

The build emits ESM, declarations, and a JavaScript sourcemap; runtime dependencies remain external. CI runs `npm ci`, `format:check`, `lint:ci`, `typecheck`, `npm test`, and `build` on the minimum supported versions for Node.js 24 and 26 (24.22.1 and 26.12.1), the latest 24.x, and the latest 26.x for pull requests and manual dispatch. Formatting scripts cover `src/`; to check the READMEs explicitly, run `npx prettier --check README.md README-ko.md`. `npm test` uses Node's experimental module mocking and the installed AI SDK test utilities; it makes no LLM, crawling, or email requests.

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

**What it checks per crawling target**:

- `parseList()`: Non-empty array; checks the first item for non-empty title/date and a detailUrl starting with `http`
- `parseDetail()`: Fetches the first detail item and checks trimmed `detailContent` length >= 20

For the public-data APIs (ALIO, 나라일터, 나라장터), it sends the configured `PUBLIC_DATA_API_KEY` directly to each list endpoint with `numOfRows=1` and checks only for HTTP 200. 나라장터 probes both service and construction endpoints. Response bodies, result codes, list contents, and details are not validated. These three targets are skipped when the key is missing.

Use repeatable `--skip-target=<id-or-name>` or `--skip-target <id-or-name>` to exclude targets by exact ID or name. `npm run health-check -- --help` lists options without crawling. This is a live-site smoke check of the first item per target, not full article validation; it does not invoke LLM analysis. The script exits with code 1 if any checked target fails.

**Output**: Console table summary + compact text summary for CI integrations.

**CI**: [.github/workflows/parser-health-check.yml](./.github/workflows/parser-health-check.yml) runs daily at 08:00 UTC (17:00 KST), or manually, on an `org-linux` runner with a 30-minute job timeout. It skips the two KHS excavation report/site-open targets. For crawling targets, the health-check composes the same fetch as production — robots.txt gate, then the KRAS detail adapter — so disallowed boards are reported as skipped rather than failed: 17 skipped (including the injected journal issue target, which has no live board) and 53 checked with the current configuration. The detail check tries up to three list items, so one unreadable post at the top of a board does not fail the target. Slack notifications require the `SLACK_BOT_TOKEN` secret and `SLACK_ALERT_DEV_CHANNEL` repository variable. Forks need a matching runner and notification configuration to use this workflow unchanged. The CLI also writes GitHub Actions outputs and a job summary when their environment variables are present.

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

**4. Switch content generation LLM provider** (legacy compatibility):

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

Compatibility defaults: openai=`gpt-6-sol`, anthropic=`claude-sonnet-4-6`, google=`gemini-3.1-pro-preview`

To change analysis providers, pass compatible AI SDK model objects through `models.classifyTags`, `models.analyzeImages`, and `models.determineImportance`. Also adapt domain-specific minimum-score rules in the analysis provider, output language and expert fields in config, package metadata, and the GitHub Actions runner/Slack settings for your fork.

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
