# RAPIPPO v0.4-E: clarity and lightweight settings (Draft)

Stacked on PR #11 (three-part blue POD assembly). Human acceptance: the blue POD is lovable and collecting its parts is fun. A visual gold beacon that has no purpose now competes with the meaningful blue parts. Players also hear a sound at each 10 HOPS without understanding it.

## One guiding rule
**Show less, explain at the moment of meaning.** No persistent landing marker, audio waveform or score graph is added. Keep Earth and lunar sky visible.

## Changes
- Retire gold beacons from the engine and renderer entirely. No secondary collectibles. The parts generator retains the existing reserved fifth hop to preserve existing seeded part locations; the land geometry and seeded daily content are unchanged. COURSE_VERSION remains 4. The obsolete `beacons` counter, event and lists are removed from the run state (not used for HOPS/BEST).
- Every 10 HOPS still plays the **existing** musical accent unchanged. A brief small in-canvas notice names the achievement, e.g. `10 HOPS! ♪` / `10 HOPS 達成 ♪`, for 1.35s; the start screen explains that every ten HOPS earns a little sound. At 50 and 100 HOPS the tiered music remains as before. No extra notes or changed volume.
- Score/BEST remain at the top; BEST visually updates while the run continues if the current HOPS exceed the stored record. A one-time `NEW BEST!` / `自己ベスト更新！` chip marks the crossing. The record is **only persisted at game over** (existing behavior).
- English and Japanese switch in place via a small button below the viewport. ~~Browser language defaults Japanese on ja-* and English otherwise;~~ *Superseded on 2026-11-03 (STORY release, see `STORY_JAM02.md`): the browser language is no longer consulted; the first visit is English.* The explicit `?lang=ja|en` override and the saved selection take precedence. Locale is display-only, never part of the canonical shared replay URL, DAILY salt, terrain, BEST key, score or collision.
- Sound ON/OFF remains a single control with localized label and pressed state, now remembers its choice in localStorage; a stored muted state does not instantiate AudioContext until user gesture. The toggle still cancels active and scheduled voices when muting.
- Result text and saved PNG's Earth/crew labels use the selected language; the PNG filename and hashtag still use RAPIPPO. X share text is localized, but the URL/seed stays exact.

## Review and playtest

1. Watch 10, 50 and 100 HOPS. Does the short achievement label explain the musical accent without drawing attention from the sky?
2. Check the moment the previous BEST is beaten. The visible BEST rises live but storage is written only on death. Does that feel clear?
3. Toggle 日本語 / EN while playing, on a pause and on a result. It must not reset the run, return to the title screen, interrupt input or corrupt a replay link.
4. Toggle SOUND OFF then reload and retry; ensure no bells, pickups, milestone chord or scheduled notes remain audible. SOUND ON returns on gesture.
5. At 320px Android-style width, the overlay should fit in both languages. Check Japanese glyphs in score PNG and the ability to attach it to X manually.
6. Verify the old v4 terrains, part layout, BEST namespaces, no-marker experience, and all audio tests remain valid. QA and human Android listening still required.

**No merge or deploy** without independent review. This PR intentionally does not add music layers, companions beyond blue, a new score mode, or harder terrain.
