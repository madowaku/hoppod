// Clips of meeting green and red: each found missing its part, the part
// picked up, flown in and clicked on, the friend booting and coming along.
// Phone viewport (390×844 at 3×). One clip calm (SLOW-leaning), one FAST.
// `node tests/browser/record-p7.mjs` with the dev server running (BASE_URL,
// default http://127.0.0.1:8010). Writes output/p7/video/*.webm. Not a test.
import { chromium } from '@playwright/test';
import { mkdir, rename } from 'node:fs/promises';
import { COURSE } from '../../public/src/story/course.mjs';
import { storyFrom } from '../../public/src/story/sim.mjs';
import { solve, hop } from '../helpers/story-solver.mjs';

const base = process.env.BASE_URL || 'http://127.0.0.1:8010', out = 'output/p7/video';
await mkdir(out, { recursive: true });

async function clip(name, cp, path, tailMs) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, recordVideo: { dir: out, size: { width: 390, height: 844 } } });
  const page = await context.newPage();
  await page.addInitScript(() => { delete window.AudioContext; delete window.webkitAudioContext; globalThis.__rapippoStoryProbe = {}; });
  await page.goto(`${base}/story.html?lang=ja&cp=${cp}`);
  await page.locator('#action').click();
  await page.evaluate(path => {
    let down = false; const key = on => window.dispatchEvent(new KeyboardEvent(on ? 'keydown' : 'keyup', { code: 'Space', bubbles: true }));
    const tick = () => { const r = globalThis.__rapippoStoryProbe.read(), k = r.s / .78, i = Math.floor(k); const want = (path[i] ?? 0) > k - i; if (want !== down) { down = want; key(want); } if (r.status !== 'docked') requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }, path);
  await page.waitForTimeout(path.length * 780 + tailMs);
  const video = page.video();
  await context.close(); await browser.close();
  await rename(await video.path(), `${out}/${name}.webm`);
  console.log(name, path.length, 'hops');
}

for (const who of ['green', 'red']) {
  const cp = COURSE.checkpoints.findIndex(c => c.chapter === (who === 'green' ? 'apart' : 'rescue'));
  for (const [label, order] of [['calm', [.25, 0, .5, .75, 1]], ['fast', [1, .75, .5, .25, 0]]]) {
    const run = storyFrom(COURSE, cp); hop(run, COURSE, 0);
    const done = r => r[who].bootAt !== undefined && r.t > r[who].bootAt + 2.4;
    const path = solve(COURSE, run, { until: done, order, robust: .04 }).path;
    await clip(`${who}-${label}`, cp, [0, ...path], 600);
  }
}
