export const PERIOD = 0.78;
export const SLOW_SPEED = 105;
export const FAST_SPEED = 270;
export const INSET = 8;
// Course geometry identity; bump whenever seeded platform layout changes.
export const COURSE_VERSION = 4;
// Openings narrower than this are merged into continuous ground, so a pit
// is never a seam the player cannot see. The intro ends at a clear first pit.
export const MIN_GAP = 16;
export const INTRO_END = 720;
export const FIRST_GAP = 40;
const EPS = 1e-8;
const SLOW_STEP = PERIOD * SLOW_SPEED;
const SPEED_DELTA = FAST_SPEED - SLOW_SPEED;

// Experiment v4: twenty four-hop ground-only motifs.
// Each step is [reference centre distance, platform half-width] in pixels.
// No new controls, moving platforms, hazards or timing changes.
export const MOTIFS = Object.freeze([
  {id:'cruise',        tier:0, steps:[[158,70],[168,70],[158,72],[172,74]]},
  {id:'long-short',    tier:0, steps:[[182,69],[131,68],[180,70],[130,70]]},
  {id:'short-long',    tier:0, steps:[[134,74],[180,68],[138,72],[177,70]]},
  {id:'rest-bay',      tier:0, steps:[[155,84],[143,90],[141,90],[164,80]]},
  {id:'narrow-gate',   tier:1, steps:[[165,66],[171,57],[164,67],[160,74]]},
  {id:'wide-exit',     tier:1, steps:[[174,54],[156,82],[174,58],[162,76]]},
  {id:'double-gap',    tier:1, steps:[[182,60],[180,59],[145,73],[149,78]]},
  {id:'close-pair',    tier:1, steps:[[128,65],[155,58],[135,66],[176,74]]},
  {id:'zigzag',        tier:1, steps:[[176,60],[138,66],[180,60],[135,70]]},
  {id:'triple-tap',    tier:1, steps:[[149,61],[151,61],[150,59],[181,77]]},
  {id:'needle',        tier:2, steps:[[177,53],[164,53],[151,73],[177,61]]},
  {id:'rebound',       tier:2, steps:[[123,60],[180,57],[124,60],[184,64]]},
  {id:'long-bridge',   tier:2, steps:[[187,57],[188,57],[134,79],[149,73]]},
  {id:'precision',     tier:2, steps:[[162,54],[173,56],[160,54],[175,56]]},
  {id:'offset-rest',   tier:2, steps:[[180,56],[136,86],[182,55],[141,82]]},
  {id:'throttle',      tier:2, steps:[[187,56],[136,57],[186,56],[142,60]]},
  {id:'double-needle',tier:3, steps:[[184,52],[181,52],[146,65],[172,59]]},
  {id:'pendulum',      tier:3, steps:[[128,54],[190,52],[126,54],[188,52]]},
  {id:'tight-flow',    tier:3, steps:[[169,52],[171,52],[172,52],[156,61]]},
  {id:'hairpin',       tier:3, steps:[[189,53],[127,55],[190,53],[129,61]]},
].map(m => Object.freeze({...m, steps: Object.freeze(m.steps.map(s => Object.freeze(s)))})));

export function motifTier(hop) {
  return hop < 32 ? 0 : hop < 64 ? 1 : hop < 120 ? 2 : 3;
}

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
    this.platforms = [[0, INTRO_END]];
    this.plan = new Map();
    this.planPositions = new Map();
    for (let hop = 1; hop <= 7; hop++) { this.plan.set(hop, 0); this.planPositions.set(hop, 75 + hop * PERIOD * SLOW_SPEED); }
    this.referenceX = 75 + 7 * PERIOD * SLOW_SPEED;
    this.beacons = [];
    this.motif = null; this.motifIndex = 4; this.motifs = []; this.motifGroups = 0;
    this.extendTo(1900);
  }
  chooseMotif() {
    const tier = motifTier(this.referenceHop + 1);
    const roll = this.random() % 100;
    const selectedTier = tier === 0 ? 0 : roll < 65 ? tier : roll < 90 ? tier - 1 : Math.max(0, tier - 2);
    const pool = MOTIFS.filter(m => m.tier === selectedTier);
    // One simple breathing passage every six four-hop motifs.
    const motif = this.motifGroups % 6 === 5 ? MOTIFS[3] : pool[this.random() % pool.length];
    this.motif = motif; this.motifIndex = 0; this.motifGroups += 1;
    this.motifs.push({hop: this.referenceHop + 1, x: this.referenceX, id: motif.id});
  }
  appendHop() {
    this.referenceHop += 1;
    let distance, halfWidth;
    if (this.referenceHop === 8) { distance = 160; halfWidth = 70; }
    else {
      if (this.motifIndex >= 4) this.chooseMotif();
      const [d, w] = this.motif.steps[this.motifIndex++];
      distance = d + (this.random() % 9) - 4;
      halfWidth = w + (this.random() % 5) - 2;
    }
    this.referenceX += distance;
    this.plan.set(this.referenceHop, (distance - SLOW_STEP) / SPEED_DELTA);
    this.planPositions.set(this.referenceHop, this.referenceX);
    const left = this.referenceHop === 8
      ? Math.max(this.referenceX - halfWidth, INTRO_END + FIRST_GAP)
      : this.referenceX - halfWidth;
    addPlatform(this.platforms,
      ensureNextHopMargin(this.platforms.at(-1), [left, this.referenceX + halfWidth]));
    if (this.referenceHop % 5 === 0) this.beacons.push({id: this.referenceHop, x: this.referenceX});
  }
  extendTo(worldX) {
    while (this.referenceX < worldX) {
      this.appendHop();
    }
  }
  trim(worldX) {
    this.platforms = this.platforms.filter(([a, b]) => b >= worldX - 400);
    this.beacons = this.beacons.filter(b => b.x >= worldX - 100);
    this.motifs = this.motifs.filter(m => m.x >= worldX - 400);
    for (const hop of this.plan.keys()) {
      if (this.planPositions.get(hop) < worldX - 400) { this.plan.delete(hop); this.planPositions.delete(hop); }
    }
  }
}
// Platforms stay sorted and separated by at least MIN_GAP of visible pit.
// Keep a 20px reachable landing interval even from either extreme edge of
// the preceding platform. Only widen a candidate when needed; a tiny seam may
// become continuous ground, but no invisible collision gap is introduced.
export function ensureNextHopMargin(previous, candidate, margin = 20) {
  const [a, b] = footing(previous);
  let [left, right] = candidate;
  const overlap = (x, [c, d]) =>
    Math.min(d - INSET, x + PERIOD * FAST_SPEED) - Math.max(c + INSET, x + SLOW_STEP);
  for (const x of [a, (a + b) / 2, b]) {
    if (overlap(x, previous) >= margin || overlap(x, [left, right]) >= margin) continue;
    left = Math.min(left, x + PERIOD * FAST_SPEED - margin - INSET);
    right = Math.max(right, x + SLOW_STEP + margin + INSET);
  }
  return [left, right];
}
export function addPlatform(platforms, [a, b]) {
  const last = platforms[platforms.length - 1];
  if (last && a - last[1] < MIN_GAP) last[1] = Math.max(last[1], b);
  else platforms.push([a, b]);
}
// The flat, lit top of a platform. Collision, the landing ring and the
// renderer all use this one interval; the outer INSET is drawn as a rim.
export function footing([a, b]) {
  return [a + INSET, b - INSET];
}
export function isSafe(terrain, x) {
  return terrain.platforms.some(platform => {
    const [left, right] = footing(platform);
    return x >= left - EPS && x <= right + EPS;
  });
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
