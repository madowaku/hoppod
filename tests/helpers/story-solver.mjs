// Depth-first witness for the fixed STORY course: per hop, hold FAST for a
// fraction of the beat (then release). Proves the course is clearable.
import { BEAT } from '../../public/src/story/beat.mjs';
import { advanceStory } from '../../public/src/story/sim.mjs';

export const CHOICES = [.25, 0, .5, .75, 1, .125, .375, .625, .875];
export function hop(run, course, f) {
  const events = [], t0 = run.beat * BEAT;
  if (f > 0) advanceStory(run, course, t0 + f * BEAT, true, events);
  advanceStory(run, course, t0 + BEAT, false, events);
  return events;
}
// Losing green before the switch field is recoverable (relay antennas);
// losing it on the field dooms the bridge, so prune that branch early.
const bad = (events, course) => events.some(e => e.type === 'fall' || (e.type === 'strand' && e.x >= course.fieldStart - 300));
// robust > 0: only accept a hold that also survives being that many beats
// early or late (real-time drivers switch FAST on frame boundaries).
export function solve(course, run, { limit = 200000, until = r => r.status === 'docked', order = CHOICES, robust = 0 } = {}) {
  const path = [];
  let nodes = 0;
  const go = state => {
    if (until(state)) return state;
    for (const f of order) {
      if (++nodes > limit) return null;
      const next = structuredClone(state);
      if (bad(hop(next, course, f), course)) continue;
      if (robust && [f - robust, f + robust].some(g => g >= 0 && g <= 1 && bad(hop(structuredClone(state), course, g), course))) continue;
      path.push(f);
      const done = go(next);
      if (done) return done;
      path.pop();
    }
    return null;
  };
  const end = go(structuredClone(run));
  return { end, path, nodes };
}
