# HOPPOD v0.1 / independent playable prototype

Status: Draft PR only, not deployed.

## Identity
- Title: HOPPOD; slogan: ONE MORE HOP!
- Character: concept C, an original retro bouncing space capsule with two rabbit-ear antennas, dark face-screen with two yellow pixel eyes and a spring base. It is a machine-shaped mascot, not a realistic rabbit or anime girl.
- Source: mechanics derived from https://github.com/madowaku/hopscroll ; 0.78s fixed auto-hop, 105/270 units/s SLOW/FAST, landing prediction. New HOPPOD code is written separately and tested separately.
- Product: lightweight, language-light, social-friendly endless high-score browser game. Daily course seeded by date in JST; shareable free course seeded by URL.

## Mechanics
- Hold any part of the game canvas or the HOLD button for FAST; release for SLOW. Space on desktop.
- Landing on a platform increments HOPS; missing ends the run. Beacons are optional and count separately.
- Terrain is generated from short referenceable SLOW/FAST motifs, every seed has a traversable route. It remains possible to fail by diverging from that route. Do not call it unconditionally safe or trivially fair.
- Platforms before/behind camera are trimmed. There is no stage completion or checkpoint.
- Press START/TRY AGAIN to retry the same course. FREE RUN selects a new seed.
- The preview landing ring assumes the current button state will continue until the end of the hop; it updates when the input changes.
- Backgrounding pauses and clears input. Return requires RESUME with SLOW.

## Share and release
- POST TO X opens an X post composer with HOPS, hashtag and replayable URL. It cannot attach the PNG automatically.
- SAVE SCORE PNG creates a local score card; the user may attach it manually.
- Best is saved per daily date (or free runs) in localStorage, with in-memory fallback.
- No cloud leaderboard, analytics, login, or external gameplay calls.
- Site targets Cloudflare Workers Static Assets, but this PR DOES NOT deploy it.
- First release gates: actual Android touch, X in-app browser, narrow viewports, audio policy, accessible controls, human gameplay, privacy/AI attribution, OGP PNG, correct share links.
- Art is temporary original Canvas shapes, not the generated concept sheet used as a shipped sprite. Assess 24×24/32×32 pixel artwork separately.

## Run
From repository root:
python -m http.server 8000 --directory public
Open http://localhost:8000/?mode=daily

Run tests:
node --test tests/*.test.mjs

After human acceptance, Cloudflare Workers Static Assets can point at public/ via wrangler.jsonc. Do not enable production auto-deploy without review.
