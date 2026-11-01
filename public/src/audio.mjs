// Tiny original oscillator cues; initialized only by a user gesture.
// Landing notes are the v0.2 pentatonic set. Milestone accents (v0.3) are
// layered on their own quieter, compressed bus so the land voice is unchanged.
export const LAND_NOTES = [330, 392, 440, 523, 587];
export function milestoneTier(hops) {
  return hops <= 0 ? null : hops % 100 === 0 ? 'hundred' : hops % 50 === 0 ? 'fifty' : hops % 10 === 0 ? 'ten' : null;
}
// [delay s, frequency Hz, decay s, peak gain]. Multiples of 5 land on E4, so
// every accent stays in the same C-major pentatonic colour above it.
const ACCENTS = {
  ten: [[.05, 784, .2, .03], [.12, 1047, .26, .03]],
  fifty: [[.04, 659, .24, .024], [.095, 784, .24, .024], [.15, 880, .24, .024], [.205, 1047, .26, .024], [.26, 1319, .34, .022]],
  hundred: [[0, 523, 1.5, .016], [.03, 659, 1.5, .016], [.06, 784, 1.5, .016], [.09, 1175, 1.4, .012], [.32, 1319, .9, .018]],
};
const MAX_ACCENT_VOICES = 12;
export function createAudio({ accents = true } = {}) {
  let ctx, bus, muted = false, active = 0;
  const unlock = () => {
    try {
      ctx ||= new (globalThis.AudioContext || globalThis.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    } catch { /* Silent play is always supported. */ }
  };
  const accentBus = () => {
    if (bus) return bus;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -20; compressor.knee.value = 12; compressor.ratio.value = 4;
    compressor.attack.value = .003; compressor.release.value = .2;
    compressor.connect(ctx.destination);
    return bus = compressor;
  };
  const accent = (tier, t) => {
    for (const [delay, frequency, decay, peak] of ACCENTS[tier]) {
      if (active >= MAX_ACCENT_VOICES) return;
      const o = ctx.createOscillator(), g = ctx.createGain(), at = t + delay;
      o.type = tier === 'hundred' ? 'sine' : 'triangle';
      o.frequency.setValueAtTime(frequency, at);
      g.gain.setValueAtTime(.0001, at); g.gain.exponentialRampToValueAtTime(peak, at + (tier === 'hundred' ? .04 : .006));
      g.gain.exponentialRampToValueAtTime(.0001, at + decay);
      o.connect(g); g.connect(accentBus()); o.start(at); o.stop(at + decay + .05);
      active += 1; o.onended = () => { active -= 1; o.disconnect(); g.disconnect(); };
    }
  };
  const play = (kind, hops = 0) => {
    if (!ctx || ctx.state !== 'running' || muted) return;
    const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
    const notes = LAND_NOTES;
    const frequency = kind === 'fall' ? 170 : kind === 'fast' ? 220 : kind === 'slow' ? 300 : notes[hops % notes.length];
    o.type = kind === 'land' ? 'sine' : 'triangle';
    o.frequency.setValueAtTime(frequency, t);
    o.frequency.exponentialRampToValueAtTime(kind === 'fall' ? 45 : frequency * (kind === 'fast' ? 1.8 : 1.15), t + .1);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.07, t + .008);
    g.gain.exponentialRampToValueAtTime(.0001, t + (kind === 'fall' ? .22 : .12));
    o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + .25);
    const tier = kind === 'land' && accents ? milestoneTier(hops) : null;
    if (tier) accent(tier, t);
  };
  return {
    unlock, play, toggle() { muted = !muted; return muted; }, get muted() { return muted; },
    get accents() { return accents; }, set accents(value) { accents = Boolean(value); },
  };
}
