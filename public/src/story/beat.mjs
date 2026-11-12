// STORY beat clock. One beat is exactly the hop period (0.78s, ≈76.923 BPM);
// it is never rounded to 77 BPM. Hops, music and the ending all read one
// story time S, measured in seconds of the *heard* audio clock.
//
// Heard time is the AudioContext time of the sample reaching the speaker now
// (getOutputTimestamp, or currentTime minus output latency). Drawing and
// physics run on heard time, so what you see matches what you hear even with
// Bluetooth latency; notes are scheduled ahead on the context clock. Without a
// running context the clock falls back to performance time and rebases, so S
// never jumps when audio starts, is muted, suspended or resumed.
import { PERIOD } from '../engine.mjs';

export const BEAT = PERIOD;
export const BPM = 60 / BEAT;
// Small corrections slew; larger disagreements (device change, resume) snap.
const SNAP = .08, SLEW = .12;

export const beatIndex = s => Math.floor(s / BEAT + 1e-9);
export const beatTime = k => k * BEAT;
export const beatPhase = s => s - beatIndex(s) * BEAT;

// Estimate the heard context time from a running AudioContext, in seconds.
export function heardFromContext(ctx, perfSeconds) {
  if (!ctx || ctx.state !== 'running') return null;
  const ts = ctx.getOutputTimestamp?.();
  if (ts && ts.contextTime > 0 && ts.performanceTime > 0) return ts.contextTime + (perfSeconds - ts.performanceTime / 1000);
  return ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0);
}

export class BeatClock {
  // readHeard(perfSeconds) → heard context seconds, or null without audio.
  constructor(readHeard = () => null) {
    this.readHeard = readHeard;
    this.domain = 'perf';
    this.heard = null; this.perf = null;
    this.offset = 0; this.frozen = 0; this.paused = true;
  }
  // Domain time (heard context seconds, or performance seconds) right now.
  sample(perfSeconds) {
    const raw = this.readHeard(perfSeconds);
    const domain = raw === null ? 'perf' : 'audio';
    const value = raw === null ? perfSeconds : raw;
    if (domain !== this.domain || this.heard === null) {
      // Rebase: keep S continuous across a change of time source.
      const s = this.paused || this.heard === null ? this.frozen : this.heard + (perfSeconds - this.perf) - this.offset;
      this.domain = domain; this.heard = value; this.perf = perfSeconds;
      if (!this.paused) this.offset = value - s;
      return value;
    }
    const predicted = this.heard + Math.max(0, perfSeconds - this.perf);
    const error = value - predicted;
    const next = Math.abs(error) > SNAP ? value : predicted + error * SLEW;
    this.heard = Math.max(this.heard, next); this.perf = perfSeconds;
    return this.heard;
  }
  // Story seconds at this frame; frozen while paused.
  now(perfSeconds) {
    this.sample(perfSeconds);
    return this.paused ? this.frozen : this.heard - this.offset;
  }
  // Story time of an input event stamped in performance seconds.
  at(perfSeconds) {
    if (this.paused || this.heard === null) return this.frozen;
    return this.heard - this.offset + (perfSeconds - this.perf);
  }
  start(s = 0, perfSeconds = 0) {
    this.frozen = s; this.paused = false;
    this.offset = this.sample(perfSeconds) - s;
  }
  // at: freeze on this earlier story time instead of now (after a long stall,
  // the last instant the game actually simulated and drew).
  pause(perfSeconds, at = null) {
    if (this.paused) return;
    const now = this.now(perfSeconds);
    this.frozen = at === null ? now : Math.min(at, now); this.paused = true;
  }
  resume(perfSeconds) {
    if (!this.paused) return;
    this.paused = false; this.offset = this.sample(perfSeconds) - this.frozen;
  }
  // AudioContext time at which story time s will be heard.
  contextTime(s) { return this.domain === 'audio' ? s + this.offset : null; }
}

// Input edges carry their own story timestamps. A frame is split at those
// instants, so landings do not depend on frame rate or frame phase.
export class TimedInput {
  constructor() { this.clock = 0; this.fast = false; this.queue = []; }
  reset(clock, fast = false) { this.clock = clock; this.fast = fast; this.queue = []; }
  push(time, fast) {
    this.queue.push({ time: Math.max(time, this.clock), fast });
    this.queue.sort((p, q) => p.time - q.time);
  }
  // step(fromClock, toClock, fast) advances the simulation with one input.
  advance(now, step) {
    while (this.queue.length && this.queue[0].time <= now) {
      const edge = this.queue.shift();
      if (edge.time > this.clock) step(this.clock, edge.time, this.fast);
      this.clock = Math.max(this.clock, edge.time); this.fast = edge.fast;
    }
    if (now > this.clock) { step(this.clock, now, this.fast); this.clock = now; }
  }
}
