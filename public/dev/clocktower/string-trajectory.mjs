// RAPIPPO experimental trajectory mechanics. Independent of production course
// and STORY. No sound, DOM, rendering, storage or randomness in this module.
// Geometry is the production game's: 1 world px = 1 canvas px, a 96px hop, and
// the same footing and landing rules, so what is learned here transfers.
import { PERIOD, SLOW_SPEED, FAST_SPEED, footing, isSafe, landingMiss } from '../../src/engine.mjs';

export const LAB = Object.freeze({
  period: PERIOD,
  startX: 75,
  floorY: 382,      // app.mjs FLOOR
  feetLift: 2,      // app.mjs: heroY = FLOOR - 2 - height
  hopHeight: 96,    // app.mjs hop height
  // Antenna tips of drawPod at scale 2, measured from the feet. The spring
  // stretches during a hop, so the tips rise slightly more than the feet.
  podTopRest: 62,
  podTopStretch: 4,
  antennaReach: 16, // half-width of the antenna pair
  stringBottomY: 228,
  flagTolerance: 12
});

const HALF = PERIOD / 2;
const EPS = 1e-10;

export function feetY(phase) {
  return LAB.floorY - LAB.feetLift - LAB.hopHeight * Math.sin(Math.PI * clampPhase(phase) / PERIOD);
}
export function podTopY(phase) {
  const lift = Math.sin(Math.PI * clampPhase(phase) / PERIOD);
  return feetY(phase) - LAB.podTopRest - LAB.podTopStretch * lift;
}
function clampPhase(phase) { return Math.max(0, Math.min(PERIOD, phase)); }

// The part of each hop in which the antennas are high enough to reach a string.
export const CONTACT_WINDOW = (() => {
  const need = (LAB.floorY - LAB.feetLift - LAB.podTopRest - LAB.stringBottomY) /
    (LAB.hopHeight + LAB.podTopStretch);
  const from = PERIOD * Math.asin(need) / Math.PI;
  return Object.freeze([from, PERIOD - from]);
})();

// A plan lists one [fastOn, fastOff) interval per hop, in seconds into the hop.
export const EARLY = Object.freeze([0, HALF]);
export const LATE = Object.freeze([HALF, PERIOD]);

const E5 = 659.25, G5 = 783.99, A5 = 880;
const START = Object.freeze([0, 132]);
const PAD = Object.freeze([183, 272]);
const UNDER_PAD = Object.freeze([165, 315]); // stage 2: its footing starts at the string, x=173
const FLAG_X = LAB.startX + HALF * (SLOW_SPEED + FAST_SPEED); // 221.25: both 0.39s plans land here
const FAR = 173;  // 98px from the start: rushing reaches it while high
const NEAR = 125; // 50px from the start: rushing passes it before the antennas are high enough

export const STAGES = Object.freeze([
  { id: 'far-ring', beats: 1, platforms: [START, PAD], strings: [{ x: FAR, want: 'ring', note: E5 }], demos: [[EARLY]] },
  // fullPassX: the optional goal. The antennas (+-16px) have left the string's x.
  { id: 'far-silent', beats: 1, platforms: [START, UNDER_PAD], fullPassX: FAR + LAB.antennaReach, strings: [{ x: FAR, want: 'silent', note: E5 }], demos: [[LATE]] },
  { id: 'near-ring', beats: 1, platforms: [START, PAD], strings: [{ x: NEAR, want: 'ring', note: E5 }], demos: [[EARLY], [LATE]] },
  { id: 'flag', beats: 1, platforms: [START, PAD], flag: FLAG_X, strings: [{ x: FAR, want: 'either', note: E5 }], demos: [[EARLY], [LATE]] },
  {
    // Ring, rest, ring (near), ring: the hop rhythm never stops between them.
    id: 'phrase', beats: 4,
    platforms: [START, PAD, [325, 415], [470, 560], [620, 760]],
    strings: [
      { x: FAR, want: 'ring', note: E5 },
      { x: 319, want: 'silent', note: null },
      { x: 417, want: 'ring', note: G5 },
      { x: 611, want: 'ring', note: A5 }
    ],
    demos: [[EARLY, LATE, LATE, EARLY]]
  }
].map(stage => Object.freeze(stage)));

export function stageById(id) { return STAGES.find(stage => stage.id === id); }

export function newAttempt(stage) {
  return {
    stage, x: LAB.startX, hopStartX: LAB.startX, phase: 0, hops: 0, time: 0,
    fastSeconds: 0, segments: [], status: 'playing', miss: null,
    strings: stage.strings.map(() => ({ touched: false, passed: false, time: null }))
  };
}

// A string rings when the antennas occupy its x while they are above its lower
// tip. Solved exactly inside a constant-speed slice, so the result does not
// depend on where rendered frames happen to fall.
function touchStrings(run, slice, speed, events) {
  const [windowFrom, windowTo] = CONTACT_WINDOW;
  run.stage.strings.forEach((string, index) => {
    const state = run.strings[index];
    if (state.touched || state.passed) return;
    const enter = Math.max(0, (string.x - LAB.antennaReach - run.x) / speed);
    const leave = (string.x + LAB.antennaReach - run.x) / speed;
    if (enter > slice) return;
    const contact = Math.max(run.phase + enter, windowFrom);
    if (contact <= Math.min(run.phase + Math.min(slice, leave), windowTo)) {
      state.touched = true;
      state.time = run.time + contact - run.phase;
      events.push({ type: 'note', string: index, t: state.time, y: podTopY(contact) });
    } else if (leave <= slice) {
      state.passed = true;
      events.push({ type: 'passed', string: index, t: run.time + leave });
    }
  });
}

function recordFast(run, slice) {
  const last = run.segments.at(-1);
  if (last && last.hop === run.hops && Math.abs(last.to - run.phase) < 1e-9) last.to = run.phase + slice;
  else run.segments.push({ hop: run.hops, from: run.phase, to: run.phase + slice });
  run.fastSeconds += slice;
}

export function advanceAttempt(run, dt, fast) {
  const events = [];
  if (run.status !== 'playing' || !Number.isFinite(dt) || dt <= 0) return events;
  const speed = fast ? FAST_SPEED : SLOW_SPEED;
  let remaining = dt;
  while (remaining > EPS && run.status === 'playing') {
    const slice = Math.min(remaining, PERIOD - run.phase);
    touchStrings(run, slice, speed, events);
    if (fast) recordFast(run, slice);
    run.x += speed * slice;
    run.phase += slice;
    run.time += slice;
    remaining -= slice;
    if (run.phase >= PERIOD - EPS) land(run, events);
  }
  return events;
}

function land(run, events) {
  const terrain = { platforms: run.stage.platforms };
  run.phase = 0;
  if (!isSafe(terrain, run.x)) {
    run.status = 'fall';
    run.miss = landingMiss(terrain, run.x, run.hopStartX);
    events.push({ type: 'fall', x: run.x, miss: run.miss });
    return;
  }
  run.hops += 1;
  run.hopStartX = run.x;
  events.push({ type: 'land', x: run.x, hops: run.hops });
  if (run.x >= footing(run.stage.platforms.at(-1))[0]) {
    run.status = 'landed';
    events.push({ type: 'finish', x: run.x });
  }
}

export function planIsFast(run, plan) {
  const [on, off] = plan[run.hops] ?? [0, 0];
  return run.phase >= on - EPS && run.phase < off - EPS;
}

export function advanceWithPlan(run, dt, plan) {
  const events = [];
  let remaining = dt;
  while (remaining > EPS && run.status === 'playing') {
    const [on, off] = plan[run.hops] ?? [0, 0];
    const edges = [on, off, PERIOD].filter(edge => edge > run.phase + EPS);
    const slice = Math.min(remaining, Math.min(...edges) - run.phase);
    events.push(...advanceAttempt(run, slice, planIsFast(run, plan)));
    remaining -= slice;
  }
  return events;
}

export function simulate(stage, plan, maxSlice = PERIOD) {
  const run = newAttempt(stage);
  const events = [];
  const slice = Math.min(maxSlice, PERIOD);
  for (let left = 16 * PERIOD; left > 0 && run.status === 'playing'; left -= slice) {
    events.push(...advanceWithPlan(run, slice, plan));
  }
  return { ...run, events };
}

// flag: the stage only asks for the landing spot here; which of the two sounds
// has been collected is tracked by the caller, across attempts.
export function judge(run) {
  const { stage } = run;
  if (run.status === 'fall') return { ok: false, reason: run.miss === 'far' ? 'far' : 'short', wrong: [] };
  const wrong = stage.strings.flatMap((string, index) => {
    const touched = run.strings[index].touched;
    return (string.want === 'ring' && !touched) || (string.want === 'silent' && touched) ? [index] : [];
  });
  if (stage.flag !== undefined && Math.abs(run.x - stage.flag) > LAB.flagTolerance) {
    return { ok: false, reason: 'off-flag', wrong };
  }
  const ok = wrong.length === 0;
  const verdict = { ok, reason: ok ? 'ok' : 'wrong-string', wrong };
  // tier only grades a clear; a 'quiet' clear already advances, 'through' is optional.
  if (ok && stage.fullPassX !== undefined) verdict.tier = run.x >= stage.fullPassX ? 'through' : 'quiet';
  return verdict;
}

// Where a stage has a tier threshold the number must not round across it:
// x=188.6 is a quiet clear and may not read as 189.
export function landingPx(stage, x) {
  return stage.fullPassX !== undefined ? Math.floor(x) : Math.round(x);
}
