# トロンボーン台車ラボ / Trombone Cart Lab

Research prototype, 2026-11-05. Independent branch `experiment/trombone-cart`,
based on `main` at `53b66423f9510422d434e8c9d0b02b5fe18eca02`.
Keep STORY PR #16, String Valley PR #18 and main unchanged. Draft PR only;
no merge, deployment, production menu link, saved scores or network calls.

## Question and minimal design

Can a novice intentionally move left AND right relative to a moving cart,
using only RAPIPPO's existing FAST/SLOW world velocities, and play a short
two-pitch return phrase without falling?

This is a deliberately small spike. The chosen approach uses a separate
Canvas page, the original `drawPod`, production timing/speed/inset constants,
a pure moving-platform model, and one Web Audio context for original brass
synthesis. No dependency or production gameplay module is changed.

Alternative: add cart support to the endless terrain engine. That would mix
experimental collision rules into existing runs, so it is deferred.
Alternative: directly move a sprite left/right on a stationary cart. That
would not test the requested world physics, so it is not used.

## Physical model

Let `u(t)` be total FAST seconds since start:

```
podX(t)  = podX(0) + 105*t + 165*u(t)
cartX(t) = 75 + 187.5*t
relativeX(t) = podX(t) - cartX(t)
```

The cart's speed is subtracted to change reference frame; it is never added
to the pod's world velocity. No snapping, clamping, teleporting, wraparound
or automatic pitch selection. A whole 0.78s hop changes relativeX by
`-64.35px` at SLOW and `+64.35px` at FAST. Equal FAST/SLOW time returns to
the same relative position.

The cart's physical width is 280px. The 8px rim on each side is excluded,
so legal touchdown is relative `[-132,132]`, inclusive. Collision is tested
only at the exact touchdown time, against the cart's position THEN. The
96px sinusoidal jump clears a flat cart; there are no side walls. Leaving
the horizontal footprint in midair does not itself cause a fall.

`supportAt` returns distinct `cart` / `terrain` kinds. Static platforms use
unchanging world coordinates through production `footing`; they are not
transformed with the cart. Static support cannot earn a cart note or keep
this experiment going. This lab has no static landing platforms: the moon
and rail marks are background, drawn below the landing plane. This is a
single-height landing model, not a general multi-height physics engine.

## Two notes and repeatable gestures

Cart-relative x<0 plays low G3 (196Hz); x>=0 plays high C4 (261.6256Hz).
Color, text, a fixed central divider and tick marks identify the two zones.
The camera follows the cart exactly; rail marks move left at its world speed
(fixed background when reduced motion is requested).

| Setup | Initial relative x | Whole-hop inputs | Notes / relative landings |
|---|---:|---|---|
| 低 → 高 → 低 | +32.175 | SLOW, FAST, SLOW | low -32.175, high +32.175, low -32.175 |
| 高 → 低 → 高 | -32.175 | FAST, SLOW, FAST | high +32.175, low -32.175, high +32.175 |

Different start positions belong to the explicit phrase setup only. Nothing
resets position during play. Continue alternating to play indefinitely; a
completed phrase celebrates but does not stop or require Reset. Constant
SLOW or FAST eventually falls. A wrong note still sounds honestly and does
not end the attempt. The last 12 notes are shown in memory only.

Start gives one stationary preparation beat, without a scored note. Press
and release the canvas, HOLD button or Space to change velocity. Pointer
capture supports release outside the button. There is a touchable pause
button; focus loss/backgrounding pauses and clears held input. Resume keeps
the hop phase and relative position, with SLOW as the initial input. A gap
over 0.5s in simulation updates freezes at the last simulated state.

## Audio

Original sawtooth + low-pass filter + breath-like envelope + a small attack
pitch bend approximates brass; this is not a recording or a claim of realistic
trombone acoustics. Each landing creates a fresh voice. Voices disconnect on
ending; pause/retry/mute fade active voices. One gesture-unlocked AudioContext
and a quiet compressed master are used. Audio failure is disclosed, visual
movement continues, and the sound button can retry initialization.

Notes are reactive on touchdown, not predicted ahead from unknown future
input. The UI uses performance time with timestamp-split input, not STORY's
heard-audio clock. Device/Bluetooth sound latency and perceived synchronization
remain human/device gates. No attempt was made to change PR #16's clock or
PR #18's contact/audio code.

## Run and verify

```
npm ci
npm test
npm run check
npx playwright install chromium
npm run test:cart
```

The dedicated browser config serves this checkout on port 8022 to avoid
accidentally testing the separately running STORY checkout. The normal
`npm run test:browser` and CI also discover the new spec. For manual play:

```
python -m http.server 8022 --bind 127.0.0.1 --directory public
```

Open `http://127.0.0.1:8022/dev/trombone-cart.html`.

Automated coverage:

- Exact absolute/relative velocities and half-FAST stationary-relative hop.
- Moving touchdown bounds, rim endpoints, old-position rejection, and static
  terrain classification / no static rescue or cart notes.
- 100 uninterrupted oscillating hops in EACH direction; genuine falls under
  constant input; no premature fall while airborne outside the footprint.
- Timestamp-split input at 23/30/60/144fps.
- Both phrases over four hops with each of three switch times shifted by
  -50/0/+50ms (54 scenarios). This is bounded input-error coverage, not a
  guarantee against accumulating errors over unlimited human play.
- Browser keyboard/pointer/emulated-touch gestures, repeated phrases, fall,
  retry, pause/resume, focus loss, long update gap, mobile/desktop layout,
  nonblank pixels, real AudioContext pitch generation and voice cleanup.

Screenshots and traces are local/CI artifacts under `output/playwright/`.
Read-only canvas data attributes expose state, hops and relative x for tests;
no callable game-control test API is exposed.

## Human playtest (NOT yet performed)

1. Without explaining velocities, ask what pressing/releasing does relative
   to the cart. Is the central line sufficient to perceive both directions?
2. Ask for low→high→low, then high→low→high. Can the player repeat and reverse
   the result deliberately, rather than accidentally hitting both zones?
3. Continue for 8–12 hops. Does switching after the landing sound feel natural?
   Does position drift or the cart edge cause frustration?
4. Try physical Android touch/drag/cancel, speakers, headphones, background and
   resume. Judge latency, pitch distinction, brass character and comfort.
5. Can the player recover from an unwanted note without restarting? Is there
   voluntary replay after the short phrase succeeds?

Automated completion establishes physical/software feasibility only. It does
not establish novice understanding, perceived back-and-forth motion, timbre,
comfort, musical satisfaction, or fun. Do not promote this into production
based on scripted completion alone.

## Documentation/code reconciliation

No existing production gameplay documentation or rules were rewritten.
The lab's cart-following camera is explicitly experimental and does not
change production's no-landing-marker policy. New lab documentation follows
the implemented two-note, single-height, timestamped simulation. No unresolved
specification/code conflict was found in the touched scope.
