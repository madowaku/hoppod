import { PERIOD, Terrain, newRun, advance, isSafe, predictLanding, landingMiss } from './engine.mjs';
import { resolveRun, jstDate, shareUrl } from './links.mjs';
import { drawPod } from './pod.mjs';
import { createAudio } from './audio.mjs';

const get = id => document.getElementById(id);
const canvas = get('play'), ctx = canvas.getContext('2d');
const W = 360, H = 510, FLOOR = 382, HERO_X = 80;
const pointers = new Set(), keys = new Set(), audio = createAudio();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let run, state, terrain, best = 0, running = false, paused = false, lastTime = null;
let landAge = 10, deathAge = 0, particles = [], modeFast = false, worldTime = 0;
let failure = '', failureX = 0;
const fast = () => pointers.size + keys.size > 0;
function releaseInput() { pointers.clear(); keys.clear(); modeFast = false; updateHud(); }
function bestKey() { return 'hoppod.best.v2.' + (run.mode === 'daily' ? run.date : 'free'); }
function loadCourse() {
  run = resolveRun(location.href);
  history.replaceState(null, '', run.url);
  try { best = Math.max(0, Math.floor(Number(localStorage.getItem(bestKey())) || 0)); if (!Number.isFinite(best)) best = 0; } catch { best = 0; }
  get('mode-name').textContent = run.mode === 'daily' ? 'MOON / ' + run.date : 'FREE / ' + run.seed;
  for (const mode of ['daily', 'free']) {
    get(mode).classList.toggle('selected', run.mode === mode);
    get(mode).setAttribute('aria-pressed', String(run.mode === mode));
  }
  state = newRun(); terrain = new Terrain(run.seed);
  running = false; paused = false; deathAge = 0; particles = []; landAge = 10;
  get('share-actions').hidden = true; get('result-details').hidden = true;
  get('overlay').dataset.screen = 'start';
  overlay('ONE MORE HOP!', 'It hops. You set the pace.', 'LET’S HOP');
  releaseInput();
}
function overlay(title, subtitle, button) {
  get('overlay-title').textContent = title; get('overlay-subtitle').textContent = subtitle;
  get('action').textContent = button; get('overlay').hidden = false;
}
function reset() {
  get('action').blur();
  audio.unlock(); state = newRun(); terrain = new Terrain(run.seed);
  running = true; paused = false; lastTime = null;
  deathAge = 0; landAge = 10; particles = []; failure = '';
  releaseInput(); get('overlay').hidden = true;
  get('share-actions').hidden = true; get('result-details').hidden = true;
}
function updateHud() {
  if (!state) return;
  get('score').textContent = String(state.hops); get('best').textContent = String(best);
  get('hold').classList.toggle('active', fast()); get('hold').setAttribute('aria-pressed', String(fast()));
  get('hold-state').textContent = fast() ? 'FAST' : 'SLOW';
  get('hold-instruction').textContent = fast() ? 'RELEASE TO SLOW' : 'HOLD TO GO FAST';
}
function endRun() {
  failure = landingMiss(terrain, state.x, state.hopStartX) === 'short' ? 'TOO SHORT · HOLD A LITTLE LONGER' : 'TOO FAR · RELEASE A LITTLE EARLIER';
  failureX = state.x; running = false; deathAge = .001; audio.play('fall');
  const record = state.hops > best;
  if (record) { best = state.hops; try { localStorage.setItem(bestKey(), String(best)); } catch {} }
  releaseInput(); get('overlay').dataset.screen = 'result';
  get('result-score').textContent = String(state.hops); get('result-best').textContent = String(best);
  get('result-course').textContent = run.mode === 'daily' ? 'DAILY MOON / ' + run.date : 'FREE RUN / ' + run.seed;
  get('result-details').hidden = false; get('share-actions').hidden = false;
  overlay(record ? 'A NEW LITTLE RECORD.' : 'ONE MORE HOP?', failure, 'TRY AGAIN');
}
function pause() {
  releaseInput(); if (!running || paused) return;
  paused = true; lastTime = null; get('overlay').dataset.screen = 'pause';
  overlay('TAKE A BREATHER.', 'Resume at SLOW.', 'RESUME');
}
get('action').addEventListener('click', () => {
  audio.unlock();
  if (paused) { paused = false; releaseInput(); lastTime = null; get('overlay').hidden = true; get('action').blur(); }
  else reset();
});
for (const mode of ['daily', 'free']) get(mode).addEventListener('click', () => {
  releaseInput(); const url = new URL(location.href);
  url.search = mode === 'daily' ? '?mode=daily&date=' + jstDate() : '?mode=free';
  history.replaceState(null, '', url); loadCourse();
});
window.addEventListener('popstate', loadCourse);
get('sound').addEventListener('click', () => {
  audio.unlock(); const muted = audio.toggle(); get('sound').textContent = muted ? 'SOUND OFF' : 'SOUND ON';
  get('sound').setAttribute('aria-pressed', String(!muted));
});
for (const target of [canvas, get('hold')]) {
  target.addEventListener('pointerdown', e => {
    if (!running || paused || e.button > 0) return;
    e.preventDefault(); audio.unlock(); pointers.add(e.pointerId); target.setPointerCapture(e.pointerId); updateHud();
  });
  target.addEventListener('lostpointercapture', e => { pointers.delete(e.pointerId); updateHud(); });
}
window.addEventListener('pointerup', e => { pointers.delete(e.pointerId); updateHud(); });
window.addEventListener('pointercancel', releaseInput);
window.addEventListener('keydown', e => {
  if (e.code === 'Space') {
    if (!get('overlay').hidden || (document.activeElement?.tagName === 'BUTTON' && document.activeElement !== get('hold'))) return;
    e.preventDefault(); if (!e.repeat && running && !paused) { audio.unlock(); keys.add('Space'); updateHud(); }
  }
  if (e.code === 'KeyR' && !e.repeat) reset();
  if (e.code === 'Escape') pause();
});
window.addEventListener('keyup', e => { if (e.code === 'Space') { keys.delete('Space'); updateHud(); } });
window.addEventListener('blur', pause);
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('pagehide', pause);
get('share').addEventListener('click', () => window.open(shareUrl(run, state.hops, best), '_blank', 'noopener,noreferrer'));
get('save').addEventListener('click', () => {
  const c = document.createElement('canvas'); c.width = 1080; c.height = 1350;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  g.fillStyle = '#101f2c'; g.fillRect(0, 0, 1080, 1350);
  g.strokeStyle = '#f0d49a'; g.lineWidth = 3; g.strokeRect(45, 45, 990, 1260);
  for (let i = 0; i < 75; i++) { g.fillStyle = i % 3 ? '#526875' : '#e9c996'; g.fillRect(75 + i * 97 % 930, 80 + i * 137 % 1150, 3, 3); }
  g.textAlign = 'center'; g.fillStyle = '#fff0d0'; g.font = 'bold 90px monospace'; g.fillText('HOPPOD', 540, 200);
  g.fillStyle = '#ffad73'; g.font = '24px monospace'; g.fillText('O N E  M O R E  H O P !', 540, 252);
  g.fillStyle = '#fff0d0'; g.font = 'bold 190px monospace'; g.fillText(String(state.hops), 540, 510);
  g.font = '32px monospace'; g.fillText('HOPS  /  BEST ' + best, 540, 582);
  g.fillStyle = '#718e93'; g.fillRect(330, 970, 420, 8); g.fillStyle = '#25404a'; g.fillRect(330, 978, 420, 65);
  drawPod(g, 540, 960, 8, { phase: .15 });
  g.fillStyle = '#fff0d0'; g.font = '30px monospace';
  g.fillText(run.mode === 'daily' ? 'DAILY MOON / ' + run.date : 'FREE RUN / ' + run.seed, 540, 1150);
  g.fillStyle = '#a2b9ba'; g.font = '22px monospace'; g.fillText('#HOPPOD  ·  COURSE v0.2', 540, 1212);
  const link = document.createElement('a'); link.href = c.toDataURL('image/png');
  link.download = 'HOPPOD-' + state.hops + '-hops.png'; link.click();
});

function draw(now) {
  const offset = state.x - HERO_X, screen = x => Math.round(x - offset), dead = state.status === 'dead';
  ctx.fillStyle = '#101f2c'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#efddae'; ctx.beginPath(); ctx.arc(285, 84, 29, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#c8bd99'; ctx.fillRect(272, 71, 8, 8); ctx.fillRect(290, 89, 10, 6);
  for (let i = 0; i < 44; i++) {
    const x = ((i * 97 - offset * .09) % 390 + 390) % 390;
    ctx.fillStyle = i % 7 ? '#526976' : '#ead6a4'; ctx.fillRect(x | 0, 22 + i * 37 % 220, 2, i % 7 ? 2 : 3);
  }
  for (let layer = 0; layer < 2; layer++) {
    ctx.fillStyle = layer ? '#1c343e' : '#162b36';
    for (let x = -28; x < W + 28; x += 28) {
      const height = 20 + (Math.sin((x + offset * (.04 + layer * .03)) * .025) + 1) * (24 + layer * 10);
      ctx.fillRect(x, FLOOR - height, 29, H);
    }
  }
  for (const [a, b] of terrain.platforms) {
    const x = screen(a), end = screen(b); if (end < 0 || x > W) continue;
    ctx.fillStyle = '#2e4850'; ctx.fillRect(x, FLOOR, end - x, H - FLOOR);
    ctx.fillStyle = '#a8b7a5'; ctx.fillRect(x, FLOOR, end - x, 6);
    ctx.fillStyle = '#65858a'; ctx.fillRect(x, FLOOR + 6, end - x, 8);
    ctx.fillStyle = '#42616a';
    for (let tx = a + 13; tx < b - 6; tx += 24) ctx.fillRect(screen(tx), FLOOR + 27 + Math.round(tx) % 19, 6, 3);
    ctx.fillStyle = '#edcf98'; ctx.fillRect(x + 8, FLOOR, 2, 5); ctx.fillRect(end - 10, FLOOR, 2, 5);
  }
  for (const b of terrain.beacons) {
    const x = screen(b.x); if (b.taken || x < -10 || x > W + 10) continue;
    ctx.fillStyle = '#ffcb78'; ctx.fillRect(x - 3, FLOOR - 29, 6, 6); ctx.fillStyle = '#fff1bb'; ctx.fillRect(x - 1, FLOOR - 31, 2, 10);
  }
  const height = running || paused ? Math.sin(state.phase / PERIOD * Math.PI) * 96 : 0;
  const heroY = FLOOR - 2 - height + (dead ? Math.min(110, deathAge * deathAge * 160) : 0);
  if (!dead && get('overlay').hidden) {
    const projected = predictLanding(state, fast()), safe = isSafe(terrain, projected), x = screen(projected), color = safe ? '#8ee6c4' : '#ff9b80';
    ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.setLineDash([2, 5]);
    ctx.beginPath(); ctx.moveTo(HERO_X + 12, heroY - 12); ctx.lineTo(x, FLOOR - 5); ctx.stroke(); ctx.setLineDash([]);
    ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, FLOOR - 3, 12, 4, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, FLOOR - 22, 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - state.phase / PERIOD)); ctx.stroke();
    if (!safe) { ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = color;
      ctx.fillText(fast() ? 'RELEASE' : 'HOLD', Math.max(30, Math.min(W - 30, x)), FLOOR - 39); }
  }
  if (dead) { ctx.strokeStyle = '#ff9b80'; ctx.lineWidth = 2; const x = screen(failureX);
    ctx.beginPath(); ctx.moveTo(x - 6, FLOOR - 6); ctx.lineTo(x + 6, FLOOR + 6); ctx.moveTo(x + 6, FLOOR - 6); ctx.lineTo(x - 6, FLOOR + 6); ctx.stroke(); }
  for (const p of particles) { ctx.fillStyle = p.color; ctx.globalAlpha = Math.max(0, 1 - p.age / .35);
    ctx.fillRect(screen(p.x) + p.vx * p.age, FLOOR - 5 + p.vy * p.age + 100 * p.age ** 2, 3, 3); }
  ctx.globalAlpha = 1;
  if (!reducedMotion.matches && modeFast && running) {
    ctx.fillStyle = '#ffb17b'; for (let i = 0; i < 3; i++) ctx.fillRect(HERO_X - 28 - i * 10, heroY - 20 + i * 7, 5 + i * 2, 2);
  }
  drawPod(ctx, HERO_X, heroY, 2, { phase: state.phase / PERIOD, fast: modeFast, land: Math.max(0, 1 - landAge / .13), dead: dead ? deathAge : 0, time: now, idle: !running });
  ctx.textAlign = 'left'; ctx.font = 'bold 10px monospace'; ctx.fillStyle = modeFast ? '#ffb17b' : '#8ee6c4'; ctx.fillText(modeFast ? '» FAST' : '· SLOW', 16, 26);
  if (running && state.hops < 3) {
    ctx.textAlign = 'center'; ctx.fillStyle = '#c3d1c7'; ctx.font = '11px monospace';
    ctx.fillText(['AUTO HOP. YOUR PACE.', 'HOLD → FAST', 'RELEASE → SLOW'][state.hops], W / 2, 190);
  }
}
function frame(now) {
  const dt = lastTime === null ? 0 : Math.max(0, (now - lastTime) / 1000);
  lastTime = now; worldTime += Math.min(dt, .05);
  if (running && !paused) {
    if (dt > .25) pause();
    else {
      if (modeFast !== fast()) { modeFast = fast(); audio.play(modeFast ? 'fast' : 'slow'); }
      const events = advance(state, terrain, dt, fast()); landAge += dt;
      if (events.includes('land')) {
        landAge = 0; audio.play('land', state.hops);
        if (!reducedMotion.matches) for (let i = 0; i < 8; i++) particles.push({x: state.x, vx: (i - 3.5) * 17, vy: -20 - i % 3 * 10, age: 0, color: i % 2 ? '#efdaad' : '#8ee6c4'});
      }
      if (state.status === 'dead') endRun();
    }
  }
  if (deathAge > 0) deathAge += Math.min(dt, .05);
  particles.forEach(p => p.age += Math.min(dt, .05)); particles = particles.filter(p => p.age < .35);
  updateHud(); draw(worldTime); requestAnimationFrame(frame);
}
loadCourse(); requestAnimationFrame(frame);
