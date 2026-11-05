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
- **Rooms:** there are three. Reaching a gold-edged landing saves position, beat and the gears held so far. Attempts resume from there.
- **Every hop is on its beat:** footing is 80px and spacing 165px, so a slow hop always leaves a platform and the fastest never skips one. The pendulums therefore look the same on every attempt.
- Contact is tested on a fixed 1/480s grid, so the result does not depend on frame rate.

The clock stands still until the first press.

## What was measured

All from the model with scripted input, **not human success rates**.

| Check | Result |
|---|---|
| Reachable states with no way forward (one-press inputs, 60ms grid in tests, 30ms in tuning) | 0 |
| ★ rhythm, pressing at 0.20 to 0.32s, ±50ms on each edge, per room | at least 90% (pinned by test) |
| ★ rhythm at 0.28s, whole tower, ±50ms, no correction | 96.4% |
| ★★ route, whole tower, ±30ms, no correction | 34.4% |
| ★★ route, whole tower, ±50ms, no correction | 17.6% |
| Holding 0.50 to 0.58s from take-off, every hop | hits a pendulum |
| Any landing on the last platform, one-press inputs on a 60ms grid | strikes the bell within one hop |

Real input played the rhythm through to the bell in the browser test, with key events timed in the page.

A first layout was rejected because 35ms of lateness was fatal at the last pendulum in the rhythm, so the pendulums were re-searched to widen the band of working rhythms. Respawn points sit on the rhythm's path so the hint stays true after a resume.

## Questions for the playtest

1. Does a player find the late rhythm unaided? Hints appear after three misses.
2. Are the gears noticed now? In the first session they were not. Once ★ is reached, does anyone chase ★★ unprompted? The goal text mentions gears, so this needs a first-time player to answer cleanly.
3. Does going for ★★ make people think about the flight and not only the landing spot? Compare `segments` before and after in the attempt log.
4. Is the ★ too easy once the rhythm is known? 96.4% says it may be, and that could be fine or could make the pendulums feel empty.
5. Do the pendulums read in time? The first one only comes into view after the first hop.
6. Does a hit feel fair at this forgiveness, on a real phone?
7. Does the strike feel like the ending, including the sound, and does it feel earned when it happens without a final input?

## Limits

- Three rooms, one layout, no save between visits, no scoring beyond the session's best.
- Original synthetic sounds and code-drawn art only.
- Not tried on a physical phone or by anyone but scripted input.
- Files live under `public/dev/`, which `public/.assetsignore` excludes from the deployed assets. No production code changes; `COURSE_VERSION`, DAILY and replay URLs are untouched.

## Where to try it

    python -m http.server 8000 --bind 127.0.0.1 --directory public

Open http://localhost:8000/dev/clock-tower.html (`?lang=ja|en`). The stage and the HOLD button are press surfaces; Space works, R resumes from the landing.
