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

Fixed course, five chapters, eleven checkpoints (one added past the crane in P3). A fall plays for two beats and respawns on a beat at the last checkpoint; **progress with friends is never lost** (parts stay collected; a stranded green is restored next to the hero).

| Chapter | Mechanic in the skeleton |
|---|---|
| ① WIND-UP | Dark; light radius around the hero pulses on each touchdown; footing edges always glint. Three blue parts (±36px). A missed part hops ahead; after two misses it flies to you. Assembly opens the light over 3s and the bell enters. |
| ② APART | Green floats at 160px/s (SLOW 105 < green < FAST 270): FAST pulls away, SLOW lets it catch up. Beyond 150px (the ring) the link breaks and green stops. See P2 below. |
| ③ FETCH | Red wakes and rides the crane's beam; the span is solid on two of every four beats (always solid after two falls there, and locked down once red has left). Across the crane red looks back for one beat and leaves on its own. See P3. |
| ④ BASE | Three station islands: landing on each leaves that friend at its station, touching down on the beat with the hero. Landing on the dock stops the hero. |
| ⑤ SEND | See P3: the stop, the hand-off, the rocket's window, four lights, black at D+62; `RAPIPPO` +64; end card +72. |

Length from the solver witnesses: dock at 167–216s depending on pace, plus a 56s ending → **3.7–4.5 minutes** before falls.

## Review round 1 (PR #16)

- **"B5 is missing" (music):** not reproduced. `B5: 987.77` was already in the note table at bf531da (between `A5` and `C6`); every note had a finite pitch. A test now checks pitch, length and level of every note the composer emits across 1,500+ notes and three song states.
- **Launch rumble cut at 0.5s:** confirmed and fixed. The noise buffer now loops, and the rumble has its own swell → hold → fade envelope (the old exponential decay was inaudible after ~4s). Offline render: RMS at 5–6.5s is now higher than at 0.4–1s.
- **Sound effects late on Bluetooth:** confirmed by design review and fixed. The audio side now works on a **predicted run**: each frame the run is simulated ahead to `currentTime + lookahead` with the current input held. Cues (pickup, assembly, join, link lost/restored, switch, fall, respawn, station, dock) are scheduled at the context time of their event, and the tick is skipped on a beat predicted to be a fall. An unpredicted event still sounds immediately (counted as "late" in tests). Limit: an input change within the last latency window before a touchdown can, rarely, make a predicted cue wrong.

## P2 — blue and green

**Blue: out of the dark.** The third part triggers a white flash, a ring of light rolling out from the lamp, the slow wide chord under the boot chime, and over 3s the darkness lifts to reveal a horizon glow and a far mountain range with lit rims that was never visible before. Blue keeps a soft pool of light under it.

**Green: you left it behind.** Range is now **150px** (was 240) so the ring, green, and the moment it drops out sit at the hero's left. The camera slides at most 11px for a lagging friend (P3: 50px could push a full FAST landing, HERO_X + 210.6px, off the 360px screen); past that the ring and the edge marker show the friend left behind.

- Signal shown three ways: the dashed link line, three bars over green, and the range ring (brightens as green nears the edge). Near the edge both flicker.
- Link break: a small spark where it snapped, a falling three-note cue, bars drop to zero, green's eyes go dark and its antenna tips turn grey, a blinking ✕. Off screen, an edge marker remembers it while its music can still be heard.
- Bass by distance: inside the ring full and clear, thinning at the edge; beyond, a faint low-passed "radio" that fades out over ~4 ring widths (also when green is on the switch).

**Learning the rule before it matters.** The valley (four stepping stones, ~0.77 FAST on average) **always** breaks the link once: tested on every feasible route. A relay antenna on the rest ground after it reconnects green (rings, a rising cue, green flies back). The rule is experienced safely before the switch.

**The switch, without words.** The switch is a socket drawn in green's shape. Whenever green floats over it while following, the socket glows and the bridge's first planks stir: the player sees "green here → bridge" before ever leaving green there. Leaving green within 70px of it (+30px per respawn) opens the bridge; the planks run out over one beat. After one fall there green lingers a little over its socket; after two it almost stops, so SLOW alone works. Novices cannot get stuck; the solution is still shown, not told.

Discoverability, honestly: the valley teaches "FAST → green drops out" and "relay → back", the socket teaches "green here → bridge". Joining the two ("so drop it *here*") is the real leap; most first-time players will fall once, then see the socket glow again. Needs a human first-play test (P5).

## P3 — red, the reunion, the stop, the rocket

**Red decides by itself.** Red rides the crane's beam while it works the span, so it is in view as the hero crosses. The far side is a long, plain platform (420px), so the next beats need no judging while it happens. There red drops beside the hero and, for exactly one beat, pings back towards where green was left (two red arcs, a rising two-note cue). On the next beat it sets off left, slowly at first (closed-form acceleration over one beat, then 900px/s), with a streak and its own dashed signal ring, so the player sees it leave unasked. While red is off screen a small **comms window** (top left, red frame, scanlines) shows the far end: green alone and dark on its socket, red arriving, a red ring as green's eyes light again, the pair lifting off. The window closes once they are on their way; an edge marker (red with green under it) stays until they arrive. No cutscene: the hero keeps hopping throughout.

**The reunion is the music coming back.** When red leaves, its percussion fades with distance until only the tick and the bell remain. From the pickup, bass and percussion return through red's link: a faint radio (level 0.27, ~0.5kHz low-pass) that clears with every hop on a log-distance curve (0.27 → 0.71 at ~2.9kHz → 0.90 and full 12kHz when they arrive). The reunion cue and three-colour rings mark the moment, but the change is the song itself filling back in.

**The first stop (D → D+1).**
- D: the hero lands on the dock; a connector drops onto its head in 0.2s, a gold ring spreads on the deck, the dock "clunk" plays, and every part falls silent. The friends at their stations stop bouncing and hold still. The camera pulls back during this beat so the whole base is in view by D+1.
- D+1, the beat the next touchdown would have been: blue touches down on its island with a blue ring, the bell plays with a low G under it, the hero's light blinks for the first time and the mast sends out its first ring.
- D+4 green touches down with the bass; D+8 red with the percussion. From then on the three land on every beat and the hero's light blinks on every beat (0.12s on, at k × 0.78s). Nobody hops for the hero; the music goes on.

**The rocket's window.** D+16 launch (rumble) and the camera follows the rocket up; D+19.3–21 a dip to black; then the view opens inside a round window looking back down at the base. The base shrinks (zoom 0.55 → 0.19) and sinks in the window while the moon's horizon curves; platforms show only their lit tops. The music thins and muffles with distance but never stops before black (floor 12%). Blue, green and red lights plus the hero's blinking one stay on screen; the camera never turns away; black at D+62.

**Phones.** At 390×844 (the Playwright viewport) the four lights end about 22–25 CSS px apart (asserted > 14px): 3px dots with 7px halos, inside the window.

### Switch assist, revised (P2 follow-up)

The old assist let SLOW alone solve the switch after two falls. Now each fall at the switch:
- widens the socket's catch zone (70 → 100 → 130 → 160px) and draws it on the ground as a green band with end ticks;
- from the second fall, makes the socket pulse on every beat while the hero is on the field;
- slows green over the zone to 125 / 112 / 106px/s: never below SLOW (105), so SLOW alone still keeps green beside you and the FAST burst stays the player's.

Single-burst plans that work (8 start hops × 4 holds × 1–2 hops): 4 → 9 → 12 → 14 of 64 for 0–3 falls. Green also announces its socket: a soft two-note ping on the next beat when it floats into the zone. **Safety net:** after the 4th fall green settles on the socket by itself (SLOW alone works; 50/64 plans), so nobody is stuck.

### Never stuck; RANGE 150 audit

- **Fixed (blocked progress):** a fall after red had left the crane respawned the hero before the crane, where the span no longer moved. The span now stays down once red has gone, and a checkpoint sits on the far platform.
- A third relay at the switch field's edge reconnects a green lost on the approach, so green never reaches the field unlinked by accident.
- Falls forced at each moment (before the crane, red looking back, flying, carrying green, just reunited, between stations): the crew comes back consistent (a red in flight resumes carrying green from behind the checkpoint; the crane stays down once red has gone; the bridge stays open) and the dock stays reachable.
- Noisy play test: four seeds, a look-ahead player with 12% random holds. 70 respawns; after each one the solver reaches the next checkpoint. All 9 strandings were in chapter II before the bridge (none in I, III, IV: green only follows unlinked in II).

### Friends built for their jobs (P4 groundwork)

Same face, different job: see [CREW_SPRITES.md](story/CREW_SPRITES.md). Blue has a lamp above its ears, green wide foot pads, red a folded side arm. Each transforms while it works (light mode, anchor, crane), and Rapippo becomes the transmit tower on the dock. Shared `pod.mjs` is untouched (FREE RUN unchanged).

## Real Web Audio verification

`tests/browser/story-audio.spec.mjs` runs a real `AudioContext` in Chromium (headless, real time, no clock mocking). With `STORY_AUDIO=required` (set in CI, and by `npm run test:story-audio`) a browser without running audio **fails** instead of skipping.

Where it actually ran with real audio:

| Environment | Tests | Notes |
|---|---|---|
| CI, ubuntu-latest, Playwright Chromium headless (run 41442506580, commit 303c8e9) | 5/5 executed, none skipped | 44.1kHz, `baseLatency` 0.01, `outputLatency` 0.032, `getOutputTimestamp` available (from the uploaded `story-audio/*.json`) |
| Local Windows 11, Playwright Chromium headless (P3) | 6/6 executed with `STORY_AUDIO=required` | 48kHz, `outputLatency` 0.04 |
| Android phone / Bluetooth | 0 | not done; P5 |

Checks:

| Check | Result |
|---|---|
| JS exceptions / console errors during play, pause, resume, mute, ending | none |
| Every touchdown has a tick note scheduled on exactly that beat; every note at `s + offset` (spread < 1µs) | pass |
| Bell enters only after assembly; bass with green; percussion at the base; ending: no tick, bell D+1, bass D+4, perc D+8 | pass |
| Pickup ×2 and assembly cues predicted and scheduled at their event time; late cues | 0 late |
| Fall beat has no tick; respawn beat ticks; fall cue predicted | pass |
| Red leaves: perc → < 0.1; after pickup bass/perc return faint and rise (0.27 → 0.71 → 0.90, 0.5 → 12kHz); notice/rescue/pickup/reunion cues predicted, 0 late | pass |
| D+1 carries two bell notes (arpeggio + low G hand-off) | pass |
| Pause: story time frozen, no new notes for 1.5s; resume continues; mute: master → 0 while time and scheduling continue | pass |
| Measured latency (headless Chromium): `baseLatency` 0.01s, `outputLatency` 0.04s, context clock ahead of heard time ≈ 48ms; `getOutputTimestamp` available | recorded |
| Offline render of all parts + rumble: NaN 0, peak 0.29 | pass |

Not measurable here: real speaker/Bluetooth latency and touch latency on Android.

## Tests

- `tests/story.test.mjs` (19): exact beat, clock rebasing/pause/jitter/latency mapping, full-course solvability and length, frame-rate independence, the switch puzzle (SLOW-only and FAST-only fail; the assist widens the window per fall, SLOW alone only after four), the valley link break + relay on every route, respawn keeps progress, story event order (incl. notice → rescue → pickup → reunion), crane beats, music hand-off, finite notes, noisy play never stuck, a fall after red leaves the crane, falls at six rescue/base moments.
- `tests/browser/story.spec.mjs` (3): FREE RUN link; start on the beat and pause without losing phase; a full browser playthrough with real key events to the end card, checking every story beat in order, the comms window, no touchdown after the dock, and the four lights.
- `tests/browser/story-p2.spec.mjs` (2): blue reveal and green link/relay/switch scenes.
- `tests/browser/story-p3.spec.mjs` (2): red's rescue scenes (red waits exactly one beat); the dock beat to black: friends hold still on D, blue lands on D+1 with the hero's first blink, green D+4, red D+8, the light on/off on beats 9–11, four lights > 14 CSS px apart on a 390px-wide screen.
- `tests/browser/story-crew.spec.mjs` (1): crew silhouettes in both forms, measured from pixels.
- `tests/browser/story-audio.spec.mjs` (6): real Web Audio checks above.
- All 72 existing Node tests and 38 existing browser tests still pass.

![Blue: assembly, flash, opening, wide moon](story/p2-blue.png)
![Green: link lost (edge marker), relay, over the socket, switch on and bridge, alone](story/p2-green.png)
![Red: looks back, leaves, comms window, pickup, coming back, reunion](story/p3-red.png)
![Dock: stop, still, blue takes D+1, green D+4, red D+8, launch](story/p3-dock.png)
![Rocket window: base below, receding, four lights, black](story/p3-end.png)

## Open items (next)

- Feel: crane look, the comms window's art, reunion polish, friends overlapping while following.
- P4: real composition and mix, light/space art, moon curvature in the rocket view, chapter pacing (① runs ~70s at a slow pace; target 50s).
- Menu: DAILY inside FREE RUN; STORY as the jam entry point for itch.io.
- P5: Android portrait, background/return on device, novice test, disclosure text, itch.io build.
