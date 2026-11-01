# RAPIPPO v0.5 mastery lab: two fixed gates

**Developer experiment; not merged or deployed.** Branch `experiment/v05-mastery-lab` from `integration/rapippo-final-stack`. Nothing in `public/index.html`, `public/src/` or course v4 changes. The lab lives under `public/dev/`, which `public/.assetsignore` already keeps out of the Workers deploy.

## Question

RAPIPPO feels good to hop but lacks HOPSCROLL's "fail, practise, finally break through" pull. The hypothesis: what made HOPSCROLL's moon and meteor bridges compelling was not narrow ground but **an input condition at touchdown that ties one hop to the next**, on **fixed ground you can rehearse**. In v4 every hop is an independent distance estimate with a wide window (median 0.55s of 0.78s of valid hold time even in tier 3), and the input at touchdown never matters.

The playtest separates two causes:

| Variant | URL | Tests |
|---|---|---|
| A current | `/dev/mastery.html?exp=base` | Baseline: the unchanged v4 `Terrain` for the same seed |
| B gates | `?exp=plain` | Do fixed, memorable gates alone create mastery? |
| C gates + landing rules | `?exp=rules` | Does a touchdown input condition add the feeling of getting better? |

All three use the same renderer, the same timestamped input and no landing marker (C policy). The seed changes daily (JST) and can be fixed with `&seed=`.

## Course

B and C: the v4 intro, then **8 easy filler hops** (v4 motifs, tier 0 in the first cycle, tier 0/1 afterwards), then a gate, alternating **QUIET SPAN → RUSH SPAN → QUIET → RUSH …** forever. Gates are identical in every run and every seed.

- **Rest island + pad.** Before each gate is a rest island placed from the previous footing's right edge (never merged or widened) and a narrow pad that every point of the rest footing reaches with at least 20px to spare.
- **Aligned entrance.** Landing on the pad pulls the pod to its centre, drawn as the pod sliding into a cradle between two antenna posts. Each gate therefore starts at the same x and phase, so a timing learnt yesterday works today.
- **Gate surfaces in C** (B draws the same platforms as ordinary ground):
  - *Still* bridge (pale top, slow ripples): holds unless FAST has been held for 0.12s or more at touchdown. **Release to land.**
  - *Rush* bridge (warm top, a crack that trembles): holds only when FAST, or released less than 0.12s ago. **Hold to land.**
  - The surfaces are told apart by texture alone. They never react to the current input, and nothing predicts the landing.

| Gate | Landings | One witness rhythm (from pad touchdown) | Per-toggle local window, early/late (ms) |
|---|---|---|---|
| 静の橋 QUIET SPAN | still, normal, still, exit | press .08, release .50, press .80, release 2.12, press 2.37 | 80/90, 90/240, 130/130, 130/200, 140/240 |
| 疾の橋 RUSH SPAN | rush, normal, rush, normal, exit | press .10, release 1.18, press 1.81, release 2.70 | 100/100, 130/190, 160/140, 80/160 |

The witness is not shown to players. The local window moves one toggle alone and requires the next two landings to survive. Drift on later hops is the player's to correct, as on HOPSCROLL's bridges.

## Fairness

- **Timestamped input.** Pointer and key edges carry their event `timeStamp`, and every frame is split at those instants (`TimedInput`). The same input therefore gives the same result at 30, 60, 120 or 144 fps, at 23 fps, with irregular frames, and at any frame phase. The unit tests replay each gate at all of these.
- **What remains unmeasured.** Real devices still add touch latency and event-dispatch delay that no test here measures. Check on an Android phone.
- **Practice.** The result screen offers *practise this gate* (or press `P`). Practice docks on the pad and auto-restarts about a second after a fall or a clear. It does not touch BEST or count as a scored run.

## Records

The table under the canvas shows, per variant and gate: scored clears/tries, the try on which the gate was first cleared, and the same for practice. *Copy record (JSON)* exports it. Records stay in the browser (`rapippo.lab.v05`) and are never sent anywhere.

## Playtest sheet

Play each variant for about 10 minutes, alternating the order between sessions. For each gate in B and C, note:

1. After failing a few times and then clearing it, did you feel **"I got better"**, or "I got lucky"?
2. After clearing, did you **want to play that gate again**?
3. On the second and later encounters in the same run, did the gate feel like **a place you now own** rather than a threat?
4. Could you tell from the floor alone which rule applied (C)? Did any fall feel undeserved?
5. Was the filler between gates restful or boring?

Clear rate and maximum HOPS are secondary. Expected readings:

- **B ≈ C, both > A:** fixed gates are the driver.
- **C > B:** the touchdown rule is the driver.
- **Neither beats A:** reconsider both.

## Not decided here

- Adoption into the game, scoring, sharing, DAILY, BEST keys, art or sound. The gate textures are greybox placeholders within the v4 palette.
- The pad's pull breaks the engine comment "the game never substitutes a safe landing for the actual player position". It is confined to the lab and needs an explicit decision if adopted.
- Whether a floor whose texture announces its rule counts as a "safety colour" under [ART_UX_DIRECTION](concept/ART_UX_DIRECTION.md) §1. The lab assumes it does not, because it describes the floor rather than predicting the landing; the owner should confirm.

## Verify

```powershell
node --test tests/mastery.test.mjs
npm run dev   # then open http://127.0.0.1:8000/dev/mastery.html
```
