// v0.5 mastery lab: two fixed gates inside an easy endless course.
// Developer only (public/.assetsignore). Imports the v4 engine read-only;
// physics constants, footing and the base course are exactly the game's.
import { PERIOD, SLOW_SPEED, FAST_SPEED, INSET, MIN_GAP, INTRO_END, FIRST_GAP, MOTIFS, Terrain, hashSeed, ensureNextHopMargin, footing } from '../../src/engine.mjs';

export const EXPERIMENTS = Object.freeze(['base', 'plain', 'rules']);
// Same press-just-before-touchdown allowance HOPSCROLL validated on its bridges.
export const GRACE = .12;
export const SLOW_STEP = PERIOD * SLOW_SPEED, FAST_STEP = PERIOD * FAST_SPEED;
const SPEED_DELTA = FAST_SPEED - SLOW_SPEED, EPS = 1e-8;
// The pad cradle pulls the pod to its centre, so every gate starts from the
// same x and yesterday's timing works today. Its footing is narrow on purpose.
export const PAD_HALF = 32;
const REST_HALF = 60, FILLER_HOPS = 8;

// Gate geometry is relative to the pad centre: [left, right, kind].
// still: lands only when not held FAST for GRACE or more (release to land).
// rush: lands only when FAST, or released less than GRACE ago (hold to land).
// `script` is one witness input (toggle times from pad touchdown, starting
// released), not an instruction shown to players.
export const GATES = Object.freeze([
  { id: 'quiet', name: { ja: '静の橋', en: 'QUIET SPAN' },
    platforms: [[128, 200, 'still'], [322, 428, 'normal'], [503, 575, 'still']],
    exit: [690, 900], script: [.08, .5, .8, 2.12, 2.37] },
  { id: 'rush', name: { ja: '疾の橋', en: 'RUSH SPAN' },
    platforms: [[169, 241, 'rush'], [312, 398, 'normal'], [479, 551, 'rush'], [602, 688, 'normal']],
    exit: [712, 960], script: [.1, 1.18, 1.81, 2.7] },
].map(g => Object.freeze(g)));
export const gateById = id => GATES.find(g => g.id === id);

function randomGenerator(seed) {
  let x = (seed >>> 0) || 0x9e3779b9;
  return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return x >>> 0; };
}
const kindOf = p => p[2] || 'normal';
function pushPlatform(platforms, [a, b, kind = 'normal']) {
  const last = platforms.at(-1);
  if (last && kind === 'normal' && ['normal', 'exit'].includes(kindOf(last)) && a - last[1] < MIN_GAP) last[1] = Math.max(last[1], b);
  else platforms.push([a, b, kind]);
}

// Endless course: intro, then easy filler and the two gates in a fixed
// alternating order. `plain` keeps every gate platform but ignores its kind.
export class LabCourse {
  constructor(seed = 1, exp = 'rules') {
    this.exp = exp; this.rules = exp === 'rules'; this.seed = seed >>> 0;
    this.gates = [];
    if (exp === 'base') { this.terrain = new Terrain(seed); this.platforms = this.terrain.platforms; return; }
    this.random = randomGenerator(hashSeed('mastery:' + seed));
    this.platforms = [[0, INTRO_END, 'normal']];
    this.referenceX = 75 + 7 * SLOW_STEP; this.referenceHop = 7; this.cycle = 0;
    this.motif = null; this.motifIndex = 4;
    this.appendHop(160, 70, INTRO_END + FIRST_GAP);
    this.extendTo(1900);
  }
  static practice(gateId, exp = 'rules') {
    const course = Object.create(LabCourse.prototype);
    Object.assign(course, { exp, rules: exp === 'rules', gates: [], platforms: [], practice: true });
    course.placeGate(gateById(gateId), 0, 0);
    return course;
  }
  appendHop(distance, halfWidth, minLeft = -Infinity) {
    this.referenceX += distance; this.referenceHop += 1;
    const left = Math.max(this.referenceX - halfWidth, minLeft);
    const [a, b] = ensureNextHopMargin(this.platforms.at(-1), [left, this.referenceX + halfWidth]);
    pushPlatform(this.platforms, [a, b, 'normal']);
  }
  fillerHop() {
    if (this.motifIndex >= 4) {
      // First cycle stays gentle; later filler mixes in tier 1 like v4's early run.
      const tier = this.cycle > 0 && this.random() % 100 < 35 ? 1 : 0;
      const pool = MOTIFS.filter(m => m.tier === tier);
      this.motif = pool[this.random() % pool.length]; this.motifIndex = 0;
    }
    const [d, w] = this.motif.steps[this.motifIndex++];
    this.appendHop(d + (this.random() % 9) - 4, w + (this.random() % 5) - 2);
  }
  // A rest island, then the pad placed so every point of the rest footing
  // reaches the pad footing with at least 20px to spare.
  appendGate() {
    const gate = GATES[this.cycle % GATES.length];
    // Fixed to the previous footing's right edge, never merged or widened:
    // every point of the previous platform keeps a 20px+ landing on it.
    const edge = footing(this.platforms.at(-1))[1];
    this.platforms.push([edge + 40, edge + 40 + 2 * REST_HALF, 'normal']);
    const [l, r] = footing(this.platforms.at(-1)), inner = PAD_HALF - INSET;
    const pad = ((l + FAST_STEP - 20 + inner) + (r + SLOW_STEP + 20 - inner)) / 2;
    this.placeGate(gate, pad, this.referenceHop + 1);
    this.referenceHop += 2 + gate.platforms.length + 1;
    this.referenceX = pad + (gate.exit[0] + gate.exit[1]) / 2 - 60;
    this.cycle += 1; this.motifIndex = 4;
  }
  placeGate(gate, pad, hop) {
    this.platforms.push([pad - PAD_HALF, pad + PAD_HALF, 'pad']);
    for (const [a, b, kind] of gate.platforms) this.platforms.push([pad + a, pad + b, kind]);
    this.platforms.push([pad + gate.exit[0], pad + gate.exit[1], 'exit']);
    this.gates.push({ id: gate.id, pad, hop, cycle: this.cycle, exitX: pad + gate.exit[0] });
  }
  extendTo(worldX) {
    if (this.exp === 'base') return this.terrain.extendTo(worldX);
    if (this.practice) return;
    while ((this.platforms.at(-1)?.[1] ?? 0) < worldX) {
      for (let i = 0; i < FILLER_HOPS; i++) this.fillerHop();
      this.appendGate();
    }
  }
  trim(worldX) {
    if (this.exp === 'base') { this.terrain.trim(worldX); this.platforms = this.terrain.platforms; return; }
    this.platforms = this.platforms.filter(p => p[1] >= worldX - 400);
    this.gates = this.gates.filter(g => g.exitX >= worldX - 1200);
  }
  platformAt(x) {
    return this.platforms.find(p => { const [a, b] = footing(p); return x >= a - EPS && x <= b + EPS; }) || null;
  }
  gateAt(x) { return this.gates.find(g => x >= g.pad - PAD_HALF && x < g.exitX) || null; }
}

export function newLabRun(startX = 75) {
  return { x: startX, hopStartX: startX, phase: 0, hops: 0, status: 'playing', fast: false, fastHeld: 0, slowHeld: GRACE, gate: null, failure: null };
}
// Practice starts docked on the gate's pad, already inside the gate.
export function newPracticeRun(course) {
  return { ...newLabRun(course.gates[0].pad), gate: course.gates[0] };
}
export function surfaceHolds(kind, state, rules) {
  if (!rules) return true;
  if (kind === 'still') return !(state.fast && state.fastHeld >= GRACE - 1e-9);
  if (kind === 'rush') return state.fast || state.slowHeld < GRACE - 1e-9;
  return true;
}
// Advance with one constant input; landing support is decided at the exact
// touchdown instant from how long the current input has been held.
export function advanceLab(state, course, seconds, fast) {
  if (state.status !== 'playing' || !(seconds > 0)) return [];
  const events = [];
  if (fast !== state.fast) { state.fast = fast; if (fast) state.fastHeld = 0; else state.slowHeld = 0; }
  let remaining = seconds;
  while (remaining > 1e-12 && state.status === 'playing') {
    const step = Math.min(remaining, PERIOD - state.phase);
    state.x += step * (fast ? FAST_SPEED : SLOW_SPEED); state.phase += step; remaining -= step;
    if (fast) state.fastHeld += step; else state.slowHeld += step;
    if (state.phase < PERIOD - 1e-10) continue;
    state.phase = 0;
    const platform = course.platformAt(state.x), kind = platform && kindOf(platform);
    if (!platform || !surfaceHolds(kind, state, course.rules)) {
      state.status = 'dead';
      state.failure = !platform ? missDirection(course, state) : kind === 'still' ? 'still-fast' : 'rush-slow';
      events.push({ type: 'fall', reason: state.failure, gate: state.gate, x: state.x });
      continue;
    }
    if (kind === 'pad') {
      const gate = course.gateAt(state.x);
      events.push({ type: 'dock', gate, from: state.x });
      state.x = gate.pad; state.gate = gate;
    }
    state.hops += 1; state.hopStartX = state.x;
    events.push({ type: 'land', kind, x: state.x });
    if (kind === 'exit' && state.gate) { events.push({ type: 'clear', gate: state.gate, x: state.x }); state.gate = null; }
    course.extendTo(state.x + 1600); course.trim(state.x);
  }
  return events;
}
function missDirection(course, state) {
  const low = state.hopStartX + SLOW_STEP, high = state.hopStartX + FAST_STEP;
  let nearest = Infinity, direction = 'short';
  for (const p of course.platforms) {
    const [a, b] = footing(p), left = Math.max(a, low), right = Math.min(b, high);
    if (left > right) continue;
    const safe = Math.max(left, Math.min(right, state.x));
    if (Math.abs(safe - state.x) < nearest) { nearest = Math.abs(safe - state.x); direction = safe < state.x ? 'far' : 'short'; }
  }
  return direction;
}

// Input edges carry their own event timestamps. Each frame is split at those
// instants, so the simulation does not depend on frame rate or frame phase.
export class TimedInput {
  constructor(clock = 0) { this.clock = clock; this.fast = false; this.queue = []; }
  push(time, fast) { this.queue.push({ time: Math.max(time, this.clock), fast }); this.queue.sort((p, q) => p.time - q.time); }
  reset(clock, fast = false) { this.clock = clock; this.fast = fast; this.queue = []; }
  advance(state, course, now) {
    const events = [];
    while (this.queue.length && this.queue[0].time <= now) {
      const edge = this.queue.shift();
      events.push(...advanceLab(state, course, edge.time - this.clock, this.fast));
      this.clock = Math.max(this.clock, edge.time); this.fast = edge.fast;
    }
    if (now > this.clock) { events.push(...advanceLab(state, course, now - this.clock, this.fast)); this.clock = now; }
    return events;
  }
}
// Distance of one hop for a given total FAST time (used by tests and docs).
export const hopDistance = held => SLOW_STEP + SPEED_DELTA * held;
