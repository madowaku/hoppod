// STORY fixed course: one hand-placed lunar road in five chapters. Unlike FREE
// RUN it is identical on every play, so a set piece can be rehearsed after a
// fall. Geometry uses the FREE RUN physics (speeds, inset footing) unchanged.
import { INSET, footing } from '../engine.mjs';

export const CHAPTERS = Object.freeze(['wake', 'apart', 'rescue', 'base', 'send']);

// Small deterministic generator so the filler never changes between plays.
function rng(seed) {
  let x = seed >>> 0 || 0x9e3779b9;
  return (lo, hi) => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return lo + (x >>> 0) % (hi - lo + 1); };
}

class Builder {
  constructor() { this.platforms = []; this.x = 0; this.marks = {}; this.chapters = []; this.checkpoints = []; }
  plat(gap, width, kind = 'ground') {
    const a = this.x + gap, p = { a, b: a + width, kind };
    this.platforms.push(p); this.x = p.b; return p;
  }
  filler(n, random, gap, width) {
    for (let i = 0; i < n; i++) this.plat(random(...gap), random(...width));
  }
  chapter(id) { this.chapters.push({ id, x: this.x }); }
  // Respawn lands on the centre of the platform's footing, always on a beat.
  checkpoint(p, chapter) { this.checkpoints.push({ x: Math.round((p.a + p.b) / 2), from: p.a, chapter }); }
}

export function buildCourse() {
  const c = new Builder(), r = rng(0x5ba9);
  // ① WAKE: dark, narrow. Only the hero's clockwork tick. Three blue parts.
  c.chapter('wake');
  c.plat(0, 620); c.checkpoint({ a: 0, b: 140 }, 'wake');
  const parts = [];
  c.filler(5, r, [34, 60], [140, 190]);
  let p = c.plat(50, 190); parts.push(Math.round((p.a + p.b) / 2));
  c.filler(7, r, [36, 66], [130, 180]);
  p = c.plat(48, 190); parts.push(Math.round((p.a + p.b) / 2)); c.checkpoint(p, 'wake');
  c.filler(7, r, [40, 70], [120, 170]);
  p = c.plat(50, 200); parts.push(Math.round((p.a + p.b) / 2));
  // The light opens: a wide, generous plain to feel how large the moon is.
  c.filler(12, r, [40, 64], [190, 260]);

  // ② APART: green joins; leave it on the switch to open the bridge.
  c.chapter('apart');
  p = c.plat(50, 420); c.checkpoint(p, 'apart'); c.marks.greenMeet = p.a + 300;
  c.filler(6, r, [40, 80], [150, 220]);
  // Long valley: two pits only FAST can clear, then islands that want SLOW.
  p = c.plat(50, 220); c.checkpoint(p, 'apart');
  c.plat(168, 150); c.plat(172, 160);
  c.plat(42, 72); c.plat(40, 70); c.plat(44, 74);
  c.plat(50, 260);
  c.filler(3, r, [40, 70], [150, 200]);
  // Switch field: one long ground, the switch, then a chasm only the bridge spans.
  p = c.plat(50, 1060); c.checkpoint({ a: p.a, b: p.a + 160 }, 'apart');
  c.marks.switchX = p.a + 620; c.marks.fieldStart = p.a;
  const chasm = c.plat(300, 320); c.marks.bridge = { a: p.b, b: chasm.a };
  c.filler(14, r, [44, 90], [130, 200]);

  // ③ RESCUE: red wakes at the crane; crossing leaves green far behind and red
  // breaks the range rule to fetch it.
  c.chapter('rescue');
  p = c.plat(50, 380); c.checkpoint(p, 'rescue'); c.marks.redConsole = p.a + 230;
  p = c.plat(46, 560); c.checkpoint({ a: p.a, b: p.a + 160 }, 'rescue');
  c.marks.crane = c.plat(100, 120, 'crane');
  const far = c.plat(100, 280); c.marks.craneFar = far.a;
  c.filler(18, r, [40, 80], [140, 210]);
  p = c.plat(50, 240); c.checkpoint(p, 'rescue');
  // Together again: a lively stretch for the three-part ensemble.
  c.filler(12, r, [50, 110], [110, 170]);

  // ④ BASE: each friend takes its station; the hero docks into the antenna.
  c.chapter('base');
  p = c.plat(50, 300); c.checkpoint(p, 'base');
  c.filler(5, r, [40, 70], [150, 200]);
  p = c.plat(50, 260); c.checkpoint(p, 'base');
  c.marks.stations = [];
  // Compact islands, so the whole base fits one view in the ending.
  for (const who of ['blue', 'green', 'red']) {
    const island = c.plat(who === 'blue' ? 70 : 60, 80, 'station'); island.who = who;
    c.marks.stations.push({ who, x: Math.round((island.a + island.b) / 2) });
  }
  c.marks.dock = c.plat(60, 110, 'dock');
  c.marks.dockX = Math.round((c.marks.dock.a + c.marks.dock.b) / 2);
  // Launch pad beyond the dock: scenery only, never reached.
  c.marks.rocketX = c.marks.dock.b + 110;
  c.marks.baseCenter = Math.round((c.marks.stations[0].x + c.marks.rocketX) / 2);
  return Object.freeze({
    platforms: c.platforms, chapters: c.chapters, checkpoints: c.checkpoints,
    parts, start: 70, ...c.marks,
  });
}

export const COURSE = buildCourse();

export function platformAt(course, x, beat = 0, flags = {}) {
  for (const p of course.platforms) {
    const [left, right] = footing([p.a, p.b]);
    if (x < left - 1e-8 || x > right + 1e-8) continue;
    if (p.kind === 'crane' && !flags.craneDown?.(beat)) continue;
    return p;
  }
  // The bridge is solid ground once the switch holds it open.
  if (flags.bridgeOpen && x >= course.bridge.a - INSET && x <= course.bridge.b + INSET) return { a: course.bridge.a, b: course.bridge.b, kind: 'bridge' };
  return null;
}
export function chapterAt(course, x) {
  let id = course.chapters[0].id;
  for (const ch of course.chapters) if (x >= ch.x) id = ch.id;
  return id;
}
// Centre of the first platform whose centre lies beyond x.
export function platformAhead(course, x) {
  const p = course.platforms.find(q => q.kind === 'ground' && (q.a + q.b) / 2 > x);
  return p ? Math.round((p.a + p.b) / 2) : x;
}
