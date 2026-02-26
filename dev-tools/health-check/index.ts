import fs from 'fs';

import { ProxyAgent } from 'undici';

import type { CrawlingTarget } from '@llm-newsletter-kit/core';

import { createCrawlingTargetGroups } from '~/config/crawling-targets';

// CLI args
const USE_PROXY = process.argv.includes('--proxy');
const PROXY_URL = process.env.PROXY_URL;

// Create proxy fetch if --proxy flag is set and PROXY_URL is available
const proxyAgent = USE_PROXY && PROXY_URL ? new ProxyAgent(PROXY_URL) : undefined;
const proxyFetch: typeof fetch | undefined = proxyAgent
  ? (input, init) =>
      fetch(input, { ...init, dispatcher: proxyAgent } as RequestInit)
  : undefined;

const crawlingTargetGroups = createCrawlingTargetGroups(proxyFetch);

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

async function fetchHtml(url: string): Promise<string> {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  const fetchFn = proxyFetch ?? fetch;
  const response = await fetchFn(url, {
    signal: AbortSignal.timeout(30_000),
    headers: {
      'User-Agent': getRandomUserAgent(),
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    },
  });

  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '1';

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

function validateDetailResult(detail: {
  detailContent?: string;
}): string[] {
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

  return lines.join('\n');
}

async function main() {
  console.log('=== Parser Health-Check ===');
  console.log(`Proxy: ${USE_PROXY && PROXY_URL ? PROXY_URL : 'disabled'}`);
  console.log('');

  const allResults: TargetCheckResult[] = [];
  let totalTargets = 0;

  for (const group of crawlingTargetGroups) {
    for (const target of group.targets) {
      totalTargets++;
      process.stdout.write(
        `Checking [${group.name}] ${target.name} ... `,
      );

      const result = await checkTarget(group.name, target);
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
    `\n${passed} passed, ${failed} failed out of ${totalTargets} targets`,
  );

  // Write compact summary for GitHub Actions
  const slackSummary = buildSlackSummary(allResults, passed, failed, totalTargets);

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
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, mdLines.join('\n') + '\n');
  }

  process.exit(failed > 0 ? 1 : 0);
}

main();
