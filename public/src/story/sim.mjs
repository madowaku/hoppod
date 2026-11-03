// STORY simulation. Pure and deterministic: given story time and the input
// timeline it always produces the same run. Hops land exactly on beats
// (k × BEAT), so the hero's touchdowns are the music's pulse.
import { SLOW_SPEED, FAST_SPEED } from '../engine.mjs';
import { BEAT } from './beat.mjs';
import { platformAt, chapterAt, platformAhead } from './course.mjs';

// Communication range from the hero's antenna. A friend that drifts beyond it
// loses the signal and stops; nobody is ever commanded. Small enough that the
// whole ring, and the friend leaving it, fits on screen behind the hero.
export const RANGE = 150;
export const FOLLOW_GAP = 46;
// Green floats between SLOW and FAST: FAST pulls away, SLOW lets it catch up.
export const GREEN_SPEED = 160;
// Red's trip back for green is short enough to stay one musical phrase.
export const RESCUE_SPEED = 900, CARRY_SPEED = 700, TEAM_SPEED = 320;
export const PART_REACH = 36, JOIN_REACH = 130, WAKE_REACH = 150;
// Green's socket sits SOCKET_LEAD px before the chasm. Green never stops
// chasing the hero (out of range only its signal and music fade); the
// instant it reaches the socket it plants its legs (BRIDGE_LEGS s) and the
// bridge runs out from under it at BRIDGE_SPEED. Rush ahead and the bridge
// is not there yet; wait with SLOW and green catches up. Once built it stays.
export const SOCKET_LEAD = 100, SOCKET_NEAR = 80, BRIDGE_LEGS = .18, BRIDGE_SPEED = 520;
export const FALL_BEATS = 2;

// The crane lowers its span on the first two beats of every four.
export const craneDown = beat => ((beat % 4) + 4) % 4 < 2;

export function newStory(course) {
  return {
    t: 0, beat: 0, hops: 0, x: course.start, hopStartX: course.start, status: 'playing',
    chapter: 'wake', checkpoint: 0, fallAt: null, fallX: 0, dockAt: null, together: false,
    parts: { got: 0, skips: 0, x: course.parts[0], assembledAt: null },
    blue: { state: 'parts', x: course.start - 30 },
    green: { state: 'dormant', x: course.greenMeet },
    red: { state: 'dormant', x: course.redConsole },
    switchOn: false, switchAt: null, fails: {},
  };
}

// A run as it would be on arriving at checkpoint i (developer start, tests).
export function storyFrom(course, i) {
  const run = newStory(course), cp = course.checkpoints[i];
  Object.assign(run, { x: cp.x, hopStartX: cp.x, checkpoint: i, chapter: cp.chapter });
  const got = course.parts.filter(x => x < cp.from).length;
  run.parts.got = got; run.parts.x = course.parts[got] ?? 0;
  if (got === course.parts.length) { run.blue.state = 'follow'; run.blue.x = cp.x - FOLLOW_GAP; run.parts.assembledAt = -10; }
  if (cp.x >= course.greenMeet - JOIN_REACH) { run.green.state = 'follow'; run.green.x = cp.x - FOLLOW_GAP; }
  if (cp.x > course.switchX) { run.green.state = 'switch'; run.green.x = course.switchX; run.switchOn = true; run.switchAt = -10; }
  if (cp.x >= course.redConsole - WAKE_REACH) run.red.state = 'crane';
  if (cp.x >= course.craneFar) { run.red.state = run.green.state = 'carry'; run.red.x = cp.x - 700; run.green.x = run.red.x - 16; }
  if (cp.chapter === 'base') {
    run.together = true; run.red.state = run.green.state = 'follow';
    run.green.x = cp.x - FOLLOW_GAP; run.red.x = cp.x - FOLLOW_GAP * 1.6;
  }
  return run;
}

// How far the bridge reaches (from the socket outward) at the run's time.
export const bridgeFront = (run, course) => run.switchOn ? course.switchX + Math.max(0, run.t - run.switchAt - BRIDGE_LEGS) * BRIDGE_SPEED : -Infinity;
const craneAssist = run => (run.fails[run.checkpoint] || 0) >= 2;
// Red works the crane while it is there; once it leaves, the span stays down.
export const craneSolid = (run, beat) => run.red.state !== 'dormant' && (run.red.state !== 'crane' || craneDown(beat) || craneAssist(run));

// Advance to story time `to` with one constant input. Returns events.
export function advanceStory(run, course, to, fast, events = []) {
  while (run.t < to - 1e-12) {
    const next = (run.beat + 1) * BEAT, end = Math.min(to, next), dt = end - run.t;
    const speed = run.status === 'playing' ? (fast ? FAST_SPEED : SLOW_SPEED) : 0, n = events.length;
    moveCrew(run, course, dt, speed, events);
    run.x += dt * speed; run.t = end;
    if (end >= next - 1e-9) { run.t = next; run.beat += 1; touchdown(run, course, events); }
    // Every event carries its story time, so its sound can be scheduled ahead.
    for (let i = n; i < events.length; i++) { events[i].t ??= run.t; events[i].beat ??= run.beat; }
  }
  return events;
}

function touchdown(run, course, events) {
  const k = run.beat;
  // Red noticed one beat ago; on this beat it leaves, alone and unasked.
  if (run.red.state === 'notice' && k >= run.red.noticeAt + 1) {
    run.red.state = 'rescue'; run.red.rescueAt = run.t; run.red.rescueX = run.red.x; events.push({ type: 'rescue', x: run.red.x });
  }
  if (run.status === 'falling') { if (k >= run.fallAt + FALL_BEATS) respawn(run, course, events); return; }
  if (run.status !== 'playing') return;
  const p = platformAt(course, run.x, k, { craneDown: b => craneSolid(run, b), bridgeTo: bridgeFront(run, course) });
  if (!p) {
    run.status = 'falling'; run.fallAt = k; run.fallX = run.x;
    events.push({ type: 'fall', x: run.x, beat: k });
    return;
  }
  land(run, course, p, events);
}

function land(run, course, p, events) {
  run.hops += 1; run.hopStartX = run.x;
  events.push({ type: 'land', kind: p.kind, x: run.x, beat: run.beat });
  const cps = course.checkpoints;
  while (run.checkpoint + 1 < cps.length && run.x >= cps[run.checkpoint + 1].from) {
    run.checkpoint += 1; events.push({ type: 'checkpoint', index: run.checkpoint });
  }
  const chapter = chapterAt(course, run.x);
  if (chapter !== run.chapter) { run.chapter = chapter; events.push({ type: 'chapter', id: chapter }); }
  collectPart(run, course, events);
  if (run.green.state === 'dormant' && run.x >= course.greenMeet - JOIN_REACH) {
    run.green.state = 'follow'; events.push({ type: 'join', who: 'green' });
  }
  // A relay antenna between the hero and a green out of range boosts the
  // signal: green hurries (TEAM_SPEED) until it is beside the hero again.
  if (run.green.state === 'follow' && run.x - run.green.x > RANGE && course.relays.some(r => r > run.green.x && r <= run.x)) {
    run.green.state = 'catch'; events.push({ type: 'relink', who: 'green' });
  }
  if (run.red.state === 'dormant' && run.x >= course.redConsole - WAKE_REACH) {
    run.red.state = 'crane'; events.push({ type: 'join', who: 'red' });
  }
  // Across the crane, red sees green is missing: one beat to look back,
  // then it leaves on its own.
  if (run.red.state === 'crane' && run.x >= course.craneFar) {
    run.red.state = 'notice'; run.red.noticeAt = run.beat; events.push({ type: 'notice' });
  }
  if (p.kind === 'station') {
    const friend = run[p.who];
    friend.state = 'station'; friend.x = Math.round((p.a + p.b) / 2);
    events.push({ type: 'station', who: p.who });
  }
  if (p.kind === 'dock') {
    run.status = 'docked'; run.dockAt = run.beat; run.x = course.dockX;
    events.push({ type: 'dock', beat: run.beat });
  }
}

function collectPart(run, course, events) {
  const parts = run.parts;
  if (parts.got >= course.parts.length) return;
  const d = run.x - parts.x;
  // A missed part hops ahead; after two misses it flies to the hero.
  if (Math.abs(d) <= PART_REACH || parts.skips >= 2) {
    parts.got += 1; parts.skips = 0;
    events.push({ type: 'collect', index: parts.got - 1, x: parts.x });
    if (parts.got === course.parts.length) {
      parts.assembledAt = run.t; run.blue.state = 'follow'; run.blue.x = run.x - FOLLOW_GAP;
      events.push({ type: 'assemble' });
    } else {
      const next = course.parts[parts.got];
      parts.x = next > run.x + 60 ? next : platformAhead(course, run.x + 140);
    }
  } else if (d > PART_REACH) {
    parts.skips += 1; parts.x = platformAhead(course, run.x + 140);
    events.push({ type: 'part-skip', x: parts.x });
  }
}

function moveCrew(run, course, dt, speed, events) {
  const { blue, green, red } = run, x1 = run.x + speed * dt;
  if (blue.state === 'follow') blue.x = x1 - FOLLOW_GAP * .7 + (blue.x - (x1 - FOLLOW_GAP * .7)) * Math.exp(-6 * dt);
  if (green.state === 'follow' || green.state === 'catch') {
    // Green chases at its own speed, never closer than FOLLOW_GAP behind the
    // hero; a boosted green hurries at TEAM_SPEED until it is beside him.
    const vg = run.together ? TEAM_SPEED : green.state === 'catch' ? TEAM_SPEED : GREEN_SPEED;
    const socket = !run.switchOn && run.chapter === 'apart' && green.x < course.switchX;
    // Exact instants (not frame ends) green passes the socket's approach and
    // the socket itself, so their sounds can be scheduled ahead.
    if (socket && green.x < course.switchX - SOCKET_NEAR) {
      const tn = arrive(green.x, vg, run.x, speed, course.switchX - SOCKET_NEAR);
      if (tn <= dt) events.push({ type: 'socket', t: run.t + tn });
    }
    const ta = socket ? arrive(green.x, vg, run.x, speed, course.switchX) : Infinity;
    if (ta <= dt) {
      green.state = 'switch'; green.from = course.switchX; green.x = course.switchX; run.switchOn = true; run.switchAt = run.t + ta;
      events.push({ type: 'switch', t: run.switchAt });
    } else {
      green.x = Math.min(x1 - FOLLOW_GAP, green.x + vg * dt);
      if (green.state === 'catch' && x1 - green.x <= FOLLOW_GAP + 1e-6) green.state = 'follow';
    }
  }
  if (red.state === 'rescue') {
    const reach = red.rescueX - green.x - 12, t1 = run.t + dt;
    if (rescueTravel(t1 - red.rescueAt) >= reach) {
      // Exact instant red reaches green, so its cue can be scheduled ahead.
      let lo = run.t - red.rescueAt, hi = t1 - red.rescueAt;
      for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (rescueTravel(mid) >= reach) hi = mid; else lo = mid; }
      red.x = green.x + 12; red.state = 'carry'; green.state = 'carry'; events.push({ type: 'pickup', x: green.x, t: red.rescueAt + hi });
    } else red.x = red.rescueX - rescueTravel(t1 - red.rescueAt);
  } else if (red.state === 'carry') {
    const gap = FOLLOW_GAP * 1.6, d0 = run.x - red.x;
    red.x += CARRY_SPEED * dt; green.x = red.x - 16;
    if (x1 - red.x <= gap) {
      red.state = 'follow'; green.state = 'follow'; run.together = true;
      events.push({ type: 'reunion', t: run.t + Math.max(0, Math.min(dt, (d0 - gap) / (CARRY_SPEED - speed))) });
    }
  } else if (red.state === 'follow') red.x = Math.min(x1 - FOLLOW_GAP * 1.6, red.x + TEAM_SPEED * dt);
  // Red rides the crane's beam while it works it; when it notices green is
  // missing it drops beside the hero for one beat before leaving.
  else if (red.state === 'crane') red.x += ((course.crane.a + course.crane.b) / 2 - red.x) * (1 - Math.exp(-3 * dt));
  else if (red.state === 'notice') red.x += (x1 - 70 - red.x) * (1 - Math.exp(-8 * dt));
}

// Distance red has flown τ seconds after leaving: it sets off visibly,
// gathering speed over its first beat, then flies at RESCUE_SPEED. Closed
// form, so the pickup is the same at any frame rate.
export function rescueTravel(tau) {
  const b = BEAT, t = Math.max(0, tau), head = RESCUE_SPEED * (.05 * Math.min(t, b) + .95 * Math.min(t, b) ** 4 / (4 * b ** 3));
  return head + RESCUE_SPEED * Math.max(0, t - b);
}

// Seconds until green (at gx, speed vg, held FOLLOW_GAP behind a hero at
// hx moving at speed) reaches x: its position is the lesser of its own run
// and the hero's, so it gets there when both have. Infinity if it does not.
function arrive(gx, vg, hx, speed, x) {
  const own = (x - gx) / vg, held = hx - FOLLOW_GAP >= x ? 0 : speed > 0 ? (x + FOLLOW_GAP - hx) / speed : Infinity;
  return Math.max(own, held);
}

function respawn(run, course, events) {
  const cp = course.checkpoints[run.checkpoint], { blue, green, red } = run;
  run.fails[run.checkpoint] = (run.fails[run.checkpoint] || 0) + 1;
  run.status = 'playing'; run.x = cp.x; run.hopStartX = cp.x; run.fallAt = null;
  // Progress with friends is never lost; only positions are restored.
  for (const friend of [blue, green, red]) if (friend.state === 'station') friend.state = 'follow';
  if (blue.state === 'follow') blue.x = cp.x - FOLLOW_GAP;
  // Once green holds the bridge it stays: a fall never undoes its work.
  if (green.state === 'catch') green.state = 'follow';
  if (green.state === 'dormant') green.x = course.greenMeet;
  if (['notice', 'rescue', 'carry'].includes(red.state)) {
    red.state = green.state = 'carry'; red.x = cp.x - 700; green.x = red.x - 16;
  }
  if (green.state === 'follow') green.x = cp.x - FOLLOW_GAP;
  if (red.state === 'follow') red.x = cp.x - FOLLOW_GAP * 1.6;
  events.push({ type: 'respawn', checkpoint: run.checkpoint, x: cp.x });
  land(run, course, platformAt(course, cp.x) || { kind: 'ground', a: cp.x, b: cp.x }, events);
}

// Hero hop height (0 at touchdown) from story time.
export function hopLift(run) {
  if (run.status !== 'playing') return 0;
  return Math.sin((run.t - run.beat * BEAT) / BEAT * Math.PI);
}
