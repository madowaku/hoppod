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


test('stage 2 offers a wider silent landing target while the demo remains safe', async ({ page }) => {
  await page.goto('/dev/string-valley.html?lang=en&stage=far-silent');
  await expect(page.locator('#goal')).toContainText('wide pad');
  await watchDemo(page);
  await expect(page.locator('#string-state')).toHaveText('SILENT');
  await expect(page.locator('#landing-state')).toHaveText('221px');
});
