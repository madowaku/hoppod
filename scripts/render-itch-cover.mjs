// Renders scripts/itch-cover.html to docs/itch/: the itch.io cover at its
// recommended 630×500, a sharper 1260×1000, and a hero-alone alternative.
// Usage: node scripts/render-itch-cover.mjs
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { chromium } from '@playwright/test';

const root = resolve(import.meta.dirname, '..'), out = join(root, 'docs', 'itch');
const TYPES = { '.html': 'text/html', '.mjs': 'text/javascript' };
const server = createServer(async (req, res) => {
  try {
    const path = normalize(new URL(req.url, 'http://x').pathname).replace(/^[\\/]+/, '');
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
    res.end(await readFile(join(root, path)));
  } catch { res.writeHead(404); res.end(); }
}).listen(0, '127.0.0.1');
await new Promise(ok => server.once('listening', ok));

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', e => { throw e; });
await mkdir(out, { recursive: true });
const JOBS = [['cover-630x500.png', '', 2], ['cover-1260x1000.png', '', 4], ['cover-alone-630x500.png', '?friends=0', 2]];
for (const [name, query, factor] of JOBS) {
  await page.goto(`http://127.0.0.1:${server.address().port}/scripts/itch-cover.html${query}`);
  await page.waitForFunction('window.coverReady === true');
  const data = await page.evaluate(k => {
    const src = document.getElementById('c'), big = document.createElement('canvas');
    big.width = src.width * k; big.height = src.height * k;
    const g = big.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(src, 0, 0, big.width, big.height);
    return big.toDataURL('image/png').split(',')[1];
  }, factor);
  await writeFile(join(out, name), Buffer.from(data, 'base64'));
  console.log(name);
}
await browser.close();
server.close();
