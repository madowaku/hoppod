import test from 'node:test';
import assert from 'node:assert/strict';
import { PERIOD, SLOW_SPEED, FAST_SPEED, INSET } from '../public/src/engine.mjs';
import { BEAT, BPM, BeatClock, TimedInput, beatIndex, heardFromContext } from '../public/src/story/beat.mjs';
import { COURSE, platformAt } from '../public/src/story/course.mjs';
import { newStory, storyFrom, advanceStory, craneDown, craneSolid, bridgeFront, bridgeSegmentAt, craneWorking, RANGE, FOLLOW_GAP, GREEN_SPEED, KIT_REACH, FIT_BEATS, BOOT_BEATS, BRIDGE_LEGS, BRIDGE_SEGMENTS, CRANE_CALL, CRANE_CLIMB } from '../public/src/story/sim.mjs';
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

test('a long stall pauses on the last simulated instant, not on the time it ended', () => {
  let heard = 50;
  const clock = new BeatClock(() => heard);
  clock.start(0, 0);
  heard = 52; assert.ok(Math.abs(clock.now(2) - 2) < 1e-9);
  // 30s with no frame: the game last simulated (and drew) story time 2.
  heard = 82; clock.pause(32, 2);
  assert.ok(Math.abs(clock.now(33) - 2) < 1e-9, 'frozen on the last drawn instant');
  heard = 90; clock.resume(40);
  assert.ok(Math.abs(clock.now(40) - 2) < 1e-9, 'resumes there: no beats skipped');
  heard = 90.78; assert.ok(Math.abs(clock.now(40.78) - 2.78) < 1e-9);
  // An `at` later than now never moves the story ahead.
  const other = new BeatClock(() => null); other.start(0, 0); other.pause(1, 5);
  assert.ok(Math.abs(other.now(9) - 1) < 1e-9);
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

test('the start is safe ground: no fall at any input, the first hole small and seen late; a fall comes back near it', () => {
  const plain = COURSE.platforms[0], edge = plain.b - INSET, gap = COURSE.platforms[1].a - plain.b;
  assert.equal(COURSE.start, COURSE.checkpoints[0].x);
  const steps = (COURSE.checkpoints[1].x - COURSE.start) / (SLOW_SPEED * BEAT);
  assert.ok(Math.abs(steps - Math.round(steps)) < 1e-9, 'the respawn keeps SLOW in step with the lesson');
  // Whatever is held, the first five touchdowns are on the ground; at SLOW, fourteen.
  for (let m = 0; m < 1 << 5; m++) {
    const run = newStory(COURSE);
    for (let k = 0; k < 5; k++) assert.ok(!hop(run, COURSE, (m >> k) & 1).some(e => e.type === 'fall'), `pattern ${m}, hop ${k}`);
    assert.ok(run.x <= edge);
  }
  const slow = newStory(COURSE);
  for (let k = 0; k < 14; k++) assert.ok(!hop(slow, COURSE, 0).some(e => e.type === 'fall'));
  // At SLOW the hole is off the screen (230px ahead of the hero) for about nine seconds.
  assert.ok((plain.b - 230 - COURSE.start) / SLOW_SPEED > 8.5);
  // It is the smallest gap of the lessons, and FAST or SLOW alone both cross it.
  const lessons = COURSE.platforms.slice(1, 13).map((p, i) => p.a - COURSE.platforms[i].b);
  assert.equal(gap, Math.min(...lessons));
  // A fall in lesson two returns to the end of the plain, and SLOW reaches the first part from there.
  const run = newStory(COURSE); let log = [];
  for (let k = 0; k < 40 && run.status === 'playing'; k++) log = hop(run, COURSE, 0);
  assert.equal(run.status, 'falling'); assert.equal(run.parts.got, 1);
  for (let k = 0; k < 3 && run.status === 'falling'; k++) hop(run, COURSE, 0);
  assert.equal(run.checkpoint, 1); assert.equal(run.x, COURSE.checkpoints[1].x);
  const again = storyFrom(COURSE, 1);
  for (let k = 0; k < 20 && again.parts.got < 1; k++) assert.ok(!hop(again, COURSE, 0).some(e => e.type === 'fall'));
  assert.equal(again.parts.got, 1);
});

test('lesson one is cleared by SLOW alone with room to spare; lessons two and three still ask for FAST and for both', () => {
  const slowFrom = (run, until) => {
    const log = [];
    for (let k = 0; k < 60 && run.status === 'playing' && !until(run); k++) log.push(...hop(run, COURSE, 0));
    return log;
  };
  const run = newStory(COURSE), log = slowFrom(run, r => r.parts.got >= 1);
  assert.equal(run.parts.got, 1, 'SLOW alone reaches the first part');
  assert.ok(!log.some(e => e.type === 'fall'));
  for (const e of log.filter(e => e.type === 'land')) {
    const x = COURSE.start + e.beat * SLOW_SPEED * BEAT, p = COURSE.platforms.find(q => x >= q.a && x <= q.b);
    assert.ok(p && Math.min(x - p.a, p.b - x) - INSET >= 12, `touchdown ${e.beat} at x ${x.toFixed(1)}: ${p && Math.min(x - p.a, p.b - x) - INSET}px inside`);
  }
  // Lesson two (wide gaps) cannot be crossed at SLOW alone.
  const on = slowFrom(run, () => false);
  assert.ok(on.some(e => e.type === 'fall') && run.parts.got === 1, 'lesson two needs FAST');
  // Lesson three needs both speeds: neither SLOW nor FAST alone reaches the last part.
  for (const f of [0, 1]) {
    const r = storyFrom(COURSE, 2), ev = [];
    for (let k = 0; k < 40 && r.status === 'playing'; k++) ev.push(...hop(r, COURSE, f));
    assert.equal(r.status, 'falling', (f ? 'FAST' : 'SLOW') + ' alone falls in lesson three');
    assert.ok(r.parts.got < 3);
  }
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
    const lands = log.filter(e => e.type === 'land');
    assert.ok(lands.length > 100, fps + ': ' + lands.length + ' touchdowns');
    for (const e of lands) assert.ok(Math.abs(e.t - e.beat * BEAT) < 1e-9, `${fps}: touchdown at ${e.t}, beat ${e.beat}`);
    results.push({ fps, x: run.x, status: run.status, beat: run.beat, events: log.map(e => ({ type: e.type, beat: e.beat, t: e.t, who: e.who })) });
  }
  // Every frame rate sees the same events, in the same order, at the same story times.
  for (const r of results) {
    assert.equal(r.status, 'docked'); assert.equal(r.beat, results[0].beat);
    assert.ok(Math.abs(r.x - results[0].x) < 1e-6);
    assert.equal(r.events.length, results[0].events.length, r.fps + ' event count');
    r.events.forEach((e, i) => {
      const o = results[0].events[i];
      assert.equal(e.type + ':' + e.beat + ':' + e.who, o.type + ':' + o.beat + ':' + o.who, `${r.fps}: event ${i}`);
      if (e.t !== undefined || o.t !== undefined) assert.ok(Math.abs(e.t - o.t) < 1e-9, `${r.fps}: ${e.type} at ${e.t} vs ${o.t}`);
    });
  }
});

const fieldCheckpoint = COURSE.checkpoints.findIndex(cp => cp.from === COURSE.fieldStart);
function holdOnly(fast, i = fieldCheckpoint, beats = 40) {
  const run = storyFrom(COURSE, i), log = [];
  for (let k = 0; k < beats && run.checkpoint === i && run.status !== 'falling'; k++) log.push(...hop(run, COURSE, fast ? 1 : 0));
  return { run, log };
}

test('green socket: SLOW brings green to it and the bridge forms; FAST alone outruns it', () => {
  assert.ok(fieldCheckpoint > 0);
  assert.equal(COURSE.bridge.a - COURSE.switchX, 100, 'the socket is the bridge root, 100px before the chasm');
  const slow = { run: storyFrom(COURSE, fieldCheckpoint), log: [] };
  for (let k = 0; k < 30 && slow.run.status === 'playing' && slow.run.x <= COURSE.bridge.b; k++) slow.log.push(...hop(slow.run, COURSE, 0));
  assert.ok(slow.run.switchOn && slow.run.x > COURSE.bridge.b, 'waiting for green: green reaches the socket, the hero crosses');
  assert.equal(slow.run.green.state, 'switch'); assert.ok(!slow.log.some(e => e.type === 'fall'));
  const fastOnly = holdOnly(true);
  assert.equal(fastOnly.run.status, 'falling', 'rushing: over the chasm before the bridge');
  // Green keeps coming while the hero falls: the bridge forms behind him and stays.
  const run = fastOnly.run, log = [];
  for (let k = 0; k < 3; k++) log.push(...hop(run, COURSE, 0));
  assert.ok(run.switchOn && run.green.state === 'switch', 'green reached the socket anyway');
  assert.ok(log.some(e => e.type === 'respawn'));
  for (let k = 0; k < 20 && run.x < COURSE.bridge.b; k++) hop(run, COURSE, 1);
  assert.ok(run.x > COURSE.bridge.b && run.status === 'playing', 'after the respawn even FAST crosses: the bridge stayed');
});

test('green socket: three SLOW hops before the edge always work, none never does', () => {
  const by = {};
  for (let m = 0; m < 1 << 12; m++) {
    const run = storyFrom(COURSE, fieldCheckpoint), hist = []; let res = null;
    for (let i = 0; i < 30 && !res; i++) {
      const f = i < 12 ? (m >> i) & 1 : 0, before = run.x, ev = hop(run, COURSE, f);
      if (before < COURSE.bridge.a) hist.push(f);
      if (ev.some(e => e.type === 'fall')) res = 'fall'; else if (run.x > COURSE.bridge.b) res = 'ok';
    }
    const k = hist.slice(-3).filter(f => f === 0).length; (by[k] ??= { n: 0, ok: 0 }).n++; if (res === 'ok') by[k].ok++;
  }
  assert.equal(by[3].ok, by[3].n, 'three SLOW: ' + JSON.stringify(by));
  assert.equal(by[0].ok, 0, 'no SLOW: ' + JSON.stringify(by));
  assert.ok(by[2].ok > 0 && by[2].ok < by[2].n, 'two SLOW sometimes: ' + JSON.stringify(by));
});

test('green socket: the arrival and the bridge do not depend on the frame rate', () => {
  const runAt = step => {
    const run = storyFrom(COURSE, fieldCheckpoint), events = [];
    while (!run.switchOn && run.t < 30) advanceStory(run, COURSE, run.t + step(), false, events);
    return { switchAt: run.switchAt, socket: events.find(e => e.type === 'socket')?.t };
  };
  let seed = 9; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const results = [() => 1 / 30, () => 1 / 60, () => 1 / 144, () => .78, () => .001 + rnd() * .2].map(runAt);
  for (const r of results) {
    assert.ok(Math.abs(r.switchAt - results[0].switchAt) < 1e-9, JSON.stringify(results));
    assert.ok(Math.abs(r.socket - results[0].socket) < 1e-9, JSON.stringify(results));
  }
  // The bridge is laid in four pieces, one per sixteenth note, from the
  // first sixteenth after green's legs are down.
  const run = storyFrom(COURSE, fieldCheckpoint); run.switchOn = true; run.switchAt = 10;
  const first = bridgeSegmentAt(run, 0), len = COURSE.bridge.b - COURSE.switchX;
  assert.ok(first >= 10 + BRIDGE_LEGS - 1e-9 && first < 10 + BRIDGE_LEGS + STEP);
  assert.ok(Math.abs(first / STEP - Math.round(first / STEP)) < 1e-9, 'on the sixteenth grid');
  run.t = first - 1e-6; assert.equal(bridgeFront(run, COURSE), COURSE.switchX);
  for (let k = 0; k < BRIDGE_SEGMENTS; k++) {
    run.t = bridgeSegmentAt(run, k); const want = k === BRIDGE_SEGMENTS - 1 ? Infinity : COURSE.switchX + len * (k + 1) / BRIDGE_SEGMENTS;
    assert.ok(bridgeFront(run, COURSE) === want || Math.abs(bridgeFront(run, COURSE) - want) < 1e-9, 'piece ' + k);
  }
  assert.equal(platformAt(COURSE, COURSE.bridge.b - 20, 0, { bridgeTo: COURSE.bridge.b - 40 }), null, 'not solid beyond its tip');
  assert.ok(platformAt(COURSE, COURSE.bridge.b - 20, 0, { bridgeTo: Infinity }));
});

test('green far behind is boosted by a relay and still reaches the socket', () => {
  const run = storyFrom(COURSE, fieldCheckpoint - 1), log = [];
  const m = solve(COURSE, structuredClone(run), { until: r => r.x >= COURSE.fieldStart + 60, order: [1, .75, .5, .25, 0] });
  for (const f of m.path) log.push(...hop(run, COURSE, f));
  assert.ok(log.some(e => e.type === 'relink'), 'rushing the valley leaves green out of range; the relay boosts it');
  for (let k = 0; k < 20 && run.status === 'playing' && run.x < COURSE.bridge.b; k++) hop(run, COURSE, 0);
  assert.ok(run.switchOn && run.x > COURSE.bridge.b, 'then SLOW on the field: green holds the bridge');
});

test('green floats between SLOW and FAST: FAST pulls away, SLOW lets it catch up', () => {
  assert.ok(SLOW_SPEED < GREEN_SPEED && GREEN_SPEED < FAST_SPEED);
  const i = COURSE.checkpoints.findIndex(cp => cp.chapter === 'apart');
  const run = storyFrom(COURSE, i);
  // Fit green with its legs first, SLOW, until it is beside the hero.
  while (run.green.state !== 'follow' || Math.abs(run.x - run.green.x - FOLLOW_GAP) > 1) hop(run, COURSE, 0);
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
  const order = ['assemble', 'kit', 'fit', 'join', 'switch', 'kit', 'fit', 'join', 'notice', 'rescue', 'pickup', 'reunion', 'station', 'station', 'station', 'dock'];
  let at = 0;
  for (const t of types) if (t === order[at]) at++;
  assert.equal(at, order.length, 'story beats happen in order: ' + types.filter(t => order.includes(t)).join(','));
});

test('green and red are met missing a part; picked up, it clicks in on the next beat and they boot on the one after', () => {
  for (const who of ['green', 'red']) {
    const i = COURSE.checkpoints.findIndex(cp => cp.chapter === (who === 'green' ? 'apart' : 'rescue'));
    const fresh = storyFrom(COURSE, i);
    assert.equal(fresh[who].state, 'dormant', who + ' waits, missing its part, at the checkpoint before it');
    assert.equal(fresh.kits[who].at, null);
    assert.ok(COURSE[who + 'Kit'] < (who === 'green' ? COURSE.greenMeet : COURSE.redConsole) && fresh.x < COURSE[who + 'Kit'] - KIT_REACH, 'its part lies ahead, before it');
    // Any rhythm: all SLOW, all FAST, mixed. The part is always picked up
    // (never hopped over) and fitted before the hero is far past the friend.
    for (const seed of [0, 1, 2, 3]) {
      const run = storyFrom(COURSE, i), seen = {};
      for (let k = 0; k < 14 && !seen.join; k++) {
        const f = seed === 0 ? 0 : seed === 1 ? 1 : (k * 7 + seed) % 3 / 2;
        for (const e of hop(run, COURSE, f)) if (e.who === who && ['kit', 'fit', 'join'].includes(e.type)) seen[e.type] = { ...e, x: run.x, friend: run[who].x };
        if (!seen.kit) assert.equal(run[who].state, 'dormant');
      }
      assert.ok(seen.kit && seen.fit && seen.join, who + ' was fitted and booted (seed ' + seed + ')');
      assert.equal(seen.kit.chased, false, 'picked up, not hopped over');
      assert.equal(seen.fit.beat, seen.kit.beat + FIT_BEATS); assert.equal(seen.join.beat, seen.kit.beat + BOOT_BEATS);
      assert.ok(seen.fit.x - seen.fit.friend < 60, 'the part clicks in before the hero is past the friend (seed ' + seed + ')');
      assert.equal(run[who].state, who === 'green' ? 'follow' : 'escort');
    }
    // A restart past the part: the friend is already with the hero.
    const later = storyFrom(COURSE, i + 1);
    assert.notEqual(later[who].state, 'dormant'); assert.notEqual(later[who].state, 'fit');
  }
});

test('a friend still booting when the hero falls is ready when the hero is back', () => {
  const i = COURSE.checkpoints.findIndex(cp => cp.chapter === 'apart');
  const run = storyFrom(COURSE, i);
  while (run.green.state !== 'fit') hop(run, COURSE, 0);
  // A fall that respawns on the beat the legs click in (not reachable on this
  // ground, but the rule must hold anywhere).
  run.status = 'falling'; run.fallAt = run.beat + 1 - 2; run.fallX = run.x;
  const events = hop(run, COURSE, 0);
  assert.ok(events.some(e => e.type === 'respawn') && events.some(e => e.type === 'join' && e.who === 'green'));
  assert.equal(run.green.state, 'follow'); assert.equal(run.green.x, COURSE.checkpoints[run.checkpoint].x - FOLLOW_GAP);
  assert.ok(solve(COURSE, run, { until: r => r.switchOn && r.x > COURSE.bridge.b, limit: 80000 }).end, 'and the story goes on');
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

test('green never stops: in the valley it falls out of range and keeps coming', () => {
  const i = COURSE.checkpoints.findIndex(cp => cp.from <= COURSE.relays[0] && COURSE.relays[0] < cp.from + 300);
  let seed = 3, routes = 0, outOfRange = 0;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < 12; k++) {
    const order = [0, .125, .25, .375, .5, .625, .75, .875, 1].sort(() => rnd() - .5);
    const m = solve(COURSE, storyFrom(COURSE, i), { until: r => r.x > COURSE.relays[1] + 10, order });
    if (!m.end) continue;
    routes++;
    const run = storyFrom(COURSE, i); let last = run.green.x, far = false;
    for (const f of m.path) {
      hop(run, COURSE, f);
      assert.ok(['follow', 'catch'].includes(run.green.state), run.green.state);
      assert.ok(run.green.x >= last - 1e-9, 'green only ever moves forward'); last = run.green.x;
      if (run.x - run.green.x > RANGE) far = true;
    }
    if (far) outOfRange++;
  }
  assert.ok(routes >= 8 && outOfRange >= routes / 2, `${outOfRange}/${routes} routes leave green out of range`);
});

// Noisy play: mostly a short look-ahead, sometimes a random hold. After every
// respawn the run must still reach the next checkpoint (never stuck).
test('noisy play never gets stuck', () => {
  const choices = [0, .25, .5, .75, 1];
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
});

test('red walks with the hero, flies to the boom, and only then works the span on the beat', () => {
  const i = COURSE.checkpoints.findIndex(cp => cp.chapter === 'rescue');
  const m = solve(COURSE, storyFrom(COURSE, i), { until: r => r.x > COURSE.crane.b + 20 });
  const run = storyFrom(COURSE, i); let woke = false, called = null, atCall = null;
  for (const f of m.path) {
    for (const e of hop(run, COURSE, f)) { if (e.type === 'join' && e.who === 'red') woke = true; if (e.type === 'crane') { called = run.x; atCall = structuredClone(run); } }
    // Once at the hero's side (it boots behind it), red stays there.
    if (run.red.state === 'escort' && run.t - run.red.bootAt > 1.5) assert.ok(run.x - run.red.x <= 46 * 1.6 + 1e-6 && run.x - run.red.x > 0, 'red stays beside the hero');
  }
  assert.ok((woke || storyFrom(COURSE, i).red.state === 'escort') && called !== null, 'red woke (or starts awake here), walked along, then was called to the crane');
  assert.ok(called >= COURSE.crane.a - CRANE_CALL - 1e-9 && called < COURSE.crane.a, 'called with the crane in view');
  const r = atCall, climbEnd = r.red.craneAt + CRANE_CLIMB;
  for (let b = Math.floor(r.red.craneAt / BEAT); b < Math.floor(r.red.craneAt / BEAT) + 12; b++) {
    if (b * BEAT < climbEnd - 1e-9) assert.ok(!craneSolid(r, b) && !craneWorking(r, b), 'the span stays up until red is on the boom (beat ' + b + ')');
    else assert.equal(craneSolid(r, b), craneDown(b), 'then down on two beats of four (beat ' + b + ')');
  }
});

test('falls at the crane: red keeps working it, the beat holds, and a restart there is consistent', () => {
  const i = COURSE.checkpoints.findIndex(cp => cp.chapter === 'rescue' && cp.x < COURSE.crane.a && cp.x > COURSE.redConsole);
  // Into the crane gap on a beat the span is up: SLOW from the checkpoint until it falls.
  const run = storyFrom(COURSE, i); let fell = false;
  for (let k = 0; k < 30 && !fell; k++) fell = hop(run, COURSE, k < 6 ? 0 : 1).some(e => e.type === 'fall');
  assert.ok(fell, 'fell at the crane');
  const state = run.red.state;
  for (let k = 0; k < 3; k++) hop(run, COURSE, 0);
  assert.equal(run.status, 'playing'); assert.equal(run.red.state, state, 'red is where it was');
  if (state === 'crane') for (let b = run.beat; b < run.beat + 8; b++) assert.equal(craneSolid(run, b), craneDown(b) || (run.fails[run.checkpoint] || 0) >= 2);
  assert.ok(solve(COURSE, run, { until: r => r.x > COURSE.craneFar + 20, limit: 80000 }).end, 'still crossable');
  // A developer start at this checkpoint: red beside the hero, the crane not yet working.
  const fresh = storyFrom(COURSE, i);
  assert.equal(fresh.red.state, 'escort'); assert.ok(!craneSolid(fresh, 0));
  assert.ok(solve(COURSE, fresh, { until: r => r.x > COURSE.craneFar + 20, limit: 80000 }).end);
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

test('composition: blue starts the song on D+1, the others join on downbeats, the pad completes it', () => {
  const D = 200, all = new Set(['bell', 'bass', 'perc']), song = { dockBeat: D, parts: all, tick: () => false };
  const at = (beat, part) => [0, 1, 2, 3].flatMap(sub => notesAt(beat * 4 + sub, song)).filter(n => n.part === part);
  const first = part => { for (let b = D; b < D + 40; b++) if (at(b, part).length) return b - D; return null; };
  assert.deepEqual([first('bell'), first('bass'), first('perc'), first('pad')], [ENDING.bell, ENDING.bass, ENDING.perc, ENDING.pad]);
  for (const part of ['bass', 'perc', 'pad']) assert.equal((ENDING[part] - ENDING.bell) % 4, 0, part + ' enters on a downbeat');
  // D+1: the melody's first note and the low hand-off G together.
  assert.equal(notesAt((D + 1) * 4, song).filter(n => n.part === 'bell').length, 2);
  assert.ok(ENDING.pad < ENDING.launch, 'the ensemble is complete before the rocket leaves');
  // Melody stays in G major plus the borrowed E flat; it has rests.
  const play = { dockBeat: null, parts: new Set(['bell']), tick: () => true, origin: 0 };
  const pcs = new Set(), onsets = new Set();
  for (let n = 0; n < 64 * 4; n++) for (const note of notesAt(n, play)) if (note.part === 'bell') { pcs.add(Math.round(12 * Math.log2(note.f / 440) + 69) % 12); onsets.add(Math.floor(n / 2)); }
  for (const pc of pcs) assert.ok([7, 9, 11, 0, 2, 3, 4, 6].includes(pc), 'pitch class ' + pc);
  assert.ok(pcs.has(3), 'the borrowed E flat is there');
  assert.ok(onsets.size < 64 * 2 * .6, 'at least 40% of eighth slots are rests or holds: ' + onsets.size);
  // Before blue is built there is no song at all, only the clockwork.
  const dark = { dockBeat: null, parts: new Set(), tick: () => true, origin: 0 };
  for (let n = 0; n < 64; n++) for (const note of notesAt(n, dark)) assert.equal(note.part, 'tick');
});
