# HOPPOD v0.4-A: landing marker A/B/C experiment

**Experimental only.** Stacked on Draft PR #6 (20-motif course), which is stacked on #5 → #4 → #3 → #2 → #1. Do not merge into the release branch or deploy without review.

## Question

Players have enjoyed manipulating the predicted landing ring, but now ask whether removing it feels better. Is the enjoyable skill (1) keeping the ring safe, (2) aligning a visible prediction without an answer, or (3) estimating speed/range by rhythm alone?

### Conditions: the only independent variable is the guide

| Mode | Guide | Safety colors | Contextual HOLD/RELEASE warning | Gameplay |
|---|---|---|---|---|
| A FULL | Original tether, landing ellipse and jump countdown arc | Mint when safe, coral when unsafe | Shown when unsafe | Same v4 terrain, 0.78s jumping and FAST/SLOW |
| B POSITION | Same tether, ellipse and countdown arc | Always neutral ivory | Hidden | Identical physics/score |
| C NONE | No tether, ellipse or countdown | None | Hidden | Identical physics/score |

All three modes keep the FAST/SLOW HUD/button, sound, milestone accents, Earthrise, obstacles, collision and result messages. Even in C, the *physical* landing positions and eligibility are unchanged. There are no new hazards or power-ups.

## How to compare in a browser

After checking out this branch, serve `public/` as usual. Choose the same seed on all three:

- A: `http://127.0.0.1:8012/?mode=free&seed=42`
- B: `http://127.0.0.1:8012/?mode=free&seed=42&marker=neutral`
- C: `http://127.0.0.1:8012/?mode=free&seed=42&marker=off`

A small **LANDING GUIDE TEST** row above the game allows A/B/C switching without retyping addresses. Switching modes resets the current run to 0 HOPS on the **same seed**; it does not change course geometry. The selected mode persists in the URL and through refresh, and survives DAILY/FREE mode changes. External X share still uses the canonical course URL, without the experimental `marker` parameter. Invalid/missing values default to A.

BESTs are separated *within v4*: original A keeps `hoppod.best.v4.free`, while B/C use suffix `.marker.neutral` and `.marker.off` respectively; daily records are similarly separated. v3 historical records remain untouched.

## Playtest protocol

1. Keep the same seed (for example 42) and audio setting on all versions.
2. Play **three runs per condition**; rotate presentation order A→B→C, B→C→A, C→A→B to limit learning/order bias.
3. After every failure, record whether you *understood* the reason, whether you wanted to retry, and how often you had to switch speeds mid-hop.
4. Compare median HOPS, retry desire and fairness understanding, not maximum score alone. The aim is not simply to lower scores.
5. Check mobile readability, 0–10 HOPS onboarding, and 30–100 HOPS feel. If C is too opaque, compare B as compromise. If A is the most enjoyable, keep the marker.

## Engineering validation

- Pure `markerVisual` policy maps full/neutral/off to visible primitives, colors and contextual advice.
- Node tests verify the three policies and engine equivalence across seeds.
- Playwright uses the original seed-7 opening pit to check A coral+HOLD, B neutral with no HOLD, and C no marker, plus mode persistence and separate BEST keys.
- Existing Node/browser regressions, 20-motif safety tests and Wrangler asset checks remain in CI.
- Existing v0.4 terrain Draft #6 had a **preexisting browser CI failure** in the 193-HOPS test (score advanced unexpectedly to 154 by the 150 checkpoint). This branch removes optional mid-run screenshots from that test and fixes an obsolete v3 URL expectation, pending CI verification. Treat the experiment as HOLD while any CI checks are red.

## Out of scope

No changes to music growth, companion PODs, landing physics, terrain tiering, new obstacles, difficulty pacing, Earthrise or deployed assets. Do not mistake an automated long-run check for human enjoyment.
