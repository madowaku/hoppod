// Title screen evidence: start (EN/JA, reduced motion), play and pause at
// 360×640. Run with the local server up: node tests/browser/capture-title.mjs
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const dir = 'output/playwright/title', base = process.env.BASE || 'http://127.0.0.1:8000';
await mkdir(dir, { recursive: true });
const browser = await chromium.launch();
for (const motion of ['no-preference', 'reduce']) {
  const page = await browser.newPage({ viewport: { width: 360, height: 640 }, reducedMotion: motion });
  await page.goto(base + '/?lang=en'); await page.waitForTimeout(500);
  await page.screenshot({ path: `${dir}/start-${motion}.png` });
  if (motion === 'reduce') { await page.close(); continue; }
  await page.locator('#action').click(); await page.waitForTimeout(1500);
  const header = await page.locator('#to-free').isVisible();
  await page.screenshot({ path: `${dir}/play.png` });
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  await page.screenshot({ path: `${dir}/pause.png` });
  console.log(JSON.stringify({ headerVisibleInPlay: header, pauseTitle: await page.locator('#overlay-title').textContent(), action: await page.locator('#action').textContent(), freeHidden: await page.locator('#title-free').isHidden() }));
  await page.close();
}
// The ending's last logo (friends as the Ps, the hero as the O) and the end card.
for (const lang of ['en', 'ja']) {
  const page = await browser.newPage({ viewport: { width: 360, height: 640 } });
  await page.addInitScript(() => { delete window.AudioContext; delete window.webkitAudioContext; });
  await page.clock.install({ time: new Date('2026-11-02T03:00:00Z') });
  await page.goto(base + '/story.html?cp=end&lang=' + lang); await page.clock.pauseAt(new Date('2026-11-02T03:00:01Z'));
  await page.locator('#action').click();
  await page.clock.runFor(780 * 69);
  await page.screenshot({ path: `${dir}/ending-logo-${lang}.png` });
  for (let i = 0; i < 20 && await page.locator('#end-actions').isHidden(); i++) await page.clock.runFor(1000);
  await page.screenshot({ path: `${dir}/end-card-${lang}.png` });
  await page.close();
}
await browser.close();
