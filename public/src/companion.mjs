// v0.4-C companion experiment. Visual and audio only: a small blue pod joins
// after enough HOPS and hovers a little behind the hero, bobbing half a hop
// out of step with it. It reads the hop phase and never touches run state.
import { PERIOD } from './engine.mjs';
export const COMPANION_HOPS = 30;
// Half a hop behind: the companion peaks as the hero lands.
export const COMPANION_LAG = PERIOD / 2;
export const COMPANION_JOIN = 1.1;
export const COMPANION_GAP = 40, COMPANION_HOVER = 16, COMPANION_ARC = 56;
// Same outline and face as the hero, recoloured as a cool blue little sibling.
export const COMPANION_PALETTE = Object.freeze({ c: '#a9d6ff', w: '#e6f4ff', s: '#7fa8d4', a: '#4f9dff' });
export function companionJoins(hops, joined) {
  return !joined && hops >= COMPANION_HOPS;
}
// Bell on every second landing, skipping milestone accents so they stay clear.
export function companionBell(hops, joined, milestone) {
  return joined && hops > COMPANION_HOPS && hops % 2 === 0 && !milestone;
}
// Lagged hop phase (0..1) and hover height above the floor line.
export function companionPhase(phase) {
  return (((phase - COMPANION_LAG) % PERIOD + PERIOD) % PERIOD) / PERIOD;
}
export function companionLift(phase) {
  return COMPANION_HOVER + Math.sin(companionPhase(phase) * Math.PI) * COMPANION_ARC;
}
// Join flight: drops in from the upper sky and settles into place.
export function joinBlend(age) {
  const k = Math.max(0, Math.min(1, age / COMPANION_JOIN));
  return 1 - (1 - k) ** 3;
}
