// RAPIPPO experimental trajectory mechanics. Independent of production course
// and STORY. No sound, DOM, rendering, storage or randomness in this module.
import { PERIOD, SLOW_SPEED, FAST_SPEED, INSET } from '../src/engine.mjs';

export const LAB = Object.freeze({
  period: PERIOD,
  startX: 75,
  floorY: 288,
  heroBaselineOffset: 25,
  hopHeight: 88,
  stringX: 173,
  // Only the glowing lower section of the suspended string is touch-sensitive.
  sensorOffsetY: 12, // small visible diode at the front/top of the face
  activeStringTop: 155,
  activeStringBottom: 173,
  landingPad: Object.freeze([183, 272]),
  // A one-beat experiment, not a completed stage.
  tolerancePx: 0.001
});

export function heroY(phase) {
  return LAB.floorY - LAB.heroBaselineOffset -
    LAB.hopHeight * Math.sin(Math.PI * Math.max(0, Math.min(PERIOD, phase)) / PERIOD);
}

export function newAttempt() {
  return {
    x: LAB.startX, phase: 0, fastSeconds: 0,
    stringCross: null, status: 'playing'
  };
}

export function withinPad(x) {
  const [a, b] = LAB.landingPad;
  return x >= a + INSET - LAB.tolerancePx && x <= b - INSET + LAB.tolerancePx;
}

// Advance with a piecewise-constant input. Computes the crossing at its exact
// sub-frame time, instead of asking whether the renderer happened to overlap
// the string. Input timing accuracy in the prototype remains frame-dependent.
export function advanceAttempt(run, dt, fast) {
  const events = [];
  if (run.status !== 'playing' || !Number.isFinite(dt) || dt <= 0) return events;
  let remaining = dt;
  while (remaining > 1e-10 && run.status === 'playing') {
    const slice = Math.min(remaining, PERIOD - run.phase);
    const speed = fast ? FAST_SPEED : SLOW_SPEED;
    const beforeX = run.x, beforePhase = run.phase;
    const afterX = beforeX + speed * slice;
    if (run.stringCross === null &&
        beforeX <= LAB.stringX && afterX >= LAB.stringX) {
      const crossingPhase = beforePhase + (LAB.stringX - beforeX) / speed;
      const y = heroY(crossingPhase) - LAB.sensorOffsetY;
      const touched = y >= LAB.activeStringTop && y <= LAB.activeStringBottom;
      run.stringCross = { time: crossingPhase, y, touched };
      events.push({ type: touched ? 'note' : 'passed', t: crossingPhase, y });
    }
    run.x = afterX;
    run.phase = beforePhase + slice;
    if (fast) run.fastSeconds += slice;
    remaining -= slice;
    if (run.phase >= PERIOD - 1e-9) {
      run.phase = PERIOD;
      if (!withinPad(run.x)) {
        run.status = 'fall';
      } else if (run.stringCross?.touched) {
        run.status = 'clear';
      } else {
        run.status = 'silent';
      }
      events.push({ type: run.status, t: PERIOD, x: run.x });
    }
  }
  return events;
}

// Frame-rate-independent *scripted* experiment. Both programs have exactly
// 0.39s of FAST and therefore must share an identical landing x.
export function simulateProgram(segments, maxSlice = PERIOD) {
  const run = newAttempt();
  const events = [];
  for (const { fast, duration } of segments) {
    if (!Number.isFinite(duration) || duration < 0) throw new RangeError('Bad duration');
    let left = duration;
    while (left > 1e-10 && run.status === 'playing') {
      const slice = Math.min(left, maxSlice);
      events.push(...advanceAttempt(run, slice, fast));
      left -= slice;
    }
  }
  return { ...run, events };
}

export const PROGRAMS = Object.freeze({
  early: Object.freeze([
    Object.freeze({ fast: true, duration: PERIOD / 2 }),
    Object.freeze({ fast: false, duration: PERIOD / 2 })
  ]),
  late: Object.freeze([
    Object.freeze({ fast: false, duration: PERIOD / 2 }),
    Object.freeze({ fast: true, duration: PERIOD / 2 })
  ])
});
