import test from 'node:test';
import assert from 'node:assert/strict';
import { PERIOD, INSET, footing, ensureNextHopMargin } from '../public/src/engine.mjs';
import { GATES, GRACE, LabCourse, TimedInput, newLabRun, newPracticeRun, advanceLab, SLOW_STEP, FAST_STEP, PAD_HALF } from '../public/dev/mastery/lab-core.mjs';

// Replay toggle times (seconds from pad touchdown, starting released) on a
// practice course with frames of `dt`; returns the final run state.
function replay(gateId, exp, script, dt = 1 / 60, offset = 0) {
  const course = LabCourse.practice(gateId, exp), state = newPracticeRun(course), input = new TimedInput(offset);
  script.forEach((time, i) => input.push(offset + time, i % 2 === 0));
  let end = null;
  for (let now = offset; now < offset + 8 && state.status === 'playing' && !end; now += typeof dt === 'function' ? dt() : dt)
    for (const e of input.advance(state, course, now)) if (e.type === 'clear' || e.type === 'fall') end ??= e;
  return { state, cleared: end?.type === 'clear', end };
}

test('each gate witness script clears with landing rules on and off', () => {
  for (const gate of GATES) for (const exp of ['rules', 'plain']) {
    const { state, cleared } = replay(gate.id, exp, gate.script);
    assert.ok(cleared, `${gate.id}/${exp} fell: ${state.failure} at ${state.x.toFixed(1)}`);
  }
});

test('rules gates reject all-SLOW, all-FAST and the opposite landing input', () => {
  for (const gate of GATES) {
    assert.equal(replay(gate.id, 'rules', []).cleared, false);
    assert.equal(replay(gate.id, 'rules', [0]).cleared, false);
  }
  // Quiet span: holding FAST through touchdown on a still bridge breaks it.
  assert.equal(replay('quiet', 'rules', [.3]).state.failure, 'still-fast');
  // Rush span: releasing early on a rush bridge breaks it.
  assert.equal(replay('rush', 'rules', [0, .62]).state.failure, 'rush-slow');
});

test('the same timed input gives identical results at any frame rate or frame phase', () => {
  for (const gate of GATES) for (const shift of [0, .02, .05, .09]) {
    const script = gate.script.map(t => t + shift);
    const results = [1 / 30, 1 / 60, 1 / 120, 1 / 144, 1 / 23].map(dt => replay(gate.id, 'rules', script, dt));
    let seed = 7; const jitter = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return .004 + (seed % 1000) / 1000 * .045; };
    results.push(replay(gate.id, 'rules', script, jitter, 12.3456));
    for (const r of results) {
      assert.equal(r.cleared, results[0].cleared);
      assert.equal(r.state.status, results[0].state.status);
      assert.ok(Math.abs(r.end.x - results[0].end.x) < 1e-6, `${gate.id} ${shift}: ${r.end.x} vs ${results[0].end.x}`);
    }
  }
});

// Local window: how far one toggle of the witness can move alone (10ms grid)
// and still survive the next two landings. Later drift is the player's to
// correct on following hops, as in HOPSCROLL; it is not counted here.
function toggleTolerance(gate, exp = 'rules') {
  return gate.script.map((t, i) => {
    const mustLand = Math.ceil(t / PERIOD + 1e-9) + 1;
    const ok = d => { const s = [...gate.script]; s[i] = t + d;
      if (s[0] < 0 || !s.every((v, k) => k === 0 || v > s[k - 1])) return false;
      const r = replay(gate.id, exp, s); return r.cleared || r.state.hops >= mustLand; };
    let early = 0, late = 0;
    while (early < .5 && ok(-(early + .01))) early += .01;
    while (late < .5 && ok(late + .01)) late += .01;
    return [Math.round(early * 1000), Math.round(late * 1000)];
  });
}
test('every witness toggle tolerates at least 60ms early and late', () => {
  for (const gate of GATES) for (const [early, late] of toggleTolerance(gate))
    assert.ok(early >= 60 && late >= 60, `${gate.id}: ${early}/${late}ms`);
});

test('the whole rest island reaches the pad, and the pad snaps the pod to its centre', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const course = new LabCourse(seed, 'rules'); course.extendTo(12000);
    for (const g of course.gates) {
      const index = course.platforms.findIndex(p => p[2] === 'pad' && p[0] === g.pad - PAD_HALF), rest = course.platforms[index - 1];
      const [l, r] = footing(rest), [pl, pr] = footing(course.platforms[index]);
      assert.ok(l + FAST_STEP - pl >= 20 && pr - (r + SLOW_STEP) >= 20, `seed ${seed} gate ${g.id} rest ${l}-${r} pad ${pl}-${pr}`);
      assert.ok(pl - rest[1] >= 16, 'visible pit before the pad');
    }
  }
  const course = LabCourse.practice('quiet'), state = newLabRun(-200);
  course.platforms.unshift([-260, -120, 'normal']);
  state.x = -200; const events = advanceLab(state, course, PERIOD, true);
  assert.equal(events[0].type, 'dock'); assert.equal(state.x, 0);
});

test('filler keeps v4 reachability and both gates alternate in a fixed order', () => {
  for (let seed = 1; seed <= 64; seed++) {
    const course = new LabCourse(seed, 'rules'); course.extendTo(20000);
    assert.deepEqual(course.gates.slice(0, 4).map(g => g.id), ['quiet', 'rush', 'quiet', 'rush']);
    for (let i = 1; i < course.platforms.length; i++) {
      const prev = course.platforms[i - 1], next = course.platforms[i];
      assert.ok(next[0] - prev[1] >= 16, `seed ${seed}: pit ${next[0] - prev[1]}`);
      if (next[2] === 'normal' && prev[2] === 'normal') {
        const [a, b] = ensureNextHopMargin(prev, [next[0], next[1]]);
        assert.ok(a === next[0] && b === next[1], `seed ${seed}: filler platform ${i} needs widening`);
      }
    }
  }
});

test('base experiment is the unchanged v4 course', async () => {
  const { Terrain } = await import('../public/src/engine.mjs');
  const a = new LabCourse(42, 'base'), b = new Terrain(42);
  assert.deepEqual(a.platforms.map(p => [p[0], p[1]]), b.platforms);
  assert.equal(GRACE, .12); assert.equal(INSET, 8);
});
