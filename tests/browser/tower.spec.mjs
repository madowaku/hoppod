import { test, expect } from '@playwright/test';
import { COURSE } from '../../public/src/tower/course.mjs';
import { newRun } from '../../public/src/tower/sim.mjs';
import { solve } from '../helpers/tower-solver.mjs';
const OUT = 'output/playwright/tower';
async function open(page, query = '') {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => { delete window.AudioContext; delete window.webkitAudioContext; globalThis.__rapippoTowerProbe = {}; });
  await page.clock.install({ time: new Date('2026-11-07T03:00:00Z') });
  await page.goto('/clocktower.html?lang=ja' + query);
  await page.clock.pauseAt(new Date('2026-11-07T03:00:01Z'));
  return errors;
}
const read = page => page.evaluate(() => globalThis.__rapippoTowerProbe.read());
const shot = (page, name) => page.locator('#play').screenshot({ path: `${OUT}/${name}.png` });
test.setTimeout(300000);

test('the title names the tower in Japanese and English and links back to the stages', async ({ page }) => {
  const errors = await open(page);
  await expect(page.locator('#work-title')).toHaveText('陽周りの時計台');
  await expect(page.locator('#action')).toHaveText('のぼる');
  await expect(page.locator('#to-select')).toHaveAttribute('href', 'select.html?lang=ja');
  await page.clock.runFor(200); await shot(page, 'title');
  await page.locator('#language').click();
  await expect(page.locator('#work-title')).toHaveText('THE SUNWISE CLOCK TOWER');
  await expect(page.locator('#to-select')).toHaveAttribute('href', 'select.html?lang=en');
  expect(errors).toEqual([]);
});

test('the whole tower climbs with real key events, rings the bell and brings the morning', async ({ page }) => {
  const { path } = solve(COURSE, newRun(), { order: [[.25, .5], [0, 0], [.5, .75], [0, .5], [.25, 1], [0, 1], [0, .25], [.75, 1], [.25, .75], [.5, 1], [0, .75]], maxHops: 600 });
  const errors = await open(page);
  await page.locator('#action').click();
  const seen = new Set();
  for (const [on, off] of path) {
    const a = Math.round(on * 780), b = Math.round(off * 780);
    if (b > a) {
      if (a) await page.clock.runFor(a);
      await page.keyboard.down('Space'); await page.clock.runFor(b - a); await page.keyboard.up('Space');
      if (780 - b) await page.clock.runFor(780 - b);
    } else await page.clock.runFor(780);
    const r = await read(page);
    expect(r.status, 'stays up at x ' + r.x).not.toBe('falling');
    if (!seen.has(r.station)) { seen.add(r.station); await shot(page, 'room-' + r.station); }
  }
  await page.clock.runFor(800);
  let r = await read(page);
  expect(r.status).toBe('docked');
  expect([...seen]).toEqual(COURSE.stations.map(s => s.id));
  await expect(page.locator('#hold')).toBeDisabled();
  await page.clock.runFor(3000); await shot(page, 'heart');
  await page.clock.runFor(14000); await shot(page, 'dawn');
  await page.clock.runFor(14000);
  r = await read(page); expect(r.card).toBe(true);
  await expect(page.locator('#end-actions')).toBeVisible();
  await expect(page.locator('#overlay-subtitle')).toContainText('朝を連れてきた');
  await shot(page, 'card');
  await page.locator('#again').click();
  await expect(page.locator('#action')).toBeVisible();
  expect(errors).toEqual([]);
});

test('a pendulum hit returns to the lantern on the beat, and progress is saved for CONTINUE', async ({ page }) => {
  const cp = COURSE.checkpoints.findIndex(c => COURSE.stations[c.station].id === 'pendulum');
  const errors = await open(page, '&cp=' + cp);
  await page.locator('#action').click();
  let r = await read(page); expect(r.station).toBe('pendulum');
  for (let i = 0; i < 40; i++) { await page.clock.runFor(780); r = await read(page); if (r.status === 'falling') break; }
  expect(r.status).toBe('falling'); await shot(page, 'hit');
  await page.clock.runFor(780 * 2 + 50); r = await read(page);
  expect(r.status).toBe('playing'); expect(r.checkpoint).toBe(cp);
  await page.keyboard.press('Escape');
  await expect(page.locator('#action')).toHaveText('つづける');
  await page.goto('/clocktower.html?lang=ja');
  await expect(page.locator('#continue')).toBeVisible();
  expect(errors).toEqual([]);
});
