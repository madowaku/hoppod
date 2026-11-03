// STORY crew parts: "same face, different job". Each friend keeps the
// shared pod body and face from pod.mjs (FREE RUN art, untouched); this adds
// the parts that make its silhouette and, when it works, its transformed
// form. Spec and priorities: docs/story/CREW_SPRITES.md.
// Coordinates are pod pixels (drawn at `scale`): x centred, feet on y = 0,
// up negative. With the friends' bob the pod's head top sits near y = -21.

const OUTLINE = '#172638';
const px = (g, c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
const clamp01 = v => Math.max(0, Math.min(1, v));
const smooth = (a, b, v) => { const k = clamp01((v - a) / (b - a)); return k * k * (3 - 2 * k); };

// opts: { palette, form 0..1 (normal → transformed), pulse 0..1 (beat
// flash), top (pod head top), on (blue light lit),
// green: plant (seconds since its feet touched the switch, or null),
// red: to [x, y] (where the hook reaches, pod pixels), grip 0..1 (open →
// closed), dir 'up'|'down' when no `to` is given;
// missing: green or red before its part is fitted: only the bare joint and
// a dotted outline of what should be there }
export function drawCrewParts(g, who, x, y, scale, { palette: P, form = 0, pulse = 0, dir = 'up', top = -21, on = true, plant = null, to = null, grip = 0, missing = false } = {}) {
  g.save(); g.translate(Math.round(x), Math.round(y)); g.scale(scale, scale);
  if (missing) drawMissing(g, who, P, top);
  else if (who === 'blue') drawBlue(g, P, form, pulse, top, on);
  else if (who === 'green') drawGreen(g, P, form, top, plant);
  else if (who === 'red') drawRed(g, P, form, top, to ?? (form >= .75 ? (dir === 'down' ? [-24, top + 22] : [-23, top - 4]) : form >= .25 ? [-17, top + 3] : null), grip);
  g.restore();
}

// Blue: a small lamp on a stem above the ears. It does not grow into a sign:
// in light mode the bulb brightens and the light itself fans out from it,
// wider and longer as the form opens, breathing on each bell.
function drawBlue(g, P, form, pulse, top, on) {
  const lamp = top - 15, lit = on || form > 0;
  if (form > 0) {
    const reach = 10 + 26 * form + 6 * pulse, spread = .35 + 1.05 * form, cx = 0, cy = lamp + 1;
    const beam = g.createRadialGradient(cx, cy, 1, cx, cy, reach);
    beam.addColorStop(0, `rgba(230,244,255,${.55 * form + .25 * pulse})`); beam.addColorStop(.35, `rgba(169,214,255,${.22 * form + .15 * pulse})`); beam.addColorStop(1, 'rgba(111,182,255,0)');
    g.fillStyle = beam;
    // Five rays fanning upward and out; the outer ones open last.
    for (let i = -2; i <= 2; i++) {
      const open = smooth(Math.abs(i) * .18, .45 + Math.abs(i) * .18, form), a = -Math.PI / 2 + i * spread / 2 * open, w = .09 + .04 * (2 - Math.abs(i));
      const len = reach * (1 - .12 * Math.abs(i)) * (.9 + .1 * Math.sin(i * 1.7 + pulse * 3));
      g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, len, a - w, a + w); g.closePath(); g.fill();
    }
    // A soft halo, and a ring that leaves the lamp on each bell.
    g.beginPath(); g.arc(cx, cy, 4 + 4 * form, 0, Math.PI * 2); g.fill();
    if (pulse > 0) { g.strokeStyle = `rgba(230,244,255,${.6 * pulse})`; g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, 6 + 16 * (1 - pulse), 0, Math.PI * 2); g.stroke(); }
  } else if (on) { g.globalAlpha = .3; px(g, P.w, -4, lamp - 2, 8, 8); g.globalAlpha = 1; }
  px(g, OUTLINE, -1, lamp + 3, 2, top - lamp - 2);
  px(g, OUTLINE, -3, lamp - 1, 6, 5); px(g, OUTLINE, -2, lamp - 2, 4, 1);
  px(g, lit ? '#ffffff' : P.c, -2, lamp, 4, 3); px(g, lit ? '#ffffff' : P.c, -1, lamp - 1, 2, 1);
  if (form > .5) px(g, P.a, -2, lamp + 3, 4, 1);
  for (const ear of [-6, 5]) px(g, on ? '#e6f4ff' : P.a, ear + 1, top - 10, 1, 2);
  g.globalAlpha = .45; px(g, P.a, -3, 3, 6, 1); g.globalAlpha = .2; px(g, P.a, -2, 5, 4, 1); g.globalAlpha = 1;
}

// Green: wide foot pads on hip joints make it the broadest pod. Anchored, the
// pads swing out with an overshoot and bite the ground (small teeth and a
// puff of dust where they land), a strut drops from the belly, the ear tips
// dim (head down, working) and green light runs under it.
function drawGreen(g, P, form, top, plant) {
  // On the switch the pads swing 2px past their stop, then settle into it.
  const age = plant ?? 9, spread = plant === null ? Math.round(4 * form) : age < .16 ? Math.round(6 * smooth(0, .1, age)) : 4;
  const w = 8 + spread, l = -10 - w;
  for (const [x0, side] of [[l, -1], [10, 1]]) {
    px(g, OUTLINE, x0, -5, w, 6); px(g, P.s, x0 + 1, -4, w - 2, 4); px(g, P.c, x0 + 1, -4, w - 2, 1);
    px(g, OUTLINE, side < 0 ? -11 : 9, -8, 3, 4); px(g, P.s, side < 0 ? -10 : 10, -7, 1, 2);
    if (form > .5) for (let k = 1; k < w - 1; k += 3) px(g, OUTLINE, x0 + k, 1, 1, 1);
    // Dust kicked out from under each pad as it plants.
    if (age < .35) {
      const t = age / .35, edge = side < 0 ? x0 : x0 + w;
      g.globalAlpha = .7 * (1 - t);
      for (let k = 0; k < 3; k++) px(g, '#c9e8d4', edge + side * (2 + Math.round(t * (5 + 3 * k))), -1 - Math.round(t * (1 + k)), 1, 1);
      g.globalAlpha = 1;
    }
  }
  if (form > .5) {
    px(g, OUTLINE, -2, 0, 4, 3); px(g, P.s, -1, 1, 2, 2);
    for (const ear of [-6, 5]) px(g, '#2f4a3c', ear + 1, top - 8, 1, 4);
    g.globalAlpha = form * (age < .2 ? 1 : .6); px(g, P.a, l, 1, 10 + w - l, 1); g.globalAlpha = 1;
  }
}

// Red: asymmetric, a crane arm folded on the left shoulder. Working the crane
// it runs out a little; when it goes for green it telescopes all the way to
// wherever the hook must reach, the hook opens, and closes on green.
function drawRed(g, P, form, top, to, grip) {
  const sx = -11, sy = top + 7;
  px(g, OUTLINE, sx - 3, sy - 1, 4, 6); px(g, '#9a5a4e', sx - 2, sy, 2, 4); px(g, P.a, sx - 2, sy, 1, 1);
  if (!to) { px(g, OUTLINE, sx - 4, sy - 5, 3, 6); px(g, '#c46f5c', sx - 3, sy - 4, 1, 4); return; }
  const x0 = sx - 2, y0 = sy + 1, [x1, y1] = to, dx = x1 - x0, dy = y1 - y0, len = Math.max(1, Math.hypot(dx, dy)), ux = dx / len, uy = dy / len;
  const n = Math.ceil(len), dot = (c, k, s) => px(g, c, Math.round(x0 + ux * k) - (s >> 1), Math.round(y0 + uy * k) - (s >> 1), s, s);
  for (let k = 0; k <= n; k++) dot(OUTLINE, k, 3);
  for (let k = 0; k <= n; k++) dot(k % 6 === 5 ? '#ffd2c4' : '#c46f5c', k, 1);
  // The hook: two prongs, spread when open, pinched together when closed.
  const spread = .95 - .8 * clamp01(grip), hx = x0 + ux * len, hy = y0 + uy * len;
  for (const side of [-1, 1]) {
    const a = Math.atan2(uy, ux) + side * spread, bx = Math.cos(a), by = Math.sin(a);
    for (let k = 1; k <= 4; k++) { px(g, OUTLINE, Math.round(hx + bx * k) - 1, Math.round(hy + by * k) - 1, 3, 3); }
    for (let k = 1; k <= 4; k++) px(g, '#ffd2c4', Math.round(hx + bx * k), Math.round(hy + by * k), 1, 1);
    // Tips curl inward so it reads as a hook, not a fork.
    const tx = Math.round(hx + bx * 4 - side * -uy * 1.5), ty = Math.round(hy + by * 4 - side * ux * 1.5);
    px(g, '#ffd2c4', tx, ty, 1, 1);
  }
  px(g, OUTLINE, 7, -1, 6, 3); px(g, P.s, 8, 0, 4, 1);
}

// Before its part is fitted: green has bare hip sockets where the pads go,
// red a bare shoulder socket; a dotted outline shows the missing part.
function drawMissing(g, who, P, top) {
  const dots = (x, y, w, h) => { for (let i = 0; i < w; i += 2) { px(g, P.s, x + i, y, 1, 1); px(g, P.s, x + i, y + h - 1, 1, 1); } for (let j = 2; j < h - 1; j += 2) { px(g, P.s, x, y + j, 1, 1); px(g, P.s, x + w - 1, y + j, 1, 1); } };
  if (who === 'green') {
    for (const side of [-1, 1]) { px(g, OUTLINE, side < 0 ? -11 : 9, -6, 3, 3); px(g, '#4a5a52', side < 0 ? -10 : 10, -5, 1, 1); }
    g.globalAlpha = .8; dots(-18, -5, 8, 6); dots(10, -5, 8, 6);
  } else if (who === 'red') {
    // The bare socket on the left shoulder and where the folded arm should be.
    const sx = -11, sy = top + 7;
    px(g, OUTLINE, sx - 3, sy - 1, 4, 6); px(g, '#5a4a46', sx - 2, sy, 2, 4);
    g.globalAlpha = .85; dots(sx - 6, sy - 7, 5, 9);
  }
  g.globalAlpha = 1;
}

// Green's and red's parts, as they lie on the road and fly to their friend.
// Green: the magnetic leg unit, two foot pads on a bar with a magnet whose
// field flickers. Red: the telescopic hook, three nested tubes and the hook.
// Centred on x, y (pod pixels at `scale`); t is seconds, for the flicker.
export function drawKit(g, who, x, y, scale, t = 0) {
  g.save(); g.translate(Math.round(x), Math.round(y)); g.scale(scale, scale);
  if (who === 'green') {
    for (const x0 of [-11, 3]) { px(g, OUTLINE, x0, -1, 8, 6); px(g, '#73c290', x0 + 1, 0, 6, 4); px(g, '#b4f2c8', x0 + 1, 0, 6, 1); for (let k = 1; k < 7; k += 3) px(g, OUTLINE, x0 + k, 5, 1, 1); }
    px(g, OUTLINE, -4, -2, 8, 3); px(g, '#4f7a6c', -3, -1, 6, 1);
    // The magnet: a horseshoe over the bar, poles lit.
    px(g, OUTLINE, -4, -8, 8, 7); px(g, '#c9d4d0', -3, -7, 6, 2); px(g, OUTLINE, -1, -5, 2, 4); px(g, '#ff6a4f', -3, -5, 2, 3); px(g, '#6fb6ff', 1, -5, 2, 3);
    if ((t * 6 | 0) % 2) { g.globalAlpha = .8; px(g, '#9ff0c4', -7, -9, 1, 2); px(g, '#9ff0c4', 6, -9, 1, 2); px(g, '#9ff0c4', -6, -11, 1, 1); px(g, '#9ff0c4', 5, -11, 1, 1); g.globalAlpha = 1; }
  } else {
    // Tubes rising diagonally, each a little thinner, then the hook.
    const tube = (x0, y0, n, w, c) => { for (let k = 0; k < n; k++) { px(g, OUTLINE, x0 + k - 1, y0 - k - 1, w + 2, w + 2); } for (let k = 0; k < n; k++) px(g, c, x0 + k, y0 - k, w, w); };
    tube(-8, 4, 5, 3, '#9a5a4e'); tube(-3, -1, 4, 2, '#c46f5c'); tube(1, -5, 3, 1, '#ffbcae');
    px(g, '#ffd2c4', -7, 4, 1, 1); px(g, '#ffd2c4', -2, -1, 1, 1);
    // The hook: two curled prongs.
    px(g, OUTLINE, 3, -10, 3, 3); px(g, OUTLINE, 5, -8, 4, 3); px(g, OUTLINE, 7, -11, 3, 3);
    px(g, '#ffd2c4', 4, -9, 1, 1); px(g, '#ffd2c4', 6, -7, 2, 1); px(g, '#ffd2c4', 8, -10, 1, 1); px(g, '#ffd2c4', 8, -8, 1, 1);
  }
  g.restore();
}

// Hero transmit mode over pod.mjs's art (docked: phase 0 → head top -21),
// played out across the silent beat after the dock. `a` is beats since the
// dock (1 = done). First the spring legs fold out, overshoot and lock with a
// spark at each foot (0–.25): it will not hop again. Then the ears rise into
// an antenna (.35–.8). From D+1 a light over the head and one in the chest
// blink on the beat, with a ring around the head light when lit.
export const TRANSMIT_LOCK = .25;
export function drawTransmit(g, x, y, scale, a, on) {
  if (a <= 0) return;
  const top = -21, rise = Math.round(2 * smooth(.35, .8, a)), locked = a >= TRANSMIT_LOCK;
  g.save(); g.translate(Math.round(x), Math.round(y)); g.scale(scale, scale);
  if (rise) for (const ear of [-6, 5]) {
    px(g, OUTLINE, ear - 1, top - 10 - rise, 5, rise + 1);
    px(g, '#fff0d0', ear, top - 9 - rise, 3, rise + 1);
    px(g, on ? '#bfe6ff' : '#ff9161', ear + 1, top - 9 - rise, 1, 3);
  }
  // Out one pixel too far, then pulled back in as it locks.
  const leg = a < TRANSMIT_LOCK * .7 ? Math.round(5 * smooth(0, TRANSMIT_LOCK * .7, a)) : locked ? 4 : 5;
  if (locked) { px(g, OUTLINE, -9, 0, 18, 2); px(g, '#ffe9be', -8, 0, 16, 1); }
  for (const side of [-1, 1]) {
    for (let i = 0; i <= leg; i++) px(g, '#8aa0ac', side * (8 + i) - (side < 0 ? 1 : 0), 1 + Math.floor(i / 2), 2, 2);
    if (!leg) continue;
    const fx = side * (9 + leg) - (side < 0 ? 4 : 0), fy = 2 + Math.floor(leg / 2);
    px(g, OUTLINE, fx, fy, 5, 2); px(g, '#ffe9be', fx + 1, fy, 3, 1);
    // The lock: a bright pin at each hip, and a spark at each foot as it bites.
    if (locked) px(g, '#ffe3ac', side * 8 - (side < 0 ? 1 : 0), 0, 2, 2);
    const spark = locked ? 1 - (a - TRANSMIT_LOCK) / .2 : 0;
    if (spark > 0) {
      g.globalAlpha = spark; const sx = fx + 2, sy = fy - 1, r = Math.round(2 + 3 * (1 - spark));
      for (const [ox, oy] of [[-r, 0], [r, 0], [0, -r], [side * r, -r]]) px(g, '#fff5d8', sx + ox, sy + oy, 1, 1);
      g.globalAlpha = 1;
    }
  }
  px(g, on ? '#e6f4ff' : '#4a5a66', -1, top - 4, 2, 2); px(g, on ? '#bfe6ff' : '#4a5a66', -1, top + 15, 2, 1);
  if (on) { g.strokeStyle = 'rgba(191,230,255,.85)'; g.lineWidth = .7; g.beginPath(); g.arc(0, top - 3, 4, 0, Math.PI * 2); g.stroke(); }
  g.restore();
}
