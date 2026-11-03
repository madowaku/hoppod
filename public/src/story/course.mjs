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
  // Hand-placed, three short lessons in the dark, one blue part after each:
  // narrow gaps to find the rhythm, wide gaps that need FAST, then short
  // landings after wide gaps where SLOW is the control. ~4000px to the light.
  c.plat(0, 420); c.checkpoint({ a: 0, b: 140 }, 'wake');
  const parts = [], run = list => { for (const [gap, width] of list) c.plat(gap, width); };
  run([[30, 200], [32, 190], [36, 180], [34, 170]]);
  let p = c.plat(38, 190); parts.push(Math.round((p.a + p.b) / 2));
  run([[70, 170], [78, 160], [84, 170], [76, 160]]);
  p = c.plat(82, 190); parts.push(Math.round((p.a + p.b) / 2)); c.checkpoint(p, 'wake');
  run([[60, 180], [92, 100], [40, 140], [96, 100], [44, 170]]);
  p = c.plat(60, 200); parts.push(Math.round((p.a + p.b) / 2));
  // The light opens: a wide, generous plain to feel how large the moon is.
  c.filler(12, r, [40, 64], [190, 260]);

  // ② APART: green lies here without its legs; its magnetic leg unit lies
  // 300px before it, so even at FAST it is fitted before the hero passes
  // green. Picked up, it flies ahead to green; green boots and joins.
  // Bring it to the socket and it becomes the bridge.
  c.chapter('apart');
  p = c.plat(50, 540); c.checkpoint({ a: p.a, b: p.a + 80 }, 'apart'); c.marks.greenMeet = p.a + 470; c.marks.greenKit = p.a + 170;
  c.filler(6, r, [40, 80], [150, 220]);
  // Long valley: stepping stones only a mostly-FAST rhythm can cross. Green
  // falls behind here (FAST outruns it), and on the rest ground after it the
  // relay antenna boosts it back. Seen before the socket: FAST leaves green
  // behind, SLOW lets it catch up.
  p = c.plat(50, 220); c.checkpoint(p, 'apart');
  c.marks.relays = [Math.round(p.a + 150)];
  for (let i = 0; i < 4; i++) c.plat(125, 70);
  c.plat(60, 200);
  c.plat(42, 72); c.plat(40, 70);
  p = c.plat(44, 300); c.marks.relays.push(Math.round(p.a + 170));
  c.filler(3, r, [40, 70], [150, 200]);
  // Socket field: one long ground, green's socket, then a chasm only the bridge spans.
  // Green's socket sits at the root of the bridge, 100px before the chasm:
  // green's legs hold the bridge up.
  p = c.plat(50, 840); c.checkpoint({ a: p.a, b: p.a + 160 }, 'apart');
  c.marks.switchX = p.b - 100; c.marks.fieldStart = p.a;
  // A last relay at the field's edge: a green far behind on the approach is
  // boosted back before the socket is in reach.
  c.marks.relays.push(p.a + 40);
  // 220px: both banks fit the framing view; still beyond a FAST hop (210px + footing).
  const chasm = c.plat(220, 320); c.marks.bridge = { a: p.b, b: chasm.a };
  c.filler(14, r, [44, 90], [130, 200]);

  // ③ RESCUE: red wakes at the crane; crossing leaves green far behind and red
  // breaks the range rule to fetch it.
  c.chapter('rescue');
  // Red sits at its console without its hook; the telescopic hook lies 300px
  // before it. Fitted, red walks along and works the crane with it.
  p = c.plat(50, 540); c.checkpoint({ a: p.a, b: p.a + 80 }, 'rescue'); c.marks.redConsole = p.a + 470; c.marks.redKit = p.a + 170;
  p = c.plat(46, 560); c.checkpoint({ a: p.a, b: p.a + 160 }, 'rescue');
  c.marks.crane = c.plat(100, 120, 'crane');
  // A long, safe landing: red looks back and leaves while the hero has
  // nothing to judge but plain ground.
  const far = c.plat(100, 420); c.marks.craneFar = far.a;
  // Red has left the crane by now: a fall beyond it never sends the hero back.
  c.checkpoint(far, 'rescue');
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
  // The bridge is solid as far as it has grown (bridgeTo, from the socket out).
  if (flags.bridgeTo > course.bridge.a && x >= course.bridge.a - INSET && x <= Math.min(course.bridge.b + INSET, flags.bridgeTo)) return { a: course.bridge.a, b: course.bridge.b, kind: 'bridge' };
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
