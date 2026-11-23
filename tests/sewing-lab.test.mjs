import test from 'node:test';
import assert from 'node:assert/strict';
import { PERIOD, SLOW_STITCH, FAST_STITCH, BEAT_LIMIT, CLOTH, newRun, step, predictDrop, summary, zoneAt, nextReverse, nextMark, SLOW_FEED, MARK_HALF } from '../public/dev/sewing/sewing-model.mjs';

const DT = 1 / 240;
function play(choose, maxBeats = 200) {
  const run = newRun(); run.started = true;
  while (!run.done && run.beat < maxBeats) step(run, DT, choose(run));
  return run;
}
const rip = CLOTH.zones.find(z => z.kind === 'rip');
// FAST on plain cloth, SLOW in tears and when the next drop would hit a pin.
// On the rip: FAST forward, SLOW on red's pull back, FAST forward again.
function wise(run) {
  if (run.dir < 0) return nextReverse(run)?.why !== 'rip';
  if ([run.x, run.x + 12].some(x => zoneAt(x)?.kind === 'tear')) return false;
  const hits = x => run.pinsLeft.some(p => Math.abs(p - x) < 6);
  const ahead = fast => predictDrop({ ...run, fast });
  return !hits(ahead(true)) || hits(ahead(false));
}

test('the needle drops exactly once per beat, whatever the input', () => {
  const run = newRun(); run.started = true;
  let k = 0;
  while (run.beat < 10) step(run, DT, k++ % 97 < 40);
  assert.equal(run.beat, 10);
  assert.ok(Math.abs(run.t - 10 * PERIOD) < 1e-9);
});

test('stitch length is the feed over one beat', () => {
  const slow = play(() => false, 2), fast = play(() => true, 1);
  assert.ok(Math.abs(slow.stitches[1].len - SLOW_STITCH) < 1e-6);
  assert.ok(Math.abs(fast.stitches[0].len - FAST_STITCH) < 1e-6);
});

test('red pulls back at the start, over the rip and at the end; the seam ends on the end tack', () => {
  const run = play(() => true);
  const turns = run.events.filter(e => e.type === 'reverse').map(e => e.why);
  assert.deepEqual(turns, ['tack', 'rip', 'end']);
  assert.ok(run.stitches.some(s => s.back && s.kind === 'rip'));
  assert.equal(run.done, true);
  assert.equal(run.unfinished, false);
});

test('all SLOW never finishes inside the song; all FAST finishes but leaves every tear open', () => {
  const slow = play(() => false);
  assert.equal(slow.unfinished, true);
  assert.equal(slow.beat, BEAT_LIMIT);
  const fast = summary(play(() => true));
  assert.equal(fast.unfinished, false);
  assert.equal(fast.mend.blue + fast.mend.red, 0);
  // Three coarse passes over the rip are 1.5, short of 2.
  assert.ok(fast.mend.green < .2, `rip ${fast.mend.green}`);
});

test('reading the cloth, with a slow pull back over the rip, finishes in time with everything mended', () => {
  const run = play(wise);
  const s = summary(run);
  assert.equal(s.unfinished, false, `beats ${s.beats}`);
  assert.ok(s.beats < BEAT_LIMIT - 4, `beats ${s.beats}`);
  for (const who of ['blue', 'green', 'red']) assert.ok(s.mend[who] > .85, `${who} ${s.mend[who]}`);
  assert.equal(s.pinHits, 0);
  assert.ok(rip.len > 0);
});

// Aim at the chalk: hold FAST only while staying SLOW from now on would fall short of the next mark.
function aim(run) {
  if (run.dir < 0) return nextReverse(run)?.why !== 'rip';
  const m = nextMark(run);
  if (m === null) return wise(run);
  const left = PERIOD - (run.t - run.beat * PERIOD);
  if (m > run.x + 26 * 2.2) return wise(run);   // too far for this beat: plain rules
  return run.x + SLOW_FEED * left < m;
}

test('chalk marks can all be hit by aiming, inside the song', () => {
  const run = play(aim);
  const s = summary(run);
  assert.equal(s.unfinished, false, `beats ${s.beats}`);
  assert.equal(s.marks, s.markTotal, `marks ${s.marks}/${s.markTotal}`);
  assert.ok(s.beats < BEAT_LIMIT - 2, `beats ${s.beats}`);
  for (const who of ['blue', 'green', 'red']) assert.ok(s.mend[who] > .85, `${who} ${s.mend[who]}`);
  assert.equal(s.pinHits, 0);
});

test('red changes the thread before each friend stretch and back after', () => {
  const run = play(() => true);
  const threads = run.events.filter(e => e.type === 'thread').map(e => e.thread);
  assert.deepEqual(threads, ['blue', 'plain', 'green', 'plain', 'red', 'plain']);
  assert.ok(run.stitches.filter(st => st.kind === 'tear' && st.who === 'blue').every(st => st.thread === 'blue'));
});
