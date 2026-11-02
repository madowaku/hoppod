// STORY simulation. Pure and deterministic: given story time and the input
// timeline it always produces the same run. Hops land exactly on beats
// (k × BEAT), so the hero's touchdowns are the music's pulse.
import { SLOW_SPEED, FAST_SPEED } from '../engine.mjs';
import { BEAT } from './beat.mjs';
import { platformAt, chapterAt, platformAhead } from './course.mjs';

// Communication range from the hero's antenna. A friend that drifts beyond it
// loses the signal and stops; nobody is ever commanded.
export const RANGE = 240;
export const FOLLOW_GAP = 46;
// Green floats between SLOW and FAST: FAST pulls away, SLOW lets it catch up.
export const GREEN_SPEED = 160;
export const RESCUE_SPEED = 600, CARRY_SPEED = 420, TEAM_SPEED = 320;
export const PART_REACH = 36, JOIN_REACH = 130, WAKE_REACH = 150;
// A green pod that stops this close to the switch settles onto it. Each
// respawn at the same checkpoint widens it, so nobody is stuck forever.
export const SWITCH_SNAP = 70, SWITCH_ASSIST = 30;
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
    switchOn: false, fails: {},
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
  if (cp.x > course.switchX) { run.green.state = 'switch'; run.green.x = course.switchX; run.switchOn = true; }
  if (cp.x >= course.redConsole - WAKE_REACH) run.red.state = 'crane';
  if (cp.x >= course.craneFar) { run.red.state = run.green.state = 'carry'; run.red.x = cp.x - 700; run.green.x = run.red.x - 16; }
  if (cp.chapter === 'base') {
    run.together = true; run.red.state = run.green.state = 'follow';
    run.green.x = cp.x - FOLLOW_GAP; run.red.x = cp.x - FOLLOW_GAP * 1.6;
  }
  return run;
}

export const switchSnap = run => SWITCH_SNAP + SWITCH_ASSIST * Math.min(3, run.fails[run.checkpoint] || 0);
const craneAssist = run => (run.fails[run.checkpoint] || 0) >= 2;
export const craneSolid = (run, beat) => run.red.state === 'crane' && (craneDown(beat) || craneAssist(run));

// Advance to story time `to` with one constant input. Returns events.
export function advanceStory(run, course, to, fast, events = []) {
  while (run.t < to - 1e-12) {
    const next = (run.beat + 1) * BEAT, end = Math.min(to, next), dt = end - run.t;
    const speed = run.status === 'playing' ? (fast ? FAST_SPEED : SLOW_SPEED) : 0;
    moveCrew(run, course, dt, speed, events);
    run.x += dt * speed; run.t = end;
    if (end >= next - 1e-9) { run.t = next; run.beat += 1; touchdown(run, course, events); }
  }
  return events;
}

function touchdown(run, course, events) {
  const k = run.beat;
  if (run.status === 'falling') { if (k >= run.fallAt + FALL_BEATS) respawn(run, course, events); return; }
  if (run.status !== 'playing') return;
  const p = platformAt(course, run.x, k, { craneDown: b => craneSolid(run, b), bridgeOpen: run.switchOn });
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
  if (run.red.state === 'dormant' && run.x >= course.redConsole - WAKE_REACH) {
    run.red.state = 'crane'; events.push({ type: 'join', who: 'red' });
  }
  // Across the crane, red sees green is missing and leaves on its own.
  if (run.red.state === 'crane' && run.x >= course.craneFar) {
    run.red.state = 'rescue'; events.push({ type: 'rescue' });
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
  if (green.state === 'follow') {
    const vg = run.together ? TEAM_SPEED : GREEN_SPEED, g1 = Math.min(x1 - FOLLOW_GAP, green.x + vg * dt);
    if (!run.together && x1 - g1 > RANGE) {
      // Exact instant the link breaks, independent of frame size.
      const d0 = run.x - green.x, tc = Math.max(0, Math.min(dt, (RANGE - d0) / Math.max(1e-9, speed - vg)));
      strand(run, course, green.x + vg * tc, events);
    } else green.x = g1;
  }
  if (red.state === 'rescue') {
    red.x -= RESCUE_SPEED * dt;
    if (red.x <= green.x + 12) { red.x = green.x + 12; red.state = 'carry'; green.state = 'carry'; events.push({ type: 'pickup' }); }
  } else if (red.state === 'carry') {
    red.x += CARRY_SPEED * dt; green.x = red.x - 16;
    if (x1 - red.x <= FOLLOW_GAP * 1.6) {
      red.state = 'follow'; green.state = 'follow'; run.together = true;
      events.push({ type: 'reunion' });
    }
  } else if (red.state === 'follow') red.x = Math.min(x1 - FOLLOW_GAP * 1.6, red.x + TEAM_SPEED * dt);
}

function strand(run, course, x, events) {
  const green = run.green;
  if (!run.switchOn && Math.abs(x - course.switchX) <= switchSnap(run)) {
    green.state = 'switch'; green.from = x; green.x = course.switchX; run.switchOn = true;
    events.push({ type: 'switch', from: x });
  } else {
    green.state = 'lost'; green.x = x;
    events.push({ type: 'strand', x });
  }
}

function respawn(run, course, events) {
  const cp = course.checkpoints[run.checkpoint], { blue, green, red } = run;
  run.fails[run.checkpoint] = (run.fails[run.checkpoint] || 0) + 1;
  run.status = 'playing'; run.x = cp.x; run.hopStartX = cp.x; run.fallAt = null;
  // Progress with friends is never lost; only positions are restored.
  for (const friend of [blue, green, red]) if (friend.state === 'station') friend.state = 'follow';
  if (blue.state === 'follow') blue.x = cp.x - FOLLOW_GAP;
  if (green.state === 'switch' && cp.x < course.switchX) { green.state = 'follow'; run.switchOn = false; }
  if (green.state === 'lost') green.state = cp.x >= course.greenMeet - JOIN_REACH ? 'follow' : 'dormant';
  if (green.state === 'dormant') green.x = course.greenMeet;
  if (red.state === 'rescue' || red.state === 'carry') {
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
