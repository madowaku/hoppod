# RAPIPPO: 銀河縫いのミシン工房 LAB

Experiment, not a stage. Page: `public/dev/sewing-lab.html` (code in `public/dev/sewing/`), outside the itch.io ZIP like the other `dev/` benches. Started 2026-11-21. **Not yet played by the owner.**

## The question it answers

Does working FAST/SLOW feel like making something together with the friends? There is no score. The log under 記録 keeps every stitch (beat, position, length, speed, zone) for tuning.

## Why a sewing machine

On a sewing machine the needle only goes up and down; the cloth is what moves. That is RAPIPPO's rule: the hero hops in place on the beat, and the player changes how fast the world (here, the cloth) moves. Speed is shown by the cloth, its weave and fluff streaming past, never by effects on the hero (`drawPod` is called without `fast`).

## v0.3: Rapippo is the machine

From the owner's direction (2026-11-21): not a game of working a sewing machine but of **the four becoming one**. The machine body is gone; the rules are unchanged. Each friend's job happens in one place, so cause and effect show.

- **Rapippo, the needle**: drawn at scale 3, standing on the cloth at the seam. A needle sits under its spring; each landing puts it through the cloth. The thread runs from its foot to the last hole: slack in the air, pulled tight on landing (a glint and a キュッ).
- **Green closes the tear**: it stands on the cloth just ahead of Rapippo; its magnets (pulsing brackets above and below the seam) draw the two edges of a tear together, so the slit is nearly shut right where the needle is about to land. Dragged (FAST over a tear), the magnets let go and the slit opens again.
- **Red carries the cloth**: its crane hooks the cloth and hauls it hand over hand; the haul per beat is the stitch length, so FAST is a big swing and SLOW a careful pull. For 返し縫い red runs round to the far side and hauls the cloth back, so the old stitches come back under Rapippo.
- **Sound of speed** (the beat never changes): the needle is a strong カタン！ when FAST and a neat コトン when SLOW; the cloth runs with a looping hiss, bright and loud when FAST (シュルルルッ), soft and swelling with each beat when SLOW (スル……スル……).

## Rules (`sewing-model.mjs`)

- The needle drops on every landing, exactly once per beat (`PERIOD` from `engine.mjs`).
- Hold = FAST feed, release = SLOW. Stitch length = cloth fed between two drops: SLOW 10px, FAST 26px a beat.
- The cloth (1040px): plain, blue's tear, plain, pins, plain, **the big rip (green's)**, plain, red's tear, plain.
- **Tears**: a stitch of 14px or less mends; longer ones sag and leave the slit open. Mended stitches light the friend's hidden constellation.
- **Pins**: a drop within 4px of a pin glances off (no stitch, the pin falls out). Changing speed moves where the next drop lands. One pin section only since v0.2.
- **Song**: 88 beats (about 69s). All SLOW never finishes; all FAST finishes in 54 beats with everything open. FAST on plain, SLOW in tears and SLOW on the pull back over the rip takes about 72.

## v0.2: 返し縫い (reverse)

Added 2026-11-21 from the owner's proposal: going back is the right move for once. No new button: **red reverses the feed by itself** at set places, and the player still only chooses the speed. The needle keeps the same beat; the seam grows backwards over what is sewn. Red only turns the feed round on a drop (needle in the cloth), as on a real machine.

| Where | What red does | Why |
|---|---|---|
| Start | after 30px, back to 0, then on | the start back-tack that stops the thread unravelling |
| The big rip (100px) | at its far end, back to its start, then forward over it again | the rip needs strength 2 at every point: a fine pass counts 1, a coarse one .5. Three coarse passes are 1.5, so at least one pass must be SLOW. The natural one is the pull back |
| End | from the end, back 30px; the seam ends there | the end back-tack |

- Each pass over the same place is drawn a pixel apart, so a back-tacked seam looks thicker. The rip's slit closes a little with each pass and sparkles under blue's light once strong.
- Green holds on and shakes over the rip until it is strong, then one relieved hop (「緑もようやく一安心」). Red calls 「もどすよ！」 and a ratchet clicks; while reversing its percussion turns round (wood first).
- The log marks each stitch `fwd` or `back`.

Later idea, not built: the machine gains abilities as friends join (green: steady cloth, red: reverse, blue: see the pattern).

## v0.4: red directs, chalk marks

From the owner (2026-11-21): red becomes the one who gives directions, and chalk marks come in. The cloth now feeds on its own.

**Red, the director** (`redNext`, thread swaps in `layout`):
- Stands by the **thread stand** behind Rapippo. The thread runs from the spool to Rapippo's ear and down to the needle, so its colour is the colour of the next stitch.
- **Changes the thread**: 36px before each friend's stretch it swings its crane to the spool and puts on that friend's colour (「青の糸！」), and plain thread again after it. Stitches keep the thread they were sewn with.
- **Calls the direction**: a little before a reverse it holds up a sign (◀, gold) and calls 「もどすよ！」; before going forward again, ▶ and 「すすめ！」. The sign stays up while the cloth runs backwards.
- Still asks 「まだ？」 after 3+ SLOW stitches on plain cloth, but not when they land on chalk.

**Chalk marks** (47 in all, none on the rip):
- An × on the seam where the needle should land. A drop within 4px hits it (going forward only): the mark turns gold and **blue's bell plays the next note of the tune**. A mark passed without a hit fades. Mending without a mark rings the bell softly.
- Spacing 26 is a FAST beat, 10 a SLOW beat, anything between needs a switch mid-beat (13, 16, 18 are used). Marks avoid the pins by at least 11px.
- **Blue's light turns gold** when the needle would land on the next mark at the current speed: the aim.
- Hitting every mark is possible inside the song (76 of 88 beats, tested with an aiming hand); not aiming hits about 29.
- In the ending, every mark hit becomes a gold star, joined to the next one hit: **Rapippo's constellation**. The closing lines count the marks.

## The friends tell the state (no gauges)

| Friend | Job | Reacts to | Sound |
|---|---|---|---|
| Rapippo | the needle | — (always steady) | カタッ on each landing, a soft tss on the off-beat |
| Blue | lights where the next drop will land (predicted at the current speed) | the light widens over a tear while SLOW | bell (チリン) on each mending stitch |
| Green | holds the cloth down with its magnetic pads near tears and pins | FAST over a tear: dragged (ズズッ), dust | bass (トントン) on 1 and 3 while it holds |
| Red | v0.4: directs from the thread stand (changes thread, signs the direction); before: pulled the cloth | 3+ SLOW stitches in a row on plain cloth: stops and asks 「まだ？」 | perc (ゴトン) while FAST or reversing |

Each friend keeps playing softly once it has worked, so the workshop builds from the machine alone to the full band. Chords follow the STORY song's (`docs/story/MUSIC.md`).

## The ending

The machine stops; the four spread the cloth as a sheet of four rows, one row per beat; blue's light turns the needle holes into stars one after another; then one line: stitches, and how many of the three constellations came out. Unfinished cloth shows where the sewing stopped.

## Not decided

- Whether the 88-beat limit is too harsh or the right tension.
- Whether the automatic reverse is readable without being told (it is told in the status line and by red's call).
- What the sheet becomes in the story (the owner's idea: a sail; the moon has no wind, so a light sail for blue's lamp is one option).
- Not yet tried on a phone, and the sound has not been listened to.
