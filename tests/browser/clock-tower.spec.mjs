import { test, expect } from '@playwright/test';

const state = page => page.locator('body');
const logOf = async page => JSON.parse(await page.locator('#log').inputValue());

async function watchDemo(page, id) {
  await expect(state(page)).toHaveAttribute('data-state', 'idle');
  await page.locator(id).click();
  await expect(state(page)).toHaveAttribute('data-state', 'ready');
  await expect(state(page)).toHaveAttribute('data-state', 'done', { timeout: 20000 });
}

test('the tower loads, and the one-rhythm demo reaches the bell without earning anything', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/clocktower.html?lab&lang=en');
  await expect(page.getByRole('heading', { name: 'CLOCK TOWER' })).toBeVisible();
  await expect(page.locator('#goal')).toContainText('Optional');
  await watchDemo(page, '#demo-clear');
  const [attempt] = await logOf(page);
  expect(attempt).toMatchObject({ demo: true, ok: true, tier: 'clear', hops: 13, teeth: 1 });
  await expect(page.locator('#best-state')).toHaveText('—');
  expect(errors).toEqual([]);
});

test('the full demo turns all three gears', async ({ page }) => {
  await page.goto('/clocktower.html?lab&lang=ja');
  await watchDemo(page, '#demo-full');
  await expect(page.locator('#gears-state')).toHaveText('3/3');
  await expect(page.locator('#wheel-state')).toHaveText('3/3');
  const [attempt] = await logOf(page);
  expect(attempt).toMatchObject({ demo: true, ok: true, tier: 'full', gears: 3 });
  await expect(page.locator('#best-state')).toHaveText('—');
});

test('a press arms the jump, and no input falls short and says so', async ({ page }) => {
  await page.goto('/clocktower.html?lab&lang=en');
  await expect(state(page)).toHaveAttribute('data-state', 'idle');
  await page.keyboard.press('Space');
  await expect(state(page)).toHaveAttribute('data-state', 'ready');
  await expect(state(page)).toHaveAttribute('data-state', 'done', { timeout: 6000 });
  await expect(page.locator('#outcome')).toContainText('Fell short');
  expect((await logOf(page))[0]).toMatchObject({ demo: false, ok: false, reason: 'short', room: 1 });
});

// Real key events, timed inside the page from the arming press: take-off is one beat later.
// The page's state only updates on a frame, so 'ready' may still show just after take-off.
async function playRhythm(page, hops, pressAt = 280, holdFor = 490) {
  await expect(state(page)).toHaveAttribute('data-state', 'idle');
  await page.evaluate(async ([count, at, hold, period]) => {
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const key = type => window.dispatchEvent(new KeyboardEvent(type, { code: 'Space', bubbles: true, cancelable: true }));
    key('keydown'); key('keyup');
    const takeOff = performance.now() + period;
    for (let hop = 0; hop < count; hop++) {
      await wait(takeOff + hop * period + at - performance.now());
      if (document.body.dataset.state === 'done') return;
      key('keydown');
      await wait(takeOff + hop * period + at + hold - performance.now());
      key('keyup');
    }
  }, [hops, pressAt, holdFor, 780]);
  await expect(state(page)).toHaveAttribute('data-state', 'done', { timeout: 6000 });
}

test('real input: the one rhythm rings the bell and records a clear', async ({ page }) => {
  await page.goto('/clocktower.html?lab&lang=ja');
  await playRhythm(page, 13);
  const attempt = (await logOf(page)).at(-1);
  expect(attempt.reason, JSON.stringify(attempt)).toBe('ok');
  await expect(page.locator('#outcome')).toContainText('鐘を鳴らした');
  await expect(page.locator('#best-state')).toHaveText(/★/);
  // Nobody presses any more, and the clock keeps its beat.
  await expect(state(page)).toHaveAttribute('data-beat', '1', { timeout: 3000 });
  await expect(state(page)).toHaveAttribute('data-beat', '4', { timeout: 4000 });
  await expect(state(page)).toHaveAttribute('data-state', 'done');
  // A later climb finds it remembered, and a press starts over.
  await page.reload();
  await expect(page.locator('#outcome')).toContainText('動き続けている');
  await page.keyboard.press('Space');
  await expect(state(page)).toHaveAttribute('data-state', 'ready');
  await expect(state(page)).not.toHaveAttribute('data-beat');
});

test('real input: pressing right after take-off meets a pendulum, then three misses bring the hint', async ({ page }) => {
  await page.goto('/clocktower.html?lab&lang=en');
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

test('a first press that holds the page while audio starts is not thrown away', async ({ page }) => {
  await page.addInitScript(() => {
    const Real = window.AudioContext;
    window.AudioContext = class extends Real {
      constructor() { const from = performance.now(); while (performance.now() - from < 500); super(); }
    };
  });
  await page.goto('/clocktower.html?lab&lang=ja&fresh');
  await expect(state(page)).toHaveAttribute('data-state', 'idle');
  await page.keyboard.press('Space');
  await expect(state(page)).toHaveAttribute('data-state', 'ready');
  await expect(state(page)).toHaveAttribute('data-state', 'done', { timeout: 6000 });
  await expect(page.locator('#outcome')).not.toContainText('処理が止まった');
  expect((await logOf(page))[0]).toMatchObject({ reason: 'short' });
});

test('real input: the first gold pallet moves the great wheel by one tooth', async ({ page }) => {
  await page.goto('/clocktower.html?lab&lang=ja&room=4&fresh');
  await expect(state(page)).toHaveAttribute('data-state', 'idle');
  await expect(page.locator('#wheel-state')).toHaveText('0/3');
  await page.evaluate(async ([holdFor, period]) => {
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const key = type => window.dispatchEvent(new KeyboardEvent(type, { code: 'Space', bubbles: true, cancelable: true }));
    key('keydown'); key('keyup');
    const takeOff = performance.now() + period;
    await wait(takeOff + 10 - performance.now());
    key('keydown');
    await wait(takeOff + 10 + holdFor - performance.now());
    key('keyup');
  }, [260, 780]);
  await expect(page.locator('#wheel-state')).toHaveText('1/3');
  await expect(page.locator('#outcome')).toContainText('カチッ');
});

test('two gears behind and the full result is gone: the game says so, points to the start, and it works', async ({ page }) => {
  await page.goto('/clocktower.html?lab&lang=ja&room=4&gears=2&fresh');
  await expect(state(page)).toHaveAttribute('data-full-reach', 'lost');
  await expect(page.locator('#outcome')).toContainText('最初から');
  await expect(page.locator('#restart')).toHaveClass(/suggest/);
  await expect(page.locator('#restart')).toContainText('★★');
  await page.locator('#restart').click();
  await expect(state(page)).toHaveAttribute('data-full-reach', 'open');
  await expect(page.locator('#restart')).not.toHaveClass(/suggest/);
  await expect(page.locator('#restart')).toHaveText('最初から');
  await expect(page.locator('#room-state')).toHaveText('1/4');
});

test('one gear behind: the game says the escapement can still wake it', async ({ page }) => {
  await page.goto('/clocktower.html?lab&lang=ja&room=4&gears=1,2&fresh');
  await expect(state(page)).toHaveAttribute('data-full-reach', 'needsWheel');
  await expect(page.locator('#outcome')).toContainText('起こせます');
  await expect(page.locator('#restart')).not.toHaveClass(/suggest/);
});

test('touch: the stage and the button are hold surfaces, and everything fits a phone screen', async ({ page }) => {
  await page.goto('/clocktower.html?lab&lang=ja');
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
  await page.goto('/clocktower.html?lab&lang=en');
  await page.locator('#restart').focus();
  await page.keyboard.down('Space');
  await expect(state(page)).toHaveAttribute('data-state', 'idle');
  await page.keyboard.up('Space');
});
