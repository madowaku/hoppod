# HOPPOD v0.4 experiment: 20 ground-only terrain motifs

**Experimental Draft; not approved for merging or deployment.** Base: #5 `codex/v03-independent-review`. Merge and production release remain on HOLD pending owner playtest, Android and X checks.

## Hypothesis

v0.3 is fun and human-playtested to **193 HOPS**; however, its procedural islands become similar after the early tightening. Add *situational variety* rather than increasing scroll speed, jump tempo, enemies, special-floor rules, or confusing prediction rings.

- Preserve `PERIOD=0.78s`, `SLOW=105px/s`, `FAST=270px/s`, `INSET=8px`, the landing indicator and existing milestone sounds.
- Compose four-hop terrain phrases out of 20 authored arrays of reference centre distances and half-widths, with reproducible ±4px distance and ±2px width jitter.
- A separate safety pass widens only the minimum needed landable surface to preserve ≥20px of reachable next landing from the previous platform's left/centre/right safe positions. Gaps below 16px merge into one continuous platform, matching v0.3's visual collision rule.
- Every sixth motif phrase is a broad `rest-bay`. Difficult patterns are interleaved with easier ones, not monotonically harder.
- Course identity advances to **v4** and score keys remain version-separated; do not compare v3 daily runs or historical BEST with v4.

## All 20 four-hop motifs

| Tier | Motif | Terrain decision |
|---|---|---|
| 0 | cruise | Gentle near-even spacing |
| 0 | long-short | Alternate far/near landing |
| 0 | short-long | Reverse the spacing rhythm |
| 0 | rest-bay | Consecutive broad islands that may join |
| 1 | narrow-gate | A tight island between forgiving landings |
| 1 | wide-exit | Precise approach, then broad recovery |
| 1 | double-gap | Two consecutive long crossings |
| 1 | close-pair | Compact landings followed by a longer crossing |
| 1 | zigzag | Repeated long/short reversal |
| 1 | triple-tap | Three short, accurate landings, then release |
| 2 | needle | Two precise landings ahead of relief |
| 2 | rebound | Close-long-close-long alternation |
| 2 | long-bridge | Two near-limit crossings followed by rest |
| 2 | precision | Four consecutive moderately narrow targets |
| 2 | offset-rest | Narrow/wide alternating landing windows |
| 2 | throttle | Long-short alternation with tighter footing |
| 3 | double-needle | Back-to-back precision crossings |
| 3 | pendulum | Dramatic near/far reversals |
| 3 | tight-flow | Four closely spaced precise targets |
| 3 | hairpin | Long-short reversals at narrow width |

**Introduction is deliberately unchanged in spirit:** three safe hops at either speed, seven SLOW landings and the visible first pit. The first motif begins after the opening transition. Motifs unlock by reference hop: tier 0 before hop 32; tier 1 at 32, tier 2 at 64, tier 3 at 120. Current-tier motifs are favoured but easy ones still appear; no new mechanic tutorial is needed.

## Preliminary local Node verification (engine-only prototype)

- 20 unique patterns present; 64 seeds' long runs include all 20.
- 128 seeds × 300 hops (38,400) survived a *geometry-only automated steering controller* with cyclic ±60ms switch-time offsets.
- 128 seeds through 50,000px: zero missing ≥20px next-hop landing intervals at safe edge/centre sample positions; minimum visible pit 16px.
- 16 seeds × 10,000 non-reference hops (160,000) survived a separate synthetic controller with bounded motif and platform storage.
- `node --test tests/motifs.test.mjs` covers identity, selection, reachability, timing margin and memory bounds.

These are not human experience measurements. A reachable jump is not automatically a readable/fun jump. **No claims about improved player retention, fairness perception or audio feel until hands-on testing.**

## Human A/B plan

1. Play the existing v3 (#5) and experimental v4 (#6) on equivalent devices. Alternate order to reduce learning bias. No public mixing of daily versions.
2. On each version do three runs or roughly ten minutes. Record HOPS, number of retries, and whether each death felt deserved. Do not use maximum HOPS alone as the verdict.
3. At ~30 / 70 / 130 / 190 HOPS, consider whether the terrain makes you switch FAST/SLOW deliberately or mostly repeat a fixed rhythm; whether a land location traps the *next* hop; and whether rest islands reset tension.
4. Reject or adjust motifs that feel unfair, that hide holes at phone size, or that interrupt the audio's steady 0.78s pulse. Keep the start friendly.
5. An independent Codex/Claude review should inspect the generator, replay seeds, 320px rendering and browser play. Retune only after that review and owner playtest.

## Files changed

- `public/src/engine.mjs`: motif catalogue, deterministic selector, minimal edge-safety pass, trim bounded diagnostic metadata.
- `tests/motifs.test.mjs`: experiment-specific regressions.
- Existing v3 tests: only course-version expectations updated, not previous physics or audio assertions.
