// The pod starts on the Moon's far side, where Earth is below the horizon
// and radio is shadowed. Walking toward the near side makes Earth rise. The
// rise is a pure function of world distance, so every run replays it.
// Roughly 165px per hop: first glow ≈ 10 HOPS, first light ≈ 20, full disc
// ≈ 100, highest point ≈ 200. The run never ends because Earth is up.
export const EARTH_GLOW = 1500, EARTH_PEEK = 3300, EARTH_FULL = 16500, EARTH_HIGH = 33000;
const clamp = value => Math.max(0, Math.min(1, value));
export function earthRise(x) {
  const glow = clamp((x - EARTH_GLOW) / (EARTH_PEEK - EARTH_GLOW));
  const rise = clamp((x - EARTH_PEEK) / (EARTH_FULL - EARTH_PEEK));
  const climb = clamp((x - EARTH_FULL) / (EARTH_HIGH - EARTH_FULL));
  const signal = x < EARTH_PEEK ? 0 : rise < 1 / 3 ? 1 : rise < 2 / 3 ? 2 : rise < 1 ? 3 : 4;
  return { glow, rise, climb, signal };
}
// Disc centre: top touches the horizon at rise 0, bottom clears it at 1,
// then it climbs slowly toward the sky position the old moon used. Ease-out
// so first light shows over low ridges as soon as the first signal bar does.
export function earthCenterY({ rise, climb }, horizon, radius, high) {
  const cleared = horizon - radius, eased = 1 - (1 - rise) ** 2;
  return Math.round(horizon + radius - eased * radius * 2 - climb * (cleared - high));
}
// Original pixel Earth: ocean, drifting land and cloud, night-side shadow.
const LAND = [[0, -.5, .5, .32], [.35, -.1, .38, .55], [.9, .25, .45, .3], [1.4, -.6, .3, .25], [1.65, .1, .35, .4]];
const CLOUD = [[.2, .15, .55, .08], [.75, -.42, .45, .08], [1.25, .48, .5, .08], [1.8, -.25, .4, .08]];
export function drawEarth(g, cx, cy, r, time = 0) {
  g.save();
  g.fillStyle = 'rgba(126, 196, 255, .16)';
  g.beginPath(); g.arc(cx, cy, r + 4, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.clip();
  g.fillStyle = '#2d69b8'; g.fillRect(cx - r, cy - r, r * 2, r * 2);
  const span = r * 4, drift = time * 2.2 % span;
  const blobs = (list, color) => {
    g.fillStyle = color;
    for (const [u, v, w, h] of list) for (const wrap of [0, -span]) {
      const x = cx - r + ((u * r * 2 + drift) % span) + wrap;
      g.fillRect(Math.round(x), Math.round(cy + v * r), Math.round(w * r * 2), Math.max(2, Math.round(h * r * 2)));
    }
  };
  blobs(LAND, '#6aa86b'); blobs(CLOUD, '#e9f4ff');
  g.fillStyle = 'rgba(5, 12, 26, .58)';
  g.beginPath(); g.arc(cx + r * .62, cy - r * .1, r * 1.02, 0, Math.PI * 2); g.fill();
  g.restore();
}
