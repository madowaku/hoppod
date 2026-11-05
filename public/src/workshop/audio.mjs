// Workshop sound: every voice is synthesized; no recordings. Notes are scheduled
// ahead on the AudioContext clock. `offline` lets the same voices render to a file.
const hz = m => 440 * 2 ** ((m - 69) / 12);
const HARM = {
  keys: [1, .5, .3, .15, .08], tongue: [1, 0, .22], harp: [1, .4, .2, .1], strings: [1, .5, .35, .25, .15],
  wood: [1, .12, .28, .05], brass: [1, .7, .5, .35, .25, .15], bellows: [1, .6, .5, .3, .22, .1], pad: [1, .35, .15],
};
const SHAPE = {
  keys: { attack: .004, tau: 1.2, peak: .2 }, tongue: { attack: .006, tau: 1.6, peak: .24 }, harp: { attack: .003, tau: .95, peak: .2 },
  strings: { attack: .09, peak: .17 }, wood: { attack: .025, peak: .2 }, brass: { attack: .035, peak: .22 }, bellows: { attack: .04, peak: .16 },
  pad: { attack: .5, peak: .1 },
};
export function createWorkshopAudio(offline = null) {
  let ctx = offline, master, buses = {}, waves = {}, noise, muted = false, reed = null, slide = null;
  const voices = new Set();
  const build = () => {
    const loud = ctx.createGain(), limit = ctx.createDynamicsCompressor();
    loud.gain.value = 1.8; limit.threshold.value = -8; limit.knee.value = 6; limit.ratio.value = 6; limit.attack.value = .004; limit.release.value = .2;
    master = ctx.createGain(); master.gain.value = muted ? 0 : 1; master.connect(loud); loud.connect(limit); limit.connect(ctx.destination);
    const send = ctx.createGain(); send.gain.value = .12;
    for (const [ms, back] of [[89, .5], [131, .44], [173, .38], [233, .3]]) {
      const delay = ctx.createDelay(1), fb = ctx.createGain(); delay.delayTime.value = ms / 1000; fb.gain.value = back;
      send.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(master);
    }
    for (const name of ['tick', 'live', 'bed', 'cue']) {
      const g = ctx.createGain(); g.gain.value = 1; g.connect(master); if (name !== 'tick') g.connect(send); buses[name] = g;
    }
    for (const [kind, harm] of Object.entries(HARM)) {
      const imag = new Float32Array(harm.length + 1), real = new Float32Array(harm.length + 1);
      harm.forEach((v, i) => { imag[i + 1] = v; });
      waves[kind] = ctx.createPeriodicWave(real, imag);
    }
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0); let seed = 11;
    for (let i = 0; i < data.length; i++) { seed = (seed * 16807) % 2147483647; data[i] = seed / 1073741823.5 - 1; }
  };
  if (offline) build();
  const track = (node, gain, at) => {
    const v = { node, gain, at }; voices.add(v);
    node.onended = () => { voices.delete(v); try { node.disconnect(); gain.disconnect(); } catch { /* gone */ } };
  };
  // A new gain starts at 1; silence it first or the sample before `at` clicks.
  const start = (g, at) => { g.gain.value = 0; g.gain.setValueAtTime(.0001, at); };
  function tone(bus, kind, midi, at, dur, v, fromMidi = null) {
    const shape = SHAPE[kind], o = ctx.createOscillator(), g = ctx.createGain(), peak = Math.max(.0002, shape.peak * v);
    o.setPeriodicWave(waves[kind]);
    const f = hz(midi);
    if (fromMidi != null) { o.frequency.setValueAtTime(hz(fromMidi), at); o.frequency.linearRampToValueAtTime(f, at + .14); } else o.frequency.setValueAtTime(f, at);
    start(g, at); g.gain.exponentialRampToValueAtTime(peak, at + shape.attack);
    let end;
    if (shape.tau) { const tau = shape.tau * (midi > 72 ? .68 : 1); end = at + dur + tau * 2.2; g.gain.exponentialRampToValueAtTime(.0002, end); }
    else { end = at + Math.max(shape.attack + .02, dur) + .14; g.gain.setValueAtTime(peak, Math.max(at + shape.attack, end - .14)); g.gain.exponentialRampToValueAtTime(.0002, end); }
    o.connect(g); g.connect(bus); o.start(at); o.stop(end + .02); track(o, g, at);
  }
  function sine(bus, f, at, decay, peak, glide = 0, wave = 'sine') {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = wave; o.frequency.setValueAtTime(f, at);
    if (glide) o.frequency.exponentialRampToValueAtTime(f * glide, at + decay);
    start(g, at); g.gain.exponentialRampToValueAtTime(Math.max(.0002, peak), at + .003); g.gain.exponentialRampToValueAtTime(.0001, at + decay);
    o.connect(g); g.connect(bus); o.start(at); o.stop(at + decay + .03); track(o, g, at);
  }
  function hiss(bus, f, at, decay, peak, type = 'highpass') {
    const s = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise; s.loop = true; filter.type = type; filter.frequency.value = f; filter.Q.value = type === 'bandpass' ? 3 : .7;
    start(g, at); g.gain.exponentialRampToValueAtTime(Math.max(.0002, peak), at + .002); g.gain.exponentialRampToValueAtTime(.0001, at + decay);
    s.connect(filter); filter.connect(g); g.connect(bus); s.start(at, (at * 7.3) % .9); s.stop(at + decay + .03); track(s, g, at);
  }
  function hit(bus, voice, at, v) {
    if (voice === 'kick') { sine(bus, 92, at, .3, .34 * v, .55); sine(bus, 330, at, .03, .1 * v); }
    else if (voice === 'snare') { hiss(bus, 1500, at, .16, .2 * v); sine(bus, 200, at, .1, .12 * v); }
    else if (voice === 'block') { sine(bus, 1150, at, .09, .16 * v); sine(bus, 2280, at, .03, .05 * v); }
    else if (voice === 'crash') { hiss(bus, 3200, at, 2.8, .13 * v); hiss(bus, 6500, at, 1.6, .08 * v); sine(bus, 430, at, 1.2, .04 * v, .98, 'triangle'); }
  }
  const voice = (e, at, busName) => {
    const bus = buses[busName];
    if (e.part === 'drums') hit(bus, e.voice, at, e.v ?? .75);
    else if (e.part === 'crash') hit(bus, 'crash', at, e.v ?? 1);
    else if (e.part === 'bass') {
      tone(bus, 'brass', e.midi, at, e.dur, (e.v ?? .3) * .8);
      // Two octaves up: this is the bass a phone speaker can actually play.
      tone(bus, 'harp', e.midi + 24, at, .1, (e.v ?? .3) * .7);
    }
    else if (SHAPE[e.part]) tone(bus, e.part, e.midi, at, e.dur ?? .4, e.v ?? .5, e.from ?? null);
  };
  return {
    unlock() {
      try {
        if (!ctx) { ctx = new (globalThis.AudioContext || globalThis.webkitAudioContext)({ latencyHint: 'interactive' }); build(); }
        if (ctx.state !== 'running') ctx.resume?.().catch?.(() => {});
      } catch { ctx = null; }
    },
    get context() { return ctx; },
    get running() { return !!ctx && (ctx.state === 'running' || !!offline); },
    get muted() { return muted; },
    setMuted(value) { muted = value; if (ctx) master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, .02); },
    mix(bed = 1) { if (ctx) buses.bed.gain.setTargetAtTime(bed, ctx.currentTime, .15); },
    note(e, at, bus = 'bed') { if (ctx) voice(e, at, bus); },
    tick(at, tock = false, v = 1) { if (!ctx) return; hiss(buses.tick, 4000, at, .035, .09 * v); sine(buses.tick, tock ? 1760 : 2350, at, .03, .03 * v, 0, 'square'); },
    hopTick(at) { if (!ctx) return; hiss(buses.tick, 4000, at, .03, .075); sine(buses.tick, 2350, at, .03, .02, 0, 'square'); },
    chatter(at) { if (ctx) sine(buses.tick, 3100, at, .025, .05); },
    // The lock: two clamps and a low settle, then silence.
    lock(at) { if (!ctx) return; sine(buses.cue, 196, at, .3, .14, .9, 'triangle'); sine(buses.cue, 98, at + .02, .5, .12); hiss(buses.cue, 900, at, .2, .07, 'bandpass'); sine(buses.cue, 1320, at + .06, .05, .05, 0, 'square'); },
    wake(at) { if (!ctx) return; for (const [i, f] of [392, 587, 784].entries()) sine(buses.cue, f, at + i * .07, .3, .045); },
    chime(at) { if (ctx) { sine(buses.cue, 1047, at, .14, .05); sine(buses.cue, 1568, at + .06, .22, .04); } },
    fall(at, brass = false) {
      if (!ctx) return;
      // A fall off the cart is the trombone's own joke.
      if (brass) for (const [i, m] of [58, 57, 56, 55].entries()) tone(buses.cue, 'brass', m, at + i * .19, i === 3 ? .55 : .15, .6, i === 3 ? 56 : null);
      else { sine(buses.cue, 330, at, .3, .06, .5, 'triangle'); sine(buses.cue, 220, at + .12, .4, .05, .5, 'triangle'); }
    },
    respawn(at) { if (ctx) { sine(buses.cue, 659, at, .08, .04); sine(buses.cue, 988, at + .07, .2, .035); } },
    // Continuous breath while a press lasts.
    reedOn(midi) {
      if (!ctx) return;
      this.reedOff();
      const at = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(), vib = ctx.createOscillator(), depth = ctx.createGain();
      o.setPeriodicWave(waves.wood); o.frequency.setValueAtTime(hz(midi), at);
      vib.frequency.value = 5; depth.gain.value = 0; depth.gain.setValueAtTime(0, at + .25); depth.gain.linearRampToValueAtTime(hz(midi) * .007, at + .5);
      vib.connect(depth); depth.connect(o.frequency);
      start(g, at); g.gain.exponentialRampToValueAtTime(.14, at + .02); o.connect(g); g.connect(buses.live); o.start(at); vib.start(at);
      reed = { o, g, vib };
    },
    reedOff() {
      if (!ctx || !reed) return;
      const at = ctx.currentTime, { o, g, vib } = reed; reed = null;
      g.gain.cancelScheduledValues(at); g.gain.setValueAtTime(Math.max(.0002, g.gain.value), at); g.gain.exponentialRampToValueAtTime(.0002, at + .1);
      o.stop(at + .12); vib.stop(at + .12); o.onended = () => { try { o.disconnect(); g.disconnect(); vib.disconnect(); } catch { /* gone */ } };
    },
    // The trombone's held note follows the hero's place on the cart.
    slideOn(midi) {
      if (!ctx || slide) return;
      const at = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
      o.setPeriodicWave(waves.brass); o.frequency.setValueAtTime(hz(midi), at); lp.type = 'lowpass'; lp.frequency.value = 1500;
      start(g, at); g.gain.exponentialRampToValueAtTime(.11, at + .25); o.connect(lp); lp.connect(g); g.connect(buses.live); o.start(at);
      slide = { o, g, lp };
    },
    slideTo(midi, accent = 0) {
      if (!ctx || !slide) return;
      const at = ctx.currentTime; slide.o.frequency.setTargetAtTime(hz(midi), at, .03);
      if (accent) { slide.g.gain.cancelScheduledValues(at); slide.g.gain.setTargetAtTime(.2, at, .01); slide.g.gain.setTargetAtTime(.11, at + .06, .12); }
    },
    slideOff() {
      if (!ctx || !slide) return;
      const at = ctx.currentTime, { o, g, lp } = slide; slide = null;
      g.gain.cancelScheduledValues(at); g.gain.setTargetAtTime(.0001, at, .06); o.stop(at + .4);
      o.onended = () => { try { o.disconnect(); lp.disconnect(); g.disconnect(); } catch { /* gone */ } };
    },
    cancel() {
      if (!ctx) return;
      this.reedOff(); this.slideOff();
      const t = ctx.currentTime;
      for (const v of voices) {
        v.gain.gain.cancelScheduledValues(t); v.gain.gain.setValueAtTime(v.at > t ? 0 : Math.max(.0001, v.gain.gain.value), t);
        v.gain.gain.linearRampToValueAtTime(0, t + .01);
        try { v.node.stop(t + .02); } catch { /* already stopped */ }
      }
    },
    debug() { return ctx ? { state: ctx.state, voices: voices.size, reed: !!reed, slide: !!slide, master: master.gain.value } : null; },
  };
}
