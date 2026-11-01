// v0.4-C companion. Visual and audio only: once built from its parts (see
// parts.mjs), a small blue pod hovers a little behind the hero, bobbing half a
// hop out of step with it. It reads the hop phase and never touches run state.
import { PERIOD } from './engine.mjs';
// Half a hop behind: the companion peaks as the hero lands.
export const COMPANION_LAG = PERIOD / 2;
// Assembly while play continues: parts converge, flash, eyes light, boot chime.
export const ASSEMBLE_GATHER = .4, ASSEMBLE_FLASH = .55, ASSEMBLE_BOOT = .75;
export const COMPANION_GAP = 40, COMPANION_HOVER = 16, COMPANION_ARC = 56;
// Same outline and face as the hero, recoloured as a cool blue little sibling.
export const COMPANION_PALETTE = Object.freeze({ c: '#a9d6ff', w: '#e6f4ff', s: '#7fa8d4', a: '#4f9dff' });
// Bell on every second landing after the crew is built (joinedAt = HOPS at
// completion, null before), skipping milestone accents so they stay clear.
export function companionBell(hops, joinedAt, milestone) {
  return joinedAt !== null && hops > joinedAt && hops % 2 === 0 && !milestone;
}
// Lagged hop phase (0..1) and hover height above the floor line.
export function companionPhase(phase) {
  return (((phase - COMPANION_LAG) % PERIOD + PERIOD) % PERIOD) / PERIOD;
}
export function companionLift(phase) {
  return COMPANION_HOVER + Math.sin(companionPhase(phase) * Math.PI) * COMPANION_ARC;
}
// 0..1 progress of the parts flying together.
export function gatherBlend(age) {
  const k = Math.max(0, Math.min(1, age / ASSEMBLE_GATHER));
  return 1 - (1 - k) ** 3;
}
