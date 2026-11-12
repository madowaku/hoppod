// A scripted player who reads two hops ahead but whose finger is imprecise. It is
// not a human: it never misreads the ground and has no nerves. Its use is to find
// where the course is unfair compared with itself, station by station.
// Usage: node tests/helpers/workshop-noisy-player.mjs
import { pathToFileURL } from 'node:url';
import { PERIOD as BEAT } from '../../public/src/engine.mjs';
import { COURSE, stationAt } from '../../public/src/workshop/course.mjs';
import { newRun } from '../../public/src/workshop/sim.mjs';
import { playHop } from './workshop-solver.mjs';

const CANDIDATES = [[0, 0], [0, .15], [0, .3], [0, .45], [0, .6], [0, .8], [0, 1], [.2, 1], [.4, 1], [.6, 1], [.8, 1], [.3, .7]];
const gaussian = rng => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const shifted = ([on, off], k) => off > on ? [clamp(on + k, 0, 1), off >= 1 ? 1 : clamp(off + k, 0, 1)] : [on, off];
function survival(run, plan, depth, spread) {
  let score = 0;
  for (const k of [-spread, 0, spread]) {
    const r = structuredClone(run); r.takes = {};
    playHop(r, COURSE, shifted(plan, k));
    if (r.status === 'falling') continue;
    score += 1;
    if (depth > 0) score += Math.max(...CANDIDATES.map(p => survival(r, p, depth - 1, spread))) * .25;
  }
  return score;
}
export function playThrough({ sd = .06, seed = 1, maxHops = 4000 } = {}) {
  let state = seed * 16807;
  const rng = () => (state = (state * 16807) % 2147483647) / 2147483647;
  const run = newRun(), falls = {}, hops = {}, spread = Math.min(.25, sd * 1.5 / BEAT);
  let n = 0;
  while (run.status !== 'docked' && n++ < maxHops) {
    const id = stationAt(run.x).id;
    hops[id] = (hops[id] || 0) + 1;
    if (run.status === 'falling') { playHop(run, COURSE, [0, 0]); continue; }
    let best = CANDIDATES[0], top = -1;
    for (const plan of CANDIDATES) {
      const value = survival(run, plan, 1, spread);
      if (value > top + 1e-9) { top = value; best = plan; }
    }
    const [on, off] = best, noise = () => gaussian(rng) * sd / BEAT;
    const noisy = off > on ? [clamp(on + (on > 0 ? noise() : 0), 0, .98), off >= 1 ? 1 : clamp(off + noise(), .02, 1)] : best;
    if (noisy[1] <= noisy[0]) noisy[1] = Math.min(1, noisy[0] + .03);
    playHop(run, COURSE, noisy);
    if (run.status === 'falling') falls[id] = (falls[id] || 0) + 1;
  }
  return { falls, hops, finished: run.status === 'docked', seconds: n * BEAT };
}
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const ids = COURSE.stations.map(s => s.id);
  for (const sd of [.05, .1, .15]) {
    const runs = [1, 2, 3, 4, 5, 6].map(seed => playThrough({ sd, seed }));
    const mean = key => Object.fromEntries(ids.map(id => [id, +(runs.reduce((a, r) => a + (r[key][id] || 0), 0) / runs.length).toFixed(1)]));
    const falls = mean('falls'), hops = mean('hops');
    console.log(`\nfinger sd ${sd * 1000}ms: finished ${runs.filter(r => r.finished).length}/${runs.length}, mean ${Math.round(runs.reduce((a, r) => a + r.seconds, 0) / runs.length)}s`);
    for (const id of ids) console.log(`  ${id.padEnd(10)} falls ${String(falls[id]).padStart(5)}   ${String(Math.round(hops[id] * BEAT)).padStart(4)}s`);
  }
}
