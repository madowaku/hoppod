// Renders the finale to WAV with the game's own score and voices, from takes left
// by real runs through the course. For ears; the numbers cannot say if it moves anyone.
// Usage (dev server running): BASE_URL=http://127.0.0.1:8033 node tests/browser/render-workshop.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { COURSE } from '../../public/src/workshop/course.mjs';
import { newRun } from '../../public/src/workshop/sim.mjs';
import { solve, HOLDS } from '../helpers/workshop-solver.mjs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8033', OUT = process.env.OUT || 'output/audio';
mkdirSync(OUT, { recursive: true });
const players = {
  calm: [[.25, .5], [0, 0], [.5, .75], ...HOLDS],
  rushing: [[0, 1], [.25, 1], [0, .75], ...HOLDS],
  lateHold: [[.5, 1], [0, .25], [.25, .75], ...HOLDS],
};
const takes = Object.fromEntries(Object.entries(players).map(([name, order]) => [name, solve(COURSE, newRun(), { order }).run.recording]));
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(BASE + '/workshop.html');
for (const [name, take] of Object.entries(takes)) {
  const result = await page.evaluate(async ({ take, bars }) => {
    const { createWorkshopAudio } = await import('/src/workshop/audio.mjs');
    const { finaleBar, BAR } = await import('/src/workshop/arrange.mjs');
    const BEAT = BAR / 4, rate = 44100, lead = 8 * BEAT, seconds = lead + BEAT + bars * BAR + 3;
    const off = new OfflineAudioContext(1, Math.ceil(seconds * rate), rate), audio = createWorkshopAudio(off);
    // The climb: the rod slows by rungs while the hero keeps its own tick.
    for (let k = 0; k <= 8; k++) audio.hopTick(k * BEAT);
    let t = .2; for (const [iv, until] of [[BEAT * 5 / 7, 4 * BEAT], [.62, 5 * BEAT], [.68, 6 * BEAT], [.73, 8 * BEAT - .02]]) for (; t < until; t += iv) audio.chatter(t);
    audio.lock(lead);
    const t0 = lead + BEAT, peaks = [];
    for (let bar = 0; bar < bars; bar++) {
      for (let b = 0; b < 4; b++) audio.tick(t0 + (bar * 4 + b) * BEAT, b % 2 === 1);
      for (const n of finaleBar(take, bar)) audio.note(n, t0 + bar * BAR + n.t, 'live');
    }
    const buffer = await off.startRendering(), data = buffer.getChannelData(0);
    for (let bar = -1; bar < bars; bar += 4) {
      const from = Math.floor((t0 + Math.max(0, bar) * BAR) * rate), to = Math.min(data.length, from + Math.floor(BAR * 4 * rate));
      let sum = 0, peak = 0; for (let i = from; i < to; i++) { sum += data[i] ** 2; peak = Math.max(peak, Math.abs(data[i])); }
      peaks.push({ bar: Math.max(0, bar), rms: +Math.sqrt(sum / Math.max(1, to - from)).toFixed(3), peak: +peak.toFixed(3) });
    }
    let low = 0, all = 0, y = 0, bad = 0; const a = 2 * Math.PI * 300 / rate;
    for (const v of data) { if (!Number.isFinite(v)) bad++; y += a * (v - y); low += y * y; all += v * v; }
    const bytes = new Uint8Array(new Int16Array(Array.from(data, v => Math.max(-1, Math.min(1, v)) * 32767)).buffer);
    let binary = ''; for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
    return { peaks, below300: +(low / all * 100).toFixed(0), bad, rate, wav: btoa(binary), seconds: +seconds.toFixed(1) };
  }, { take, bars: 30 });
  const pcm = Buffer.from(result.wav, 'base64'), head = Buffer.alloc(44);
  head.write('RIFF', 0); head.writeUInt32LE(36 + pcm.length, 4); head.write('WAVEfmt ', 8); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(1, 22);
  head.writeUInt32LE(result.rate, 24); head.writeUInt32LE(result.rate * 2, 28); head.writeUInt16LE(2, 32); head.writeUInt16LE(16, 34); head.write('data', 36); head.writeUInt32LE(pcm.length, 40);
  writeFileSync(`${OUT}/finale-${name}.wav`, Buffer.concat([head, pcm]));
  console.log(name, { seconds: result.seconds, below300HzPct: result.below300, nonFinite: result.bad, parts: Object.fromEntries(Object.entries(take).map(([k, v]) => [k, `${v.events.length}/${v.len}`])) });
  console.log(result.peaks.map(p => `${p.bar}:${p.rms}/${p.peak}`).join('  '));
}
await browser.close();
