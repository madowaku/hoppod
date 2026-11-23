# RAPIPPO: the Sunwise Clock Tower / 陽周りの時計台

**Status:** playable from title to end card, built on 2026-11-07 for the thatgamejam #02 build at the owner's request. Page `public/clocktower.html`, code `public/src/tower/`. The owner played it once on 2026-11-07 (see "Playtest"); every number below comes from scripts and headless Chromium. The earlier experiment it replaces is kept at `public/dev/clocktower-lab.html` ([CLOCK_TOWER_LAB.md](CLOCK_TOWER_LAB.md)).

Play locally: `npm run dev`, then open `http://127.0.0.1:8000/clocktower.html?lang=ja`. `?cp=N` starts at lantern N; `?end=1&gears=7` shows the morning at once.

## Where it sits

Owner, 2026-11-07: 月渡りのラピッポ makes friends, 星明りの楽器工房 makes music, and 陽周りの時計台 is **the stage of fun mechanisms**, about five minutes long. Its story: Rapippo climbs through the mechanisms, becomes the clock's heart, the clock starts, and the morning comes. The name reads as 陽 (sun) going round, and also as ひまわり.

Nothing shared changes: `engine.mjs`, `pod.mjs`, `story/beat.mjs` and `workshop/audio.mjs` are imported read-only. The hop is exactly 0.78s and every touchdown is a beat.

## Rooms

One mechanism a room, each a different reading of the one button. Lanterns save position and gears; a lantern mid-room stands on 250px of plain ground, so returning never needs an instant press.

| Room | Mechanism | What it asks |
|---|---|---|
| 塔のふもと | none | the hop |
| 振り子の回廊 | pendulums, two hops per swing. Long ones (330) sweep the floor; short ones (202) only graze the very top of a hop. A hit knocks the hero off, except in the first quarter of a hop, where the landing has already decided it (owner's playtest, 2026-11-08). The swing grows through the room (owner's playtest, 2026-11-12: the least fair room): the first hangs still, then slow and small (four hops a swing for the long ones; a short one stays at two, since a slow short one lingers at the top of the hop and could leave no way past), then wider and in two after the lantern. The view moves ahead while a pendulum is within 520px, so each is in sight a few hops before it is reached | where you are on which beat |
| 脱進機の歯 | gold and silver teeth take turns standing, one beat each. A run of teeth waits, all up, until the hero steps on it, and ticks from that landing; the first run is one SLOW hop per tooth, so SLOW alone crosses it (owner's playtest, 2026-11-08: arriving on SLOW, the tempo could be wrong from the start). The tooth for the coming landing rises just before it | land on the next tooth every hop |
| ゼンマイ | a coil makes the next hop 1.8 times as long | wide gaps; SLOW still goes far |
| 砂時計 | sand holds one landing: stood on, it crumbles from below; left, it falls | never land twice on one slab: wide slabs need FAST |
| 針の橋 | before each hand, a cog turning backwards: a hop from it is carried back at SLOW's speed, so SLOW hops on the spot and FAST goes on by 165px/s (owner's idea after the second playtest). The cog is 120px, narrower than FAST's 128.7px hop off it, so FAST on four reaches the hand from anywhere on it (Codex review, 2026-11-08). A hand turns a quarter each beat about its pivot and is a bridge only on its beat of four; where it will lie shows as a dashed outline one landing ahead and as a lit strip through the hop that has to reach it. A signal hangs over the pivot (2026-11-11, replacing four equal lamps on a post and under the pivot): three small lamps count the landings in, the third brighter, and one big lamp is lit only for the hop that has to be FAST; the cog's arrows turn forward for that hop, and each step is heard (low, low, higher, a chime). The view moves ahead before a hand | wait on the cog with SLOW, watch the signal, FAST on the big lamp |
| 機械室 | all of them together; three lanterns, and no pendulum after the last sand (owner's playtest, 2026-11-08: too hard) | |
| 鐘楼 | stairs to the bell. The last landing strikes it | the ending cannot be missed |

With a climb saved, the title puts CONTINUE first and the other button reads START OVER; nothing is saved before the first lantern, so a mistaken start loses no saved climb. The workshop does the same, and its shared-song links enter the visitor's own saved run.

Twelve gears hang where the antennas reach at the top of a hop. They are optional; each found one lights an hour on the face at the end.

After three falls at one lantern the mechanisms wait until the next lantern: teeth and hands stay up, sand holds, pendulums go faint and harmless. Gaps stay gaps.

## The morning

The strike flashes and the hero bounces off the bell. Three beats later it is at the hub of the opened clock and hops there on the beat with no input. One minute per hop to midnight; then the hands run sunwise to six while the sky goes from night to morning and the sun rises up the right of the tower. Gears turn in one per beat. Captions: 「ラピッポが、時計の心臓になった」, 「ひと跳びごとに、針が進む」, 「そして、お日さまが回ってきた」. The end card says 「あなたが動かした時計が、朝を連れてきた。」 and the gears found.

## Music

A music-box song in C (C, Am, F, G / C, Em, F, G), original. Each room adds a voice: pad, harp, wood block, bass, keys, tongue drum, strings, then everything. The morning builds a voice a bar, rings the bell again as the sun arrives, and thins to pad and harp on the card.

## What was measured

All from the model with scripted input, **not human play**.

| Check | Result |
|---|---|
| Clean climb (scripted calm player) | 170 hops, about 2m15s; the morning adds about 30s |
| Every lantern reaches the next, on each of the four beats | yes (unit test) |
| Holding SLOW or FAST throughout any mechanism room | fails in every one (unit test) |
| Every gear reachable from its room | yes (unit test) |
| Real key events, headless Chromium, title to card | no fall, no console errors (browser test) |

Five minutes assumes some falls and the morning; it has not been timed with a person.

## Playtest (owner, 2026-11-07)

Music and ending liked; the mainspring feels good; jumping over the long pendulums is fun. Changed from it: short pendulums shortened (236 to 202; with random input they now cause about 15% of failures, the long ones about 62%), sand crumbles visibly from below, and the hands got the lamps and the camera lead, because without stopping the timing could not be planned with the hand off screen.

## Not done / to check in play

- The cog before each hand has not been played. The owner found the hands still hard after the lamps: without a way to stop, FAST could not be judged with the far side off screen.
- Sound not heard by the author (the tooling cannot listen).
- No real phone yet.
- The difficulty of the machine room is untuned.
