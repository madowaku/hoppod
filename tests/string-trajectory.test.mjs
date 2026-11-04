import test from 'node:test';
import assert from 'node:assert/strict';
import { PERIOD, SLOW_SPEED, FAST_SPEED, COURSE_VERSION } from '../public/src/engine.mjs';
import {
  LAB, PROGRAMS, newAttempt, heroY, advanceAttempt, simulateProgram, withinPad
} from '../public/dev/string-trajectory.mjs';

function near(actual, expected, epsilon = 1e-7) {
  assert.ok(Math.abs(actual - expected) <= epsilon,
    'Expected ' + actual + ' to be near ' + expected);
}

test('early FAST and late FAST have the same duration, landing and different string contacts', () => {
  const early = simulateProgram(PROGRAMS.early);
  const late = simulateProgram(PROGRAMS.late);
  near(early.fastSeconds, PERIOD / 2);
  near(late.fastSeconds, PERIOD / 2);
  near(early.x, late.x);
  near(early.x, LAB.startX + PERIOD/2 * (SLOW_SPEED + FAST_SPEED));
  assert.equal(early.status, 'clear');
  assert.equal(late.status, 'silent');
  assert.equal(early.stringCross.touched, true);
  assert.equal(late.stringCross.touched, false);
  assert.ok(Math.abs(early.stringCross.y - late.stringCross.y) > 20);
  assert.deepEqual(early.events.map(x=>x.type), ['note','clear']);
  assert.deepEqual(late.events.map(x=>x.type), ['passed','silent']);
});

test('scripted result is independent of integration slice size', () => {
  const reference = simulateProgram(PROGRAMS.early);
  for (const maxSlice of [PERIOD, PERIOD/7, 1/23, 1/30, 1/60, 1/144]) {
    for (const program of [PROGRAMS.early, PROGRAMS.late]) {
      const actual = simulateProgram(program, maxSlice);
      const baseline = simulateProgram(program);
      near(actual.x, baseline.x, 1e-6);
      near(actual.stringCross.time, baseline.stringCross.time, 1e-6);
      near(actual.stringCross.y, baseline.stringCross.y, 1e-6);
      assert.equal(actual.status, baseline.status);
    }
  }
  near(reference.stringCross.time, 98/FAST_SPEED);
});

test('early crosses near apex and late travels underneath the tip', () => {
  const e = simulateProgram(PROGRAMS.early).stringCross;
  const l = simulateProgram(PROGRAMS.late).stringCross;
  assert.ok(e.y >= LAB.activeStringTop && e.y <= LAB.activeStringBottom);
  assert.ok(l.y > LAB.activeStringBottom);
  assert.ok(e.time < PERIOD/2 && l.time > PERIOD/2);
  near(heroY(0), LAB.floorY-LAB.heroBaselineOffset);
  near(heroY(PERIOD), heroY(0));
});

test('permanent SLOW and permanent FAST cannot finish the experiment', () => {
  for (const fast of [true,false]) {
    const state = newAttempt();
    const events = advanceAttempt(state, PERIOD, fast);
    assert.equal(state.status, 'fall');
    assert.equal(events.at(-1).type,'fall');
    assert.equal(withinPad(state.x), false);
  }
});

test('no-string contact is distinguishable from missing the landing pad', () => {
  const late = simulateProgram(PROGRAMS.late);
  assert.ok(withinPad(late.x));
  assert.equal(late.status, 'silent');
  assert.equal(late.stringCross.touched, false);
});

test('lab uses unchanged production motion constants', () => {
  assert.equal(PERIOD,.78);
  assert.equal(SLOW_SPEED,105);
  assert.equal(FAST_SPEED,270);
  assert.equal(COURSE_VERSION,4);
});
