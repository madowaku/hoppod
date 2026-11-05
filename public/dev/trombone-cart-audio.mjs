// Original synthesized brass sketch; no samples, downloads or external audio.
export function createTromboneAudio() {
  let ctx = null, master, muted = false, played = 0;
  const voices = new Set();
  const stop = () => {
    if (!ctx) return;
    for (const v of voices) {
      const t = ctx.currentTime;
      v.g.gain.cancelScheduledValues(t);
      v.g.gain.setTargetAtTime(0, t, .008);
      try { v.o.stop(t + .04); } catch { /* already stopped */ }
    }
  };
  return {
    async unlock() {
      try {
        if (!ctx) {
          ctx = new (globalThis.AudioContext || globalThis.webkitAudioContext)({ latencyHint: 'interactive' });
          master = ctx.createGain(); master.gain.value = .35;
          const limiter = ctx.createDynamicsCompressor(); limiter.threshold.value = -12; limiter.ratio.value = 5;
          master.connect(limiter); limiter.connect(ctx.destination);
        }
        await ctx.resume(); return ctx.state === 'running';
      } catch { return false; }
    },
    note(pitch) {
      if (!ctx || ctx.state !== 'running' || muted) return;
      const t = ctx.currentTime + .005, f = pitch === 'low' ? 196 : 261.6256;
      const o = ctx.createOscillator(), filter = ctx.createBiquadFilter(), g = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(f * .985, t); o.frequency.linearRampToValueAtTime(f, t + .05);
      filter.type = 'lowpass'; filter.Q.value = .7;
      filter.frequency.setValueAtTime(600, t); filter.frequency.linearRampToValueAtTime(1800, t + .06);
      filter.frequency.exponentialRampToValueAtTime(700, t + .48);
      g.gain.value = 0; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.3, t + .025);
      g.gain.setValueAtTime(.23, t + .28); g.gain.exponentialRampToValueAtTime(.0001, t + .58);
      o.connect(filter); filter.connect(g); g.connect(master);
      const v = { o, g }; voices.add(v);
      o.onended = () => { voices.delete(v); o.disconnect(); filter.disconnect(); g.disconnect(); };
      o.start(t); o.stop(t + .62); played++;
    },
    stop,
    toggle() { muted = !muted; if (muted) stop(); return muted; },
    debug() { return { state: ctx?.state ?? 'unavailable', muted, played, voices: voices.size }; }
  };
}
