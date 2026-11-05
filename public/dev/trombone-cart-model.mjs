// Independent lab: world velocities stay unchanged. The cart is NOT added to
// the pod's velocity; relative motion follows from subtracting its position.
import { PERIOD, SLOW_SPEED, FAST_SPEED, INSET, footing } from '../src/engine.mjs';
export { PERIOD };
export const CART_SPEED = (SLOW_SPEED + FAST_SPEED) / 2;
export const HALF_TRAVEL = (FAST_SPEED - CART_SPEED) * PERIOD;
export const CART = Object.freeze({ origin: 75, speed: CART_SPEED, halfWidth: 140, y: 382 });
export const PHRASES = Object.freeze({ up: ['low', 'high', 'low'], down: ['high', 'low', 'high'] });
export const cartX = (time, cart = CART) => cart.origin + cart.speed * time;
export const relativeX = (run, cart = CART) => run.x - cartX(run.time, cart);
export const pitchAt = x => x < 0 ? 'low' : 'high';
export const cartBounds = (time, cart = CART) => [cartX(time, cart) - cart.halfWidth + INSET, cartX(time, cart) + cart.halfWidth - INSET];

// Static platforms have world coordinates. Moving ones are evaluated at the
// actual touchdown time. Never insert the moving cart into Terrain.platforms.
export function supportAt(x, time, { cart = CART, terrain = [] } = {}) {
  const [left, right] = cartBounds(time, cart);
  if (x >= left - 1e-8 && x <= right + 1e-8) return { kind: 'cart', id: 'trombone' };
  const index = terrain.findIndex(platform => {
    const [a, b] = footing(platform);
    return x >= a - 1e-8 && x <= b + 1e-8;
  });
  return index < 0 ? null : { kind: 'terrain', id: index };
}
export function newCartRun(direction = 'up', cart = CART) {
  const start = direction === 'down' ? -HALF_TRAVEL / 2 : HALF_TRAVEL / 2;
  return { time: 0, phase: 0, x: cart.origin + start, hops: 0, status: 'playing', direction,
    notes: [], completed: false, cycles: 0, support: { kind: 'cart', id: 'trombone' } };
}
export function advanceCart(run, seconds, fast, layout = {}) {
  const events = [];
  if (run.status !== 'playing' || !Number.isFinite(seconds) || seconds <= 0) return events;
  let left = seconds;
  while (left > 1e-10 && run.status === 'playing') {
    const dt = Math.min(left, PERIOD - run.phase);
    run.x += (fast ? FAST_SPEED : SLOW_SPEED) * dt;
    run.time += dt; run.phase += dt; left -= dt;
    if (run.phase < PERIOD - 1e-10) continue;
    run.phase = 0;
    run.support = supportAt(run.x, run.time, layout);
    if (run.support?.kind !== 'cart') {
      run.status = run.support ? 'off-cart' : 'fall';
      events.push({ type: 'fall', t: run.time, x: run.x, support: run.support });
      break;
    }
    run.hops++;
    const relative = relativeX(run, layout.cart), pitch = pitchAt(relative);
    run.notes.push(pitch); if (run.notes.length > 12) run.notes.shift();
    events.push({ type: 'note', pitch, t: run.time, relative, hop: run.hops });
    const target = PHRASES[run.direction];
    if (run.notes.slice(-3).join(',') === target.join(',')) {
      run.completed = true; run.cycles++;
      events.push({ type: 'phrase', t: run.time, cycles: run.cycles });
    }
  }
  return events;
}
