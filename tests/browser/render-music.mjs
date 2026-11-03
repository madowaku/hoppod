// Renders listening previews of the STORY music with the game's own
// synthesis (OfflineAudioContext, same notesAt and voices) to WAV:
// `node tests/browser/render-music.mjs` with the dev server running
// (BASE_URL, default http://127.0.0.1:8000). Writes output/audio/*.wav and
// a summary with loudness per second. Not a test.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const out = process.env.OUT || 'output/audio';
const base = process.env.BASE_URL || 'http://127.0.0.1:8000';
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${base}/story.html?lang=en`);

const clips = await page.evaluate(async () => {
  const { createStoryAudio, notesAt, STEP, ENDING } = await import('/src/story/music.mjs');
  const { BEAT } = await import('/src/story/beat.mjs');
  const RATE = 44100, smooth = (a, b, x) => { const k = Math.max(0, Math.min(1, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
  const Native = window.AudioContext;
  async function render(seconds, plan) {
    window.AudioContext = class extends OfflineAudioContext { constructor() { super(1, Math.ceil(RATE * seconds), RATE); } get state() { return 'running'; } resume() { return Promise.resolve(); } };
    const audio = createStoryAudio(); audio.unlock(); const ctx = audio.context;
    const t0 = .1;
    for (let k = 0; k * .05 < seconds; k++) { const t = k * .05, m = plan.mix(t); audio.mix(m.levels, m.muffle ?? 0, m.clarity ?? {}, t0 + t); }
    for (let n = 0; n * STEP < seconds - .2; n++) for (const note of notesAt(n, plan.song(n * STEP))) audio.note(note, t0 + n * STEP);
    for (const [t, name] of plan.cues ?? []) name === 'rumble' ? audio.rumble(t0 + t, 7) : audio.cue(name, t0 + t);
    const data = (await ctx.startRendering()).getChannelData(0);
    window.AudioContext = Native;
    // 16-bit PCM WAV, normalised only if it would clip.
    let peak = 0; for (const v of data) peak = Math.max(peak, Math.abs(v));
    const gain = peak > .98 ? .98 / peak : 1, buf = new ArrayBuffer(44 + data.length * 2), dv = new DataView(buf);
    const str = (o, t) => [...t].forEach((c, i) => dv.setUint8(o + i, c.charCodeAt(0)));
    str(0, 'RIFF'); dv.setUint32(4, 36 + data.length * 2, true); str(8, 'WAVEfmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
    dv.setUint32(24, RATE, true); dv.setUint32(28, RATE * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); str(36, 'data'); dv.setUint32(40, data.length * 2, true);
    for (let i = 0; i < data.length; i++) dv.setInt16(44 + i * 2, Math.max(-1, Math.min(1, data[i] * gain)) * 32767, true);
    const rms = []; for (let s = 0; s < seconds; s += .25) { let e = 0, c = 0; for (let i = Math.floor(s * RATE); i < Math.min(data.length, (s + .25) * RATE); i++) { e += data[i] ** 2; c++; } rms.push(+Math.sqrt(e / Math.max(1, c)).toFixed(4)); }
    let b = ''; const bytes = new Uint8Array(buf); for (let i = 0; i < bytes.length; i += 32768) b += String.fromCharCode(...bytes.subarray(i, i + 32768));
    return { wav: btoa(b), peak: +peak.toFixed(3), rms };
  }
  const parts = (list, apart = false) => ({ dockBeat: null, parts: new Set(list), tick: () => true, origin: 0, apart });
  // The game's mix with green and red near: blue's bell steps back (.85 × .7).
  const full = { tick: .9, bell: .6, bass: .9, perc: .9, pad: 0, sparkle: 0 };
  const result = {};
  // Wind-up: the hero's clockwork alone, in the dark.
  result['01-windup'] = await render(8 * BEAT, { song: () => parts([]), mix: () => ({ levels: { tick: .9 }, muffle: 1 }) });
  // Awakening: four beats of tick, the third part, the light opens over 3s
  // and blue's bell starts the song.
  const wake = 4 * BEAT;
  result['02-awakening'] = await render(wake + 20 * BEAT, {
    song: t => t < wake ? parts([]) : { dockBeat: null, parts: new Set(['bell']), tick: () => true, origin: 4 },
    mix: t => { const o = smooth(0, 3, t - wake); return { levels: { tick: .9, bell: .85 * o }, muffle: 1 - o }; },
    cues: [[wake, 'assemble']],
  });
  for (const [name, part] of [['03-bell-solo', 'bell'], ['04-bass-solo', 'bass'], ['05-perc-solo', 'perc']])
    result[name] = await render(32 * BEAT, { song: () => parts([part]), mix: () => ({ levels: { [part]: part === 'bell' ? .85 : full[part] } }) });
  result['06-together'] = await render(64 * BEAT, { song: () => parts(['bell', 'bass', 'perc']), mix: () => ({ levels: full }) });
  // Reunion: red has green; their parts come back faint and thin, clearer
  // with every hop (the game's own curve), then the reunion cue.
  const back = 14;
  result['07-reunion'] = await render(back + 6, {
    song: t => parts(['bell', 'bass', 'perc'], t < back),
    mix: t => { const near = smooth(0, back, t) ** 1.5, lv = .3 + .6 * near, cl = .12 + .6 * near, done = t >= back;
      return { levels: { ...full, bass: .9 * (done ? 1 : lv), perc: .9 * (done ? 1 : lv) }, clarity: { bass: done ? 1 : cl, perc: done ? 1 : cl } }; },
    cues: [[back, 'reunion']],
  });
  // Apart: together for 8 beats, then green is left behind (its part fades to
  // a radio and blue's tune thins), then red carries it back (07's curve).
  const split = 8 * BEAT, away = split + 16 * BEAT;
  result['09-apart-and-back'] = await render(away + back + 8, {
    song: t => parts(['bell', 'bass', 'perc'], t >= split && t < away + back),
    mix: t => {
      if (t < split) return { levels: full };
      const gone = smooth(split, split + 3 * BEAT, t), near = smooth(away, away + back, t) ** 1.5, done = t >= away + back;
      const lv = t < away ? .9 - .9 * gone : done ? .9 : .9 * (.3 + .6 * near), cl = t < away ? 1 - .88 * gone : done ? 1 : .12 + .6 * near;
      const perc = t < away ? .9 : lv;
      return { levels: { ...full, bass: lv, perc }, clarity: { bass: cl, perc: t < away ? 1 : cl } };
    },
    cues: [[split, 'strand'], [away, 'pickup'], [away + back, 'reunion']],
  });
  // Ending: the last touchdown (dock), one silent beat, blue, green, red,
  // the pad, the launch, then the base receding from the rocket to black.
  const lead = 4, D = lead, seconds = (lead + ENDING.black + 3) * BEAT;
  result['08-ending'] = await render(seconds, {
    song: t => ({ dockBeat: D, parts: new Set(['bell', 'bass', 'perc', ...(t / BEAT - D >= ENDING.away ? ['sparkle'] : [])]), tick: b => b <= D, origin: 0 }),
    mix: t => {
      const a = t / BEAT - D;
      if (a < 0) return { levels: full };
      const k = smooth(ENDING.away, ENDING.lights, a), outv = 1 - smooth(ENDING.black - 2, ENDING.black + 2, a), lv = (.12 + .88 * (1 - k) ** 2) * outv;
      return { levels: { tick: 0, bell: lv * (1 - .3 * smooth(ENDING.bass - .5, ENDING.bass + 1, a)), bass: lv, perc: lv, pad: lv, sparkle: smooth(ENDING.away, ENDING.away + 8, a) * .7 * outv }, muffle: k * .85 };
    },
    cues: [[D * BEAT, 'dock'], [(D + ENDING.launch) * BEAT, 'rumble']],
  });
  return result;
});
const summary = {};
for (const [name, clip] of Object.entries(clips)) {
  await writeFile(`${out}/${name}.wav`, Buffer.from(clip.wav, 'base64'));
  summary[name] = { seconds: clip.rms.length / 4, peak: clip.peak, rms: clip.rms };
}
await writeFile(`${out}/summary.json`, JSON.stringify(summary));
for (const [name, s] of Object.entries(summary)) console.log(name, s.seconds + 's', 'peak', s.peak);
await browser.close();
