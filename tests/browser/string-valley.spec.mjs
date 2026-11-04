import { test, expect } from '@playwright/test';

test('String Valley demos share a landing but change the audible-string outcome', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/dev/string-valley.html');
  await expect(page.getByRole('heading', { name: 'STRING VALLEY' })).toBeVisible();

  await page.getByRole('button', { name: /SHOW EARLY FAST/ }).click();
  await expect(page.locator('#string-state')).toHaveText('♪ HIT', { timeout: 12000 });
  await expect(page.locator('#landing-state')).toHaveText('221.3px', { timeout: 12000 });
  await expect(page.locator('#outcome')).toContainText('CLEAR!', { timeout: 12000 });
  const earlyFast = await page.locator('#fast-seconds').textContent();

  await page.getByRole('button', { name: /SHOW LATE FAST/ }).click();
  await expect(page.locator('#string-state')).toHaveText('MISSED', { timeout: 12000 });
  await expect(page.locator('#landing-state')).toHaveText('221.3px', { timeout: 12000 });
  await expect(page.locator('#outcome')).toContainText('SAFE LANDING, NO NOTE', { timeout: 12000 });
  const lateFast = await page.locator('#fast-seconds').textContent();

  expect(earlyFast).toBe('0.39s');
  expect(lateFast).toBe('0.39s');
  expect(errors).toEqual([]);
});

test('String Valley manual start and retry keep the same 1-button UI', async ({page}) => {
  await page.goto('/dev/string-valley.html');
  await page.getByRole('button', { name: /TRY MANUAL/ }).click();
  await expect(page.locator('#landing-state')).toHaveText(/IN AIR|FELL/);
  await page.getByRole('button', { name: /TRY MANUAL/ }).click();
  await expect(page.getByRole('button', { name: 'Hold to move fast' })).toBeVisible();
  await page.keyboard.press('r');
  await expect(page.locator('#fast-seconds')).toHaveText(/0\.\d\ds/);
});
