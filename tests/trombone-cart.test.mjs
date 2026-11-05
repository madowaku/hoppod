import test from 'node:test';
import assert from 'node:assert/strict';
import { PERIOD, SLOW_SPEED, FAST_SPEED, INSET } from '../public/src/engine.mjs';
import { CART, CART_SPEED, HALF_TRAVEL, cartX, cartBounds, relativeX, supportAt, newCartRun, advanceCart } from '../public/dev/trombone-cart-model.mjs';
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);

test('cart changes the reference frame, never the production velocities', () => {
  assert.equal(PERIOD, .78); assert.equal(CART_SPEED, 187.5); near(HALF_TRAVEL, 64.35);
  for (const fast of [false, true]) {
    const run = newCartRun(), start = run.x, initial = relativeX(run);
    advanceCart(run, PERIOD, fast);
    near(run.x - start, PERIOD * (fast ? FAST_SPEED : SLOW_SPEED));
    near(relativeX(run) - initial, fast ? 64.35 : -64.35);
    assert.equal(run.support.kind, 'cart');
  }
});
test('half FAST and half SLOW keeps the cart-relative position, in either order', () => {
  for (const first of [false, true]) {
    const run = newCartRun(), start = relativeX(run);
    advanceCart(run, PERIOD / 2, first); advanceCart(run, PERIOD / 2, !first);
    near(relativeX(run), start);
  }
});
test('touchdown uses current moving bounds and the same 8px inset as production', () => {
  const t = 10, [a, b] = cartBounds(t);
  near(a, cartX(t) - CART.halfWidth + INSET);
  assert.equal(supportAt(a, t).kind, 'cart'); assert.equal(supportAt(b, t).kind, 'cart');
  assert.equal(supportAt(a - .01, t), null); assert.equal(supportAt(b + .01, t), null);
  assert.equal(supportAt(CART.origin, t), null, 'old cart position is not a platform');
});
test('static terrain never moves with the cart and never earns a cart note', () => {
  const terrain = [[0, 140]];
  assert.deepEqual(supportAt(75, 10, { terrain }), { kind: 'terrain', id: 0 });
  assert.equal(supportAt(cartX(10), 10, { terrain }).kind, 'cart');
  const run = newCartRun();
  const hugeGround = { terrain: [[-10000, 10000]] };
  advanceCart(run, PERIOD * 3, true, hugeGround);
  assert.equal(run.status, 'off-cart'); assert.equal(run.support.kind, 'terrain');
  assert.equal(run.hops, 1); assert.equal(run.notes.length, 1);
});
test('both directions deliberately play repeated two-note return phrases for 100 hops', () => {
  for (const direction of ['up', 'down']) {
    const run = newCartRun(direction);
    for (let hop = 0; hop < 100; hop++) {
      const fast = direction === 'up' ? hop % 2 === 1 : hop % 2 === 0;
      const events = advanceCart(run, PERIOD, fast);
      assert.equal(events[0].type, 'note');
      assert.equal(events[0].pitch, fast ? 'high' : 'low');
      assert.ok(Math.abs(relativeX(run)) < 33);
    }
    assert.equal(run.status, 'playing'); assert.equal(run.hops, 100);
    assert.equal(run.completed, true); assert.equal(run.cycles, 49);
  }
});
test('holding one speed eventually falls: no clamping, wrapping or invisible rescue', () => {
  for (const fast of [false, true]) {
    const run = newCartRun();
    const events = advanceCart(run, PERIOD * 10, fast);
    assert.equal(run.status, 'fall'); assert.equal(events.at(-1).type, 'fall');
    assert.ok(Math.abs(relativeX(run)) > CART.halfWidth - INSET);
    const frozen = { ...run }; assert.deepEqual(advanceCart(run, 1, !fast), []);
    assert.deepEqual(run, frozen);
  }
});
test('leaving the horizontal footprint in midair does not cause a premature fall', () => {
  const run = newCartRun(); run.x = CART.origin + 120;
  advanceCart(run, .2, true); assert.ok(relativeX(run) > 132); assert.equal(run.status, 'playing');
  advanceCart(run, .58, false); assert.equal(run.status, 'playing'); assert.equal(run.hops, 1);
});
test('timestamp-split input yields identical notes and landings at 23/30/60/144fps', () => {
  const simulate = fps => {
    const run = newCartRun(), events = [];
    // Fast on each high hop; an extra brief press/release on every hop tests
    // non-frame-aligned input boundaries without crossing pitch boundaries.
    const edges = [{ t: 0, fast: false }];
    for (let h = 0; h < 12; h++) {
      const base = h * PERIOD, fast = h % 2 === 1;
      edges.push({ t: base, fast }, { t: base + .137, fast: !fast }, { t: base + .163, fast });
    }
    edges.sort((a, b) => a.t - b.t);
    let time = 0, input = false, index = 0;
    while (time < 12 * PERIOD - 1e-9) {
      const end = Math.min(12 * PERIOD, time + 1 / fps);
      while (index < edges.length && edges[index].t <= end) {
        const edge = edges[index++]; events.push(...advanceCart(run, edge.t - time, input)); time = edge.t; input = edge.fast;
      }
      events.push(...advanceCart(run, end - time, input)); time = end;
    }
    return { run, events };
  };
  const baseline = simulate(60);
  for (const fps of [23, 30, 144]) {
    const actual = simulate(fps); near(actual.run.x, baseline.run.x);
    assert.equal(actual.run.hops, 12); assert.equal(actual.run.status, 'playing');
    assert.deepEqual(actual.run.notes, baseline.run.notes);
    actual.events.forEach((e, i) => { assert.equal(e.type, baseline.events[i].type); near(e.t, baseline.events[i].t); });
  }
});
test('four-hop oscillation tolerates a grid of +/-50ms timing errors', () => {
  for (const direction of ['up', 'down']) for (const e1 of [-.05, 0, .05]) for (const e2 of [-.05, 0, .05]) for (const e3 of [-.05, 0, .05]) {
    const run = newCartRun(direction), initial = direction === 'down';
    let time = 0, fast = initial;
    for (const edge of [PERIOD + e1, 2 * PERIOD + e2, 3 * PERIOD + e3, 4 * PERIOD]) {
      advanceCart(run, edge - time, fast); time = edge; fast = !fast;
    }
    assert.equal(run.status, 'playing'); assert.equal(run.hops, 4);
    assert.deepEqual(run.notes, direction === 'up' ? ['low', 'high', 'low', 'high'] : ['high', 'low', 'high', 'low']);
  }
});
