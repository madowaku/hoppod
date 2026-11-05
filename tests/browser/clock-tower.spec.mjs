import { test, expect } from '@playwright/test';

const state = page => page.locator('body');
const logOf = async page => JSON.parse(await page.locator('#log').inputValue());

async function watchDemo(page, id) {
  await expect(state(page)).toHaveAttribute('data-state', 'idle');
  await page.locator(id).click();
  await expect(state(page)).toHaveAttribute('data-state', 'ready');
  await expect(state(page)).toHaveAttribute('data-state', 'done', { timeout: 15000 });
}

test('the tower loads, and the one-rhythm demo reaches the bell without earning anything', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/dev/clock-tower.html?lang=en');
  await expect(page.getByRole('heading', { name: 'CLOCK TOWER' })).toBeVisible();
  await expect(page.locator('#goal')).toContainText('Optional');
  await watchDemo(page, '#demo-clear');
  const [attempt] = await logOf(page);
  expect(attempt).toMatchObject({ demo: true, ok: true, tier: 'clear', hops: 10 });
  await expect(page.locator('#best-state')).toHaveText('—');
  expect(errors).toEqual([]);
});

test('the full demo turns all three gears', async ({ page }) => {
  await page.goto('/dev/clock-tower.html?lang=ja');
  await watchDemo(page, '#demo-full');
  await expect(page.locator('#gears-state')).toHaveText('3/3');
  const [attempt] = await logOf(page);
  expect(attempt).toMatchObject({ demo: true, ok: true, tier: 'full', gears: 3 });
  await expect(page.locator('#best-state')).toHaveText('—');
});

test('a press arms the jump, and no input falls short and says so', async ({ page }) => {
  await page.goto('/dev/clock-tower.html?lang=en');
  await expect(state(page)).toHaveAttribute('data-state', 'idle');
  await page.keyboard.press('Space');
  await expect(state(page)).toHaveAttribute('data-state', 'ready');
  await expect(state(page)).toHaveAttribute('data-state', 'done', { timeout: 6000 });
  await expect(page.locator('#outcome')).toContainText('Fell short');
  expect((await logOf(page))[0]).toMatchObject({ demo: false, ok: false, reason: 'short', room: 1 });
});

// Real key events, timed inside the page from the arming press: take-off is one beat later.
async function playRhythm(page, hops, pressAt = 280, holdFor = 490) {
  await expect(state(page)).toHaveAttribute('data-state', 'idle');
  await page.evaluate(async ([count, at, hold, period]) => {
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const key = type => window.dispatchEvent(new KeyboardEvent(type, { code: 'Space', bubbles: true, cancelable: true }));
    key('keydown'); key('keyup');
    const takeOff = performance.now() + period;
    for (let hop = 0; hop < count; hop++) {
      await wait(takeOff + hop * period + at - performance.now());
      if (document.body.dataset.state !== 'run') return;
      key('keydown');
      await wait(takeOff + hop * period + at + hold - performance.now());
      key('keyup');
    }
  }, [hops, pressAt, holdFor, 780]);
  await expect(state(page)).toHaveAttribute('data-state', 'done', { timeout: 6000 });
}

test('real input: the one rhythm rings the bell and records a clear', async ({ page }) => {
  await page.goto('/dev/clock-tower.html?lang=ja');
  await playRhythm(page, 10);
  const attempt = (await logOf(page)).at(-1);
  expect(attempt.reason, JSON.stringify(attempt)).toBe('ok');
  await expect(page.locator('#outcome')).toContainText('鐘を鳴らした');
  await expect(page.locator('#best-state')).toHaveText(/★/);
});

test('real input: pressing right after take-off meets a pendulum, then three misses bring the hint', async ({ page }) => {
  await page.goto('/dev/clock-tower.html?lang=en');
  await playRhythm(page, 3, 5, 530);
  const attempt = (await logOf(page)).at(-1);
  expect(attempt.reason, JSON.stringify(attempt)).toBe('hit');
  await expect(page.locator('#outcome')).toContainText('pendulum');
  await expect(page.locator('#outcome')).not.toContainText('Hint');
  for (let miss = 0; miss < 2; miss++) {
    await page.waitForTimeout(250);
    await page.keyboard.press('Space');
    await expect(state(page)).toHaveAttribute('data-state', 'ready');
    await expect(state(page)).toHaveAttribute('data-state', 'done', { timeout: 6000 });
  }
  await expect(page.locator('#outcome')).toContainText('wait a moment after take-off');
});

test('touch: the stage and the button are hold surfaces, and everything fits a phone screen', async ({ page }) => {
  await page.goto('/dev/clock-tower.html?lang=ja');
  const hold = await page.locator('#hold').boundingBox();
  expect(hold.y + hold.height).toBeLessThanOrEqual(844);
  const box = await page.locator('#scene').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(state(page)).toHaveAttribute('data-state', 'ready');
  await expect(page.locator('#hold')).toHaveClass(/active/);
  await page.mouse.up();
  await expect(page.locator('#hold')).not.toHaveClass(/active/);
});

test('Space on a focused control does not jump', async ({ page }) => {
  await page.goto('/dev/clock-tower.html?lang=en');
  await page.locator('#restart').focus();
  await page.keyboard.down('Space');
  await expect(state(page)).toHaveAttribute('data-state', 'idle');
  await page.keyboard.up('Space');
});
