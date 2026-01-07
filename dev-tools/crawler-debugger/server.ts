import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

import { crawlingTargetGroups } from '../../src/config/crawling-targets';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3333;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Simple in-memory cache for HTML responses
const htmlCache = new Map<string, { html: string; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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

// Pick a random User-Agent
const getRandomUserAgent = () =>
  USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

async function fetchHtml(
  url: string,
  useCache: boolean = true,
): Promise<string> {
  if (useCache) {
    const cached = htmlCache.get(url);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.html;
    }
  }

  const response = await fetch(url, {
    headers: {
      'User-Agent': getRandomUserAgent(), // Randomize User-Agent
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const html = await response.text();
  htmlCache.set(url, { html, timestamp: Date.now() });
  return html;
}

// API: Get all crawling targets
app.get('/api/targets', (_req, res) => {
  const targets = crawlingTargetGroups.map((group) => ({
    id: group.id,
    name: group.name,
    targets: group.targets.map((target) => ({
      id: target.id,
      name: target.name,
      url: target.url,
    })),
  }));
  res.json(targets);
});

// API: Parse list from a target
app.post('/api/parse-list', async (req, res) => {
  const { groupId, targetId, customUrl, skipCache } = req.body;

  try {
    // Find the target
    const group = crawlingTargetGroups.find((g) => g.id === groupId);
    if (!group) {
      return res.status(404).json({ error: `Group not found: ${groupId}` });
    }

    const target = group.targets.find((t) => t.id === targetId);
    if (!target) {
      return res.status(404).json({ error: `Target not found: ${targetId}` });
    }

    const url = customUrl || target.url;
    const startTime = Date.now();

    // Fetch HTML
    const html = await fetchHtml(url, !skipCache);
    const fetchTime = Date.now() - startTime;

    // Parse list
    const parseStartTime = Date.now();
    const items = await target.parseList(html);
    const parseTime = Date.now() - parseStartTime;

    res.json({
      success: true,
      url,
      html,
      items,
      timing: {
        fetch: fetchTime,
        parse: parseTime,
        total: fetchTime + parseTime,
      },
      cached: !skipCache && htmlCache.has(url),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
});

// API: Parse detail from a URL
app.post('/api/parse-detail', async (req, res) => {
  const { groupId, targetId, detailUrl, skipCache } = req.body;

  try {
    // Find the target
    const group = crawlingTargetGroups.find((g) => g.id === groupId);
    if (!group) {
      return res.status(404).json({ error: `Group not found: ${groupId}` });
    }

    const target = group.targets.find((t) => t.id === targetId);
    if (!target) {
      return res.status(404).json({ error: `Target not found: ${targetId}` });
    }

    if (!detailUrl) {
      return res.status(400).json({ error: 'detailUrl is required' });
    }

    const startTime = Date.now();

    // Fetch HTML
    const html = await fetchHtml(detailUrl, !skipCache);
    const fetchTime = Date.now() - startTime;

    // Parse detail
    const parseStartTime = Date.now();
    const article = await target.parseDetail(html);
    const parseTime = Date.now() - parseStartTime;

    res.json({
      success: true,
      url: detailUrl,
      html,
      article,
      timing: {
        fetch: fetchTime,
        parse: parseTime,
        total: fetchTime + parseTime,
      },
      cached: !skipCache && htmlCache.has(detailUrl),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
});

// API: Clear cache
app.post('/api/clear-cache', (_req, res) => {
  htmlCache.clear();
  res.json({ success: true, message: 'Cache cleared' });
});

// API: Get cache stats
app.get('/api/cache-stats', (_req, res) => {
  res.json({
    size: htmlCache.size,
    urls: Array.from(htmlCache.keys()),
  });
});

app.listen(PORT, () => {
  console.log(`\n  Crawler Debugger running at:`);
  console.log(`  http://localhost:${PORT}\n`);
});
