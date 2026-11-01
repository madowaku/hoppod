// v0.4-C2 companion parts. A crew member is built from parts resting on the
// lunar footing; landing close to one collects it. This layer only reads
// geometry from its own shadow Terrain and the player's landing x, so the
// game's terrain RNG, physics, collision and score are untouched.
import { PERIOD, SLOW_SPEED, FAST_SPEED, Terrain, footing, hashSeed } from './engine.mjs';
import { COMPANION_PALETTE } from './companion.mjs';

// Playtest knobs. CATCH: ±px around a part that counts as landing on it.
// MARGIN: the reference detour through a part stays this far from pure SLOW
// or full FAST. EDGE: parts rest this far inside the lit footing.
export const PART_CATCH = 20, PART_MARGIN = 8, PART_EDGE = 12, PART_JITTER = 24;
// First part between these HOPS, later ones after these gaps; a missed part
// returns at the next slot. Ideal play completes a crew around 80 HOPS.
export const PART_FIRST = [22, 34], PART_GAP = [22, 32];
// Future crews (green, purple…) only need another entry here.
export const CREWS = Object.freeze([
  Object.freeze({ id: 'blue', label: 'BLUE POD', palette: COMPANION_PALETTE, parts: Object.freeze(['antenna', 'body', 'engine']) }),
]);
export const PART_LABELS = Object.freeze({ antenna: 'ANTENNA', body: 'BODY', engine: 'ENGINE' });
const SLOW_STEP = PERIOD * SLOW_SPEED, FAST_STEP = PERIOD * FAST_SPEED;
export const comfortable = distance => distance >= SLOW_STEP + PART_MARGIN && distance <= FAST_STEP - PART_MARGIN;

// Independent of the terrain generator's stream (mulberry32).
function generator(seed) {
  let a = seed >>> 0;
  return () => {
    a = a + 0x6d2b79f5 >>> 0;
    let t = Math.imul(a ^ a >>> 15, a | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return (t ^ t >>> 14) >>> 0;
  };
}
// Where parts may appear for one seed. Slot k is fixed for the seed; what it
// holds depends on what the run still lacks.
export class PartLayout {
  constructor(seed, crew = CREWS[0]) {
    this.random = generator(hashSeed('parts:' + (seed >>> 0)));
    this.terrain = new Terrain(seed);
    this.crew = crew;
    const order = [...crew.parts];
    for (let i = order.length - 1; i > 0; i--) { const j = this.random() % (i + 1); [order[i], order[j]] = [order[j], order[i]]; }
    this.order = Object.freeze(order);
    this.slots = [];
    this.nextHop = this.range(PART_FIRST);
  }
  range([low, high]) { return low + this.random() % (high - low + 1); }
  slot(index) {
    while (this.slots.length <= index) this.slots.push(this.place());
    return this.slots[index];
  }
  place() {
    for (let hop = this.nextHop; ; hop++) {
      // Every fifth reference hop carries a gold beacon; keep them apart.
      if (hop % 5 === 0) continue;
      const x = this.spot(hop);
      if (x === null) continue;
      this.nextHop = hop + this.range(PART_GAP);
      return Object.freeze({ hop, x });
    }
  }
  // A part sits near reference landing `hop`, on its footing, reachable from
  // the previous reference landing and leaving the next one reachable, both
  // with comfortable FAST/SLOW margins.
  spot(hop) {
    const t = this.terrain;
    while (!t.planPositions.has(hop + 1)) t.extendTo(t.referenceX + 400);
    const prev = t.planPositions.get(hop - 1), here = t.planPositions.get(hop), next = t.planPositions.get(hop + 1);
    const ground = t.platforms.map(footing).find(([l, r]) => here >= l && here <= r);
    const offsets = Array.from({ length: 6 }, () => this.random() % (PART_JITTER * 2 + 1) - PART_JITTER);
    for (const offset of [...offsets, 0]) {
      const x = here + offset;
      if (x - ground[0] < PART_EDGE || ground[1] - x < PART_EDGE) continue;
      if (comfortable(x - prev) && comfortable(next - x)) return x;
    }
    return null;
  }
}
// One run's progress. Each landing either collects the active part, passes
// it (it waits for the next slot), or leaves it ahead.
export class PartRun {
  constructor(layout) {
    this.layout = layout; this.index = 0; this.collected = []; this.completedAt = null;
  }
  get complete() { return this.completedAt !== null; }
  get missing() { return this.layout.order.filter(part => !this.collected.includes(part)); }
  get active() {
    if (this.complete) return null;
    return { ...this.layout.slot(this.index), part: this.missing[0] };
  }
  land(x, hops) {
    let slot = this.active, missed = null;
    while (slot && x > slot.x + PART_CATCH) { missed = slot.part; this.index += 1; slot = this.active; }
    if (slot && Math.abs(x - slot.x) <= PART_CATCH) {
      this.collected.push(slot.part); this.index += 1;
      if (!this.missing.length) this.completedAt = hops;
      return { type: 'collect', part: slot.part, x: slot.x, complete: this.complete };
    }
    return missed ? { type: 'miss', part: missed } : null;
  }
}

// Original 7 × 8 pixel parts, recoloured from the crew palette.
const SPRITES = {
  antenna: ['oo...oo', 'oa...ao', 'oc...co', 'oc...co', 'oc...co', 'ooooooo', 'occccso', 'ooooooo'],
  body: ['.ooooo.', 'owwccso', 'ocdddso', 'ocdddso', 'ocdddso', 'occccso', '.ooooo.', '.......'],
  engine: ['.ooooo.', 'oaaaaao', '.ooooo.', '..sss..', '.s...s.', '..sss..', '.ooooo.', 'oaaaaao'],
};
export function drawPart(g, part, x, y, scale = 2, palette = COMPANION_PALETTE, alpha = 1) {
  const colors = { o: '#172638', d: '#172638', ...palette };
  g.save(); g.globalAlpha = alpha;
  SPRITES[part].forEach((row, py) => [...row].forEach((p, px) => {
    if (!colors[p]) return;
    g.fillStyle = colors[p]; g.fillRect(Math.round(x + (px - 3.5) * scale), Math.round(y + (py - 8) * scale), scale, scale);
  }));
  g.restore();
}
