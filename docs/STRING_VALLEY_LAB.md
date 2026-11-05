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
| 2 UNDER | Land on a **wider** pad without ringing. Optional: get all the way past the string | 29.4%, of which the optional full pass is 11.1% (see the stage 2 spec) |
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
- Human feedback so far is limited to the first playtest noted below, on the earlier layout. The current stage 2 has only been run with scripted input, and physical-Android behaviour is not recorded here.

## Follow-on hypotheses (do not implement until this is fun)

- Hanging clockwork pendulum: the same path difference becomes a pass/fail challenge.
- Factory suspended switches: a string hit routes a conveyor belt or opens a gate.
- Timing-accurate replay of each input edge could allow an original one-beat tune to be shared.

**Promotion criterion:** a player can intentionally reproduce and then *reverse* the result while aiming for the same landing pad, without adding a second gameplay button.

### Stage 2 revision after first human playtest (2026-11-04)

First hands-on feedback: ringing the strings and landing was enjoyable, but stage 2's silent landing was frustratingly hard. The player reported **both** avoiding contact and sticking the landing were difficult to reproduce intentionally.

Only stage 2's second platform changes, from [183, 272] (89px physical width) to [165, 315] (150px), and stage 2 gains two tiers. The string's x and contact height, speed, timing and landing physics remain unchanged, as do stages 1, 3, 4 and 5. Stage 4 keeps its flag and ±12px tolerance as the mastery challenge.

An interim layout of [155, 315] covered 43.2% of inputs, but 74% of those clears never took the antennas past the string, and a third of them stopped short of it. All of the extra coverage came from the left side, so the left edge was moved so that the footing starts at the string (x=173).

### Stage 2 spec

Every tier requires no string contact and a safe landing.

| Landing x | Result | Message | One-press inputs (of 3160) |
|---|---|---|---|
| x < 173 | Not cleared (the footing starts at 173, so this is a fall) | "Fell short" | n/a |
| 173 ≤ x < 189 | **Clear**, opens the next stage | 「★ 静かに着地できた！」 / "★ Landed quietly!" | 579 (18.3%) |
| x ≥ 189 | **Full pass**, the optional goal (★ on the stage button, also opens the next stage) | 「★★ 弦を完全にくぐり抜けた！」 / "★★ All the way past the string!" | 351 (11.1%) |

189 is the string's x plus the antennas' 16px reach: the point where the antennas have left the string's x. The earlier layout had 325 clearing inputs (10.3%), so the full pass is about as demanding as the old stage 2. It never blocks progress. Stage 2 shows its landing rounded down so that the number cannot contradict the tier (x=188.6 reads 188px). Attempts in the log carry `tier`. Demos earn neither tier.

### What clearing stage 2 does and does not show

**A stage 2 clear is not evidence that a player learned late FAST.** A single short press early in the hop clears it: FAST for about 0.1s from take-off lands at x≈173 in silence, because the antennas arrive after they have dropped below the bead. The minimum FAST that reaches the pad is about 0.098s, and an early press beyond about 0.18s rings the string.

Late FAST is required only for the optional full pass: every one-press full pass starts after about 0.32s and is still held after the contact window closes at 0.502s. Late-FAST learning therefore has to be read from the full pass and from stage 4, not from the clear. The stage 2 hint says only what holds for the clear: a short press is enough, and a long early press hits the string. These percentages are input-space coverage, **not** measured human success rates.

Retest with hands-on input, and read `tier`, `x` and `segments` from the attempt log:

1. Does the clear relieve the frustration of the first playtest?
2. Do players clear with short presses only, and do they stop there?
3. Does anyone try for the full pass unprompted, and can they repeat it on purpose?

If silence is still hard to reproduce, measure actual input-edge intervals from the log before changing the string geometry or contact rules.
