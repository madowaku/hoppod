import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PERIOD as BEAT, SLOW_SPEED, FAST_SPEED } from '../public/src/engine.mjs';
import { COURSE, U, CART_SPEED, CART_FOOT, CART_HALF, platformAt, stationAt, RUNG_TICKS, BARE_TICK } from '../public/src/workshop/course.mjs';
import { newRun, runFrom, advance, ASSIST_FAILS } from '../public/src/workshop/sim.mjs';
import { playHop, solve, HOLDS } from './helpers/workshop-solver.mjs';
import { chordAtBar, pc, PARTS, finaleBar, ENTRY, TUTTI_END, CARD_BAR, TUTTI_FROM, encodeTake, decodeTake, demoRecording, makeTake, bandBar, nearest, freeBar, BUDGET } from '../public/src/workshop/arrange.mjs';

const after = (run, id) => { const i = COURSE.stations.findIndex(s => s.id === id); return COURSE.stations[i]; };
const events = list => list.map(e => e.type);

test('a hop is 0.78s; U is one sixteenth of FAST; landings fall on five even slots', () => {
  assert.equal(BEAT, .78);
  assert.ok(Math.abs(U - 32.175) < 1e-9);
  const run = newRun();
  advance(run, COURSE, BEAT, false);
  assert.ok(Math.abs(run.x - (75 + SLOW_SPEED * BEAT)) < 1e-9);
  assert.equal(run.beat, 1);
});
test('the course is sorted, without overlaps, and visits every station once', () => {
  let last = -1;
  for (const p of COURSE.platforms) { assert.ok(p.a >= last - 1e-9, `overlap at ${p.a}`); assert.ok(p.b > p.a); last = p.b; }
  assert.deepEqual(COURSE.stations.map(s => s.id), ['hall', 'drums', 'tongue', 'keys', 'harp', 'strings', 'wood', 'bellows', 'brass', 'cymbal', 'metronome']);
  for (const cp of COURSE.checkpoints) assert.ok(platformAt(cp.x), `checkpoint ${cp.x} stands on ground`);
});
test('the first stations cannot be fallen through, whatever the input', () => {
  const deckEnd = after(null, 'drums').from + 140 + 1850;
  for (const seed of [1, 2, 3, 4, 5]) {
    let r = seed * 9301; const rng = () => (r = (r * 16807) % 2147483647) / 2147483647, run = newRun();
    while (run.x < deckEnd - 215) { const a = rng(), b = rng(); playHop(run, COURSE, [Math.min(a, b), Math.max(a, b)]); assert.equal(run.status, 'playing', `fell at ${run.x}`); }
  }
  const run = runFrom(COURSE, COURSE.checkpoints.findIndex(c => c.station === COURSE.stations.findIndex(s => s.id === 'keys')));
  const end = after(run, 'harp').from;
  while (run.x < end) { playHop(run, COURSE, [0, 1]); assert.equal(run.status, 'playing'); }
});
test('the whole course can be cleared with every station visited in order', () => {
  const { path, run } = solve(COURSE, newRun(), { order: [[.25, .5], [0, 0], [.5, .75], [0, .5], [.25, 1], [0, 1], ...HOLDS] });
  assert.ok(path, 'a path exists');
  assert.equal(run.status, 'docked');
  for (const part of PARTS) assert.ok(run.recording[part], `${part} recorded`);
  const seconds = path.length * BEAT;
  assert.ok(seconds > 150 && seconds < 900, `playthrough ${seconds}s`);
});
test('from every lantern the next one can be reached, so nobody is ever stranded', () => {
  for (let i = 0; i < COURSE.checkpoints.length - 1; i++) {
    const run = runFrom(COURSE, i), target = COURSE.checkpoints[i + 1].from;
    const { path } = solve(COURSE, run, { stopAt: target, maxHops: 70 });
    assert.ok(path, `lantern ${i} (${COURSE.stations[COURSE.checkpoints[i].station].id}) reaches the next`);
  }
});
test('a player who never presses gets across the cart once the guard rail is up', () => {
  const run = runFrom(COURSE, COURSE.checkpoints.findIndex(c => COURSE.stations[c.station].id === 'brass'));
  run.fails[run.checkpoint] = 2; let hops = 0;
  while (run.x < COURSE.cart.x1 + CART_HALF + 40 && hops++ < 200) { playHop(run, COURSE, [0, 0]); assert.equal(run.status, 'playing', `fell at ${run.x}`); }
  assert.ok(run.x >= COURSE.cart.x1 + CART_HALF);
});
test('tongue drum: only what was struck is solid ahead, and assists open the rest', () => {
  const plate = COURSE.platforms.find(p => p.kind === 'res');
  const run = runFrom(COURSE, 0); run.x = run.hopStartX = plate.a + 40 - SLOW_SPEED * BEAT; run.beat = 0; run.t = 0; run.stationId = 'tongue';
  run.resonance = []; const ev = advance(run, COURSE, BEAT, false);
  assert.equal(run.status, 'falling'); assert.ok(events(ev).includes('fall'));
  const hit = structuredClone(newRun()); hit.x = hit.hopStartX = plate.a + 40 - SLOW_SPEED * BEAT; hit.resonance = [plate.name]; hit.stationId = 'tongue';
  advance(hit, COURSE, BEAT, false); assert.equal(hit.status, 'playing');
  const helped = newRun(); helped.x = helped.hopStartX = plate.a + 40 - SLOW_SPEED * BEAT; helped.fails[helped.checkpoint] = ASSIST_FAILS; helped.stationId = 'tongue';
  advance(helped, COURSE, BEAT, false); assert.equal(helped.status, 'playing');
});
test('keys: hops become intervals without a fall, and the hop keeps every key as a note', () => {
  const run = runFrom(COURSE, COURSE.checkpoints.findIndex(c => COURSE.stations[c.station].id === 'keys'));
  const ev = [];
  while (run.x < COURSE.keysAt + 400) playHop(run, COURSE, [0, 0], ev);
  const notes = ev.filter(e => e.type === 'note' && e.part === 'keys');
  assert.ok(notes.length > 3); for (const n of notes) assert.ok(Number.isFinite(n.midi) && n.midi >= 58 && n.midi <= 87);
});
test('harp: FAST sweeps more strings than SLOW in the same hop', () => {
  const count = hold => { const run = runFrom(COURSE, COURSE.checkpoints.findIndex(c => COURSE.stations[c.station].id === 'harp')); run.x = run.hopStartX = COURSE.harp.from + 40; const ev = []; playHop(run, COURSE, hold, ev); return ev.filter(e => e.part === 'harp').length; };
  const slow = count([0, 0]), full = count([0, 1]);
  assert.ok(full >= slow * 2 && slow >= 2, `slow ${slow}, fast ${full}`);
});
test('strings: the same landing can ring or stay silent', () => {
  const sx = COURSE.strings[0];
  const play = hold => { const run = newRun(); run.stationId = 'strings'; run.station = 5; run.x = run.hopStartX = sx - 98; const ev = []; playHop(run, COURSE, hold, ev); return [run.x, ev.filter(e => e.part === 'strings').length]; };
  const [early, ring] = play([0, .5]), [late, silent] = play([.5, 1]);
  assert.ok(Math.abs(early - late) < 1e-6, 'same landing');
  assert.equal(ring, 1); assert.equal(silent, 0);
});
test('woodwind: presses are notes whose time and length are kept, and taps barely move you', () => {
  const run = runFrom(COURSE, COURSE.checkpoints.findIndex(c => COURSE.stations[c.station].id === 'wood'));
  const ev = [], x0 = run.x;
  advance(run, COURSE, .2, true, ev); advance(run, COURSE, .28, false, ev); advance(run, COURSE, .5, true, ev); advance(run, COURSE, BEAT, false, ev);
  assert.equal(ev.filter(e => e.type === 'reed' && e.on).length, 2);
  const stored = run.takes.wood.events;
  assert.equal(stored.length, 1 + 1); assert.ok(Math.abs(stored[1].t - .28) < 1e-6); assert.ok(Math.abs(stored[1].d - .22) < 1e-6);
  assert.ok(run.x - x0 < SLOW_SPEED * BEAT + (.2 + .22) * (FAST_SPEED - SLOW_SPEED) + 1e-6);
});
test('bellows: a plate takes only its own direction, with a small grace', () => {
  const push = COURSE.platforms.find(p => p.kind === 'push'), pull = COURSE.platforms.find(p => p.kind === 'pull');
  const land = (plate, plan) => { const run = newRun(); run.stationId = 'bellows'; const rate = plan[1] > plan[0] ? (plan[1] - plan[0]) * BEAT * (FAST_SPEED - SLOW_SPEED) : 0; run.x = run.hopStartX = (plate.a + plate.b) / 2 - SLOW_SPEED * BEAT - rate; playHop(run, COURSE, plan); return run.status; };
  assert.equal(land(pull, [0, 0]), 'playing');
  assert.equal(land(pull, [.3, 1]), 'falling');
  assert.equal(land(push, [.3, 1]), 'playing');
  assert.equal(land(push, [0, 0]), 'falling');
  assert.equal(land(push, [.3, .9]), 'playing', 'released inside the grace');
});
test('cart: SLOW goes back and FAST forward against it, half a hop holds still', () => {
  assert.equal(CART_SPEED, (SLOW_SPEED + FAST_SPEED) / 2);
  const ride = plan => {
    const run = runFrom(COURSE, COURSE.checkpoints.findIndex(c => COURSE.stations[c.station].id === 'brass'));
    run.x = run.hopStartX = COURSE.cart.x0 - SLOW_SPEED * BEAT; playHop(run, COURSE, [0, 0]); assert.equal(run.cart.state, 'ride');
    const before = run.x - run.cart.x; playHop(run, COURSE, plan); return run.x - run.cart.x - before;
  };
  assert.ok(Math.abs(ride([0, 0]) + 64.35) < 1e-6); assert.ok(Math.abs(ride([0, 1]) - 64.35) < 1e-6); assert.ok(Math.abs(ride([0, .5])) < 1e-6);
});
test('cart: off the end is a fall; after two falls a guard rail holds you on', () => {
  const start = () => { const run = runFrom(COURSE, COURSE.checkpoints.findIndex(c => COURSE.stations[c.station].id === 'brass')); run.x = run.hopStartX = COURSE.cart.x0 - SLOW_SPEED * BEAT; playHop(run, COURSE, [0, 0]); return run; };
  const free = start(); let hops = 0;
  while (free.status === 'playing' && hops++ < 10) playHop(free, COURSE, [0, 1]);
  assert.equal(free.status, 'falling');
  const guarded = start(); guarded.fails[guarded.checkpoint] = 2; hops = 0;
  while (guarded.status === 'playing' && hops++ < 10) playHop(guarded, COURSE, [0, 1]);
  assert.equal(guarded.status, 'playing'); assert.ok(guarded.x - guarded.cart.x <= CART_FOOT + 1e-6);
  void CART_HALF;
});
test('metronome: the bare rod runs against the hop and the rungs bring it in; landing at the tip docks', () => {
  assert.ok(Math.abs(BARE_TICK / BEAT - 5 / 7) < 1e-9);
  assert.deepEqual([...RUNG_TICKS].sort((a, b) => a - b), [...RUNG_TICKS]); assert.ok(RUNG_TICKS.at(-1) < BEAT);
  const i = COURSE.checkpoints.findIndex(c => COURSE.stations[c.station].id === 'metronome'), run = runFrom(COURSE, i), ev = [];
  while (run.status === 'playing') playHop(run, COURSE, [0, .4], ev);
  assert.equal(run.status, 'docked');
  const docks = ev.filter(e => e.type === 'dock'); assert.equal(docks.length, 1);
  assert.ok(ev.some(e => e.type === 'chatter'));
  const beatAt = run.beat, x = run.x; advance(run, COURSE, run.t + BEAT * 4, true, []);
  assert.equal(run.beat, beatAt + 4); assert.equal(run.x, x, 'no input moves a locked hero');
});
test('a take keeps its last hops as a 4, 8 or 16 beat loop, and the same run gives the same take', () => {
  const take = makeTake('drums', [10, 11, 12, 13, 14, 15, 16, 17, 18], [{ t: 18 * BEAT, voice: 'kick' }, { t: 3 * BEAT, voice: 'snare' }]);
  assert.equal(take.len, 8); assert.equal(take.events.length, 1); assert.equal(take.events[0].s, 28);
  assert.equal(makeTake('wood', [1, 2], []).len, 4);
  const a = solve(COURSE, newRun(), { order: [[.25, .5], [0, 0], [.5, .75], ...HOLDS] }).run.recording;
  const b = solve(COURSE, newRun(), { order: [[.25, .5], [0, 0], [.5, .75], ...HOLDS] }).run.recording;
  assert.deepEqual(a, b);
});

// ---------- the finale, played by the worst players we can script ----------
const rng = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
function persona(name) {
  const r = rng(77), shape = { slow: () => [0, 0], fast: () => [0, 1], random: () => { const a = r(), b = r(); return [Math.min(a, b), Math.max(a, b)]; } }[name];
  const beats = Array.from({ length: 16 }, (_, i) => i), rec = {}, x = i => 75 + i * 100 * (name === 'fast' ? 2 : 1);
  rec.drums = { len: 16, events: beats.map(b => ({ s: b * 4, voice: ['kick', 'snare', 'block'][Math.floor(x(b) / 80) % 3] })) };
  rec.tongue = { len: 16, events: beats.map(b => ({ s: b * 4, m: [71, 76, 67, 74, 69][Math.floor(x(b) / 48) % 5] })) };
  rec.keys = { len: 16, events: beats.map(b => ({ s: b * 4, m: 43 + (b * (name === 'fast' ? 9 : 3)) % 48 })) };
  rec.harp = { len: 16, events: beats.map(b => ({ s: b * 4, n: name === 'fast' ? 10 : name === 'slow' ? 4 : 2 + b % 7 })) };
  rec.strings = { len: 16, events: name === 'slow' ? [] : beats.filter(b => b % 3).map(b => ({ s: b * 4 + 1, i: b })) };
  rec.wood = { len: 16, events: name === 'slow' ? [] : name === 'fast' ? [{ s: 0, d: 12 }] : Array.from({ length: 24 }, (_, i) => ({ s: Math.floor(r() * 64), d: .1 + r() * .4 })).filter((e, i, l) => l.findIndex(o => o.s === e.s) === i).sort((a, b) => a.s - b.s) };
  rec.bellows = { len: 16, events: beats.map(b => ({ s: b * 4, push: name === 'fast' })) };
  rec.brass = { len: 16, events: beats.flatMap(b => [0, 2].map(k => ({ s: b * 4 + k, pos: name === 'slow' ? -160 : name === 'fast' ? 160 : shape()[0] * 300 - 150 }))) };
  return rec;
}
const render = rec => Array.from({ length: TUTTI_END }, (_, bar) => finaleBar(rec, bar).map(n => ({ ...n, bar, abs: bar * 16 + n.t / (BEAT / 4) })));
test('the finale holds together for the worst scripted players', () => {
  for (const name of ['slow', 'fast', 'random']) {
    let on = 0, hit = 0, rub = 0, slots = 0, most = 0;
    for (const notes of render(persona(name))) {
      const band = notes.filter(n => n.by === 'player' || n.part === 'wood' || n.part === 'strings');
      most = Math.max(most, band.length);
      for (const n of band) if (n.midi != null && Math.abs(n.t / (BEAT / 4) % 4) < .01) { on++; if (chordAtBar(n.bar).tones.includes(pc(n.midi))) hit++; }
      const by = new Map();
      for (const n of band) { if (n.midi == null) continue; const a = Math.round(n.t / (BEAT / 4)); (by.get(a) ?? by.set(a, []).get(a)).push(Math.round(n.midi)); }
      for (const list of by.values()) { slots++; if (list.some((a, i) => list.slice(i + 1).some(b => [1, 11].includes(((a - b) % 12 + 12) % 12)))) rub++; }
    }
    assert.ok(hit / on >= .85, `${name}: on-beat chord tones ${(hit / on * 100).toFixed(0)}%`);
    assert.ok(rub / slots <= .03, `${name}: rubbing onsets ${(rub / slots * 100).toFixed(1)}%`);
    assert.ok(most <= BUDGET + 2, `${name}: ${most} notes in one bar`);
  }
});
test('real runs through the course leave different finales; the same run the same one', () => {
  const key = rec => new Set(render(rec).flat().filter(n => n.by === 'player').map(n => `${n.part}:${n.bar}:${Math.round(n.t * 100)}:${n.midi ?? n.voice}`));
  const distance = (a, b) => { let same = 0; for (const v of a) if (b.has(v)) same++; return 1 - same / (a.size + b.size - same); };
  const orders = [
    [[.25, .5], [0, 0], [.5, .75], ...HOLDS],
    [[0, 1], [.25, 1], [0, .75], ...HOLDS],
    [[.5, 1], [0, .25], [.25, .75], ...HOLDS],
    [[0, 0], [0, .25], [.75, 1], ...HOLDS],
  ];
  const takes = orders.map(order => key(solve(COURSE, newRun(), { order }).run.recording));
  const pairs = [];
  for (let i = 0; i < takes.length; i++) for (let j = i + 1; j < takes.length; j++) pairs.push(distance(takes[i], takes[j]));
  assert.ok(Math.min(...pairs) > .35, `closest runs ${Math.min(...pairs).toFixed(2)}, all ${pairs.map(p => p.toFixed(2))}`);
  assert.equal(distance(takes[0], key(solve(COURSE, newRun(), { order: orders[0] }).run.recording)), 0);
});
test('the form: parts enter in order, a silent first bar, a tail with only the hero\'s breath that never ends', () => {
  const rec = demoRecording();
  assert.deepEqual(finaleBar(rec, 0).filter(n => n.part !== 'pad' && n.part !== 'bass'), []);
  for (const part of PARTS) {
    assert.ok(!finaleBar(rec, ENTRY[part] - 1).some(n => n.part === part), `${part} waits`);
    const spread = [0, 1, 2, 3].flatMap(k => finaleBar(rec, ENTRY[part] + k));
    assert.ok(spread.some(n => n.part === part), `${part} enters`);
  }
  assert.ok(finaleBar(rec, TUTTI_FROM).some(n => n.part === 'crash'));
  for (const bar of [TUTTI_END, CARD_BAR, CARD_BAR + 1, CARD_BAR + 100]) for (const n of finaleBar(rec, bar)) assert.ok(['wood', 'pad', 'bass'].includes(n.part));
  assert.ok(finaleBar(rec, CARD_BAR + 4).length + finaleBar(rec, CARD_BAR + 5).length > 0, 'still breathing');
  assert.ok(freeBar(rec, 400).length > 0);
});
test('every note is finite and in range for any legal take', () => {
  for (const name of ['slow', 'fast', 'random']) for (const notes of render(persona(name))) for (const n of notes) {
    if (n.midi !== null) assert.ok(Number.isFinite(n.midi) && n.midi >= 30 && n.midi <= 96, `${n.part} ${n.midi}`);
    assert.ok(n.t >= 0 && n.t < BEAT * 4, `${n.part} at ${n.t}`); assert.ok(n.v > 0 && n.v <= 1); assert.ok(n.dur > 0);
  }
});
test('a shared take survives the round trip and hostile input is refused or clamped', () => {
  const rec = demoRecording(), back = decodeTake(encodeTake(rec));
  for (const part of PARTS) assert.equal(back[part].events.length, rec[part].events.length);
  assert.deepEqual(finaleBar(back, 10).map(n => n.part).sort(), finaleBar(decodeTake(encodeTake(back)), 10).map(n => n.part).sort());
  for (const bad of ['', '@@@', 'null', btoa('[1,2]'), 'x'.repeat(13000)]) assert.equal(decodeTake(bad), null);
  const hostile = decodeTake(btoa(JSON.stringify({ keys: [999, [[-5, 9999], ['<script>', 'NaN'], 7]], wood: [8, [[1e9, 1e9]]] })));
  assert.equal(hostile.keys.len, 4); for (const e of hostile.keys.events) { assert.ok(e.s >= 0 && e.s < 16); assert.ok(e.m >= 36 && e.m <= 108); }
  assert.ok(hostile.wood.events[0].s < 32 && hostile.wood.events[0].d <= 4);
  for (const bar of [0, 6, 12, 20, 30]) for (const n of finaleBar(hostile, bar)) if (n.midi !== null) assert.ok(Number.isFinite(n.midi));
  void nearest; void bandBar;
});
