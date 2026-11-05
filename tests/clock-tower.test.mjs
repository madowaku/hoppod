import test from 'node:test';
import assert from 'node:assert/strict';
import { PERIOD, SLOW_SPEED, FAST_SPEED, footing, COURSE_VERSION } from '../public/src/engine.mjs';
import { LAB, feetY, podTopY } from '../public/dev/string-trajectory.mjs';
import {
  COURSE, TOWER, FIRST_SAVE, newAttempt, advanceAttempt, advanceWithPlan, simulate, judge, bobAt, swingAngle, palletSpan, revival
} from '../public/dev/clock-tower-model.mjs';

const near = (actual, expected, epsilon = 1e-6) =>
  assert.ok(Math.abs(actual - expected) <= epsilon, actual + ' is not near ' + expected);
const WAIT_THEN_HOLD = [.28, .78];
const HOPS = 13;
const rhythm = (interval, hops = HOPS) => Array.from({ length: hops }, () => interval);
const saveAt = checkpoint => ({ checkpoint, time: COURSE.checkpoints[checkpoint].platform * PERIOD, collected: [] });

// One hop from any state, for exhaustive searches.
function hop(x, time, on, off, gears = COURSE.gears.map(() => false), pallets = COURSE.pallets.map(() => false)) {
  const run = {
    course: COURSE, save: { checkpoint: 99, time: 0, collected: [] }, x, hopStartX: x, phase: 0, time, hops: 0,
    fastSeconds: 0, status: 'playing', miss: null, hitBy: null, segments: [], gears: [...gears], pallets: [...pallets]
  };
  if (on > 0) advanceAttempt(run, on, false);
  if (off > on) advanceAttempt(run, off - on, true);
  if (off < PERIOD) advanceAttempt(run, PERIOD - off, false);
  return run;
}
function onePress(step, visit) {
  for (let on = 0; on <= 78; on += step) for (let off = on; off <= 78; off += step) visit(on / 100, off / 100);
}

test('geometry: a slow hop always leaves a platform and the fastest never skips one', () => {
  const slow = SLOW_SPEED * PERIOD, fast = FAST_SPEED * PERIOD;
  for (let i = 1; i < COURSE.platforms.length - 1; i++) {
    const [left, right] = footing(COURSE.platforms[i]);
    assert.ok(left + slow > right, 'platform ' + i + ' cannot be hopped on twice');
    const skip = COURSE.platforms[i + 2];
    if (skip) assert.ok(right + fast < footing(skip)[0], 'platform ' + (i + 2) + ' cannot be reached from ' + i);
    const [nextLeft, nextRight] = footing(COURSE.platforms[i + 1]);
    assert.ok(left + fast >= nextLeft, 'the next platform is in reach from the left edge of ' + i);
    assert.ok(right + slow <= nextRight, 'the next platform is not overshot by a slow hop from ' + i);
  }
  assert.equal(COURSE.platforms.length, 14);
});

test('pendulums are locked to the beat: one full swing every two hops', () => {
  for (const pendulum of COURSE.pendulums) {
    near(swingAngle(pendulum, .3), swingAngle(pendulum, .3 + TOWER.swingBeats * PERIOD));
    near(swingAngle(pendulum, .3), -swingAngle(pendulum, .3 + PERIOD));
    const at = bobAt(pendulum, .1);
    near(Math.hypot(at.x - pendulum.x, at.y - TOWER.pivotY), pendulum.length);
  }
});

test('the clear asks for one rhythm: wait, then hold until landing, from every room', () => {
  const whole = simulate(COURSE, rhythm(WAIT_THEN_HOLD));
  assert.equal(whole.status, 'rang');
  assert.equal(judge(whole).ok, true);
  assert.equal(whole.hops, HOPS);
  for (const checkpoint of [1, 2, 3]) {
    const left = HOPS - COURSE.checkpoints[checkpoint].platform;
    const run = simulate(COURSE, rhythm(WAIT_THEN_HOLD, left), { save: saveAt(checkpoint) });
    assert.equal(judge(run).ok, true, 'room ' + (checkpoint + 1));
  }
});

test('the pendulums are not decoration: pressing right after take-off runs into one', () => {
  for (const length of [.5, .54, .58]) {
    const run = simulate(COURSE, rhythm([0, length]));
    assert.equal(run.status, 'hit', 'length ' + length);
  }
});

test('the clear is flying into the bell: a landing below it is not the end, and every arrival strikes it', () => {
  const run = simulate(COURSE, rhythm(WAIT_THEN_HOLD));
  const types = run.events.map(event => event.type);
  assert.equal(types.at(-1), 'ring');
  assert.equal(types.at(-2), 'land', 'the strike comes after a landing, in the next hop');
  assert.ok(run.events.at(-1).y <= TOWER.bellBottomY, 'it happens in the air, at the mouth');
  const [a, b] = footing(COURSE.platforms.at(-1));
  const farthest = footing(COURSE.platforms.at(-2))[1] + FAST_SPEED * PERIOD;
  assert.ok(farthest < b, 'the last platform is under every landing');
  for (let x = a; x <= farthest; x += 3) {
    onePress(6, (on, off) => {
      const after = hop(x, HOPS * PERIOD, on, off);
      assert.equal(after.status, 'rang', 'one hop from x=' + x + ' on=' + on + ' off=' + off);
    });
  }
});

test('going past an unturned gear is told once, and a resume does not repeat old ones', () => {
  const run = simulate(COURSE, rhythm(WAIT_THEN_HOLD));
  const missed = run.events.filter(event => event.type === 'gearMissed').map(event => event.gear);
  const turned = run.events.filter(event => event.type === 'gear').map(event => event.gear);
  assert.deepEqual([...missed, ...turned].sort(), [0, 1, 2], 'each gear is either turned or missed');
  assert.equal(simulate(COURSE, COURSE.demos.full).events.filter(event => event.type === 'gearMissed').length, 0);
  const resumed = simulate(COURSE, rhythm(WAIT_THEN_HOLD, 4), { save: saveAt(2) });
  assert.ok(resumed.events.filter(event => event.type === 'gearMissed').every(event => event.gear === 2));
});

// The tail of a hop plan through the chamber, from the room's spawn: short, long, short, leave.
const CHAMBER = [[0, .27], [0, .78], [0, .23], [0, .5]];
const chamberSave = collected => ({ checkpoint: 3, time: 9 * PERIOD, collected });
const teeth = run => run.pallets.filter(Boolean).length;

test('the escapement asks for two flights: the constant rhythm stands on only the far pallet', () => {
  const run = simulate(COURSE, rhythm(WAIT_THEN_HOLD));
  assert.deepEqual(run.pallets, [false, true, false]);
  assert.deepEqual(run.events.filter(e => e.type === 'palletMissed').map(e => e.want), ['shorter', 'shorter']);
  for (const length of [.3, .4, .5, .6, .7]) {
    const held = simulate(COURSE, rhythm([.2, .2 + length], 4), { save: chamberSave([]) });
    assert.ok(teeth(held) < 3, 'one length, ' + length + ', cannot turn the wheel fully');
  }
  const full = simulate(COURSE, COURSE.demos.full);
  assert.deepEqual(full.pallets, [true, true, true]);
});

test('holding a whole hop from any near pallet always reaches the far one', () => {
  const [from, to] = palletSpan(COURSE, 0);
  for (let x = from; x <= to; x += 1) {
    const run = hop(x, 11 * PERIOD, 0, PERIOD);
    assert.equal(run.status, 'playing');
    assert.equal(run.pallets[1], true, 'from x=' + x);
  }
});

test('the wheel wakes one missed gear, only when it comes all the way round', () => {
  const two = simulate(COURSE, CHAMBER, { save: chamberSave([0, 1]) });
  assert.deepEqual(two.gears, [true, true, true], 'two gears and the wheel make the full result');
  assert.equal(judge(two).tier, 'full');
  assert.equal(two.events.find(e => e.type === 'wheelDriven').woke, 2);
  const one = simulate(COURSE, CHAMBER, { save: chamberSave([1]) });
  assert.equal(judge(one).tier, 'clear', 'it wakes one gear, not all of them');
  assert.deepEqual(one.gears, [true, true, false]);
  const all = simulate(COURSE, CHAMBER, { save: chamberSave([0, 1, 2]) });
  assert.equal(all.events.find(e => e.type === 'wheelDriven').woke, null);
  const partial = simulate(COURSE, [[0, .27], [0, .5], [0, .5], [0, .5]], { save: chamberSave([0, 1]) });
  assert.equal(judge(partial).ok, true);
  assert.ok(teeth(partial) < 3);
  assert.deepEqual(partial.gears, [true, true, false], 'a part-turned wheel wakes nothing');
});

test('the chamber can be played with human-sized error, and leaving it alone costs nothing', () => {
  let seed = 19, wins = 0, safe = 0;
  const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  for (let i = 0; i < 400; i++) {
    const noisy = CHAMBER.map(([on, off]) => {
      const a = on === 0 ? 0 : on + (random() * 2 - 1) * .05;
      return [a, Math.max(a, Math.min(PERIOD, off + (random() * 2 - 1) * .05))];
    });
    const run = simulate(COURSE, noisy, { save: chamberSave([]) });
    if (teeth(run) === 3) wins++;
    if (run.status === 'rang') safe++;
  }
  assert.ok(wins / 400 >= .8, 'all three teeth: ' + wins / 400);
  assert.ok(safe / 400 >= .8, 'reaches the bell: ' + safe / 400);
  const plain = simulate(COURSE, rhythm(WAIT_THEN_HOLD, 4), { save: chamberSave([]) });
  assert.equal(plain.status, 'rang');
});

test('every clear brings the tower to life, and what shows inside follows the journey', () => {
  const clear = revival(simulate(COURSE, COURSE.demos.clear));
  assert.equal(clear.inside, false);
  assert.equal(clear.wheel, false);
  assert.ok(clear.gears >= 1 && clear.teeth === 1);
  assert.deepEqual(revival(simulate(COURSE, COURSE.demos.full)), { gears: 3, teeth: 3, wheel: true, inside: true });
});

test('gears are optional: the clear never requires one, and only all of them make the full result', () => {
  const clear = simulate(COURSE, COURSE.demos.clear);
  assert.equal(judge(clear).tier, 'clear');
  assert.ok(clear.gears.includes(false));
  const full = simulate(COURSE, COURSE.demos.full);
  assert.equal(judge(full).tier, 'full');
  assert.deepEqual(full.gears, [true, true, true]);
  const landed = gears => judge({ status: 'rang', gears }).tier;
  assert.equal(landed([false, false, false]), 'clear');
  assert.equal(landed([true, true, false]), 'clear');
  assert.equal(landed([true, true, true]), 'full');
  assert.equal(judge({ status: 'hit', gears: [true, true, true] }).tier, null);
  assert.equal(judge({ status: 'fall', miss: 'short', gears: [true, true, true] }).ok, false);
});

test('a reachable state is never a dead end, and the full result stays reachable from the start', () => {
  const key = (x, got, teeth) => Math.round(x / 4) + '|' + got + '|' + teeth;
  const mask = gears => gears.reduce((m, on, i) => m | (on ? 1 << i : 0), 0);
  const nodes = new Map();
  const node = (x, got, teeth, beat) => {
    const id = key(x, got, teeth);
    if (!nodes.has(id)) nodes.set(id, { x, got, teeth, beat, out: [], clear: false, full: false, done: false });
    return nodes.get(id);
  };
  const queue = [node(75, 0, 0, 0)];
  const start = queue[0];
  while (queue.length) {
    const here = queue.pop();
    if (here.done) continue;
    here.done = true;
    onePress(6, (on, off) => {
      const gears = COURSE.gears.map((_, i) => Boolean(here.got & (1 << i)));
      const pallets = COURSE.pallets.map((_, i) => Boolean(here.teeth & (1 << i)));
      const run = hop(here.x, here.beat * PERIOD, on, off, gears, pallets);
      if (run.status === 'hit' || run.status === 'fall') return;
      const got = mask(run.gears);
      if (run.status === 'rang') { here.clear = true; if (got === 7) here.full = true; return; }
      const next = node(run.x, got, mask(run.pallets), here.beat + 1);
      assert.equal(next.beat, here.beat + 1, 'hop n happens on beat n');
      here.out.push(next);
      if (!next.done) queue.push(next);
    });
  }
  for (let changed = true; changed;) {
    changed = false;
    for (const n of nodes.values()) {
      if (!n.clear && n.out.some(m => m.clear)) { n.clear = true; changed = true; }
      if (!n.full && n.out.some(m => m.full)) { n.full = true; changed = true; }
    }
  }
  const stuck = [...nodes.values()].filter(n => !n.clear);
  assert.deepEqual(stuck.map(n => Math.round(n.x)), [], 'dead ends');
  assert.equal(start.full, true);
});

test('human-sized timing error, room by room: a band of late rhythms gets through', () => {
  const rooms = [[0, 3], [3, 6], [6, 9], [9, 13]];
  for (const pressAt of [.2, .24, .28, .32]) {
    for (const room of [0, 1, 2, 3]) {
      const hops = rooms[room][1] - rooms[room][0];
      let seed = 2024, wins = 0;
      const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
      for (let i = 0; i < 200; i++) {
        const plan = Array.from({ length: hops }, () => {
          const on = pressAt + (random() * 2 - 1) * .05;
          return [on, Math.min(PERIOD, on + .5 + (random() * 2 - 1) * .05)];
        });
        const run = newAttempt(COURSE, room ? saveAt(room) : FIRST_SAVE);
        advanceWithPlan(run, hops * PERIOD, plan);
        if (run.status !== 'hit' && run.status !== 'fall') wins++;
      }
      assert.ok(wins / 200 >= .9, `press at ${pressAt}, room ${room + 1}: ${wins / 200}`);
    }
  }
});

test('the two results are opposite flights: the late rhythm misses gears, the full route presses early', () => {
  const late = simulate(COURSE, rhythm(WAIT_THEN_HOLD));
  assert.equal(judge(late).tier, 'clear');
  assert.ok(COURSE.demos.full.filter(([on]) => on === 0).length >= 8, 'mostly pressed at take-off');
  const lengths = new Set(COURSE.demos.full.map(([on, off]) => +(off - on).toFixed(2)));
  assert.ok(lengths.size >= 4, 'and the length changes with each landing');
  let seed = 7, wins = 0;
  const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  for (let i = 0; i < 300; i++) {
    const noisy = COURSE.demos.full.map(([on, off]) => {
      const a = on === 0 ? 0 : on + (random() * 2 - 1) * .03;
      return [a, Math.max(a, off + (random() * 2 - 1) * .03)];
    });
    if (judge(simulate(COURSE, noisy)).tier === 'full') wins++;
  }
  assert.ok(wins / 300 >= .3, 'the full route can be played with practice: ' + wins / 300);
});

test('results do not depend on the render step', () => {
  for (const plan of [COURSE.demos.clear, COURSE.demos.full, rhythm([0, .54])]) {
    const baseline = simulate(COURSE, plan);
    for (const slice of [1 / 23, 1 / 30, 1 / 60, 1 / 144, PERIOD / 7]) {
      const actual = simulate(COURSE, plan, { maxSlice: slice });
      near(actual.x, baseline.x);
      assert.equal(actual.status, baseline.status);
      assert.equal(actual.hitBy, baseline.hitBy);
      assert.deepEqual(actual.gears, baseline.gears);
      assert.deepEqual(actual.pallets, baseline.pallets);
    }
  }
});

test('a hit is told apart from a fall, and a graze the player can see is forgiven', () => {
  const run = simulate(COURSE, rhythm([0, .54]));
  assert.equal(judge(run).reason, 'hit');
  assert.equal(typeof run.hitBy, 'number');
  assert.equal(run.events.at(-1).type, 'hit');
  assert.equal(judge(simulate(COURSE, rhythm([0, 0]))).reason, 'short');
  assert.ok(TOWER.bobHit < TOWER.bobDrawn);
  assert.ok(TOWER.podHalfWidth < LAB.antennaReach);
});

test('a save resumes on the same beat, keeps earlier gears and only moves forward', () => {
  const run = newAttempt(COURSE);
  assert.equal(run.save, FIRST_SAVE);
  const full = simulate(COURSE, COURSE.demos.full);
  const saves = full.events.filter(event => event.type === 'checkpoint').map(event => event.checkpoint);
  assert.deepEqual(saves, [1, 2, 3]);
  assert.equal(full.save.checkpoint, 3);
  assert.deepEqual(full.save.collected, [0, 1, 2]);
  near(full.save.time, 9 * PERIOD);
  const room3 = { checkpoint: 2, time: 6 * PERIOD, collected: [0, 1] };
  const resumed = newAttempt(COURSE, room3);
  assert.equal(resumed.x, COURSE.checkpoints[2].spawn);
  assert.deepEqual(resumed.gears, [true, true, false]);
  near(resumed.time, 6 * PERIOD);
  const finish = newAttempt(COURSE, room3);
  advanceWithPlan(finish, 8 * PERIOD, rhythm(WAIT_THEN_HOLD, 7));
  assert.equal(judge(finish).ok, true, 'the rhythm finishes from the resumed room');
  assert.deepEqual(finish.gears.slice(0, 2), [true, true]);
});

test('gears turn at the height a string rings; the contact is the antennas, the danger is the body', () => {
  assert.equal(TOWER.gearY, LAB.stringBottomY);
  assert.equal(TOWER.gearReach, LAB.antennaReach);
  assert.ok(podTopY(0) > TOWER.gearY, 'a gear cannot be turned from the ground');
  assert.ok(podTopY(PERIOD / 2) < TOWER.gearY, 'it can at the top of a hop');
  assert.ok(feetY(0) > feetY(PERIOD / 2));
});

test('lab uses unchanged production motion constants', () => {
  assert.equal(PERIOD, .78);
  assert.equal(SLOW_SPEED, 105);
  assert.equal(FAST_SPEED, 270);
  assert.equal(COURSE_VERSION, 4);
});
