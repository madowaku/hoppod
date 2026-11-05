// Workshop drawing. Readability first, per the RAPIPPO art direction: the lit top
// of whatever can be landed on always wins. There is no landing marker; the
// cart's seven painted positions are part of the instrument. No external assets.
import { drawPod } from '../pod.mjs';
import { PERIOD as BEAT } from '../engine.mjs';
import { COURSE, CART_HALF, ROD_LENGTH, STRING_SPACING, HOP_MIN, U } from './course.mjs';
import { lightLevel } from './sim.mjs';

export const W = 360, H = 510, FLOOR = 382;
const smooth = (a, b, x) => { const k = Math.max(0, Math.min(1, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
const rect = (g, c, x, y, w, h) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
const STARS = Array.from({ length: 70 }, (_, i) => [(i * 137.5) % 900, (i * 71.3) % 210, i % 7 ? 1 : 2, i]);
export const TONGUE_COLOR = Object.freeze({ B: '#7cc4ff', E: '#ff9a7c', G: '#8fe59b', D: '#f4d06f', A: '#c9a4ff' });
const TINT = {
  hall: ['#141320', '#0d0c17'], drums: ['#241722', '#120c15'], tongue: ['#132126', '#0b1418'], keys: ['#1d1a26', '#0f0d16'], harp: ['#1a1c2f', '#0d0e1c'],
  strings: ['#201a24', '#100c14'], wood: ['#1b2019', '#0d110c'], bellows: ['#27191c', '#120b0e'], brass: ['#2a2014', '#140f09'], cymbal: ['#07070c', '#040408'], metronome: ['#1a1622', '#0b0a14'],
};

export function drawBackdrop(g, cam, id, s, reduced) {
  const [top, low] = TINT[id] || TINT.hall;
  const sky = g.createLinearGradient(0, 0, 0, FLOOR);
  sky.addColorStop(0, low); sky.addColorStop(1, top);
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  // A long window on to the moon's night, the same sky as the rest of the world.
  g.fillStyle = '#0a1320'; g.fillRect(0, 34, W, 148);
  for (const [x, y, size, i] of STARS) {
    const px = ((x - cam * .03) % 900 + 900) % 900;
    if (px > W) continue;
    g.globalAlpha = reduced ? .55 : .4 + .35 * Math.sin(s * .9 + i);
    rect(g, '#dfe9ff', px, 40 + y * .62, size, size);
  }
  g.globalAlpha = 1;
  const ex = ((300 - cam * .012) % 480 + 480) % 480 - 60;
  g.fillStyle = '#2f6aa6'; g.beginPath(); g.arc(ex, 88, 19, 0, 7); g.fill();
  g.fillStyle = '#7fc7a0'; g.beginPath(); g.arc(ex - 5, 83, 7, 0, 7); g.arc(ex + 8, 94, 5, 0, 7); g.fill();
  g.strokeStyle = '#9fd0ff55'; g.lineWidth = 2; g.beginPath(); g.arc(ex, 88, 20, 0, 7); g.stroke();
  // Window frames and shelves slide past slower than the floor.
  const frame = -(cam * .35 % 96);
  for (let x = frame - 96; x < W; x += 96) { rect(g, '#1c1a26', x, 34, 7, 148); rect(g, '#2a2736', x + 2, 34, 2, 148); }
  rect(g, '#2a2736', 0, 30, W, 5); rect(g, '#2a2736', 0, 180, W, 5);
  // The wall below the window, with a slow row of gears.
  rect(g, top, 0, 185, W, FLOOR - 185);
  const gear = -(cam * .45 % 148);
  for (let k = -1; k < 4; k++) drawGear(g, gear + k * 148 + 40, 290, 34, cam * .004 + k, '#ffffff0c');
  rect(g, low, 0, FLOOR + 16, W, H - FLOOR);
}
function drawGear(g, x, y, r, a, color) {
  g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = color;
  g.beginPath(); g.arc(0, 0, r * .72, 0, 7); g.fill();
  for (let k = 0; k < 8; k++) { g.rotate(Math.PI / 4); g.fillRect(-4, -r, 8, r * .4); }
  g.restore();
}
// A silhouette of the instrument behind its station.
export function drawStationBack(g, cam, id, from, to) {
  // Behind the floor it slides at under half speed, centred mid-station.
  const x = W / 2 + ((from + to) / 2 - cam - W / 2) * .28;
  const c = '#ffffff0e';
  g.fillStyle = c;
  if (id === 'drums') { g.beginPath(); g.ellipse(x, 300, 90, 28, 0, 0, 7); g.fill(); g.fillRect(x - 90, 300, 180, 80); }
  if (id === 'tongue') { g.beginPath(); g.ellipse(x, 340, 120, 60, 0, Math.PI, 0); g.fill(); }
  if (id === 'keys') { g.fillRect(x - 170, 240, 340, 130); g.fillRect(x - 150, 200, 300, 40); }
  if (id === 'harp') { g.beginPath(); g.moveTo(x - 90, 370); g.lineTo(x - 70, 200); g.quadraticCurveTo(x + 30, 200, x + 80, 300); g.lineTo(x + 90, 370); g.fill(); }
  if (id === 'strings') { g.beginPath(); g.ellipse(x, 320, 60, 54, 0, 0, 7); g.ellipse(x, 245, 42, 40, 0, 0, 7); g.fill(); g.fillRect(x - 4, 150, 8, 70); }
  if (id === 'wood') { g.save(); g.translate(x, 300); g.rotate(-.5); g.fillRect(-170, -9, 340, 18); g.restore(); }
  if (id === 'bellows') for (let k = -5; k <= 5; k++) g.fillRect(x + k * 22 - 8, 250 + (k % 2 ? 5 : 0), 14, 120 - (k % 2 ? 10 : 0));
  if (id === 'brass') { g.beginPath(); g.moveTo(x - 200, 250); g.lineTo(x + 120, 250); g.lineTo(x + 180, 215); g.lineTo(x + 180, 305); g.lineTo(x + 120, 270); g.lineTo(x - 200, 270); g.fill(); }
}
const TOP = { plain: ['#3a3f50', '#c5cedc'], drum: ['#5b2a2e', '#ffcf9e'], tongue: ['#27424a', '#9fe2d8'], stone: ['#35402e', '#c8dca8'], pad: ['#40303a', '#e9c4d9'], cymbal: ['#574314', '#ffe27a'], rung: ['#6a4a1f', '#ffd98a'], tip: ['#6a4a1f', '#ffd98a'] };
export function drawPlatforms(g, cam, run, s, rings, darkness = 0) {
  for (const p of COURSE.platforms) {
    const x = p.a - cam, w = p.b - p.a;
    if (x > W + 20 || x + w < -20) continue;
    const ring = rings.get(p.i), age = ring === undefined ? 9 : s - ring, hit = Math.max(0, 1 - age / .35);
    if (p.kind === 'key') { drawKey(g, p, x, w, hit, s); continue; }
    if (p.kind === 'res') { drawResPlate(g, p, x, w, run, s, hit); continue; }
    if (p.kind === 'push' || p.kind === 'pull') { drawBellowsPlate(g, p, x, w, run, hit); continue; }
    const [body, top] = TOP[p.kind] || TOP.plain;
    const y = FLOOR - (p.h || 0);
    if (p.kind === 'rung' || p.kind === 'tip') continue;
    rect(g, body, x, y, w, H - y);
    if (p.kind === 'drum') drawDrum(g, p, x, w, hit, s);
    else if (p.kind === 'tongue') drawTongue(g, p, x, w, hit, s);
    else if (p.kind === 'cymbal') drawCymbal(g, p, x, w, hit, s);
    else rect(g, top, x + (p.flush ? 0 : 3), y, w - (p.flush ? 0 : 6), 3);
    if (p.kind === 'plain' || p.kind === 'stone' || p.kind === 'pad') rect(g, '#00000040', x, y + 3, w, 3);
  }
  // Edges stay readable in the dark: a faint line along each platform top.
  if (darkness > .01) for (const p of COURSE.platforms) {
    const x = p.a - cam, w = p.b - p.a;
    if (x > W + 20 || x + w < -20 || p.kind === 'rung' || p.kind === 'tip') continue;
    g.globalAlpha = .28 * darkness + (p.kind === 'cymbal' ? .2 * darkness : 0); rect(g, p.kind === 'cymbal' ? '#ffe27a' : '#c5cedc', x + 3, FLOOR, w - 6, 1); g.globalAlpha = 1;
  }
}
function drawDrum(g, p, x, w, hit, s) {
  const color = { kick: '#c9463f', snare: '#e8e0cf', block: '#b98a4e' }[p.voice], dent = hit * 4;
  rect(g, '#00000045', x, FLOOR + 6, w, 20);
  rect(g, color, x + 1, FLOOR + 4 + dent, w - 2, 7);
  for (let k = 6; k < w; k += 14) rect(g, '#f2c07a66', x + k, FLOOR + 11, 2, 16);
  rect(g, '#fff6e4', x + 3, FLOOR + dent * .6, w - 6, 3);
  if (hit) { g.globalAlpha = hit * .55; rect(g, color, x, FLOOR - 24 * hit, w, 3); g.globalAlpha = 1; }
}
function drawTongue(g, p, x, w, hit, s) {
  const c = TONGUE_COLOR[p.name], wob = hit ? Math.sin(s * 44) * 3 * hit : 0;
  rect(g, '#1a2c31', x, FLOOR + 5, w, 30);
  g.fillStyle = c; g.beginPath(); g.moveTo(x + 2, FLOOR + 5); g.lineTo(x + w - 2, FLOOR + 5 + wob); g.lineTo(x + w - 2, FLOOR + 9 + wob); g.lineTo(x + 2, FLOOR + 9); g.fill();
  rect(g, '#e8fff8', x + 3, FLOOR, w - 6, 3);
  rect(g, c, x + w / 2 - 5, FLOOR + 12, 10, 10);
  if (hit) { g.strokeStyle = c; g.globalAlpha = hit; g.lineWidth = 2; g.beginPath(); g.ellipse(x + w / 2, FLOOR, (1 - hit) * 60 + 8, (1 - hit) * 16 + 2, 0, 0, 7); g.stroke(); g.globalAlpha = 1; }
}
function drawResPlate(g, p, x, w, run, s, hit) {
  const on = run.resonance.includes(p.name) || (run.fails[run.checkpoint] || 0) >= 3, c = TONGUE_COLOR[p.name];
  if (on) {
    rect(g, '#1a2c31', x, FLOOR + 3, w, 26); rect(g, c, x, FLOOR, w, 4);
    g.globalAlpha = .28 + .16 * Math.sin(s * 8); rect(g, c, x, FLOOR - 7, w, 7); g.globalAlpha = 1;
  } else {
    // Asleep: only its colour outlined. Nothing here can be stood on.
    g.strokeStyle = c; g.globalAlpha = .55; g.lineWidth = 1; g.setLineDash([3, 4]); g.strokeRect(Math.round(x) + .5, FLOOR + .5, w - 1, 12); g.setLineDash([]); g.globalAlpha = 1;
  }
}
function drawKey(g, p, x, w, hit, s) {
  const dip = hit * 5;
  rect(g, '#1e1b24', x, FLOOR + 40, w, H - FLOOR - 40);
  rect(g, '#efe7d6', x + .5, FLOOR + dip, w - 1, 40 - dip);
  rect(g, '#ffffff', x + 1, FLOOR + dip, w - 2, 2);
  rect(g, '#b8ad95', x, FLOOR, 1, 40);
  // Black keys sit on the wall behind: scenery that keeps the keyboard readable.
  const fifth = p.key % 7;
  if (fifth !== 2 && fifth !== 6) rect(g, '#191620', x + w - 8, FLOOR - 2, 16, 21);
  // The one black key that is lit: the borrowed note in the song.
  if (p.key % 14 === 10) { rect(g, '#f0c67a', x + w - 8, FLOOR - 2, 16, 3); }
  if (hit) { g.globalAlpha = hit * .4; rect(g, '#f0c67a', x, FLOOR - 26 * hit, w, 2); g.globalAlpha = 1; }
}
function drawBellowsPlate(g, p, x, w, run, hit) {
  const push = p.kind === 'push', c = push ? '#f2b84b' : '#68aef0', dark = push ? '#5a3e12' : '#1c3d5f';
  rect(g, dark, x, FLOOR + 3, w, 30);
  for (let k = 4; k < w - 2; k += 10) rect(g, c, x + k, FLOOR + 8 + (k % 20 ? 3 : 0) - hit * 3, 2, 22);
  rect(g, c, x + 2, FLOOR, w - 4, 4);
  rect(g, '#ffffffaa', x + 4, FLOOR, w - 8, 1);
  g.fillStyle = '#0b0a14'; g.font = 'bold 9px monospace'; g.textAlign = 'center';
  g.fillText(push ? '»' : '·', x + w / 2, FLOOR + 22);
}
function drawCymbal(g, p, x, w, hit, s) {
  const tilt = hit ? Math.sin(s * 30) * 2.5 * hit : 0;
  rect(g, '#2a2108', x + w / 2 - 2, FLOOR + 6, 4, 34);
  g.fillStyle = '#d9a93a'; g.beginPath(); g.moveTo(x + 1, FLOOR + 5 + tilt); g.quadraticCurveTo(x + w / 2, FLOOR - 3, x + w - 1, FLOOR + 5 - tilt); g.closePath(); g.fill();
  rect(g, '#ffe27a', x + 3, FLOOR, w - 6, 3);
}
// Strings hang above their station. A bright one has just rung.
export function drawHarp(g, cam, run, s, plucks) {
  const { from, to } = COURSE.harp;
  if (from - cam > W || to - cam < 0) return;
  const first = Math.ceil(Math.max(from, cam) / STRING_SPACING), last = Math.floor(Math.min(to, cam + W) / STRING_SPACING);
  for (let k = first; k <= last; k++) {
    const x = k * STRING_SPACING - cam, age = plucks.has(k) ? s - plucks.get(k) : 9, hit = Math.max(0, 1 - age / .6);
    const wob = hit ? Math.sin(s * 70 + k) * 2 * hit : 0;
    g.strokeStyle = hit ? '#fff1c9' : '#d9b56a'; g.globalAlpha = hit ? 1 : .55; g.lineWidth = hit ? 2 : 1;
    g.beginPath(); g.moveTo(x, 186); g.quadraticCurveTo(x + wob, 228, x, 268); g.stroke(); g.globalAlpha = 1;
    rect(g, hit ? '#fff1c9' : '#b6934d', x - 1, 266, 3, 3);
  }
  rect(g, '#7a5a2a', Math.max(0, from - cam), 182, Math.min(W, to - cam) - Math.max(0, from - cam), 5);
  rect(g, '#d9b56a', Math.max(0, from - cam), 182, Math.min(W, to - cam) - Math.max(0, from - cam), 2);
}
export function drawStrings(g, cam, run, s, plucks) {
  COURSE.strings.forEach((sx, i) => {
    const x = sx - cam; if (x < -20 || x > W + 20) return;
    const age = plucks.has('s' + i) ? s - plucks.get('s' + i) : 9, hit = Math.max(0, 1 - age / .8), wob = hit ? Math.sin(s * 60) * 5 * hit : 0;
    g.strokeStyle = hit ? '#ffe1f0' : '#d59ab8'; g.lineWidth = hit ? 2 : 1;
    g.beginPath(); g.moveTo(x, 186); g.quadraticCurveTo(x + wob, 205, x, 228); g.stroke();
    g.fillStyle = hit ? '#fff' : '#e9c4d9'; g.beginPath(); g.arc(x, 228, 4, 0, 7); g.fill();
    rect(g, '#5a3a4a', x - 12, 182, 24, 5);
  });
}
export function drawCart(g, cam, run, s, target, on) {
  const c = run.cart, x = c.x - cam;
  if (x < -CART_HALF - 20 || x > W + CART_HALF + 20) return;
  // Rails run the whole way, so the world still passes at the cart's own speed.
  const r0 = Math.max(0, COURSE.cart.x0 - CART_HALF - cam), r1 = Math.min(W, COURSE.cart.x1 + CART_HALF - cam);
  if (r1 > r0) { rect(g, '#50422a', r0, FLOOR + 36, r1 - r0, 4); for (let k = -((cam) % 42); k < W; k += 42) if (k >= r0 && k <= r1) rect(g, '#2a2214', k, FLOOR + 40, 8, 6); }
  rect(g, '#3c2d16', x - CART_HALF, FLOOR + 4, CART_HALF * 2, 28);
  rect(g, '#e8b95a', x - CART_HALF, FLOOR, CART_HALF * 2, 4);
  for (const wheel of [-120, -40, 40, 120]) { g.fillStyle = '#20180c'; g.beginPath(); g.arc(x + wheel, FLOOR + 34, 8, 0, 7); g.fill(); g.fillStyle = '#d9a93a'; g.fillRect(x + wheel - 1 + Math.sin(s * 8) * 4, FLOOR + 33, 2, 2); }
  // Seven painted positions: the slide's own scale, not a landing guide.
  for (let k = -3; k <= 3; k++) {
    const px = x + k * U * 1.5, big = k === 0;
    rect(g, big ? '#fff1c9' : '#b18a3f', px - 1, FLOOR + 4, 2, big ? 18 : 11);
    g.fillStyle = '#fff1c9aa'; g.font = 'bold 8px monospace'; g.textAlign = 'center'; g.fillText(String(k + 4), px, FLOOR + 30);
  }
  if (on && target !== null) { g.globalAlpha = .55 + .25 * Math.sin(s * 8); rect(g, '#fff1c9', x + target - 24, FLOOR + 1, 48, 2); g.globalAlpha = 1; }
}
export function drawSlideOnHero(g, cam, run, heroScreenX, heroY) {
  // The slide: it reaches from the hero to the bell at the cart's front.
  const bell = run.cart.x + CART_HALF - 18 - cam;
  rect(g, '#e8b95a', Math.min(heroScreenX, bell), heroY - 34, Math.abs(bell - heroScreenX), 2);
  g.fillStyle = '#e8b95a'; g.beginPath(); g.moveTo(bell, heroY - 33); g.lineTo(bell + 16, heroY - 46); g.lineTo(bell + 16, heroY - 20); g.fill();
}
export function drawDarkness(g, cam, run, s, heroScreenX, heroY) {
  const level = lightLevel(run, s), dark = (1 - level) * .95;
  if (dark <= .01) return dark;
  g.fillStyle = `rgba(3,3,8,${dark.toFixed(3)})`; g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(heroScreenX, heroY, 8, heroScreenX, heroY, 54);
  glow.addColorStop(0, '#ffd9a055'); glow.addColorStop(1, '#ffd9a000');
  g.fillStyle = glow; g.fillRect(0, 0, W, H);
  return dark;
}
export const crashRing = (g, cx, age) => {
  const k = age / (4 * BEAT); if (k < 0 || k > 1) return;
  g.strokeStyle = '#ffe27a'; g.globalAlpha = (1 - k) * .5; g.lineWidth = 2; g.beginPath(); g.ellipse(cx, FLOOR, 30 + k * 300, 6 + k * 50, 0, 0, 7); g.stroke(); g.globalAlpha = 1;
};

// ---------- the metronome ----------
const hexBody = '#3a2a1a', brass = '#e8b95a';
export function rodTip(pivotX, pivotY, angle) { return { x: pivotX + Math.sin(angle) * ROD_LENGTH, y: pivotY - Math.cos(angle) * ROD_LENGTH }; }
export function drawMetronome(g, px, py, angle, { rungs = true, lit = 0, rungAt = -1, cam = 0 } = {}) {
  // The wooden case; the rod stands in front of it.
  g.fillStyle = hexBody; g.beginPath(); g.moveTo(px - 118, FLOOR + 22); g.lineTo(px - 52, py - 150); g.lineTo(px + 52, py - 150); g.lineTo(px + 118, FLOOR + 22); g.closePath(); g.fill();
  g.fillStyle = '#28190f'; g.beginPath(); g.moveTo(px - 92, FLOOR + 10); g.lineTo(px - 44, py - 134); g.lineTo(px + 44, py - 134); g.lineTo(px + 92, FLOOR + 10); g.closePath(); g.fill();
  // The tempo scale: the marks the weight slides past.
  for (let k = 0; k < 9; k++) { const y = py - 20 - k * 13; rect(g, k === 8 ? '#fff1c9' : '#8a6b3c', px - 22 + k, y, 44 - k * 2, 1); }
  // The counterweight's window at the foot.
  g.fillStyle = '#17110a'; g.fillRect(px - 26, py + 4, 52, 24);
  const under = { x: px - Math.sin(angle) * 26, y: py + Math.cos(angle) * 22 };
  g.strokeStyle = '#8a6b3c'; g.lineWidth = 3; g.beginPath(); g.moveTo(px, py); g.lineTo(under.x, under.y); g.stroke();
  g.fillStyle = '#c2953f'; g.beginPath(); g.arc(under.x, under.y, 9, 0, 7); g.fill();
  const tip = rodTip(px, py, angle);
  g.strokeStyle = lit ? '#fff1c9' : brass; g.lineWidth = 4; g.beginPath(); g.moveTo(px, py); g.lineTo(tip.x, tip.y); g.stroke();
  g.fillStyle = '#6e5228'; g.beginPath(); g.arc(px, py, 6, 0, 7); g.fill();
  if (rungs) for (const r of COURSE.rungs) {
    const x = r.a - cam, y = FLOOR - r.h, on = r.rung <= rungAt;
    rect(g, '#2a1d10', x, y + 3, r.b - r.a, FLOOR + 22 - y);
    rect(g, on ? '#ffe6aa' : brass, x, y, r.b - r.a, 3);
    rect(g, '#00000040', x, y + 3, r.b - r.a, 3);
  }
  // The saddle at the tip: a plate waiting for its weight.
  g.save(); g.translate(tip.x, tip.y); g.rotate(angle);
  rect(g, '#6a4a1f', -28, 0, 56, 5); rect(g, '#ffd98a', -28, 0, 56, 2);
  rect(g, '#ffffff', -3, 2, 6, 3);
  g.restore();
}
// Drawn flat first, then turned as one image: rotating its pixels one by one
// would leave hairline gaps in the sprite.
let lockedSprite = null;
export function drawLockedHero(g, x, y, angle, s, blink, reduced, legs = 1) {
  const size = 96, foot = 88;
  lockedSprite ??= Object.assign(document.createElement('canvas'), { width: size, height: size });
  const c = lockedSprite.getContext('2d');
  c.clearRect(0, 0, size, size);
  c.save(); c.translate(size / 2, foot);
  // Two fixed legs, out only now: the first time it has ever stood.
  const out = Math.round(legs * 22);
  if (out > 0) for (const side of [-1, 1]) {
    const a = Math.round(side * (4 + legs * 9));
    rect(c, '#172638', a - 4, -out, 8, out); rect(c, '#f9d49c', a - 2, -out + 2, 4, Math.max(0, out - 4));
    rect(c, '#172638', a - 8, -3, 16, 3); rect(c, '#ffe9be', a - 6, -3, 12, 1);
  }
  drawPod(c, 0, Math.min(0, -10 * legs), 2, { phase: 0, land: 1, time: s, eyes: true });
  // Its light blinks on the beat it no longer has to make.
  if (blink && !reduced) {
    rect(c, '#fff1c9', -13, -66, 6, 5); rect(c, '#fff1c9', 7, -66, 6, 5);
    c.globalAlpha = .35; c.fillStyle = '#fff1c9'; c.beginPath(); c.arc(-10, -64, 8, 0, 7); c.arc(10, -64, 8, 0, 7); c.fill(); c.globalAlpha = 1;
  }
  c.restore();
  g.save(); g.translate(x, y); g.rotate(angle); g.imageSmoothingEnabled = false;
  g.drawImage(lockedSprite, -size / 2, -foot);
  g.restore();
}
// A row of small machines, each lit by its part when it sounds.
const ROW = ['drums', 'tongue', 'keys', 'harp', 'strings', 'bellows', 'wood', 'brass'];
export function drawBand(g, flash, s, heard, y = FLOOR + 34, scale = 1) {
  ROW.forEach((part, i) => {
    const x = 24 + i * 44.5, age = s - (flash[part] ?? -9), k = Math.max(0, 1 - age / .4), on = heard.has(part), rest = scale < 1 ? .14 : .28;
    if (k) { g.globalAlpha = k * .28; g.fillStyle = '#ffe6aa'; g.beginPath(); g.arc(x, y - 6, (13 + k * 4) * scale, 0, 7); g.fill(); }
    g.globalAlpha = on ? 1 : rest;
    g.save(); g.translate(x, y); g.scale(scale, scale); g.translate(-x, -y);
    miniInstrument(g, part, x, y, k);
    g.restore();
    g.globalAlpha = 1;
  });
}
function miniInstrument(g, part, x, y, k) {
  const up = k * 2;
  if (part === 'drums') { rect(g, '#c9463f', x - 11, y - 10 + up, 22, 13); rect(g, '#fff6e4', x - 11, y - 12 + up, 22, 3); }
  if (part === 'tongue') { g.fillStyle = '#7fd1c4'; g.beginPath(); g.ellipse(x, y + 2, 14, 12, 0, Math.PI, 0); g.fill(); rect(g, '#0b1418', x - 1, y - 8, 2, 8); }
  if (part === 'keys') { rect(g, '#1a1720', x - 14, y - 12, 28, 15); for (let n = 0; n < 5; n++) rect(g, '#efe7d6', x - 13 + n * 5.4, y - 6 + (n === 2 ? up : 0), 4, 9); }
  if (part === 'harp') { g.strokeStyle = '#d9b56a'; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 8, y + 3); g.lineTo(x - 7, y - 16); g.quadraticCurveTo(x + 5, y - 15, x + 9, y + 3); g.lineTo(x - 8, y + 3); g.stroke(); for (let n = 0; n < 4; n++) rect(g, '#fff1c9', x - 4 + n * 3, y - 12 + n * 2, 1, 14 - n * 2); }
  if (part === 'strings') { g.fillStyle = '#a2552e'; g.beginPath(); g.ellipse(x, y - 2, 8, 7, 0, 0, 7); g.ellipse(x, y - 11, 6, 5, 0, 0, 7); g.fill(); rect(g, '#3a2212', x - 1, y - 24, 2, 14); }
  if (part === 'bellows') { for (let n = -3; n <= 3; n++) rect(g, n % 2 ? '#f2b84b' : '#68aef0', x + n * 3 - 1, y - 11 + (n % 2 ? 1 : 0) - up, 2, 13); rect(g, '#3c2d16', x - 13, y - 13, 4, 16); rect(g, '#3c2d16', x + 9, y - 13, 4, 16); }
  if (part === 'wood') { g.save(); g.translate(x, y - 5); g.rotate(-.5); rect(g, '#3a2212', -15, -2, 30, 4); for (let n = 0; n < 4; n++) rect(g, '#fff1c9', -10 + n * 6, -1, 2, 2); g.restore(); }
  if (part === 'brass') { rect(g, '#e8b95a', x - 15, y - 9, 26, 2); rect(g, '#e8b95a', x - 15, y - 4, 26, 2); rect(g, '#e8b95a', x - 15, y - 9, 2, 7); g.fillStyle = '#e8b95a'; g.beginPath(); g.moveTo(x + 9, y - 8); g.lineTo(x + 17, y - 14); g.lineTo(x + 17, y + 2); g.fill(); }
}
// A lantern at each return point: it catches as the hero passes and stays lit.
export function drawLanterns(g, cam, lit, s) {
  COURSE.checkpoints.forEach((cp, i) => {
    const x = cp.from - cam; if (i === 0 || x < -10 || x > W + 10) return;
    const on = lit.has(i);
    rect(g, '#5a4a30', x - 1, FLOOR - 18, 2, 18);
    rect(g, on ? '#ffd98a' : '#3b3428', x - 3, FLOOR - 25, 6, 8);
    if (on) { g.globalAlpha = .22 + .05 * Math.sin(s * 3 + i); g.fillStyle = '#ffd98a'; g.beginPath(); g.arc(x, FLOOR - 21, 11, 0, 7); g.fill(); g.globalAlpha = 1; }
  });
}
// After a second fall, the edges of that hole glow softly. Never a landing marker.
export function drawFallHint(g, cam, fx, s) {
  const left = COURSE.platforms.filter(p => p.b <= fx + 1).at(-1), right = COURSE.platforms.find(p => p.a > fx - 1);
  g.globalAlpha = .4 + .25 * Math.sin(s * 5); g.fillStyle = '#fff1c9';
  if (left) g.fillRect(Math.round(left.b - cam) - 2, FLOOR, 2, 26);
  if (right) g.fillRect(Math.round(right.a - cam), FLOOR, 2, 26);
  g.globalAlpha = 1;
}
// ---------- the score card ----------
const LANES = ['brass', 'wood', 'keys', 'tongue', 'strings', 'harp', 'bellows', 'drums'];
const LANE_COLOR = { brass: '#e8b95a', wood: '#b8e27a', keys: '#efe7d6', tongue: '#7fd1c4', strings: '#e9a4c6', harp: '#ffe6aa', bellows: '#68aef0', drums: '#ff8a70' };
export function drawScore(g, recording, x, y, w, h, { labels = null, cursor = null } = {}) {
  const lane = h / LANES.length;
  LANES.forEach((part, i) => {
    const take = recording[part], ly = y + i * lane;
    g.fillStyle = i % 2 ? '#ffffff08' : '#ffffff12'; g.fillRect(x, ly, w, lane);
    if (labels) { g.fillStyle = LANE_COLOR[part]; g.font = `bold ${Math.round(lane * .34)}px sans-serif`; g.textAlign = 'left'; g.fillText(labels[part] || part, x + 8, ly + lane * .34); }
    if (!take) return;
    const slots = take.len * 4, c = LANE_COLOR[part];
    g.fillStyle = c;
    for (const e of take.events) {
      const ex = x + (e.s / slots) * w;
      const pitch = part === 'keys' || part === 'tongue' ? ((e.m % 24) / 24) : part === 'brass' ? .5 + e.pos / 340 : part === 'harp' ? Math.min(1, e.n / 10) : part === 'drums' ? ['kick', 'snare', 'block'].indexOf(e.voice) / 2 : part === 'bellows' ? (e.push ? .8 : .2) : .5;
      const dy = ly + lane * (.86 - pitch * .55), size = Math.max(2, lane * .13);
      if (part === 'wood') g.fillRect(ex, dy - size / 2, Math.max(size, (e.d / (slots * .195)) * w), size);
      else g.fillRect(ex, dy - size / 2, size * 1.5, size);
    }
  });
  if (cursor !== null) { g.fillStyle = '#fff1c9'; g.fillRect(x + cursor * w, y, 2, h); }
}
