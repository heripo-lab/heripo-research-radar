import express from 'express';
import juice from 'juice';
import path from 'path';
import { fileURLToPath } from 'url';

import { crawlingTargetGroups } from '../../src/config/crawling-targets';
import { createNewsletterHtmlTemplate } from '../../src/templates/newsletter-html';
import { sampleContent, sampleTitle } from './sample-content';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3334;

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// API: Get rendered newsletter HTML with sample content
app.get('/api/preview', (req, res) => {
  const isKras = req.query.kras === 'true';
  const krasNews = req.query.krasNews === 'true';
  const heripolabNews = req.query.heripolabNews === 'true';

  const options: Record<string, unknown> = {};
  if (isKras) options.isKrasNewsletter = true;
  if (krasNews)
    options.krasNewsMarkdown = `학회 업무 인수인계:
- 2025년 12월 30일 대전 국립문화유산연구원 학연정 사무실에서 업무 인수인계를 하였으며, 2026년 1월 5일 경북대학교에서 사무집기 및 물품등을 인수인계 하였습니다.

학회 업무 개시:
- 2026년 1월 1일 고려대학교 문화융합관 301호에 사무실을 설치하고 업무를 시작하였습니다.

학회 운영위원회 구성:
- 제 31대 학회 운영위원회 구성을 완료하고, 홈페이지에 게시하였습니다.`;
  if (heripolabNews)
    options.heripolabNewsMarkdown = `1월 28일 오픈소스 [heripo engine](https://github.com/heripo-lab/heripo-engine)을 공개하였습니다.`;

  const targets = crawlingTargetGroups.flatMap((group) => group.targets);
  let html = createNewsletterHtmlTemplate(
    targets,
    Object.keys(options).length > 0 ? options : undefined,
  );

  // Replace template markers with sample content
  html = html.replace('{{NEWSLETTER_TITLE}}', sampleTitle);
  html = html.replace('{{NEWSLETTER_CONTENT}}', sampleContent);
  html = html.replace('{{{RESEND_UNSUBSCRIBE_URL}}}', '#');

  res.type('html').send(juice(html));
});

app.listen(PORT, () => {
  console.log(`\n  Newsletter Preview running at:`);
  console.log(`  http://localhost:${PORT}\n`);
});
