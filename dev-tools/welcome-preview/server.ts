import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

import { generateWelcomeHTML } from '../../src/templates/welcome-html';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3335;

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// API: Get rendered welcome email HTML
app.get('/api/preview', async (req, res) => {
  const isKras = req.query.kras === 'true';
  const name = (req.query.name as string) || '홍길동';

  const html = await generateWelcomeHTML('preview-subscriber-id', name, {
    isKrasNewsletter: isKras,
    siteUrl: 'https://heripo.app',
  });

  res.type('html').send(html);
});

app.listen(PORT, () => {
  console.log(`\n  Welcome Preview running at:`);
  console.log(`  http://localhost:${PORT}\n`);
});
