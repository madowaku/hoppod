import { test, expect } from '@playwright/test';
const url = '/dev/trombone-cart.html';
async function open(page) {
  await page.clock.install({ time: new Date('2026-11-05T00:00:00Z') });
  await page.goto(url); await page.clock.pauseAt(new Date('2026-11-05T00:00:01Z'));
}
async function untilHop(page, hop) {
  // Stop between touchdown and the next render, never crossing another hop.
  await page.clock.runFor(780);
  await expect(page.locator('#scene')).toHaveAttribute('data-hops', String(hop));
}
for (const direction of ['up', 'down']) test(`keyboard plays ${direction} repeatedly without reset`, async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await open(page); await page.locator('#' + direction).click(); await page.locator('#start').click();
  if (direction === 'down') await page.keyboard.down('Space');
  await page.clock.runFor(800);
  for (let hop = 1; hop <= 8; hop++) {
    await untilHop(page, hop);
    if ((hop % 2 === 1) === (direction === 'up')) await page.keyboard.down('Space');
    else await page.keyboard.up('Space');
  }
  await expect(page.locator('#scene')).toHaveAttribute('data-completed', 'true');
  await expect(page.locator('#outcome')).toContainText('そのまま続けて');
  expect(errors).toEqual([]);
  await page.screenshot({ path: `output/playwright/trombone-${direction}-mobile.png`, fullPage: true });
});
test('touch-style pointer on HOLD, release outside, pause and resume safely', async ({ page }) => {
  await open(page); await page.locator('#start').click(); await page.clock.runFor(800);
  await untilHop(page, 1);
  const box = await page.locator('#hold').boundingBox();
  await page.mouse.move(box.x + 20, box.y + 20); await page.mouse.down();
  await untilHop(page, 2);
  await page.mouse.move(5, 5); await page.mouse.up();
  await untilHop(page, 3);
  await expect(page.locator('#scene')).toHaveAttribute('data-completed', 'true');
  await page.locator('#pause').click(); const hops = await page.locator('#scene').getAttribute('data-hops');
  await page.clock.runFor(3000); await expect(page.locator('#scene')).toHaveAttribute('data-hops', hops);
  await page.locator('#pause').click(); await page.clock.runFor(780);
  await expect(page.locator('#scene')).toHaveAttribute('data-hops', '4');
  await expect(page.locator('#hold')).not.toHaveClass(/active/);
});
test('fall, retry, focus loss and long-frame freeze do not teleport the cart', async ({ page }) => {
  await open(page); await page.locator('#start').click(); await page.clock.runFor(800 + 3 * 780);
  await expect(page.locator('#scene')).toHaveAttribute('data-state', 'fall');
  await page.locator('#start').click(); await page.keyboard.down('Space'); await page.clock.runFor(900);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.locator('#scene')).toHaveAttribute('data-state', 'paused');
  await expect(page.locator('#hold')).not.toHaveClass(/active/);
  await page.keyboard.up('Space'); await page.locator('#pause').click();
  const before = await page.locator('#scene').getAttribute('data-relative');
  await page.clock.pauseAt(new Date('2026-11-05T00:00:30Z'));
  await page.clock.runFor(16);
  await expect(page.locator('#scene')).toHaveAttribute('data-state', 'paused');
  await expect(page.locator('#scene')).toHaveAttribute('data-relative', before);
});
test('emulated touchscreen can hold across a hop, drag outside, and release', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage(); await open(page);
    await page.locator('#start').tap(); await page.clock.runFor(800); await untilHop(page, 1);
    const box = await page.locator('#hold').boundingBox(), cdp = await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + 30, y: box.y + 20 }] });
    await expect(page.locator('#hold')).toHaveClass(/active/); await untilHop(page, 2);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 5, y: 5 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.locator('#hold')).not.toHaveClass(/active/); await untilHop(page, 3);
    await expect(page.locator('#scene')).toHaveAttribute('data-completed', 'true');
  } finally { await context.close(); }
});
for (const size of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) test(`layout and nonblank cart ${size.width}`, async ({ page }) => {
  await page.setViewportSize(size); await open(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const pixels = await page.locator('#scene').evaluate(c => {
    const g = c.getContext('2d'); return [[...g.getImageData(220, 385, 1, 1).data], [...g.getImageData(400, 385, 1, 1).data]];
  });
  expect(pixels[0]).not.toEqual(pixels[1]);
  await page.locator('#sound').click(); await expect(page.locator('#sound')).toHaveText('音 OFF');
  await page.locator('#sound').click(); await expect(page.locator('#sound')).toHaveText('音 ON');
  await page.screenshot({ path: `output/playwright/trombone-layout-${size.width}.png`, fullPage: true });
});
test('real AudioContext receives both pitches and cleans up voices', async ({ page }) => {
  await page.addInitScript(() => {
    window.__brass = { frequencies: [], started: 0, ended: 0 };
    const make = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function () {
      const o = make.call(this), set = o.frequency.setValueAtTime.bind(o.frequency), start = o.start.bind(o);
      o.frequency.setValueAtTime = (f, t) => { window.__brass.frequencies.push(f); return set(f, t); };
      o.start = (...args) => { window.__brass.started++; o.addEventListener('ended', () => window.__brass.ended++); return start(...args); };
      return o;
    };
  });
  await page.goto(url); await page.locator('#start').click();
  await expect(page.locator('#scene')).toHaveAttribute('data-audio', 'running');
  await page.waitForFunction(() => document.querySelector('#scene').dataset.hops === '1');
  await page.keyboard.down('Space');
  await page.waitForFunction(() => document.querySelector('#scene').dataset.hops === '2');
  await page.keyboard.up('Space'); await page.locator('#pause').click();
  await expect.poll(() => page.evaluate(() => window.__brass.ended)).toBeGreaterThanOrEqual(2);
  const audio = await page.evaluate(() => window.__brass);
  expect(audio.frequencies.some(f => Math.abs(f - 196 * .985) < .01)).toBe(true);
  expect(audio.frequencies.some(f => Math.abs(f - 261.6256 * .985) < .01)).toBe(true);
});
