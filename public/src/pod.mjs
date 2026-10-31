// Original pixel artwork, authored for HOPPOD. Native body is 20 × 19px;
// antennas and spring fit a 32 × 36px animation envelope. No external assets.
const body = [
  '      oooooooo      ',
  '    ooccccccccoo    ',
  '   occcwwwwccccco   ',
  '  occwwwwwwcccccco  ',
  ' occwwwwwwwcccccsco ',
  ' occccddddddddccsco ',
  'occccddddddddddccsco',
  'occcddddddddddddcsco',
  'occcddddddddddddcsco',
  'occcddddddddddddcsco',
  'occcddddddddddddcsco',
  'occccddddddddddccsco',
  ' occccddddddddccsco ',
  ' occccccccccccccsco ',
  '  oaaaacccccaaaaso  ',
  '  oaaaaaaaaaaaaso   ',
  '   oosssaaasssoo    ',
  '     oooooooo       ',
];
const colors = { o: '#172638', c: '#fff0d0', w: '#fffbea', s: '#cfba9a', a: '#ff9161', d: '#172638' };
export function drawPod(g, x, y, scale = 2, { phase = 0, fast = false, land = 0, dead = 0, time = 0, idle = false } = {}) {
  g.save();
  g.translate(Math.round(x), Math.round(y));
  g.rotate(dead ? Math.min(2.4, dead * 4) : 0);
  g.scale(scale, scale);
  const rect = (c, a, b, w, h) => { g.fillStyle = c; g.fillRect(Math.round(a), Math.round(b), w, h); };
  const spring = Math.round(3 + Math.sin(phase * Math.PI) * 2 - land * 2);
  const top = -18 - spring + (idle ? Math.round(Math.sin(time * 3)) : 0);
  const bend = fast ? -4 : Math.round(Math.sin(phase * Math.PI * 2));
  for (const ear of [-6, 5]) {
    rect(colors.o, ear - 1 + bend, top - 10, 5, 8);
    rect(colors.c, ear + bend, top - 9, 3, 6);
    rect(colors.a, ear + 1 + bend, top - 8, 1, 4);
    rect(colors.o, ear - 1, top - 4, 5, 5);
    rect(colors.c, ear, top - 4, 3, 4);
  }
  body.forEach((row, py) => [...row].forEach((p, px) => { if (colors[p]) rect(colors[p], px - 10, top + py, 1, 1); }));
  const eyeY = top + 8;
  if (dead) {
    for (const eye of [-4, 3]) for (let k = 0; k < 3; k++) {
      rect('#ffba8c', eye + k, eyeY + k, 1, 1); rect('#ffba8c', eye + k, eyeY + 2 - k, 1, 1);
    }
  } else {
    const blink = idle && Math.sin(time * 1.7) > .99;
    for (const eye of [-4, 3]) rect('#ffe38e', eye, eyeY, 2, blink ? 1 : 4);
    if (fast) rect('#fff5bb', -3, eyeY, 1, 1);
  }
  for (let k = 0; k < spring; k++) rect(k % 2 ? '#f9d49c' : '#6e8795', k % 2 ? -3 : -5, -spring + k, 8, 1);
  rect(colors.o, -7, 0, 14, 2); rect('#ffe9be', -6, 0, 12, 1);
  g.restore();
}
