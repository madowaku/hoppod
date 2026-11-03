// Review captures for the first-play fixes: the dark opening, green's switch
// and red noticing green. `node tests/browser/capture-p5.mjs` with the dev
// server running (BASE_URL, default http://127.0.0.1:8000; OUT, default
// output/p5). Frozen clock, solver-driven. Not a test.
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { COURSE } from '../../public/src/story/course.mjs';
import { storyFrom } from '../../public/src/story/sim.mjs';
import { solve, hop } from '../helpers/story-solver.mjs';

const base = process.env.BASE_URL || 'http://127.0.0.1:8000', out = process.env.OUT || 'output/p5';
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
async function open(cp) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.addInitScript(() => { delete window.AudioContext; delete window.webkitAudioContext; globalThis.__rapippoStoryProbe = {}; });
  await page.clock.install({ time: new Date('2026-11-03T03:00:00Z') });
  await page.goto(`${base}/story.html?lang=en&cp=${cp}`);
  await page.clock.pauseAt(new Date('2026-11-03T03:00:01Z'));
  await page.locator('#action').click();
  return page;
}
const shot = (page, name) => page.locator('#play').screenshot({ path: `${out}/${name}.png` });
// Plays `path` hop by hop; `pick(run, i)` names the frames to keep (taken
// mid-hop, at `at` of the beat, default .5).
async function play(cp, path, pick, at = .5) {
  const page = await open(cp), r = storyFrom(COURSE, cp);
  for (const [i, f] of path.entries()) {
    const hold = Math.round(f * 780), mid = Math.round(at * 780);
    const name = pick(r, i);
    if (hold) { await page.keyboard.down('Space'); }
    if (name) {
      const first = Math.min(hold || mid, mid); await page.clock.runFor(first);
      if (hold && hold <= mid) { await page.keyboard.up('Space'); await page.clock.runFor(mid - hold); await shot(page, name); await page.clock.runFor(780 - mid); }
      else { await shot(page, name); if (hold) { await page.clock.runFor(hold - mid); await page.keyboard.up('Space'); } await page.clock.runFor(780 - Math.max(hold, mid)); }
    } else { if (hold) { await page.clock.runFor(hold); await page.keyboard.up('Space'); } await page.clock.runFor(780 - hold); }
    hop(r, COURSE, f);
  }
  return page;
}
// ① The dark: the first hops of chapter I.
const dark = solve(COURSE, storyFrom(COURSE, 0), { until: r => r.beat >= 8, order: [0, .5, 1] }).path;
await (await play(0, dark, (r, i) => ({ 3: 'dark-1', 6: 'dark-2' })[i])).close();
// ② The switch: from the field's checkpoint until green holds the bridge.
const field = COURSE.checkpoints.findIndex(c => c.x === COURSE.fieldStart + 80 || (c.chapter === 'apart' && c.x > COURSE.fieldStart && c.x < COURSE.switchX));
const sw = solve(COURSE, storyFrom(COURSE, field), { until: r => r.switchOn && r.x > COURSE.bridge.b, order: [.5, 1, 0, .25, .75] }).path;
const seen = {};
await (await play(field, sw, r => {
  const g = r.green, d = Math.abs(g.x - COURSE.switchX);
  const key = !r.switchOn && d < 120 && !seen.near ? 'near' : r.switchOn && !seen.on ? 'on' : r.switchOn && r.x > COURSE.bridge.a && !seen.cross ? 'cross' : null;
  if (key) { seen[key] = true; return 'switch-' + key; }
})).close();
// ⑤ The ending: the four lights carried into the rocket before launch.
{
  const page = await open('end');
  const E = await page.evaluate(async () => (await import('/src/story/music.mjs')).ENDING);
  for (const [beat, name] of [[E.pad + 2.5, 'load-1'], [E.launch - .3, 'load-2']]) {
    const r = await page.evaluate(() => globalThis.__rapippoStoryProbe.read());
    await page.clock.runFor(Math.max(0, Math.round((beat * .78 - r.s) * 1000))); await shot(page, name);
  }
  await page.close();
}
await browser.close();
console.log('done', out);
