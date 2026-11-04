# RAPIPPO lab D: STRING VALLEY / 弦の谷

**Status:** research prototype only. Created independently from `main` (`53b6642`). Keep STORY jam PR #16 and A/B/C PR #17 unchanged.

## Core hypothesis

The player controls not only **where a jump lands**, but also the **path through the air**. With an unchanging automatic 0.78-second hop, different FAST/SLOW timing can produce the same landing x but different contact with objects between start and landing.

## Same world as the game

The lab uses production geometry so that what is learned transfers: 1 world px = 1 canvas px, a 96px hop, `FLOOR` 382, the real `drawPod` sprite, the production footing and landing rules (`isSafe`, `landingMiss`) and production sound effects. `tests/string-trajectory.test.mjs` fails if the contact model drifts from the sprite or from `app.mjs`.

## The contact rule

A string hangs from above and ends in a bead. **It rings when the antennas reach the bead**, and in no other case: the antennas (±16px) must share the string's x while their tips are above the bead's lower edge (y=228). A silent pass therefore looks like a silent pass. A test samples the drawn positions independently over the one-press input space and requires the sound to agree with the picture.

The antennas are that high only during t=0.278–0.502s of each hop, which the timeline in the lab shows as a lighter band.

Contact is solved exactly inside a constant-speed slice, so it does not depend on the frame rate. Input edges carry their event timestamps and are applied at that moment rather than at the next frame.

## Exact demonstration

Start x=75, FAST=270px/s, SLOW=105px/s:

- Early: FAST during 0.00–0.39s, SLOW during 0.39–0.78s.
- Late: SLOW during 0.00–0.39s, FAST during 0.39–0.78s.
- Both end at x=75+0.39×270+0.39×105=**221.25px**.
- String at x=173 (far): early rings, late passes below.
- String at x=125 (near): **the reverse**. Rushing passes the string before the antennas are high enough; starting slow brings them there at the top of the arc.

The near string is what keeps this from collapsing into the single rule "press early to ring". The player has to read the distance and choose a path.

## Where to try it

    python -m http.server 8000 --bind 127.0.0.1 --directory public

Open http://localhost:8000/dev/string-valley.html. `?stage=far-ring|far-silent|near-ring|flag|phrase` opens a stage and `?lang=ja|en` picks the language.

A press arms the jump: the robot makes one hop on the spot, then takes off. This gives the finger time to be ready, gives the beat before the attempt, and allows both "already holding at take-off" and "wait, then press". The whole stage and the HOLD button are press surfaces; Space works and R retries.

## Stages

| Stage | Goal | One-press inputs that clear |
|---|---|---|
| 1 RING | Ring the far string, land on the pad | 40.5% |
| 2 UNDER | Land on the pad without ringing it | 10.3% |
| 3 NEAR | Ring the near string, land on the pad | 42.8% |
| 4 FLAG | Land within ±12px of the flag (x=221.25), once ringing and once silent | 19.0% |
| 5 PHRASE | Four hops without stopping: ring, rest, ring (near), ring | see below |

Percentages cover every press/release pair in 10ms steps, from the model. In stage 5 the distance to the next string depends on where the previous hop landed. With the demo plan and uniform ±50ms error on each edge, the tests require a success rate of at least 50% and below 100%.

Stage 4 is the promotion criterion made playable. Stage 5 asks the question stage 1 cannot: whether the choice survives inside the game's unbroken rhythm.

## What the research should answer

1. Can an inexperienced player *understand* the difference between same landing and different airborne path?
2. Can they deliberately ring the string with manual FAST/SLOW instead of merely triggering it accidentally?
3. Does the sound feedback encourage voluntary retries?
4. Can the visual tell the story without technical explanatory text? Hints appear only after three misses.
5. Is the ±12px flag and the contact window right on a real Android phone?
6. After stage 3, do players read the string's distance, or keep one memorised gesture?

The demos establish constructive examples and the jitter test estimates margins. Neither proves that manual control is easy, pleasant, or responsive. Each attempt is logged on the device (input type, FAST intervals, landing, contact) and can be copied from the page after a session.

## Caveats and boundaries

- No level design beyond these five stages. This is not a music system.
- The antenna box is one rectangle. FAST bends the drawn tips back by up to 8px, so the picture can differ from the box by that much at the very edge of a contact.
- Original synthetic pluck only; missing audio support degrades to visual feedback.
- No network, saved scores, cloud sharing, linked main menu, release build, or production code modification.
- Files live under `public/dev/`, which the STORY itch ZIP builder excludes. Existing `COURSE_VERSION`, DAILY and replay URLs are untouched.
- Not yet tried on a physical Android phone or by anyone but scripted input.

## Follow-on hypotheses (do not implement until this is fun)

- Hanging clockwork pendulum: the same path difference becomes a pass/fail challenge.
- Factory suspended switches: a string hit routes a conveyor belt or opens a gate.
- Timing-accurate replay of each input edge could allow an original one-beat tune to be shared.

**Promotion criterion:** a player can intentionally reproduce and then *reverse* the result while aiming for the same landing pad, without adding a second gameplay button.
