// Finds a way through the workshop with the same run the game simulates. A plan
// for a hop is [fastOn, fastOff) in fractions of the hop.
import { PERIOD as BEAT } from '../../public/src/engine.mjs';
import { advance } from '../../public/src/workshop/sim.mjs';

export const HOLDS = [[0, 0], [0, .25], [.25, .5], [.5, .75], [.75, 1], [0, .5], [.25, .75], [.5, 1], [0, .75], [.25, 1], [0, 1]];
export function playHop(run, course, [on, off], events = []) {
  const t0 = run.beat * BEAT, a = t0 + on * BEAT, b = t0 + off * BEAT, end = t0 + BEAT;
  if (off > on) {
    if (a > t0) advance(run, course, a, false, events);
    advance(run, course, b, true, events);
    if (end > b) advance(run, course, end, false, events);
  } else advance(run, course, end, false, events);
  // A held edge across the landing is released at the start of the next hop.
  return events;
}
// Depth-first with a visited grid; the first complete path is returned. order
// prefers calm plans so a witness reads like a person's run.
export function solve(course, start, { order = HOLDS, maxHops = 2000, stopAt = null } = {}) {
  const seen = new Set();
  let best = start.x;
  const stack = [{ run: structuredClone(start), path: [], i: 0 }];
  while (stack.length) {
    const node = stack.at(-1);
    if (node.i >= order.length || node.path.length >= maxHops) { stack.pop(); continue; }
    const plan = order[node.i++], run = structuredClone(node.run), path = [...node.path, plan];
    const beatBefore = run.beat;
    playHop(run, course, plan);
    if (run.status === 'falling') continue;
    best = Math.max(best, run.x);
    if (run.status === 'docked' || (stopAt !== null && run.x >= stopAt)) return { path, run, best };
    const key = `${Math.round(run.x / 4)}:${run.beat % 4}:${run.resonance.join('')}:${run.cart.state === 'ride' ? Math.round((run.x - run.cart.x) / 8) : 0}:${run.fast}`;
    if (seen.has(key) || run.beat === beatBefore) continue;
    seen.add(key);
    stack.push({ run, path, i: 0 });
  }
  return { path: null, best };
}
