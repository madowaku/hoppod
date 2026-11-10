// The moon's scenery, shared by the stages that travel across it: a deep sky
// with stars at several depths, Earth, ranges that fade with distance, a near
// plain with craters and the odd thing left behind, and the ground itself.
// Drawing only: nothing here knows about hops, footing or time signatures.
// Everything is a pure function of the camera and the clock, so a frame can
// be drawn again and look the same. Original pixel work, no external assets.

const hash = n => { let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); return ((x ^ (x >>> 16)) >>> 0) / 4294967296; };
const mix = (a, b, k) => a + (b - a) * k;
const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
export const blend = (a, b, k) => a.map((v, i) => mix(v, b[i], k));

// A sky's colour near the horizon and the glow that sits on it. The top of
// the sky is always the same deep blue; only its low edge changes with the
// place, so a chapter can have its own hour without changing the night.
export const MOODS = Object.freeze({
  night: { low: [28, 46, 84], glow: [86, 138, 214], range: [20, 30, 56], rim: [96, 128, 184] },
  violet: { low: [44, 40, 92], glow: [150, 122, 226], range: [26, 28, 60], rim: [128, 120, 198] },
  ember: { low: [58, 46, 80], glow: [255, 184, 128], range: [30, 28, 54], rim: [190, 150, 150] },
  teal: { low: [22, 52, 74], glow: [96, 186, 214], range: [16, 32, 50], rim: [96, 150, 178] },
});
export function blendMood(a, b, k) {
  return { low: blend(a.low, b.low, k), glow: blend(a.glow, b.glow, k), range: blend(a.range, b.range, k), rim: blend(a.rim, b.rim, k) };
}

// ---------- sky ----------
const WRAP = 420;
const TINTS = ['#c9d6f2', '#c9d6f2', '#dfe7ff', '#9fc4ff', '#ffe2a0', '#c9d6f2'];
// 96 field stars, thicker towards the zenith, then 70 small ones along a
// slanted band: the galaxy seen from a sky with no air in it.
const STARS = Array.from({ length: 166 }, (_, i) => {
  const u = hash(i * 5 + 1), v = hash(i * 5 + 2), k = hash(i * 5 + 3), band = i >= 96;
  const x = u * WRAP, y = band ? 46 + x * .34 + (v + hash(i * 5 + 4) - 1) * 44 : Math.pow(v, 1.35) * 310;
  return {
    x, y, band, size: band ? 1 : k < .07 ? 3 : k < .34 ? 2 : 1,
    light: band ? .22 + .3 * k : .4 + .6 * hash(i * 5 + 4),
    tint: TINTS[i % TINTS.length], depth: .02 + .04 * hash(i * 7), twinkle: hash(i * 11) < .3 ? 1 + hash(i * 13) * 2 : 0, phase: hash(i * 17) * 6.283,
  };
});
// open: 0 keeps the sky black (a place with no light yet), 1 shows all of it.
export function drawSky(g, { W = 360, horizon, cam = 0, time = 0, open = 1, still = false, mood = MOODS.night, stars = 1, cool = true }) {
  g.fillStyle = '#04060c'; g.fillRect(0, 0, W, horizon);
  if (open > 0) {
    const sky = g.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, '#060a18'); sky.addColorStop(.5, '#0c1630'); sky.addColorStop(1, rgb(mood.low));
    g.globalAlpha = open; g.fillStyle = sky; g.fillRect(0, 0, W, horizon);
    // The galaxy: a faint slanted band under its stars.
    g.save(); g.translate(W / 2, 120); g.rotate(.33);
    const way = g.createLinearGradient(0, -46, 0, 46);
    way.addColorStop(0, 'rgba(150,170,230,0)'); way.addColorStop(.5, 'rgba(150,170,230,.075)'); way.addColorStop(1, 'rgba(150,170,230,0)');
    g.fillStyle = way; g.fillRect(-W, -46, W * 2, 92); g.restore();
    // Light gathers on the horizon.
    const glow = g.createLinearGradient(0, horizon - 150, 0, horizon);
    glow.addColorStop(0, rgb(mood.glow, 0)); glow.addColorStop(1, rgb(mood.glow, .42));
    g.fillStyle = glow; g.fillRect(0, horizon - 150, W, 150);
    g.globalAlpha = 1;
  }
  const level = stars * (.3 + .7 * open);
  for (const st of STARS) {
    if (st.y > horizon - 8) continue;
    const x = (((st.x - cam * st.depth) % WRAP) + WRAP) % WRAP - 30;
    if (x < -4 || x > W + 4) continue;
    const blink = st.twinkle && !still ? .72 + .28 * Math.sin(time * st.twinkle + st.phase) : 1;
    // Stars thin out into the glow near the horizon.
    const fade = Math.min(1, (horizon - st.y) / 110);
    g.globalAlpha = Math.min(1, st.light * blink * level * (.35 + .65 * fade)) * (st.band ? open : 1);
    g.fillStyle = cool || st.tint !== '#9fc4ff' ? st.tint : '#c9d6f2';
    const px = x | 0, py = st.y | 0;
    if (st.size === 3) { g.fillRect(px - 2, py, 5, 1); g.fillRect(px, py - 2, 1, 5); g.fillRect(px - 1, py - 1, 3, 3); }
    else g.fillRect(px, py, st.size, st.size);
  }
  g.globalAlpha = 1;
  // Now and then a meteor: one every 19 seconds, each on its own short line.
  if (!still && open > .5) {
    const n = Math.floor(time / 19), k = (time - n * 19) / .8;
    if (k < 1 && hash(n * 31) > .35) {
      const x0 = 30 + hash(n * 37) * (W - 140), y0 = 20 + hash(n * 41) * 90, x = x0 + k * 96, y = y0 + k * 38;
      const trail = g.createLinearGradient(x - 44, y - 17, x, y);
      trail.addColorStop(0, 'rgba(255,255,255,0)'); trail.addColorStop(1, `rgba(255,255,255,${.8 * (1 - k) * open})`);
      g.strokeStyle = trail; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x - 44, y - 17); g.lineTo(x, y); g.stroke();
    }
  }
}

// ---------- Earth ----------
// Earth in 3px cells (2px when small): land and cloud from a fixed noise that
// drifts slowly, lit from the upper left, a thin rim of air. Painted to a
// small canvas of its own and repainted once a second, since it turns slowly.
const globes = new Map();
function paintGlobe(g, r, cell, t) {
  const drift = t * .02;
  g.clearRect(0, 0, r * 2 + 4, r * 2 + 4);
  for (let y = -r; y < r; y += cell) for (let x = -r; x < r; x += cell) {
    const nx = (x + cell / 2) / r, ny = (y + cell / 2) / r, d = nx * nx + ny * ny;
    if (d > 1) continue;
    const z = Math.sqrt(1 - d), u = Math.atan2(nx, z) + drift, v = Math.asin(ny);
    const land = Math.sin(u * 3.1 + 1.3) + Math.sin(v * 4.7 + u * 1.7) * .8 + Math.sin(u * 7.3 - v * 5.1) * .35 > .55;
    const cloud = Math.sin(u * 5.3 + v * 9.1 + 2) + Math.sin(v * 13 - u * 2.3) * .6 > 1.05;
    const light = Math.max(0, -.55 * nx - .5 * ny + .67 * z);
    const base = cloud ? [232, 242, 255] : land ? [96, 166, 104] : [44, 104, 186];
    const k = .28 + .82 * Math.min(1, light * 1.25);
    g.fillStyle = `rgb(${base[0] * k | 0},${base[1] * k | 0},${base[2] * k | 0})`;
    g.fillRect(Math.round(r + 2 + x), Math.round(r + 2 + y), cell, cell);
  }
}
export function drawGlobe(g, cx, cy, r, t = 0, { halo = 1 } = {}) {
  const cell = r >= 40 ? 3 : 2, key = r + ':' + cell;
  let globe = globes.get(key);
  if (!globe) {
    const canvas = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(r * 2 + 4, r * 2 + 4) : Object.assign(document.createElement('canvas'), { width: r * 2 + 4, height: r * 2 + 4 });
    globe = { canvas, g: canvas.getContext('2d'), at: null }; globes.set(key, globe);
  }
  if (globe.at === null || Math.abs(t - globe.at) >= 1) { paintGlobe(globe.g, r, cell, t); globe.at = t; }
  if (halo > 0) {
    const light = g.createRadialGradient(cx, cy, r * .8, cx, cy, r * 2.3);
    light.addColorStop(0, `rgba(86,146,255,${.32 * halo})`); light.addColorStop(1, 'rgba(86,146,255,0)');
    g.fillStyle = light; g.fillRect(cx - r * 2.3, cy - r * 2.3, r * 4.6, r * 4.6);
  }
  const smoothing = g.imageSmoothingEnabled; g.imageSmoothingEnabled = false;
  g.drawImage(globe.canvas, Math.round(cx - r - 2), Math.round(cy - r - 2));
  g.imageSmoothingEnabled = smoothing;
  g.strokeStyle = 'rgba(150,200,255,.55)'; g.lineWidth = r >= 40 ? 2 : 1.5;
  g.beginPath(); g.arc(cx, cy, r + 1, Math.PI * .75, Math.PI * 1.75); g.stroke();
}

// ---------- ranges ----------
// The far range's height at a world position: also where lights on its
// crest sit, so it is exported.
export const farRidge = wx => 50 + Math.sin(wx * .011) * 28 + Math.sin(wx * .037) * 10;
const roll = (wx, seed) => .5 + .3 * Math.sin(wx * .013 + seed) + .14 * Math.sin(wx * .041 + seed * 2.3) + .06 * Math.sin(wx * .11 + seed * 5.1);
// One silhouette in 3px columns, lit along its crest, paler towards its foot
// where dust hangs: that haze is what sets it behind the next one.
function range(g, W, { foot, height, tall = height * 1.05, cam, depth, seed, body, haze, rim, alpha = 1, shape = roll }) {
  const step = 3, tops = [];
  g.beginPath(); g.moveTo(-step, foot);
  for (let x = -step; x < W + step; x += step) {
    const y = Math.round((foot - height * shape(x + cam * depth, seed)) / 2) * 2;
    tops.push(y); g.lineTo(x, y); g.lineTo(x + step, y);
  }
  g.lineTo(W + step, foot); g.closePath();
  const top = foot - tall, fill = g.createLinearGradient(0, top, 0, foot);
  fill.addColorStop(0, rgb(body, alpha)); fill.addColorStop(1, rgb(haze, alpha));
  g.fillStyle = fill; g.fill();
  g.fillStyle = rgb(rim, alpha);
  tops.forEach((y, i) => {
    g.fillRect(-step + i * step, y, step, 1);
    // A step down to the right catches the light on its face too.
    if (i && tops[i - 1] > y) g.fillRect(-step + i * step, y, 1, Math.min(4, tops[i - 1] - y));
  });
}
// Things left on the plain, small and dark against it: rocks, a mast whose
// lamp still blinks, a dish, a crate. Scenery to notice, never to land on.
function relic(g, kind, x, y, time, still, lit) {
  const dark = '#0d1528', edge = `rgba(120,150,200,${.25 + .35 * lit})`;
  const px = (c, a, b, w, h) => { g.fillStyle = c; g.fillRect(Math.round(x + a), Math.round(y + b), w, h); };
  if (kind === 0) { px(dark, -7, -5, 9, 5); px(dark, 1, -8, 8, 8); px(edge, -7, -5, 9, 1); px(edge, 1, -8, 8, 1); px(dark, 10, -3, 4, 3); px(edge, 10, -3, 4, 1); }
  else if (kind === 1) {
    px(dark, 0, -26, 2, 26); px(dark, -4, -2, 10, 2); px(edge, 0, -26, 1, 24); px(dark, -3, -18, 8, 1);
    const on = still || Math.sin(time * 2.1 + x) > .3; px(on ? '#ffd9a0' : '#6a4a34', -1, -29, 4, 3);
  } else if (kind === 2) { px(dark, 0, -12, 2, 12); px(dark, -7, -18, 14, 3); px(dark, -5, -15, 10, 2); px(dark, -2, -13, 5, 2); px(edge, -7, -18, 14, 1); px(dark, 1, -22, 1, 4); px(dark, -4, -1, 10, 1); }
  else { px(dark, -6, -7, 12, 7); px(edge, -6, -7, 12, 1); px(dark, -8, -2, 16, 2); px('#3a4a70', -3, -5, 2, 2); px('#3a4a70', 2, -5, 2, 2); }
}
// Three ranges and the near plain. `floor` is the ground line; the plain
// reaches it and stops, so what lies below is only ever real ground or a pit.
// open fades the far ranges in (0: only the dark near shapes).
export function drawRanges(g, { W = 360, floor, cam = 0, time = 0, open = 1, still = false, mood = MOODS.night, far = true }) {
  const lit = open;
  if (far && open > 0) {
    // Farthest is palest: each range nearer is darker, the nearest almost
    // black, so the lit figures in front of it stand clear.
    const body = blend(mood.range, mood.low, .15), haze = blend(mood.range, mood.low, .7);
    range(g, W, { foot: floor - 40, height: 1, tall: 92, cam, depth: .015, seed: 0, body, haze, rim: mood.rim, alpha: open, shape: wx => farRidge(wx) });
    g.fillStyle = rgb(haze, open); g.fillRect(0, floor - 40, W, 40);
  }
  range(g, W, { foot: floor, height: 78, cam, depth: .04, seed: 1.7, body: blend([10, 15, 30], blend(mood.range, [8, 12, 26], .45), lit), haze: blend([10, 15, 30], blend(mood.range, [8, 12, 26], .2), lit), rim: blend([18, 26, 48], blend(mood.range, mood.rim, .45), lit) });
  range(g, W, { foot: floor, height: 46, cam, depth: .07, seed: 4.2, body: [12, 18, 37], haze: [15, 22, 44], rim: blend([20, 28, 50], blend(mood.range, mood.rim, .3), lit) });
  // The near plain is pocked with craters: bowls with a lit far rim.
  const span = 70, loop = span * 7;
  for (let i = -1; i < 7; i++) {
    const x = ((i * span - cam * .07) % loop + loop) % loop - span, w = 14 + (i * 37 % 5) * 5, y = floor - 10 - (i * 13 % 3) * 5;
    g.fillStyle = '#0b1226'; g.beginPath(); g.ellipse(x, y, w, w * .22, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = rgb(mood.rim, .14 + .3 * lit); g.fillRect(Math.round(x - w * .6), Math.round(y + w * .2 - 1), Math.round(w * 1.2), 1);
  }
  // One thing left behind every few screens.
  const gap = 310, first = Math.floor((cam * .07 - 40) / gap);
  for (let n = first; n <= first + 2; n++) {
    const pick = hash(n * 53 + 7);
    if (pick > .62) continue;
    relic(g, Math.floor(pick / .62 * 4), n * gap + 120 + hash(n * 59) * 90 - cam * .07, floor - 4 - Math.floor(hash(n * 61) * 3) * 4, time, still, lit);
  }
}

// ---------- ground ----------
// A block of the moon between two pits, from its lit top to the bottom of
// the view. The top `cap` rows are the footing and keep one flat, bright
// colour; everything that makes it rock (layers, stones, the dark creeping up
// from below) starts under them, so where to land reads as before.
export const GROUND = Object.freeze({ cap: '#dfe5d6', lip: '#a9b6b4', shade: '#6d7fa0', body: [52, 68, 100], deep: [16, 22, 40], side: '#28344f' });
export function drawGround(g, { left, right, floor, bottom, world = 0, cap = GROUND.cap, inset = 0 }) {
  const w = right - left;
  if (w <= 0) return;
  const body = g.createLinearGradient(0, floor, 0, floor + 128);
  body.addColorStop(0, rgb(GROUND.body)); body.addColorStop(1, rgb(GROUND.deep));
  g.fillStyle = body; g.fillRect(left, floor, w, bottom - floor);
  if (inset) {
    const side = g.createLinearGradient(0, floor, 0, floor + 128);
    side.addColorStop(0, GROUND.side); side.addColorStop(1, rgb(GROUND.deep));
    g.fillStyle = side; g.fillRect(left - inset, floor + 6, inset, bottom - floor); g.fillRect(right, floor + 6, inset, bottom - floor);
  }
  g.fillStyle = cap; g.fillRect(left, floor, w, 6);
  g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(left, floor, w, 1);
  g.fillStyle = GROUND.shade; g.fillRect(left, floor + 6, w, 8);
  g.fillStyle = 'rgba(16,24,44,.35)'; g.fillRect(left, floor + 12, w, 2);
  // Layers and buried stones, fixed to the world so they scroll with it.
  const seed = Math.round(world);
  for (let k = 0; k < 4; k++) {
    const y = floor + 24 + k * 22 + Math.floor(hash(seed + k * 3) * 8);
    g.fillStyle = `rgba(12,18,36,${.34 - k * .05})`;
    for (let x = left + 2 + Math.floor(hash(seed + k) * 14); x < right - 6; x += 30 + Math.floor(hash(seed + k * 7 + x - left) * 22)) g.fillRect(x, y, Math.min(right - 3 - x, 9 + Math.floor(hash(seed + x - left + k) * 16)), 2);
  }
  for (let x = left + 9, i = 0; x < right - 8; x += 26, i++) {
    const y = floor + 19 + Math.floor(hash(seed + i * 5 + 2) * 30);
    g.fillStyle = 'rgba(150,170,205,.2)'; g.fillRect(x, y, 4, 2);
    g.fillStyle = 'rgba(10,16,32,.4)'; g.fillRect(x, y + 2, 4, 1);
  }
  // The edge towards Earth catches a little of its light.
  g.fillStyle = 'rgba(150,180,230,.18)'; g.fillRect(left, floor + 14, 1, Math.min(90, bottom - floor - 14));
}
// The pit: black, with the faintest depth so it is a hole and not a void.
export function drawPit(g, { W = 360, floor, bottom }) {
  const pit = g.createLinearGradient(0, floor, 0, bottom);
  pit.addColorStop(0, '#04070e'); pit.addColorStop(1, '#010204');
  g.fillStyle = pit; g.fillRect(0, floor, W, bottom - floor);
}

// ---------- small things ----------
// Dust kicked up by a landing: a few grains that slide outwards along the
// ground and settle. age in seconds; gone after DUST.
export const DUST = .42;
export function drawDust(g, x, y, age, colors = ['#e8ecdf', '#b9c4cf']) {
  if (age < 0 || age >= DUST) return;
  const k = age / DUST, out = 1 - (1 - k) ** 2;
  for (let i = 0; i < 6; i++) {
    const side = i % 2 ? 1 : -1, reach = 7 + (i >> 1) * 6, lift = Math.sin(k * Math.PI) * (3 + (i >> 1) * 2.5);
    g.globalAlpha = (1 - k) * (.75 - (i >> 1) * .15); g.fillStyle = colors[i % colors.length];
    g.fillRect(Math.round(x + side * (4 + reach * out)), Math.round(y - lift), 2, 2);
  }
  g.globalAlpha = (1 - k) * .4; g.fillStyle = colors[0];
  g.fillRect(Math.round(x - 6 - 10 * out), Math.round(y), Math.round(12 + 20 * out), 1);
  g.globalAlpha = 1;
}
// The hero's shadow on the ground beneath it: wide on the ground, small at
// the top of a hop. lift 0 to 1.
// Motes of dust hanging in a small light, around (x, y): they drift a little
// and brighten with `pulse` (0 to 1). In a dark place they are the air.
export function drawMotes(g, x, y, radius, time, pulse = 0, alpha = 1, still = false) {
  for (let i = 0; i < 9; i++) {
    const a = hash(i * 71) * 6.283, d = radius * (.25 + .7 * hash(i * 73)), t = still ? 0 : time * (.25 + hash(i * 79) * .3);
    const mx = x + Math.cos(a + t * .6) * d, my = y + Math.sin(a * 1.7 + t) * d * .55 - 8;
    g.globalAlpha = alpha * (.16 + .3 * pulse) * (1 - d / radius * .6); g.fillStyle = i % 3 ? '#cfe2ee' : '#ffe6b0';
    g.fillRect(Math.round(mx), Math.round(my), i % 4 ? 1 : 2, i % 4 ? 1 : 2);
  }
  g.globalAlpha = 1;
}
export const speck = hash;
export function drawShadow(g, x, y, lift, alpha = .34) {
  const w = Math.round(11 - 5 * lift);
  g.fillStyle = `rgba(6,10,22,${alpha * (1 - .45 * lift)})`;
  g.fillRect(Math.round(x) - w, y, w * 2, 2); g.fillRect(Math.round(x) - w + 2, y + 2, w * 2 - 4, 1);
}

// A landing held by the edge alone (a stage's edge grace): the hero leans out
// over the hole, rocks back and stands, while a few crumbs drop off the edge.
// side is -1 or 1; age in seconds since that landing; over after WOBBLE.
export const WOBBLE = .36;
export const wobbleLean = (side, age) => side && age >= 0 && age < WOBBLE ? side * .24 * Math.cos(age / WOBBLE * Math.PI * 1.5) * (1 - age / WOBBLE) : 0;
// Runs draw() leaning by `lean` radians about the feet at (x, y).
export function leaning(g, x, y, lean, draw) {
  if (!lean) return draw();
  g.save(); g.translate(Math.round(x), Math.round(y)); g.rotate(lean); g.translate(-Math.round(x), -Math.round(y)); draw(); g.restore();
}
export function drawCrumbs(g, x, y, side, age) {
  if (!side || age < 0 || age >= WOBBLE * 1.4) return;
  g.fillStyle = '#e8ecdf';
  for (let i = 0; i < 3; i++) {
    g.globalAlpha = Math.max(0, 1 - age / (WOBBLE * 1.4));
    g.fillRect(Math.round(x + side * (8 + i * 3 + age * (14 + i * 9))), Math.round(y + 1 + age * age * (240 + i * 60) - i * 2), 2, 2);
  }
  g.globalAlpha = 1;
}
