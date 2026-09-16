import type { CrawlingTarget } from '@llm-newsletter-kit/core';

import fs from 'fs';
import { ProxyAgent } from 'undici';
import { Agent, fetch as undiciFetch } from 'undici';

import { robotsExemptOrigins } from '~/config';
import { createCrawlingTargetGroups } from '~/config/crawling-targets';
import { createRobotsGate } from '~/crawling/robots';
import { createKrasFetch } from '~/parsers/kras.parser';

const KHS_EXCAVATION_TARGET_IDS = [
  '국가유산청_발굴조사_보고서',
  '국가유산청_발굴조사_현장공개',
];

const tlsAgent = new Agent({
  connect: { rejectUnauthorized: false },
});

const unsafeFetch: typeof fetch = (input, init) =>
  undiciFetch(input as any, { ...init, dispatcher: tlsAgent } as any) as any;

// CLI args
const args = process.argv.slice(2);
const USE_PROXY = args.includes('--proxy');
const SHOW_HELP = args.includes('--help') || args.includes('-h');
const PROXY_URL = process.env.PROXY_URL;

function parseSkipTargets(cliArgs: string[]): Set<string> {
  const skipTargets = new Set<string>();

  for (let i = 0; i < cliArgs.length; i++) {
    const arg = cliArgs[i];

    if (arg === '--skip-khs-excavation') {
      for (const targetId of KHS_EXCAVATION_TARGET_IDS) {
        skipTargets.add(targetId);
      }
      continue;
    }

    if (arg === '--skip-target') {
      const value = cliArgs[i + 1];
      if (value && !value.startsWith('--')) {
        skipTargets.add(value);
        i++;
      }
      continue;
    }

    if (arg.startsWith('--skip-target=')) {
      const value = arg.slice('--skip-target='.length);
      if (value) {
        skipTargets.add(value);
      }
    }
  }

  return skipTargets;
}

function printHelp(): void {
  console.log(`Usage: npm run health-check -- [options]

Options:
  --proxy                 Use PROXY_URL for crawling requests
  --skip-khs-excavation   Skip KHS excavation report/site-open targets
  --skip-target <value>   Skip target by id or name (repeatable)
  --skip-target=<value>   Skip target by id or name (repeatable)
  -h, --help              Show this help message`);
}

if (SHOW_HELP) {
  printHelp();
  process.exit(0);
}

const skipTargets = parseSkipTargets(args);

// Create proxy fetch if --proxy flag is set and PROXY_URL is available
const proxyAgent =
  USE_PROXY && PROXY_URL ? new ProxyAgent(PROXY_URL) : undefined;
const proxyFetch: typeof fetch | undefined = proxyAgent
  ? (input, init) =>
      unsafeFetch(input, { ...init, dispatcher: proxyAgent } as RequestInit)
  : undefined;

// Mirror production: robots.txt is checked before any request leaves. The gate
// also answers the pre-check below, so a disallowed board is reported as skipped
// rather than as a parser failure.
// Rules a parser hit while running. A parser that fetches its own API — 영남고고학회
// reads /module/..., which its robots.txt disallows — is blocked inside parseList,
// where the pre-check on the board URL cannot see it, so record it here instead.
let robotsBlocksDuringCheck: string[] = [];

const robotsGate = createRobotsGate(proxyFetch ?? unsafeFetch, {
  exemptOrigins: robotsExemptOrigins,
  onBlocked: ({ rule }) => {
    if (!robotsBlocksDuringCheck.includes(rule)) {
      robotsBlocksDuringCheck.push(rule);
    }
  },
});

// Same composition as CrawlingProvider: robots.txt outermost, then the KRAS
// detail adapter. Without the adapter, KRAS detail pages parse to an empty
// body and the checks fail for a reason production never hits.
const checkFetch = createKrasFetch(robotsGate.fetch);

const crawlingTargetGroups = createCrawlingTargetGroups(checkFetch);

// User-Agent list used by real browsers
const USER_AGENTS = [
  // Windows - Chrome, Edge, Firefox
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',

  // macOS - Chrome, Safari, Firefox
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:126.0) Gecko/20100101 Firefox/126.0',

  // Linux - Chrome, Firefox
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:126.0) Gecko/20100101 Firefox/126.0',

  // Additional common combinations
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
];

const getRandomUserAgent = () =>
  USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

interface TargetCheckResult {
  groupName: string;
  targetName: string;
  url: string;
  listItemCount: number;
  listErrors: string[];
  detailUrl: string;
  detailContentLength: number;
  detailErrors: string[];
  thrownError: string | null;
  status: 'pass' | 'fail';
  durationMs: number;
}

interface SkippedTarget {
  groupName: string;
  targetName: string;
  /** Why it was skipped: a CLI option, or the site's robots.txt. */
  reason: string;
}

async function fetchHtml(url: string): Promise<string> {
  const response = await checkFetch(url, {
    signal: AbortSignal.timeout(30_000),
    headers: {
      'User-Agent': getRandomUserAgent(),
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.text();
}

function validateListResult(
  items: Array<{ title?: string; date?: string; detailUrl?: string }>,
): string[] {
  const errors: string[] = [];

  if (items.length === 0) {
    errors.push('parseList returned empty array');
    return errors;
  }

  const first = items[0];
  if (!first.title || first.title.trim() === '') {
    errors.push('First item has empty title');
  }
  if (!first.date || first.date.trim() === '') {
    errors.push('First item has empty date');
  }
  if (!first.detailUrl || !first.detailUrl.startsWith('http')) {
    errors.push(
      `First item detailUrl is invalid: "${first.detailUrl?.slice(0, 80)}"`,
    );
  }

  return errors;
}

function validateDetailResult(detail: { detailContent?: string }): string[] {
  const errors: string[] = [];

  if (!detail.detailContent || detail.detailContent.trim() === '') {
    errors.push('detailContent is empty');
  } else if (detail.detailContent.trim().length < 20) {
    errors.push(
      `detailContent is suspiciously short (${detail.detailContent.trim().length} chars)`,
    );
  }

  return errors;
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkTarget(
  groupName: string,
  target: CrawlingTarget,
): Promise<TargetCheckResult> {
  const startTime = Date.now();
  const result: TargetCheckResult = {
    groupName,
    targetName: target.name,
    url: target.url,
    listItemCount: 0,
    listErrors: [],
    detailUrl: '',
    detailContentLength: 0,
    detailErrors: [],
    thrownError: null,
    status: 'pass',
    durationMs: 0,
  };

  try {
    // Step 1: Fetch and parse list
    const listHtml = await fetchHtml(target.url);
    const items = await target.parseList(listHtml);

    result.listItemCount = items.length;
    result.listErrors = validateListResult(items);

    // Step 2: Fetch and parse first detail item (if list succeeded)
    if (items.length > 0 && items[0].detailUrl?.startsWith('http')) {
      result.detailUrl = items[0].detailUrl;
      const detailHtml = await fetchHtml(items[0].detailUrl);
      const detail = await target.parseDetail(detailHtml);

      result.detailContentLength = detail.detailContent?.trim().length ?? 0;
      result.detailErrors = validateDetailResult(detail);
    } else if (result.listErrors.length === 0) {
      result.detailErrors.push('Skipped: no valid detailUrl in list results');
    }
  } catch (err) {
    result.thrownError = err instanceof Error ? err.message : String(err);
  }

  result.durationMs = Date.now() - startTime;
  result.status =
    result.thrownError !== null ||
    result.listErrors.length > 0 ||
    result.detailErrors.length > 0
      ? 'fail'
      : 'pass';

  return result;
}

function buildSlackSummary(
  results: TargetCheckResult[],
  skippedTargets: SkippedTarget[],
  passed: number,
  failed: number,
  total: number,
): string {
  const date = new Date().toISOString().split('T')[0];
  const lines: string[] = [];

  lines.push(`파서 헬스체크 결과 — ${date}`);

  if (failed === 0) {
    lines.push(`총 ${total}개 모두 통과`);
  } else {
    lines.push(`총 ${total}개 중 ${passed}개 통과, ${failed}개 실패`);
    lines.push('');
    lines.push(`실패한 파서 (${failed}):`);
    for (const r of results.filter((r) => r.status === 'fail')) {
      const reasons = [r.thrownError, ...r.listErrors, ...r.detailErrors]
        .filter(Boolean)
        .join(' / ');
      lines.push(`  [${r.groupName}] ${r.targetName} — ${reasons}`);
    }
  }

  if (skippedTargets.length > 0) {
    lines.push('');
    lines.push(`건너뛴 파서 (${skippedTargets.length}):`);
    for (const target of skippedTargets) {
      lines.push(
        `  [${target.groupName}] ${target.targetName} — ${target.reason}`,
      );
    }
  }

  return '```\n' + lines.join('\n') + '\n```';
}

function isSkippedTarget(target: CrawlingTarget): boolean {
  return skipTargets.has(String(target.id)) || skipTargets.has(target.name);
}

async function main() {
  console.log('=== Parser Health-Check ===');
  console.log(`Proxy: ${USE_PROXY && PROXY_URL ? PROXY_URL : 'disabled'}`);
  console.log(
    `Skip targets: ${skipTargets.size > 0 ? [...skipTargets].join(', ') : 'none'}`,
  );
  console.log('');

  const allResults: TargetCheckResult[] = [];
  const skippedTargets: SkippedTarget[] = [];
  let totalTargets = 0;

  for (const group of crawlingTargetGroups) {
    for (const target of group.targets) {
      if (isSkippedTarget(target)) {
        skippedTargets.push({
          groupName: group.name,
          targetName: target.name,
          reason: 'CLI option',
        });
        console.log(`Skipping [${group.name}] ${target.name}`);
        continue;
      }

      // A board its own robots.txt disallows is policy, not a parser
      // regression, so it must not fail the run.
      const verdict = await robotsGate.isAllowed(
        target.url,
        getRandomUserAgent(),
      );

      if (!verdict.allowed) {
        skippedTargets.push({
          groupName: group.name,
          targetName: target.name,
          reason: `robots.txt (${verdict.rule})`,
        });
        console.log(
          `Skipping [${group.name}] ${target.name} — robots.txt ${verdict.rule}`,
        );
        continue;
      }

      process.stdout.write(`Checking [${group.name}] ${target.name} ... `);

      robotsBlocksDuringCheck = [];
      const result = await checkTarget(group.name, target);

      // The board itself was allowed, but something the parser needed was not.
      if (result.status === 'fail' && robotsBlocksDuringCheck.length > 0) {
        skippedTargets.push({
          groupName: group.name,
          targetName: target.name,
          reason: `robots.txt (${robotsBlocksDuringCheck.join(', ')})`,
        });
        console.log(
          `SKIP — robots.txt blocked a request the parser made (${robotsBlocksDuringCheck.join(', ')})`,
        );
        continue;
      }

      totalTargets++;
      allResults.push(result);

      if (result.status === 'pass') {
        console.log(
          `PASS (${result.listItemCount} items, ${result.detailContentLength} chars, ${result.durationMs}ms)`,
        );
      } else {
        console.log('FAIL');
        if (result.thrownError) {
          console.log(`  Error: ${result.thrownError}`);
        }
        for (const err of result.listErrors) {
          console.log(`  List: ${err}`);
        }
        for (const err of result.detailErrors) {
          console.log(`  Detail: ${err}`);
        }
      }

      // Delay between requests to avoid rate limiting
      await delay(500);
    }
  }

  // Summary table (local debugging)
  const passed = allResults.filter((r) => r.status === 'pass').length;
  const failed = allResults.filter((r) => r.status === 'fail').length;

  console.log('\n=== Summary ===');
  console.table(
    allResults.map((r) => ({
      Group: r.groupName,
      Target: r.targetName,
      Items: r.listItemCount,
      'Detail (chars)': r.detailContentLength,
      Status: r.status.toUpperCase(),
      'Duration (ms)': r.durationMs,
      Errors: [r.thrownError ?? '', ...r.listErrors, ...r.detailErrors]
        .filter(Boolean)
        .join('; ')
        .slice(0, 80),
    })),
  );

  console.log(
    `\n${passed} passed, ${failed} failed out of ${totalTargets} checked targets`,
  );
  if (skippedTargets.length > 0) {
    console.log(`${skippedTargets.length} skipped`);
  }

  // Write compact summary for GitHub Actions
  const slackSummary = buildSlackSummary(
    allResults,
    skippedTargets,
    passed,
    failed,
    totalTargets,
  );

  if (process.env.GITHUB_OUTPUT) {
    const delimiter = `HEREDOC_${Date.now()}`;
    fs.appendFileSync(
      process.env.GITHUB_OUTPUT,
      `summary<<${delimiter}\n${slackSummary}\n${delimiter}\n`,
    );
  }

  if (process.env.GITHUB_STEP_SUMMARY) {
    const failedResults = allResults.filter((r) => r.status === 'fail');
    const mdLines = [
      `## 파서 헬스체크 결과`,
      ``,
      `**${passed}/${totalTargets}** 통과`,
      ``,
    ];

    if (skippedTargets.length > 0) {
      mdLines.push(`### 건너뛴 파서 (${skippedTargets.length})`);
      mdLines.push(`| 그룹 | 파서 | 사유 |`);
      mdLines.push(`|------|------|------|`);
      for (const target of skippedTargets) {
        mdLines.push(
          `| ${target.groupName} | ${target.targetName} | ${target.reason} |`,
        );
      }
      mdLines.push(``);
    }

    if (failedResults.length > 0) {
      mdLines.push(`### 실패한 파서 (${failedResults.length})`);
      mdLines.push(`| 그룹 | 파서 | 오류 |`);
      mdLines.push(`|------|------|------|`);
      for (const r of failedResults) {
        const reasons = [r.thrownError, ...r.listErrors, ...r.detailErrors]
          .filter(Boolean)
          .join(', ');
        mdLines.push(`| ${r.groupName} | ${r.targetName} | ${reasons} |`);
      }
    } else {
      mdLines.push(`모든 파서가 정상 동작합니다. ✅`);
    }
    fs.appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      mdLines.join('\n') + '\n',
    );
  }

  process.exit(failed > 0 ? 1 : 0);
}

main();
