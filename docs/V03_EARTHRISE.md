# HOPPOD v0.3 — Earthrise worldview / 2026-11-01 JST

Branch `claude/v03-earthrise`, stacked on `claude/v03-fair-ground` (Draft PR #3) → #2 → #1 → `main`. Merge order: #1 → #2 → #3 → this. No main merge, no deploy.

> A tiny pod lost radio contact on the Moon's far side. It keeps hopping until it finds Earth.

There is no story text. The sky tells the story.

## Why this fits the game

- **Real science, no explanation needed.** The far side of the Moon is radio-shadowed from Earth, and Earth stays almost fixed in the lunar sky. Earth only "rises" when you travel toward the near side. Distance therefore *is* the story.
- **The antenna gets a job.** The rabbit-ear antennas now listen for Earth, which gives `SIGNAL` a meaning without any new rule.
- **The score becomes a picture.** A 41-HOPS card shows half an Earth; a 111-HOPS card shows the full disc. People can compare progress on X at a glance, even without reading the number.

## What changed

| Area | Behaviour |
|---|---|
| Sky | The cream moon in the sky is removed. On the Moon, the body in the sky is Earth. |
| Rise | `earthRise(x)` is a pure function of world distance: glow from 1500px (≈ 10 HOPS), first light at 3300 (≈ 20), the full disc clears the horizon at 16,500 (≈ 100), and it climbs to its highest sky position at 33,000 (≈ 200). After that it stays up and the run continues. Each new run starts dark again. |
| Horizon | A very distant flat lunar horizon sits just above the tallest parallax ridge. Earth rises from it, so first light is visible whenever the first signal bar lights. The near ridges and all gameplay layers stay in front. |
| Signal | Four tiny bars in the canvas's top-right corner: 0 on the far side, then 1/2/3 as the disc rises, 4 when it clears. When the level goes up, two soft arcs ping from the antenna (suppressed under reduced motion). Once Earth is in view, the antenna tips flash pale blue on every landing. |
| Score card | The PNG draws Earth at the height the run reached, rising from the same horizon band. |

Not added, on purpose: explanatory text, enemies, items, shops, new sounds, any change to collision, terrain, timing or score. The Earth is in the sky band (y ≤ 330 at its lowest visible point). The landing ring, `HOLD`/`RELEASE` text and platforms are drawn later and unchanged.

## Tests

- `tests/earth.test.mjs`:
  - The rise is monotonic and saturates.
  - Signal thresholds.
  - Disc geometry (touching, clearing, top slot, staying below the HUD bars).
  - On 64 seeds' real reference routes: dark during the tutorial, glow by 14 HOPS, first light by 25, the full Earth between 85 and 115, the top by 220.
- Browser `P2` test: at the start there are zero Earth-blue pixels in the sky or HUD. After 60 real keyboard-driven hops there are Earth pixels and lit bars. `output/playwright/v03-earth-60.png`.
- The 31 Node and 14 browser tests pass, including all P0/P1 and v0.2 tests.

Frames for review can be regenerated locally (git-ignored):

```bash
node output/repro/earth-frames.mjs http://127.0.0.1:8010 42 8,14,26,60,105 390
```

```bash
node output/repro/card.mjs http://127.0.0.1:8010 110
```

## Human checks

- Does Earth's first light around 20 HOPS feel like a discovery, and is it noticed without text?
- Are the signal bars and antenna flash readable at phone size, and not distracting?
- The thresholds assume ~165px per hop. If playtests show most players reach 100 HOPS easily, consider moving the full disc to about 150 HOPS (`EARTH_FULL`). This is a pure render change; course geometry and BEST do not depend on it.
- Pixel Earth art is original and simple. A designer pass on continents and clouds may improve it.

## Codex review checklist

- `public/src/earth.mjs`: pure functions and constants, `drawEarth` uses only Canvas fills.
- `public/src/app.mjs` `draw()`: order is stars → glow → Earth → far horizon → ridges → void → platforms. The signal level and age are reset in `loadCourse`/`reset`. The level only rises during play.
- `public/src/pod.mjs`: the `signal` option only recolours the antenna stripe during the landing flash.
- `package.json` / CI `node --check` include `earth.mjs`.
