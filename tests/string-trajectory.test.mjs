import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PERIOD, SLOW_SPEED, FAST_SPEED, COURSE_VERSION } from '../public/src/engine.mjs';
import { drawPod } from '../public/src/pod.mjs';
import {
  LAB, STAGES, EARLY, LATE, CONTACT_WINDOW, stageById, newAttempt, advanceAttempt,
  simulate, judge, feetY, podTopY
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


test('stage 2 gives a wide landing pad for silent discovery without changing the later precision flag', () => {
  const under = stageById('far-silent');
  const flag = stageById('flag');
  assert.deepEqual(under.platforms[1], [155, 315]);
  assert.deepEqual(flag.platforms[1], [183, 272]);
  assert.equal(judge(simulate(under, [LATE])).ok, true);
  assert.equal(judge(simulate(under, [EARLY])).ok, false);
  assert.equal(judge(simulate(under, [[0, 0]])).ok, false, 'permanent SLOW cannot cross the wider pad safely');

  // Same 10ms press/release sampling as the study note; this is a proportion of
  // possible one-press input programs, not an estimate of human clear rate.
  let before = 0, after = 0, programs = 0;
  const original = { ...under, platforms: [under.platforms[0], flag.platforms[1]] };
  for (let on = 0; on <= 78; on++) {
    for (let off = on; off <= 78; off++) {
      const program = [[on / 100, off / 100]];
      programs++;
      if (judge(simulate(original, program)).ok) before++;
      if (judge(simulate(under, program)).ok) after++;
    }
  }
  const oldFraction = before / programs;
  const newFraction = after / programs;
  assert.ok(oldFraction > .095 && oldFraction < .11, 'old success space: ' + oldFraction);
  assert.ok(newFraction > .40 && newFraction < .46, 'new success space: ' + newFraction);
  assert.ok(newFraction >= 3.5 * oldFraction, 'expanded input tolerance');
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
