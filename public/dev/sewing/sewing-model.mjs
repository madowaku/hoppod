// 銀河縫いのミシン工房 LAB: the pure model. No DOM, no audio.
// The needle (Rapippo) drops once per beat, always on the beat. The player
// only chooses how fast the cloth feeds (hold = FAST, release = SLOW), so the
// distance fed between two drops is the stitch length.
// v0.2: 返し縫い. At set places red pulls the cloth back the other way
// (automatically, no new button): the needle keeps the same beat and the
// seam grows backwards over what is already sewn.
// Spec: docs/SEWING_LAB.md.
import { PERIOD } from '../../src/engine.mjs';

export { PERIOD };
// Stitch length for a whole beat at each speed, in cloth pixels.
export const SLOW_STITCH = 10;
export const FAST_STITCH = 26;
export const SLOW_FEED = SLOW_STITCH / PERIOD;
export const FAST_FEED = FAST_STITCH / PERIOD;
// A stitch this short or shorter is fine; longer is coarse.
export const MEND_MAX = 14;
// The big rip needs this much at every point: a fine pass counts 1, a coarse one .5.
export const RIP_NEED = 2;
// A drop this close to a pin hits it.
export const PIN_HALF = 4;
// The song: 88 beats (about 69s). If the cloth is not done by then the
// machine stops and the rest stays unsewn.
export const BEAT_LIMIT = 88;
// Red starts to wonder after this many SLOW stitches in a row on plain cloth.
export const RED_PATIENCE = 2;
// Back-tacks at the start and end of the seam, as real sewing does.
export const TACK = 30;
// v0.4 chalk marks: a drop this close to a mark hits it.
export const MARK_HALF = 4;
// Red changes the thread this far before a coloured stretch, and back after it.
export const SWAP_AHEAD = 36;

// The cloth, in order. `who` is the friend whose constellation a tear hides.
// 'rip' is the big tear: sewn forward, then red pulls it back over itself, then forward again.
// `marks`: chalk marks (offsets in the section) where the needle should land.
// Spacing 26 = a FAST beat, 10 = a SLOW beat; anything between needs a switch mid-beat.
export const SECTIONS = Object.freeze([
  { kind: 'plain', len: 160, marks: [50, 76, 102, 128, 154] },
  { kind: 'tear', len: 70, who: 'blue', marks: [5, 15, 25, 35, 45, 55, 65] },
  { kind: 'plain', len: 130, marks: [21, 47, 73, 83, 93, 119] },
  { kind: 'pins', len: 160, pins: [40, 95, 135], marks: [15, 28, 54, 80, 106, 122, 148] },
  { kind: 'plain', len: 80, marks: [14, 40, 66] },
  { kind: 'rip', len: 100, who: 'green' },
  { kind: 'plain', len: 160, marks: [20, 46, 64, 82, 108, 134, 152] },
  { kind: 'tear', len: 80, who: 'red', marks: [4, 14, 24, 34, 44, 54, 64, 74] },
  { kind: 'plain', len: 100, marks: [10, 36, 62, 88] },
]);

export function layout(sections = SECTIONS) {
  let at = 0;
  const zones = [], pins = [], marks = [], swaps = [];
  for (const s of sections) {
    zones.push({ ...s, a: at, b: at + s.len });
    for (const p of s.pins ?? []) pins.push(at + p);
    for (const m of s.marks ?? []) marks.push(at + m);
    // Red puts on the friend's thread before its stretch, and the plain one after.
    if (s.who) swaps.push({ at: at - SWAP_AHEAD, thread: s.who }, { at: at + s.len + 6, thread: 'plain' });
    at += s.len;
  }
  // Where red reverses (when moving forward past `at`) and how far back it pulls (`to`).
  const reverses = [{ at: TACK, to: 0, why: 'tack' }];
  for (const z of zones) if (z.kind === 'rip') reverses.push({ at: z.b, to: z.a, why: 'rip' });
  reverses.push({ at: at, to: at - TACK, why: 'end' });
  return { zones, pins, marks, swaps, length: at, reverses };
}
export const CLOTH = layout();

export function zoneAt(x, cloth = CLOTH) {
  return cloth.zones.find(z => x >= z.a && x < z.b) ?? null;
}

export function newRun() {
  return {
    t: 0, beat: 0, x: 0, lastDrop: 0, fast: false, started: false, done: false, unfinished: false,
    dir: 1, pass: 0, reverseIndex: 0,
    stitches: [], pinsLeft: CLOTH.pins.slice(), pinHits: 0,
    thread: 'plain', swapIndex: 0, marksHit: [], marksMissed: 0, markStreak: 0,
    slowPlain: 0, redWait: 0, greenStrain: 0, greenSlip: 0,
    events: [],
  };
}

export const feedOf = fast => fast ? FAST_FEED : SLOW_FEED;
// Where the needle will drop if the input stays as it is.
export function predictDrop(run) {
  const left = PERIOD - (run.t - run.beat * PERIOD);
  return run.x + run.dir * feedOf(run.fast) * left;
}
export const reversing = run => run.dir < 0;
// The next chalk mark ahead that is still there to hit.
export const nextMark = run => CLOTH.marks.find((m, i) => m > run.lastDrop + MARK_HALF && !run.marksHit.includes(i)) ?? null;
// The next thing red will do, and how far ahead it is (cloth px).
export function redNext(run) {
  const rev = CLOTH.reverses[run.reverseIndex], sw = CLOTH.swaps[run.swapIndex];
  if (run.dir < 0) return rev ? { type: 'forward', d: run.x - rev.to } : null;
  const a = rev ? { type: 'reverse', d: rev.at - run.x, why: rev.why } : null, b = sw ? { type: 'thread', d: sw.at - run.x, thread: sw.thread } : null;
  return !a ? b : !b ? a : a.d <= b.d ? a : b;
}
export const nextReverse = run => CLOTH.reverses[run.reverseIndex] ?? null;

// Advance by `dt` seconds with the current input. Returns the stitches made.
export function step(run, dt, fast) {
  run.fast = !!fast;
  if (!run.started || run.done) return [];
  const made = [];
  let left = dt;
  while (left > 1e-9 && !run.done) {
    const toDrop = (run.beat + 1) * PERIOD - run.t;
    const h = Math.min(left, toDrop);
    run.t += h; run.x += run.dir * feedOf(run.fast) * h; left -= h;
    if (run.x < 0) run.x = 0;
    if (h >= toDrop - 1e-9) { run.t = (run.beat + 1) * PERIOD; made.push(drop(run)); }
  }
  return made;
}

function drop(run) {
  run.beat += 1;
  run.lastDropBefore = run.lastDrop;
  const x = Math.min(run.x, CLOTH.length), len = Math.abs(x - run.lastDrop);
  const lo = Math.min(x, run.lastDrop), hi = Math.max(x, run.lastDrop), zone = zoneAt(Math.max(0, (lo + hi) / 2));
  const stitch = { beat: run.beat, x, from: run.lastDrop, len, fast: run.fast, back: run.dir < 0, pass: run.pass, kind: zone?.kind ?? 'plain', who: zone?.who ?? null, thread: run.thread, fine: len <= MEND_MAX, mend: false, pin: false, mark: -1 };
  const pinIndex = run.dir > 0 ? run.pinsLeft.findIndex(p => Math.abs(p - x) < PIN_HALF) : -1;
  if (pinIndex >= 0) {
    // The needle glances off the pin: no stitch here, the pin falls out.
    stitch.pin = true; run.pinHits += 1; run.pinsLeft.splice(pinIndex, 1);
    run.events.push({ type: 'pin', beat: run.beat, x });
  } else {
    run.lastDrop = x;
    if (zone?.kind === 'tear') stitch.mend = stitch.fine;
    if (zone?.kind === 'rip') stitch.mend = stitch.fine;
    // Chalk: going forward, a drop on a mark hits it; marks the needle has passed are missed.
    if (run.dir > 0) {
      const k = CLOTH.marks.findIndex((m, i) => Math.abs(m - x) < MARK_HALF && !run.marksHit.includes(i));
      if (k >= 0) { stitch.mark = k; run.marksHit.push(k); run.markStreak += 1; run.events.push({ type: 'mark', beat: run.beat, x, k }); }
      else if (CLOTH.marks.some(m => m > run.lastDropBefore + MARK_HALF && m < x - MARK_HALF)) run.markStreak = 0;
    }
  }
  // Friends read the cloth.
  if (zone?.kind === 'tear') {
    run.slowPlain = 0; run.redWait = 0;
    if (!stitch.mend && !stitch.pin) { run.greenStrain = Math.min(3, run.greenStrain + 1); run.greenSlip += 1; run.events.push({ type: 'slip', beat: run.beat, x }); }
    else run.greenStrain = Math.max(0, run.greenStrain - 1);
  } else if (zone?.kind === 'rip' || run.dir < 0) {
    run.slowPlain = 0;
    run.greenStrain = ripStrength(run, x) >= RIP_NEED ? 0 : 2;
  } else {
    run.greenStrain = Math.max(0, run.greenStrain - 1);
    if (!run.fast && zone?.kind === 'plain' && stitch.mark < 0) { run.slowPlain += 1; if (run.slowPlain > RED_PATIENCE) { run.redWait += 1; run.events.push({ type: 'wait', beat: run.beat, x }); } }
    else run.slowPlain = 0;
  }
  run.stitches.push(stitch);
  // Red changes the thread (only while going forward; a reverse keeps the thread it has).
  const sw = CLOTH.swaps[run.swapIndex];
  if (sw && run.dir > 0 && x >= sw.at) { run.thread = sw.thread; run.swapIndex += 1; run.events.push({ type: 'thread', beat: run.beat, x, thread: sw.thread }); }
  // Red turns the feed round only while the needle is in the cloth.
  const rev = nextReverse(run);
  if (rev && run.dir > 0 && x >= rev.at - 1e-6) {
    run.dir = -1; run.pass += 1; run.events.push({ type: 'reverse', beat: run.beat, x, why: rev.why });
  } else if (rev && run.dir < 0 && x <= rev.to + 1e-6) {
    run.dir = 1; run.pass += 1; run.reverseIndex += 1; run.events.push({ type: 'forward', beat: run.beat, x, why: rev.why });
  }
  // The rip holds once almost all of it is strong enough (told once).
  if (!run.ripDone && zone?.kind === 'rip' && ripShare(run) >= .9) { run.ripDone = true; run.events.push({ type: 'ripdone', beat: run.beat, x }); }
  // The seam ends with the end back-tack, as real sewing does.
  if (run.reverseIndex >= CLOTH.reverses.length) { run.done = true; run.events.push({ type: 'done', beat: run.beat, x }); }
  else if (run.beat >= BEAT_LIMIT) { run.done = true; run.unfinished = true; run.events.push({ type: 'timeup', beat: run.beat, x }); }
  return stitch;
}

// How strong the seam is at cloth point c: fine passes count 1, coarse .5.
export function ripStrength(run, c) {
  let s = 0;
  for (const t of run.stitches) {
    if (t.pin) continue;
    const lo = Math.min(t.from, t.x), hi = Math.max(t.from, t.x);
    if (c >= lo - .5 && c <= hi + .5) s += t.fine ? 1 : .5;
  }
  return s;
}
export function ripShare(run) {
  const z = CLOTH.zones.find(q => q.kind === 'rip');
  if (!z) return 0;
  let ok = 0, n = 0;
  for (let c = z.a + 1; c < z.b; c += 2) { n += 1; if (ripStrength(run, c) >= RIP_NEED) ok += 1; }
  return ok / n;
}

// Is cloth point c mended (a tear covered by a fine stitch; the rip strong enough)?
export function mendedAt(run, c) {
  const z = zoneAt(c);
  if (z?.kind === 'rip') return ripStrength(run, c) >= RIP_NEED;
  return run.stitches.some(s => s.mend && c >= Math.min(s.from, s.x) - .5 && c <= Math.max(s.from, s.x) + .5);
}

// How much of each tear is mended, 0..1.
export function mendShare(run, who) {
  const z = CLOTH.zones.find(q => q.who === who);
  if (!z) return 0;
  if (z.kind === 'rip') return ripShare(run);
  let covered = 0;
  for (const s of run.stitches) {
    if (!s.mend) continue;
    covered += Math.max(0, Math.min(Math.max(s.from, s.x), z.b) - Math.max(Math.min(s.from, s.x), z.a));
  }
  return Math.min(1, covered / z.len);
}

export function summary(run) {
  return {
    beats: run.beat, stitches: run.stitches.filter(s => !s.pin).length, back: run.stitches.filter(s => s.back && !s.pin).length,
    sewn: Math.round(Math.min(run.x, CLOTH.length)), length: CLOTH.length,
    mend: { blue: mendShare(run, 'blue'), green: mendShare(run, 'green'), red: mendShare(run, 'red') },
    pinHits: run.pinHits, greenSlip: run.greenSlip, redWait: run.redWait, unfinished: run.unfinished,
    marks: run.marksHit.length, markTotal: CLOTH.marks.length,
  };
}
