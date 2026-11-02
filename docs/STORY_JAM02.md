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
| ② APART | Green floats at 160px/s (SLOW 105 < green < FAST 270): FAST pulls away, SLOW lets it catch up. Beyond 150px (the ring) the link breaks and green stops. See P2 below. |
| ③ FETCH | Red wakes at the crane; the span is solid on two of every four beats (always solid after two falls there). Across the crane red leaves on its own beyond range, picks green up off-screen and both return: reunion, three parts. After that green no longer strands. |
| ④ BASE | Three station islands: landing on each leaves that friend at its station, playing. Landing on the dock stops the hero. |
| ⑤ SEND | Silence on the dock beat; the blue bell on the next beat; bass +4, percussion +8; rocket launch +16; porthole view +20; the base recedes and the music thins and muffles while sparkle stays; four lights (the hero's blinks on every beat) to black at +62; `RAPIPPO` +64; end card +72. |

Length from the solver witnesses: dock at 167–216s depending on pace, plus a 56s ending → **3.7–4.5 minutes** before falls.

## Review round 1 (PR #16)

- **"B5 is missing" (music):** not reproduced. `B5: 987.77` was already in the note table at bf531da (between `A5` and `C6`); every note had a finite pitch. A test now checks pitch, length and level of every note the composer emits across 1,500+ notes and three song states.
- **Launch rumble cut at 0.5s:** confirmed and fixed. The noise buffer now loops, and the rumble has its own swell → hold → fade envelope (the old exponential decay was inaudible after ~4s). Offline render: RMS at 5–6.5s is now higher than at 0.4–1s.
- **Sound effects late on Bluetooth:** confirmed by design review and fixed. The audio side now works on a **predicted run**: each frame the run is simulated ahead to `currentTime + lookahead` with the current input held. Cues (pickup, assembly, join, link lost/restored, switch, fall, respawn, station, dock) are scheduled at the context time of their event, and the tick is skipped on a beat predicted to be a fall. An unpredicted event still sounds immediately (counted as "late" in tests). Limit: an input change within the last latency window before a touchdown can, rarely, make a predicted cue wrong.

## P2 — blue and green

**Blue: out of the dark.** The third part triggers a white flash, a ring of light rolling out from the lamp, the slow wide chord under the boot chime, and over 3s the darkness lifts to reveal a horizon glow and a far mountain range with lit rims that was never visible before. Blue keeps a soft pool of light under it.

**Green: you left it behind.** Range is now **150px** (was 240) so the ring, green, and the moment it drops out all fit behind the hero; the camera slides up to 50px to keep a lagging friend in view without hiding the next landing.

- Signal shown three ways: the dashed link line, three bars over green, and the range ring (brightens as green nears the edge). Near the edge both flicker.
- Link break: a small spark where it snapped, a falling three-note cue, bars drop to zero, green's eyes go dark and its antenna tips turn grey, a blinking ✕. Off screen, an edge marker remembers it while its music can still be heard.
- Bass by distance: inside the ring full and clear, thinning at the edge; beyond, a faint low-passed "radio" that fades out over ~4 ring widths (also when green is on the switch).

**Learning the rule before it matters.** The valley (four stepping stones, ~0.77 FAST on average) **always** breaks the link once: tested on every feasible route. A relay antenna on the rest ground after it reconnects green (rings, a rising cue, green flies back). The rule is experienced safely before the switch.

**The switch, without words.** The switch is a socket drawn in green's shape. Whenever green floats over it while following, the socket glows and the bridge's first planks stir: the player sees "green here → bridge" before ever leaving green there. Leaving green within 70px of it (+30px per respawn) opens the bridge; the planks run out over one beat. After one fall there green lingers a little over its socket; after two it almost stops, so SLOW alone works. Novices cannot get stuck; the solution is still shown, not told.

Discoverability, honestly: the valley teaches "FAST → green drops out" and "relay → back", the socket teaches "green here → bridge". Joining the two ("so drop it *here*") is the real leap; most first-time players will fall once, then see the socket glow again. Needs a human first-play test (P5).

## Real Web Audio verification

`tests/browser/story-audio.spec.mjs` runs a real `AudioContext` in Chromium (headless, real time, no clock mocking):

| Check | Result |
|---|---|
| JS exceptions / console errors during play, pause, resume, mute, ending | none |
| Every touchdown has a tick note scheduled on exactly that beat; every note at `s + offset` (spread < 1µs) | pass |
| Bell enters only after assembly; bass with green; percussion at the base; ending: no tick, bell D+1, bass D+4, perc D+8 | pass |
| Pickup ×2 and assembly cues predicted and scheduled at their event time; late cues | 0 late |
| Fall beat has no tick; respawn beat ticks; fall cue predicted | pass |
| Pause: story time frozen, no new notes for 1.5s; resume continues; mute: master → 0 while time and scheduling continue | pass |
| Measured latency (headless Chromium): `baseLatency` 0.01s, `outputLatency` 0.04s, context clock ahead of heard time ≈ 48ms; `getOutputTimestamp` available | recorded |
| Offline render of all parts + rumble: NaN 0, peak 0.29 | pass |

Not measurable here: real speaker/Bluetooth latency and touch latency on Android.

## Tests

- `tests/story.test.mjs` (16): exact beat, clock rebasing/pause/jitter/latency mapping, full-course solvability and length, frame-rate independence, the switch puzzle (SLOW-only and FAST-only fail; after two falls SLOW works), the valley link break + relay on every route, respawn keeps progress, story event order, crane beats, music hand-off, finite notes.
- `tests/browser/story.spec.mjs` (3): FREE RUN link; start on the beat and pause without losing phase; a full browser playthrough with real key events to the end card.
- `tests/browser/story-p2.spec.mjs` (2): blue reveal and green link/relay/switch scenes (screenshots below).
- `tests/browser/story-audio.spec.mjs` (5): real Web Audio checks above.
- All 72 existing Node tests and 38 existing browser tests still pass.

![Blue: assembly, flash, opening, wide moon](story/p2-blue.png)
![Green: link lost (edge marker), relay, over the socket, switch on and bridge, alone](story/p2-green.png)

## Open items (next)

- P2/P3 feel: green/red reactions, crane look, reunion staging, companions overlapping each other at the base.
- P4: real composition and mix, light/space art, moon curvature in the rocket view, chapter pacing (① runs ~70s at a slow pace; target 50s).
- Menu: DAILY inside FREE RUN; STORY as the jam entry point for itch.io.
- P5: Android portrait, background/return on device, novice test, disclosure text, itch.io build.
