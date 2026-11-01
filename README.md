# HOPPOD 🚀🐰

**ONE MORE HOP!** An endless, one-button lunar score attack for browsers.

Small bouncing space capsule with rabbit-ear antennas, a face-display, and a spring. Hold to move the world FAST, release to move SLOW; the pod jumps automatically. Designed for sharing HOPS scores on X.

## Project direction

- **Game:** Endless HOPS score attack, deterministic terrain and daily challenge; one-tap retry.
- **Visuals:** Original retro-style capsule mascot (concept C), dark moon landscape, clear landing preview. Not a living rabbit.
- **Stack:** Vanilla JavaScript + Canvas 2D; no game engine or login.
- **Distribution target:** Cloudflare Workers Static Assets (deploy only after device and sharing tests).
- **Source:** Gameplay mechanics inspired by the user's earlier [HOPSCROLL](https://github.com/madowaku/hopscroll). Independent project and release lifecycle; carry over attribution and validated mechanics.

## Play locally

Requires Python 3. From this folder:

```powershell
python -m http.server 8000 --bind 127.0.0.1 --directory public
```

Open [HOPPOD locally](http://127.0.0.1:8000/?mode=daily). No build, account, API key, or runtime downloads. Hold the canvas or the lower control for FAST; release for SLOW. Desktop: Space to hold, R to retry, Escape to pause. The pod hops every 0.78 seconds. Mint landing ring = safe **if the current speed is maintained**; coral = change your pace. The lit flat top of each platform is exactly where you can land; its stepped rim and the black pits are not.

DAILY uses the date in Japan; its URL replays that day even tomorrow. FREE RUN chooses a fresh seed; retry keeps the same seed. POST TO X opens a composer; SAVE PNG downloads a score card to attach manually.

## Verify

Node 22+ and Python 3:

```powershell
npm ci
npm test
npm run check
npx playwright install chromium
npm run test:browser
```

Browser tests start their own local server if port 8000 is free. Screenshots, the downloaded PNG, test JSON and failure traces go to `output/playwright/`. CI uploads browser evidence.

v0.3 (course `v=3`) is unpublished and stacked on Draft PRs #1 → #2. See [v0.3 fair ground and milestone sound](docs/V03_FAIR_GROUND.md) for the first-pit fix, milestone accents, developer sound A/B (`?sfx=classic`, `/dev/sfx.html`) and open human checks. [v0.2 design and acceptance](docs/V02_ACCEPTANCE.md) and [v0.1 notes](docs/PROTOTYPE.md) are historical. No automatic merge or production deploy.

The independent review is stacked on #4 (full order #1 → #2 → #3 → #4 → review fixes). See [v0.3 independent review](docs/V03_INDEPENDENT_REVIEW.md) for the audio cancellation fix, 193-HOPS evidence, Earth timing comparison and remaining release checks. `npm run check:assets` is a dry run only; `npm run preview:assets` starts a local Workers asset preview on port 8011 and excludes the developer bench. Its compatibility-date override is local only; details are in the review.
