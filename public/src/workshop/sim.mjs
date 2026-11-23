// The workshop simulation. Pure and deterministic: given story time and the
// input timeline it always produces the same run, and a hop always lands on a
// beat. Every event carries its story time, so its sound can be scheduled ahead.
import { SLOW_SPEED, FAST_SPEED, PERIOD as BEAT } from '../engine.mjs';
import { COURSE, platformAt, stationAt, STRING_SPACING, HARP_WINDOW, STRING_WINDOW, STRING_REACH, CART_SPEED, CART_FOOT, CART_HALF, BARE_TICK, RUNG_TICKS, U, edgeSide } from './course.mjs';
import { liveNote, keyPitch, STRING_NOTES, WOOD_MOTIF, makeTake, harpRun, chordAtBar, nearest, brassPitch } from './arrange.mjs';

export const FALL_BEATS = 2, GRACE = .12, ASSIST_FAILS = 3, GUARD_FAILS = 2, LIGHT_BEATS = 4;
const PART_OF = { drums: 'drums', tongue: 'tongue', keys: 'keys', harp: 'harp', strings: 'strings', wood: 'wood', bellows: 'bellows', brass: 'brass' };
const SAMPLE = BEAT / 2;

export function newRun(course = COURSE) {
  return {
    t: 0, beat: 0, hops: 0, x: course.start, hopStartX: course.start, status: 'playing', station: 0, stationId: 'hall', checkpoint: 0, cpT: 0,
    fast: false, edgeT: -9, fallAt: null, fallX: 0, dockAt: null, fails: {}, seq: 0, fastInHop: 0, lastLand: null,
    recording: {}, takes: {}, resonance: [], lightAt: null, crashAt: -99,
    cart: { state: 'wait', x: course.cart.x0, from: 0, hits: 0, lastHit: -1 },
    rod: { tick: BARE_TICK, next: null, rung: -1 },
    reedOpen: false, reedSeq: 0, harpOrder: 0, harpBeat: -1, stringsRung: [],
  };
}
// A run as it stands on reaching checkpoint i. Everything before it is woken.
export function runFrom(course, i, recording = {}) {
  const run = newRun(course), cp = course.checkpoints[i], st = course.stations[cp.station];
  run.x = run.hopStartX = cp.x; run.checkpoint = i; run.station = cp.station; run.stationId = st.id;
  run.recording = structuredClone(recording);
  return run;
}
const supports = (run, course, x) => {
  if (inCartRange(run, course, x)) return { kind: 'cart' };
  const p = platformAt(x, course);
  if (!p) return null;
  const assisted = (run.fails[run.checkpoint] || 0) >= ASSIST_FAILS;
  if (p.kind === 'res' && !assisted && !run.resonance.includes(p.name)) return null;
  if ((p.kind === 'push' || p.kind === 'pull') && !assisted) {
    const recent = run.t - run.edgeT < GRACE;
    if (p.kind === 'push' ? !(run.fast || recent) : !(!run.fast || recent)) return null;
  }
  return p;
};
function inCartRange(run, course, x) {
  const c = run.cart;
  // Stopped, it meets the bank without a rim.
  return Math.abs(x - c.x) <= (c.state === 'ride' ? CART_FOOT : CART_HALF) + 1e-6;
}
const barOf = beat => Math.floor(beat / 4);

function record(run, part, event) { (run.takes[part] ??= { hops: [], events: [] }).events.push(event); }
function recordHop(run, part, beat) { (run.takes[part] ??= { hops: [], events: [] }).hops.push(beat); }

// A station's instrument wakes when you leave it, with its last take.
function wake(run, id, events) {
  const part = PART_OF[id];
  if (!part) return;
  const take = run.takes[part] ?? { hops: [], events: [] };
  if (part === 'harp') {
    // Only the number of strings crossed in each hop is kept.
    const counts = new Map();
    for (const e of take.events) counts.set(e.hop, (counts.get(e.hop) || 0) + 1);
    take.events = [...counts].map(([hop, n]) => ({ t: hop * BEAT, n }));
  }
  run.recording[part] = makeTake(part, take.hops, take.events);
  delete run.takes[part];
  events.push({ type: 'wake', part });
}
function note(run, events, part, midi, extra = {}) {
  events.push({ type: 'note', part, midi, id: ++run.seq, ...extra });
}

// Advance to story time `to` with one constant input.
export function advance(run, course, to, fast, events = []) {
  if (fast !== run.fast) edge(run, course, fast, events);
  while (run.t < to - 1e-12) {
    const nextBeat = (run.beat + 1) * BEAT;
    const riding = run.cart.state === 'ride' && run.status === 'playing';
    const nextSample = riding ? (Math.floor(run.t / SAMPLE + 1e-9) + 1) * SAMPLE : Infinity;
    const end = Math.min(to, nextBeat, nextSample), dt = end - run.t;
    const n = events.length;
    const moving = run.status === 'playing';
    const speed = moving ? (run.fast ? FAST_SPEED : SLOW_SPEED) : 0;
    if (moving) contacts(run, course, speed, dt, events);
    run.x += dt * speed; run.t = end;
    if (moving && run.fast) run.fastInHop += dt;
    moveCart(run, course, dt);
    if (riding && end >= nextSample - 1e-9) record(run, 'brass', { t: run.t, pos: run.x - run.cart.x });
    chatter(run, course, events);
    if (end >= nextBeat - 1e-9) { run.t = nextBeat; run.beat += 1; touchdown(run, course, events); }
    for (let i = n; i < events.length; i++) { events[i].t ??= run.t; events[i].beat ??= run.beat; }
  }
  return events;
}
function edge(run, course, fast, events) {
  run.fast = fast; run.edgeT = run.t;
  if (run.status !== 'playing') return;
  if (run.stationId !== 'wood') return;
  if (fast) {
    const m = WOOD_MOTIF[run.reedSeq++ % WOOD_MOTIF.length];
    const phase = run.t - run.beat * BEAT;
    run.reedOpen = run.t;
    events.push({ type: 'reed', on: true, midi: liveNote('wood', m, run.beat, phase), t: run.t, beat: run.beat });
  } else if (run.reedOpen !== false) {
    record(run, 'wood', { t: run.reedOpen, d: Math.max(.06, run.t - run.reedOpen) });
    run.reedOpen = false;
    events.push({ type: 'reed', on: false, t: run.t, beat: run.beat });
  }
}
// Antennas touching strings inside one constant-speed slice.
function contacts(run, course, speed, dt, events) {
  const x0 = run.x, x1 = x0 + dt * speed, phase0 = run.t - run.beat * BEAT;
  if (run.stationId === 'harp' && x1 > course.harp.from && x0 < course.harp.to) {
    const first = Math.floor(x0 / STRING_SPACING) + 1, last = Math.floor(x1 / STRING_SPACING);
    for (let k = first; k <= last; k++) {
      const at = k * STRING_SPACING, into = (at - x0) / speed, phase = phase0 + into;
      if (phase < HARP_WINDOW[0] || phase > HARP_WINDOW[1] || at < course.harp.from || at > course.harp.to) continue;
      if (run.harpBeat !== run.beat) { run.harpBeat = run.beat; run.harpOrder = 0; }
      const notes = harpRun(barOf(run.beat), 24), midi = notes[Math.min(run.harpOrder, notes.length - 1)];
      run.harpOrder += 1;
      note(run, events, 'harp', midi, { t: run.t + into, x: at, string: k });
      record(run, 'harp', { t: run.t + into, n: 1, hop: run.beat });
    }
  }
  if (run.stationId === 'strings') {
    const from = Math.max(phase0, STRING_WINDOW[0]), to = Math.min(phase0 + dt, STRING_WINDOW[1]);
    if (from >= to) return;
    const xa = x0 + (from - phase0) * speed, xb = x0 + (to - phase0) * speed;
    course.strings.forEach((sx, i) => {
      if (xa > sx + STRING_REACH || xb < sx - STRING_REACH || run.stringsRung.includes(`${run.beat}:${i}`)) return;
      run.stringsRung.push(`${run.beat}:${i}`);
      if (run.stringsRung.length > 6) run.stringsRung.shift();
      const at = run.t + (from - phase0) + Math.max(0, (sx - STRING_REACH - xa) / speed);
      const raw = STRING_NOTES[i % STRING_NOTES.length];
      note(run, events, 'strings', liveNote('strings', raw, run.beat, at - run.beat * BEAT), { t: at, string: i, x: sx });
      record(run, 'strings', { t: at, i });
    });
  }
}
function moveCart(run, course, dt) {
  const c = run.cart;
  if (c.state !== 'ride') return;
  c.x = Math.min(course.cart.x1, c.x + CART_SPEED * dt);
  if (c.x >= course.cart.x1 - 1e-9) c.state = 'stopped';
}
function chatter(run, course, events) {
  if (run.stationId !== 'metronome' || run.status === 'docked') return;
  run.rod.next ??= run.t + run.rod.tick;
  while (run.rod.next <= run.t + 1e-9) {
    events.push({ type: 'chatter', t: run.rod.next, id: ++run.seq });
    run.rod.next += run.rod.tick;
  }
}
function fall(run, events) {
  run.status = 'falling'; run.fallAt = run.beat; run.fallX = run.x;
  run.fails[run.checkpoint] = (run.fails[run.checkpoint] || 0) + 1;
  events.push({ type: 'fall', x: run.x, kind: run.cart.state === 'ride' ? 'brass' : 'plain', id: ++run.seq });
}
function respawn(run, course, events) {
  const cp = course.checkpoints[run.checkpoint];
  run.x = run.hopStartX = cp.x; run.status = 'playing'; run.hops += 0; run.fastInHop = 0; run.resonance = [];
  // A retake starts from the last lantern: what came before it stands.
  const take = run.takes[run.stationId];
  if (take) { take.events = take.events.filter(e => e.t <= run.cpT); take.hops = take.hops.filter(b => b * BEAT <= run.cpT); }
  if (run.stationId === 'brass') { run.cart = { state: 'wait', x: course.cart.x0, from: 0, hits: 0, lastHit: -1 }; if (take) { take.events = []; take.hops = []; } }
  if (run.reedOpen !== false) run.reedOpen = false;
  // Coming back in the dark, one more look at the way.
  if (run.stationId === 'cymbal') run.lightAt = run.t;
  events.push({ type: 'respawn', x: cp.x, id: ++run.seq });
}
function touchdown(run, course, events) {
  const k = run.beat;
  if (run.status === 'falling') {
    if (k >= run.fallAt + FALL_BEATS) respawn(run, course, events);
    return;
  }
  if (run.status !== 'playing') return;
  // A guard rail after falls off the cart: nobody is stuck on the brass.
  if (run.stationId === 'brass' && run.cart.state !== 'wait' && run.x < COURSE.cart.x1 + 1 && (run.fails[run.checkpoint] || 0) >= GUARD_FAILS) {
    const r = run.x - run.cart.x;
    if (Math.abs(r) > CART_FOOT) { run.x = run.cart.x + Math.sign(r) * CART_FOOT; events.push({ type: 'guard', id: ++run.seq }); }
  }
  const support = supports(run, course, run.x);
  if (!support) { fall(run, events); return; }
  run.hopStartX = run.x; run.hops += 1; run.fastInHop = 0; run.lastLand = support.kind;
  events.push({ type: 'land', x: run.x, kind: support.kind, edge: edgeSide(support, run.x), id: ++run.seq });
  const was = run.station, station = stationAt(run.x);
  land(run, course, support, k, events);
  if (course.stations[was].id !== station.id) enter(run, course, was, station, events);
  course.checkpoints.forEach((cp, i) => {
    if (i <= run.checkpoint || run.x < cp.from) return;
    run.checkpoint = i; run.cpT = run.t; events.push({ type: 'checkpoint', index: i });
  });
}
function enter(run, course, was, station, events) {
  if (run.reedOpen !== false) { record(run, 'wood', { t: run.reedOpen, d: Math.max(.06, run.t - run.reedOpen) }); run.reedOpen = false; events.push({ type: 'reed', on: false }); }
  wake(run, course.stations[was].id, events);
  run.station = course.stations.indexOf(station); run.stationId = station.id; run.resonance = [];
  events.push({ type: 'station', id: station.id });
}
function land(run, course, p, k, events) {
  const id = stationAt(run.x).id;
  const inZone = PART_OF[id];
  if (inZone && id !== 'brass') recordHop(run, inZone, k);
  if (p.kind === 'drum') {
    const edge = Math.min(run.x - p.a, p.b - run.x), soft = edge < 12;
    note(run, events, 'drums', null, { voice: p.voice, soft, x: run.x, platform: p.i });
    record(run, 'drums', { t: run.t, voice: p.voice, soft });
  } else if (p.kind === 'tongue') {
    if (!run.resonance.includes(p.name)) run.resonance.push(p.name);
    note(run, events, 'tongue', liveNote('tongue', p.m, k), { platform: p.i, name: p.name, x: run.x });
    record(run, 'tongue', { t: run.t, m: p.m });
  } else if (p.kind === 'res') {
    note(run, events, 'tongue', liveNote('tongue', p.m + 12, k), { platform: p.i, name: p.name, x: run.x, v: .6 });
  } else if (p.kind === 'key') {
    // The one lit black key on this octave is the song's borrowed note.
    const m = p.key % 14 === 10 && run.x >= p.b - 8 ? 75 : keyPitch(p.key);
    note(run, events, 'keys', liveNote('keys', m, k), { platform: p.i, key: p.key, x: run.x });
    record(run, 'keys', { t: run.t, m });
  } else if (p.kind === 'push' || p.kind === 'pull') {
    const push = p.kind === 'push', chord = chordAtBar(barOf(k));
    note(run, events, 'bellows', nearest(push ? 72 : 60, chord.tones), { platform: p.i, push, x: run.x });
    record(run, 'bellows', { t: run.t, push });
  } else if (p.kind === 'cymbal') {
    const soft = run.t - run.crashAt < BEAT * 2;
    run.lightAt = run.t; run.crashAt = run.t;
    events.push({ type: 'crash', x: run.x, soft, last: !!p.last, id: ++run.seq });
  } else if (p.kind === 'rung') {
    run.rod.tick = RUNG_TICKS[p.rung]; run.rod.rung = p.rung;
    events.push({ type: 'rung', rung: p.rung, id: ++run.seq });
  } else if (p.kind === 'cart') {
    landOnCart(run, course, k, events);
  }
  if (run.x >= course.dockX) dock(run, events, k);
}
function landOnCart(run, course, k, events) {
  const c = run.cart;
  if (c.state === 'wait') { c.state = 'ride'; c.from = k; events.push({ type: 'board', id: ++run.seq }); }
  const r = run.x - c.x, i = Math.max(0, k - c.from);
  recordHop(run, 'brass', k);
  const target = course.cart.prompts[Math.floor(i / 4) % course.cart.prompts.length] * U * 1.5;
  note(run, events, 'brass', liveNote('brass', brassPitch(r), k), { pos: r, slide: true });
  if (Math.abs(r - target) <= 24 && c.lastHit !== Math.floor(i / 4)) { c.lastHit = Math.floor(i / 4); c.hits += 1; events.push({ type: 'chime', hits: c.hits, id: ++run.seq }); }
}
export const cartTarget = (run, course) => course.cart.prompts[Math.floor(Math.max(0, run.beat - run.cart.from) / 4) % course.cart.prompts.length] * U * 1.5;
function dock(run, events, k) {
  run.status = 'docked'; run.dockAt = k; run.reedOpen = false;
  // The lock: legs out, one beat of silence, then the first tick.
  events.push({ type: 'dock', x: run.x, id: ++run.seq });
}
// A copy cheap enough to make every frame: what advance() changes is copied, and
// finished takes, which it only ever replaces, are shared.
export function cloneRun(run) {
  const takes = {};
  for (const [part, take] of Object.entries(run.takes)) takes[part] = { hops: [...take.hops], events: [...take.events] };
  return { ...run, takes, recording: { ...run.recording }, fails: { ...run.fails }, resonance: [...run.resonance], stringsRung: [...run.stringsRung], cart: { ...run.cart }, rod: { ...run.rod } };
}
// Pure helpers for drawing.
export const lightLevel = (run, s = run.t) => run.lightAt === null ? 0 : Math.max(0, 1 - (s - run.lightAt) / (LIGHT_BEATS * BEAT));
export const hopPhase = (run, s = run.t) => Math.max(0, Math.min(1, (s - run.beat * BEAT) / BEAT));
