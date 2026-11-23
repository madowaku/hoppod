# RAPIPPO: the Starlight Instrument Workshop / 星明りの楽器工房 (formerly 月の楽器工房)

**Status:** playable from start to end card. Developed on `feature/moon-workshop` and merged into the jam build on `feature/story-jam-02`. Reached from the stage select (`select.html`), which the owner decided on 2026-11-07 should ship in the jam build. The owner played it through twice (2026-11-07, see "Playtests"); every number below comes from scripts and headless Chromium.

Play locally: `npm run dev`, then open `http://127.0.0.1:8000/workshop.html?lang=ja`.

## Where it sits

A separate episode in one RAPIPPO world, not a separate game (owner, 2026-11-05):

- 月渡りのラピッポ: rescuing friends and coming home.
- 星明りの楽器工房: bringing sound back and finishing the music.
- 時計台: giving time back to a stopped machine.

The ending is not "it stops for the first time" (STORY's dock already has a stop). It is: **the world you operated leaves your hands and goes on by itself.**

Nothing shared changes: `engine.mjs`, `pod.mjs` and `story/beat.mjs` are imported read-only. The hop is still exactly 0.78s, and every touchdown is a beat.

## What the input can really mean

FAST/SLOW has only four independent readings. The stations are built on them, so each holds one new discovery instead of one new skin.

| Reading | Why it is separate | Used by |
|---|---|---|
| Total FAST in a hop | Sets the landing, 81.9 to 210.6px. "How much air" is the same variable, so it is not a new mechanic | drums, tongue drum, keys |
| When in the hop | Same landing, different path | harp, strings |
| The press itself | Three 0.08s taps add only 40px, so rhythm is nearly free of distance | woodwind, bellows |
| Against something moving | Only here can you go backwards | trombone |

Layout unit: **U = 32.175px**, what one sixteenth note (0.195s) of FAST adds to a hop.

## The stations

| # | Station | The one discovery | Rule | What it leaves in the song |
|---|---|---|---|---|
| 0 | Silent hall | Only your tick is left | Long safe ground; no fall possible | Nothing |
| 1 | Drums | Where you land is what sounds | Kick, snare, block. A continuous deck until its last third | Drum pattern |
| 2 | Tongue drum | What you strike wakes its own kind | Plates of a pitch are solid only after you struck that pitch. Open after 3 falls | Ostinato |
| 3 | Keys | How far you hop is the interval | No holes. Keys are half a SLOW hop wide: SLOW is a third, FAST about a sixth. A lit black key plays the borrowed E flat | Broken chords |
| 4 | Harp | The sky has strings | Tip crossings within the high window. SLOW about 5 strings, FAST about 10 | Length of the run |
| 5 | Strings | Same pad, different sound | From String Valley. Ringing is never required, because silence proved frustrating there | Plucked phrase |
| 6 | Woodwind | Every press is a note | Wide gaps ask for long tones, narrow ones leave room for short ones: the ground is the score | Rhythm: the signature |
| 7 | Bellows | Push and draw are the instrument | Gold plates take FAST at touchdown, blue take SLOW (0.12s grace, as HOPSCROLL's bridges). The plates say which in words, and the hero wears the colour its input can land on. Open after 3 falls | Stabs |
| 8 | Trombone | You can go back | A cart at 187.5px/s: ±64.35px a hop, half a hop holds still. Camera on the cart, seven painted positions, the hero works the slide of a trombone mounted above. Guard rail after 2 falls | Countermelody |
| 9 | Cymbals | The ring is the only light | Light fades over four beats (328px at SLOW, 842px at FAST). Footing edges stay faintly visible; a return brings one more look | Only the crash at the full band |
| 10 | Metronome | It has lost its weight | Three rungs slow the rod's tick to the hop's. Cannot be fallen from | The ending |

The cart model matches `experiment/trombone-cart` (`docs/TROMBONE_CART_LAB.md` on that branch).

## The ending

The rod and Rapippo follow a real double pendulum: a fixed weight below, a movable one above, and **the weight's position** sets the period, not its mass alone.

| Weight position (× lower arm, 10:1 mass, simplified) | One tick |
|---|---|
| Bare | 0.557s, 5:7 against the hop |
| 1.05× | 0.62s |
| 1.59× | 0.68s |
| 1.95× | 0.73s |
| 2.27×, the tip | 0.78s, the hop itself |

One millimetre there moves a tick by about 3.3ms in that model, which is why the legs lock. A real metronome also has a spring and an escapement; this is a reason for the staging, not a simulation of one.

1. Each rung slows the out-of-step tick towards the hero's own.
2. The final landing sets 0.78s; the rod leans to meet the hero, so it cannot be missed. No legs: like the weight, it slides down the rod, which goes in behind its back, and stays on its spring. **The control goes off, with no prompt**.
3. One beat of silence.
4. The first tick. Parts enter in the order they were woken, at bars 2, 4, 6, 8, 10, 11, 12, 14. The band is full from bar 16, with a crash.
5. The room warms as the band fills and the camera never moves: the rod swings with the hero on it, inside a still frame. (With reduced motion the swing is small.)
6. From bar 24 only the tick and **the player's own breath** remain. The card comes at bar 28 with no line of its own, and the sound does not stop.

The goal is announced from the moment it is in view: the hero drops back in the frame, a shaft of light stands on the case, lamps run towards it and each rung lights the rod further up. The landing itself is one flash, a burst and a heavier lock whose bell has rung out by the first tick, so the silent beat stays. The control still goes off with no prompt.

### Telling the player it is theirs

Playtest: the song was not recognisable as the player's own. So the finale now says it, without changing a note:

- As each part enters, a panel names what the player did ("Your landings became the drums") and runs that part's actual loop with an echo of the hero hopping through it; each mark lights as its note sounds.
- A small pale echo of the hero stands on each instrument and hops only on the player's notes, never on the workshop's.
- From the full band all eight loops run together ("All of this is what you left here"), then only the breath. A part the player left empty says the workshop kept it. A shared song credits someone else.

## How a poor player still gets a good song

The workshop owns the chords, tempo, register, entrance order and who is in front. The player leaves **where and when** sounds happened, how many, and the rests.

- A note moves one sixteenth at most and is never replaced by a composed one.
- Strong beats go to the nearest chord tone, weak beats may stay in the scale.
- When parts rub, the lower seat yields to a chord tone within a third, or stays out.
- A full bar keeps 22 notes: strongest beats and the part in the spotlight.
- A part that never played gets a very quiet line, marked as the workshop's own.
- Each station records its last 4, 8 or 16 hops as a loop. A retake starts from the last lantern, so falls stay out of the music.

Chosen from the research round: playing everything as recorded had 46% chord tones on the beat in the worst case and 88% rubbing; scale correction alone left the rubbing unchanged; a fixed arrangement made every player the same. The owner chose this method by ear (the "workshop" and "four rungs" previews).

### Measured on takes from real runs through the course

Scripted runs, `node tests/helpers/workshop-finale-report.mjs`:

| Run | Chord tones on the beat | Rubbing onsets | Busiest bar |
|---|---:|---:|---:|
| calm | 94% | 1.7% | 22 |
| rushing | 95% | 1.9% | 22 |
| late hold | 97% | 0.0% | 22 |
| short taps | 98% | 0.9% | 22 |

Distance between any two of them is 0.73 to 0.85 (0 identical, 1 nothing shared). These measure the score, not whether it moves anyone. `node tests/browser/render-workshop.mjs` renders the finale to WAV with the game's own voices (below 300Hz: 33 to 39% of the energy, down from 43 to 48% in the research previews).

## After the end

- **Score card:** SAVE SCORE writes a 1080 × 1350 PNG of the player's own take.
- **Shared song:** COPY LINK makes `workshop.html?take=…`, which opens as that song. Everything in the address is checked and clamped on the way in.
- **Free play:** unlocked by a clear. Hold for a wider swing, and a press is your breath. The beat never moves: width is what changes, as FAST changes distance and never the 0.78s.
- **Continue:** progress is saved at each lantern with the instruments so far. Malformed saves are ignored.

## Developer links

`?cp=N` starts at lantern N with demo takes for what came before. `?end=1` plays the finale with a demo take. `?lang=ja|en`.

## Verification

```
npm test                  # includes tests/workshop.test.mjs
npm run check
npm run test:workshop     # its own port and config: 14 browser tests
npm run render:workshop   # server on 8033
```

Covered: hop and beat exactness, reachability from every lantern, no hidden gap where platforms touch, each station's rule, the finale for the worst scripted inputs, hostile share links, a full playthrough with real key events to the end card, falls, continue, pause on the card, reduced motion, touch, and real Web Audio timing.

Phone-sized page (390×844, DPR 3) with the CPU throttled 4×, headless Chromium, real audio: mean 16.6ms and p95 16.7ms, no frame over 33ms, in harp, woodwind, cymbals and the full band. GPU raster is not emulated.

`node tests/helpers/workshop-noisy-player.mjs` runs a player who reads ahead perfectly but has an imprecise finger, to find unfair stations relative to each other. It never misreads the ground, so its falls are a floor, not a forecast.

## Playtests (owner, 2026-11-07)

### Second

"Moved me." A signature stage, says the owner. Removed the waiting outline at the goal and the last line of the end card. Coming back at a lantern needed an instant press: `tests/workshop.test.mjs` now requires two landings with no input from every lantern. Mid-station lanterns in the tongue drum, strings, woodwind, bellows and cymbals stand on 250px rest ground (the strings' first plain ground is 220px). Dark difficulty stays as it is, by decision.

### First

"Really fun." What was found and what changed:

| Found | Change |
|---|---|
| Backwards reads, but it should feel more like a cart; the trombone did not read as one | A flatcar with spoked wheels, rods, stakes, lamps and springs on a trestle; a rail clack on the half beat; the camera trail no longer pushes it off screen. A side-on trombone rides over it and the hero works the slide |
| Woodwind delay noticed at first, then fine | No change |
| The dark was not hard at all | No change. The owner has since decided to keep it |
| The metronome should feel more like the goal | See "The ending" |
| The swinging frame in the finale could cause motion sickness | The camera no longer moves |
| Not easy to notice the song was your own | See "Telling the player it is theirs" |
| On the bellows, which colour is which got lost | Plates say 押す / 離す (HOLD / LET GO). The hero and the hold button wear the colour of the plates the current input can land on |

## What only people can answer

1. Do first-time players understand each discovery with one line of text?
2. **Cart:** can a novice hold still on purpose?
3. **Woodwind:** is the press-to-sound delay acceptable on a real Android phone? Unmeasured, and this station depends on it.
4. **Dark:** the owner found it easy. Does a first-time player, given that STORY's playtest found its dark hard?
5. **Ending:** does taking the control away, with no prompt, feel like release or like being cut off? Does the new arrival read as a goal?
6. **Finale:** now that it says so, do players feel it is theirs, or do the panels get in the way of listening?
7. Length: scripted runs take about 2 to 5 minutes before the 1.5-minute ending. Is each station long enough to repeat and reverse its discovery?

## Known limits

- A press inside the last 0.15s before a landing can make a predicted landing note wrong, as in STORY. An unpredicted event still sounds.
- Bluetooth makes the woodwind's press-to-sound delay longer; landings are unaffected because they are scheduled ahead.
- The art is code-drawn placeholders-plus: readable and consistent, not final illustration.
- `scripts/build-itch.mjs` ships every file in `public/` except `dev/`, so this page is in the ZIP.
