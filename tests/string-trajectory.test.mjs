import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PERIOD, SLOW_SPEED, FAST_SPEED, COURSE_VERSION } from '../public/src/engine.mjs';
import { drawPod } from '../public/src/pod.mjs';
import {
  LAB, STAGES, EARLY, LATE, CONTACT_WINDOW, stageById, newAttempt, advanceAttempt,
  simulate, judge, feetY, podTopY, landingPx
} from '../public/dev/string-trajectory.mjs';

const FLAG_LANDING = LAB.startX + PERIOD / 2 * (SLOW_SPEED + FAST_SPEED);
const near = (actual, expected, epsilon = 1e-7) =>
  assert.ok(Math.abs(actual - expected) <= epsilon, actual + ' is not near ' + expected);

function spriteTop(phase) {
  let top = Infinity, scale = 1;
  const stub = new Proxy({}, {
    get(_, name) {
      if (name === 'scale') return s => { scale = s; };
      if (name === 'fillRect') return (x, y) => { top = Math.min(top, y * scale); };
      return () => {};
    },
    set() { return true; }
  });
  drawPod(stub, 0, 0, 2, { phase });
  return top;
}

test('the two plans use the same FAST time and land together, with opposite sounds', () => {
  const stage = stageById('far-ring');
  const early = simulate(stage, [EARLY]), late = simulate(stage, [LATE]);
  near(early.fastSeconds, PERIOD / 2);
  near(late.fastSeconds, PERIOD / 2);
  near(early.x, FLAG_LANDING);
  near(late.x, FLAG_LANDING);
  assert.equal(early.strings[0].touched, true);
  assert.equal(late.strings[0].touched, false);
  assert.deepEqual(early.events.map(e => e.type), ['note', 'land', 'finish']);
  assert.deepEqual(late.events.map(e => e.type), ['passed', 'land', 'finish']);
});

test('a near string inverts the rule: rushing misses it, waiting rings it', () => {
  const stage = stageById('near-ring');
  assert.equal(simulate(stage, [EARLY]).strings[0].touched, false);
  assert.equal(simulate(stage, [LATE]).strings[0].touched, true);
  assert.equal(judge(simulate(stage, [EARLY])).ok, false);
  assert.equal(judge(simulate(stage, [LATE])).ok, true);
});

test('every stage is solved by its own demo', () => {
  for (const stage of STAGES) {
    if (stage.id === 'near-ring') continue; // its first demo is the deliberate miss
    for (const plan of stage.demos) {
      const result = simulate(stage, plan);
      assert.equal(result.status, 'landed', stage.id);
      assert.equal(judge(result).ok, true, stage.id);
    }
  }
});


// Every one-press program in 10ms steps: input-space coverage, not a human clear rate.
function onePressPrograms(stage, visit) {
  for (let on = 0; on <= 78; on++) {
    for (let off = on; off <= 78; off++) {
      const run = simulate(stage, [[on / 100, off / 100]]);
      visit(run, judge(run), on / 100, off / 100);
    }
  }
}

test('stage 2 spec: x<173 fails, 173<=x<189 is a quiet clear, x>=189 is the full pass', () => {
  const under = stageById('far-silent');
  assert.deepEqual(under.platforms[1], [165, 315]);
  assert.equal(under.fullPassX, 189);

  const counts = { programs: 0, quiet: 0, through: 0 };
  onePressPrograms(under, (run, verdict) => {
    counts.programs++;
    const silent = !run.strings[0].touched;
    const safe = run.status === 'landed';
    const expected = !silent || !safe || run.x < 173 ? undefined : run.x < 189 ? 'quiet' : 'through';
    assert.equal(verdict.tier, expected, 'x=' + run.x);
    assert.equal(verdict.ok, expected !== undefined, 'x=' + run.x);
    if (run.x < 173) assert.equal(safe, false, 'x<173 is never a safe landing: ' + run.x);
    if (expected) {
      counts[expected]++;
      assert.equal(expected === 'through', run.strings[0].passed, 'the antennas left the string x=' + run.x);
    }
  });
  assert.deepEqual(counts, { programs: 3160, quiet: 579, through: 351 });
  assert.equal(judge(simulate(under, [[0, 0]])).ok, false, 'all-SLOW falls short');
  assert.equal(judge(simulate(under, [EARLY])).ok, false, 'the early demo rings');
  assert.equal(judge(simulate(under, [LATE])).tier, 'through', 'the demo shows the optional goal');
});

test('stage 2 tiers: the boundaries themselves, and the wrong-string or fall cases have no tier', () => {
  const under = stageById('far-silent');
  const clear = x => judge({ stage: under, status: 'landed', x, strings: [{ touched: false }] }).tier;
  assert.equal(clear(173), 'quiet');
  assert.equal(clear(188.999), 'quiet');
  assert.equal(clear(189), 'through');
  assert.equal(judge({ stage: under, status: 'landed', x: 200, strings: [{ touched: true }] }).tier, undefined);
  assert.equal(judge({ stage: under, status: 'fall', miss: 'short', x: 172.9, strings: [{ touched: false }] }).tier, undefined);
});

test('stage 2 display: the number shown never contradicts the tier', () => {
  const under = stageById('far-silent');
  assert.equal(landingPx(under, 188.6), 188, 'must not round up into the full-pass range');
  onePressPrograms(under, (run, verdict) => {
    if (verdict.ok) assert.equal(landingPx(under, run.x) >= 189, verdict.tier === 'through', 'x=' + run.x);
  });
  assert.equal(landingPx(stageById('far-ring'), 221.6), 222, 'other stages keep rounding');
});

test('a short early press alone earns the quiet clear: clearing stage 2 does not prove late FAST', () => {
  const under = stageById('far-silent');
  for (const program of [[0, .1], [.05, .15], [0, .15], [.1, .2]]) {
    const run = simulate(under, [program]);
    assert.equal(run.strings[0].touched, false, program);
    assert.equal(judge(run).tier, 'quiet', program);
  }
  assert.equal(judge(simulate(under, [[0, .09]])).reason, 'short', '0.09s does not reach the pad');
  assert.equal(judge(simulate(under, [[0, .2]])).reason, 'wrong-string', 'a longer early press rings');

  // The optional goal is where late FAST is really required.
  let earliestOn = Infinity, earliestOff = Infinity;
  onePressPrograms(under, (run, verdict, on, off) => {
    if (verdict.tier !== 'through') return;
    earliestOn = Math.min(earliestOn, on);
    earliestOff = Math.min(earliestOff, off);
  });
  assert.ok(earliestOn > .32, 'full pass press starts after 0.32s: ' + earliestOn);
  assert.ok(earliestOff > CONTACT_WINDOW[1], 'full pass press outlasts the contact window: ' + earliestOff);
});

test('the stage 2 change leaves stages 1, 3, 4 and 5 and the contact rule alone', () => {
  const pad = [183, 272];
  for (const id of ['far-ring', 'near-ring', 'flag']) assert.deepEqual(stageById(id).platforms[1], pad, id);
  assert.deepEqual(stageById('far-ring').strings[0].x, 173);
  assert.deepEqual(stageById('near-ring').strings[0].x, 125);
  assert.deepEqual(stageById('flag').strings[0].x, 173);
  assert.deepEqual(stageById('phrase').platforms.slice(1), [pad, [325, 415], [470, 560], [620, 760]]);
  assert.deepEqual(stageById('phrase').strings.map(s => s.x), [173, 319, 417, 611]);
  assert.deepEqual(stageById('far-silent').strings[0].x, 173);
  assert.equal(LAB.antennaReach, 16);
  assert.equal(LAB.stringBottomY, 228);

  const clears = id => { let n = 0; onePressPrograms(stageById(id), (run, v) => { assert.equal(v.tier, undefined); if (v.ok) n++; }); return n; };
  assert.deepEqual([clears('far-ring'), clears('near-ring'), clears('flag')].map(n => +(100 * n / 3160).toFixed(1)), [40.5, 42.8, 19.0]);
});

test('the flag asks for the same spot with either sound', () => {
  const stage = stageById('flag');
  const early = simulate(stage, [EARLY]), late = simulate(stage, [LATE]);
  assert.equal(judge(early).ok, true);
  assert.equal(judge(late).ok, true);
  assert.notEqual(early.strings[0].touched, late.strings[0].touched);
  const wide = simulate(stage, [[0, .5]]);
  assert.equal(wide.status, 'landed');
  assert.equal(judge(wide).reason, 'off-flag');
});

test('results do not depend on the integration step', () => {
  for (const stage of STAGES) {
    for (const plan of stage.demos) {
      const baseline = simulate(stage, plan);
      for (const slice of [PERIOD / 7, 1 / 23, 1 / 30, 1 / 60, 1 / 144]) {
        const actual = simulate(stage, plan, slice);
        near(actual.x, baseline.x, 1e-6);
        assert.equal(actual.status, baseline.status);
        assert.deepEqual(actual.strings.map(s => s.touched), baseline.strings.map(s => s.touched));
        actual.strings.forEach((s, i) => {
          if (s.time !== null) near(s.time, baseline.strings[i].time, 1e-6);
        });
      }
    }
  }
});

// An independent, dense sampler of the picture: does the drawn antenna pair
// overlap the drawn lower tip at any moment? The sound must agree with it.
test('the sound agrees with what is drawn, over the whole one-press input space', () => {
  for (const stage of [stageById('far-ring'), stageById('near-ring')]) {
    const string = stage.strings[0];
    for (let on = 0; on <= PERIOD; on += .03) {
      for (let off = on; off <= PERIOD + 1e-9; off += .03) {
        const result = simulate(stage, [[on, off]]);
        let drawnContact = false;
        for (let i = 0; i <= 3000 && !drawnContact; i++) {
          const t = PERIOD * i / 3000;
          const x = LAB.startX + SLOW_SPEED * t +
            (FAST_SPEED - SLOW_SPEED) * Math.max(0, Math.min(t, off) - Math.min(t, on));
          drawnContact = Math.abs(x - string.x) <= LAB.antennaReach && podTopY(t) <= LAB.stringBottomY;
        }
        assert.equal(result.strings[0].touched, drawnContact, stage.id + ' on=' + on + ' off=' + off);
      }
    }
  }
});

test('the contact model matches the real sprite and production hop', () => {
  for (const phase of [0, .25, .5, .75, 1]) {
    const modelled = podTopY(phase * PERIOD) - feetY(phase * PERIOD);
    assert.ok(Math.abs(modelled - spriteTop(phase)) <= 2, 'phase ' + phase + ': ' + modelled + ' vs ' + spriteTop(phase));
  }
  const app = readFileSync(new URL('../public/src/app.mjs', import.meta.url), 'utf8');
  assert.match(app, /FLOOR = 382/);
  assert.match(app, /Math\.PI\) \* 96/);
  assert.match(app, /FLOOR - 2 - height/);
  assert.equal(LAB.floorY, 382);
  assert.equal(LAB.hopHeight, 96);
});

test('falling is told apart from a safe landing, with the direction of the miss', () => {
  const stage = stageById('far-ring');
  for (const [fast, miss] of [[false, 'short'], [true, 'far']]) {
    const run = newAttempt(stage);
    const events = advanceAttempt(run, PERIOD, fast);
    assert.equal(run.status, 'fall');
    assert.equal(events.at(-1).type, 'fall');
    assert.equal(judge(run).reason, miss);
  }
});

function jitterRate(stage, plan, jitter, samples = 400) {
  let seed = 12345, wins = 0;
  const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  for (let i = 0; i < samples; i++) {
    const noisy = plan.map(([on, off]) => {
      const a = on === 0 ? 0 : on + (random() * 2 - 1) * jitter;
      const b = off >= PERIOD ? PERIOD : off + (random() * 2 - 1) * jitter;
      return [Math.max(0, a), Math.max(a, b)];
    });
    if (judge(simulate(stage, noisy)).ok) wins++;
  }
  return wins / samples;
}

test('human-sized timing error still clears each stage, and the stages ramp up', () => {
  const rate = (id, plan, jitter = .05) => jitterRate(stageById(id), plan, jitter);
  assert.equal(rate('far-ring', [EARLY]), 1);
  assert.equal(rate('far-silent', [LATE]), 1);
  assert.equal(rate('near-ring', [LATE]), 1);
  const flagRing = rate('flag', [EARLY]), flagSilent = rate('flag', [LATE]);
  assert.ok(flagRing > .9 && flagSilent > .9, flagRing + ' / ' + flagSilent);
  const phrase = rate('phrase', stageById('phrase').demos[0]);
  assert.ok(phrase >= .5, 'phrase rate ' + phrase);
  assert.ok(phrase < 1, 'phrase should still ask for some care');
});

test('the contact window sits around the apex', () => {
  assert.ok(CONTACT_WINDOW[0] > .2 && CONTACT_WINDOW[0] < PERIOD / 2);
  near(CONTACT_WINDOW[0] + CONTACT_WINDOW[1], PERIOD);
  near(podTopY(CONTACT_WINDOW[0]), LAB.stringBottomY);
});

test('lab uses unchanged production motion constants', () => {
  assert.equal(PERIOD, .78);
  assert.equal(SLOW_SPEED, 105);
  assert.equal(FAST_SPEED, 270);
  assert.equal(COURSE_VERSION, 4);
});
