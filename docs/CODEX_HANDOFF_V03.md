# Codex review handoff — HOPPOD v0.3 / 2026-11-01 JST

Orchestrated and implemented by Claude Code. Please review independently: re-run the reproduction steps rather than trusting the summaries.

## Stack and order

```
main f50befb
 └ #1 feat/endless-prototype       01d190e  v0.1 base (Draft)
    └ #2 codex/v02-playable-polish 3cca8ab  v0.2 feel/tests (Draft, human-approved feel)
       └ #3 claude/v03-fair-ground          P0 first-pit fix + P1 milestone sound (Draft)
          └ #4 claude/v03-earthrise         P2 Earth worldview (Draft)
```

Merge strictly in order #1 → #2 → #3 → #4. When one merges, retarget the next PR's base. Never auto-merge to main; no production deploy was made or requested.

## What to read

1. [docs/V03_FAIR_GROUND.md](V03_FAIR_GROUND.md): P0 root cause with numbers, the "screen is the rule" design, course v3 compatibility, P1 sound design, the acceptance table A1–A8, and reproduction steps.
2. [docs/V03_EARTHRISE.md](V03_EARTHRISE.md) (on #4): worldview, rise thresholds, and what was deliberately not added.

## Decisions that deserve a second opinion

| Decision | Alternative considered | Why chosen |
|---|---|---|
| Merge openings < 16px into continuous ground | Widen them by trimming platforms | Trimming can drop platforms below the 106px width that the reachability tests rely on. Merging only adds footing. |
| Keep `INSET = 8`, draw it as a stepped rim | `INSET = 0` | Keeps the v0.2 edge feel that players liked. The rule becomes visible instead of looser. |
| Fixed 40px first pit, intro ends at 720 | Leave the intro to the generator | The first fall teaches the game, so it must be unambiguous in every seed. |
| Course v3, new BEST keys | Keep v2 identity | Geometry changed for seams and the intro. v0.2 was never published, so nothing public breaks. |
| Accents on a separate compressed bus | Route all sound through one compressor | Guarantees the praised landing tone is bit-for-bit the same path. |
| Earth progress by distance, not HOPS | By HOPS | The worldview is about travelling. Distance is also deterministic per route. |

## Commands

```bash
npm ci
npm test
npm run check
npx playwright install chromium
npm run test:browser
```

Expected results: on #3, 27 Node and 13 browser tests pass. On #4, 31 Node and 14 browser tests pass.

Manual reproduction of the original bug: on #2, open `/?mode=free&seed=7` and do nothing. The pod falls at 7 HOPS on ground that looks continuous. On #3 the same URL drops it into a wide black pit.

## Known limits

- Sound taste, phone readability, and Android/X in-app behaviour need a human. Automated tests cover the graph, gain math and pixels only.
- `output/repro/*.mjs` helper scripts are local and git-ignored (the `output/` folder). Their paths are listed in the docs for regenerating screenshots.
- The developer A/B (`?sfx=classic`, `/dev/sfx.html`) is intentionally undocumented in the public UI. `public/.assetsignore` keeps `dev/` out of Cloudflare static assets; this has not been verified with a real `wrangler deploy`.
