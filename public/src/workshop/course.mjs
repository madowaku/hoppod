// THE MOON INSTRUMENT WORKSHOP: one fixed course, ten stations. Geometry is built
// on the game's own hop: 81.9px at SLOW, 210.6px at FAST. U is what one sixteenth
// note of FAST adds to a hop (0.195s × 165px/s).
import { PERIOD as BEAT, SLOW_SPEED, FAST_SPEED, INSET } from '../engine.mjs';

export const U = (FAST_SPEED - SLOW_SPEED) * BEAT / 4;
export const HOP_MIN = SLOW_SPEED * BEAT, HOP_MAX = FAST_SPEED * BEAT;
// The cart runs at the midpoint speed, so against it SLOW goes back and FAST forward.
export const CART_SPEED = (SLOW_SPEED + FAST_SPEED) / 2, CART_HALF = 168, CART_FOOT = 160, CART_BEATS = 30;
export const STRING_SPACING = 14;
// Antenna windows inside a hop, from the production hop arc.
export const HARP_WINDOW = Object.freeze([.13, .649]), STRING_WINDOW = Object.freeze([.279, .501]), STRING_REACH = 16;
export const TONGUE_PITCH = Object.freeze({ B: 71, E: 76, G: 67, D: 74, A: 69 });
// One tick of the rod at each rung: the higher the weight, the slower the beat.
// The bare rod runs 5:7 against the hop; at the tip it is the hop exactly.
export const BARE_TICK = BEAT * 5 / 7, RUNG_TICKS = Object.freeze([.62, .68, .73]);
export const ROD_LENGTH = 190;

export const STATIONS = Object.freeze(['hall', 'drums', 'tongue', 'keys', 'harp', 'strings', 'wood', 'bellows', 'brass', 'cymbal', 'metronome']);

function build() {
  const platforms = [], stations = [], checkpoints = [], strings = [];
  let x = 0, index = 0;
  const add = (w, kind, extra = {}) => { const p = { a: x, b: x + w, kind, i: index++, ...extra }; platforms.push(p); x += w; return p; };
  const gap = w => { x += w; };
  const station = id => stations.push({ id, from: x, to: 0 });
  const checkpoint = (at = x + 40) => checkpoints.push({ x: at, from: at - 30, station: stations.length - 1 });
  const close = () => { stations.at(-1).to = x; };

  // 0. The silent hall: long safe ground, only the hero's tick.
  station('hall'); checkpoints.push({ x: 75, from: 0, station: 0 });
  add(1500, 'plain'); close();

  // 1. Drums: a continuous deck, nowhere to fall until the last third.
  station('drums'); checkpoint();
  add(140, 'plain');
  const heads = [['kick', 128], ['snare', 88], ['block', 66], ['snare', 88]];
  for (let round = 0; round < 5; round++) for (const [voice, w] of heads) add(w, 'drum', { voice, flush: true });
  for (const [voice, w] of [['kick', 150], ['snare', 110], ['kick', 150], ['block', 110], ['kick', 170]]) { gap(44); add(w, 'drum', { voice }); }
  close();

  // 2. Tongue drum: what you strike decides what is solid ahead.
  station('tongue'); checkpoint();
  add(130, 'plain');
  const order = ['B', 'E', 'G', 'D', 'A', 'E', 'B', 'D', 'G', 'A'];
  for (const name of order) add(50, 'tongue', { name, m: TONGUE_PITCH[name], flush: true });
  for (const [a, b] of [['G', 'D'], ['E', 'A'], ['B', 'G'], ['D', 'E']]) {
    add(120, 'plain'); checkpoint(x - 70);
    add(90, 'tongue', { name: a, m: TONGUE_PITCH[a] }); gap(14);
    add(90, 'tongue', { name: b, m: TONGUE_PITCH[b] }); gap(12);
    add(80, 'res', { name: a, m: TONGUE_PITCH[a] }); gap(14);
    add(80, 'res', { name: b, m: TONGUE_PITCH[b] }); gap(14);
  }
  add(150, 'plain'); close();

  // 3. Keys: a floor without holes. How far you hop is the interval.
  station('keys'); checkpoint();
  add(120, 'plain');
  const keysAt = x, KEY = HOP_MIN / 2;
  for (let k = 0; k < 52; k++) add(KEY, 'key', { key: k, flush: true });
  add(120, 'plain'); close();

  // 4. Harp: strings overhead. FAST sweeps many, SLOW picks a few.
  station('harp'); checkpoint();
  const harp = { from: x + 120, to: x + 1500 };
  add(1660, 'plain'); close();

  // 5. Strings: pads and single strings. The same pad, a different sound.
  station('strings'); checkpoint();
  add(150, 'plain');
  for (let room = 0; room < 10; room++) { strings.push(x + 28); gap(58); add(room % 2 ? 120 : 160, 'pad'); if (room % 4 === 3) checkpoint(x - 60); }
  add(120, 'plain'); close();

  // 6. Woodwind: every press is a note, and the ground writes the rhythm:
  // a wide gap asks for a long tone, a narrow one leaves room for short ones.
  station('wood'); checkpoint();
  add(150, 'plain');
  [24, 24, 104, 24, 88, 24, 24, 112, 24, 72, 24, 112, 24, 24, 96, 24, 24, 24, 104, 24, 72, 24, 112].forEach((w, i) => { gap(w); add(i % 3 === 2 ? 120 : 104, 'stone'); if (i % 8 === 7) checkpoint(x - 60); });
  add(120, 'plain'); close();

  // 7. Bellows: FAST pushes, SLOW draws; each plate takes one direction.
  station('bellows'); checkpoint();
  add(150, 'plain');
  ['pull', 'pull', 'push', 'pull', 'push', 'pull', 'pull', 'push', 'push', 'pull', 'push', 'pull', 'pull', 'push', 'pull', 'push'].forEach((dir, i) => {
    gap(14); add(dir === 'push' ? 214 : 96, dir); if (i % 6 === 5) checkpoint(x - 50);
  });
  gap(14); add(150, 'plain'); close();

  // 8. Brass: the cart. It waits, runs while you ride, and stops at the far bank.
  station('brass'); checkpoint();
  add(190, 'plain');
  const x0 = x + CART_HALF, x1 = x0 + CART_SPEED * BEAT * CART_BEATS;
  const cart = { x0, x1, prompts: [0, 2, 1, -1, 0, -2, 1, 3] };
  x = x1 + CART_HALF; add(170, 'plain'); close();

  // 9. Cymbals: the dark. Each crash leaves its ring as light for four beats.
  station('cymbal'); checkpoint();
  add(130, 'plain');
  for (let round = 0; round < 6; round++) {
    add(110, 'cymbal');
    for (let n = 0; n < (round % 2 ? 2 : 1) + 1; n++) { gap(30); add(96, 'stone'); }
    gap(30);
    if (round === 2) checkpoint(x + 50);
  }
  add(150, 'cymbal', { last: true }); add(60, 'plain'); close();

  // 10. The metronome: three rungs up the rod, then the tip.
  station('metronome'); checkpoint();
  add(380, 'plain');
  const rungs = [];
  for (let r = 0; r < 3; r++) rungs.push(add(100, 'rung', { rung: r, h: 40 + r * 50, flush: true }));
  const dockX = x + 40;
  add(300, 'tip', { h: ROD_LENGTH, flush: true }); close();

  // Where two platforms touch, the ground is continuous: no rim, no hidden gap.
  platforms.forEach((p, i) => { p.rimL = !(platforms[i - 1]?.b === p.a); p.rimR = !(platforms[i + 1]?.a === p.b); });
  return Object.freeze({
    start: 75, platforms, stations, checkpoints, strings, harp, cart, rungs, dockX, keysAt, KEY,
    end: x, length: x,
  });
}
export const COURSE = build();

export const stationAt = x => {
  let found = COURSE.stations[0];
  for (const s of COURSE.stations) if (x >= s.from) found = s;
  return found;
};
export const stationIndex = id => COURSE.stations.findIndex(s => s.id === id);
// The part of a platform that takes a landing.
export const landingSpan = p => [p.a + (p.rimL ? INSET : 0), p.b - (p.rimR ? INSET : 0)];
export function platformAt(x, course = COURSE) {
  let low = 0, high = course.platforms.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1, p = course.platforms[mid];
    if (x < p.a) high = mid - 1; else if (x >= p.b) low = mid + 1; else { const [a, b] = landingSpan(p); return x >= a - 1e-9 && x <= b + 1e-9 ? p : null; }
  }
  return null;
}
// The rod leans to meet the hero: back towards the climb, then along with the
// landing. The final hop's overshoot is pulled in so the saddle is always under it.
const ease = k => { const v = Math.max(0, Math.min(1, k)); return v * v * (3 - 2 * v); };
export const PULL_IN = .62;
export function rodLean(x) {
  const near = x - COURSE.dockX;
  if (near >= 0) return Math.asin(Math.min(.9, near * PULL_IN / ROD_LENGTH));
  return -.12 * ease((near + 170) / 90) * (1 - ease((near + 24) / 24));
}
export const heightAt = x => { const p = platformAt(x); if (p?.h) return p.h; const r = COURSE.rungs; if (x >= COURSE.dockX - 40) return ROD_LENGTH; return x >= r[0].a ? r[0].h : 0; };
