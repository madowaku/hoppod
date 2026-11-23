// Records two real-time clips of green's socket for review:
// `node tests/browser/record-green.mjs` with the dev server running
// (BASE_URL, default http://127.0.0.1:8000). Video only. Not a test.
//   green-calm: SLOW on the field; green catches up, plants on its socket
//               and the bridge runs out ahead of the hero.
//   green-rush: FAST on the field; the hero is over the chasm before green
//               arrives and falls, the bridge forms behind him, and after the
//               respawn he crosses it.
import { chromium } from '@playwright/test';
import { mkdir, rename } from 'node:fs/promises';
import { COURSE } from '../../public/src/story/course.mjs';
import { storyFrom } from '../../public/src/story/sim.mjs';
import { hop } from '../helpers/story-solver.mjs';

const out = 'output/playwright/story-green/video';
const base = process.env.BASE_URL || 'http://127.0.0.1:8000';
const cp = COURSE.checkpoints.findIndex(c => c.from === COURSE.fieldStart);

// Hops until the hero is past the bridge (a fall and respawn included).
function plan(choose) {
  const run = storyFrom(COURSE, cp), path = [0];
  hop(run, COURSE, 0);
  for (let i = 0; i < 40 && run.x <= COURSE.bridge.b + 60; i++) { const f = choose(run, i); path.push(f); hop(run, COURSE, f); }
  return path;
}
async function clip(name, path, tailMs) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, recordVideo: { dir: out, size: { width: 390, height: 844 } } });
  const page = await context.newPage();
  await page.addInitScript(() => { delete window.AudioContext; delete window.webkitAudioContext; globalThis.__rapippoStoryProbe = {}; });
  await page.goto(`${base}/story.html?lang=en&cp=${cp}`);
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

await mkdir(out, { recursive: true });
await clip('green-calm', plan(() => 0), 1500);
// FAST until the fall; then FAST again once respawned: the bridge stayed.
await clip('green-rush', plan(() => 1), 1500);
