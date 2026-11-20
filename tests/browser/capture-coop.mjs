// Review captures for the dark's echo, blue's lamp in the crater's shadow,
// red carrying green home and the friends' calls (ensemble). `node tests/browser/capture-coop.mjs` with the
// dev server running (BASE_URL, default http://127.0.0.1:8000; OUT, default
// output/coop). Frozen clock, solver-driven. Not a test.
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { COURSE, platformAt } from '../../public/src/story/course.mjs';
import { BEAT } from '../../public/src/story/beat.mjs';
import { storyFrom } from '../../public/src/story/sim.mjs';
import { solve, hop } from '../helpers/story-solver.mjs';

const base = process.env.BASE_URL || 'http://127.0.0.1:8000', out = process.env.OUT || 'output/coop';
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
async function open(cp) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.addInitScript(() => { delete window.AudioContext; delete window.webkitAudioContext; globalThis.__rapippoStoryProbe = {}; });
  await page.clock.install({ time: new Date('2026-11-03T03:00:00Z') });
  await page.goto(`${base}/story.html?lang=ja&cp=${cp}`);
  await page.clock.pauseAt(new Date('2026-11-03T03:00:01Z'));
  await page.locator('#action').click();
  return page;
}
const shot = (page, name) => page.locator('#play').screenshot({ path: `${out}/${name}.png` });
// Plays `path` hop by hop, shooting at `at` of the beat where pick names it.
async function play(cp, path, pick, at = .25) {
  const page = await open(cp), r = storyFrom(COURSE, cp);
  for (const [i, f] of path.entries()) {
    const name = pick(r, i), hold = Math.round(f * 780), mid = Math.round(at * 780);
    if (hold) await page.keyboard.down('Space');
    if (name && hold > mid) { await page.clock.runFor(mid); await shot(page, name); await page.clock.runFor(hold - mid); await page.keyboard.up('Space'); await page.clock.runFor(780 - hold); }
    else if (name) { if (hold) { await page.clock.runFor(hold); await page.keyboard.up('Space'); } await page.clock.runFor(mid - hold); await shot(page, name); await page.clock.runFor(780 - mid); }
    else { if (hold) { await page.clock.runFor(hold); await page.keyboard.up('Space'); } await page.clock.runFor(780 - hold); }
    hop(r, COURSE, f);
  }
  return page;
}
const only = process.argv[2];
if (!only || only === 'dark') {
  const p = solve(COURSE, storyFrom(COURSE, 1), { until: r => r.parts.got >= 2 && r.x > COURSE.parts[1] + 500, order: [.5, .25, .75, 0, 1] }).path;
  let k = 0; const seen = {};
  await (await play(1, p, r => { const n = 'dark-' + r.parts.got; if (r.x > COURSE.checkpoints[1].x + 300 && (seen[n] = (seen[n] || 0) + 1) <= 2) return n + '-' + seen[n]; }, .2)).close();
}
if (!only || only === 'lamp') for (const [name, order] of [['slow', [0, .25, .5, .75, 1]], ['fast', [1, .75, .5, .25, 0]]]) {
  const cp = COURSE.checkpoints.findIndex(c => c.x > COURSE.switchX) - 1;
  const p = solve(COURSE, storyFrom(COURSE, cp), { until: r => r.x > COURSE.shadow.a + 900, order, limit: 50000 }).path;
  let n = 0;
  await (await play(cp, p, r => r.x > COURSE.shadow.a + 100 && n < 3 && (r.beat % 3 === 0) ? `lamp-${name}-${++n}` : null, .3)).close();
}
if (!only || only === 'carry') {
  const cp = COURSE.checkpoints.findIndex(c => c.x >= COURSE.craneFar);
  // FAST until the pair is close, then SLOW: the wait and the reunion.
  const fastPath = solve(COURSE, storyFrom(COURSE, cp), { until: r => r.red.state === 'carry' && r.x - r.red.x < 160, order: [1, .75, .5, .25, 0], limit: 80000 });
  const rest = solve(COURSE, fastPath.end, { until: r => r.together && r.beat > fastPath.end.beat + 3, order: [0, .25, .5], limit: 50000 }).path;
  const p = [...fastPath.path, ...rest], from = fastPath.path.length;
  await (await play(cp, p, (r, i) => i >= from - 3 && i < from + 4 ? 'carry-' + (i - from + 3) : null, .4)).close();
}
if (!only || only === 'ensemble') {
  // Aim at every light: a safe hold that lands on it, or leaves it in reach.
  const cp = COURSE.checkpoints.findIndex(c => c.chapter === 'rescue' && c.x > COURSE.craneFar + 500), r = storyFrom(COURSE, cp), path = [];
  for (let i = 0; i < 14; i++) {
    const n = r.notes.cur, safe = [];
    for (let k = 0; k <= 40; k++) { const f = k / 40, x = r.x + BEAT * (105 + 165 * f); if (platformAt(COURSE, x)) safe.push([f, x]); }
    const cost = ([f, x]) => !n ? Math.abs(f - .5) : n.due - r.beat === 1 ? Math.abs(x - n.x) : n.x - x >= 82 && n.x - x <= 210 ? Math.abs(f - .5) : 1e4;
    const [f] = safe.reduce((a, b) => cost(b) < cost(a) ? b : a); path.push(f); hop(r, COURSE, f);
  }
  let n = 0;
  await (await play(cp, path, (r, i) => i >= 5 && n < 6 ? `ensemble-${++n}` : null, .2)).close();
}
await browser.close();
console.log('done', out);
