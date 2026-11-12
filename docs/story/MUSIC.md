# STORY music (P4)

Theme: **wind-up → waking → widening → flight**. All synthesized with Web Audio in `public/src/story/music.mjs`; no recordings, nothing from the official theme. The 0.78s beat is unchanged and every note sits on the sixteenth grid scheduled from the beat clock.

## Form and harmony

G major with a borrowed C minor: warm, with an ache. 16 bars (one bar = 4 beats = 3.12s; the loop is ~50s), four phrases:

| Phrase | Bars | Chords | Role |
|---|---|---|---|
| A | 1–4 | G(add9) – Em7 – Cmaj7 – D | the tune, plainly |
| A′ | 5–8 | G – Bm7 – Cmaj7 – **Cm6** | the same start, the E♭ of Cm6 turns it wistful |
| B | 9–12 | Em7 – Bm7 – Cmaj7 – G/B | higher, then a held breath (bar 12 is rest) |
| C | 13–16 | Am7 – **Cm6** – G – D | the ache once more, home, a pickup back to bar 1 |

Bar 1 falls on the beat blue is assembled, so the song starts with blue's light. In the ending it starts over from bar 1 on D+1.

## Parts

| Part | Who | Writing | Alone | Distance |
|---|---|---|---|---|
| tick + wind | Rapippo | a clockwork tick on every touchdown, a soft wind-up "tss" on the off-beat; silent on a beat that will be a fall | the whole of chapter ①: a machine in the dark | always clear |
| bell | blue | the melody: eighth-note slots with rests and long holds, G4–C6, one borrowed E♭; a dotted-eighth echo gives it room. Second time through, phrases A/A′ thin to downbeats (more air) | a complete tune | opens with the light (muffled → clear over 3s) |
| bass | green | root on 1, fifth on 3, octave pickup; phrase ends walk up a semitone into the next root | a moving bass line | full in range; a faint radio beyond; returns with red |
| perc | red | thump on 1 (and the "and" of 3 every other bar), wood on 2 and 4, shaker eighths, a rising 16th fill at each phrase end | a groove | as bass |
| pad | all four | the four chord voices, slow attack: **only in the ending, from D+13**, when everyone is finally together | — | fades with the base |
| sparkle | the view from the rocket | sparse glints two octaves up in the current chord, with a long echo | — | rises as the base recedes |

Mix (offline render, 44.1kHz): bell solo RMS 0.042, bass 0.037, perc 0.014 (short hits, peak 0.27), all together 0.052, peak ≤ 0.71. Output: mute gain → ×2 make-up for phone speakers → a gentle limiter (−8dB threshold).

## The ending, beat by beat

| Beat (from dock D) | Sound | Picture |
|---|---|---|
| D | the last tick and the dock clunk; then **nothing** (RMS 0.006) | the connector drops; friends hold still; the camera pulls back |
| D+1 | blue's first melody note over a low G | blue lands; Rapippo's light blinks for the first time |
| D+5 | green's bass (next downbeat) | green lands, legs planted |
| D+9 | red's percussion | red lands |
| D+13 | the pad: the ensemble is complete | — |
| D+17 | launch rumble | the rocket lifts |
| D+21 → D+57 | the base keeps playing, thinner and muffled with distance (never below 12% until black); glints rise | the rocket's window; the base shrinks to four lights |
| D+63 | black | black |

Measured from the render: before D 0.093 → D 0.006 → D+1 0.164 → D+5 0.150 → D+13 0.161 → D+30 0.091 → D+55 0.022 → black 0.005 (peak RMS per beat window).

## Fixed on the way

A new GainNode starts at 1, so the sample just before a note's envelope began leaked through at full level: random clicks up to 0.56 (8× the tick) on the tick and every noise voice since P0. Each gain is now silenced at creation.

## Listening previews

`node tests/browser/render-music.mjs` (dev server running; `BASE_URL`, `OUT`) renders with the game's own code to `output/audio/`: 01 wind-up, 02 awakening, 03–05 bell/bass/perc solos, 06 all together, 07 reunion, 08 ending. These are for ears; the numbers above cannot say whether it moves anyone.
