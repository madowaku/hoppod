// STORY crew parts: "same face, different job". Each friend keeps the
// shared pod body and face from pod.mjs (FREE RUN art, untouched); this adds
// the parts that make its silhouette and, when it works, its transformed
// form. Spec and priorities: docs/story/CREW_SPRITES.md.
// Coordinates are pod pixels (drawn at `scale`): x centred, feet on y = 0,
// up negative. With the friends' bob the pod's head top sits near y = -21.

const OUTLINE = '#172638';
const px = (g, c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };

// opts: { palette, form 0..1 (normal → transformed), pulse 0..1 (beat
// flash), dir 'up'|'down' (red's arm), snap (green's one-frame overshoot),
// top (pod head top), on (blue light lit) }
export function drawCrewParts(g, who, x, y, scale, { palette: P, form = 0, pulse = 0, dir = 'up', snap = false, top = -21, on = true } = {}) {
  g.save(); g.translate(Math.round(x), Math.round(y)); g.scale(scale, scale);
  if (who === 'blue') {
    // Lamp on a stem above the head; ear tips lit; a faint hover jet. In
    // light mode the lamp opens, reflectors fold out beside the ears and a
    // half-circle of light spreads under it.
    const open = form > .5, glow = (on ? .3 : .1) + .35 * form + .35 * pulse, lamp = top - 15;
    px(g, OUTLINE, -1, lamp + 3, 2, top - lamp - 2);
    g.globalAlpha = glow; px(g, P.w, open ? -6 : -4, open ? lamp - 4 : lamp - 2, open ? 12 : 8, open ? 11 : 8); g.globalAlpha = 1;
    px(g, OUTLINE, -3, lamp - 1, 6, 5); px(g, on || open ? '#ffffff' : P.c, -2, lamp, 4, 3);
    if (open) { px(g, OUTLINE, -5, lamp - 2, 10, 2); px(g, '#ffffff', -4, lamp - 2, 8, 1); px(g, P.a, -2, lamp + 3, 4, 1); }
    for (const ear of [-6, 5]) px(g, on ? '#e6f4ff' : P.a, ear + 1, top - 10, 1, 2);
    if (open) for (const side of [-1, 1]) { px(g, OUTLINE, side < 0 ? -10 : 9, top - 9, 2, 5); px(g, P.w, side < 0 ? -10 : 10, top - 8, 1, 3); }
    g.globalAlpha = .45; px(g, P.a, -3, 3, 6, 1); g.globalAlpha = .2; px(g, P.a, -2, 5, 4, 1); g.globalAlpha = 1;
    if (form > 0) {
      const light = g.createRadialGradient(0, 2, 2, 0, 2, 18 + 6 * form);
      light.addColorStop(0, `rgba(169,214,255,${.3 * form + .15 * pulse})`); light.addColorStop(1, 'rgba(111,182,255,0)');
      g.fillStyle = light; g.beginPath(); g.arc(0, 2, 18 + 6 * form, Math.PI, 0); g.fill();
    }
  } else if (who === 'green') {
    // Wide foot pads make it the broadest pod. Deployed they swing out 3px
    // each way (one frame of overshoot), a strut drops from the belly, the
    // ear tips dim (head down, working) and green light runs under it.
    const spread = Math.round(4 * form) + (snap ? 2 : 0), w = 8 + spread, l = -10 - w;
    for (const [x0, dir] of [[l, -1], [10, 1]]) {
      px(g, OUTLINE, x0, -5, w, 6); px(g, P.s, x0 + 1, -4, w - 2, 4); px(g, P.c, x0 + 1, -4, w - 2, 1);
      // A short hip joint ties each pad to the body.
      px(g, OUTLINE, dir < 0 ? -11 : 9, -8, 3, 4); px(g, P.s, dir < 0 ? -10 : 10, -7, 1, 2);
    }
    if (form > .5) {
      px(g, OUTLINE, -2, 0, 4, 3); px(g, P.s, -1, 1, 2, 2);
      for (const ear of [-6, 5]) px(g, '#2f4a3c', ear + 1, top - 8, 1, 4);
      g.globalAlpha = form; px(g, P.a, l, 1, 10 + w - l, 1); g.globalAlpha = 1;
    }
  } else if (who === 'red') {
    // Asymmetric: a folded crane arm on the left shoulder. Deployed it runs
    // out half (5px) or fully (9px) to a bright hook, up and out or down
    // towards what it carries; the right foot braces.
    const reach = form >= .75 ? 9 : form >= .25 ? 5 : 0, sx = -11, sy = top + 7;
    px(g, OUTLINE, sx - 3, sy - 1, 4, 6); px(g, '#9a5a4e', sx - 2, sy, 2, 4); px(g, P.a, sx - 2, sy, 1, 1);
    if (!reach) { px(g, OUTLINE, sx - 4, sy - 5, 3, 6); px(g, '#c46f5c', sx - 3, sy - 4, 1, 4); }
    else {
      const step = dir === 'down' ? 1 : -1;
      for (let k = 1; k <= reach; k++) { px(g, OUTLINE, sx - 2 - k, sy + 1 + step * k - 1, 2, 3); }
      for (let k = 1; k <= reach; k++) px(g, '#c46f5c', sx - 2 - k, sy + 1 + step * k, 1, 1);
      const hx = sx - 2 - reach, hy = sy + 1 + step * reach;
      px(g, '#ffd2c4', hx - 1, hy, 1, 3); px(g, '#ffd2c4', hx, hy + 3, 2, 1);
      px(g, OUTLINE, 7, -1, 6, 3); px(g, P.s, 8, 0, 4, 1);
    }
  }
  g.restore();
}

// Hero transmit mode over pod.mjs's art (docked: phase 0 → head top -21).
// k 0..1 eases it in. Ears grow 2px, the base widens 2px each side and
// locks, a light over the head and one in the chest blink on the beat with
// a ring around the head light when lit.
export function drawTransmit(g, x, y, scale, k, on) {
  if (k <= 0) return;
  const top = -21, rise = Math.round(2 * k);
  g.save(); g.translate(Math.round(x), Math.round(y)); g.scale(scale, scale);
  for (const ear of [-6, 5]) {
    px(g, OUTLINE, ear - 1, top - 10 - rise, 5, rise + 1);
    px(g, '#fff0d0', ear, top - 9 - rise, 3, rise + 1);
    px(g, on ? '#bfe6ff' : '#ff9161', ear + 1, top - 9 - rise, 1, 3);
  }
  px(g, OUTLINE, -9, 0, 18, 2); px(g, '#ffe9be', -8, 0, 16, 1);
  px(g, on ? '#e6f4ff' : '#4a5a66', -1, top - 4, 2, 2); px(g, on ? '#bfe6ff' : '#4a5a66', -1, top + 15, 2, 1);
  if (on) { g.strokeStyle = 'rgba(191,230,255,.85)'; g.lineWidth = .7; g.beginPath(); g.arc(0, top - 3, 4, 0, Math.PI * 2); g.stroke(); }
  g.restore();
}
