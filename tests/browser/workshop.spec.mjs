import { test, expect } from '@playwright/test';
import { COURSE } from '../../public/src/workshop/course.mjs';
import { newRun } from '../../public/src/workshop/sim.mjs';
import { solve, HOLDS } from '../helpers/workshop-solver.mjs';
import { CARD_BAR, TUTTI_FROM, encodeTake, demoRecording } from '../../public/src/workshop/arrange.mjs';
const OUT = 'output/playwright/workshop';
async function open(page, query = '', { audio = false } = {}) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(noAudio => {
    if (noAudio) { delete window.AudioContext; delete window.webkitAudioContext; }
    globalThis.__rapippoWorkshopProbe = {};
  }, !audio);
  await page.clock.install({ time: new Date('2026-11-05T03:00:00Z') });
  await page.goto('/workshop.html?lang=ja' + query);
  await page.clock.pauseAt(new Date('2026-11-05T03:00:01Z'));
  return errors;
}
const read = page => page.evaluate(() => globalThis.__rapippoWorkshopProbe.read());
const shot = (page, name) => page.locator('#play').screenshot({ path: `${OUT}/${name}.png` });

test('the title offers the workshop in Japanese and English', async ({ page }) => {
  const errors = await open(page);
  await expect(page.locator('#action')).toHaveText('はいる');
  await expect(page.locator('#work-title')).toHaveText('月の楽器工房');
  await page.clock.runFor(200); await shot(page, 'title');
  await page.locator('#language').click(); await expect(page.locator('#action')).toHaveText('ENTER');
  expect(errors).toEqual([]);
});

test('the whole workshop plays through with real key events to the end card', async ({ page }) => {
  test.setTimeout(400000);
  const { path } = solve(COURSE, newRun(), { order: [[.25, .5], [0, 0], [.5, .75], [0, .5], [.25, 1], [0, 1], ...HOLDS] });
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
    if (!seen.has(r.station)) { seen.add(r.station); await page.clock.runFor(1); await shot(page, 'station-' + r.station); }
    else if (r.beat % 7 === 3 && !seen.has(r.station + 'b')) { seen.add(r.station + 'b'); await shot(page, 'mid-' + r.station); }
    expect(r.status, 'stays up at x ' + r.x).not.toBe('falling');
  }
  await page.clock.runFor(100);
  let r = await read(page);
  expect(r.status).toBe('docked');
  for (const station of COURSE.stations) expect([...seen]).toContain(station.id);
  for (const part of ['drums', 'tongue', 'keys', 'harp', 'strings', 'wood', 'bellows', 'brass']) expect(r.recording[part], part).toBeTruthy();
  // No input moves the locked hero and the control is off.
  await expect(page.locator('#hold')).toBeDisabled();
  await shot(page, 'lock');
  const x = r.x, beat = r.beat;
  await page.keyboard.down('Space'); await page.clock.runFor(780 * 3); await page.keyboard.up('Space');
  r = await read(page); expect(r.x).toBe(x); expect(r.beat).toBeGreaterThanOrEqual(beat);
  await page.clock.runFor(780 * 2); await shot(page, 'first-ticks');
  await page.clock.runFor(3120 * 6); await shot(page, 'band-entering');
  await page.clock.runFor(3120 * (TUTTI_FROM - 8 + 2)); await shot(page, 'tutti');
  r = await read(page); expect(r.heard.length).toBeGreaterThan(5);
  await page.clock.runFor(3120 * (CARD_BAR - TUTTI_FROM - 2 + 1));
  r = await read(page); expect(r.card).toBe(true);
  await expect(page.locator('#end-actions')).toBeVisible();
  await shot(page, 'end-card');
  await page.locator('#play').evaluate(() => {});
  expect(errors).toEqual([]);
});

test('a fall returns to the lantern on the beat and keeps the instruments', async ({ page }) => {
  const errors = await open(page, '&cp=' + COURSE.checkpoints.findIndex(c => COURSE.stations[c.station].id === 'wood'));
  await page.locator('#action').click();
  let r = await read(page); expect(r.station).toBe('wood'); expect(Object.keys(r.recording).length).toBeGreaterThan(3);
  const cp = r.checkpoint;
  for (let i = 0; i < 40; i++) { await page.clock.runFor(780); r = await read(page); if (r.status === 'falling') break; }
  expect(r.status).toBe('falling'); await shot(page, 'fall');
  await page.clock.runFor(780 * 2 + 50); r = await read(page);
  expect(r.status).toBe('playing'); expect(r.checkpoint).toBe(cp); expect(Object.keys(r.recording).length).toBeGreaterThan(3);
  expect(errors).toEqual([]);
});

test('a shared take opens as a song, and a broken one as the plain title', async ({ page }) => {
  const errors = await open(page, '&take=' + encodeTake(demoRecording()));
  await page.locator('#action').click(); await page.clock.runFor(780 * 12);
  let r = await read(page); expect(r.mode).toBe('finale'); expect(r.finaleBar).toBeGreaterThanOrEqual(1);
  expect(errors).toEqual([]);
  const other = await page.context().newPage();
  const errs = await open(other, '&take=%3Cscript%3E');
  await other.locator('#action').click(); await other.clock.runFor(780);
  r = await read(other); expect(r.mode).toBe('play'); expect(errs).toEqual([]);
  await other.close();
});

test('free play unlocks after a clear; holding widens the swing and never moves the beat', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('hoppod.workshop.v1.cleared', '1'));
  const errors = await open(page);
  await expect(page.locator('#free')).toBeVisible();
  await page.locator('#free').click(); await page.clock.runFor(780 * 4);
  let r = await read(page); expect(r.mode).toBe('free');
  await page.keyboard.down('Space'); await page.clock.runFor(780 * 6);
  const wide = (await read(page)).wide; await page.keyboard.up('Space'); await page.clock.runFor(780 * 4);
  expect(wide).toBeGreaterThan(.5); expect((await read(page)).wide).toBeLessThan(wide); await shot(page, 'free');
  await page.locator('#free').click();
  await expect(page.locator('#action')).toBeVisible();
  expect(errors).toEqual([]);
});

test('a run continues after a reload, keeps its instruments, and a broken save is ignored', async ({ page }) => {
  const errors = await open(page, '&cp=' + COURSE.checkpoints.findIndex(c => COURSE.stations[c.station].id === 'bellows'));
  await page.locator('#action').click();
  // Reach the next lantern on the plain ground of the checkpoint's own plan.
  const { path } = solve(COURSE, (await import('../../public/src/workshop/sim.mjs')).runFrom(COURSE, COURSE.checkpoints.findIndex(c => COURSE.stations[c.station].id === 'bellows')), { stopAt: COURSE.checkpoints[COURSE.checkpoints.findIndex(c => COURSE.stations[c.station].id === 'bellows') + 1].from });
  for (const [on, off] of path) {
    const a = Math.round(on * 780), b = Math.round(off * 780);
    if (b > a) { if (a) await page.clock.runFor(a); await page.keyboard.down('Space'); await page.clock.runFor(b - a); await page.keyboard.up('Space'); if (780 - b) await page.clock.runFor(780 - b); } else await page.clock.runFor(780);
  }
  // The clock started a few ms after the click: let the last touchdown land.
  await page.clock.runFor(100);
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem('hoppod.workshop.v1'))).checkpoint).toBeGreaterThan(0);
  const saved = await page.evaluate(() => localStorage.getItem('hoppod.workshop.v1'));
  await page.goto('/workshop.html?lang=ja');
  await expect(page.locator('#continue')).toBeVisible();
  await page.locator('#continue').click(); await page.clock.runFor(100);
  const after = await read(page);
  expect(after.checkpoint).toBe(JSON.parse(saved).checkpoint);
  expect(Object.keys(after.recording).length).toBe(Object.keys(JSON.parse(saved).recording).length);
  await page.evaluate(() => localStorage.setItem('hoppod.workshop.v1', '{"checkpoint":3,"recording":{"keys":{"len":"x","events":"nope"}}}'));
  await page.goto('/workshop.html?lang=ja');
  await page.clock.runFor(100);
  await expect(page.locator('#action')).toBeVisible();
  await expect(page.locator('#continue')).toBeHidden();
  expect(errors).toEqual([]);
});

test('pausing on the end card keeps it, the song and the hero where they were', async ({ page }) => {
  const errors = await open(page, '&end=1');
  await page.locator('#action').click();
  await page.clock.runFor(Math.round((CARD_BAR * 3.12 + 1.6) * 1000));
  expect((await read(page)).card).toBe(true);
  await expect(page.locator('#end-actions')).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.locator('#action')).toBeVisible();
  await page.locator('#action').click(); await page.clock.runFor(200);
  await expect(page.locator('#end-actions')).toBeVisible();
  // The song outlives the card.
  const bar = (await read(page)).finaleBar; await page.clock.runFor(3120 * 2);
  expect((await read(page)).finaleBar).toBeGreaterThan(bar);
  expect(errors).toEqual([]);
});

test('reduced motion: the rod barely swings and the camera stays put', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = await open(page, '&end=1');
  await page.locator('#action').click();
  let most = 0;
  for (let i = 0; i < 40; i++) { await page.clock.runFor(195); most = Math.max(most, Math.abs((await read(page)).angle)); }
  expect(most).toBeLessThan(.08);
  expect(errors).toEqual([]);
});

test('touch: holding the canvas is FAST, releasing is SLOW, and PAUSE lets go', async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = await open(page);
  await page.locator('#action').tap();
  const box = await page.locator('#play').boundingBox(), x = box.x + 100, y = box.y + 100;
  await page.mouse.move(x, y); await page.mouse.down();
  await expect(page.locator('#hold-state')).toHaveText('FAST');
  await page.clock.runFor(780); const far = (await read(page)).x;
  await page.mouse.up(); await expect(page.locator('#hold-state')).toHaveText('SLOW');
  await page.clock.runFor(780); const near = (await read(page)).x;
  expect(far).toBeGreaterThan(75 + 200); expect(near - far).toBeLessThan(90);
  await page.locator('#pause').tap(); await expect(page.locator('#action')).toBeVisible();
  expect(errors).toEqual([]);
  await context.close();
});

test('real audio, while playing: a drum on every landing, each exactly on its beat', async ({ page }) => {
  await page.addInitScript(() => { globalThis.__rapippoWorkshopProbe = {}; });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/workshop.html?lang=en&cp=1');
  await page.locator('#action').click();
  await page.waitForFunction(() => globalThis.__rapippoWorkshopProbe.read().beat >= 12, null, { timeout: 30000 });
  const r = await read(page);
  if (r.domain !== 'audio') test.skip(true, 'no running audio in this browser');
  const notes = await page.evaluate(() => globalThis.__rapippoWorkshopProbe.notes);
  const lands = notes.filter(n => n.part === 'land'), drums = notes.filter(n => n.part === 'drums');
  expect(lands.length).toBeGreaterThanOrEqual(10);
  for (const n of lands) expect(Math.abs(n.s / .78 - Math.round(n.s / .78))).toBeLessThan(.002);
  expect(drums.length).toBeGreaterThan(5);
  expect(errors).toEqual([]);
});

test('real audio: notes land on the beat, and the finale ticks on every beat', async ({ page }) => {
  await page.addInitScript(() => { globalThis.__rapippoWorkshopProbe = {}; });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/workshop.html?lang=en&end=1');
  await page.locator('#action').click();
  await page.waitForFunction(() => globalThis.__rapippoWorkshopProbe.read().finaleBar >= 3, null, { timeout: 30000 });
  const r = await read(page);
  if (r.domain !== 'audio') test.skip(true, 'no running audio in this browser');
  const notes = await page.evaluate(() => globalThis.__rapippoWorkshopProbe.notes);
  const ticks = notes.filter(n => n.part === 'tick');
  expect(ticks.length).toBeGreaterThan(8);
  for (let i = 1; i < ticks.length; i++) expect(Math.abs(ticks[i].s - ticks[i - 1].s - .78)).toBeLessThan(.001);
  expect(notes.some(n => n.part === 'drums')).toBe(true);
  expect(r.audio.state).toBe('running');
  expect(errors).toEqual([]);
});
