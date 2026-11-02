# RAPIPPO STORY — thatgamejam #02

**Draft; not merged or deployed.** Branch `feature/story-jam-02` from `main` (53b6642). Deadline: 2026-11-08 16:59 JST.

STORY is a separate page (`public/story.html`) and module set (`public/src/story/`). FREE RUN, DAILY, BEST keys, course v4 and physics are untouched; the only FREE RUN change is a `STORY ›` link in the mode row. STORY imports the engine's constants, `footing` and the pod artwork read-only. The v0.5 mastery lab was used as reference only (its timestamped-input idea); no lab code or gates were brought in.

Play locally: `npm run dev`, then open `http://127.0.0.1:8000/story.html`. Developer start points: `?cp=N` (checkpoint N), `?cp=end` (ending only), `?lang=ja`.

## P0 — one clock for hops and music

| Decision | Why |
|---|---|
| `BEAT = PERIOD = 0.78s` exactly (76.923 BPM). Hops land at `k × BEAT` from absolute story time, not by accumulating frame deltas. | No drift over five minutes; a touchdown *is* a beat. |
| Story time S = **heard** audio time minus an offset. Heard time = `getOutputTimestamp()` mapped to `performance.now()`, else `currentTime − outputLatency`. | Physics and drawing follow what is coming out of the speaker, so Bluetooth latency shifts nothing visible relative to sound. |
| Notes are scheduled 150ms ahead on the context clock at `contextTime(S) = S + offset`, on a sixteenth grid (`BEAT / 4`). | Frame drops never delay a note. |
| Small timestamp jitter slews (12%); >80ms disagreements snap; time never runs backwards. | Unit test: ±6ms jitter with 210ms latency stays within 8ms of the heard beat. |
| No running context (blocked, suspended, interrupted) → performance time, **rebased** so S is continuous; it rebases back when audio returns. | Muting only zeroes the master gain; the clock never stops for mute. |
| Pause (Esc, blur, hidden tab, pagehide, a >0.5s frame gap) freezes S and cancels scheduled notes; resume continues from the exact beat phase. | |
| Input edges use the event `timeStamp` mapped into S and split the simulation at those instants (`TimedInput`). | Identical result at 23/30/60/144fps and jittered frames (unit test replays the full witness). |

Not measured yet: real touch/dispatch latency on Android, and whether `getOutputTimestamp` is stable on the target phone. Check on device in P5.

## P1 — the full skeleton

Fixed course, five chapters, ten checkpoints. A fall plays for two beats and respawns on a beat at the last checkpoint; **progress with friends is never lost** (parts stay collected; a stranded green is restored next to the hero).

| Chapter | Mechanic in the skeleton |
|---|---|
| ① WIND-UP | Dark; light radius around the hero pulses on each touchdown; footing edges always glint. Three blue parts (±36px). A missed part hops ahead; after two misses it flies to you. Assembly opens the light over 3s and the bell enters. |
| ② APART | Green floats at 160px/s (SLOW 105 < green < FAST 270): FAST pulls away, SLOW lets it catch up. Beyond 240px the link breaks and green stops. A valley needs FAST for two pits, then islands want SLOW. On the switch field, green must stop within 70px of the switch (+30px per respawn) to open the bridge. **Tested: SLOW-only falls at the chasm, FAST-only strands green short; a SLOW-then-FAST rhythm works.** Bass fades with distance. |
| ③ FETCH | Red wakes at the crane; the span is solid on two of every four beats (always solid after two falls there). Across the crane red leaves on its own beyond range, picks green up off-screen and both return: reunion, three parts. After that green no longer strands. |
| ④ BASE | Three station islands: landing on each leaves that friend at its station, playing. Landing on the dock stops the hero. |
| ⑤ SEND | Silence on the dock beat; the blue bell on the next beat; bass +4, percussion +8; rocket launch +16; porthole view +20; the base recedes and the music thins and muffles while sparkle stays; four lights (the hero's blinks on every beat) to black at +62; `RAPIPPO` +64; end card +72. |

Length from the solver witnesses: dock at 167–216s depending on pace, plus a 56s ending → **3.7–4.5 minutes** before falls.

## Tests

- `tests/story.test.mjs` (13): exact beat, clock rebasing/pause/jitter/latency mapping, full-course solvability and length, frame-rate independence, the switch puzzle (SLOW-only and FAST-only fail), respawn keeps progress, story event order, crane beats, music hand-off.
- `tests/browser/story.spec.mjs` (3): FREE RUN link; start on the beat and pause without losing phase; **a full browser playthrough with real key events to the end card** (Web Audio removed so the Playwright clock drives time).
- All 72 existing Node tests and 38 existing browser tests still pass.

## Open items (next)

- P2/P3 feel: green/red reactions, crane look, reunion staging, companions overlapping each other at the base.
- P4: real composition and mix, light/space art, moon curvature in the rocket view, chapter pacing (① runs ~70s at a slow pace; target 50s).
- Menu: DAILY inside FREE RUN; STORY as the jam entry point for itch.io.
- P5: Android portrait, background/return on device, novice test, disclosure text, itch.io build.
