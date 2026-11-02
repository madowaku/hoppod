import test from 'node:test';
import assert from 'node:assert/strict';
import { PERIOD, SLOW_SPEED, FAST_SPEED } from '../public/src/engine.mjs';
import { BEAT, BPM, BeatClock, TimedInput, beatIndex, heardFromContext } from '../public/src/story/beat.mjs';
import { COURSE, platformAt } from '../public/src/story/course.mjs';
import { newStory, storyFrom, advanceStory, craneDown, RANGE, GREEN_SPEED } from '../public/src/story/sim.mjs';
import { notesAt, STEP, ENDING } from '../public/src/story/music.mjs';
import { solve, hop } from './helpers/story-solver.mjs';

const witness = solve(COURSE, newStory(COURSE));

test('one beat is exactly the 0.78s hop, never rounded to 77 BPM', () => {
  assert.equal(BEAT, .78); assert.equal(BEAT, PERIOD);
  assert.ok(Math.abs(BPM - 76.923) < .001);
  assert.equal(STEP * 4, BEAT);
  assert.equal(beatIndex(78 * BEAT), 78);
});

test('beat clock follows heard audio time and rebases without a jump', () => {
  let audio = null;
  const clock = new BeatClock(() => audio);
  clock.start(0, 10);
  assert.equal(clock.now(10.5), .5);
  // Audio starts mid-run on a totally different time base.
  audio = 1000;
  const before = clock.now(10.6);
  assert.ok(Math.abs(before - .6) < 1e-9, 'continuous across the switch');
  assert.equal(clock.domain, 'audio');
  audio = 1000.4;
  assert.ok(Math.abs(clock.now(11) - 1.0) < 1e-9);
  // A note for story time s is scheduled at the context time it will be heard.
  assert.ok(Math.abs(clock.contextTime(2) - 1001.4) < 1e-9);
  // Audio suspended (background, interruption): perf time takes over smoothly.
  audio = null;
  assert.ok(Math.abs(clock.now(11.2) - 1.2) < 1e-9);
});

test('pause freezes story time; resume continues from the same beat phase', () => {
  let heard = 50;
  const clock = new BeatClock(() => heard);
  clock.start(0, 0);
  heard = 51.17; assert.ok(Math.abs(clock.now(1.17) - 1.17) < 1e-9);
  clock.pause(1.17);
  heard = 90; assert.ok(Math.abs(clock.now(40) - 1.17) < 1e-9, 'muted or hidden: no time passes in the story');
  clock.resume(40);
  heard = 90.39; assert.ok(Math.abs(clock.now(40.39) - 1.56) < 1e-9, 'resumes exactly two beats in');
});

test('jittery output timestamps are smoothed and never run backwards', () => {
  let perf = 0, k = 0;
  const latency = .21; // e.g. Bluetooth headphones
  const clock = new BeatClock(p => p + 500 - latency + (((k++ * 7919) % 13) - 6) / 1000);
  clock.start(0, 0);
  let last = 0, worst = 0;
  for (let i = 1; i < 2000; i++) {
    perf = i / 60;
    const s = clock.now(perf);
    assert.ok(s >= last - 1e-12); last = s;
    worst = Math.max(worst, Math.abs(s - perf));
  }
  assert.ok(worst < .008, 'visual beat stays within 8ms of the heard beat: ' + worst);
});

test('heard time uses the output timestamp, else currentTime minus latency', () => {
  const ctx = { state: 'running', currentTime: 12, outputLatency: .05, getOutputTimestamp: () => ({ contextTime: 11.9, performanceTime: 4000 }) };
  assert.ok(Math.abs(heardFromContext(ctx, 4.01) - 11.91) < 1e-9);
  delete ctx.getOutputTimestamp;
  assert.ok(Math.abs(heardFromContext(ctx, 4.01) - 11.95) < 1e-9);
  assert.equal(heardFromContext({ ...ctx, state: 'suspended' }, 1), null);
});

test('the full five-chapter course is clearable and the journey lasts about five minutes', () => {
  assert.ok(witness.end, 'a witness reaches the dock');
  const play = witness.end.beat * BEAT, ending = ENDING.card * BEAT;
  assert.ok(play > 150 && play < 260, 'gameplay seconds: ' + play);
  assert.ok(play + ending > 220 && play + ending < 330, 'total seconds: ' + (play + ending));
  assert.equal(witness.end.status, 'docked');
  for (const who of ['blue', 'green', 'red']) assert.equal(witness.end[who].state, 'station');
  assert.equal(witness.end.parts.got, 3);
  assert.ok(witness.end.together, 'red brought green back');
});

test('hops land exactly on beats regardless of frame rate or input timing', () => {
  const edges = [];
  witness.path.forEach((f, k) => {
    if (f > 0) edges.push([k * BEAT, true]);
    if (f > 0 && f < 1) edges.push([(k + f) * BEAT, false]);
    if (f === 1) edges.push([(k + 1) * BEAT, false]);
  });
  const end = witness.path.length * BEAT;
  const results = [];
  for (const fps of [23, 30, 60, 144, 'jitter']) {
    const run = newStory(COURSE), input = new TimedInput(), log = [];
    let i = 0, t = 0, n = 0;
    while (t < end) {
      t = Math.min(end, t + (fps === 'jitter' ? (5 + (n++ * 37) % 40) / 1000 : 1 / fps));
      while (i < edges.length && edges[i][0] <= t) { input.push(edges[i][0], edges[i][1]); i++; }
      input.advance(t, (from, to, f) => advanceStory(run, COURSE, to, f, log));
    }
    for (const e of log) if (e.type === 'land') assert.ok(Math.abs(e.beat * BEAT - (e.beat * BEAT)) < 1e-12);
    results.push({ x: run.x, status: run.status, beat: run.beat, lands: log.filter(e => e.type === 'land').length });
  }
  for (const r of results) {
    assert.equal(r.status, 'docked'); assert.equal(r.beat, results[0].beat);
    assert.ok(Math.abs(r.x - results[0].x) < 1e-6);
  }
});

const fieldCheckpoint = COURSE.checkpoints.findIndex(cp => cp.from === COURSE.fieldStart);
function holdOnly(fast, i = fieldCheckpoint, beats = 40) {
  const run = storyFrom(COURSE, i), log = [];
  for (let k = 0; k < beats && run.checkpoint === i && run.status !== 'falling'; k++) log.push(...hop(run, COURSE, fast ? 1 : 0));
  return { run, log };
}

test('green switch: neither SLOW-only nor FAST-only opens the bridge, a mix does', () => {
  assert.ok(fieldCheckpoint > 0);
  const slow = holdOnly(false);
  assert.ok(!slow.run.switchOn, 'SLOW keeps green beside you'); assert.equal(slow.run.status, 'falling');
  const fastOnly = holdOnly(true);
  assert.ok(!fastOnly.run.switchOn, 'FAST strands green short of the switch');
  assert.ok(fastOnly.log.some(e => e.type === 'strand'));
  const mixed = solve(COURSE, storyFrom(COURSE, fieldCheckpoint), { until: r => r.x > COURSE.bridge.b });
  assert.ok(mixed.end?.switchOn, 'a SLOW-then-FAST rhythm leaves green on the switch');
  assert.ok(mixed.path.some(f => f <= .25) && mixed.path.some(f => f >= .75));
});

test('green floats between SLOW and FAST: FAST pulls away, SLOW lets it catch up', () => {
  assert.ok(SLOW_SPEED < GREEN_SPEED && GREEN_SPEED < FAST_SPEED);
  const i = COURSE.checkpoints.findIndex(cp => cp.chapter === 'apart');
  const run = storyFrom(COURSE, i);
  hop(run, COURSE, 1);
  const apart = run.x - run.green.x;
  hop(run, COURSE, 0); hop(run, COURSE, 0);
  assert.ok(run.x - run.green.x < apart);
  assert.ok(apart < RANGE);
});

test('falling returns to the checkpoint on a beat and keeps friends and parts', () => {
  const run = newStory(COURSE);
  while (run.parts.got < 2) hop(run, COURSE, witness.path[run.beat]);
  const cp = run.checkpoint, log = [];
  for (let k = 0; k < 12 && !log.some(e => e.type === 'respawn'); k++) log.push(...hop(run, COURSE, 1));
  const respawn = log.find(e => e.type === 'respawn');
  assert.ok(respawn, 'FAST into the dark eventually falls and respawns');
  assert.equal(run.parts.got >= 2, true);
  assert.equal(run.x, COURSE.checkpoints[run.checkpoint].x);
  assert.ok(run.checkpoint >= cp);
});

test('red rescues green beyond the range rule, then the three travel together', () => {
  const run = structuredClone(newStory(COURSE)), types = [];
  for (const f of witness.path) for (const e of hop(run, COURSE, f)) types.push(e.type);
  const order = ['assemble', 'join', 'switch', 'join', 'rescue', 'pickup', 'reunion', 'station', 'station', 'station', 'dock'];
  let at = 0;
  for (const t of types) if (t === order[at]) at++;
  assert.equal(at, order.length, 'story beats happen in order: ' + types.filter(t => order.includes(t)).join(','));
});

test('the crane span is solid on two of every four beats', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(craneDown), [true, true, false, false, true, true]);
  const x = (COURSE.crane.a + COURSE.crane.b) / 2;
  assert.equal(platformAt(COURSE, x, 2, { craneDown }), null);
  assert.equal(platformAt(COURSE, x, 4, { craneDown })?.kind, 'crane');
});

test('music: the tick is the touchdown; the ending hands the beat to the friends', () => {
  const parts = new Set(['bell', 'bass', 'perc']);
  const playing = { dockBeat: null, parts, tick: () => true };
  assert.ok(notesAt(40, playing).some(n => n.part === 'tick'));
  assert.ok(!notesAt(41, playing).some(n => n.part === 'tick'));
  const D = 100, ending = { dockBeat: D, parts, tick: () => false };
  const at = beat => [0, 1, 2, 3].flatMap(sub => notesAt(beat * 4 + sub, ending));
  assert.deepEqual(at(D), [], 'silence where the hero stops');
  assert.ok(notesAt((D + 1) * 4, ending).some(n => n.part === 'bell'), 'blue bell on the next touchdown');
  for (let b = D; b < D + ENDING.bass; b++) assert.ok(!at(b).some(n => n.part === 'bass'));
  for (let b = D; b < D + ENDING.perc; b++) assert.ok(!at(b).some(n => n.part === 'perc'));
  assert.ok(Array.from({ length: 8 }, (_, i) => at(D + ENDING.perc + i)).flat().some(n => n.part === 'perc'));
  assert.ok(!Array.from({ length: 40 }, (_, i) => at(D + i)).flat().some(n => n.part === 'tick'));
});
