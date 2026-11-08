// The tower simulation. Pure and deterministic: given story time and the input
// timeline it always produces the same run, and a hop always lands on a beat.
// Every event carries its story time, so its sound can be scheduled ahead.
import { SLOW_SPEED, FAST_SPEED, PERIOD as BEAT } from '../engine.mjs';
import { COURSE, platformAt, stationAt, BOOST, bobAt, BOB_HIT, POD_HALF, POD_TOP_INSET, GEAR_Y, GEAR_REACH, GEAR_WINDOW, handFlat, toothUp, isTooth } from './course.mjs';

export const FALL_BEATS = 2, ASSIST_FAILS = 3, HIT_FROM = .25;
// Contact with pendulums and gears is tested on this fixed grid, never per frame.
const STEP = 1 / 240;
const FLOOR = 382, LIFT = 2, HOP_H = 96, TOP_REST = 62, TOP_STRETCH = 4;
export const feetY = phase => FLOOR - LIFT - HOP_H * Math.sin(Math.PI * Math.max(0, Math.min(1, phase)));
export const topY = phase => feetY(phase) - TOP_REST - TOP_STRETCH * Math.sin(Math.PI * Math.max(0, Math.min(1, phase)));

export function newRun(course = COURSE) {
  return {
    t: 0, beat: 0, hops: 0, x: course.start, hopStartX: course.start, status: 'playing', station: 0, stationId: course.stations[0].id,
    checkpoint: 0, cpT: 0, fast: false, fallAt: null, fallX: 0, fallKind: null, hitBy: null, dockAt: null, fails: {}, seq: 0,
    boost: false, cog: false, sandUsed: [], gears: [], lastLand: null, tick: 0,
  };
}
// A run as it stands on reaching checkpoint i, at story beat `beat`.
export function runFrom(course, i, { beat = 0, gears = [] } = {}) {
  const run = newRun(course), cp = course.checkpoints[i], st = course.stations[cp.station];
  run.x = run.hopStartX = cp.x; run.checkpoint = i; run.station = cp.station; run.stationId = st.id;
  run.beat = beat; run.t = beat * BEAT; run.cpT = run.t; run.gears = [...gears];
  return run;
}
export const assisted = run => (run.fails[run.checkpoint] || 0) >= ASSIST_FAILS;
// What the hero stands on if it lands at x on this beat; null is a fall.
export function supports(run, course, x, beat) {
  const p = platformAt(x, course);
  if (!p) return null;
  if (assisted(run)) return p;
  // Stepping onto a run of teeth from outside it always holds: the escapement starts there.
  if (isTooth(p) && isTooth(platformAt(run.hopStartX, course)) && !toothUp(p, beat, run.tick)) return null;
  if (p.kind === 'hand' && !handFlat(p, beat)) return null;
  if (p.kind === 'sand' && run.sandUsed.includes(p.i)) return null;
  return p;
}

export function advance(run, course, to, fast, events = []) {
  if (fast !== run.fast) run.fast = fast;
  while (run.t < to - 1e-12) {
    const nextBeat = (run.beat + 1) * BEAT, nextGrid = (Math.floor(run.t / STEP + 1e-7) + 1) * STEP;
    const end = Math.min(to, nextBeat, nextGrid), dt = end - run.t;
    const n = events.length, moving = run.status === 'playing';
    // A hop from a backward cog is carried back by SLOW's speed: SLOW stays put.
    const speed = moving ? (run.fast ? FAST_SPEED : SLOW_SPEED) * (run.boost ? BOOST : 1) - (run.cog ? SLOW_SPEED : 0) : 0;
    run.x += dt * speed; run.t = end;
    if (moving && end >= nextGrid - 1e-9 && end < nextBeat - 1e-9) contacts(run, course, events);
    if (end >= nextBeat - 1e-9) { run.t = nextBeat; run.beat += 1; touchdown(run, course, events); }
    for (let i = n; i < events.length; i++) { events[i].t ??= run.t; events[i].beat ??= run.beat; }
  }
  return events;
}
function contacts(run, course, events) {
  const phase = (run.t - run.beat * BEAT) / BEAT, top = topY(phase), bottom = feetY(phase);
  if (phase >= GEAR_WINDOW[0] / BEAT && phase <= GEAR_WINDOW[1] / BEAT) {
    course.gears.forEach((g, i) => {
      if (run.gears.includes(i) || Math.abs(run.x - g.x) > GEAR_REACH || top > GEAR_Y) return;
      run.gears.push(i); events.push({ type: 'gear', gear: i, x: g.x, id: ++run.seq });
    });
  }
  // Nothing hits in the first part of a hop: by then the landing has already decided
  // where the hero is, so a hit there could not be avoided (owner's playtest, 2026-11-08).
  if (assisted(run) || phase < HIT_FROM) return;
  for (const [i, p] of course.pendulums.entries()) {
    if (Math.abs(p.x - run.x) > p.length * .4) continue;
    const bob = bobAt(p, run.t);
    const nx = Math.max(run.x - POD_HALF, Math.min(bob.x, run.x + POD_HALF)), ny = Math.max(top + POD_TOP_INSET, Math.min(bob.y, bottom));
    if ((bob.x - nx) ** 2 + (bob.y - ny) ** 2 <= BOB_HIT ** 2) { hit(run, i, events); return; }
  }
}
function hit(run, i, events) {
  run.status = 'falling'; run.fallAt = run.beat; run.fallX = run.x; run.fallKind = 'hit'; run.hitBy = i;
  run.fails[run.checkpoint] = (run.fails[run.checkpoint] || 0) + 1;
  events.push({ type: 'hit', pendulum: i, x: run.x, id: ++run.seq });
}
function fall(run, kind, events) {
  run.status = 'falling'; run.fallAt = run.beat; run.fallX = run.x; run.fallKind = kind; run.hitBy = null;
  run.fails[run.checkpoint] = (run.fails[run.checkpoint] || 0) + 1;
  events.push({ type: 'fall', x: run.x, kind, id: ++run.seq });
}
function respawn(run, course, events) {
  const cp = course.checkpoints[run.checkpoint];
  run.x = run.hopStartX = cp.x; run.status = 'playing'; run.boost = false; run.cog = false; run.sandUsed = []; run.hitBy = null; run.fallKind = null;
  events.push({ type: 'respawn', x: cp.x, id: ++run.seq });
}
function touchdown(run, course, events) {
  if (run.status === 'falling') { if (run.beat >= run.fallAt + FALL_BEATS) respawn(run, course, events); return; }
  if (run.status !== 'playing') return;
  const p = supports(run, course, run.x, run.beat);
  if (!p) { const under = platformAt(run.x, course); fall(run, under ? under.kind : 'gap', events); return; }
  // Sand pours away from under the hop that leaves it.
  const left = platformAt(run.hopStartX, course);
  if (left?.kind === 'sand' && left !== p && !run.sandUsed.includes(left.i)) run.sandUsed.push(left.i);
  if (p.kind === 'sand' && left === p && !assisted(run)) { run.sandUsed.push(p.i); fall(run, 'sand', events); return; }
  if (isTooth(p) && !isTooth(left)) run.tick = toothUp(p, run.beat) ? 0 : 1;
  run.hopStartX = run.x; run.hops += 1; run.lastLand = p.kind; run.boost = p.kind === 'spring'; run.cog = p.kind === 'cog';
  events.push({ type: 'land', x: run.x, kind: p.kind, platform: p.i, id: ++run.seq });
  if (p.kind === 'spring') events.push({ type: 'spring', x: run.x, id: ++run.seq });
  const was = run.station, st = stationAt(run.x, course);
  if (course.stations[was].id !== st.id) { run.station = course.stations.indexOf(st); run.stationId = st.id; events.push({ type: 'station', id: st.id }); }
  course.checkpoints.forEach((cp, i) => {
    if (i <= run.checkpoint || run.x < cp.from) return;
    run.checkpoint = i; run.cpT = run.t; events.push({ type: 'checkpoint', index: i });
  });
  if (run.x >= course.dockX) { run.status = 'docked'; run.dockAt = run.beat; events.push({ type: 'dock', x: run.x, id: ++run.seq }); }
}
export function cloneRun(run) { return { ...run, fails: { ...run.fails }, sandUsed: [...run.sandUsed], gears: [...run.gears] }; }
export const hopPhase = (run, s = run.t) => Math.max(0, Math.min(1, (s - run.beat * BEAT) / BEAT));
