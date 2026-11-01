# HOPPOD v0.4-B: C/no landing guide promoted to the default (experiment)

## Human decision

In a side-by-side playtest of v0.4-A, the owner reported a decisive preference for **C / NONE**. With the landing marker gone, they stopped staring at the prediction and had attention for the lunar night sky and the rising Earth; play also felt substantially better. This is first-person feedback from an experienced player, not yet evidence about new-player onboarding.

## Product changes

- **No marker is now the default** when `marker` is absent in the URL. The ordinary game screen contains no A/B/C testing strip, no landing ring, tether, countdown marker or safety hints, and no "NO LANDING PREVIEW" explanation occupying space. Sky and terrain get the player's attention.
- The 0.78s hop rhythm, FAST/SLOW, terrain generator, safe footprint, death hints, milestone audio, Earthrise, DAILY/FREE, PNG and X sharing are unchanged.
- For development and accessibility exploration, **explicit** `?marker=full` and `?marker=neutral` still work. Add `&compare=1` to show the three mode-switching buttons; the chooser persists through reload and DAILY/FREE switching but is never included in the X-shared course URL.
- Canonical `?mode=free&seed=42&v=4` now launches C. This does not change the course geometry or its `v=4` identity.
- In-development BEST records remain separate: default C still uses `hoppod.best.v4.free.marker.off` or the daily equivalent, so the owner's C-mode test record is not lost. Previously collected A records are still under `hoppod.best.v4.free`. No automatic score inflation or migration.
- Responsive HUD still displays HOPS and BEST. On-screen accessibility text describes holding for FAST and releasing for SLOW without mentioning a nonexistent marker.

## Testing and release gate

- Pure marker-policy tests: default C, explicit A/B, and no changes to underlying physics.
- Browser tests: default selector is hidden, C has no marker, explicit A/B rendering and warning behavior still work, compare mode resets to same seed, per-mode BEST and query behavior are correct.
- Independent long-run browser review now expects C BEST storage and checks explicit full marker in its visual safety test.
- Do not merge or deploy this on its own. Stack: #1 → #2 → #3 → #4 → #5 → #6 → #7 → this PR. The earlier v0.4 terrain experiment (#6) has a historical failed browser test fixed in #7; do not assume #6 is independently CI green until integrated or backported.

## One remaining design risk

The owner already knew the game's speeds and terrain. **First-time players may have trouble interpreting failed landings without the old prediction ring.** Run a separate novice test (at least 3 first-time people): can they understand HOLD/RELEASE, survive the first visible gap, and attribute a fall to a mistaken decision? If not, try a subtle three-hop teaching animation or a help overlay *before* returning to permanent safety guidance.

Future sound-growing/pod-companions are separate proposals. Do not reintroduce gaze-grabbing markers during those experiments.
