// Mastery lab page: A current course, B fixed gates, C fixed gates with
// landing-input rules. No landing marker in any variant (C policy).
import { PERIOD, INSET, hashSeed, footing } from '../../src/engine.mjs';
import { jstDate } from '../../src/links.mjs';
import { drawPod } from '../../src/pod.mjs';
import { createAudio } from '../../src/audio.mjs';
import { EXPERIMENTS, GATES, gateById, LabCourse, TimedInput, newLabRun, newPracticeRun } from './lab-core.mjs';

const get = id => document.getElementById(id);
const canvas = get('play'), ctx = canvas.getContext('2d');
const W = 360, H = 510, FLOOR = 382, HERO_X = 80, STORE = 'rapippo.lab.v05';
const audio = createAudio(), pointers = new Set(), keys = new Set();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const params = new URL(location.href).searchParams;
const seed = Number(params.get('seed')) >>> 0 || hashSeed('mastery-lab:' + jstDate());
let exp = EXPERIMENTS.includes(params.get('exp')) ? params.get('exp') : 'rules';
let course, state, input, running = false, practice = null, lastGate = null, best = 0;
let snap = 0, paused = false, landAge = 10, deathAge = 0, banner = null, worldTime = 0, lastNow = null, restartAt = null, particles = [];
const held = () => pointers.size + keys.size > 0;

function readStats() { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; } }
function writeStats(all) { try { localStorage.setItem(STORE, JSON.stringify(all)); } catch { /* stats live for this tab */ } }
let stats = readStats();
function bucket() {
  stats[exp] ??= { runs: 0, best: 0, gates: {} };
  for (const g of GATES) stats[exp].gates[g.id] ??= { tries: 0, clears: 0, firstClearTry: null, practiceTries: 0, practiceClears: 0, practiceFirstClearTry: null };
  return stats[exp];
}
// One "try" is one arrival on a gate's pad, in a scored run or in practice.
function countTry(id) { const g = bucket().gates[id]; if (practice) g.practiceTries++; else g.tries++; writeStats(stats); }
function countClear(id) {
  const g = bucket().gates[id], first = practice ? g.practiceClears === 0 && g.clears === 0 : g.clears === 0 && g.practiceClears === 0;
  if (practice) { g.practiceClears++; g.practiceFirstClearTry ??= g.practiceTries; } else { g.clears++; g.firstClearTry ??= g.tries; }
  writeStats(stats); return first;
}

function setExperiment(next) {
  exp = next; const url = new URL(location.href); url.searchParams.set('exp', exp); url.searchParams.set('seed', String(seed));
  history.replaceState(null, '', url);
  for (const b of document.querySelectorAll('#variants button')) b.setAttribute('aria-pressed', String(b.dataset.exp === exp));
  // ?practice=quiet|rush offers that gate's practice from the start screen.
  best = bucket().best; lastGate = gateById(params.get('practice'))?.id ?? null; practice = null; prepare();
  showOverlay('RAPIPPO LAB', exp === 'base' ? 'A：現行v4の地形。比較基準。' : exp === 'plain'
    ? 'B：易しい区間の途中に、毎回同じ関所が2つ。\n台座に乗ると位置がそろう。' : 'C：Bと同じ関所に着地ルール。\n静の橋＝離して着地　疾の橋＝押したまま着地', 'START', !!lastGate && exp !== 'base');
  renderStats();
}
function prepare(gateId = null) {
  practice = gateId; course = gateId ? LabCourse.practice(gateId, exp) : new LabCourse(seed, exp);
  state = gateId ? newPracticeRun(course) : newLabRun();
  snap = 0; paused = false; landAge = 10; deathAge = 0; particles = []; restartAt = null;
  input = new TimedInput(performance.now() / 1000); input.fast = input.queuedFast = held();
  get('leave').hidden = !practice;
}
function start(gateId = practice) {
  audio.unlock(); prepare(gateId); running = true; get('overlay').hidden = true; get('primary').blur();
  if (gateId) { countTry(gateId); flash(gateById(gateId).name.ja, '練習 ' + bucket().gates[gateId].practiceTries); }
}
function showOverlay(title, text, button, withPractice = false) {
  get('overlay-title').textContent = title; get('overlay-text').textContent = text; get('primary').textContent = button;
  const p = get('practice'); p.hidden = !withPractice;
  if (withPractice) p.textContent = gateById(lastGate).name.ja + 'を練習';
  get('overlay').hidden = false;
}
function flash(title, sub = '', color = '#fff0d0') { banner = { title, sub, color, until: worldTime + 1.3 }; }
const REASONS = {
  short: '届かなかった。', far: '飛びすぎた。',
  'still-fast': '静の橋：FASTのまま着地すると抜ける。\n着地の前に離す。',
  'rush-slow': '疾の橋：離して着地すると抜ける。\n押したまま着地する。',
};
function onFall(e) {
  running = false; deathAge = .001; audio.play('fall');
  if (e.gate) lastGate = e.gate.id;
  if (practice) { flash('もう一回', REASONS[e.reason].split('\n')[0], '#ff9b80'); restartAt = worldTime + .9; return; }
  const all = bucket(); all.runs++; if (state.hops > all.best) all.best = state.hops; best = all.best; writeStats(stats);
  showOverlay(state.hops + ' HOPS', REASONS[e.reason] + (e.gate ? '\n' + gateById(e.gate.id).name.ja + 'で落下' : ''), 'もう一度', !!lastGate && exp !== 'base');
  renderStats();
}
function step(now) {
  for (const e of input.advance(state, course, now)) {
    if (e.type === 'land') { landAge = 0; audio.play('land', state.hops); dust(e.x); }
    if (e.type === 'dock') { snap += e.from - state.x; lastGate = e.gate.id; countTry(e.gate.id); const g = bucket().gates[e.gate.id]; flash(gateById(e.gate.id).name.ja, '挑戦 ' + g.tries); }
    if (e.type === 'clear') {
      const first = countClear(e.gate.id); audio.pickup(0);
      flash(first ? '初突破！' : '突破', gateById(e.gate.id).name.ja + (practice ? ' 練習' : ''), '#8ee6c4');
      if (practice) { running = false; restartAt = worldTime + 1; }
      renderStats();
    }
    if (e.type === 'fall') onFall(e);
  }
}
function dust(x) {
  if (reducedMotion.matches) return;
  for (let i = 0; i < 8; i++) particles.push({ x, vx: (i - 3.5) * 17, vy: -20 - i % 3 * 10, age: 0, color: i % 2 ? '#efdaad' : '#8ee6c4' });
}

// --- input: timestamped edges, so the simulation is frame-rate independent.
function edge(time) { const now = held(); if (now !== input.queuedFast) { input.queuedFast = now; input.push(time / 1000, now); } updateHold(); }
function press(id, e) { if (!running) return; audio.unlock(); const was = held(); id(); if (!was) edge(e.timeStamp); }
function release(id, e) { const was = held(); id(); if (was && !held() && input) edge(e.timeStamp); updateHold(); }
for (const target of [canvas, get('hold')]) {
  target.addEventListener('pointerdown', e => { if (e.button > 0) return; e.preventDefault(); target.setPointerCapture(e.pointerId); press(() => pointers.add(e.pointerId), e); });
  target.addEventListener('lostpointercapture', e => release(() => pointers.delete(e.pointerId), e));
}
window.addEventListener('pointerup', e => release(() => pointers.delete(e.pointerId), e));
window.addEventListener('pointercancel', e => release(() => pointers.clear(), e));
window.addEventListener('keydown', e => {
  if (e.code === 'Space') {
    e.preventDefault(); if (e.repeat) return;
    if (!running && !get('overlay').hidden) { primary(); return; }
    press(() => keys.add('Space'), e);
  }
  if (e.code === 'KeyR' && !e.repeat) start(null);
  if (e.code === 'KeyP' && !e.repeat && lastGate && exp !== 'base') start(lastGate);
});
window.addEventListener('keyup', e => { if (e.code === 'Space') release(() => keys.delete('Space'), e); });
function updateHold() {
  const on = held(); get('hold').classList.toggle('active', on); get('hold').setAttribute('aria-pressed', String(on));
  get('hold').textContent = on ? 'FAST ← 離すとSLOW' : 'HOLD → FAST';
}
function primary() {
  if (!paused) return start(practice);
  paused = false; running = true; get('overlay').hidden = true; get('primary').blur();
  input.reset(performance.now() / 1000, held()); input.queuedFast = input.fast; lastNow = null;
}
get('primary').addEventListener('click', primary);
get('practice').addEventListener('click', () => start(lastGate));
get('leave').addEventListener('click', () => { practice = null; start(null); });
for (const b of document.querySelectorAll('#variants button')) b.addEventListener('click', () => { b.blur(); setExperiment(b.dataset.exp); });
get('copy').addEventListener('click', async () => {
  const text = JSON.stringify({ seed, date: jstDate(), stats }, null, 2);
  try { await navigator.clipboard.writeText(text); get('copy').textContent = 'コピーしました'; } catch { prompt('記録', text); }
  setTimeout(() => { get('copy').textContent = '記録をコピー（JSON）'; }, 1500);
});
get('clear').addEventListener('click', () => { if (confirm('この案の記録を消しますか？')) { delete stats[exp]; writeStats(stats); best = 0; renderStats(); } });
function pause() { if (!running) return; running = false; paused = true; pointers.clear(); keys.clear(); updateHold(); showOverlay('PAUSE', '', 'つづける'); }
window.addEventListener('blur', pause);
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

function renderStats() {
  const s = bucket(), rows = GATES.map(g => {
    const v = s.gates[g.id];
    return `<tr><td>${g.name.ja}</td><td>${v.clears}/${v.tries}</td><td>${v.firstClearTry ?? '–'}</td><td>${v.practiceClears}/${v.practiceTries}</td><td>${v.practiceFirstClearTry ?? '–'}</td></tr>`;
  }).join('');
  get('stats').innerHTML = `<tr><th>${['A 現行', 'B 関所', 'C 関所+ルール'][EXPERIMENTS.indexOf(exp)]}</th><th>本番 突破/挑戦</th><th>初突破</th><th>練習 突破/挑戦</th><th>初突破</th></tr>`
    + (exp === 'base' ? '' : rows) + `<tr><td>BEST ${s.best} HOPS</td><td colspan="4">${s.runs} runs</td></tr>`;
  get('seed').textContent = 'seed ' + seed + '（日替わり。?seed= で固定）';
}

// --- drawing: v4 palette; gate surfaces are told by texture, never by a
// reaction to the current input, and no landing prediction is drawn.
function draw(now) {
  const offset = state.x + snap - HERO_X, screen = x => Math.round(x - offset), dead = state.status === 'dead';
  ctx.fillStyle = '#101f2c'; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 44; i++) {
    const x = ((i * 97 - offset * .09) % 390 + 390) % 390;
    ctx.fillStyle = i % 7 ? '#526976' : '#ead6a4'; ctx.fillRect(x | 0, 22 + i * 37 % 220, 2, i % 7 ? 2 : 3);
  }
  for (let layer = 0; layer < 2; layer++) {
    ctx.fillStyle = layer ? '#172d38' : '#132532';
    for (let x = -28; x < W + 28; x += 28) {
      const height = 20 + (Math.sin((x + offset * (.04 + layer * .03)) * .025) + 1) * (24 + layer * 10);
      ctx.fillRect(x, FLOOR - height, 29, height);
    }
  }
  ctx.fillStyle = '#04080c'; ctx.fillRect(0, FLOOR, W, H - FLOOR);
  for (const platform of course.platforms) {
    const [a, b] = platform, [left, right] = footing(platform), kind = platform[2] || 'normal';
    if (screen(b) < 0 || screen(a) > W) continue;
    drawPlatform(screen, left, right, course.rules ? kind : kind === 'pad' ? 'pad' : 'normal', now);
  }
  for (const g of course.gates) drawGateFrame(screen(g.pad), g.id);
  const height = running ? Math.sin(state.phase / PERIOD * Math.PI) * 96 : 0;
  const heroY = FLOOR - 2 - height + (dead ? Math.min(110, deathAge * deathAge * 160) : 0);
  for (const p of particles) { ctx.fillStyle = p.color; ctx.globalAlpha = Math.max(0, 1 - p.age / .35);
    ctx.fillRect(screen(p.x) + p.vx * p.age, FLOOR - 5 + p.vy * p.age + 100 * p.age ** 2, 3, 3); }
  ctx.globalAlpha = 1;
  const fast = input?.fast && running;
  if (!reducedMotion.matches && fast) { ctx.fillStyle = '#ffb17b'; for (let i = 0; i < 3; i++) ctx.fillRect(HERO_X - 28 - i * 10, heroY - 20 + i * 7, 5 + i * 2, 2); }
  drawPod(ctx, screen(state.x), heroY, 2, { phase: state.phase / PERIOD, fast, land: Math.max(0, 1 - landAge / .13), dead: dead ? deathAge : 0, time: now, idle: !running });
  ctx.textAlign = 'left'; ctx.font = 'bold 10px monospace'; ctx.fillStyle = fast ? '#ffb17b' : '#8ee6c4'; ctx.fillText(fast ? '» FAST' : '· SLOW', 16, 26);
  ctx.textAlign = 'right'; ctx.fillStyle = '#fff0d0'; ctx.font = 'bold 22px monospace';
  ctx.fillText(practice ? gateById(practice).name.ja : String(state.hops), W - 16, 34);
  ctx.font = '10px monospace'; ctx.fillStyle = '#a2b9ba'; ctx.fillText(practice ? 'PRACTICE' : 'HOPS · BEST ' + Math.max(best, state.hops), W - 16, 48);
  if (banner && worldTime < banner.until) {
    ctx.textAlign = 'center'; ctx.fillStyle = banner.color; ctx.font = 'bold 20px monospace'; ctx.fillText(banner.title, W / 2, 120);
    ctx.font = '12px monospace'; ctx.fillStyle = '#c3d1c7'; ctx.fillText(banner.sub, W / 2, 140);
  }
}
function drawPlatform(screen, left, right, kind, now) {
  const l = screen(left), r = screen(right);
  ctx.fillStyle = kind === 'still' ? '#3a4560' : kind === 'rush' ? '#4a3a32' : '#2e4850'; ctx.fillRect(l, FLOOR, r - l, H - FLOOR);
  for (let k = 0; k < INSET / 2; k++) {
    const drop = 3 + k * 3;
    ctx.fillStyle = '#26404a'; ctx.fillRect(l - 2 - k * 2, FLOOR + drop, 2, H); ctx.fillRect(r + k * 2, FLOOR + drop, 2, H);
    ctx.fillStyle = '#56737a'; ctx.fillRect(l - 2 - k * 2, FLOOR + drop, 2, 2); ctx.fillRect(r + k * 2, FLOOR + drop, 2, 2);
  }
  if (kind === 'still') {
    // Quiet span: smooth pale top and slow concentric ripples, like still water.
    ctx.fillStyle = '#c9cbe0'; ctx.fillRect(l, FLOOR, r - l, 6);
    ctx.strokeStyle = '#7f88a8'; ctx.lineWidth = 1;
    ctx.save(); ctx.beginPath(); ctx.rect(l, FLOOR + 6, r - l, H - FLOOR); ctx.clip();
    for (let i = 1; i <= 3; i++) { ctx.beginPath(); ctx.ellipse((l + r) / 2, FLOOR + 10, i * (r - l) / 7, i * 6, 0, 0, Math.PI); ctx.stroke(); }
    ctx.restore();
  } else if (kind === 'rush') {
    // Rush span: a jagged crack that trembles; the floor is always restless.
    ctx.fillStyle = '#d8b28a'; ctx.fillRect(l, FLOOR, r - l, 6);
    const shake = reducedMotion.matches ? 0 : Math.round(Math.sin(now * 37) * 1);
    ctx.strokeStyle = '#ffb17b'; ctx.lineWidth = 2; ctx.beginPath();
    for (let x = l + 4, up = true; x <= r - 4; x += 8, up = !up) { const y = FLOOR + 12 + (up ? 0 : 7) + shake; x === l + 4 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
    ctx.stroke();
  } else {
    ctx.fillStyle = '#a8b7a5'; ctx.fillRect(l, FLOOR, r - l, 6);
    ctx.fillStyle = '#65858a'; ctx.fillRect(l, FLOOR + 6, r - l, 8);
  }
  ctx.fillStyle = '#edcf98'; ctx.fillRect(l, FLOOR, 2, 5); ctx.fillRect(r - 2, FLOOR, 2, 5);
  if (kind === 'pad') { ctx.fillStyle = '#edcf98'; ctx.fillRect(l + 4, FLOOR - 6, 3, 6); ctx.fillRect(r - 7, FLOOR - 6, 3, 6); }
}
// Two antenna posts mark the gate entrance; its name sits on the pad's face,
// below the hop arc.
function drawGateFrame(x, id) {
  if (x < -60 || x > W + 60) return;
  ctx.fillStyle = '#56737a'; ctx.fillRect(x - 30, FLOOR - 70, 3, 70); ctx.fillRect(x + 27, FLOOR - 70, 3, 70);
  ctx.fillStyle = '#edcf98'; ctx.fillRect(x - 31, FLOOR - 73, 5, 4); ctx.fillRect(x + 26, FLOOR - 73, 5, 4);
  ctx.textAlign = 'center'; ctx.font = 'bold 11px monospace'; ctx.fillStyle = '#edcf98'; ctx.fillText(gateById(id).name.ja, x, FLOOR + 44);
}

function frame(ms) {
  const now = ms / 1000, dt = lastNow === null ? 0 : now - lastNow; lastNow = now; worldTime += Math.min(dt, .05);
  if (running) { if (dt > .25) pause(); else step(now); }
  if (restartAt !== null && worldTime >= restartAt) start(practice);
  // The pad's pull is shown as the pod sliding into the cradle, not a jump cut.
  snap *= Math.exp(-Math.min(dt, .05) * 14);
  landAge += Math.min(dt, .05); if (deathAge > 0) deathAge += Math.min(dt, .05);
  particles.forEach(p => p.age += Math.min(dt, .05)); particles = particles.filter(p => p.age < .35);
  draw(worldTime); requestAnimationFrame(frame);
}
setExperiment(exp); updateHold(); requestAnimationFrame(frame);
// Browser checks read (never write) the run.
globalThis.__labProbe = () => ({ exp, practice, running, x: state.x, hops: state.hops, status: state.status, gate: state.gate?.id ?? null, platforms: course.platforms.length });
