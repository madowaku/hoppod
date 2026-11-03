// STORY music: original parts synthesized with Web Audio; no recordings.
// One grid step is a sixteenth of the 0.78s beat. Notes are scheduled a
// little ahead on the AudioContext clock; each friend's part has its own gain
// so distance and signal fade it continuously without touching the timing.
import { BEAT } from './beat.mjs';

export const STEP = BEAT / 4;
export const PARTS = Object.freeze(['tick', 'bell', 'bass', 'perc', 'pad', 'sparkle']);
const hz = m => 440 * 2 ** ((m - 69) / 12);

// "Wind-up, waking, widening, flight." G major with a borrowed C minor
// (the ache) in a 16-bar form, four phrases of four bars, one bar = 4 beats.
// Each chord: bass root (MIDI) and the pad's four voices.
const CHORDS = {
  G: { root: 43, pad: [59, 62, 67, 69] },     // add9: warm, open
  Em7: { root: 40, pad: [55, 59, 62, 66] },
  Cmaj7: { root: 48, pad: [55, 59, 64, 67] },
  D: { root: 50, pad: [54, 57, 62, 66] },
  Bm7: { root: 47, pad: [54, 57, 62, 66] },
  Cm6: { root: 48, pad: [55, 57, 60, 63] },   // E flat: warmth with an ache
  GB: { root: 47, pad: [55, 59, 62, 67] },    // G over B
  Am7: { root: 45, pad: [55, 57, 60, 64] },
};
export const FORM = Object.freeze([
  'G', 'Em7', 'Cmaj7', 'D',
  'G', 'Bm7', 'Cmaj7', 'Cm6',
  'Em7', 'Bm7', 'Cmaj7', 'GB',
  'Am7', 'Cm6', 'G', 'D',
]);
// Blue's melody, eight eighth-note slots per bar: a note, '-' to hold, '.'
// to rest. It breathes: every phrase ends in a held note or silence.
const N = { A4: 69, B4: 71, C5: 72, D5: 74, Eb5: 75, E5: 76, Fs5: 78, G5: 79, A5: 81, B5: 83, C6: 84 };
const MELODY = [
  'D5 - - B4 D5 - G5 -', 'Fs5 - E5 - D5 - - .', 'E5 - - G5 B5 - A5 G5', 'Fs5 - - - . . A4 B4',
  'D5 - - B4 D5 - G5 -', 'A5 - Fs5 - D5 - - .', 'E5 - G5 - B5 - C6 -', 'B5 - A5 - G5 - Eb5 -',
  'G5 - - - . . Fs5 G5', 'A5 - - Fs5 D5 - . .', 'E5 - - - G5 - E5 -', 'D5 - - - . . . .',
  'C5 - E5 - A5 - G5 -', 'Eb5 - - - D5 - C5 -', 'B4 - - D5 G5 - - -', '. . . . A4 - B4 -',
].map(bar => {
  const slots = bar.split(' '), out = [];
  slots.forEach((t, i) => {
    if (!N[t]) return;
    let len = 1; while (slots[i + len] === '-') len++;
    out.push({ slot: i, m: N[t], len });
  });
  return out;
});
export const songBar = beat => FORM[((Math.floor(beat / 4) % 16) + 16) % 16];
export const chordAt = beat => CHORDS[songBar(beat)];

// Ending gates relative to the dock beat D. D is silent; on D+1, the beat
// the next touchdown would have been, blue starts the song from its first
// bar; green joins on the next downbeat, red on the one after, and the pad
// (the whole ensemble) completes the sound a bar before the launch.
export const ENDING = Object.freeze({ bell: 1, bass: 5, perc: 9, pad: 13, launch: 17, turn: 21, away: 25, lights: 57, black: 63, title: 65, card: 73 });

// Notes for grid step n. song = { tick(beat) -> bool, dockBeat|null,
// parts: Set, origin: beat where the song's bar 1 falls (blue's assembly) }.
export function notesAt(n, song) {
  const beat = Math.floor(n / 4), sub = n % 4, out = [];
  const docked = song.dockBeat !== null && beat >= song.dockBeat;
  const after = docked ? beat - song.dockBeat : -1;
  const on = part => docked ? after >= ENDING[part] : song.parts.has(part);
  // The dock touchdown itself still ticks; every beat after it is the friends'.
  if ((!docked || after === 0) && sub === 0 && song.tick(beat)) out.push({ part: 'tick', kind: 'tick', f: beat % 2 ? 1760 : 2350, d: .05, v: 1 });
  if (!docked && sub === 2 && song.tick(beat)) out.push({ part: 'tick', kind: 'wind', f: 3100, d: .03, v: .35 });
  // Song position: from D+1 the ending starts the song over at bar 1.
  const b = beat - (docked ? song.dockBeat + ENDING.bell : song.origin ?? 0);
  if (b < 0) return out;
  const barN = Math.floor(b / 4), inBar = b % 4, chord = chordAt(b), loop = Math.floor(barN / 16), phrase = Math.floor(barN / 4) % 4;
  if (on('bell')) {
    // On the second pass through the first half the melody thins to its
    // downbeats: the same tune, with more air. While green is away it thins
    // everywhere: the tune misses its friend.
    const sparse = (loop % 2 === 1 && phrase < 2) || (!docked && song.apart);
    for (const note of MELODY[barN % 16]) if (note.slot === inBar * 2 + sub / 2 && (!sparse || note.slot % 2 === 0)) {
      out.push({ part: 'bell', kind: 'bell', f: hz(note.m), d: Math.min(2.4, .5 + note.len * BEAT / 2), v: note.slot % 2 ? .75 : 1 });
    }
    // The hand-off: a low G under blue's first note.
    if (docked && b === 0 && sub === 0) out.push({ part: 'bell', kind: 'bell', f: hz(55), d: 2.4, v: .9 });
  }
  if (on('bass') && sub % 2 === 0) {
    const r = chord.root, endOfPhrase = barN % 4 === 3;
    if (inBar === 0 && sub === 0) out.push({ part: 'bass', kind: 'bass', f: hz(r), d: 1.4, v: 1 });
    if (inBar === 2 && sub === 0) out.push({ part: 'bass', kind: 'bass', f: hz(r + 7), d: .7, v: .7 });
    if (inBar === 3 && sub === 2) {
      // Phrase ends walk up into the next root by a semitone.
      const next = chordAt(b + 1).root;
      out.push({ part: 'bass', kind: 'bass', f: hz(endOfPhrase ? next - 1 : r + 12), d: .3, v: endOfPhrase ? .75 : .45 });
    }
  }
  if (on('perc')) {
    const fill = barN % 4 === 3 && inBar === 3;
    if (inBar === 0 && sub === 0) out.push({ part: 'perc', kind: 'thump', f: 90, d: .25, v: 1 });
    if (inBar === 2 && sub === 2 && barN % 2 === 1) out.push({ part: 'perc', kind: 'thump', f: 80, d: .2, v: .7 });
    if ((inBar === 1 || inBar === 3) && sub === 0 && !fill) out.push({ part: 'perc', kind: 'wood', f: 820, d: .08, v: .8 });
    if (fill) out.push({ part: 'perc', kind: 'wood', f: 700 + sub * 120, d: .06, v: .55 + sub * .1 });
    if (sub === 2 && !fill) out.push({ part: 'perc', kind: 'shaker', f: 6000, d: .05, v: inBar % 2 ? .6 : .4 });
    if (sub === 3 && inBar === 1) out.push({ part: 'perc', kind: 'shaker', f: 7000, d: .03, v: .25 });
  }
  // The pad is the four of them together: it only sounds once everyone is.
  if (on('pad') && inBar === 0 && sub === 0) for (const m of chord.pad) out.push({ part: 'pad', kind: 'pad', f: hz(m), d: BEAT * 4 + .6, v: .8 });
  // Seen from the rocket: high, sparse glints in the current chord.
  if (song.parts.has('sparkle') && (n * 7) % 5 === 0) {
    const tones = chord.pad, m = tones[(n * 3) % tones.length] + 24;
    out.push({ part: 'sparkle', kind: 'glint', f: hz(m), d: 2.2, v: .5 });
  }
  return out;
}

// One-shot story cues: [delay s, frequency Hz, decay s, peak].
const CUES = {
  collect: [[0, 1047, .1, .05], [.06, 1568, .16, .045]],
  assemble: [[0, 1319, .08, .05], [.09, 1760, .24, .05], [.2, 2637, .5, .03]],
  join: [[0, 784, .12, .05], [.1, 1175, .3, .045]],
  switch: [[0, 392, .1, .06], [.08, 587, .1, .05], [.16, 784, .35, .05]],
  relink: [[0, 523, .1, .04], [.08, 784, .12, .045], [.16, 1047, .3, .045]],
  socket: [[0, 1568, .06, .025], [.08, 2093, .12, .02]],
  notice: [[0, 880, .08, .04], [.14, 1175, .16, .04]],
  rescue: [[0, 587, .1, .045], [.05, 880, .1, .045], [.1, 1319, .3, .04]],
  pickup: [[0, 523, .1, .045], [.08, 784, .12, .05], [.16, 1047, .2, .05], [.3, 1568, .4, .03]],
  reunion: [[0, 784, .2, .05], [.1, 988, .2, .05], [.2, 1175, .3, .05], [.34, 1568, .8, .04]],
  station: [[0, 1175, .15, .045], [.09, 1568, .4, .04]],
  dock: [[0, 196, .3, .09], [.02, 98, .5, .08]],
  fall: [[0, 330, .3, .06], [.12, 220, .4, .05]],
  respawn: [[0, 659, .08, .04], [.07, 988, .2, .035]],
};

export function createStoryAudio() {
  let ctx = null, master, muffle, buses = {}, tones = {}, noise, muted = false;
  const voices = new Set();
  const build = () => {
    // Output: mute (master) → make-up gain for phone speakers → a gentle
    // limiter so the full ensemble and the launch never clip.
    const loud = ctx.createGain(), limit = ctx.createDynamicsCompressor();
    loud.gain.value = 2; limit.threshold.value = -8; limit.knee.value = 6; limit.ratio.value = 6; limit.attack.value = .004; limit.release.value = .2;
    master = ctx.createGain(); master.connect(loud); loud.connect(limit); limit.connect(ctx.destination);
    master.gain.value = muted ? 0 : 1;
    // Darkness muffles only the music parts; cues and the tick stay clear.
    muffle = ctx.createBiquadFilter(); muffle.type = 'lowpass'; muffle.frequency.value = 12000; muffle.Q.value = .4;
    const music = ctx.createGain(); music.gain.value = .9; music.connect(muffle); muffle.connect(master);
    for (const part of PARTS) {
      const g = ctx.createGain(); g.gain.value = 0; buses[part] = g;
      if (part === 'tick') { g.connect(master); continue; }
      if (part === 'sparkle') {
        // The glints ring out into a long echo: space opening up.
        g.connect(master); const echo = ctx.createDelay(2), back = ctx.createGain(), wet = ctx.createGain();
        echo.delayTime.value = BEAT * .75; back.gain.value = .45; wet.gain.value = .5;
        g.connect(echo); echo.connect(back); back.connect(echo); echo.connect(wet); wet.connect(master); continue;
      }
      // A friend's own tone filter: far away it thins out like a weak radio.
      const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 12000; tone.Q.value = .7;
      g.connect(tone); tone.connect(music); tones[part] = tone;
      if (part === 'bell') {
        // A dotted-eighth echo gives blue's bell room to ring.
        const echo = ctx.createDelay(1), back = ctx.createGain(), wet = ctx.createGain();
        echo.delayTime.value = BEAT * .75; back.gain.value = .3; wet.gain.value = .22;
        tone.connect(echo); echo.connect(back); back.connect(echo); echo.connect(wet); wet.connect(music);
      }
    }
    buses.cue = ctx.createGain(); buses.cue.gain.value = 1; buses.cue.connect(master);
    noise = ctx.createBuffer(1, ctx.sampleRate * .5, ctx.sampleRate);
    const data = noise.getChannelData(0);
    let seed = 7; for (let i = 0; i < data.length; i++) { seed = (seed * 16807) % 2147483647; data[i] = seed / 1073741823.5 - 1; }
  };
  const track = (node, gain, at) => {
    const v = { node, gain, at }; voices.add(v);
    node.onended = () => { voices.delete(v); node.disconnect(); gain.disconnect(); };
  };
  const envelope = (g, at, peak, decay, attack = .004) => {
    // A new gain starts at 1; silence it first, or the sample before `at`
    // leaks through at full level as a click.
    g.gain.value = 0; g.gain.setValueAtTime(.0001, at); g.gain.exponentialRampToValueAtTime(Math.max(.0002, peak), at + attack);
    g.gain.exponentialRampToValueAtTime(.0001, at + decay);
  };
  const tone = (bus, type, f, at, decay, peak, glide = 0, attack = .004) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, at);
    if (glide) o.frequency.exponentialRampToValueAtTime(f * glide, at + decay);
    envelope(g, at, peak, decay, attack); o.connect(g); g.connect(bus); o.start(at); o.stop(at + decay + .05); track(o, g, at);
  };
  const hiss = (bus, f, at, decay, peak, type = 'highpass') => {
    const s = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), g = ctx.createGain();
    // The noise buffer loops, so long sweeps (the launch rumble) never cut out.
    s.buffer = noise; s.loop = true; filter.type = type; filter.frequency.value = f; filter.Q.value = type === 'bandpass' ? 4 : .7;
    envelope(g, at, peak, decay, .002); s.connect(filter); filter.connect(g); g.connect(bus);
    s.start(at, (at * 7.3) % .4); s.stop(at + decay + .05); track(s, g, at);
  };
  const voice = (note, at) => {
    const bus = buses[note.part], v = note.v;
    if (note.kind === 'tick') { hiss(bus, 4000, at, .035, .09 * v); tone(bus, 'square', note.f, at, .03, .025 * v); }
    else if (note.kind === 'wind') hiss(bus, note.f, at, note.d, .03 * v, 'bandpass');
    else if (note.kind === 'bell') { tone(bus, 'sine', note.f, at, note.d, .1 * v); tone(bus, 'sine', note.f * 2.76, at, note.d * .25, .02 * v); tone(bus, 'triangle', note.f * .5, at, note.d * .6, .015 * v, 0, .02); }
    else if (note.kind === 'bass') {
      tone(bus, 'triangle', note.f, at, note.d, .13 * v, 0, .012); tone(bus, 'sine', note.f / 2, at, note.d, .07 * v, 0, .012);
      // The same line plucked two octaves up: phone speakers cannot play the
      // bass itself, so this is the green a phone hears. A far green's radio
      // filter (down to 350Hz) takes it away first.
      tone(bus, 'triangle', note.f * 4, at, Math.min(.5, note.d * .5), .12 * v, 0, .006); tone(bus, 'triangle', note.f * 2, at, Math.min(.35, note.d * .4), .05 * v, 0, .006);
    }
    else if (note.kind === 'pad') { tone(bus, 'sine', note.f, at, note.d, .018 * v, 0, .5); tone(bus, 'triangle', note.f * 1.003, at, note.d, .008 * v, 0, .7); }
    else if (note.kind === 'glint') { tone(bus, 'sine', note.f, at, note.d, .03 * v); tone(bus, 'sine', note.f * 2.01, at, note.d * .4, .008 * v); }
    else if (note.kind === 'thump') tone(bus, 'sine', note.f, at, note.d, .12 * v, .5);
    else if (note.kind === 'wood') { tone(bus, 'triangle', note.f, at, note.d, .05 * v); hiss(bus, 1800, at, .03, .03 * v, 'bandpass'); }
    else if (note.kind === 'shaker') hiss(bus, note.f, at, note.d, .025 * v);
  };
  return {
    unlock() {
      try {
        if (!ctx) { ctx = new (globalThis.AudioContext || globalThis.webkitAudioContext)({ latencyHint: 'interactive' }); build(); }
        if (ctx.state !== 'running') ctx.resume().catch(() => {});
      } catch { ctx = null; /* the beat clock falls back to performance time */ }
    },
    get context() { return ctx; },
    get running() { return !!ctx && ctx.state === 'running'; },
    get muted() { return muted; },
    // Muting silences the master only; the context and the beat keep running.
    setMuted(value) { muted = value; if (ctx) master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, .02); },
    // levels: part → gain; clarity: part → 0 (radio-thin) … 1 (clear).
    mix(levels, muffleAmount = 0, clarity = {}, at = null) {
      if (!ctx) return;
      const t = at ?? ctx.currentTime;
      for (const part of PARTS) buses[part].gain.setTargetAtTime(levels[part] || 0, t, .12);
      for (const [part, tone] of Object.entries(tones)) tone.frequency.setTargetAtTime(350 * Math.pow(12000 / 350, Math.max(0, Math.min(1, clarity[part] ?? 1))), t, .2);
      muffle.frequency.setTargetAtTime(12000 * Math.pow(500 / 12000, Math.max(0, Math.min(1, muffleAmount))), t, .25);
    },
    note(note, at) { if (ctx) voice(note, at); },
    cue(name, at = null) {
      if (!ctx || ctx.state !== 'running') return;
      const start = at ?? ctx.currentTime + .005;
      for (const [delay, f, decay, peak] of CUES[name] || []) tone(buses.cue, name === 'dock' || name === 'fall' ? 'triangle' : 'sine', f, start + delay, decay, peak, name === 'fall' ? .5 : 0);
      if (name === 'dock') hiss(buses.cue, 900, start, .25, .06, 'bandpass');
      // Out of the dark: a slow, wide chord under the boot chime.
      if (name === 'assemble') for (const [i, f] of [196, 293.66, 392, 493.88, 587.33].entries()) tone(buses.cue, 'sine', f, start + .25 + i * .05, 4.5, .022, 0, .9);
    },
    // Launch: swell for 1.5s, hold, then fade out over the last 2s.
    rumble(at, seconds) {
      if (!ctx) return;
      const s = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), g = ctx.createGain(), o = ctx.createOscillator(), og = ctx.createGain();
      s.buffer = noise; s.loop = true; filter.type = 'lowpass'; filter.frequency.value = 160;
      o.type = 'sawtooth'; o.frequency.setValueAtTime(55, at); o.frequency.linearRampToValueAtTime(90, at + seconds);
      for (const [gain, peak] of [[g, .12], [og, .018]]) {
        gain.gain.value = 0; gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(peak, at + 1.5);
        gain.gain.setValueAtTime(peak, at + seconds - 2); gain.gain.linearRampToValueAtTime(0, at + seconds);
      }
      s.connect(filter); filter.connect(g); g.connect(buses.cue); o.connect(og); og.connect(buses.cue);
      s.start(at); s.stop(at + seconds + .05); o.start(at); o.stop(at + seconds + .05);
      track(s, g, at); track(o, og, at);
    },
    // Read-only snapshot for tests.
    debug() {
      if (!ctx) return null;
      const t = ctx.currentTime;
      return { state: ctx.state, master: master.gain.value, voices: voices.size, future: [...voices].filter(v => v.at > t).length,
        baseLatency: ctx.baseLatency ?? null, outputLatency: ctx.outputLatency ?? null, sampleRate: ctx.sampleRate,
        levels: Object.fromEntries(PARTS.map(part => [part, buses[part].gain.value])), clarity: Object.fromEntries(Object.entries(tones).map(([part, t]) => [part, t.frequency.value])) };
    },
    // Drop every note not yet started (pause, restart); sounding ones fade.
    cancel() {
      if (!ctx) return;
      const t = ctx.currentTime;
      for (const v of voices) {
        v.gain.gain.cancelScheduledValues(t);
        v.gain.gain.setValueAtTime(v.at > t ? 0 : Math.max(.0001, v.gain.gain.value), t);
        v.gain.gain.linearRampToValueAtTime(0, t + .01);
        try { v.node.stop(t + .02); } catch { /* already stopped */ }
      }
    },
  };
}
