// Before/after captures for P4 review: the same moments rendered by two
// servers (BEFORE_URL, AFTER_URL) with the clock frozen, side by side.
// `node tests/browser/compare-p4.mjs`. Writes output/compare/*.png. Not a test.
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { COURSE } from '../../public/src/story/course.mjs';
import { storyFrom } from '../../public/src/story/sim.mjs';
import { solve, hop } from '../helpers/story-solver.mjs';

const out = process.env.OUT || 'output/compare';
const sites = { before: process.env.BEFORE_URL || 'http://127.0.0.1:8020', after: process.env.AFTER_URL || 'http://127.0.0.1:8010' };
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const wake = solve(COURSE, storyFrom(COURSE, 1), { until: r => r.parts.got === 3 && r.beat * .78 - r.parts.assembledAt > 5.5 * .78, order: [.25, 0, .5, .75, 1] }).path;
// Hop index of the assembly (its touchdown ends that hop).
const built = (() => { const r = storyFrom(COURSE, 1); for (const [i, f] of wake.entries()) { hop(r, COURSE, f); if (r.parts.got === 3) return i; } })();

async function open(site, cp) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.addInitScript(() => { delete window.AudioContext; delete window.webkitAudioContext; globalThis.__rapippoStoryProbe = {}; });
  await page.clock.install({ time: new Date('2026-11-03T03:00:00Z') });
  await page.goto(`${site}/story.html?lang=en&cp=${cp}`);
  await page.clock.pauseAt(new Date('2026-11-03T03:00:01Z'));
  await page.locator('#action').click();
  return page;
}
const shot = (page, name) => page.locator('#play').screenshot({ path: `${out}/${name}.png` });
for (const [label, site] of Object.entries(sites)) {
  // Blue's awakening: just before, on, and after the third part.
  let page = await open(site, 1);
  for (const [i, f] of wake.entries()) {
    const hold = Math.round(f * 780);
    if (hold) { await page.keyboard.down('Space'); await page.clock.runFor(hold); await page.keyboard.up('Space'); }
    await page.clock.runFor(780 - hold);
    const name = { [built - 2]: 'wake-0-dark', [built]: 'wake-1-burst', [built + 2]: 'wake-2-lifting', [built + 5]: 'wake-3-wide' }[i];
    if (name) await shot(page, `${name}-${label}`);
  }
  await page.close();
  // The ending, at the same moments relative to that build's own gates.
  page = await open(site, 'end');
  const E = await page.evaluate(async () => (await import('/src/story/music.mjs')).ENDING);
  const at = async (beat, name) => { const r = await page.evaluate(() => globalThis.__rapippoStoryProbe.read()); await page.clock.runFor(Math.max(0, Math.round((beat * .78 - r.s) * 1000))); await shot(page, `${name}-${label}`); };
  await at(.5, 'end-0-silent-beat'); await at(E.bell + .05, 'end-1-blue-takes'); await at(E.perc + 2.5, 'end-2-ensemble');
  await at(E.turn + 6, 'end-3-window'); await at(E.lights, 'end-4-lights');
  await page.close();
}
await browser.close();
console.log('done');
