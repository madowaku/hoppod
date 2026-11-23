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
  // The trombone needs no silhouette: the real one rides on the cart.
}
const TOP = { plain: ['#3a3f50', '#c5cedc'], drum: ['#5b2a2e', '#ffcf9e'], tongue: ['#27424a', '#9fe2d8'], stone: ['#35402e', '#c8dca8'], pad: ['#40303a', '#e9c4d9'], cymbal: ['#574314', '#ffe27a'], rung: ['#6a4a1f', '#ffd98a'], tip: ['#6a4a1f', '#ffd98a'] };
export function drawPlatforms(g, cam, run, s, rings, darkness = 0, labels = null) {
  for (const p of COURSE.platforms) {
    const x = p.a - cam, w = p.b - p.a;
    if (x > W + 20 || x + w < -20) continue;
    const ring = rings.get(p.i), age = ring === undefined ? 9 : s - ring, hit = Math.max(0, 1 - age / .35);
    if (p.kind === 'key') { drawKey(g, p, x, w, hit, s); continue; }
    if (p.kind === 'res') { drawResPlate(g, p, x, w, run, s, hit); continue; }
    if (p.kind === 'push' || p.kind === 'pull') { drawBellowsPlate(g, p, x, w, run, hit, labels); continue; }
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
// Gold is squeezed shut, blue stands open, and each says in words what it takes.
// The hero wears the same two colours (drawBellowsAura): match them on landing.
export const BELLOWS_COLOR = Object.freeze({ push: '#f2b84b', pull: '#68aef0' });
function drawBellowsPlate(g, p, x, w, run, hit, labels) {
  const push = p.kind === 'push', c = BELLOWS_COLOR[p.kind], dark = push ? '#5a3e12' : '#1c3d5f';
  rect(g, dark, x, FLOOR + 3, w, 36);
  const pitch = push ? 6 : 16;
  for (let k = 4; k < w - 3; k += pitch) rect(g, c, x + k, FLOOR + 6 - hit * 2, push ? 2 : 3, push ? 15 : 31);
  rect(g, c, x + 2, FLOOR, w - 4, 5);
  rect(g, '#ffffffaa', x + 4, FLOOR, w - 8, 1);
  const label = labels?.[p.kind];
  if (label) {
    g.font = 'bold 13px sans-serif'; g.textAlign = 'center';
    const pill = Math.min(w - 8, g.measureText(label).width + 14);
    rect(g, c, x + w / 2 - pill / 2, FLOOR + 12, pill, 20);
    g.fillStyle = '#0b0a14'; g.fillText(label, x + w / 2, FLOOR + 27);
  }
}
export function drawBellowsAura(g, x, y, on, s, reduced) {
  const c = on ? BELLOWS_COLOR.push : BELLOWS_COLOR.pull, cy = y - 22;
  const glow = g.createRadialGradient(x, cy, 8, x, cy, 52);
  glow.addColorStop(0, c + '88'); glow.addColorStop(1, c + '00');
  g.fillStyle = glow; g.fillRect(x - 52, cy - 52, 104, 104);
  g.strokeStyle = c; g.lineWidth = 2; g.globalAlpha = reduced ? .8 : .7 + .2 * Math.sin(s * 8);
  g.beginPath(); g.ellipse(x, cy, 34, 34, 0, 0, 7); g.stroke();
  g.globalAlpha = .55; g.beginPath(); g.ellipse(x, FLOOR + 1, 24, 4, 0, 0, 7); g.fillStyle = c; g.fill(); g.globalAlpha = 1;
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
// The track stands on a trestle in world space: with the camera on the cart, these
// are what rush past. A joint every half beat at the cart's speed, as the clack is.
const RAIL_Y = FLOOR + 49, JOINT = 73.125;
export function drawCart(g, cam, run, s, target, on, reduced = false) {
  const c = run.cart, x = c.x - cam;
  if (x < -CART_HALF - 60 || x > W + CART_HALF + 60) return;
  const moving = c.state === 'ride';
  const r0 = Math.max(0, COURSE.cart.x0 - CART_HALF - cam), r1 = Math.min(W, COURSE.cart.x1 + CART_HALF - cam);
  if (r1 > r0) {
    for (let wx = Math.floor((cam + r0) / (JOINT * 2)) * JOINT * 2; wx - cam < r1 + JOINT * 2; wx += JOINT * 2) {
      const px = wx - cam; if (px < r0 - 8 || px > r1) continue;
      rect(g, '#241c10', px, RAIL_Y + 8, 7, H - RAIL_Y - 8);
      g.strokeStyle = '#241c10'; g.lineWidth = 2; g.beginPath(); g.moveTo(px + 3, RAIL_Y + 10); g.lineTo(px + JOINT * 2 + 3, H); g.moveTo(px + JOINT * 2 + 3, RAIL_Y + 10); g.lineTo(px + 3, H); g.stroke();
    }
    for (let wx = Math.floor((cam + r0) / (JOINT / 2)) * JOINT / 2; wx - cam < r1; wx += JOINT / 2) rect(g, '#4a3a22', wx - cam, RAIL_Y + 4, 10, 5);
    rect(g, '#8a7450', r0, RAIL_Y, r1 - r0, 3); rect(g, '#50422a', r0, RAIL_Y + 3, r1 - r0, 2);
    for (let wx = Math.floor((cam + r0) / JOINT) * JOINT; wx - cam < r1; wx += JOINT) rect(g, '#d9c79a', wx - cam, RAIL_Y, 2, 3);
  }
  // It sits down a little under a landing, and rumbles while it rolls.
  const land = Math.max(0, 1 - (s - run.beat * BEAT) / .18);
  const dip = reduced ? 0 : (moving || c.hits ? land * 3 : 0) + (moving ? Math.sin(s * 37) * .6 : 0);
  const travel = c.x - COURSE.cart.x0, wheelR = 15;
  // Wheels hold the rail; everything above rides on the springs.
  for (const wheel of [-128, -88, 88, 128]) {
    const wx = x + wheel, wy = RAIL_Y - wheelR;
    g.fillStyle = '#17110a'; g.beginPath(); g.arc(wx, wy, wheelR, 0, 7); g.fill();
    g.strokeStyle = '#8a6b3c'; g.lineWidth = 2; g.beginPath(); g.arc(wx, wy, wheelR - 3, 0, 7); g.stroke();
    g.save(); g.translate(wx, wy); g.rotate(travel / wheelR);
    g.strokeStyle = '#d9a93a'; g.lineWidth = 2;
    for (let k = 0; k < 3; k++) { g.rotate(Math.PI / 3); g.beginPath(); g.moveTo(-wheelR + 4, 0); g.lineTo(wheelR - 4, 0); g.stroke(); }
    rect(g, '#fff1c9', -2, -2, 4, 4);
    g.restore();
  }
  // Rods joining each pair of wheels, turning with them.
  for (const pair of [-108, 108]) {
    const a = travel / wheelR, ox = Math.cos(a) * 6, oy = Math.sin(a) * 6;
    rect(g, '#b18a3f', x + pair - 26 + ox, RAIL_Y - wheelR + oy - 1, 52, 3);
  }
  const top = FLOOR + dip;
  // A flatcar's frame, with a beam and buffers at either end so it ends like a thing.
  rect(g, '#2a1e0e', x - CART_HALF, top + 14, CART_HALF * 2, 12);
  for (const side of [-1, 1]) { rect(g, '#6e5228', x + side * 88 - 26, top + 22, 52, 5); rect(g, '#8a6b3c', x + side * (CART_HALF + 5) - 5, top + 15, 10, 8); }
  rect(g, '#3c2d16', x - CART_HALF, top + 4, CART_HALF * 2, 12);
  for (let k = -CART_HALF + 24; k < CART_HALF; k += 24) rect(g, '#2a1e0e', x + k, top + 4, 1, 12);
  rect(g, '#e8b95a', x - CART_HALF, top, CART_HALF * 2, 4);
  // Stakes, a tail lamp behind and a head lamp ahead with its light on the rails.
  for (const side of [-1, 1]) { rect(g, '#6e5228', x + side * CART_HALF - 3, top - 16, 6, 20); rect(g, '#e8b95a', x + side * CART_HALF - 3, top - 18, 6, 3); }
  rect(g, moving ? '#ff5a45' : '#7a2a22', x - CART_HALF - 3, top - 12, 6, 6);
  rect(g, moving ? '#fff1c9' : '#7a6a40', x + CART_HALF - 3, top - 12, 6, 6);
  if (moving) {
    const beam = g.createLinearGradient(x + CART_HALF, 0, x + CART_HALF + 90, 0);
    beam.addColorStop(0, '#fff1c955'); beam.addColorStop(1, '#fff1c900');
    g.fillStyle = beam; g.beginPath(); g.moveTo(x + CART_HALF + 3, top - 11); g.lineTo(x + CART_HALF + 90, RAIL_Y - 30); g.lineTo(x + CART_HALF + 90, RAIL_Y); g.lineTo(x + CART_HALF + 3, top - 5); g.fill();
    // Sparks thrown back from the rear wheels, by distance so they keep to the rail.
    if (!reduced) for (let i = 0; i < 5; i++) {
      const age = ((travel / 40 + i * .2) % 1), sx = x - 128 - 16 - age * 56, sy = RAIL_Y - 4 - Math.sin(age * 3) * 8 * ((i % 2) + 1) + age * age * 12;
      g.globalAlpha = 1 - age; rect(g, '#ffd98a', sx, sy, 2, 2); g.globalAlpha = 1;
    }
  }
  // Seven painted positions: the slide's own scale, not a landing guide.
  for (let k = -3; k <= 3; k++) {
    const px = x + k * U * 1.5, big = k === 0;
    rect(g, big ? '#fff1c9' : '#b18a3f', px - 1, top + 4, 2, big ? 11 : 7);
    g.fillStyle = '#fff1c9'; g.font = 'bold 10px sans-serif'; g.textAlign = 'center'; g.fillText(String(k + 4), px + 8, top + 14);
  }
  if (on && target !== null) { g.globalAlpha = .55 + .25 * Math.sin(s * 8); rect(g, '#fff1c9', x + target - 24, top + 1, 48, 2); g.globalAlpha = 1; }
}
// A real trombone, side on, mounted over the cart. The hero is holding the slide:
// go back on the cart and the slide runs out and the pitch falls, as the instrument
// does. It stays above the hop's arc, so nothing here can be mistaken for footing.
const TUBE_BELL = 142, TUBE_A = 182, TUBE_B = 196, OUTER_SLIDE = 128;
const tube = (g, x0, x1, y, width, color, shine) => {
  const a = Math.min(x0, x1), w = Math.abs(x1 - x0);
  rect(g, color, a, y - width / 2, w, width);
  if (shine) rect(g, shine, a, y - width / 2, w, 1);
};
export function drawTrombone(g, cam, run, s, heroScreenX, heroY, riding, ringAge = 9, reduced = false) {
  const cx = run.cart.x - cam;
  if (cx < -CART_HALF - 80 || cx > W + CART_HALF + 80) return;
  const gold = '#e8b95a', deep = '#a87f33', pale = '#fff1c9', inner = '#c9a14a';
  const fixedEnd = cx + 128, bellThroat = cx + 76, bellMouth = cx + 24;
  // The hand: the slide's bend follows the hero, short of the bell's own tube end.
  const bend = riding ? Math.max(cx - CART_HALF - 4, Math.min(cx + 96, heroScreenX - 10)) : cx + 60;
  // Mount: a post to the deck at the fixed end, a stay to the rear.
  rect(g, '#6e5228', cx + 134, TUBE_BELL, 5, FLOOR - TUBE_BELL);
  rect(g, deep, cx + 128, TUBE_BELL - 3, 16, 6); rect(g, deep, cx + 128, TUBE_A - 3, 16, 6);
  // Tuning loop behind the player, joining bell tube to slide.
  g.strokeStyle = gold; g.lineWidth = 5; g.beginPath(); g.arc(fixedEnd + 24, (TUBE_BELL + TUBE_A) / 2, (TUBE_A - TUBE_BELL) / 2, -Math.PI / 2, Math.PI / 2); g.stroke();
  tube(g, bellThroat, fixedEnd + 24, TUBE_BELL, 5, gold, pale);
  tube(g, fixedEnd, fixedEnd + 24, TUBE_A, 5, gold, pale);
  // Bell: the flared horn opening backward over the slide.
  const ring = Math.max(0, 1 - ringAge / .5);
  g.fillStyle = gold; g.beginPath(); g.moveTo(bellThroat, TUBE_BELL - 3);
  g.quadraticCurveTo(bellMouth + 20, TUBE_BELL - 5, bellMouth, TUBE_BELL - 30); g.lineTo(bellMouth, TUBE_BELL + 30);
  g.quadraticCurveTo(bellMouth + 20, TUBE_BELL + 5, bellThroat, TUBE_BELL + 3); g.closePath(); g.fill();
  g.fillStyle = pale; g.beginPath(); g.moveTo(bellThroat - 8, TUBE_BELL - 3); g.quadraticCurveTo(bellMouth + 20, TUBE_BELL - 7, bellMouth + 3, TUBE_BELL - 26); g.lineTo(bellMouth + 5, TUBE_BELL - 22); g.quadraticCurveTo(bellMouth + 24, TUBE_BELL - 4, bellThroat - 8, TUBE_BELL - 1); g.fill();
  rect(g, deep, bellMouth - 3, TUBE_BELL - 32, 5, 64);
  rect(g, pale, bellMouth - 3, TUBE_BELL - 32, 2, 64);
  // Its sound leaves the bell in rings on each landing.
  if (ring && !reduced) { g.strokeStyle = pale; g.lineWidth = 2; g.globalAlpha = ring * .8; for (const k of [0, 1]) { const r = 34 + (1 - ring) * 34 + k * 14; g.beginPath(); g.arc(bellMouth + 22, TUBE_BELL, r, Math.PI * .72, Math.PI * 1.28); g.stroke(); } g.globalAlpha = 1; }
  rect(g, deep, bellThroat + 22, TUBE_BELL, 4, TUBE_A - TUBE_BELL);
  // Inner slide: thin fixed tubes, showing when the slide is out.
  const reach = Math.min(fixedEnd, bend + OUTER_SLIDE);
  tube(g, bend, fixedEnd, TUBE_A, 2, inner); tube(g, bend, fixedEnd, TUBE_B, 2, inner);
  // Outer slide: the thick moving pair with its bend and hand brace.
  tube(g, bend, reach, TUBE_A, 5, gold, pale); tube(g, bend, reach, TUBE_B, 5, gold, pale);
  g.strokeStyle = gold; g.lineWidth = 5; g.beginPath(); g.arc(bend, (TUBE_A + TUBE_B) / 2, (TUBE_B - TUBE_A) / 2, Math.PI / 2, Math.PI * 1.5); g.stroke();
  rect(g, deep, bend + 12, TUBE_A, 4, TUBE_B - TUBE_A); rect(g, deep, reach - 5, TUBE_A, 3, TUBE_B - TUBE_A);
  // Mouthpiece at the fixed end.
  rect(g, inner, fixedEnd, TUBE_B - 1, 18, 2); rect(g, pale, fixedEnd + 16, TUBE_B - 4, 4, 8);
  // The arm from the hero's head up to the brace.
  if (riding) { const hand = bend + 14; g.strokeStyle = '#d9c79a'; g.lineWidth = 2; g.beginPath(); g.moveTo(hand, TUBE_B + 3); g.lineTo(heroScreenX, heroY - 46); g.stroke(); rect(g, pale, hand - 3, TUBE_B + 1, 6, 4); }
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
// The goal is lit from the moment it comes into view: a shaft of light on the case,
// a pool on the floor. `level` rises as the band gathers in the finale.
export function drawGoalStage(g, px, level = .6) {
  const shaft = g.createLinearGradient(0, 0, 0, FLOOR + 14);
  shaft.addColorStop(0, `rgba(255,225,160,${(.34 * level).toFixed(3)})`); shaft.addColorStop(1, `rgba(255,225,160,${(.1 * level).toFixed(3)})`);
  g.fillStyle = shaft; g.beginPath(); g.moveTo(px - 30, 0); g.lineTo(px + 30, 0); g.lineTo(px + 160, FLOOR + 14); g.lineTo(px - 160, FLOOR + 14); g.closePath(); g.fill();
  g.globalAlpha = .5 * level; g.fillStyle = '#ffe6aa'; g.beginPath(); g.ellipse(px, FLOOR + 14, 160, 12, 0, 0, 7); g.fill(); g.globalAlpha = 1;
}
// Lamps along the last stretch; a pulse keeps running towards the metronome.
export function drawRunway(g, cam, from, to, s, reduced) {
  for (let wx = from + 20; wx < to; wx += 46) {
    const x = wx - cam; if (x < -8 || x > W + 8) continue;
    const pulse = reduced ? .5 : Math.max(0, Math.cos((wx - from) * .018 - s * 4)) ** 6;
    rect(g, '#6a4a1f', x - 3, FLOOR, 6, 3);
    g.globalAlpha = .35 + .65 * pulse; rect(g, '#ffe6aa', x - 2, FLOOR - 1, 4, 2);
    g.globalAlpha = pulse * .4; g.fillStyle = '#ffe6aa'; g.beginPath(); g.ellipse(x, FLOOR - 2, 12, 6, 0, 0, 7); g.fill(); g.globalAlpha = 1;
  }
}
// A flash of gold from a point: rays, a ring, and sparks that fall. Worked out from
// its age, so it holds no state and comes out the same however the frames land.
export function drawBurst(g, x, y, age, power = 1, reduced = false) {
  const life = .5 + power * .5, k = age / life;
  if (k < 0 || k > 1) return;
  const fade = 1 - k;
  g.strokeStyle = '#fff1c9'; g.lineWidth = 2 + power * 2; g.globalAlpha = fade * .85;
  g.beginPath(); g.arc(x, y, 14 + (70 + power * 200) * (1 - fade * fade), 0, 7); g.stroke();
  if (reduced) { g.globalAlpha = 1; return; }
  const rays = Math.round(8 + power * 10);
  g.lineWidth = 2 + power; g.globalAlpha = fade * .8;
  for (let i = 0; i < rays; i++) {
    const a = i / rays * Math.PI * 2 + .3, r0 = 18 + k * (60 + power * 160), r1 = r0 + (22 + power * 70) * fade;
    g.beginPath(); g.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); g.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); g.stroke();
  }
  const sparks = Math.round(6 + power * 30);
  for (let i = 0; i < sparks; i++) {
    const a = i * 2.39996, v = 60 + (i * 53 % 90) * (.6 + power), t = age;
    g.globalAlpha = fade; rect(g, i % 3 ? '#ffd98a' : '#fff1c9', x + Math.cos(a) * v * t, y + Math.sin(a) * v * t + 240 * t * t, 3, 3);
  }
  g.globalAlpha = 1;
}
export function drawMetronome(g, px, py, angle, { rungs = true, lit = 0, rungAt = -1, cam = 0, seat = 0 } = {}) {
  // The wooden case; the rod stands in front of it.
  g.fillStyle = hexBody; g.beginPath(); g.moveTo(px - 118, FLOOR + 22); g.lineTo(px - 52, py - 150); g.lineTo(px + 52, py - 150); g.lineTo(px + 118, FLOOR + 22); g.closePath(); g.fill();
  g.fillStyle = '#28190f'; g.beginPath(); g.moveTo(px - 92, FLOOR + 10); g.lineTo(px - 44, py - 134); g.lineTo(px + 44, py - 134); g.lineTo(px + 92, FLOOR + 10); g.closePath(); g.fill();
  // Brass edging, so the case reads against the wall from far off.
  g.strokeStyle = '#c2953f'; g.lineWidth = 2; g.beginPath(); g.moveTo(px - 118, FLOOR + 22); g.lineTo(px - 52, py - 150); g.lineTo(px + 52, py - 150); g.lineTo(px + 118, FLOOR + 22); g.stroke();
  rect(g, '#c2953f', px - 58, py - 156, 116, 6);
  // The tempo scale: the marks the weight slides past.
  for (let k = 0; k < 9; k++) { const y = py - 20 - k * 13; rect(g, k === 8 ? '#fff1c9' : '#8a6b3c', px - 22 + k, y, 44 - k * 2, 1); }
  // The counterweight's window at the foot.
  g.fillStyle = '#17110a'; g.fillRect(px - 26, py + 4, 52, 24);
  const under = { x: px - Math.sin(angle) * 26, y: py + Math.cos(angle) * 22 };
  g.strokeStyle = '#8a6b3c'; g.lineWidth = 3; g.beginPath(); g.moveTo(px, py); g.lineTo(under.x, under.y); g.stroke();
  g.fillStyle = '#c2953f'; g.beginPath(); g.arc(under.x, under.y, 9, 0, 7); g.fill();
  const tip = rodTip(px, py, angle);
  g.strokeStyle = lit ? '#fff1c9' : brass; g.lineWidth = 4; g.beginPath(); g.moveTo(px, py); g.lineTo(tip.x, tip.y); g.stroke();
  // Each rung lights the rod further up: the hero's beat climbing to its seat.
  if (rungAt >= 0) { const k = (rungAt + 1) / 4; g.strokeStyle = '#fff6d8'; g.lineWidth = 5; g.beginPath(); g.moveTo(px, py); g.lineTo(px + (tip.x - px) * k, py + (tip.y - py) * k); g.stroke(); }
  g.fillStyle = '#6e5228'; g.beginPath(); g.arc(px, py, 6, 0, 7); g.fill();
  if (rungs) for (const r of COURSE.rungs) {
    const x = r.a - cam, y = FLOOR - r.h, on = r.rung <= rungAt;
    rect(g, '#2a1d10', x, y + 3, r.b - r.a, FLOOR + 22 - y);
    // The rungs are the case's own tempo scale, come out to meet you.
    for (let k = 12; k < FLOOR + 14 - y; k += 13) rect(g, on ? '#d9b56a' : '#6a5230', x + 14, y + k, r.b - r.a - 28, 1);
    rect(g, '#6e5228', x, y + 3, 4, FLOOR + 19 - y);
    rect(g, on ? '#ffe6aa' : brass, x, y, r.b - r.a, 3);
    rect(g, '#00000040', x, y + 3, r.b - r.a, 3);
    if (on) { g.globalAlpha = .3; rect(g, '#ffe6aa', x, y - 6, r.b - r.a, 6); g.globalAlpha = 1; }
  }
  // The saddle at the tip: a plate waiting for its weight. Taken, it slides
  // down the rod under the hero and narrows to its spring.
  g.save(); g.translate(tip.x, tip.y); g.rotate(angle);
  const down = Math.round(seat * SEAT_SLIDE), half = Math.round(28 - seat * 14);
  rect(g, '#6a4a1f', -half, down, half * 2, 5); rect(g, '#ffd98a', -half, down, half * 2, 2);
  rect(g, '#ffffff', -3, down + 2, 6, 3);
  g.restore();
}
// Drawn flat first, then turned as one image: rotating its pixels one by one
// would leave hairline gaps in the sprite.
let lockedSprite = null;
// `seat` 0→1: no legs; like a metronome's weight it slides down the rod, which
// goes in behind its back, and stays on its spring.
export const SEAT_SLIDE = 26;
export function drawLockedHero(g, x, y, angle, s, blink, reduced, seat = 1) {
  const size = 96, foot = 88;
  lockedSprite ??= Object.assign(document.createElement('canvas'), { width: size, height: size });
  const c = lockedSprite.getContext('2d');
  c.clearRect(0, 0, size, size);
  c.save(); c.translate(size / 2, foot);
  drawPod(c, 0, 0, 2, { phase: 0, land: 1, time: s, eyes: true });
  // Its light blinks on the beat it no longer has to make.
  if (blink && !reduced) {
    rect(c, '#fff1c9', -13, -66, 6, 5); rect(c, '#fff1c9', 7, -66, 6, 5);
    c.globalAlpha = .35; c.fillStyle = '#fff1c9'; c.beginPath(); c.arc(-10, -64, 8, 0, 7); c.arc(10, -64, 8, 0, 7); c.fill(); c.globalAlpha = 1;
  }
  c.restore();
  g.save(); g.translate(x, y); g.rotate(angle); g.imageSmoothingEnabled = false;
  g.drawImage(lockedSprite, -size / 2, -foot + Math.round(seat * SEAT_SLIDE));
  g.restore();
}
// A row of small machines, each lit by its part when it sounds.
const ROW = ['drums', 'tongue', 'keys', 'harp', 'strings', 'bellows', 'wood', 'brass'];
// `echoes`: when each part last played one of the player's own notes. A small pale
// Rapippo stands on that instrument and hops on those notes, never the workshop's.
const ECHO = Object.freeze({ o: '#22344a', c: '#cfe4ff', w: '#f0f7ff', s: '#a9c7e8', a: '#8fb8e8', d: '#22344a' });
export function drawBand(g, flash, s, heard, y = FLOOR + 34, scale = 1, echoes = null, reduced = false) {
  ROW.forEach((part, i) => {
    const x = 24 + i * 44.5, age = s - (flash[part] ?? -9), k = Math.max(0, Math.min(1, 1 - age / .4)), on = heard.has(part), rest = scale < 1 ? .14 : .28;
    if (k) { g.globalAlpha = k * .28; g.fillStyle = '#ffe6aa'; g.beginPath(); g.arc(x, y - 6, (13 + k * 4) * scale, 0, 7); g.fill(); }
    g.globalAlpha = on ? 1 : rest;
    g.save(); g.translate(x, y); g.scale(scale, scale); g.translate(-x, -y);
    miniInstrument(g, part, x, y, k);
    g.restore();
    g.globalAlpha = 1;
    if (echoes && on) {
      const since = s - (echoes[part] ?? -9), hop = since >= 0 && since < .26 ? Math.sin(since / .26 * Math.PI) : 0;
      g.globalAlpha = .9;
      drawPod(g, x, y - 15 - (reduced ? hop * 2 : hop * 11), 1, { phase: 0, land: hop ? 0 : 1, time: s + i, palette: ECHO });
      g.globalAlpha = 1;
    }
  });
}
// While a part comes in, its own loop runs across the top with an echo of the hero
// hopping through it: these are the hops you made, and each mark lights as it sounds.
export function drawReplay(g, part, take, frac, s, caption, alpha = 1) {
  const x = 26, w = W - 52, base = 86, c = LANE_COLOR[part] || '#fff1c9';
  g.globalAlpha = alpha;
  g.fillStyle = '#0b0a14c4'; g.fillRect(8, 8, W - 16, 84);
  g.fillStyle = c; g.font = 'bold 13px sans-serif'; g.textAlign = 'center'; g.fillText(caption, W / 2, 24);
  rect(g, '#ffffff22', x, base, w, 1);
  const slots = take.len * 4;
  for (let beat = 0; beat < take.len; beat++) rect(g, '#ffffff33', x + beat / take.len * w, base, 1, 3);
  for (const e of take.events) {
    const ex = x + e.s / slots * w, passed = (frac * slots - e.s + slots) % slots, hot = passed < 2.5, level = markLevel(part, e), my = base - 6 - level * 22;
    g.fillStyle = hot ? '#ffffff' : c; g.globalAlpha = alpha * (hot ? 1 : .85);
    if (part === 'wood') g.fillRect(ex, my - 2, Math.max(4, (e.d ?? .15) / (take.len * BEAT) * w), 4);
    else { const size = hot ? 7 : 5; g.fillRect(ex - size / 2, my - size / 2, size, size); }
  }
  g.globalAlpha = alpha;
  const beats = frac * take.len, phase = beats % 1;
  drawPod(g, x + frac * w, base - 2 - Math.sin(phase * Math.PI) * 10, 1, { phase, land: phase < .1 ? 1 : 0, time: s, palette: ECHO });
  g.globalAlpha = 1;
}
// Every part at once, each with its own place in its own loop.
export function drawAllReplay(g, recording, rel, s, labels, caption, loopAt, x = 14, y = 8, w = W - 28, h = 88, alpha = 1) {
  g.globalAlpha = alpha;
  g.fillStyle = '#0b0a14c4'; g.fillRect(8, y - 2, W - 16, h + (caption ? 22 : 4));
  const cursors = {};
  for (const part of LANES) if (recording[part]) cursors[part] = loopAt(rel, part, recording[part].len);
  drawScore(g, recording, x, y, w, h, { labels, cursors, gutter: 74 });
  if (caption) { g.fillStyle = '#ffe6aa'; g.font = 'bold 13px sans-serif'; g.textAlign = 'center'; g.fillText(caption, W / 2, y + h + 15); }
  g.globalAlpha = 1;
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
  if (part === 'brass') {
    // The same side view as on the cart: long slide below, bell above opening back.
    rect(g, '#e8b95a', x - 18, y - 3, 30, 2); rect(g, '#e8b95a', x - 18, y + 1, 30, 2); rect(g, '#e8b95a', x - 19, y - 2, 2, 4);
    rect(g, '#e8b95a', x - 2, y - 11, 16, 2); rect(g, '#e8b95a', x + 13, y - 11, 2, 9);
    g.fillStyle = '#e8b95a'; g.beginPath(); g.moveTo(x, y - 11); g.lineTo(x - 9, y - 17); g.lineTo(x - 9, y - 4); g.lineTo(x, y - 9); g.fill();
  }
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
const markLevel = (part, e) => part === 'keys' || part === 'tongue' ? ((e.m % 24) / 24) : part === 'brass' ? .5 + e.pos / 340 : part === 'harp' ? Math.min(1, e.n / 10) : part === 'drums' ? ['kick', 'snare', 'block'].indexOf(e.voice) / 2 : part === 'bellows' ? (e.push ? .8 : .2) : .5;
// `gutter` keeps a column for the names; the card's tall lanes write theirs above the marks.
export function drawScore(g, recording, x, y, w, h, { labels = null, cursors = null, gutter = 0 } = {}) {
  const lane = h / LANES.length, base = g.globalAlpha, mx = x + gutter, mw = w - gutter;
  LANES.forEach((part, i) => {
    const take = recording[part], ly = y + i * lane;
    g.fillStyle = i % 2 ? '#ffffff08' : '#ffffff12'; g.fillRect(x, ly, w, lane);
    if (labels) { const size = Math.max(8, Math.round(lane * .34)); g.fillStyle = LANE_COLOR[part]; g.font = `bold ${size}px sans-serif`; g.textAlign = 'left'; g.fillText(labels[part] || part, x + 4, gutter ? ly + lane - 1 : ly + lane * .34); }
    if (!take) return;
    const slots = take.len * 4, c = LANE_COLOR[part], at = cursors?.[part] ?? null;
    for (const e of take.events) {
      const ex = mx + (e.s / slots) * mw, hot = at !== null && (at * slots - e.s + slots) % slots < 2.5;
      const dy = ly + lane * (.86 - markLevel(part, e) * .55), size = Math.max(2, lane * .13) * (hot ? 1.6 : 1);
      g.fillStyle = hot ? '#ffffff' : c;
      if (part === 'wood') g.fillRect(ex, dy - size / 2, Math.max(size, (e.d / (slots * .195)) * mw), size);
      else g.fillRect(ex, dy - size / 2, size * 1.5, size);
    }
    if (at !== null) { g.globalAlpha = base * .8; g.fillStyle = '#fff1c9'; g.fillRect(mx + at * mw, ly, 1, lane); g.globalAlpha = base; }
  });
}
