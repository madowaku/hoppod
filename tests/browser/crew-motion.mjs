// Film strips of the four transformations, drawn by the game's own crew code
// at 4x: blue's light fanning out, green planting on the switch, red's hook
// reaching and closing on green, Rapippo's legs locking and ears rising.
// `node tests/browser/crew-motion.mjs` with the dev server running
// (BASE_URL, default http://127.0.0.1:8000). Writes output/crew/motion.png. Not a test.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.BASE_URL || 'http://127.0.0.1:8000';
await mkdir('output/crew', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${base}/story.html?lang=en`);
const png = await page.evaluate(async () => {
  const { drawPod } = await import('/src/pod.mjs');
  const { COMPANION_PALETTE } = await import('/src/companion.mjs');
  const { drawCrewParts, drawTransmit } = await import('/src/story/crew.mjs');
  const P = { blue: COMPANION_PALETTE, green: { c: '#b4f2c8', w: '#ecfff2', s: '#73c290', a: '#3fcf7f' }, red: { c: '#ffbcae', w: '#fff1ec', s: '#d98a7a', a: '#ff6a4f' } };
  const smooth = (a, b, v) => { const k = Math.max(0, Math.min(1, (v - a) / (b - a))); return k * k * (3 - 2 * k); };
  const C = 72, Z = 4, cols = 7;
  const rows = [
    // Blue: form 0 → 1 over the dawn, then a bell pulse.
    [0, .15, .3, .5, .75, 1, 1].map((form, i) => g => { drawPod(g, 36, 62, 1, { phase: 0, palette: P.blue }); drawCrewParts(g, 'blue', 36, 62, 1, { palette: P.blue, form, pulse: i === 6 ? .8 : 0, top: -21 }); }),
    // Green: the hop onto the plate, then plant age 0 → .5s.
    [null, -1, 0, .05, .1, .2, .5].map(age => g => {
      g.fillStyle = '#5fe39a'; g.fillRect(20, 62, 32, 4);
      const y = age === null ? 48 : age < 0 ? 56 : 62, plant = age === null || age < 0 ? null : age;
      drawPod(g, 36, y, 1, plant === null ? { phase: .5, palette: P.green } : { phase: 0, land: 1, palette: P.green });
      drawCrewParts(g, 'green', 36, y, 1, { palette: P.green, form: plant === null ? 0 : 1, plant, top: plant === null ? -23 : -19 });
    }),
    // Red: flying in (gap 200 → 0), the hook closes, the pair lifts.
    [200, 120, 60, 20, 0, 'grip', 'lift'].map(step => g => {
      const gap = typeof step === 'number' ? step : 0, near = smooth(160, 0, gap), lift = step === 'lift' ? 1 : 0;
      const ry = 20 + 30 * near - 12 * lift, gy = 66 - 18 * lift, gx = 52 - 12 - gap * .1 - 4 * lift, top = -21;
      drawPod(g, gx, gy, 1, { phase: 0, land: 1, palette: P.green });
      drawPod(g, 52, ry, 1, { phase: .5, palette: P.red });
      const to = step === 'lift' ? [-16, gy - ry - 22] : [-26 + (gx - 52 + 26) * near, top + 2 + (gy - ry - 22 - top - 2) * near];
      drawCrewParts(g, 'red', 52, ry, 1, { palette: P.red, form: 1, to, grip: step === 'grip' || step === 'lift' ? 1 : 0, top });
    }),
    // Rapippo: beats since the dock.
    [0, .08, .15, .2, .25, .4, .9].map(a => g => { drawPod(g, 36, 62, 1, { phase: 0, land: Math.max(0, 1 - Math.abs(a - .25) / .12) }); drawTransmit(g, 36, 62, 1, a, a > .85); }),
  ];
  const sheet = document.createElement('canvas'); sheet.width = cols * C * Z; sheet.height = rows.length * C * Z;
  const sg = sheet.getContext('2d'); sg.imageSmoothingEnabled = false; sg.fillStyle = '#0b1016'; sg.fillRect(0, 0, sheet.width, sheet.height);
  rows.forEach((row, r) => row.forEach((draw, c) => {
    const cell = document.createElement('canvas'); cell.width = cell.height = C; draw(cell.getContext('2d'));
    sg.drawImage(cell, c * C * Z, r * C * Z, C * Z, C * Z);
    sg.strokeStyle = '#1d2a36'; sg.strokeRect(c * C * Z + .5, r * C * Z + .5, C * Z - 1, C * Z - 1);
  }));
  return sheet.toDataURL();
});
await writeFile('output/crew/motion.png', Buffer.from(png.split(',')[1], 'base64'));
await browser.close();
console.log('output/crew/motion.png');
