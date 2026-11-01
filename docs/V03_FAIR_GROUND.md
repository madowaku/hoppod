# HOPPOD v0.3 — fair ground and milestone sound / 2026-11-01 JST

Branch `claude/v03-fair-ground`, stacked on Draft PR #2 (`codex/v02-playable-polish` @ `3cca8ab`), which is stacked on Draft PR #1 (`feat/endless-prototype` @ `01d190e`) → `main` @ `f50befb`. Merge order: #1 → #2 → this PR. No main merge, no deploy. The Earth worldview (P2) is a separate stacked Draft PR on `claude/v03-earthrise`.

Non-negotiables kept: 0.78s automatic hop, SLOW 105px/s, FAST 270px/s, INSET 8px, landing ring semantics, HOPS = successful landings, v0.2 landing tone.

## P0 — unexplained fall on the first flat ground

### Root cause (confirmed in code and browser)

1. **Overlapping / sliver platforms.** v0.2 started at `[0,735]`. The first generated platform (hop 8) starts at `refX − halfWidth`, with `refX = 648.3 + 150..180` and `halfWidth ≈ 69..73`, so its left edge lands at 726..759. Across 2000 seeds the first opening was **≤ 0px (overlap) in 20%**, **0–16px in 48%**, and **never wider than 23px**. Later in the course, 2.6% of all openings were overlaps or < 16px.
2. **Per-platform inset carves a hidden pit.** `isSafe` subtracts `INSET = 8` from *each* platform. Two platforms that overlap by less than 16px, or that are separated by a sliver, produce an unsafe interval of up to ~20px inside ground that renders as continuous.
3. **The SLOW-only player lands in it.** Eight SLOW hops land at `75 + 8 × 81.9 = 730.2`. Intro footing ends at `735 − 8 = 727`. With seed 7 (`[0,735]`, `[730,1049]`), the safe intervals are `[8,727] ∪ [738,1041]`, so the pod dies at 730.2 over drawn ground and the result says `TOO SHORT`.
4. **Background hides real pits.** Ridges were filled from their crest down to the canvas bottom in `#162b36`/`#1c343e`, so a pit showed ridge colour, close to the platform body `#2e4850`.

Evidence: `output/repro/before-seed7.png` (falls on continuous ground), `before-seed4.png` (3px seam). These come from `output/repro/p0.mjs` against v0.2. `output/` is git-ignored; regenerate with the steps below.

### Design: the screen is the rule

Rather than loosening collision, v0.3 makes the drawn world and the collision world the same object.

- **Canonical ground (engine).** `addPlatform` merges any opening narrower than `MIN_GAP = 16px` into the previous platform, so overlaps, touching edges and seams become one continuous footing. Platforms are sorted and every pit is ≥ 16px wide, so the only unsafe ground is the 8px rim at a real pit.
- **A deliberate first pit.** The intro ends at `INTRO_END = 720` and hop 8's platform starts at least `FIRST_GAP = 40px` later. A SLOW-only run still gets 7 hops, then falls clearly (≥ 18px) past the footing into an obvious 40px pit. All-FAST still gets the guaranteed first 3 hops (706.8 ≤ 712).
- **One footing function.** `footing([a,b]) = [a+INSET, b−INSET]` is used by `isSafe` (collision and ring) and by the renderer's lit flat top. The 8px rims are drawn as steps descending into the pit, so "past the bright top" visibly means "over the edge".
- **Pits are void.** Ridges stop at the floor line. Everything below the floor is near-black `#04080c` unless a platform is drawn there.
- **The ring already matched collision.** It calls the same `predictLanding` + `isSafe`. That is now also asserted under random input switching.

Rejected alternatives: setting `INSET = 0` (easier, but changes the established edge feel), or only re-rendering seams (the hidden pit inside overlapping ground would remain).

### Course version and compatibility

- Geometry changes only where v0.2 had a seam or overlap, plus the intro/first pit. The random stream is untouched, so the rest of every seed has the same rhythm. v3 has ~1.9% fewer platforms over 20,000px.
- `COURSE_VERSION = 3` (engine) drives the URL `v=3`, the BEST keys `hoppod.best.v3.*` and the score card `COURSE v3`. v0.2 was never published, so v2 links normalize to v3 the same way v1 links did in v0.2. v2 BESTs stay in storage but are not shown, because those courses differ.

## P1 — musical milestones

- The landing voice is unchanged: sine, `[330,392,440,523,587][hops % 5]`, 0.07 peak, connected straight to `destination`.
- `milestoneTier(hops)`: every 100 → `hundred`, else every 50 → `fifty`, else every 10 → `ten`. Only the highest tier plays.
- Multiples of 5 always land on E4, so accents are written in the same C-major pentatonic colour:
  - **10:** G5 → C6 two-note triangle sparkle (+50ms, +120ms).
  - **50:** E5 G5 A5 C6 E6 arpeggio, 55ms apart, finished before the next landing.
  - **100:** soft sine Cadd9 (C5 E5 G5 D6) swelling under the next two landings, plus one E6 bell.
- Safety: accents go through their own `DynamicsCompressor` bus. The summed accent envelope is ≤ one land voice (tested numerically). At most 12 accent voices exist at once, and each is disconnected on `ended`. Mute, the user-gesture unlock and suspended contexts behave as in v0.2. There is no BGM and no borrowed music.
- **Developer A/B (no public UI):**
  - `/?mode=free&seed=42&sfx=classic` plays the v0.2 cues. `sfx=layered` restores accents. The choice is kept in `sessionStorage` for the tab, because the course URL is normalized on load.
  - `/dev/sfx.html` plays landings at the real 0.78s rhythm (7→13, 47→53, 97→103, 1→30) with a LAYERED / CLASSIC toggle. `public/.assetsignore` keeps `dev/` out of Cloudflare static assets.

## Acceptance criteria

| # | Criterion | Evidence |
|---|---|---|
| A1 | No unsafe point inside drawn ground except the 8px rim at a real pit | `ground.test.mjs`: 512 seeds × 30,000px sampled every 1.7px |
| A2 | Overlap, touching, < 16px seam and contained platforms merge; a 16px pit stays | `ground.test.mjs` synthetic cases |
| A3 | Footing endpoints are exact (`a+8` safe, `a+7.99` unsafe, same on the right) | `ground.test.mjs` |
| A4 | SLOW-only: 7 HOPS, then a fall inside the visible first pit, `TOO SHORT` | Node (128 seeds) + browser seed 7 canvas-pixel test (fails on v0.2) |
| A5 | Ring colour == collision outcome for the held input at every step | `ground.test.mjs`, 64 seeds of random switching |
| A6 | v0.2 guarantees kept: first 3 hops under all 8 combos, ±60ms controller over 300 hops, edge recoverability, frame-rate independence | existing `quality.test.mjs` / `engine.test.mjs`, unchanged except the 735 → `INTRO_END` constant and `v=3` |
| A7 | Landing voice unchanged; accents tiered, capped, ≤ one land voice, silent when muted or suspended | `audio.test.mjs` |
| A8 | Real Chromium Web Audio builds the accent bus at HOPS 10; `sfx=classic` builds none | browser P1 tests |

## Reproduce / verify

```bash
npm ci
npm test
npm run check
npx playwright install chromium
npm run test:browser
```

Manual (port 8010 avoids the default 8000):

```bash
python -m http.server 8010 --bind 127.0.0.1 --directory public
```

1. Open `http://127.0.0.1:8010/?mode=free&seed=7` and never press anything. Expected: 7 HOPS, the coral ring and `HOLD` sit over a wide black pit, and the pod drops into it. On v0.2 the same URL dropped the pod onto continuous ground.
2. Play normally to 10, 50 and 100. Listen for the layer over the usual "トン". Reload with `&sfx=classic` to compare.
3. Open `/dev/sfx.html` and A/B the three milestone windows at tempo.

`output/repro/p0.mjs <base> 7,4,1 <tag>` and `output/repro/frames.mjs <base> <seed> <tag>` regenerate the before/after screenshots. They are local and git-ignored. If a browser shows stale modules after switching branches, hard-reload: `http.server` sends no cache headers.

## Not verified / human checks

- **Sound balance** on real speakers and phones. The automated tests check the graph and gain math, not taste. Is the 10 sparkle noticeable but not tiring after 30 repeats? Is the 100 chord "special but restrained"?
- **Feel of the 40px first pit and rims** on a real phone (≈1:1 CSS pixels at 390px width), and whether 16px pits read clearly enough at 320px.
- Android hardware, X in-app browser, production OGP: unchanged from the v0.2 open items.

## Codex review checklist

- `public/src/engine.mjs`: `addPlatform`, `footing`, the hop-8 clamp, `Math.max` on the rest-runway extension, `COURSE_VERSION`.
- `public/src/app.mjs` `draw()`: ridges stop at `FLOOR`, void fill, flat top/rims from `footing`.
- `public/src/audio.mjs`: the land path is byte-identical in behaviour; accent bus, voice cap, `onended` cleanup.
- Is merging below 16px the right threshold, compared with widening pits? Widening narrows platforms below the 106px reachability bound; merging only adds footing.
- BEST keys are now v3. Confirm there is no need to migrate v2 bests (unpublished).
