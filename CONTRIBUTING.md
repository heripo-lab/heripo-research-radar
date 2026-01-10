# Contributing

Thank you for your interest in contributing to Heripo Research Radar! This guide explains how to contribute to the project through bug fixes, new features, or adding crawling targets.

## Two Ways to Contribute

1. **Direct contributions**: Bug fixes, feature improvements, adding new crawling targets
2. **Fork for your own newsletter**: Use this project as a template for your domain-specific newsletter (see README.md "
   ⚠️ Forking for Your Domain")

Both approaches are welcome!

## Development Environment

- Node.js: >= 22 (CI verified on 24.x)
- Package manager: npm (with package-lock.json)
- Language/Runtime: TypeScript, ESM (ES2022)

### Project Setup

```bash
npm ci
npm run typecheck
npm run build
```

### Useful Scripts

- Build: `npm run build` (Rollup, generates CJS/ESM/d.ts in dist)
- Lint: `npm run lint` / auto fix `npm run lint:fix`
- Typecheck: `npm run typecheck`
- Format: `npm run format`

## Code Style

- ESLint (typescript-eslint), Prettier
- Import sorting: `@trivago/prettier-plugin-sort-imports`
- Before committing: run `npm run lint` and `npm run typecheck`

## Adding Crawling Targets

One of the most valuable contributions is adding new crawling targets for Korean cultural heritage institutions.

### Steps

1. Identify the target website and check `robots.txt` compliance
2. Create or update parser in `src/parsers/`:
   - Implement `parseList`: Extract article links from listing page
   - Implement `parseDetail`: Extract title, content, date, images from article page
3. Add target to `src/config/crawling-targets.ts`
4. Test with actual URLs

### Parser Example

```typescript
export const myInstitutionParser = {
  parseList: async (html: string, targetUrl: string) => {
    const $ = load(html);
    return $('.article-list a')
      .map((_, el) => $(el).attr('href'))
      .get()
      .filter(Boolean);
  },

  parseDetail: async (html: string) => {
    const $ = load(html);
    return {
      title: $('.article-title').text().trim(),
      content: $('.article-content').html() || '',
      date: parseDateString($('.date').text()),
      images: $('.article-content img')
        .map((_, el) => $(el).attr('src'))
        .get()
        .filter(Boolean),
    };
  },
};
```

## Architecture Overview

This project implements the **Provider-Service** pattern required by `@llm-newsletter-kit/core`:

- **Services** (`src/services/`): Platform-agnostic utilities (DateService, TaskService)
- **Providers** (`src/providers/`): Data and LLM integration points
  - `CrawlingProvider`: Crawling targets, article fetching/saving
  - `AnalysisProvider`: LLM-based article analysis configuration
  - `ContentGenerateProvider`: LLM-based content generation configuration

Entry point: `src/newsletter-generator.ts` exports `createNewsletterGenerator()` and `generateNewsletter()`.

For detailed architecture, see `CLAUDE.md`.

## Database Integration

All repository interfaces are defined in `src/types/dependencies.ts`. Implement these for your database:

- `TaskRepository`: Task lifecycle management
- `ArticleRepository`: Article CRUD operations
- `TagRepository`: Tag management
- `NewsletterRepository`: Newsletter persistence

## Fork & Pull Request Workflow

### 1. Fork the Repository
Click "Fork" button on GitHub: https://github.com/heripo-lab/heripo-research-radar

### 2. Clone Your Fork
```bash
git clone https://github.com/YOUR_USERNAME/heripo-research-radar.git
cd heripo-research-radar
```

### 3. Add Upstream Remote
```bash
git remote add upstream https://github.com/heripo-lab/heripo-research-radar.git
git remote -v  # Verify: origin (your fork), upstream (original repo)
```

### 4. Create a Branch
```bash
git checkout -b feat/add-new-crawling-target
# or: fix/parser-bug, docs/update-readme, etc.
```

Branch naming: `feat/...`, `fix/...`, `docs/...`, `chore/...`, `test/...`

### 5. Make Changes & Test Locally
```bash
# Install dependencies
npm ci

# Make your changes (e.g., add parser in src/parsers/, update src/config/crawling-targets.ts)

# Verify:
npm run lint
npm run typecheck
npm run build

# Test your parser manually if needed
```

### 6. Commit Your Changes
```bash
git add .
git commit -m "feat: add crawling target for XYZ institution"
```

Commit messages: Use Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`)

### 7. Push to Your Fork
```bash
git push origin feat/add-new-crawling-target
```

### 8. Create Pull Request
1. Go to your fork on GitHub: `https://github.com/YOUR_USERNAME/heripo-research-radar`
2. Click "Compare & pull request" button
3. Base repository: `heripo-lab/heripo-research-radar` base: `main`
4. Head repository: `YOUR_USERNAME/heripo-research-radar` compare: `feat/add-new-crawling-target`
5. Fill in PR template:
   - What: Describe the change (e.g., "Added crawler for National Museum")
   - Why: Explain the motivation
   - How: Summarize implementation approach
6. Submit!

### 9. Respond to Review Feedback
```bash
# Make requested changes
git add .
git commit -m "fix: address review comments"
git push origin feat/add-new-crawling-target

# PR will auto-update
```

### 10. Keep Your Fork Updated
```bash
git checkout main
git fetch upstream
git merge upstream/main
git push origin main
```

## PR Checklist

- [ ] Forked repo and created feature branch
- [ ] Pass locally: `npm run lint` and `npm run typecheck` and `npm run build`
- [ ] Update README/docs if needed
- [ ] For new crawling targets: verify URLs and `robots.txt` compliance
- [ ] Commit messages follow Conventional Commits
- [ ] PR description explains what/why/how
- [ ] Include test URLs or screenshots if adding crawling targets

## CI

- Location: `.github/workflows/ci.yml`
- Triggers: Pull Request to any branch
- Steps: Lint → Typecheck → Build
- Node version: 24.x

## Issues / Questions

- Use GitHub Issues for bug reports/feature requests
- Labels:
  - `bug`: Bug reports
  - `enhancement`/`feat`: Feature additions/improvements
  - `docs`: Documentation
  - `chore`: Build/tooling/environment maintenance
  - `good first issue`: Beginner-friendly issues
  - `help wanted`: Help needed

Include reproduction steps, expected/actual results, and logs/screenshots to help review.

## Related Projects

- **Core engine**: [`@llm-newsletter-kit/core`](https://github.com/heripo-lab/llm-newsletter-kit-core) - Domain-agnostic newsletter generation engine
- **Live service**: [Heripo Research Radar](https://heripo.com/research-radar/subscribe)
