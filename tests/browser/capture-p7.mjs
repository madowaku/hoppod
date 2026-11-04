// Review captures for green's legs and red's hook: meeting each friend with
// its part missing, the pickup, the part flying in, the boot. Phone viewport
// (390×844), frozen clock, input held SLOW or FAST throughout.
// `node tests/browser/capture-p7.mjs` with the dev server running (BASE_URL,
// default http://127.0.0.1:8010; OUT, default output/p7). Not a test.
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { COURSE } from '../../public/src/story/course.mjs';

const base = process.env.BASE_URL || 'http://127.0.0.1:8010', out = process.env.OUT || 'output/p7';
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
async function sequence(name, cp, fast, from, to, step = 200) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await page.addInitScript(() => { delete window.AudioContext; delete window.webkitAudioContext; globalThis.__rapippoStoryProbe = {}; });
  await page.clock.install({ time: new Date('2026-11-03T03:00:00Z') });
  await page.goto(`${base}/story.html?lang=ja&cp=${cp}`);
  await page.clock.pauseAt(new Date('2026-11-03T03:00:01Z'));
  await page.locator('#action').click();
  if (fast) await page.keyboard.down('Space');
  await page.clock.runFor(from);
  for (let t = from, i = 0; t <= to; t += step, i++) {
    await page.locator('#play').screenshot({ path: `${out}/${name}-${String(i).padStart(2, '0')}.png` });
    await page.clock.runFor(step);
  }
  await page.close();
}
const cp = who => COURSE.checkpoints.findIndex(c => c.chapter === (who === 'green' ? 'apart' : 'rescue'));
for (const who of ['green', 'red']) for (const fast of [false, true]) await sequence(`${who}-${fast ? 'fast' : 'slow'}`, cp(who), fast, 0, fast ? 3000 : 4400);
await browser.close();
