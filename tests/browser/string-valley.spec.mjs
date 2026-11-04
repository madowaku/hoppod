import { test, expect } from '@playwright/test';

const state = page => page.locator('body');

async function watchDemo(page) {
  await page.locator('#demo').click();
  await expect(state(page)).toHaveAttribute('data-state', 'ready');
  await expect(state(page)).toHaveAttribute('data-state', 'done', { timeout: 12000 });
}

test('String Valley demos land together with opposite string results', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/dev/string-valley.html?lang=en');
  await expect(page.getByRole('heading', { name: /STRING VALLEY/ })).toBeVisible();

  await watchDemo(page);
  await expect(page.locator('#string-state')).toHaveText('♪ RANG');
  await expect(page.locator('#landing-state')).toHaveText('221px');
  await expect(page.locator('#fast-seconds')).toHaveText('0.39s');

  await page.locator('[data-stage=far-silent]').click();
  await watchDemo(page);
  await expect(page.locator('#string-state')).toHaveText('SILENT');
  await expect(page.locator('#landing-state')).toHaveText('221px');
  await expect(page.locator('#fast-seconds')).toHaveText('0.39s');
  expect(errors).toEqual([]);
});

test('a demo never counts as a clear', async ({ page }) => {
  await page.goto('/dev/string-valley.html?lang=en');
  await watchDemo(page);
  await expect(page.locator('[data-stage=far-ring]')).not.toHaveClass(/cleared/);
});

test('a press only arms the jump: one beat passes before take-off', async ({ page }) => {
  await page.goto('/dev/string-valley.html?lang=en');
  await expect(state(page)).toHaveAttribute('data-state', 'idle');
  await page.keyboard.down('Space');
  await expect(state(page)).toHaveAttribute('data-state', 'ready');
  await expect(state(page)).toHaveAttribute('data-state', 'run', { timeout: 3000 });
  await page.keyboard.up('Space');
});

test('real input decides the landing: no press falls short, holding throughout flies too far', async ({ page }) => {
  await page.goto('/dev/string-valley.html?lang=en');
  await page.keyboard.press('Space');
  await expect(state(page)).toHaveAttribute('data-state', 'done', { timeout: 6000 });
  await expect(page.locator('#outcome')).toContainText('Fell short');
  await expect(page.locator('#landing-state')).toHaveText('FELL');

  await page.keyboard.press('r');
  await expect(state(page)).toHaveAttribute('data-state', 'idle');
  await page.keyboard.down('Space');
  await expect(state(page)).toHaveAttribute('data-state', 'done', { timeout: 6000 });
  await page.keyboard.up('Space');
  await expect(page.locator('#outcome')).toContainText('too far');
  const log = JSON.parse(await page.locator('#log').inputValue());
  expect(log.map(attempt => attempt.reason)).toEqual(['short', 'far']);
  expect(log[1].fast).toBeCloseTo(.78, 2);
});

test('touch: the whole stage and the button are hold surfaces, and fit a phone screen', async ({ page }) => {
  await page.goto('/dev/string-valley.html?lang=en');
  const hold = await page.locator('#hold').boundingBox();
  expect(hold.y + hold.height).toBeLessThanOrEqual(844);
  const canvas = page.locator('#scene');
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(state(page)).toHaveAttribute('data-state', 'ready');
  await expect(page.locator('#hold')).toHaveClass(/active/);
  await page.mouse.up();
  await expect(page.locator('#hold')).not.toHaveClass(/active/);
});

test('Space on a focused control does not jump, and a stage link opens that stage', async ({ page }) => {
  await page.goto('/dev/string-valley.html?lang=en&stage=phrase');
  await expect(page.locator('[data-stage=phrase]')).toHaveAttribute('aria-current', 'true');
  await page.locator('#copy').focus();
  await page.evaluate(() => { document.querySelector('details').open = true; document.getElementById('copy').focus(); });
  await page.keyboard.down('Space');
  await expect(state(page)).toHaveAttribute('data-state', 'idle');
  await page.keyboard.up('Space');
});


// Timed inside the page so that a Playwright round trip cannot stretch the press.
async function jump(page, pressAt, holdFor) {
  await page.keyboard.press('Space');
  await expect(state(page)).toHaveAttribute('data-state', 'run', { timeout: 3000 });
  await page.evaluate(async ([at, length]) => {
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const key = type => window.dispatchEvent(new KeyboardEvent(type, { code: 'Space', bubbles: true, cancelable: true }));
    await wait(at);
    key('keydown');
    await wait(length);
    key('keyup');
  }, [pressAt, holdFor]);
  await expect(state(page)).toHaveAttribute('data-state', 'done', { timeout: 6000 });
  return JSON.parse(await page.locator('#log').inputValue()).at(-1);
}
const button = (page, id) => page.locator(`[data-stage=${id}]`);

test('stage 2 demo shows the optional goal but earns nothing', async ({ page }) => {
  await page.goto('/dev/string-valley.html?lang=en&stage=far-silent');
  await expect(page.locator('#goal')).toContainText('Optional');
  await watchDemo(page);
  await expect(page.locator('#string-state')).toHaveText('SILENT');
  await expect(page.locator('#landing-state')).toHaveText('221px');
  await expect(button(page, 'far-silent')).not.toHaveClass(/cleared|full-pass/);
});

test('stage 2: a short early press is a quiet clear, and it opens the next stage', async ({ page }) => {
  await page.goto('/dev/string-valley.html?lang=ja&stage=far-silent');
  const attempt = await jump(page, 40, 140);
  expect(attempt.tier).toBe('quiet');
  expect(attempt.x).toBeGreaterThanOrEqual(173);
  expect(attempt.x).toBeLessThan(189);
  await expect(page.locator('#outcome')).toHaveText('★ 静かに着地できた！');
  await expect(page.locator('#string-state')).toHaveText('無音');
  await expect(page.locator('#landing-state')).toHaveText(`${Math.floor(attempt.x)}px`);
  await expect(button(page, 'far-silent')).toHaveClass(/cleared/);
  await expect(button(page, 'far-silent')).not.toHaveClass(/full-pass/);
  await page.waitForTimeout(250);
  await page.keyboard.press('Space');
  await expect(button(page, 'near-ring')).toHaveAttribute('aria-current', 'true');
});

test('stage 2: a late press is the optional full pass, and it does not hold progress back', async ({ page }) => {
  await page.goto('/dev/string-valley.html?lang=ja&stage=far-silent');
  const attempt = await jump(page, 400, 700);
  expect(attempt.tier).toBe('through');
  expect(attempt.x).toBeGreaterThanOrEqual(189);
  await expect(page.locator('#outcome')).toHaveText('★★ 弦を完全にくぐり抜けた！');
  await expect(page.locator('#landing-state')).toHaveText(`${Math.floor(attempt.x)}px`);
  await expect(button(page, 'far-silent')).toHaveClass(/full-pass/);
  await page.waitForTimeout(250);
  await page.keyboard.press('Space');
  await expect(button(page, 'near-ring')).toHaveAttribute('aria-current', 'true');
});

test('stage 2: the hint after three misses does not claim late FAST is required', async ({ page }) => {
  await page.goto('/dev/string-valley.html?lang=en&stage=far-silent');
  for (let miss = 0; miss < 3; miss++) {
    await page.keyboard.press('Space');
    await expect(state(page)).toHaveAttribute('data-state', 'done', { timeout: 6000 });
    await expect(page.locator('#outcome')).toContainText('Fell short');
    await page.waitForTimeout(250);
    if (miss < 2) await expect(page.locator('#outcome')).not.toContainText('Hint');
  }
  await expect(page.locator('#outcome')).toContainText('a short press is enough');
});
