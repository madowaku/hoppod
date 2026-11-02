import test from 'node:test';
import assert from 'node:assert/strict';
import { PERIOD, SLOW_SPEED, FAST_SPEED } from '../public/src/engine.mjs';
import { BEAT, BPM, BeatClock, TimedInput, beatIndex, heardFromContext } from '../public/src/story/beat.mjs';
import { COURSE, platformAt } from '../public/src/story/course.mjs';
import { newStory, storyFrom, advanceStory, craneDown, craneSolid, RANGE, GREEN_SPEED, SETTLE_TRIES } from '../public/src/story/sim.mjs';
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
  const order = ['assemble', 'join', 'switch', 'join', 'notice', 'rescue', 'pickup', 'reunion', 'station', 'station', 'station', 'dock'];
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

test('every note the composer emits has a finite pitch, length and level', () => {
  const songs = [
    { dockBeat: null, parts: new Set(), tick: () => true },
    { dockBeat: null, parts: new Set(['bell', 'bass', 'perc']), tick: b => b % 3 !== 0 },
    { dockBeat: 40, parts: new Set(['bell', 'bass', 'perc', 'sparkle']), tick: () => false },
  ];
  let count = 0;
  for (const song of songs) for (let n = 0; n < 4 * 16 * 8; n++) for (const note of notesAt(n, song)) {
    count++;
    for (const key of ['f', 'd', 'v']) assert.ok(Number.isFinite(note[key]) && note[key] > 0, JSON.stringify(note));
    assert.ok(note.f >= 40 && note.f <= 8000, 'audible pitch ' + note.f);
  }
  assert.ok(count > 500);
});

test('green loses the link once in the valley on every route, and a relay restores it', () => {
  const i = COURSE.checkpoints.findIndex(cp => cp.from <= COURSE.relays[0] && COURSE.relays[0] < cp.from + 300);
  let seed = 3, routes = 0;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < 12; k++) {
    const order = [0, .125, .25, .375, .5, .625, .75, .875, 1].sort(() => rnd() - .5);
    const m = solve(COURSE, storyFrom(COURSE, i), { until: r => r.x > COURSE.relays[1] + 10, order });
    if (!m.end) continue;
    routes++;
    const run = storyFrom(COURSE, i), types = [];
    for (const f of m.path) for (const e of hop(run, COURSE, f)) types.push(e.type);
    assert.ok(types.includes('strand') && types.includes('relink'), types.join());
    assert.ok(['catch', 'follow'].includes(run.green.state), run.green.state);
  }
  assert.ok(routes >= 8);
});

function switchPlan(tries, plan) {
  const run = storyFrom(COURSE, fieldCheckpoint), log = [];
  run.fails[fieldCheckpoint] = tries;
  for (let k = 0; k < 40 && run.status === 'playing' && run.x < COURSE.bridge.b + 10; k++) log.push(...hop(run, COURSE, plan(k)));
  return { ok: run.switchOn && run.x > COURSE.bridge.b, log };
}
test('each fall at the switch widens the window, but the last FAST burst stays with the player', () => {
  const wins = [];
  for (let tries = 0; tries <= SETTLE_TRIES; tries++) {
    let ok = 0;
    for (let j = 0; j < 8; j++) for (const f of [.25, .5, .75, 1]) for (const n of [1, 2]) if (switchPlan(tries, k => k >= j && k < j + n ? f : 0).ok) ok++;
    wins.push(ok);
    assert.equal(switchPlan(tries, () => 1).ok, false, 'FAST only strands green early');
    assert.equal(switchPlan(tries, () => 0).ok, tries >= SETTLE_TRIES, `SLOW only after ${tries} falls`);
  }
  for (let t = 1; t < wins.length; t++) assert.ok(wins[t] >= wins[t - 1], wins.join());
  assert.ok(wins[3] >= wins[0] * 3, 'three falls triple the single-burst plans: ' + wins.join());
  // Green tells the player it is over its socket, on a beat.
  const { log } = switchPlan(0, () => 0), socket = log.find(e => e.type === 'socket');
  assert.ok(socket && Math.abs(socket.t - socket.beat * BEAT) < 1e-9);
});

// Noisy play: mostly a short look-ahead, sometimes a random hold. After every
// respawn the run must still reach the next checkpoint (never stuck), and the
// link may only ever break in chapter II, before the switch.
test('noisy play never gets stuck and only loses green where the course means it', () => {
  const choices = [0, .25, .5, .75, 1];
  const stranded = [];
  let respawns = 0;
  for (const seed of [11, 23, 37, 51]) {
    let x = seed;
    const rnd = () => (x = (x * 16807) % 2147483647) / 2147483647;
    const run = newStory(COURSE);
    for (let n = 0; n < 1400 && run.status !== 'docked'; n++) {
      let f;
      if (rnd() < .12) f = choices[Math.floor(rnd() * choices.length)];
      else {
        const look = solve(COURSE, run, { until: r => r.beat >= run.beat + 4 || r.status === 'docked', limit: 400, order: [.25, 0, .5, .75, 1] });
        f = look.path[0] ?? choices[Math.floor(rnd() * choices.length)];
      }
      for (const e of hop(run, COURSE, f)) {
        if (e.type === 'strand') stranded.push({ x: e.x, chapter: run.chapter });
        if (e.type !== 'respawn') continue;
        respawns++;
        const next = COURSE.checkpoints[run.checkpoint + 1];
        const on = solve(COURSE, run, { until: r => (next ? r.x >= next.from : r.status === 'docked'), limit: 120000 });
        assert.ok(on.end, `stuck after respawn at checkpoint ${run.checkpoint} (red ${run.red.state}, green ${run.green.state})`);
      }
    }
    assert.equal(run.status, 'docked', 'seed ' + seed + ' reached the dock');
  }
  assert.ok(respawns >= 8, 'noise caused falls: ' + respawns);
  for (const s of stranded) assert.ok(s.chapter === 'apart' && s.x < COURSE.bridge.a, JSON.stringify(s));
});

test('a fall after red has left the crane never strands the hero behind it', () => {
  const i = COURSE.checkpoints.findIndex(cp => cp.chapter === 'rescue' && cp.x < COURSE.crane.a);
  const m = solve(COURSE, storyFrom(COURSE, i + 1), { until: r => r.x > COURSE.craneFar + 20 });
  const run = storyFrom(COURSE, i + 1);
  for (const f of m.path) hop(run, COURSE, f);
  hop(run, COURSE, 0);
  assert.equal(run.red.state, 'rescue', 'red looked back for one beat, then left');
  for (const beat of [0, 1, 2, 3]) assert.ok(craneSolid(run, beat), 'the span stays down once red has gone');
  run.checkpoint = i + 1; run.status = 'falling'; run.fallAt = run.beat;
  hop(run, COURSE, 0); hop(run, COURSE, 0);
  assert.ok(solve(COURSE, run, { until: r => r.x > COURSE.craneFar + 20, limit: 50000 }).end);
});

// A fall at each moment of chapters III–IV: before and after the crane,
// while red looks back, flies, carries green, right after the reunion, and
// between the stations. After the respawn the crew must be in a state the
// story can continue from, and the dock must still be reachable.
test('a fall at any moment of the rescue or the base recovers into a consistent story', () => {
  const from = COURSE.checkpoints.findIndex(cp => cp.chapter === 'rescue');
  const path = solve(COURSE, storyFrom(COURSE, from)).path;
  const moments = {
    'before the crane': r => r.red.state === 'crane' && r.x > COURSE.crane.a - 200,
    'red looks back': r => r.red.state === 'notice',
    'red flies': r => r.red.state === 'rescue',
    'red carries green': r => r.red.state === 'carry',
    'just reunited': r => r.together && r.chapter === 'rescue',
    'between stations': r => r.blue.state === 'station' && r.red.state !== 'station',
  };
  const seen = {};
  const run = storyFrom(COURSE, from);
  for (const f of path) {
    hop(run, COURSE, f);
    for (const [name, at] of Object.entries(moments)) {
      if (seen[name] || !at(run) || run.status !== 'playing') continue;
      seen[name] = true;
      const fall = structuredClone(run), log = [];
      fall.status = 'falling'; fall.fallAt = fall.beat; fall.fallX = fall.x;
      for (let k = 0; k < 2; k++) log.push(...hop(fall, COURSE, 0));
      assert.ok(log.some(e => e.type === 'respawn'), name);
      const { red, green, blue } = fall;
      assert.equal(blue.state, 'follow', name);
      assert.ok(fall.switchOn, name + ': the bridge stays open behind');
      assert.ok(['crane', 'carry', 'follow'].includes(red.state), name + ': red ' + red.state);
      if (red.state === 'carry') assert.ok(green.state === 'carry' && Math.abs(green.x - (red.x - 16)) < 1e-9, name);
      if (red.state === 'crane') assert.equal(green.state, 'switch', name);
      if (fall.together) assert.ok(green.state === 'follow' && red.state === 'follow', name);
      for (const beat of [0, 1, 2, 3]) if (red.state !== 'crane') assert.ok(craneSolid(fall, beat), name);
      const on = solve(COURSE, fall, { limit: 150000 });
      assert.ok(on.end, name + ': the dock is still reachable');
      assert.ok(on.end.together && ['blue', 'green', 'red'].every(w => on.end[w].state === 'station'), name);
    }
  }
  assert.deepEqual(Object.keys(seen).sort(), Object.keys(moments).sort());
});
