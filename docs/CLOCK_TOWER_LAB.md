# RAPIPPO lab: CLOCK TOWER / 時計台

**Status:** research prototype only, built on experiment D (`experiment/string-valley-trajectory`, `7a4211a`), whose contact model and heights it imports. Not linked from the game. Human playtest of this stage: **one short session by the author**. The pendulums were fun; the gears went unnoticed; the ending should be flying into the bell. Those notes led to the current bell and gear presentation, which has **not** been replayed yet.

This was built ahead of experiment D's own "do not implement until this is fun" note, at the user's request, while the replay of D's stage 2 is still pending. D's result may change what is worth keeping here.

## Design principle

Clear conditions are gentle; the room to improve is deep. The stage has two results, and they are opposite flights:

| Result | How | Flight |
|---|---|---|
| ★ Ring the bell | Fly into the bell | One gesture repeated: wait about 0.28s after take-off, then hold until landing. The last hop then strikes the bell without further input |
| ★★ Every gear too | Also touch all three gears with the antennas | Press right at take-off to be high at the gears, and choose each length by reading the last landing |

Gears never hold the clear back. Holding one early length instead of reading each landing runs into a pendulum.

## Rules

The hop, speeds, footing and landing rules are production's (`engine.mjs`). New rules:

- **Pendulums** swing once per two hops, locked to the beat. A high one (length 236) can touch the pod around the top of a hop; a low one (length 330) only near the ground, so it is jumped over. A hit ends the attempt.
- **Forgiveness:** the bob hurts at radius 9 (drawn 15) and only the body counts (±9px, antenna tips excluded).
- **Gears** hang at the height a string rings (y=228) and turn on antenna contact (±16px), the same contact as experiment D.
- **Gears are told:** they are gold, tick on the beat and send out a ring. Passing one unturned shakes it, says so on the stage and explains how to reach it.
- **The bell:** a large bell hangs over the last platform, mouth at y=246 and contact half-width 66px. Any landing there strikes it on the very next hop, at any input, so the ending cannot be missed. Landing is not the clear; the strike is.
- **Rooms:** there are four, the last being the escapement. Reaching a gold-edged landing saves position, beat and the gears held so far. Attempts resume from there.
- **Every hop is on its beat:** footing is 80px and spacing 165px, so a slow hop always leaves a platform and the fastest never skips one. The pendulums therefore look the same on every attempt.
- Contact is tested on a fixed 1/480s grid, so the result does not depend on frame rate.

The clock stands still until the first press.

## The escapement

A short room before the bell, three platforms, no pendulums, its own save. Each platform has one gold pallet: near, far, near. Tick, tock, tick.

- A landing on a pallet advances the great wheel behind the room by one tooth.
- A constant flight stands on the far pallet only, so the rhythm that clears the tower gets one tooth and a visible tick. All three need a **short** flight, then a **whole-hop hold**, then **short** again.
- The near pallet sits at the footing's edge, so aiming for it risks a fall. That is the decision. The room's save makes the retry cheap, and a failed pallet costs nothing else.
- All three teeth wake one missed gear. So ★★ can be two gears in the air plus the wheel, and a gear missed early can still be made good. With three gears already, it adds to the ending only.

## The revival

The bell strike stays. Then, with no input from there on:

1. The pod falls from the bell and keeps hopping on the spot. Each landing is a tick, exactly `PERIOD` apart.
2. Each beat, two more gears of a train mesh and turn across the wall. Music layers build on the beat.
3. Five beats on, the view pulls back to the whole clock, stopped at five to midnight. The pod hops at its centre as the heart, and the minute hand advances once per hop.
4. It carries on until the player presses. The music thins out after 24 beats and leaves the tick. The first second after the bell ignores presses.
5. Later climbs on this device show the big clock already running and a small pulse in the corner (`?fresh` plays as a first visit).

| Journey | What shows |
|---|---|
| ★ | The face is lit and running, with one inlaid gear per gear woken, and a sky of stars that grows with them |
| wheel complete | The great wheel also turns behind the face, with a counter line in the music |
| ★★ | The face stands open: the wheel and all gears turn inside, a full sky, and a top line in the music |

## What was measured

All from the model with scripted input, **not human success rates**.

| Check | Result |
|---|---|
| Reachable states with no way forward (one-press inputs, 60ms grid in tests, 30ms in tuning) | 0 |
| ★ rhythm, pressing at 0.20 to 0.32s, ±50ms on each edge, per room | at least 90% (pinned by test) |
| ★ rhythm at 0.28s, whole tower, ±50ms, no correction, no retries | 87.8% (96.4% before the chamber, because drift has three more hops to build) |
| ★★ route, whole tower, ±30ms, no correction | 60.8% (34.4% before: the wheel can make up one missed gear) |
| ★★ route, whole tower, ±50ms, no correction | 34.2% (17.6% before) |
| Holding 0.50 to 0.58s from take-off, every hop | hits a pendulum |
| Any landing on the last platform, one-press inputs on a 60ms grid | strikes the bell within one hop |
| Chamber route, all three teeth from its save, ±50ms / ±80ms | 97.0% / 78.4% |

Real input played the rhythm through to the bell in the browser test, with key events timed in the page.

A first layout was rejected because 35ms of lateness was fatal at the last pendulum in the rhythm, so the pendulums were re-searched to widen the band of working rhythms. Respawn points sit on the rhythm's path so the hint stays true after a resume.

## Questions for the playtest

1. Does a player find the late rhythm unaided? Hints appear after three misses.
2. Are the gears noticed now? In the first session they were not. Once ★ is reached, does anyone chase ★★ unprompted? The goal text mentions gears, so this needs a first-time player to answer cleanly.
3. Does going for ★★ make people think about the flight and not only the landing spot? Compare `segments` before and after in the attempt log.
4. Is the ★ too easy once the rhythm is known? 87.8% to 96.4% says it may be, and that could be fine or could make the pendulums feel empty.
5. Do the pendulums read in time? The first one only comes into view after the first hop.
6. Does a hit feel fair at this forgiveness, on a real phone?
7. Do players try for the near pallets without being told, and does the wheel feel like their own hops driving it? Compare `teeth` in the log across attempts.
8. Does leaving the clock running feel like leaving something behind, and is the wait until the pull-back too long?
9. Does the strike feel like the ending, including the sound, and does it feel earned when it happens without a final input?

## Limits

- Four rooms, one layout, no scoring beyond the session's best. Only the fact that the clock was started is kept between visits.
- Original synthetic sounds and code-drawn art only.
- Not tried on a physical phone or by anyone but scripted input.
- Files live under `public/dev/`, which `public/.assetsignore` excludes from the deployed assets. No production code changes; `COURSE_VERSION`, DAILY and replay URLs are untouched.

## Where to try it

    python -m http.server 8000 --bind 127.0.0.1 --directory public

Open http://localhost:8000/dev/clock-tower.html (`?lang=ja|en`). The stage and the HOLD button are press surfaces; Space works, R resumes from the landing.
