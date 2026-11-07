// Tower drawing. Readability first, per the RAPIPPO art direction: the lit top of
// whatever can be landed on always wins. No external assets.
import { PERIOD as BEAT } from '../engine.mjs';
import { COURSE, PIVOT_Y, BOB_DRAWN, bobAt, handAngle, handFlat, toothUp, GEAR_Y, landingSpan } from './course.mjs';

export const W = 360, H = 510, FLOOR = 382;
export const rect = (g, c, x, y, w, h) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
const smooth = k => { const v = Math.max(0, Math.min(1, k)); return v * v * (3 - 2 * v); };
const mix = (a, b, k) => { const p = parseInt(a.slice(1), 16), q = parseInt(b.slice(1), 16); const c = s => Math.round(((p >> s) & 255) * (1 - k) + ((q >> s) & 255) * k); return '#' + ((1 << 24) + (c(16) << 16) + (c(8) << 8) + c(0)).toString(16).slice(1); };
const STARS = Array.from({ length: 60 }, (_, i) => [(i * 137.5) % 900, (i * 71.3) % 130, i % 7 ? 1 : 2, i]);
// The way a mechanism moves: rests through the beat and snaps into place just
// before the landing, so what you see as you come down is what you land on.
export const snapIn = (s) => { const into = (s / BEAT) % 1; return smooth((into - .74) / .2); };

// The sky outside, from deep night (0) through the small hours (1) to full morning (2).
export function skyColors(dawn) {
  if (dawn <= 1) return [mix('#05070f', '#191a3a', dawn), mix('#0a1320', '#3a2f5a', dawn)];
  const k = dawn - 1;
  return [mix('#191a3a', '#7fc4ff', k), mix('#3a2f5a', '#ffd6a0', k)];
}
function drawSky(g, x, y, w, h, dawn, cam, s, reduced) {
  const [top, low] = skyColors(dawn), sky = g.createLinearGradient(0, y, 0, y + h);
  sky.addColorStop(0, top); sky.addColorStop(1, low); g.fillStyle = sky; g.fillRect(x, y, w, h);
  const starA = Math.max(0, 1 - dawn * .7);
  for (const [sx, sy, size, i] of STARS) {
    const px = ((sx - cam * .03) % 900 + 900) % 900;
    if (px < x || px > x + w || sy > h - 4) continue;
    g.globalAlpha = starA * (reduced ? .55 : .4 + .35 * Math.sin(s * .9 + i)); rect(g, '#dfe9ff', px, y + sy, size, size);
  }
  g.globalAlpha = 1;
}
// Inside the tower: brick, tall arched windows on to the sky, and the great
// stopped clock on the wall, which slides by slower than the floor.
export function drawBackdrop(g, cam, level, s, reduced) {
  rect(g, '#1a1520', 0, 0, W, H);
  const dawn = Math.min(1, level / 7) * .8;
  const step = 150, off = -((cam * .3) % step);
  for (let wx = off - step; wx < W + step; wx += step) {
    const x = wx + 38;
    drawSky(g, x, 50, 74, 150, dawn, cam, s, reduced);
    g.fillStyle = '#1a1520'; g.beginPath(); g.moveTo(x, 50); g.lineTo(x, 88); g.arc(x + 37, 88, 37, Math.PI, 0); g.lineTo(x + 74, 50); g.fill();
    rect(g, '#2c2433', x - 4, 198, 82, 6);
    rect(g, '#2c2433', x + 35, 70, 4, 130); rect(g, '#2c2433', x, 140, 74, 3);
  }
  // Brick courses.
  g.fillStyle = '#ffffff07';
  const bo = -((cam * .3) % 32);
  for (let y = 214; y < FLOOR; y += 14) for (let x = bo + ((y / 14) % 2 ? 16 : 0) - 32; x < W; x += 32) g.fillRect(Math.round(x), y, 30, 12);
  // The great clock, stopped at five to midnight until the end.
  const cx = W / 2 + ((COURSE.length / 2 - cam) * .04) % 260;
  drawFace(g, cx, 290, 70, { minutes: 55, hours: 11 + 55 / 60, alpha: .14 });
  rect(g, '#0d0b12', 0, FLOOR + 16, W, H - FLOOR);
}
export function drawFace(g, x, y, r, { minutes = 55, hours = 11.9, alpha = 1, lit = 0, glow = 0, numerals = 12 } = {}) {
  g.save(); g.globalAlpha = alpha;
  g.fillStyle = '#e9dcc0'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  g.strokeStyle = '#8a6b3c'; g.lineWidth = Math.max(2, r * .06); g.stroke();
  for (let k = 0; k < 12; k++) {
    const a = k / 12 * Math.PI * 2 - Math.PI / 2, on = k < lit;
    const len = r * (k % 3 ? .1 : .16);
    g.strokeStyle = on ? '#e8a838' : '#3a2e22'; g.lineWidth = on ? Math.max(2, r * .05) : Math.max(1, r * .03);
    g.beginPath(); g.moveTo(x + Math.cos(a) * (r * .86 - len), y + Math.sin(a) * (r * .86 - len)); g.lineTo(x + Math.cos(a) * r * .86, y + Math.sin(a) * r * .86); g.stroke();
    if (on && glow) { g.globalAlpha = alpha * glow * .5; g.fillStyle = '#ffd98a'; g.beginPath(); g.arc(x + Math.cos(a) * r * .8, y + Math.sin(a) * r * .8, r * .07, 0, 7); g.fill(); g.globalAlpha = alpha; }
  }
  const hand = (turn, len, width, color) => { const a = turn * Math.PI * 2 - Math.PI / 2; g.strokeStyle = color; g.lineWidth = width; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); g.stroke(); g.lineCap = 'butt'; };
  hand(hours / 12, r * .5, Math.max(2, r * .07), '#2a1d10');
  hand(minutes / 60, r * .74, Math.max(1.5, r * .045), '#2a1d10');
  g.fillStyle = '#8a6b3c'; g.beginPath(); g.arc(x, y, Math.max(2, r * .06), 0, 7); g.fill();
  g.restore();
}
export function drawGear(g, x, y, r, a, color, teeth = 8) {
  g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = color;
  g.beginPath(); g.arc(0, 0, r * .74, 0, 7); g.fill();
  for (let k = 0; k < teeth; k++) { g.rotate(Math.PI * 2 / teeth); g.fillRect(-r * .14, -r, r * .28, r * .34); }
  g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(0, 0, r * .26, 0, 7); g.fill(); g.globalCompositeOperation = 'source-over';
  g.restore();
}
const TOP = { plain: ['#38323f', '#c9c0d6'], stair: ['#4a3a26', '#e8c88a'], top: ['#5a4426', '#ffd98a'], spring: ['#2e3a40', '#9fe2d8'] };
const TOOTH = { tick: ['#e8a838', '#5a3e12'], tock: ['#c8d4e8', '#2e3a4e'] };
// next: the beat of the coming landing, so the tooth that will hold you is up.
export function drawPlatforms(g, cam, run, s, rings, crumble, assist) {
  const next = Math.floor(s / BEAT + 1e-9) + (s / BEAT % 1 > .74 ? 1 : 0), into = snapIn(s);
  for (const p of COURSE.platforms) {
    const x = p.a - cam, w = p.b - p.a;
    if (x > W + 220 || x + w < -220) continue;
    const ring = rings.get(p.i), age = ring === undefined ? 9 : s - ring, hit = Math.max(0, 1 - age / .35);
    const y = FLOOR - (p.h || 0);
    if (p.kind === 'tick' || p.kind === 'tock') { drawTooth(g, p, x, w, run, s, hit, assist); continue; }
    if (p.kind === 'hand') { drawHand(g, p, x, s, hit, assist); continue; }
    if (p.kind === 'sand') { drawSand(g, p, x, w, s, crumble.get(p.i), ring); continue; }
    const [body, top] = TOP[p.kind] || TOP.plain;
    if (x > W + 20 || x + w < -20) continue;
    rect(g, body, x, y, w, H - y);
    if (p.kind === 'spring') { drawSpring(g, x, w, hit, s); continue; }
    rect(g, top, x + (p.flush ? 0 : 3), y, w - (p.flush ? 0 : 6), 3);
    rect(g, '#00000040', x, y + 3, w, 3);
    if (p.kind === 'plain') for (let k = 18; k < w - 10; k += 46) rect(g, '#ffffff0a', x + k, y + 12, 26, 3);
  }
}
function drawTooth(g, p, x, w, run, s, hit, assist) {
  // Up for the beat after this one only near the landing; otherwise up for now.
  const beat = Math.floor(s / BEAT + 1e-9), k = snapIn(s), nowUp = toothUp(p, beat), thenUp = toothUp(p, beat + 1);
  const up = assist ? 1 : nowUp * (1 - k) + thenUp * k;
  const [lit, dark] = TOOTH[p.kind], drop = (1 - up) * 18, y = FLOOR + drop;
  rect(g, dark, x + 2, y + 4, w - 4, H - y);
  // A tooth's slanted face, like the escape wheel's.
  g.fillStyle = up > .5 ? lit : mix(lit, '#1a1520', .6);
  g.beginPath(); g.moveTo(x + 2, y + 4); g.lineTo(x + w - 2, y + 4); g.lineTo(x + w - 10, y + 24); g.lineTo(x + 10, y + 24); g.fill();
  rect(g, up > .5 ? '#fff6dc' : '#ffffff22', x + 3, y - hit * 2, w - 6, 4);
  if (up > .5) { g.globalAlpha = .18 + .12 * up; rect(g, lit, x + 2, y - 10, w - 4, 10); g.globalAlpha = 1; }
  g.fillStyle = '#0b0a14aa'; g.font = 'bold 10px sans-serif'; g.textAlign = 'center';
  g.fillText(p.kind === 'tick' ? 'TICK' : 'TOCK', x + w / 2, y + 18);
}
function drawSpring(g, x, w, hit, s) {
  const squash = hit * 8;
  rect(g, '#22303a', x, FLOOR + 6, w, 30);
  g.strokeStyle = '#9fe2d8'; g.lineWidth = 3;
  g.beginPath();
  for (let k = 0; k <= 6; k++) { const yy = FLOOR + 2 + k * (4 - squash / 8); g.lineTo(x + (k % 2 ? w - 8 : 8), yy); }
  g.stroke();
  rect(g, '#d8fff6', x + 2, FLOOR - 2 + squash * .5, w - 4, 4);
  g.globalAlpha = .3 + .15 * Math.sin(s * 6); rect(g, '#9fe2d8', x + w / 2 - 2, FLOOR - 16, 4, 10); rect(g, '#9fe2d8', x + w / 2 - 6, FLOOR - 12, 12, 3); g.globalAlpha = 1;
}
// Sand: a crust on a deep slab. Stood on, it crumbles from below; left, it falls.
const grain = (i, k) => ((i * 9301 + k * 49297) % 233280) / 233280;
function drawSand(g, p, x, w, s, gone, landed) {
  const fallK = gone === undefined ? 0 : (s - gone) / .7;
  if (fallK >= 1) {
    // Only a dusting where it was, so the hole reads as a hole.
    g.globalAlpha = .35; for (let i = 6; i < w; i += 11) rect(g, '#d9b36a', x + i, FLOOR + 20 + (i * 7 % 13), 2, 2); g.globalAlpha = 1;
    return;
  }
  const on = landed !== undefined && s >= landed ? Math.min(1, (s - landed) / BEAT) : 0;
  const DEEP = 36, cols = Math.ceil(w / 6);
  for (let c = 0; c < cols; c++) {
    const cx = x + c * 6, cw = Math.min(6, x + w - cx);
    // The underside eats upwards, unevenly, while the hero stands there.
    const depth = DEEP - on * (14 + grain(c, p.i) * 14);
    const drop = fallK > 0 ? (fallK * fallK) * (120 + grain(c, 3) * 120) + grain(c, 5) * 6 * fallK : 0;
    g.globalAlpha = 1 - Math.max(0, fallK - .3) / .7;
    rect(g, c % 2 ? '#8a6a3a' : '#7d5f33', cx, FLOOR + 3 + drop, cw, depth - 3);
    rect(g, '#e8c27a', cx, FLOOR + drop, cw, 4);
    if (grain(c, 7) > .6) rect(g, '#f6dfa8', cx + 2, FLOOR + 9 + grain(c, 9) * 18 + drop, 2, 2);
    if (on > .2 && fallK === 0 && grain(c, 13) > .8) { const t2 = ((s - landed) * 1.5 + grain(c, 15)) % .6; rect(g, '#7d5f33', cx + 1, FLOOR + depth + t2 * t2 * 300, 4, 4); }
    // Grains trickling off the bottom.
    if (on > 0 && fallK === 0 && grain(c, 11) > .45) {
      for (let k = 0; k < 2; k++) {
        const t = ((s - landed) * (1.2 + grain(c, k) * .8) + grain(c, k + 20)) % .5, gy = FLOOR + depth + t * t * 400;
        rect(g, '#e8c27a', cx + 2 + k * 2, gy, 2, 2);
      }
    }
  }
  g.globalAlpha = 1;
  // Cracks across the crust once it is giving way.
  if (on > .3 && fallK === 0) { g.globalAlpha = on; for (let k = 1; k < 4; k++) rect(g, '#5a4020', x + w * k / 4 + (grain(k, p.i) - .5) * 20, FLOOR + 1, 1, 8 + on * 10); g.globalAlpha = 1; }
}// A clock hand: pivot at its left end, flat to the right on its own beat.
function drawHand(g, p, x, s, hit, assist) {
  const beat = Math.floor(s / BEAT + 1e-9), k = snapIn(s);
  const a0 = handAngle(p, beat * BEAT), a1 = handAngle(p, (beat + 1) * BEAT);
  let d = a1 - a0; if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2;
  const angle = assist ? 0 : a0 + d * k, len = p.len;
  // Where the bridge will lie: shown faintly when the coming beat is its beat.
  if (!assist && handFlat(p, beat + 1)) { g.globalAlpha = .18 + .1 * Math.sin(s * 9); rect(g, '#ffd98a', x, FLOOR - 1, len, 3); g.globalAlpha = 1; }
  g.save(); g.translate(x, FLOOR + 4); g.rotate(angle);
  g.fillStyle = '#2a1d10'; g.fillRect(0, -6, len, 12);
  g.fillStyle = Math.abs(angle) < .05 ? '#ffd98a' : '#c2953f'; g.fillRect(0, -6, len - 14, 5);
  g.beginPath(); g.moveTo(len - 16, -9); g.lineTo(len + 4, 0); g.lineTo(len - 16, 9); g.fill();
  g.fillStyle = '#e9dcc0'; g.beginPath(); g.arc(len * .55, 0, 6, 0, 7); g.fill();
  g.restore();
  // Four lamps under the pivot fill up towards the hand's beat: all four lit means
  // the coming landing is the one it lies flat for.
  if (!assist) {
    const wait = ((p.off - (beat + 1)) % 4 + 4) % 4, litN = 4 - wait;
    for (let k = 0; k < 4; k++) {
      const on = k < litN, lx = x - 46 + k * 11;
      rect(g, '#1a1520', lx - 1, FLOOR + 17, 9, 9);
      rect(g, on ? (litN === 4 ? '#fff1c9' : '#e8a838') : '#3a2e22', lx, FLOOR + 18, 7, 7);
    }
  }
  // The same lamps on a post where the ledge begins, read while the hand is still
  // off screen.
  const ledge = COURSE.platforms[p.i - 1];
  if (!assist && ledge && ledge.kind === 'plain') {
    const wait = ((p.off - (beat + 1)) % 4 + 4) % 4, litN = 4 - wait, px = ledge.a + 26 - (p.a - x);
    rect(g, '#2a1d10', px - 2, FLOOR - 64, 4, 64);
    rect(g, '#2a1d10', px - 9, FLOOR - 112, 18, 50);
    for (let k = 0; k < 4; k++) rect(g, k < litN ? (litN === 4 ? '#fff1c9' : '#e8a838') : '#3a2e22', px - 5, FLOOR - 74 - k * 11, 10, 8);
    if (litN === 4) { g.globalAlpha = .3; g.fillStyle = '#fff1c9'; g.beginPath(); g.arc(px, FLOOR - 92, 22, 0, 7); g.fill(); g.globalAlpha = 1; }
  }
  g.fillStyle = '#8a6b3c'; g.beginPath(); g.arc(x, FLOOR + 4, 11, 0, 7); g.fill();
  g.fillStyle = '#ffd98a'; g.beginPath(); g.arc(x, FLOOR + 4, 4, 0, 7); g.fill();
  if (hit) { g.globalAlpha = hit * .5; rect(g, '#fff1c9', x, FLOOR - 20 * hit, len, 2); g.globalAlpha = 1; }
}
export function drawPendulums(g, cam, s, faded) {
  const beam = COURSE.pendulums.filter(p => p.x - cam > -200 && p.x - cam < W + 200);
  for (const p of beam) {
    const bob = bobAt(p, s), px = p.x - cam, bx = bob.x - cam;
    rect(g, '#2a2232', px - 30, PIVOT_Y - 8, 60, 8); rect(g, '#5a4a60', px - 30, PIVOT_Y - 8, 60, 2);
    g.globalAlpha = faded ? .35 : 1;
    g.strokeStyle = '#8a6b3c'; g.lineWidth = 3; g.beginPath(); g.moveTo(px, PIVOT_Y); g.lineTo(bx, bob.y); g.stroke();
    g.fillStyle = '#c2953f'; g.beginPath(); g.arc(bx, bob.y, BOB_DRAWN, 0, 7); g.fill();
    g.fillStyle = '#ffe6aa'; g.beginPath(); g.arc(bx - 4, bob.y - 4, 4, 0, 7); g.fill();
    g.strokeStyle = '#5a3e12'; g.lineWidth = 2; g.beginPath(); g.arc(bx, bob.y, BOB_DRAWN, 0, 7); g.stroke();
    g.globalAlpha = 1;
    // Its shadow on the floor tells where it is at a glance.
    g.globalAlpha = .25; g.fillStyle = '#000'; g.beginPath(); g.ellipse(bx, FLOOR + 1, 12, 3, 0, 0, 7); g.fill(); g.globalAlpha = 1;
  }
}
export function drawGears(g, cam, got, s, gotAt) {
  COURSE.gears.forEach((gear, i) => {
    const x = gear.x - cam; if (x < -40 || x > W + 40) return;
    const have = got.includes(i), since = have ? s - (gotAt.get(i) ?? -9) : 0;
    if (have && since > 1) return;
    rect(g, '#5a4a60', x - 1, 0, 2, GEAR_Y - 22);
    const y = GEAR_Y - 12 - (have ? since * 120 : 0);
    g.globalAlpha = have ? 1 - since : 1;
    drawGear(g, x, y, 12, s * (have ? 8 : .6), have ? '#fff1c9' : '#e8a838');
    if (!have) { g.globalAlpha = .15 + .1 * Math.sin(s * 4 + i); g.fillStyle = '#ffd98a'; g.beginPath(); g.arc(x, y, 20, 0, 7); g.fill(); }
    g.globalAlpha = 1;
  });
}
export function drawBell(g, cam, s, rang = -9) {
  const x = COURSE.bellX - cam, y = FLOOR - 110 - 150;
  if (x < -120 || x > W + 120) return;
  const swing = rang > 0 ? Math.sin((s - rang) * 9) * .3 * Math.exp(-(s - rang) * 1.2) : Math.sin(s * 1.3) * .02;
  rect(g, '#2a2232', x - 60, 20, 120, 10); rect(g, '#2a2232', x - 3, 30, 6, y - 40);
  g.save(); g.translate(x, y - 10); g.rotate(swing);
  g.fillStyle = '#c2953f'; g.beginPath(); g.moveTo(-22, 0); g.quadraticCurveTo(-26, 50, -56, 82); g.lineTo(56, 82); g.quadraticCurveTo(26, 50, 22, 0); g.closePath(); g.fill();
  g.fillStyle = '#ffe6aa'; g.fillRect(-14, 6, 6, 60);
  g.fillStyle = '#8a6b3c'; g.fillRect(-58, 80, 116, 6);
  g.fillStyle = '#5a3e12'; g.beginPath(); g.arc(0, 92, 8, 0, 7); g.fill();
  g.restore();
}
export function drawLanterns(g, cam, lit, s) {
  COURSE.checkpoints.forEach((cp, i) => {
    const x = cp.from - cam; if (i === 0 || x < -10 || x > W + 10) return;
    const on = lit.has(i);
    rect(g, '#5a4a30', x - 1, FLOOR - 18, 2, 18);
    rect(g, on ? '#ffd98a' : '#3b3428', x - 3, FLOOR - 25, 6, 8);
    if (on) { g.globalAlpha = .22 + .05 * Math.sin(s * 3 + i); g.fillStyle = '#ffd98a'; g.beginPath(); g.arc(x, FLOOR - 21, 11, 0, 7); g.fill(); g.globalAlpha = 1; }
  });
}
export function drawBurst(g, x, y, age, power = 1, reduced = false) {
  const life = .5 + power * .5, k = age / life;
  if (k < 0 || k > 1) return;
  const fade = 1 - k;
  g.strokeStyle = '#fff1c9'; g.lineWidth = 2 + power * 2; g.globalAlpha = fade * .85;
  g.beginPath(); g.arc(x, y, 14 + (70 + power * 200) * (1 - fade * fade), 0, 7); g.stroke();
  if (!reduced) {
    const rays = Math.round(8 + power * 10);
    for (let i = 0; i < rays; i++) {
      const a = i / rays * Math.PI * 2 + .3, r0 = 18 + k * (60 + power * 160), r1 = r0 + (22 + power * 70) * fade;
      g.beginPath(); g.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); g.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); g.stroke();
    }
  }
  g.globalAlpha = 1;
}
// The morning. `beats` counts from the heart's first tick; `found` lights hours.
export function drawMorning(g, beats, found, s, reduced) {
  const dawnK = smooth((beats - 12) / 14);
  // The sky behind the opened clock: night, then the sun coming round.
  const [top, low] = skyColors(1 + dawnK);
  const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, top); sky.addColorStop(1, low); g.fillStyle = sky; g.fillRect(0, 0, W, H);
  if (dawnK < 1) for (const [sx, sy, size, i] of STARS) { g.globalAlpha = (1 - dawnK) * .7; rect(g, '#dfe9ff', sx % W, sy * 3.2, size, size); }
  g.globalAlpha = 1;
  // The sun travels sunwise up the right side, round behind the tower.
  // Up the right of the tower, from below the horizon to high in the sky.
  const sx = 318 - 10 * dawnK, sy = 540 - 450 * dawnK;
  if (dawnK > 0) {
    const glow = g.createRadialGradient(sx, sy, 10, sx, sy, 200); glow.addColorStop(0, '#fff3c0'); glow.addColorStop(.25, '#ffd98a99'); glow.addColorStop(1, '#ffd98a00');
    g.fillStyle = glow; g.fillRect(0, 0, W, H);
    g.fillStyle = '#fff6d8'; g.beginPath(); g.arc(sx, sy, 30, 0, 7); g.fill();
    if (!reduced) { g.strokeStyle = '#fff1c966'; g.lineWidth = 3; for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2 + s * .2; g.beginPath(); g.moveTo(sx + Math.cos(a) * 40, sy + Math.sin(a) * 40); g.lineTo(sx + Math.cos(a) * 62, sy + Math.sin(a) * 62); g.stroke(); } }
  }
  // The tower itself: a silhouette warming with the light.
  const wall = mix('#141020', '#6a4a3a', dawnK);
  g.fillStyle = wall; g.fillRect(84, 120, 192, H - 120);
  g.beginPath(); g.moveTo(74, 124); g.lineTo(180, 40); g.lineTo(286, 124); g.fill();
  rect(g, mix('#0b0a14', '#3a2a22', dawnK), 0, H - 40, W, 40);
  // Gears behind the face turn once the heart is beating: one more each beat.
  const shown = Math.min(8, Math.max(0, Math.floor(beats)));
  for (let k = 0; k < shown; k++) {
    const a = k / 8 * Math.PI * 2, gx = 180 + Math.cos(a) * 112, gy = 250 + Math.sin(a) * 112;
    drawGear(g, gx, gy, 22 + (k % 3) * 5, (k % 2 ? -1 : 1) * beats * .8, mix('#5a4426', '#e8a838', .4 + .4 * dawnK), 10);
  }
  return { cx: 180, cy: 250, sun: { x: sx, y: sy } };
}
export { landingSpan };
