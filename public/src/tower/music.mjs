// The tower's music: a music-box song that gains a voice in each room, and the
// morning it ends with. One beat is one hop (0.78s); a bar is four. Notes carry
// their time inside the bar in seconds.
import { PERIOD as BEAT } from '../engine.mjs';

export const BAR = BEAT * 4, STEP = BEAT / 4;
// C, A minor, F, G; then C, E minor, F, G with a turn home.
const CHORDS = [[48, [60, 64, 67]], [45, [57, 60, 64]], [41, [57, 60, 65]], [43, [59, 62, 67]], [48, [60, 64, 67]], [40, [59, 64, 67]], [41, [57, 60, 65]], [43, [59, 62, 65]]];
// The tune, two notes a beat (midi, or null to rest), one bar per row.
const TUNE = [
  [76, null, 79, 76, 74, null, 72, null], [72, null, 76, 72, 69, null, 67, null],
  [69, 72, 77, 76, 74, null, 72, null], [71, null, 74, 71, 67, null, null, null],
  [76, null, 79, 81, 79, null, 76, null], [79, 76, 74, 76, 71, null, 67, null],
  [69, 72, 77, 81, 79, 77, 76, 74], [72, null, 74, null, 72, null, null, null],
];
export const chordAt = bar => CHORDS[((bar % 8) + 8) % 8];
// Which voices play, by how far up the tower the hero is (station index 0–7).
export const LAYERS = ['pad', 'harp', 'block', 'bass', 'keys', 'tongue', 'strings', 'all'];
export function towerBar(bar, level, { v = 1 } = {}) {
  const [root, triad] = chordAt(bar), out = [];
  const on = name => LAYERS.indexOf(name) <= level;
  out.push({ part: 'pad', midi: triad[0], t: 0, dur: BAR * .95, v: .35 * v }, { part: 'pad', midi: triad[2], t: 0, dur: BAR * .95, v: .25 * v });
  if (on('harp')) for (let k = 0; k < 8; k++) out.push({ part: 'harp', midi: triad[[0, 1, 2, 1][k % 4]] + 12, t: k * BEAT / 2, dur: .3, v: .22 * v });
  if (on('block')) for (let k = 0; k < 4; k++) out.push({ part: 'drums', voice: 'block', t: k * BEAT, v: (k % 2 ? .25 : .4) * v });
  if (on('bass')) out.push({ part: 'bass', midi: root, t: 0, dur: BEAT * 1.5, v: .35 * v }, { part: 'bass', midi: root + 7, t: BEAT * 2, dur: BEAT * 1.5, v: .28 * v });
  const tune = TUNE[((bar % 8) + 8) % 8];
  if (on('keys')) tune.forEach((m, k) => { if (m) out.push({ part: on('tongue') ? 'tongue' : 'keys', midi: m, t: k * BEAT / 2, dur: .45, v: .42 * v }); });
  if (on('strings')) out.push({ part: 'strings', midi: triad[1] + 12, t: 0, dur: BAR * .9, v: .22 * v });
  if (on('all')) for (let k = 0; k < 4; k++) out.push({ part: 'drums', voice: k % 2 ? 'snare' : 'kick', t: k * BEAT, v: .4 * v });
  return out;
}
// The morning: from the strike, the bar number counts from the heart's first tick.
// It builds a voice a bar, then the sun comes round on the tutti.
export const DAWN_FROM = 3, CARD_BAR = 9;
export function heartBar(bar) {
  if (bar < 0) return [];
  const level = Math.min(LAYERS.length - 1, bar * 2);
  const out = towerBar(bar, level, { v: bar >= DAWN_FROM ? 1.05 : .85 });
  // The sun's arrival: a held major chord climbing an octave.
  if (bar === DAWN_FROM) [60, 64, 67, 72, 76, 79].forEach((m, i) => out.push({ part: 'strings', midi: m + 12, t: i * STEP, dur: BAR * 1.8, v: .2 }));
  if (bar >= CARD_BAR) return out.filter(n => n.part === 'pad' || n.part === 'harp').map(n => ({ ...n, v: n.v * .7 }));
  return out;
}
