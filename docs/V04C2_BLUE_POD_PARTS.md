# RAPIPPO v0.4-C2: build the blue POD from parts (Draft)

Stacked on #10 (RAPIPPO name) → #9 (companion POD). Replaces #9's automatic 30-HOPS join, which playtesters found abrupt, with three parts the player collects by choosing where to land.

## Rules

- Three blue parts: **ANTENNA**, **BODY**, **ENGINE**. One rests on the lit footing at a time, with a soft blue glow.
- Landing within **±20px** (`PART_CATCH`) of it collects it: pickup blip, small blue sparks, and the part hops up into a frame of a three-frame tray in the top-left corner.
- Ignoring a part is fine. When you land past it, it is gone, and the **same part returns at the next slot**.
- When all three are collected the pod assembles **without stopping play** (about 0.75s): the parts leave the tray and stack up behind RAPIPPO, a small ring flashes, the pod appears with dark eyes, then its eyes light up with a rising "pi-po" chime. From then on it hovers and follows half a hop behind, and PR #9's bell answers every second landing (never on 10/50/100 milestones).
- No crew means no bell, no companion and no assembly. Collected parts reset on retry and course change. Mute, retry, pause and game over cancel pending pickup, boot and bell voices.

Unchanged: 0.78s period, FAST/SLOW speeds, terrain v4 and its 20 motifs, footing and collision, death hints, land and milestone voices, Earthrise, C (no marker) default, BEST keys, DAILY salt, share URL. No prediction marker is added.

## Placement: fair, reproducible, independent

- `PartLayout` uses its own generator (mulberry32 seeded with `hashSeed('parts:' + seed)`) and its own **shadow `Terrain(seed)`**. The player's terrain RNG is never called, so the geometry is byte-identical. A test compares 64 seeds before and after layout use.
- Slot hops: first in **22–34**, later ones every **22–32** hops, never on gold-beacon hops (every 5th). A part sits near reference landing *h*, jittered ±24px, and is kept only if
  - it is at least 12px (`PART_EDGE`) inside the lit footing,
  - it is reachable from reference landing *h−1*, and reference landing *h+1* is reachable from it, both at least 8px (`PART_MARGIN`) away from pure SLOW and full FAST.
- Same seed or DAILY date ⇒ same slot positions for everyone. A slot always offers the first missing part in a seed-fixed order.
- Ideal play completes the crew at a median of 82 HOPS (66–98 across 400 seeds); one miss pushes it to about 105–125.

## Tests

- `tests/parts.test.mjs`
  - reproducibility (64 seeds, independent of query order)
  - terrain generator untouched
  - **400 seeds**: lit footing, edge distance, beacon hops, comfortable reach in and out, first part at 20–40 HOPS
  - reachable-set solver (interval DP from the start) confirms every part is landable
  - **400-seed long autoplay** (140 hops): exactly 3 pickups, no duplicates, completes once
  - ignoring parts never blocks progress
  - missed part returns at the next slot
  - no crew before three parts
  - score and physics identical with or without the parts layer
  - DAILY date ⇒ same layout
- `tests/companion.test.mjs`: no automatic join; bell only after completion and never on milestones; assembly finishes within one hop.
- `tests/audio.test.mjs`: pickup and boot chimes are quiet and scheduled; mute and stop cancel them; nothing plays while muted.
- `tests/browser/companion.spec.mjs` (real keyboard; a read-only `__rapippoProbe`, injected only by tests, corrects frame quantisation each hop)
  - 0 / 1 / 3 parts on the result screen and in the PNG
  - tray appears before the first part
  - glowing part visible on the footing
  - no companion before completion
  - assembly runs while the overlay stays hidden
  - companion follows afterwards
  - at 320px and on Pixel 5: no horizontal scroll, result fits
  - retry resets progress, same first part after retry

## Human playtest points

1. Do you *aim* for parts (choosing FAST/SLOW to hit ±20px), or ignore them? Is ±20px too tight or too loose? Tune `PART_CATCH`.
2. With one part left, does "one more and it's built" make you keep going?
3. Does the glowing part or the corner tray pull your eyes off the sky and Earth? Is the tray readable at a glance?
4. Is the assembly (gather → flash → dark eyes → pi-po → follow) readable at speed, or too small or too fast?
5. Missing a part and seeing it again 22–32 hops later: fair, or too long a wait?

## Proposals (not implemented)

- **Make the part slots part of the pacing.** Put slots just after a rest-bay motif, so the first precise landing comes when the player has some breathing room.
- **Per-part sound colour.** Give each collected part its own soft pitch in the pickup blip, so collecting a set "spells" the boot chime.
- **Gold beacons.** The existing gold beacons are still drawn and collected silently. Next to blue parts they read as a second collectible with no meaning. Consider removing them, or folding them into this system as, for example, the green POD's parts.
