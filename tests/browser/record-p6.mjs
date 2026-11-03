// Before/after clips of green's bridge and red's crane, each version driven
// with its own course and sim: `node tests/browser/record-p6.mjs` with
// BEFORE_URL/BEFORE_ROOT (a checkout of the old version) and AFTER_URL
// (default this checkout on :8010). Writes output/p6/video/*.webm. Not a test.
import { chromium } from '@playwright/test';
import { mkdir, rename } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const out = 'output/p6/video';
const versions = [
  ['before', process.env.BEFORE_URL || 'http://127.0.0.1:8020', process.env.BEFORE_ROOT],
  ['after', process.env.AFTER_URL || 'http://127.0.0.1:8010', '.'],
];
await mkdir(out, { recursive: true });

async function clip(name, base, cp, path, tailMs) {
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

for (const [label, base, root] of versions) {
  if (!root) { console.log('skip', label, '(no root)'); continue; }
  const at = p => import(pathToFileURL(resolve(root, p)).href);
  const { COURSE } = await at('public/src/story/course.mjs');
  const { storyFrom } = await at('public/src/story/sim.mjs');
  const { solve, hop } = await at('tests/helpers/story-solver.mjs');
  // The socket field, played the way a first-timer might: FAST until the
  // chasm is near, then SLOW.
  const field = COURSE.checkpoints.findIndex(c => c.from === COURSE.fieldStart);
  const run = storyFrom(COURSE, field), path = [0]; hop(run, COURSE, 0);
  for (let i = 0; i < 40 && run.x <= COURSE.bridge.b + 120 && run.status === 'playing'; i++) { const f = COURSE.bridge.a - run.x > 360 ? 1 : 0; path.push(f); hop(run, COURSE, f); }
  await clip(`${label}-socket`, base, field, path, 1200);
  // Red: from the rescue chapter's first checkpoint to past the crane.
  const rescue = COURSE.checkpoints.findIndex(c => c.chapter === 'rescue');
  const start = storyFrom(COURSE, rescue); hop(start, COURSE, 0);
  const crane = solve(COURSE, start, { until: r => r.x > COURSE.craneFar + 80, order: [.25, 0, .5, .75, 1], robust: .04 }).path;
  await clip(`${label}-crane`, base, rescue, [0, ...crane], 1500);
}
