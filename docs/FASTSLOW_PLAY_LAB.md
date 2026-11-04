# RAPIPPO FAST/SLOW PLAY LAB (experiment only)

**Branch:** experiment/fastslow-play-lab, branched from main 53b6642.
**Entry:** /dev/fastslow-lab.html (served from public/).
**Do not merge into the STORY jam PR or production.** No change to existing FREE RUN, seed/version, STORY, build, or core engine. The lab imports only the core constants PERIOD/SLOW_SPEED/FAST_SPEED/INSET.

## The research question

Can a continuously bouncing character controlled only by **hold FAST / release SLOW** support different kinds of enjoyment *without adding another button*?

Players can change speed within a hop. A touchdown after 0.78 s can travel about 82–211 px, continuously, not just in two fixed leaps.

| Lab | Experience to test | Rule | What to observe |
| --- | --- | --- | --- |
| A · Precision | “One more try, I can hit it exactly” | Target dots at platform centers; ±12 px is PERFECT | Number of retries, PERFECT count, whether misses feel legible |
| B · Shortcut | “I discovered a faster route” | Alternate near/far landing routes; fewer hops is faster | Hop count, repeated attempts to skip platforms, whether risk feels worth it |
| C · Discovery | “Now I understand the world!” | An antenna activates only when landed on in x=300–332, creating two bridge sections | Whether the signal-post clue is noticed, the moment of realization, whether replay becomes easier |

Each course is a **micro-test**, intentionally shorter than a finished 20–30-second stage. Do not optimize difficulty before hands-on play.

## Running without changing existing game

From the repository root:

    python -m http.server 8000 --directory public

Open http://localhost:8000/dev/fastslow-lab.html.

Play with the HOLD » FAST button or Space key; release for SLOW. Start/Retry button or R restarts. Choose A/B/C with the tabs. The experiment stores no data and cannot change your existing BESTs or DAILY seeds.

## Success/failure criteria

- **A:** Someone voluntarily retries to improve PERFECT even *after* finishing. A low PERFECT count must feel improvable rather than arbitrary.
- **B:** The player finds at least two credible routes and understands that fewer hops = less time. They try a shortcut without being told the exact input pattern.
- **C:** The player sees the antenna-to-bridge visual link, figures out that *landing* matters, and can explain the rule in one sentence afterwards.
- **Shared:** The player can explain HOLD vs RELEASE in under a minute and can tell why a failure occurred.

### Suggested playtest protocol

1. Show only the control prompt. Play A, B, C once each. No hints.
2. For each, ask: “What were you trying to accomplish?”, “Why did you fall?”, “Would you retry?”
3. Offer two minutes of free retries, noting which challenge they choose.
4. Ask which was most fun and which had the clearest cause/effect. Do not count a forced tutorial clear as evidence of replay appeal.

## Engineering limits / next tests

- Experimental static levels and a simplified renderer, **not** production terrain generation.
- No real-time audio synchronization, replay encoding, touch Android QA, accessibility audit, or saved scores.
- The real game core's timestamped input/deterministic simulation needs separate testing before promotion.
- The current UI caps huge frame deltas to 50 ms, enough to avoid unexpected time jumps in a prototype but not a production pause/resume solution.
- Test physical routes, minimum-hop count and C's mandatory relay activation before promoting any mechanic.
- A and B need tests that verify multiple satisfying strategies; C must not become a blind-search puzzle.
- In production, FREE terrain course version and old DAILY/replay URLs must stay compatible, or a new course version is required.
- Existing jam candidate PR #16 should remain isolated until after submission.

## Evaluation and next design decision

Do **not** automatically promote all three mechanics. Keep only the experiments that create a distinct reason to retry. If a stage can be solved trivially by permanent FAST, redesign the *choice*, not just the gap width. The north star is “simple control, surprising decisions.”