import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PERIOD as BEAT, SLOW_SPEED, FAST_SPEED } from '../public/src/engine.mjs';
import { COURSE, STATIONS, platformAt, stationAt, bobAt, handFlat, toothUp, BOOST, GEAR_REACH } from '../public/src/tower/course.mjs';
import { newRun, runFrom, advance, supports, cloneRun, ASSIST_FAILS } from '../public/src/tower/sim.mjs';
import { towerBar, heartBar, LAYERS, CARD_BAR, BAR } from '../public/src/tower/music.mjs';
import { playHop, solve, HOLDS } from './helpers/tower-solver.mjs';

const CALM = [[.25, .5], [0, 0], [.5, .75], [0, .5], [.25, 1], [0, 1], [0, .25], [.75, 1], [.25, .75], [.5, 1], [0, .75]];
const cpOf = id => COURSE.checkpoints.findIndex(c => COURSE.stations[c.station].id === id);

test('the course is sorted, every station once and in order, every lantern on ground', () => {
  let last = -1;
  for (const p of COURSE.platforms) { assert.ok(p.a >= last - 1e-9, `overlap at ${p.a}`); assert.ok(p.b > p.a); last = p.b; }
  assert.deepEqual(COURSE.stations.map(s => s.id), [...STATIONS]);
  for (const cp of COURSE.checkpoints) assert.equal(platformAt(cp.x)?.kind, 'plain', `lantern at ${cp.x} stands on plain ground`);
  assert.equal(COURSE.gears.length, 12, 'one gear for each hour on the face');
});
test('the whole tower can be climbed to the bell, in about two minutes without a mistake', () => {
  const { path, run } = solve(COURSE, newRun(), { order: CALM, maxHops: 600 });
  assert.ok(path, 'a path exists');
  assert.equal(run.status, 'docked');
  const seconds = path.length * BEAT;
  assert.ok(seconds > 100 && seconds < 240, `clean climb ${seconds}s`);
});
test('from every lantern, on any beat of four, the next lantern can be reached', () => {
  for (let i = 0; i < COURSE.checkpoints.length; i++) {
    const target = i + 1 < COURSE.checkpoints.length ? COURSE.checkpoints[i + 1].from : null;
    for (let beat = 0; beat < 4; beat++) {
      const { path } = solve(COURSE, runFrom(COURSE, i, { beat }), { stopAt: target, maxHops: 80 });
      assert.ok(path, `lantern ${i} (${COURSE.stations[COURSE.checkpoints[i].station].id}) on beat ${beat}`);
    }
  }
});
test('a lantern gives two landings with no input, and a FAST still held lands on it too', () => {
  for (let i = 1; i < COURSE.checkpoints.length; i++) {
    for (const plan of [[0, 0], [0, 1]]) {
      const run = runFrom(COURSE, i); playHop(run, COURSE, plan);
      assert.equal(run.status, 'playing', `lantern ${i}, plan ${plan}`);
      if (plan[1] === 0) { playHop(run, COURSE, plan); assert.equal(run.status, 'playing', `lantern ${i} second SLOW`); }
    }
  }
});
test('every room asks for something: holding one input all the way through fails', () => {
  for (const id of ['pendulum', 'teeth', 'spring', 'sand', 'hands', 'machine']) {
    for (const plan of [[0, 0], [0, 1]]) {
      const run = runFrom(COURSE, cpOf(id)), end = COURSE.stations.find(s => s.id === id).to;
      let n = 0; while (run.status === 'playing' && run.x < end && n++ < 200) playHop(run, COURSE, plan);
      assert.ok(run.status !== 'playing' || run.x < end, `${id} with ${plan} should not pass on its own`);
    }
  }
});
test('teeth: gold stands on even beats, silver on odd ones', () => {
  const tick = COURSE.platforms.find(p => p.kind === 'tick'), tock = COURSE.platforms.find(p => p.kind === 'tock');
  assert.ok(toothUp(tick, 0) && !toothUp(tick, 1) && toothUp(tock, 1) && !toothUp(tock, 2));
  const run = newRun(), mid = (tick.a + tick.b) / 2; run.hopStartX = tock.a + 5;
  assert.ok(supports(run, COURSE, mid, 4)); assert.equal(supports(run, COURSE, mid, 5), null);
  // From outside the run of teeth, the first landing always holds and sets the phase.
  const fresh = runFrom(COURSE, cpOf('teeth'), { beat: 1 });
  while (fresh.x < tick.a) playHop(fresh, COURSE, [0, 0]);
  assert.equal(fresh.status, 'playing'); assert.ok(toothUp(platformAt(fresh.x), fresh.beat, fresh.tick));
});
test('a clock hand is a bridge only on its own beat of four', () => {
  const hand = COURSE.platforms.find(p => p.kind === 'hand'), run = newRun(), mid = (hand.a + hand.b) / 2;
  const flat = [0, 1, 2, 3].filter(b => handFlat(hand, b));
  assert.equal(flat.length, 1);
  for (let b = 0; b < 8; b++) assert.equal(!!supports(run, COURSE, mid, b), handFlat(hand, b));
});
test('a backward cog: SLOW hops on the spot, FAST goes on by the difference', () => {
  const cog = COURSE.platforms.find(p => p.kind === 'cog'), run = newRun(); run.x = run.hopStartX = cog.a + 20 - SLOW_SPEED * BEAT;
  advance(run, COURSE, BEAT, false); assert.equal(run.cog, true);
  const at = run.x; advance(run, COURSE, 2 * BEAT, false); assert.ok(Math.abs(run.x - at) < 1e-6, 'SLOW stays put');
  advance(run, COURSE, 3 * BEAT, true); assert.ok(Math.abs(run.x - at - (FAST_SPEED - SLOW_SPEED) * BEAT) < 1e-6, 'FAST goes on');
  for (const hand of COURSE.platforms.filter(p => p.kind === 'hand')) assert.equal(COURSE.platforms[hand.i - 1].kind, 'cog', 'every hand has a cog before it');
  // FAST on four reaches the hand from anywhere on the cog, so the lamps never lie.
  for (const c of COURSE.platforms.filter(p => p.kind === 'cog')) for (const x of [c.a + .5, c.b - .5]) assert.equal(platformAt(x + (FAST_SPEED - SLOW_SPEED) * BEAT)?.kind, 'hand', `cog at ${c.a}, from ${x}`);
});
test('sand holds one landing: a second on the same slab falls', () => {
  const sand = COURSE.platforms.find(p => p.kind === 'sand' && p.b - p.a >= 2 * SLOW_SPEED * BEAT + 20);
  const run = newRun(); run.x = run.hopStartX = sand.a + 12; run.stationId = 'sand';
  advance(run, COURSE, BEAT, false);
  assert.equal(run.status, 'falling'); assert.equal(run.fallKind, 'sand');
});
test('a mainspring makes the next hop 1.8 times as long, and only that one', () => {
  const coil = COURSE.platforms.find(p => p.kind === 'spring');
  const run = newRun(); run.x = run.hopStartX = coil.a + 30 - SLOW_SPEED * BEAT;
  advance(run, COURSE, BEAT, false); assert.equal(run.boost, true);
  const from = run.x; advance(run, COURSE, 2 * BEAT, true);
  assert.ok(Math.abs(run.x - from - FAST_SPEED * BEAT * BOOST) < 1e-6);
});
test('a pendulum knocks the hero off and sends it back to the lantern', () => {
  const run = runFrom(COURSE, cpOf('pendulum')); let n = 0;
  while (run.status === 'playing' && n++ < 40) playHop(run, COURSE, [0, 0]);
  assert.equal(run.status, 'falling'); assert.equal(run.fallKind, 'hit');
  const events = []; advance(run, COURSE, (run.beat + 3) * BEAT, false, events);
  assert.ok(events.some(e => e.type === 'respawn'));
  assert.equal(run.status, 'playing');
});
test('after three falls at one lantern the mechanisms wait for the player', () => {
  // The help lasts until the next lantern, for every room with a mechanism.
  // Sand: a used slab holds again. Gaps between slabs stay gaps.
  const sand = COURSE.platforms.find(p => p.kind === 'sand'), helped = runFrom(COURSE, cpOf('sand'));
  helped.sandUsed = [sand.i]; assert.equal(supports(helped, COURSE, sand.a + 30, 0), null);
  helped.fails[helped.checkpoint] = ASSIST_FAILS; assert.ok(supports(helped, COURSE, sand.a + 30, 0));
  for (const id of ['teeth', 'hands']) {
    const i = cpOf(id), run = runFrom(COURSE, i); run.fails[i] = ASSIST_FAILS;
    let n = 0; const end = COURSE.checkpoints[i + 1].from;
    while (run.status === 'playing' && run.x < end && n++ < 200) playHop(run, COURSE, [0, .5]);
    assert.equal(run.status, 'playing', id);
  }
});
test('every gear can be reached by some climb from its room', () => {
  COURSE.gears.forEach((gear, i) => {
    const st = stationAt(gear.x), cp = COURSE.checkpoints.filter(c => c.x <= gear.x - 40).at(-1);
    const start = runFrom(COURSE, COURSE.checkpoints.indexOf(cp));
    // Search for a hop that passes the gear's x with the antennas high.
    const seen = new Set(), stack = [cloneRun(start)];
    let got = false;
    while (stack.length && !got) {
      const run = stack.pop();
      for (const plan of HOLDS) {
        const next = cloneRun(run); playHop(next, COURSE, plan);
        if (next.gears.includes(i)) { got = true; break; }
        if (next.status !== 'playing' || next.x > gear.x + 260) continue;
        const key = Math.round(next.x / 4) + ':' + next.beat % 4 + ':' + next.boost + ':' + next.sandUsed.join(',') + ':' + next.tick;
        if (!seen.has(key)) { seen.add(key); stack.push(next); }
      }
    }
    assert.ok(got, `gear ${i} at ${gear.x} in ${st.id}`);
  });
});
test('the hop and the beat are the game\'s own', () => {
  const run = newRun(); advance(run, COURSE, BEAT, false);
  assert.ok(Math.abs(run.x - (COURSE.start + SLOW_SPEED * BEAT)) < 1e-9); assert.equal(run.beat, 1);
  const p = COURSE.pendulums[0], b = bobAt(p, 0);
  assert.ok(Number.isFinite(b.x) && b.y > 0);
});
test('music: each room adds a voice; the morning ends quietly on the card', () => {
  const counts = LAYERS.map((_, level) => towerBar(0, level).length);
  for (let i = 1; i < counts.length; i++) assert.ok(counts[i] >= counts[i - 1], `level ${i}`);
  for (const n of towerBar(3, 7)) assert.ok(n.t >= 0 && n.t < BAR, 'inside its bar');
  assert.ok(heartBar(CARD_BAR).every(n => n.part === 'pad' || n.part === 'harp'));
  assert.deepEqual(heartBar(-1), []);
});
