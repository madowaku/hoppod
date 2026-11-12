// Frame times on a phone-sized page with the CPU throttled 4×, real audio on.
// Headless Chromium: GPU raster is not emulated, so a real Android check remains.
// Usage (server running): BASE_URL=http://127.0.0.1:8033 node tests/browser/perf-workshop.mjs
import { chromium } from '@playwright/test';
import { COURSE } from '../../public/src/workshop/course.mjs';
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8033';
const cp = id => COURSE.checkpoints.findIndex(c => COURSE.stations[c.station].id === id);
const browser = await chromium.launch();
async function measure(name, query, wait, seconds = 8) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
  const page = await context.newPage();
  await page.addInitScript(() => { globalThis.__rapippoWorkshopProbe = {}; });
  await page.goto(`${BASE}/workshop.html?lang=ja${query}`);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.locator('#action').click();
  if (wait) await page.waitForFunction(wait, null, { timeout: 120000 });
  const stats = await page.evaluate(seconds => new Promise(done => {
    const times = []; let last = performance.now(); const end = last + seconds * 1000;
    const step = now => { times.push(now - last); last = now; if (now < end) requestAnimationFrame(step); else { times.sort((a, b) => a - b); done({ frames: times.length, mean: +(times.reduce((a, b) => a + b, 0) / times.length).toFixed(1), p95: +times[Math.floor(times.length * .95)].toFixed(1), over33: times.filter(t => t > 33).length }); } };
    requestAnimationFrame(step);
  }), seconds);
  const r = await page.evaluate(() => { const p = globalThis.__rapippoWorkshopProbe.read(); return { domain: p.domain, voices: p.audio?.voices, station: p.station, bar: p.finaleBar, status: p.status }; });
  console.log(name.padEnd(12), JSON.stringify(stats), JSON.stringify(r));
  await context.close();
}
await measure('harp', `&cp=${cp('harp')}`, null);
await measure('wood', `&cp=${cp('wood')}`, null);
await measure('cymbal', `&cp=${cp('cymbal')}`, null);
await measure('tutti', '&end=1', () => globalThis.__rapippoWorkshopProbe.read().finaleBar >= 17, 8);
await browser.close();
