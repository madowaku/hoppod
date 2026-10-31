export const PERIOD = 0.78;
export const SLOW_SPEED = 105;
export const FAST_SPEED = 270;
const INSET = 8;
const EPS = 1e-8;

// World geometry is generated from an always-solvable reference sequence.
// The game never substitutes a "safe landing" for the actual player position.
export function hashSeed(text) {
  let h = 2166136261;
  for (const char of String(text)) {
    h ^= char.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function randomGenerator(seed) {
  let x = (seed >>> 0) || 0x9e3779b9;
  return () => {
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    return x >>> 0;
  };
}
export class Terrain {
  constructor(seed = 1) {
    this.seed = seed >>> 0;
    this.random = randomGenerator(seed);
    this.referenceX = 75;
    this.referenceHop = 0;
    this.platforms = [[0, 145]];
    this.plan = new Map();
    this.beacons = [];
    this.extendTo(1900);
  }
  appendHop(fast) {
    this.referenceHop += 1;
    this.referenceX += PERIOD * (fast ? FAST_SPEED : SLOW_SPEED);
    this.plan.set(this.referenceHop, fast);
    if (fast) {
      // Distinct leap islands, with a readable landing margin.
      const halfWidth = 62 + this.random() % 9;
      this.platforms.push([this.referenceX - halfWidth, this.referenceX + halfWidth]);
    } else {
      // A continuous runway gives the player a moment to breathe.
      this.platforms[this.platforms.length - 1][1] = this.referenceX + 72;
    }
    if (this.referenceHop % 5 === 0) {
      this.beacons.push({ id: this.referenceHop, x: this.referenceX });
    }
  }
  extendTo(worldX) {
    while (this.referenceX < worldX) {
      const slowBefore = 2 + this.random() % 2;
      const fast = 2 + this.random() % 3;
      const slowAfter = 2 + this.random() % 2;
      for (let n = 0; n < slowBefore; n++) this.appendHop(false);
      for (let n = 0; n < fast; n++) this.appendHop(true);
      for (let n = 0; n < slowAfter; n++) this.appendHop(false);
    }
  }
  trim(worldX, successfulHops) {
    this.platforms = this.platforms.filter(([a, b]) => b >= worldX - 400);
    this.beacons = this.beacons.filter(b => b.x >= worldX - 100);
    for (const hop of this.plan.keys()) {
      if (hop < successfulHops - 4) this.plan.delete(hop);
    }
  }
}
export function isSafe(terrain, x) {
  return terrain.platforms.some(([a, b]) => x >= a + INSET - EPS && x <= b - INSET + EPS);
}
export function predictLanding(state, fast) {
  return state.x + (fast ? FAST_SPEED : SLOW_SPEED) * Math.max(0, PERIOD - state.phase);
}
export function newRun() {
  return { x: 75, phase: 0, hops: 0, beacons: 0, status: 'playing', lastEvent: null };
}
export function advance(state, terrain, seconds, fast) {
  if (state.status !== 'playing' || !Number.isFinite(seconds) || seconds <= 0) return [];
  const events = [];
  let remaining = seconds;
  while (remaining > 1e-12 && state.status === 'playing') {
    const step = Math.min(remaining, PERIOD - state.phase);
    state.x += step * (fast ? FAST_SPEED : SLOW_SPEED);
    state.phase += step;
    remaining -= step;
    if (state.phase >= PERIOD - 1e-10) {
      state.phase = 0;
      if (!isSafe(terrain, state.x)) {
        state.status = 'dead';
        state.lastEvent = 'fall';
        events.push('fall');
      } else {
        state.hops += 1;
        state.lastEvent = 'land';
        events.push('land');
        for (const beacon of terrain.beacons) {
          if (!beacon.taken && Math.abs(state.x - beacon.x) <= 27) {
            beacon.taken = true;
            state.beacons += 1;
            events.push('beacon');
          }
        }
        terrain.extendTo(state.x + 1600);
        terrain.trim(state.x, state.hops);
      }
    }
  }
  return events;
}