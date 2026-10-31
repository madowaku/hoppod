export const PERIOD = 0.78;
export const SLOW_SPEED = 105;
export const FAST_SPEED = 270;
export const INSET = 8;
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
    this.referenceHop = 7;
    this.platforms = [[0, 735]];
    this.plan = new Map();
    this.planPositions = new Map();
    for (let hop = 1; hop <= 7; hop++) { this.plan.set(hop, 0); this.planPositions.set(hop, 75 + hop * PERIOD * SLOW_SPEED); }
    this.referenceX = 75 + 7 * PERIOD * SLOW_SPEED;
    this.beacons = [];
    this.extendTo(1900);
  }
  appendHop() {
    this.referenceHop += 1;
    const rest = this.referenceHop % 10 >= 8;
    const difficulty = Math.min(1, this.referenceHop / 100);
    const distance = 150 + this.random() % 31;
    // At most 180px between centers, at least 106px wide: even the
    // extreme supported edges have a next-hop solution (82..211px).
    const halfWidth = rest ? 70 : Math.round(70 - 17 * difficulty) + this.random() % 4;
    this.referenceX += distance;
    // Seconds spent FAST, then SLOW, reproduces a centered reference route.
    this.plan.set(this.referenceHop, (distance - PERIOD * SLOW_SPEED) / (FAST_SPEED - SLOW_SPEED));
    this.planPositions.set(this.referenceHop, this.referenceX);
    if (this.referenceHop % 10 === 9) this.platforms[this.platforms.length - 1][1] = this.referenceX + halfWidth;
    else this.platforms.push([this.referenceX - halfWidth, this.referenceX + halfWidth]);
    if (this.referenceHop % 5 === 0) {
      this.beacons.push({ id: this.referenceHop, x: this.referenceX });
    }
  }
  extendTo(worldX) {
    while (this.referenceX < worldX) {
      this.appendHop();
    }
  }
  trim(worldX) {
    this.platforms = this.platforms.filter(([a, b]) => b >= worldX - 400);
    this.beacons = this.beacons.filter(b => b.x >= worldX - 100);
    for (const hop of this.plan.keys()) {
      if (this.planPositions.get(hop) < worldX - 400) { this.plan.delete(hop); this.planPositions.delete(hop); }
    }
  }
}
export function isSafe(terrain, x) {
  return terrain.platforms.some(([a, b]) => x >= a + INSET - EPS && x <= b - INSET + EPS);
}
export function predictLanding(state, fast) {
  return state.x + (fast ? FAST_SPEED : SLOW_SPEED) * Math.max(0, PERIOD - state.phase);
}
export function landingMiss(terrain, x, hopStartX) {
  let nearest = Infinity, direction = 'short';
  const low = hopStartX === undefined ? -Infinity : hopStartX + PERIOD * SLOW_SPEED;
  const high = hopStartX === undefined ? Infinity : hopStartX + PERIOD * FAST_SPEED;
  for (const [a, b] of terrain.platforms) {
    const left = Math.max(a + INSET, low), right = Math.min(b - INSET, high);
    if (left > right) continue;
    const safeX = Math.max(left, Math.min(right, x));
    if (Math.abs(safeX - x) < nearest) { nearest = Math.abs(safeX - x); direction = safeX < x ? 'far' : 'short'; }
  }
  return direction;
}
export function newRun() {
  return { x: 75, hopStartX: 75, phase: 0, hops: 0, beacons: 0, status: 'playing', lastEvent: null };
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
        state.hopStartX = state.x;
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
        terrain.trim(state.x);
      }
    }
  }
  return events;
}
