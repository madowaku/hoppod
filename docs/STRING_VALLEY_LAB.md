# RAPIPPO lab D: STRING VALLEY / 弦の谷

**Status:** research prototype only. Created independently from `main` (`53b6642`). Keep STORY jam PR #16 and A/B/C PR #17 unchanged.

## Core hypothesis

The player controls not only **where a jump lands**, but also the **path through the air**. With an unchanging automatic 0.78-second hop, different FAST/SLOW timing can produce the same landing x but different contact with objects between start and landing.

The 1-hop experiment asks players to strike one hanging string and land on a wide pad. The single struck note is generated with Web Audio (no external soundtrack). There is a visual outcome too, so audio is not required to distinguish success.

## Exact demonstration

Assume x starts at 75px, FAST=270px/s, SLOW=105px/s:

- Early: FAST during 0.00–0.39s, SLOW during 0.39–0.78s.
- Late: SLOW during 0.00–0.39s, FAST during 0.39–0.78s.
- Both end at x=75+0.39×270+0.39×105=**221.25px** and land safely.
- At the vertical string plane x=173px, early crosses at t=0.362963s, sensor y≈163.52; late crosses at t=0.601296s, sensor y≈192.99.
- Only the glowing tip y=155–173 triggers the note. Thus early rings the string; late passes below. The measured height separation is about **29.47px**.

The sound event is calculated at the exact crossing time within each piecewise-constant input segment, rather than based on whether a rendered frame overlaps the string.

## Where to try it

    python -m http.server 8000 --directory public

Open http://localhost:8000/dev/string-valley.html.

Choose **SHOW EARLY FAST** and **SHOW LATE FAST** to verify that the landing point is identical. Choose **TRY MANUAL** and hold Space (or the large HOLD button) to explore the actual timing yourself. R retries. There is only one jump, to isolate the mechanic.

## What the research should answer

1. Can an inexperienced player *understand* the difference between same landing and different airborne path?
2. Can they deliberately ring the string with manual FAST/SLOW instead of merely triggering it accidentally?
3. Does the sound feedback encourage voluntary retries?
4. Can the visual tell the story without technical explanatory text?
5. What is the needed hit-window tolerance on a real Android phone?

Test **mechanic viability** first, not player satisfaction inferred from scripts. The demos establish one constructive example, but do not prove that manual control is easy, pleasant, or responsive.

## Caveats and boundaries

- Only one string, one jump, one fixed pad. This is not a level or music system.
- The actual phone/browser input timing is frame-quantized in this prototype. The *scripted* early/late paths are explicitly split at 0.39s and checked at multiple integration resolutions. Production should use event timestamps and a pause/resume clock to avoid input latency skew.
- Contact is a point-sensor at the visible forehead diode's crossing of a string x-plane and a glowing vertical tip, not full sprite swept collision.
- Original synthetic pluck only; missing audio support degrades to visual feedback.
- No network, saved scores, cloud sharing, linked main menu, release build, or production code modification.
- Files live under `public/dev/`, which the STORY itch ZIP builder excludes. Existing `COURSE_VERSION`, DAILY and replay URLs are untouched.
- Test under 30/60/144 fps and Android touch before any promotion.
- No requirement to make early FAST the single correct choice forever; the point is to unlock trajectory as a new expressive axis.

## Follow-on hypotheses (do not implement until this is fun)

- 2 or 3 strings at different positions/heights: the same safe landing might create multiple melodies.
- Hanging clockwork pendulum: the same path difference becomes a pass/fail challenge.
- Factory suspended switches: a string hit routes a conveyor belt or opens a gate.
- Timing-accurate replay of each input edge could allow an original one-beat tune to be shared.

**Promotion criterion:** a player can intentionally reproduce and then *reverse* the result while aiming for the same landing pad, without adding a second gameplay button.
