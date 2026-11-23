// Numbers for the finale, from takes left by real runs through the course.
// Usage: node tests/helpers/workshop-finale-report.mjs
import { PERIOD as BEAT } from '../../public/src/engine.mjs';
import { COURSE } from '../../public/src/workshop/course.mjs';
import { newRun } from '../../public/src/workshop/sim.mjs';
import { solve, HOLDS } from './workshop-solver.mjs';
import { finaleBar, chordAtBar, pc, TUTTI_END, PARTS } from '../../public/src/workshop/arrange.mjs';

const STEP = BEAT / 4;
const players = {
  calm: [[.25, .5], [0, 0], [.5, .75], ...HOLDS], rushing: [[0, 1], [.25, 1], [0, .75], ...HOLDS],
  lateHold: [[.5, 1], [0, .25], [.25, .75], ...HOLDS], shortTaps: [[0, 0], [0, .25], [.75, 1], ...HOLDS],
};
const takes = Object.fromEntries(Object.entries(players).map(([name, order]) => [name, solve(COURSE, newRun(), { order })]));
const score = rec => Array.from({ length: TUTTI_END }, (_, bar) => finaleBar(rec, bar).map(n => ({ ...n, bar })));
const keyOf = rec => new Set(score(rec).flat().filter(n => n.by === 'player').map(n => `${n.part}:${n.bar}:${Math.round(n.t * 100)}:${n.midi ?? n.voice}`));
const jaccard = (a, b) => { let same = 0; for (const v of a) if (b.has(v)) same++; return 1 - same / (a.size + b.size - same); };
for (const [name, { path, run }] of Object.entries(takes)) {
  let on = 0, hit = 0, rub = 0, slots = 0, most = 0, ghosts = 0;
  for (const notes of score(run.recording)) {
    const band = notes.filter(n => !['pad', 'bass', 'crash'].includes(n.part));
    most = Math.max(most, band.length); ghosts += band.filter(n => n.by === 'workshop').length;
    const at = new Map();
    for (const n of band) {
      if (n.midi == null) continue;
      if (Math.abs((n.t / STEP) % 4) < .01) { on++; if (chordAtBar(n.bar).tones.includes(pc(n.midi))) hit++; }
      const s = Math.round(n.t / STEP); (at.get(s) ?? at.set(s, []).get(s)).push(Math.round(n.midi));
    }
    for (const list of at.values()) { slots++; if (list.some((a, i) => list.slice(i + 1).some(b => [1, 11].includes(((a - b) % 12 + 12) % 12)))) rub++; }
  }
  console.log(name.padEnd(10), `run ${Math.round(path.length * BEAT)}s  chord-on-beat ${(hit / on * 100).toFixed(0)}%  rubbing onsets ${(rub / slots * 100).toFixed(1)}%  busiest bar ${most}  workshop's own notes ${ghosts}  `,
    PARTS.map(p => `${p}:${run.recording[p].events.length}/${run.recording[p].len}`).join(' '));
}
const names = Object.keys(takes), keys = names.map(n => keyOf(takes[n].run.recording));
for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) console.log(`${names[i]} vs ${names[j]}: ${jaccard(keys[i], keys[j]).toFixed(2)}`);
