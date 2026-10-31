// Tiny original oscillator cues; initialized only by a user gesture.
export function createAudio() {
  let ctx, muted = false;
  const unlock = () => {
    try {
      ctx ||= new (globalThis.AudioContext || globalThis.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    } catch { /* Silent play is always supported. */ }
  };
  const play = (kind, hops = 0) => {
    if (!ctx || ctx.state !== 'running' || muted) return;
    const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
    const notes = [330, 392, 440, 523, 587];
    const frequency = kind === 'fall' ? 170 : kind === 'fast' ? 220 : kind === 'slow' ? 300 : notes[hops % notes.length];
    o.type = kind === 'land' ? 'sine' : 'triangle';
    o.frequency.setValueAtTime(frequency, t);
    o.frequency.exponentialRampToValueAtTime(kind === 'fall' ? 45 : frequency * (kind === 'fast' ? 1.8 : 1.15), t + .1);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.07, t + .008);
    g.gain.exponentialRampToValueAtTime(.0001, t + (kind === 'fall' ? .22 : .12));
    o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + .25);
  };
  return { unlock, play, toggle() { muted = !muted; return muted; }, get muted() { return muted; } };
}
