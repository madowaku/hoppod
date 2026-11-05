// RAPIPPO clock tower: pure model. No sound, DOM, rendering, storage or randomness.
// The hop, speeds, footing and landing rules are the production game's. Pendulums
// are locked to the beat, so a stage reads as a rhythm and not as a reaction test.
import { PERIOD, SLOW_SPEED, FAST_SPEED, footing, isSafe, landingMiss } from '../src/engine.mjs';
import { LAB, feetY, podTopY } from './string-trajectory.mjs';

export const TOWER = Object.freeze({
  pivotY: 0,
  swingBeats: 2,     // one full swing lasts two hops
  bobDrawn: 15,      // radius as drawn
  bobHit: 9,         // radius that hurts: a graze the player can see is forgiven
  podHalfWidth: 9,   // the body, not the antenna tips
  podTopInset: 8,    // the antenna tips do not count as being hit
  gearY: LAB.stringBottomY, // a gear turns at the height a string rings
  gearReach: LAB.antennaReach,
  bellBottomY: 246,  // the mouth: the antennas reach it for the middle half of any hop
  bellHalfWidth: 50, // as drawn, at the mouth
  step: 1 / 480      // contact is tested on this fixed grid, never per frame
});

const EPS = 1e-10;

export function swingAngle(pendulum, time) {
  const turn = time / (TOWER.swingBeats * PERIOD) + pendulum.phase;
  return pendulum.amp * Math.sin(2 * Math.PI * turn);
}
export function bobAt(pendulum, time) {
  const angle = swingAngle(pendulum, time);
  return {
    x: pendulum.x + pendulum.length * Math.sin(angle),
    y: TOWER.pivotY + pendulum.length * Math.cos(angle)
  };
}

// Three rooms, each ending on a landing that saves progress. spawn is where a
// retry stands: on the one-rhythm path, so the hint stays true after a resume. High pendulums (length 236) meet the pod around the top of a hop;
// low ones (length 330) meet it near the ground and are jumped over.
export const COURSE = Object.freeze({
  // Footing is 80px and the spacing 165px, so a slow hop always leaves a platform
  // and the fastest never skips one. Hop n therefore always happens on beat n,
  // and the pendulums read the same on every attempt.
  platforms: [
    [0, 132], [172, 268], [337, 433], [502, 598],     // room 1
    [667, 763], [832, 928], [997, 1093],              // room 2
    [1162, 1258], [1327, 1423], [1492, 1588],         // room 3
    [1657, 1960]                                      // under the bell
  ],
  checkpoints: [
    { platform: 0, spawn: 75 },
    { platform: 3, spawn: 568 },
    { platform: 6, spawn: 1061 }
  ],
  pendulums: [
    { x: 380, length: 236, amp: .16, phase: .625 },
    { x: 702, length: 236, amp: .12, phase: .625 },
    { x: 859, length: 236, amp: .16, phase: 0 },
    { x: 1128, length: 330, amp: .16, phase: .25 },
    { x: 1346, length: 236, amp: .08, phase: .375 },
    { x: 1511, length: 236, amp: .16, phase: 0 }
  ],
  gears: [{ x: 346 }, { x: 835 }, { x: 1399 }],
  bell: { x: 1780 },
  demos: {
    // One gesture repeated: wait, then hold until the landing. The clear asks for no more.
    clear: Array.from({ length: 10 }, () => [.28, .78]),
    // The opposite flight: press at once to be high at the gears, and read each
    // landing to choose how long. Holding one length runs into a pendulum.
    full: [[0, .24], [0, .54], [0, .42], [0, .51], [0, .54], [0, .45], [0, .51], [0, .51], [.09, .63], [0, .48]]
  }
});

// A save is where to stand and when: the pendulums resume on the beat the player
// reached the room, so a retry looks exactly like the moment it replaces.
export const FIRST_SAVE = Object.freeze({ checkpoint: 0, time: 0, collected: Object.freeze([]) });
export function newAttempt(course = COURSE, save = FIRST_SAVE) {
  const { spawn } = course.checkpoints[save.checkpoint];
  return {
    course, save, x: spawn, hopStartX: spawn, phase: 0, time: save.time, hops: 0, fastSeconds: 0,
    status: 'playing', miss: null, hitBy: null, segments: [],
    gears: course.gears.map((_, index) => save.collected.includes(index))
  };
}

function contacts(run, events) {
  const top = podTopY(run.phase), bottom = feetY(run.phase);
  run.course.gears.forEach((gear, index) => {
    if (run.gears[index]) return;
    if (Math.abs(run.x - gear.x) <= TOWER.gearReach && top <= TOWER.gearY) {
      run.gears[index] = true;
      events.push({ type: 'gear', gear: index, t: run.time });
    }
  });
  for (const [index, pendulum] of run.course.pendulums.entries()) {
    const bob = bobAt(pendulum, run.time);
    const nearestX = Math.max(run.x - TOWER.podHalfWidth, Math.min(bob.x, run.x + TOWER.podHalfWidth));
    const nearestY = Math.max(top + TOWER.podTopInset, Math.min(bob.y, bottom));
    if ((bob.x - nearestX) ** 2 + (bob.y - nearestY) ** 2 <= TOWER.bobHit ** 2) {
      run.status = 'hit'; run.hitBy = index;
      events.push({ type: 'hit', pendulum: index, x: run.x, t: run.time });
      return;
    }
  }
  // The clear is flying into the bell. It hangs low and wide over the last platform,
  // so every way of arriving strikes it: nothing can pass underneath.
  if (top <= TOWER.bellBottomY && Math.abs(run.x - run.course.bell.x) <= TOWER.bellHalfWidth + TOWER.gearReach) {
    run.status = 'rang';
    events.push({ type: 'ring', x: run.x, y: top, t: run.time });
  }
}

function land(run, events) {
  const terrain = { platforms: run.course.platforms };
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
  run.course.checkpoints.forEach((checkpoint, index) => {
    if (index <= run.save.checkpoint) return;
    const [a, b] = footing(run.course.platforms[checkpoint.platform]);
    if (run.x < a || run.x > b) return;
    run.save = { checkpoint: index, time: run.time, collected: run.gears.flatMap((got, gear) => got ? [gear] : []) };
    events.push({ type: 'checkpoint', checkpoint: index, x: run.x });
  });
}

export function advanceAttempt(run, dt, fast) {
  const events = [];
  if (run.status !== 'playing' || !Number.isFinite(dt) || dt <= 0) return events;
  const speed = fast ? FAST_SPEED : SLOW_SPEED;
  let remaining = dt;
  while (remaining > EPS && run.status === 'playing') {
    const nextGrid = (Math.floor(run.time / TOWER.step + 1e-7) + 1) * TOWER.step;
    const slice = Math.min(remaining, nextGrid - run.time, PERIOD - run.phase);
    const before = run.x;
    run.x += speed * slice;
    // Going past a gear without turning it is told, so a player learns it is there.
    run.course.gears.forEach((gear, index) => {
      const edge = gear.x + TOWER.gearReach;
      if (!run.gears[index] && before <= edge && run.x > edge) events.push({ type: 'gearMissed', gear: index, t: run.time });
    });
    run.phase += slice;
    run.time += slice;
    if (fast) {
      run.fastSeconds += slice;
      const last = run.segments.at(-1), from = run.phase - slice;
      if (last && last.hop === run.hops && Math.abs(last.to - from) < 1e-9) last.to = run.phase;
      else run.segments.push({ hop: run.hops, from, to: run.phase });
    }
    remaining -= slice;
    if (nextGrid - run.time < EPS) { run.time = nextGrid; contacts(run, events); }
    if (run.status === 'playing' && run.phase >= PERIOD - EPS) land(run, events);
  }
  return events;
}

// A plan lists one [fastOn, fastOff) interval per hop, in seconds into the hop.
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
export function simulate(course, plan, { save = FIRST_SAVE, maxSlice = PERIOD } = {}) {
  const run = newAttempt(course, save);
  const events = [];
  for (let left = 32 * PERIOD; left > 0 && run.status === 'playing'; left -= maxSlice) {
    events.push(...advanceWithPlan(run, maxSlice, plan));
  }
  return { ...run, events };
}

// Ringing the bell is the clear. Every gear on top of it is the optional full
// result, and it never holds the clear back.
export function judge(run) {
  if (run.status === 'hit') return { ok: false, reason: 'hit', tier: null };
  if (run.status === 'fall') return { ok: false, reason: run.miss === 'far' ? 'far' : 'short', tier: null };
  if (run.status !== 'rang') return { ok: false, reason: 'unfinished', tier: null };
  return { ok: true, reason: 'ok', tier: run.gears.every(Boolean) ? 'full' : 'clear' };
}
