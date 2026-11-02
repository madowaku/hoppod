// STORY music: original parts synthesized with Web Audio; no recordings.
// One grid step is a sixteenth of the 0.78s beat. Notes are scheduled a
// little ahead on the AudioContext clock; each friend's part has its own gain
// so distance and signal fade it continuously without touching the timing.
import { BEAT } from './beat.mjs';

export const STEP = BEAT / 4;
export const PARTS = Object.freeze(['tick', 'bell', 'bass', 'perc', 'sparkle']);
// G major, four bars of four beats: G – Em – C – D. Frequencies in Hz.
const NOTE = { D3: 146.83, E3: 164.81, G2: 98, A2: 110, B2: 123.47, C3: 130.81, Fs3: 185, G3: 196,
  B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, Fs5: 739.99, G5: 783.99, A5: 880, B5: 987.77, C6: 1046.5, D6: 1174.66, E6: 1318.51, G6: 1567.98 };
const PROGRESSION = [
  { bass: [NOTE.G2, NOTE.D3], tones: [NOTE.G5, NOTE.B5, NOTE.D6, NOTE.G6] },
  { bass: [NOTE.E3, NOTE.B2], tones: [NOTE.E5, NOTE.G5, NOTE.B5, NOTE.E6] },
  { bass: [NOTE.C3, NOTE.G3], tones: [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6] },
  { bass: [NOTE.D3, NOTE.A2], tones: [NOTE.D5, NOTE.Fs5, NOTE.A5, NOTE.D6] },
];
const ARP = [0, 2, 1, 2, 0, 3, 1, 2];
const SPARKLE = [NOTE.D6, NOTE.E6, NOTE.G6, NOTE.B5 * 2, NOTE.D6 * 2];
export const chordAt = beat => PROGRESSION[Math.floor(beat / 4) % 4];

// Ending gates relative to the dock beat D: silence on D, the blue bell on
// D+1 where the next touchdown would have been, then bass, then percussion.
export const ENDING = Object.freeze({ bell: 1, bass: 4, perc: 8, launch: 16, turn: 20, away: 24, lights: 56, black: 62, title: 64, card: 72 });

// Notes for grid step n. song = { tick(beat) → bool, dockBeat|null, parts:Set }.
export function notesAt(n, song) {
  const beat = Math.floor(n / 4), sub = n % 4, bar = beat % 4, out = [];
  const docked = song.dockBeat !== null && beat >= song.dockBeat;
  const after = docked ? beat - song.dockBeat : -1;
  const on = part => docked ? after >= ENDING[part] : song.parts.has(part);
  // The dock touchdown itself still ticks; every beat after it is the friends'.
  if ((!docked || after === 0) && sub === 0 && song.tick(beat)) out.push({ part: 'tick', kind: 'tick', f: beat % 2 ? 1760 : 2350, d: .05, v: 1 });
  if (!docked && sub === 2 && song.tick(beat)) out.push({ part: 'tick', kind: 'wind', f: 3100, d: .03, v: .35 });
  const chord = chordAt(beat);
  if (on('bell') && sub % 2 === 0) {
    const i = ARP[(bar * 2 + sub / 2) % ARP.length];
    out.push({ part: 'bell', kind: 'bell', f: chord.tones[i], d: .9, v: sub === 0 ? 1 : .7 });
  }
  if (on('bass')) {
    if (bar === 0 && sub === 0) out.push({ part: 'bass', kind: 'bass', f: chord.bass[0], d: 1.5, v: 1 });
    if (bar === 2 && sub === 0) out.push({ part: 'bass', kind: 'bass', f: chord.bass[1], d: .9, v: .8 });
    if (bar === 3 && sub === 2) out.push({ part: 'bass', kind: 'bass', f: chord.bass[0] * 2, d: .3, v: .5 });
  }
  if (on('perc')) {
    if ((bar === 0 || bar === 2) && sub === 0) out.push({ part: 'perc', kind: 'thump', f: 90, d: .25, v: 1 });
    if ((bar === 1 || bar === 3) && sub === 0) out.push({ part: 'perc', kind: 'wood', f: 820, d: .08, v: .8 });
    if (sub === 2) out.push({ part: 'perc', kind: 'shaker', f: 6000, d: .05, v: .5 });
  }
  if (song.parts.has('sparkle') && (n * 7) % 5 === 0) out.push({ part: 'sparkle', kind: 'bell', f: SPARKLE[(n * 3) % SPARKLE.length], d: 1.6, v: .5 });
  return out;
}

// One-shot story cues: [delay s, frequency Hz, decay s, peak].
const CUES = {
  collect: [[0, 1047, .1, .05], [.06, 1568, .16, .045]],
  assemble: [[0, 1319, .08, .05], [.09, 1760, .24, .05], [.2, 2637, .5, .03]],
  join: [[0, 784, .12, .05], [.1, 1175, .3, .045]],
  switch: [[0, 392, .1, .06], [.08, 587, .1, .05], [.16, 784, .35, .05]],
  strand: [[0, 659, .12, .045], [.1, 523, .16, .04], [.22, 392, .5, .035]],
  relink: [[0, 523, .1, .04], [.08, 784, .12, .045], [.16, 1047, .3, .045]],
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
    master = ctx.createGain(); master.connect(ctx.destination);
    master.gain.value = muted ? 0 : 1;
    // Darkness muffles only the music parts; cues and the tick stay clear.
    muffle = ctx.createBiquadFilter(); muffle.type = 'lowpass'; muffle.frequency.value = 12000; muffle.Q.value = .4;
    const music = ctx.createGain(); music.gain.value = .9; music.connect(muffle); muffle.connect(master);
    for (const part of PARTS) {
      const g = ctx.createGain(); g.gain.value = 0; buses[part] = g;
      if (part === 'tick' || part === 'sparkle') { g.connect(master); continue; }
      // A friend's own tone filter: far away it thins out like a weak radio.
      const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 12000; tone.Q.value = .7;
      g.connect(tone); tone.connect(music); tones[part] = tone;
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
    g.gain.setValueAtTime(.0001, at); g.gain.exponentialRampToValueAtTime(Math.max(.0002, peak), at + attack);
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
    else if (note.kind === 'bell') { tone(bus, 'sine', note.f, at, note.d, .05 * v); tone(bus, 'sine', note.f * 2.76, at, note.d * .25, .012 * v); }
    else if (note.kind === 'bass') { tone(bus, 'triangle', note.f, at, note.d, .13 * v); tone(bus, 'sine', note.f / 2, at, note.d, .06 * v); }
    else if (note.kind === 'thump') tone(bus, 'sine', note.f, at, note.d, .16 * v, .5);
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
    mix(levels, muffleAmount = 0, clarity = {}) {
      if (!ctx) return;
      const t = ctx.currentTime;
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
        gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(peak, at + 1.5);
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
        baseLatency: ctx.baseLatency ?? null, outputLatency: ctx.outputLatency ?? null, sampleRate: ctx.sampleRate };
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
