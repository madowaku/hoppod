# HOPPOD v0.4-C: companion POD experiment (Draft)

Stacked on [v0.4-B no-marker default](V04B_NO_MARKER_DEFAULT.md). Question: with no landing marker (C), does a companion that joins naturally make the long run look and sound a little richer without stealing attention?

## What changed

- **Blue companion POD** joins automatically at **30 HOPS**. No pickup, button or extra input. It drops from the upper sky over ~1.1s and settles behind the hero.
- It **hovers** 40px behind the hero at half scale (1× vs 2×), bobbing **half a hop out of step** (peaks as the hero lands). It never follows terrain, so it never appears to land in a pit, and it stays on screen at FAST. A tiny flickering thruster explains the hover.
- **No collision or physics.** `companion.mjs` only reads the hop phase; it never writes run state, terrain, score or outcome (unit test compares full run snapshots with and without the companion helpers).
- **Bell**: synthesized sine at E6/G6 (alternating) with one faint inharmonic partial. Rings on **every second landing** after joining, delayed by the companion's half-hop lag, and is skipped on 10/50/100 milestone landings so accents stay clear. Peak gain .022 (land voice .07). It is tracked like every other voice, so **mute, retry, pause, course change and game over cancel even a pending bell**. Turning off milestone accents (`?sfx=classic`) does not affect it.
- **Result screen**: Earth state (`FAR SIDE` / `EARTHGLOW` / `EARTHRISE n/4` / `FULL EARTH`) and, when present, `■ WITH BLUE POD`.
- **SAVE PNG**: the pair hops together on the platform (blue mid-hop, behind), with an `EARTHRISE 1/4 · WITH BLUE POD` line. Without the companion the card is unchanged apart from the Earth line. Same 1080×1350 size and download flow.

Unchanged: 0.78s period, FAST/SLOW speeds, terrain v4, footing, death hints, land/milestone voices, Earthrise, C default, BEST keys, X share URL.

## Sound source

The bell is synthesized with Web Audio like every other HOPPOD cue, so the project still ships with no audio files and no licence bookkeeping. Free commercial-use libraries (OtoLogic, UI SFX, Kenney, the shared CC0 set) remain an option if humans prefer a sampled bell.

## Tests

- `tests/companion.test.mjs`: joins once at 30; bell cadence 32, 34, 36, 38, 42…; hover never reaches the floor; Earth labels; physics/score invariance over 16 seeds.
- `tests/audio.test.mjs`: bell pitch, scheduling, peak far below land voice; mute/stop cancel a pending bell; muted bells never start.
- `tests/browser/companion.spec.mjs` (390px and 320px): no companion at 29 HOPS, present at 36 in C mode with no marker; result screen shows Earth and crew inside the overlay without horizontal scroll; downloaded PNG contains the blue pod; a short run's PNG contains none.

## Human playtest points

1. Does the blue pod's arrival around 30 HOPS feel like a reward, or does it pull your eye off the terrain at a bad moment?
2. Is the hover/off-beat bob readable as "a friend riding along", or does it look like it should collide?
3. Is the bell pleasant at 2 beats, or tiring after 100+ HOPS? Does it ever mask the land note you use for rhythm?
4. Phone (320–390px): does the companion ever overlap the hero or the first gap you are judging?
5. Would you post the new PNG? Is `WITH BLUE POD` worth showing, or should the card show only the pair?
