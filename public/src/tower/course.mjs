// THE SUNWISE CLOCK TOWER: one fixed course of clockwork rooms, each with one
// mechanism. Built on the game's own hop: 81.9px at SLOW, 210.6px at FAST, and a
// landing on every beat. Some ground is only there on certain beats; that is what
// a clock is.
import { PERIOD as BEAT, SLOW_SPEED, FAST_SPEED, INSET } from '../engine.mjs';

export const HOP_MIN = SLOW_SPEED * BEAT, HOP_MAX = FAST_SPEED * BEAT;
// A mainspring plate makes the next hop this much longer, at either speed.
export const BOOST = 1.8;
// Pendulums: one full swing takes two hops. The pivot beam hangs at PIVOT_Y.
export const PIVOT_Y = 24, SWING_BEATS = 2, BOB_DRAWN = 14, BOB_HIT = 9, POD_HALF = 9, POD_TOP_INSET = 8;
// A long pendulum sweeps the floor; a short one only grazes the very top of a hop
// (owner playtest: the short ones were too hard to time while never stopping).
export const LONG = 330, SHORT = 202;
// A clock hand turns once every four beats about its pivot and lies flat, as a
// bridge, only on its own beat.
export const HAND_BEATS = 4;
// Before each hand, a cog turning backwards: a hop that starts on it is carried back
// at SLOW's speed, so SLOW hops on the spot and FAST goes on. Somewhere to wait while
// counting the lamps (owner's idea, 2026-11-07). Narrower than FAST's hop off it
// ((270 - 105) * 0.78 = 128.7px), so FAST on four reaches the hand from anywhere on it.
export const COG = 120;
// Gears hang where the antennas reach at the top of a hop.
export const GEAR_Y = 228, GEAR_REACH = 16, GEAR_WINDOW = Object.freeze([.279, .501]);
export const STATIONS = Object.freeze(['foot', 'pendulum', 'teeth', 'spring', 'sand', 'hands', 'machine', 'bell']);

function build() {
  const platforms = [], stations = [], checkpoints = [], pendulums = [], gears = [];
  let x = 0, index = 0;
  const add = (w, kind = 'plain', extra = {}) => { const p = { a: x, b: x + w, kind, i: index++, ...extra }; platforms.push(p); x += w; return p; };
  const gap = w => { x += w; };
  const station = id => stations.push({ id, from: x, to: 0 });
  const checkpoint = (at = x + 40) => checkpoints.push({ x: at, from: at - 30, station: stations.length - 1 });
  const close = () => { stations.at(-1).to = x; };
  // A lantern mid-room stands on ground that takes two SLOW hops, so nobody has to
  // press the instant they reappear; a FAST still held lands on it too.
  const REST = 250, REST_AT = 20;
  const rest = () => { add(REST); checkpoint(x - REST + REST_AT); };
  const swing = (at, length, amp, phase) => pendulums.push({ x: at, length, amp, phase });
  const gear = at => gears.push({ x: at });

  // 0. The foot of the tower: the clock above has stopped at five to midnight.
  station('foot'); checkpoints.push({ x: 75, from: 0, station: 0 });
  add(1100); gear(820); close();

  // 1. Pendulums. A long one sweeps the floor on the beat: be in the air when it
  // passes. A short one sweeps the top of the hop: be low when it passes.
  station('pendulum'); checkpoint();
  add(270);
  add(1500); // one long floor first: only the swing to read
  swing(x - 1260, LONG, .2, .25); swing(x - 960, LONG, .2, .75); swing(x - 640, SHORT, .2, 0); swing(x - 330, SHORT, .2, .5);
  gear(x - 800);
  rest();
  for (const [w, g] of [[230, 60], [200, 70], [240, 60]]) { add(w); swing(x - w / 2, w > 220 ? LONG : SHORT, .2, w > 220 ? .25 : 0); gap(g); }
  add(260); swing(x - 130, LONG, .2, .75); gear(x - 40);
  add(140); close();

  // 2. Escapement teeth: gold stands on the tick, silver on the tock.
  station('teeth'); checkpoint();
  add(270);
  const teeth = (widths, gaps = []) => widths.forEach((w, k) => { add(w, k % 2 ? 'tock' : 'tick'); if (gaps[k]) gap(gaps[k]); });
  teeth([110, 110, 110, 110, 110, 110, 110, 110]); gear(x - 420);
  rest();
  teeth([120, 90, 150, 90, 120, 160, 90, 130], [20, 0, 30, 0, 20, 0, 30, 0]); gear(x - 500);
  rest();
  teeth([90, 180, 90, 90, 180, 90, 120, 120], [30, 0, 30, 30, 0, 30, 0, 0]); gear(x - 300);
  add(200); close();

  // 3. The mainspring: land on a coil and the next hop carries 1.8 times as far.
  station('spring'); checkpoint();
  add(270);
  for (const [lead, w, g] of [[60, 70, 190], [60, 90, 120], [40, 70, 250], [60, 80, 170]]) { add(lead + 80); add(w, 'spring'); gap(g); }
  gear(x - 120);
  rest();
  for (const [lead, w, g] of [[40, 70, 280], [0, 70, 220], [40, 80, 300]]) { add(lead + 100); add(w, 'spring'); gap(g); }
  add(220); close();

  // 4. The hourglass: sand holds one landing, then pours away.
  station('sand'); checkpoint();
  add(270);
  for (const [w, g] of [[150, 30], [190, 30], [130, 40], [210, 30], [150, 30]]) { add(w, 'sand'); gap(g); }
  gear(x - 220);
  rest();
  for (const [w, g] of [[220, 20], [120, 50], [230, 20], [100, 60], [200, 40]]) { add(w, 'sand'); gap(g); }
  add(220); close();

  // 5. The hands: each lies flat as a bridge on its own beat of four.
  station('hands'); checkpoint();
  add(270);
  for (const [w, len, off, g] of [[330, 180, 0, 0], [300, 190, 2, 0], [260, 200, 1, 0]]) {
    add(w - COG); add(COG, 'cog'); add(len, 'hand', { off, len }); gap(g);
  }
  gear(x - 100);
  rest();
  for (const [w, len, off] of [[280, 200, 3], [240, 210, 0], [300, 190, 2]]) { add(w - COG); add(COG, 'cog'); add(len, 'hand', { off, len }); }
  add(240); close();

  // 6. The machine room: everything at once, as a clock really is.
  station('machine'); checkpoint();
  add(270);
  teeth([120, 110, 130, 110]); swing(x - 240, LONG, .2, .25);
  add(140); add(80, 'spring'); gap(240); gear(x - 120);
  for (const [w, g] of [[170, 30], [150, 40]]) { add(w, 'sand'); gap(g); }
  gear(x - 150);
  rest();
  add(240); swing(x - 120, SHORT, .2, 0); add(COG, 'cog'); add(190, 'hand', { off: 1, len: 190 });
  teeth([110, 130, 110]); add(120); add(80, 'spring'); gap(260);
  add(200, 'sand'); gap(40); add(160); swing(x - 80, LONG, .2, .75);
  gear(x - 60);
  add(120); close();

  // 7. The bell: up the last stairs, and the last landing strikes it.
  station('bell'); checkpoint();
  add(300);
  const stairs = [];
  for (let k = 0; k < 4; k++) stairs.push(add(140, 'stair', { h: 22 * (k + 1), flush: true }));
  const dockX = x + 30;
  add(260, 'top', { h: 110, flush: true }); close();

  platforms.forEach((p, i) => { p.rimL = !(platforms[i - 1]?.b === p.a); p.rimR = !(platforms[i + 1]?.a === p.b); });
  return Object.freeze({ start: 75, platforms, stations, checkpoints, pendulums, gears, stairs, dockX, bellX: dockX + 90, end: x, length: x });
}
export const COURSE = build();

export const stationAt = (x, course = COURSE) => {
  let found = course.stations[0];
  for (const s of course.stations) if (x >= s.from) found = s;
  return found;
};
export const landingSpan = p => [p.a + (p.rimL ? INSET : 0), p.b - (p.rimR ? INSET : 0)];
export function platformAt(x, course = COURSE) {
  let low = 0, high = course.platforms.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1, p = course.platforms[mid];
    if (x < p.a) high = mid - 1; else if (x >= p.b) low = mid + 1; else { const [a, b] = landingSpan(p); return x >= a - 1e-9 && x <= b + 1e-9 ? p : null; }
  }
  return null;
}
export const heightAt = (x, course = COURSE) => platformAt(x, course)?.h || (x >= course.dockX - 30 ? 110 : 0);

// Pendulum bob in screen space at story time t.
export function swingAngle(p, t) { return p.amp * Math.sin(2 * Math.PI * (t / (SWING_BEATS * BEAT) + p.phase)); }
export function bobAt(p, t) { const a = swingAngle(p, t); return { x: p.x + p.length * Math.sin(a), y: PIVOT_Y + p.length * Math.cos(a) }; }
// The angle of a clock hand: flat to the right (0) on its beat, then up, left, down.
export function handAngle(p, t) { return -2 * Math.PI * (((t / BEAT - p.off) % HAND_BEATS + HAND_BEATS) % HAND_BEATS) / HAND_BEATS; }
export const handFlat = (p, beat) => ((beat - p.off) % HAND_BEATS + HAND_BEATS) % HAND_BEATS === 0;
export const toothUp = (p, beat) => (beat % 2 === 0) === (p.kind === 'tick');
