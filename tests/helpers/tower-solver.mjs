// Finds a way up the tower with the same run the game simulates. A plan for a hop
// is [fastOn, fastOff) in fractions of the hop.
import { PERIOD as BEAT } from '../../public/src/engine.mjs';
import { advance, cloneRun } from '../../public/src/tower/sim.mjs';

export const HOLDS = [[0, 0], [0, .25], [.25, .5], [.5, .75], [.75, 1], [0, .5], [.25, .75], [.5, 1], [0, .75], [.25, 1], [0, 1]];
export function playHop(run, course, [on, off], events = []) {
  const t0 = run.beat * BEAT, a = t0 + on * BEAT, b = t0 + off * BEAT, end = t0 + BEAT;
  if (off > on) {
    if (a > t0) advance(run, course, a, false, events);
    advance(run, course, b, true, events);
    if (end > b) advance(run, course, end, false, events);
  } else advance(run, course, end, false, events);
  return events;
}
export function solve(course, start, { order = HOLDS, maxHops = 600, stopAt = null } = {}) {
  const seen = new Set();
  let best = start.x;
  const stack = [{ run: cloneRun(start), path: [], i: 0 }];
  while (stack.length) {
    const node = stack.at(-1);
    if (node.i >= order.length || node.path.length >= maxHops) { stack.pop(); continue; }
    const plan = order[node.i++], run = cloneRun(node.run), path = [...node.path, plan];
    playHop(run, course, plan);
    if (run.status === 'falling') continue;
    best = Math.max(best, run.x);
    if (run.status === 'docked' || (stopAt !== null && run.x >= stopAt)) return { path, run, best };
    const key = `${Math.round(run.x / 3)}:${run.beat % 4}:${run.boost}:${run.sandUsed.join(',')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    stack.push({ run, path, i: 0 });
  }
  return { path: null, best };
}
