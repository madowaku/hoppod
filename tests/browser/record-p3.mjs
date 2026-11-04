// Records short real-time clips of P3 (red's rescue, the stop and the rocket
// window) for review: `node tests/browser/record-p3.mjs` with the dev server
// on :8000. Video only (Playwright cannot capture tab audio). Not a test.
import { chromium } from '@playwright/test';
import { mkdir, rename } from 'node:fs/promises';
import { COURSE } from '../../public/src/story/course.mjs';
import { storyFrom } from '../../public/src/story/sim.mjs';
import { solve, hop } from '../helpers/story-solver.mjs';

const out = 'output/playwright/story-p3/video';
const base = process.env.BASE_URL || 'http://127.0.0.1:8000';
const order = [.25, 0, .5, .75, 1];

async function clip(name, cp, until, tailMs) {
  const start = storyFrom(COURSE, cp); hop(start, COURSE, 0);
  const { path } = solve(COURSE, start, { until, order, robust: .04 });
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, recordVideo: { dir: out, size: { width: 390, height: 844 } } });
  const page = await context.newPage();
  await page.addInitScript(() => { delete window.AudioContext; delete window.webkitAudioContext; globalThis.__rapippoStoryProbe = {}; });
  await page.goto(`${base}/story.html?lang=en&cp=${cp}`);
  await page.locator('#action').click();
  // Same in-page driver as the audio tests: FAST for the first path[i] of hop i.
  await page.evaluate(path => {
    let down = false; const key = on => window.dispatchEvent(new KeyboardEvent(on ? 'keydown' : 'keyup', { code: 'Space', bubbles: true }));
    const tick = () => { const r = globalThis.__rapippoStoryProbe.read(), k = r.s / .78, i = Math.floor(k); const want = (path[i] ?? 0) > k - i; if (want !== down) { down = want; key(want); } if (r.status !== 'docked') requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }, [0, ...path]);
  await page.waitForTimeout(path.length * 780 + 780 + tailMs);
  const video = page.video();
  await context.close(); await browser.close();
  await rename(await video.path(), `${out}/${name}.webm`);
  console.log(name, path.length, 'hops');
}

await mkdir(out, { recursive: true });
const rescueCp = COURSE.checkpoints.findIndex(cp => cp.chapter === 'rescue' && cp.x < COURSE.crane.a && cp.x > COURSE.redConsole);
await clip('p3-rescue', rescueCp, r => r.together, 2500);
await clip('p3-ending', COURSE.checkpoints.length - 1, r => r.status === 'docked', 65 * 780);
