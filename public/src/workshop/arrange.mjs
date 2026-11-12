// The finale's rule: the workshop owns chords, tempo, register and who is in
// front; the player leaves where and when sounds happened, how many, and rests.
// A note moves one sixteenth at most and is never swapped for a composed one.
// Pure: no audio, DOM, randomness or clock.
import { PERIOD as BEAT } from '../engine.mjs';

export const STEP = BEAT / 4, BAR = BEAT * 4;
export const PARTS = Object.freeze(['drums', 'tongue', 'keys', 'harp', 'strings', 'wood', 'bellows', 'brass']);
const G = [7, 9, 11, 0, 2, 4, 6];
// Eight bars in G with one borrowed bar, the ache of the wider RAPIPPO songbook.
const CHORDS = Object.freeze([
  { name: 'G', tones: [7, 11, 2], scale: G, root: 43 },
  { name: 'D/F#', tones: [2, 6, 9], scale: G, root: 42 },
  { name: 'Em7', tones: [4, 7, 11, 2], scale: G, root: 40 },
  { name: 'Cmaj7', tones: [0, 4, 7, 11], scale: G, root: 48 },
  { name: 'Am7', tones: [9, 0, 4, 7], scale: G, root: 45 },
  { name: 'Cm6', tones: [0, 3, 7, 9], scale: [0, 2, 3, 5, 7, 9, 11], root: 48 },
  { name: 'G/B', tones: [7, 11, 2], scale: G, root: 47 },
  { name: 'D7', tones: [2, 6, 9, 0], scale: G, root: 50 },
]);
export const chordAtBar = bar => CHORDS[((bar % 8) + 8) % 8];
export const pc = m => ((Math.round(m) % 12) + 12) % 12;
export function nearest(midi, set) {
  let best = midi, gap = 99;
  for (let m = Math.round(midi) - 8; m <= Math.round(midi) + 8; m++) {
    if (!set.includes(pc(m))) continue;
    const g = Math.abs(m - midi);
    if (g < gap) { gap = g; best = m; }
  }
  return best;
}
export const fold = (m, low, high) => { while (m < low) m += 12; while (m >= high) m -= 12; return m; };
export const nextUp = (m, set) => { do m++; while (!set.includes(pc(m))); return m; };
const midiOf = target => Math.round(target);

// ---------- what is heard while playing a station ----------
const beatOfSlot = slot => ((slot % 16) + 16) % 16;
function pitched(part, m, bar, slot) {
  const chord = chordAtBar(bar), inBar = beatOfSlot(slot), strong = inBar % 8 === 0, onBeat = inBar % 4 === 0;
  if (part === 'keys') { const t = fold(m, 60, 84); return nearest(t, strong || Math.abs(nearest(t, chord.tones) - t) <= 1 ? chord.tones : chord.scale); }
  if (part === 'tongue') { const t = fold(m, 67, 84); return nearest(t, strong || Math.abs(nearest(t, chord.tones) - t) <= 1 ? chord.tones : chord.scale); }
  if (part === 'strings') return nearest(fold(m, 55, 67), chord.tones);
  if (part === 'wood') return nearest(m, onBeat ? chord.tones : chord.scale);
  if (part === 'brass') return nearest(fold(m, 50, 70), onBeat ? chord.tones : chord.scale);
  return midiOf(m);
}
export const liveNote = (part, m, beat, phase = 0) => pitched(part, m, Math.floor(beat / 4), (((beat % 4) + 4) % 4) * 4 + Math.round(phase / STEP));
// The key under the hero, as a raw pitch: white keys upward from G2.
const DIATONIC = [0, 2, 4, 5, 7, 9, 11];
export const keyPitch = key => { const k = key + 8; return 43 + 12 * Math.floor(k / 7) + DIATONIC[k % 7]; };
export const STRING_NOTES = Object.freeze([59, 62, 67, 71, 67, 62]);
export const WOOD_MOTIF = Object.freeze([74, 76, 79, 81, 79, 76, 74, 71]);
export const brassPitch = pos => 62 + pos / 16;
export const harpRun = (bar, count) => {
  const chord = chordAtBar(bar), out = []; let m = nearest(67, chord.tones);
  for (let i = 0; i < count && m <= 91; i++) { out.push(m); m = nextUp(m, chord.tones); }
  return out;
};

// ---------- takes ----------
// A station's take keeps the last 4, 8 or 16 of its hops, as a loop.
export function emptyRecording() { return {}; }
export function loopLength(hops) { return hops >= 16 ? 16 : hops >= 8 ? 8 : 4; }
export function makeTake(part, hopBeats, events) {
  const hops = hopBeats.length, len = loopLength(hops), lastBeat = hops ? hopBeats.at(-1) : len - 1, from = lastBeat - len + 1, slots = len * 4;
  const take = { len, events: [] }, seen = new Set();
  for (const e of events) {
    const slot = Math.round((e.t / BEAT - from) * 4);
    if (slot < 0 || slot >= slots + 1) continue;
    const s = ((slot % slots) + slots) % slots, { t, ...rest } = e, item = { s, ...rest };
    const key = part === 'harp' ? `${Math.floor(s / 4)}` : `${s}`;
    if (part !== 'harp' && seen.has(key)) continue;
    seen.add(key); take.events.push(item);
  }
  take.events.sort((a, b) => a.s - b.s);
  return take;
}

// ---------- the form ----------
export const ENTRY = Object.freeze({ drums: 2, tongue: 4, keys: 6, harp: 8, strings: 10, bellows: 11, wood: 12, brass: 14 });
export const FEATURE_BARS = 2, TUTTI_FROM = 16, TUTTI_END = 24, CARD_BAR = 28, BUDGET = 22;
const SPOT_TUTTI = ['wood', 'brass', 'keys', 'tongue'];
const PRIORITY = ['brass', 'wood', 'keys', 'tongue', 'strings', 'bellows', 'harp'];
const LEVEL = { keys: .5, tongue: .5, strings: .36, wood: .5, brass: .5, harp: .42, bellows: .3, drums: .75 };
export function spotlightAt(bar) {
  if (bar >= TUTTI_FROM) return SPOT_TUTTI[Math.floor((bar - TUTTI_FROM) / 2) % SPOT_TUTTI.length];
  return Object.entries(ENTRY).filter(([, b]) => b <= bar && bar < b + FEATURE_BARS).map(([k]) => k)[0] ?? null;
}
const wrap = (bar, entry, len) => { const bars = len / 4; return ((bar - entry) % bars + bars) % bars; };
// What the finale shows as the player's own at this bar: the newest part while the
// band gathers, every part at the full band, and the breath in the tail.
const BY_ENTRY = Object.entries(ENTRY).sort((a, b) => a[1] - b[1]);
export function replayPartAt(bar) {
  if (bar >= TUTTI_END) return 'wood';
  if (bar >= TUTTI_FROM) return 'all';
  return BY_ENTRY.filter(([, b]) => b <= bar).at(-1)?.[0] ?? null;
}
// Where a part's loop stands, rel seconds after the first tick: 0 to 1, the same
// count partBar uses, so a mark lights as its own note sounds.
export function loopFraction(rel, entryBar, len) {
  const period = len * BEAT, into = (rel - entryBar * BAR) % period;
  return ((into + period) % period) / period;
}

// Everything a part plays in this bar, t in seconds from the start of the bar.
function partBar(part, take, bar, entry) {
  const out = [], chord = chordAtBar(bar), inLoop = wrap(bar, entry, take.len);
  const add = (s, midi, dur, extra = {}) => out.push({ part, t: (s - inLoop * 16) * STEP, midi, dur, v: LEVEL[part], by: 'player', slot: s, ...extra });
  const here = take.events.filter(e => Math.floor(e.s / 16) === inLoop);
  if (part === 'drums') for (const e of here) add(e.s, null, .2, { voice: e.voice, v: e.soft ? LEVEL.drums * .65 : LEVEL.drums });
  if (part === 'tongue' || part === 'keys') for (const e of here) add(e.s, pitched(part, e.m, bar, e.s), part === 'keys' ? .6 : .7);
  if (part === 'strings') for (const e of here) add(e.s, pitched('strings', STRING_NOTES[e.i % STRING_NOTES.length], bar, e.s), 1.1);
  if (part === 'brass') for (const e of here) add(e.s, pitched('brass', brassPitch(e.pos), bar, e.s), BEAT / 2 + .02, { glide: true });
  if (part === 'bellows') for (const e of here) { const voices = e.push ? [chord.tones[0], chord.tones.at(-1)] : [chord.tones[1] ?? chord.tones[0]]; for (const p of voices) add(e.s, fold(p + 60, e.push ? 64 : 55, e.push ? 76 : 67), e.push ? .34 : .5); }
  if (part === 'wood') {
    // Too many presses keep the metrically strongest, six a bar.
    const weight = s => s % 8 === 0 ? 4 : s % 4 === 0 ? 3 : s % 2 === 0 ? 2 : 1;
    [...here].sort((a, b) => weight(b.s) - weight(a.s) || a.s - b.s).slice(0, 6).sort((a, b) => a.s - b.s).forEach(e => {
      const m = WOOD_MOTIF[e.s % WOOD_MOTIF.length]; add(e.s, pitched('wood', m, bar, e.s), Math.max(.08, Math.min(e.d ?? .15, BAR)));
    });
  }
  if (part === 'harp') {
    // The crossings of a bar's last hop become a run up the chord. Only the count is the player's.
    for (const e of here) if (e.s % 16 === 12) harpRun(bar, Math.min(e.n, 10)).forEach((m, i) => add(e.s, m, .9, { t: 12 * STEP + i * STEP * .34 }));
  }
  return out;
}
// A player who never pressed still gets a quiet line, marked as the workshop's.
function fillEmpty(bar, active, events) {
  const out = [];
  for (const part of ['wood', 'strings']) {
    if (!active.has(part) || bar % 2 || events.some(e => e.part === part)) continue;
    out.push({ part, t: 0, midi: nearest(part === 'wood' ? 74 : 62, chordAtBar(bar).tones), dur: BAR * .8, v: .16, by: 'workshop', slot: -1 });
  }
  return out;
}
// Seats: a lower-priority note that rubs against a higher one yields to a chord
// tone within a third, or stays out. Drums have no pitch and always keep theirs.
function seat(events, bar) {
  const pitchedNotes = events.filter(e => e.midi != null).sort((a, b) => PRIORITY.indexOf(a.part) - PRIORITY.indexOf(b.part));
  const placed = [], keep = [], chord = chordAtBar(bar);
  for (const e of pitchedNotes) {
    const start = Math.round(e.t / STEP), end = start + Math.max(1, Math.round(Math.min(e.dur, .4) / STEP));
    const rubs = m => placed.some(o => o.part !== e.part && o.s < end && start < o.e && [1, 11].includes(((Math.round(m) - Math.round(o.midi)) % 12 + 12) % 12));
    if (!rubs(e.midi)) { placed.push({ part: e.part, midi: e.midi, s: start, e: end }); keep.push(e); continue; }
    const alt = [nearest(e.midi - 1, chord.tones), nearest(e.midi + 1, chord.tones), nextUp(e.midi, chord.tones)].find(m => !rubs(m));
    if (alt != null && Math.abs(alt - e.midi) <= 4) { placed.push({ part: e.part, midi: alt, s: start, e: end }); keep.push({ ...e, midi: alt }); }
  }
  return [...events.filter(e => e.midi == null), ...keep];
}
// The arrangement decides who is heard in a full bar, never what they played.
function budget(events, spot, limit = BUDGET) {
  if (events.length <= limit) return events;
  const score = e => {
    const s = Math.round(e.t / STEP) % 16, metric = s % 8 === 0 ? 4 : s % 4 === 0 ? 3 : s % 2 === 0 ? 1.5 : 1;
    return metric + (e.part === spot ? 6 : 0) + (e.part === 'drums' ? 2 : 0) - Math.max(0, PRIORITY.indexOf(e.part)) * .1;
  };
  return events.map((e, i) => [e, i]).sort((a, b) => score(b[0]) - score(a[0]) || a[1] - b[1]).slice(0, limit).map(([e]) => e);
}

// The bed belongs to the workshop: pad, root and a high pluck phones can hear.
export function bedBar(bar, level = 1) {
  const chord = chordAtBar(bar), out = [];
  for (const p of chord.tones) out.push({ part: 'pad', t: 0, midi: fold(p + 48, 55, 67), dur: BAR, v: .36 * level, by: 'workshop' });
  out.push({ part: 'bass', t: 0, midi: chord.root, dur: BAR * .5, v: .3 * level, by: 'workshop' });
  out.push({ part: 'bass', t: BAR / 2, midi: chord.root + 12, dur: BAR * .45, v: .22 * level, by: 'workshop' });
  return out;
}
// One bar of the recorded parts. bars: the bar index the loops are counted from.
export function bandBar(recording, bar, { active, spot = null, limit = BUDGET, entry = {} } = {}) {
  let events = [];
  for (const part of PARTS) if (active.has(part) && recording[part]) events.push(...partBar(part, recording[part], bar, entry[part] ?? 0));
  events.push(...fillEmpty(bar, active, events));
  events = budget(seat(events, bar), spot, limit);
  if (spot) events = events.map(e => e.part === spot || bar >= TUTTI_FROM ? e : { ...e, v: e.v * .72 });
  return events.sort((a, b) => a.t - b.t);
}
// Bar n of the finale, counted from the first tick. Never ends: past the card
// the tick and the player's own breath go on until they leave.
export function finaleBar(recording, bar) {
  const active = new Set(PARTS.filter(p => bar >= ENTRY[p] && bar < TUTTI_END));
  if (bar >= TUTTI_END) {
    // The tail: the tick and the player's own breath on one chord, and it goes on.
    const wood = recording.wood ?? { len: 4, events: [] }, home = chordAtBar(0), inLoop = wrap(bar, ENTRY.wood, wood.len);
    const fade = bar < CARD_BAR ? .75 : .6;
    const events = wood.events.filter(e => Math.floor(e.s / 16) === inLoop).map(e => ({
      part: 'wood', t: (e.s - inLoop * 16) * STEP, midi: nearest(WOOD_MOTIF[e.s % WOOD_MOTIF.length], home.tones),
      dur: Math.max(.08, Math.min(e.d ?? .15, 1)), v: LEVEL.wood * fade, by: 'player', slot: e.s,
    }));
    if (bar < CARD_BAR) events.push(...bedBar(bar, .5 * (1 - (bar - TUTTI_END) / (CARD_BAR - TUTTI_END))));
    return events;
  }
  const events = bandBar(recording, bar, { active, spot: spotlightAt(bar), entry: ENTRY });
  if (bar >= 2) events.push(...bedBar(bar, Math.min(1, .55 + bar * .03)));
  if (bar === TUTTI_FROM) events.push({ part: 'crash', t: 0, midi: null, dur: 3, v: .4, by: 'workshop' });
  return events;
}
// Free play: every part, on a loop, with no end.
export function freeBar(recording, bar) {
  const looped = 8 + ((bar % 16) + 16) % 16, full = bar % 16 >= 8;
  const events = bandBar(recording, looped, { active: new Set(PARTS.filter(p => full || bar % 4 < 2 ? true : ['drums', 'keys', 'tongue'].includes(p))), spot: SPOT_TUTTI[Math.floor(bar / 2) % SPOT_TUTTI.length], entry: ENTRY });
  events.push(...bedBar(looped, .85));
  return events;
}

// ---------- a take you can share ----------
// A short address that replays the finale. Untrusted on the way back in: every
// field is checked and clamped, and nothing here is ever executed.
const clamp = (v, low, high) => Math.max(low, Math.min(high, Number.isFinite(+v) ? +v : low));
const VOICES = ['kick', 'snare', 'block'];
export function encodeTake(recording) {
  const pack = {};
  for (const part of PARTS) {
    const take = recording[part]; if (!take) continue;
    pack[part] = [take.len, take.events.map(e => {
      if (part === 'drums') return [e.s, VOICES.indexOf(e.voice), e.soft ? 1 : 0];
      if (part === 'tongue' || part === 'keys') return [e.s, e.m];
      if (part === 'harp') return [e.s, e.n];
      if (part === 'strings') return [e.s, e.i];
      if (part === 'wood') return [e.s, Math.round((e.d ?? .15) * 100)];
      if (part === 'bellows') return [e.s, e.push ? 1 : 0];
      return [e.s, Math.round(e.pos)];
    })];
  }
  return btoa(JSON.stringify(pack)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function decodeTake(text) {
  if (typeof text !== 'string' || text.length > 12000) return null;
  let pack;
  try { pack = JSON.parse(atob(text.replace(/-/g, '+').replace(/_/g, '/'))); } catch { return null; }
  if (!pack || typeof pack !== 'object' || Array.isArray(pack)) return null;
  const out = {};
  for (const part of PARTS) {
    const row = pack[part];
    if (!Array.isArray(row) || !Array.isArray(row[1])) continue;
    const len = [4, 8, 16].includes(row[0]) ? row[0] : 4, slots = len * 4;
    out[part] = { len, events: row[1].slice(0, 200).filter(Array.isArray).map(([s, v, w]) => {
      const e = { s: clamp(Math.round(s), 0, slots - 1) };
      if (part === 'drums') { e.voice = VOICES[clamp(v, 0, 2)]; if (w) e.soft = true; }
      else if (part === 'tongue' || part === 'keys') e.m = clamp(v, 36, 108);
      else if (part === 'harp') e.n = clamp(v, 0, 20);
      else if (part === 'strings') e.i = clamp(Math.round(v), 0, 40);
      else if (part === 'wood') e.d = clamp(v, 2, 400) / 100;
      else if (part === 'bellows') e.push = !!v;
      else e.pos = clamp(v, -170, 170);
      return e;
    }) };
  }
  return Object.keys(out).length ? out : null;
}
// A complete take for developer links and free play without a saved run.
export function demoRecording() {
  const beats = n => Array.from({ length: n }, (_, i) => i);
  return {
    drums: { len: 8, events: beats(8).map(b => ({ s: b * 4, voice: ['kick', 'block', 'snare', 'block', 'kick', 'kick', 'snare', 'block'][b] })) },
    tongue: { len: 8, events: beats(8).map(b => ({ s: b * 4, m: [71, 76, 74, 69, 67, 74, 71, 69][b] })) },
    keys: { len: 16, events: beats(16).map(b => ({ s: b * 4, m: keyPitch(b * 3) })) },
    harp: { len: 8, events: [{ s: 12, n: 6 }, { s: 28, n: 4 }] },
    strings: { len: 8, events: [{ s: 2, i: 0 }, { s: 14, i: 1 }, { s: 18, i: 2 }, { s: 26, i: 3 }] },
    wood: { len: 8, events: [0, 3, 6, 8, 14, 16, 22, 24, 27, 30].map((s, i) => ({ s, d: i % 3 ? .15 : .4 })) },
    bellows: { len: 8, events: beats(8).map(b => ({ s: b * 4, push: b % 3 === 2 })) },
    brass: { len: 8, events: beats(16).map(b => ({ s: b * 2, pos: 48 * Math.sin(b / 2) })) },
  };
}
