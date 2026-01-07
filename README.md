# Heripo Research Radar

English | [한국어](./README-ko.md)

[![CI](https://github.com/kimhongyeon/heripo-research-radar/actions/workflows/ci.yml/badge.svg)](https://github.com/kimhongyeon/heripo-research-radar/actions/workflows/ci.yml)
[
![npm version](https://img.shields.io/npm/v/%40heripo%2Fresearch-radar?logo=npm&color=cb0000)
](https://www.npmjs.com/package/@heripo/research-radar)
![license](https://img.shields.io/github/license/kimhongyeon/heripo-research-radar)
![node](https://img.shields.io/badge/node-%3E%3D22-brightgreen)

[Code of Conduct](./CODE_OF_CONDUCT.md) • [Security Policy](./SECURITY.md) • [Contributing](./CONTRIBUTING.md)

## What is this?

An AI-powered newsletter service for Korean cultural heritage. Built on [`@llm-newsletter-kit/core`](https://github.com/kimhongyeon/llm-newsletter-kit-core), it's both a production service ([live at heripo.com](https://heripo.com/research-radar/subscribe)) and a reference implementation showing how to build automated newsletters with LLMs.

**Production metrics**:
- **Cost**: $0.2-1 USD per issue
- **Operation**: Fully autonomous 24/7 (no human intervention)
- **Engagement**: 15% CTR

**Technical highlights**:
- Type-safe TypeScript with strict interfaces
- Provider pattern for swapping components (Crawling/Analysis/Content/Email)
- 66 crawling targets across heritage agencies, museums, academic societies
- LLM-driven analysis (GPT-5 models)
- Built-in retries, chain options, preview emails

**Links**: [Live service](https://heripo.com/research-radar/subscribe) • [Newsletter example](https://heripo.com/research-radar-newsletter-example.html) • [Core engine](https://github.com/kimhongyeon/llm-newsletter-kit-core)

## Background

Created by archaeologist-turned-engineer Hongyeon Kim to answer: "Why must research rely on labor-intensive manual work?"

A personal script evolved into a production service after completing research on [Archaeological Informatization Using LLMs](https://poc.heripo.com). This repository open-sources the running service so developers can build domain-specific newsletters without starting from scratch.

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
@software{llm_newsletter_kit,
  author = {Kim, Hongyeon},
  title = {LLM Newsletter Kit: AI-Powered Newsletter Automation Framework},
  year = {2025},
  url = {https://github.com/kimhongyeon/heripo-research-radar},
  note = {Apache License 2.0}
}
```

## Installation

```bash
npm install @heripo/research-radar @llm-newsletter-kit/core
```

**Requirements**: Node.js >= 22, OpenAI API key

**Note**: `@llm-newsletter-kit/core` is a peer dependency and must be installed separately.

## Quick Start

```typescript
import { generateNewsletter } from '@heripo/research-radar';

const newsletterId = await generateNewsletter({
  openAIApiKey: process.env.OPENAI_API_KEY,

  // Implement these repository interfaces (see src/types/dependencies.ts)
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

  // Optional: Custom logger and preview
  logger: console,
  previewNewsletter: {
    fetchNewsletterForPreview: async () => db.newsletters.latest(),
    emailService: resendEmailService,
    emailMessage: { from: 'news@example.com', to: 'preview@example.com' },
  },
});
```

**Repository interfaces** are defined in `src/types/dependencies.ts`. Each method signature includes JSDoc with expected input/output types.

## Architecture

**Pipeline**: Crawling → Analysis → Content Generation → Save

1. **Crawling**: Fetch articles from target websites
2. **Analysis**: LLM tags and scores articles
3. **Generation**: Create newsletter from top-scoring articles
4. **Save**: Store and optionally send preview email

Uses the **Provider-Service pattern** from `@llm-newsletter-kit/core`. See [core docs](https://github.com/kimhongyeon/llm-newsletter-kit-core#architecture--flow) for flow diagrams.

## Components

**Config** (`src/config/`): Brand, language, LLM settings

**Targets** (`src/config/crawling-targets.ts`): 66 sources (News 52, Business 4, Employment 10)

**Parsers** (`src/parsers/`): Custom extractors per organization

**Template** (`src/templates/newsletter-html.ts`): Responsive email with light/dark mode

## Development commands

```bash
# build
npm run build              # clean dist/ and build with Rollup (CJS + ESM + types)

# type-check & lint
npm run lint               # lint source files
npm run lint:fix           # lint with autofix
npm run typecheck          # TypeScript type-check

# formatting
npm run format             # Prettier formatting
```

### Crawler Debugger

A web-based tool for testing crawling parsers during development. Built with Express.js and vanilla HTML/CSS/JS to minimize dependencies.

```bash
npm run dev:crawler        # Start at http://localhost:3333
```

**Features**:
- Test `parseList()` and `parseDetail()` parsers via web UI
- View raw HTML source for debugging
- Copy parsed results as JSON
- 5-minute response cache (with skip/clear options)
- Timing info for fetch and parse operations

## 🤝 Contributing

You can use this project in two ways:

1. Contribute directly to Heripo Research Radar: bug fixes, improvements, new crawl targets
2. Build your own newsletter: fork this repo and adapt it to your domain

See [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution workflow, dev setup, and PR guidelines.

## Forking for Your Domain

To build your own newsletter, update these files:

**1. Template** (`src/templates/newsletter-html.ts`):
- Logo URLs, brand colors (#D2691E, #E59866), contact info
- Platform intro and footer text
- Unsubscribe link format (currently Resend's `{{{RESEND_UNSUBSCRIBE_URL}}}`)

**2. Config** (`src/config/index.ts`):
```typescript
brandName: 'Your Newsletter Name'
subscribeUrl: 'https://yourdomain.com/subscribe'
```

**3. Crawling targets** (`src/config/crawling-targets.ts`):
- Replace Korean heritage sites with your domain sources
- Implement parsers in `src/parsers/`

**4. Switch LLM provider** (optional):

To use Anthropic/Gemini/Ollama instead of OpenAI:
- `src/newsletter-generator.ts`: Change `createOpenAI()` to your provider
- `src/providers/analysis.provider.ts`: Update model names (currently `gpt-5-mini`, `gpt-5.1`)
- `src/providers/content-generate.provider.ts`: Update model name

Any [Vercel AI SDK provider](https://sdk.vercel.ai/providers) works.

**Search keywords**: `heripo`, `kimhongyeon`, `#D2691E`, `openai`, `gpt-5`

## Why Code-Based?

Code-based automation delivers **superior output quality** through advanced AI techniques:

**No-code platforms**: Generic content, limited to built-in features
**This kit**: Self-reflection, chain-of-thought, multi-step verification workflows

**Key advantages**:
- **Quality**: Sophisticated prompting strategies, custom validation pipelines
- **Cost control**: Different models per step, token limits, retry logic
- **Flexibility**: Swap any component (Crawling/Analysis/Content/Email) via Provider interfaces
- **Operations**: Built-in retries, preview emails, integrates with CI/CD
- **No lock-in**: OSS, self-hostable, any LLM provider

**Design philosophy**:
- Logic in code (orchestration, deduplication)
- Reasoning in AI (analysis, scoring, content generation)
- Connections in architecture (swappable Providers)

## Related Projects

- [`@llm-newsletter-kit/core`](https://github.com/kimhongyeon/llm-newsletter-kit-core) — Domain-agnostic newsletter engine
- [Archaeological Informatization Using LLMs](https://poc.heripo.com) — Academic research (Korean)