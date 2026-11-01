import { PERIOD, INSET, COURSE_VERSION, Terrain, newRun, advance, isSafe, predictLanding, landingMiss, footing } from './engine.mjs';
import { resolveRun, jstDate, shareUrl } from './links.mjs';
import { drawPod } from './pod.mjs';
import { EARTH_PEEK, earthRise, earthCenterY, earthLabel, drawEarth } from './earth.mjs';
import { createAudio, milestoneTier } from './audio.mjs';
import { COMPANION_LAG, COMPANION_GAP, ASSEMBLE_GATHER, ASSEMBLE_FLASH, ASSEMBLE_BOOT, companionBell, companionPhase, companionLift, gatherBlend } from './companion.mjs';
import { PartLayout, PartRun, drawPart } from './parts.mjs';
import { MARKER_MODES, markerModeFromUrl, markerVisual } from './marker.mjs';
import { chooseLanguage, copy, earthText, partsText, milestoneText } from './ui-copy.mjs';

const get = id => document.getElementById(id);
const canvas = get('play'), ctx = canvas.getContext('2d');
const W = 360, H = 510, FLOOR = 382, HERO_X = 80;
const EARTH_X = 292, EARTH_R = 28, EARTH_HORIZON = FLOOR - 94, EARTH_TOP = 84;
const pointers = new Set(), keys = new Set(), audio = createAudio({ accents: accentsEnabled() });
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let run, state, terrain, best = 0, running = false, paused = false, lastTime = null;
let landAge = 10, deathAge = 0, particles = [], modeFast = false, worldTime = 0;
// Parts: layout is fixed per seed; progress, flights and assembly age per run.
let layout, parts, flights = [], crewAge = -1;
const FLIGHT = .35, trayX = i => 21 + i * 14, TRAY_Y = 41;
let failure = '', failureKind = 'short', failureX = 0, signal = 0, signalAge = 10, markerMode = markerModeFromUrl(location.href), comparisonEnabled = new URL(location.href).searchParams.get('compare') === '1';
function readPreference(key) { try { return localStorage.getItem(key); } catch { return null; } }
function savePreference(key,value) { try { localStorage.setItem(key,value); } catch { /* settings work for this session */ } }
let language = chooseLanguage(location.href, readPreference('hoppod.pref.lang'), navigator.language);
const tr = key => copy(language,key);
let notice = null, noticeUntil = 0, recordNotified = false, lastRecord = false;
if (readPreference('hoppod.pref.muted') === '1') audio.toggle();
const fast = () => pointers.size + keys.size > 0;
// Developer A/B only: ?sfx=classic plays v0.2 cues without milestone accents.
// The course URL is normalized on load, so the choice is kept for this tab.
function accentsEnabled() {
  const value = new URL(location.href).searchParams.get('sfx');
  try {
    if (value) sessionStorage.setItem('hoppod.dev.sfx', value);
    return (value || sessionStorage.getItem('hoppod.dev.sfx')) !== 'classic';
  } catch { return value !== 'classic'; }
}
function releaseInput() { pointers.clear(); keys.clear(); modeFast = false; updateHud(); }
function showNotice(kind,hops) { notice = {kind,hops}; noticeUntil = worldTime + 1.35; }
function refreshOverlay() {
  // A settings toggle during play must never reopen the start screen.
  if (get('overlay').hidden && state.status !== 'dead' && !paused) return;
  const screen = get('overlay').dataset.screen;
  if (screen === 'start') overlay(tr('startTitle'),tr('startText'),tr('startButton'));
  else if (screen === 'pause') overlay(tr('pauseTitle'),tr('pauseText'),tr('pauseButton'));
  else if (screen === 'result') overlay(tr(lastRecord?'recordTitle':'resultTitle'),tr(failureKind),tr('retryButton'));
}
function refreshResult() {
  get('result-course').textContent = run.mode === 'daily' ? tr('scoreDaily')(run.date) : tr('scoreFree')(run.seed);
  get('result-earth').textContent = earthText(language,earthLabel(state.x));
  get('result-crew').hidden = !parts.collected.length;
  get('result-crew-text').textContent = partsText(language,parts.collected,layout.crew.parts.length);
}
function refreshCopy() {
  document.documentElement.lang = language;
  get('language').textContent = language === 'ja' ? 'EN' : '日本語';
  get('language').setAttribute('aria-label',tr('switchLanguage'));
  get('daily').textContent = tr('daily'); get('free').textContent = tr('free');
  get('hops-label').textContent = tr('hops');get('best-label').textContent = tr('best');
  get('intro-mark').textContent = tr('introMark'); get('milestone-help').textContent = tr('milestoneHelp');
  get('intro-hold').textContent = tr('hold');get('intro-release').textContent = tr('release');
  get('share').textContent = tr('share');get('save').textContent = tr('save');
  get('attach-hint').textContent = tr('attach');
  get('footer-tag').textContent = tr('footer');get('footer-keys').textContent = tr('keys');
  get('mode-name').textContent = run.mode === 'daily' ? tr('modeDaily')(run.date) : tr('modeFree')(run.seed);
  get('sound').textContent = tr(audio.muted ? 'soundOff' : 'soundOn');
  get('sound').setAttribute('aria-pressed', String(!audio.muted));
  if (state.status === 'dead') refreshResult();
  refreshOverlay(); updateHud();
}
function bestKey() {
  return 'hoppod.best.v' + COURSE_VERSION + '.' + (run.mode === 'daily' ? run.date : 'free') +
    (markerMode === 'full' ? '' : '.marker.' + markerMode);
}
function markerUrl(url, mode = markerMode) {
  const copy = new URL(url);
  if (mode === 'off') copy.searchParams.delete('marker');
  else copy.searchParams.set('marker', mode);
  if (comparisonEnabled) copy.searchParams.set('compare', '1');
  return copy.href;
}
function syncMarkerUI() {
  get('marker-compare').hidden = !comparisonEnabled;
  get('marker-guide').hidden = !comparisonEnabled;
  for (const mode of MARKER_MODES) {
    const button = get('marker-' + mode);
    const selected = markerMode === mode;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  }
  get('marker-guide').textContent = markerMode === 'full'
    ? 'MINT RING = SAFE AT THIS SPEED'
    : markerMode === 'neutral' ? 'LANDING POSITION · NO SAFETY COLOUR' : 'NO LANDING PREVIEW';
  canvas.setAttribute('aria-label', markerMode === 'full'
    ? 'Automatic hopping. Hold for FAST; release for SLOW. Mint ring predicts a safe landing at the current speed.'
    : markerMode === 'neutral'
      ? 'Automatic hopping. Hold for FAST; release for SLOW. The neutral ring shows a projected landing position, not safety.'
      : 'Automatic hopping. Hold for FAST; release for SLOW. No landing marker is shown. Judge the terrain and your rhythm.');
}
function loadCourse() {
  audio.stop();
  const requestedLanguage = new URL(location.href).searchParams.get('lang');
  if (requestedLanguage === 'en' || requestedLanguage === 'ja') {
    language = requestedLanguage; savePreference('hoppod.pref.lang', language);
  }
  markerMode = markerModeFromUrl(location.href);
  comparisonEnabled = new URL(location.href).searchParams.get('compare') === '1';
  run = resolveRun(location.href);
  history.replaceState(null, '', markerUrl(run.url));
  syncMarkerUI();
  try { best = Math.max(0, Math.floor(Number(localStorage.getItem(bestKey())) || 0)); if (!Number.isFinite(best)) best = 0; } catch { best = 0; }
  // Both modes use the exact same date/seed and storage keys across languages.
  for (const mode of ['daily', 'free']) {
    get(mode).classList.toggle('selected', run.mode === mode);
    get(mode).setAttribute('aria-pressed', String(run.mode === mode));
  }
  state = newRun(); terrain = new Terrain(run.seed);
  running = false; paused = false; deathAge = 0; particles = []; landAge = 10; signal = 0; signalAge = 10; notice = null; recordNotified = false; lastRecord = false;
  layout = new PartLayout(run.seed); parts = new PartRun(layout); flights = []; crewAge = -1;
  get('share-actions').hidden = true; get('result-details').hidden = true;
  get('overlay').dataset.screen = 'start'; get('overlay').hidden = false;
  refreshOverlay(); refreshCopy(); releaseInput();
}
function overlay(title, subtitle, button) {
  get('overlay-title').textContent = title; get('overlay-subtitle').textContent = subtitle;
  get('action').textContent = button; get('overlay').hidden = false;
}
function reset() {
  audio.stop();
  get('action').blur();
  audio.unlock(); state = newRun(); terrain = new Terrain(run.seed);
  running = true; paused = false; lastTime = null;
  deathAge = 0; landAge = 10; particles = []; failure = ''; signal = 0; signalAge = 10; notice = null; recordNotified = false;
  parts = new PartRun(layout); flights = []; crewAge = -1;
  releaseInput(); get('overlay').hidden = true;
  get('share-actions').hidden = true; get('result-details').hidden = true;
}
function updateHud() {
  if (!state) return;
  get('score').textContent = String(state.hops);
  // Live record indication; BEST is not persisted until the run ends.
  get('best').textContent = String(Math.max(best,state.hops));
  get('hold').classList.toggle('active', fast()); get('hold').setAttribute('aria-pressed', String(fast()));
  get('hold-state').textContent = fast() ? 'FAST' : 'SLOW';
  get('hold-instruction').textContent = tr(fast() ? 'toSlow' : 'toFast');
  const chip = get('milestone-notice'), visible = running && !paused && notice && worldTime < noticeUntil;
  chip.hidden = !visible;
  if (visible) chip.textContent = notice.kind === 'record' ? tr('record') : milestoneText(language,notice.hops);
}
function endRun() {
  audio.stop();
  failureKind = landingMiss(terrain, state.x, state.hopStartX) === 'short' ? 'short' : 'far';
  failureX = state.x; running = false; deathAge = .001; audio.play('fall');
  const record = state.hops > best; lastRecord = record;
  if (record) { best = state.hops; savePreference(bestKey(),String(best)); }
  releaseInput(); get('overlay').dataset.screen = 'result';
  get('result-score').textContent = String(state.hops); get('result-best').textContent = String(best);
  refreshResult();
  get('result-details').hidden = false; get('share-actions').hidden = false;
  refreshOverlay();
}
function pause() {
  audio.stop();
  releaseInput(); if (!running || paused) return;
  paused = true; lastTime = null; get('overlay').dataset.screen = 'pause';
  refreshOverlay();
}
get('action').addEventListener('click', () => {
  audio.unlock();
  if (paused) { paused = false; releaseInput(); lastTime = null; get('overlay').hidden = true; get('action').blur(); }
  else reset();
});
for (const mode of ['daily', 'free']) get(mode).addEventListener('click', () => {
  releaseInput(); const url = new URL(location.href);
  url.search = mode === 'daily' ? '?mode=daily&date=' + jstDate() : '?mode=free';
  history.replaceState(null, '', markerUrl(url)); loadCourse();
});
for (const mode of MARKER_MODES) get('marker-' + mode).addEventListener('click', () => {
  // Reset to exactly the same seed on every switch, so A/B/C is comparable.
  history.replaceState(null, '', markerUrl(location.href, mode));
  loadCourse();
});
window.addEventListener('popstate', loadCourse);
get('sound').addEventListener('click', () => {
  audio.unlock(); const muted = audio.toggle(); savePreference('hoppod.pref.muted',muted?'1':'0');
  refreshCopy();
});
get('language').addEventListener('click', () => {
  language = language === 'ja' ? 'en' : 'ja';
  savePreference('hoppod.pref.lang',language); refreshCopy();
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
get('share').addEventListener('click', () => window.open(shareUrl(run, state.hops, best, language), '_blank', 'noopener,noreferrer'));
get('save').addEventListener('click', () => {
  const c = document.createElement('canvas'); c.width = 1080; c.height = 1350;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  g.fillStyle = '#101f2c'; g.fillRect(0, 0, 1080, 1350);
  g.strokeStyle = '#f0d49a'; g.lineWidth = 3; g.strokeRect(45, 45, 990, 1260);
  for (let i = 0; i < 75; i++) { g.fillStyle = i % 3 ? '#526875' : '#e9c996'; g.fillRect(75 + i * 97 % 930, 80 + i * 137 % 1150, 3, 3); }
  g.textAlign = 'center'; g.fillStyle = '#fff0d0'; g.font = 'bold 90px monospace'; g.fillText('RAPIPPO', 540, 200);
  g.fillStyle = '#ffad73'; g.font = '24px monospace'; g.fillText('O N E  M O R E  H O P !', 540, 252);
  g.fillStyle = '#fff0d0'; g.font = 'bold 190px monospace'; g.fillText(String(state.hops), 540, 510);
  g.font = '32px monospace'; g.fillText(tr('hops') + '  /  ' + tr('best') + ' ' + best, 540, 582);
  // The card shows how far Earth had risen when the run ended.
  g.save(); g.beginPath(); g.rect(45, 45, 990, 890); g.clip();
  drawEarth(g, 820, earthCenterY(earthRise(state.x), 935, 84, 700), 84, 0); g.restore();
  g.fillStyle = '#0d1a24'; g.fillRect(47, 935, 986, 108);
  g.fillStyle = '#718e93'; g.fillRect(330, 970, 420, 8); g.fillStyle = '#25404a'; g.fillRect(330, 978, 420, 65);
  // The run's journey: a built crew hops along half a beat behind; partial
  // progress shows as an exploded pod with the missing parts as ghosts.
  const crew = parts.complete, got = parts.collected, total = layout.crew.parts.length;
  if (crew) drawPod(g, 392, 870, 5, { phase: .5, palette: layout.crew.palette });
  else if (got.length) layout.crew.parts.forEach((part, i) => {
    const have = got.includes(part);
    if (have) { g.fillStyle = 'rgba(79, 157, 255, .18)'; g.beginPath(); g.arc(400, 772 + i * 66, 40, 0, Math.PI * 2); g.fill(); }
    drawPart(g, part, 400, 800 + i * 66, 7, layout.crew.palette, have ? 1 : .28);
  });
  drawPod(g, crew || got.length ? 590 : 540, 960, 8, { phase: .15 });
  g.fillStyle = '#8fd0ff'; g.font = 'bold 30px monospace';
  g.fillText(earthText(language,earthLabel(state.x)) + (crew ? '  ·  ' + tr('crew') : got.length ? '  ·  ' + tr('parts') + ' ' + got.length + '/' + total : ''), 540, 1100);
  g.fillStyle = '#fff0d0'; g.font = '30px monospace';
  g.fillText(run.mode === 'daily' ? tr('scoreDaily')(run.date) : tr('scoreFree')(run.seed), 540, 1155);
  g.fillStyle = '#a2b9ba'; g.font = '22px monospace'; g.fillText('#RAPIPPO  ·  COURSE v' + COURSE_VERSION, 540, 1212);
  const link = document.createElement('a'); link.href = c.toDataURL('image/png');
  link.download = 'RAPIPPO-' + state.hops + '-hops.png'; link.click();
});

function draw(now) {
  const offset = state.x - HERO_X, screen = x => Math.round(x - offset), dead = state.status === 'dead';
  ctx.fillStyle = '#101f2c'; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 44; i++) {
    const x = ((i * 97 - offset * .09) % 390 + 390) % 390;
    ctx.fillStyle = i % 7 ? '#526976' : '#ead6a4'; ctx.fillRect(x | 0, 22 + i * 37 % 220, 2, i % 7 ? 2 : 3);
  }
  // Earth rises from behind the ridges as the pod travels toward the near side.
  const sky = earthRise(state.x);
  if (sky.glow > 0) {
    const glow = ctx.createRadialGradient(EARTH_X, EARTH_HORIZON, 0, EARTH_X, EARTH_HORIZON, 170);
    glow.addColorStop(0, `rgba(110, 172, 240, ${.42 * sky.glow * (1 - sky.climb * .6)})`); glow.addColorStop(1, 'rgba(110, 172, 240, 0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, FLOOR);
  }
  if (state.x >= EARTH_PEEK) drawEarth(ctx, EARTH_X, earthCenterY(sky, EARTH_HORIZON, EARTH_R, EARTH_TOP), EARTH_R, now);
  // The far lunar horizon, just above the tallest ridge: Earth rises from it.
  ctx.fillStyle = '#0d1a24';
  for (let x = -12; x < W + 12; x += 12) ctx.fillRect(x, EARTH_HORIZON + Math.round(Math.sin((x + offset * .012) * .05) * 1.5), 13, FLOOR - EARTH_HORIZON);
  // Distant ridges end at the floor line. Below it is the pit void, so only
  // real platforms are ever drawn at ground level.
  for (let layer = 0; layer < 2; layer++) {
    ctx.fillStyle = layer ? '#172d38' : '#132532';
    for (let x = -28; x < W + 28; x += 28) {
      const height = 20 + (Math.sin((x + offset * (.04 + layer * .03)) * .025) + 1) * (24 + layer * 10);
      ctx.fillRect(x, FLOOR - height, 29, height);
    }
  }
  ctx.fillStyle = '#04080c'; ctx.fillRect(0, FLOOR, W, H - FLOOR);
  for (const platform of terrain.platforms) {
    const [a, b] = platform, [left, right] = footing(platform);
    const x = screen(a), end = screen(b), l = screen(left), r = screen(right); if (end < 0 || x > W) continue;
    // Lit flat top = collision footing. The INSET rims step down into the pit.
    ctx.fillStyle = '#2e4850'; ctx.fillRect(l, FLOOR, r - l, H - FLOOR);
    for (let k = 0; k < INSET / 2; k++) {
      const drop = 3 + k * 3;
      ctx.fillStyle = '#26404a'; ctx.fillRect(l - 2 - k * 2, FLOOR + drop, 2, H); ctx.fillRect(r + k * 2, FLOOR + drop, 2, H);
      ctx.fillStyle = '#56737a'; ctx.fillRect(l - 2 - k * 2, FLOOR + drop, 2, 2); ctx.fillRect(r + k * 2, FLOOR + drop, 2, 2);
    }
    ctx.fillStyle = '#a8b7a5'; ctx.fillRect(l, FLOOR, r - l, 6);
    ctx.fillStyle = '#65858a'; ctx.fillRect(l, FLOOR + 6, r - l, 8);
    ctx.fillStyle = '#42616a';
    for (let tx = left + 5; tx < right - 6; tx += 24) ctx.fillRect(screen(tx), FLOOR + 27 + Math.round(tx) % 19, 6, 3);
    ctx.fillStyle = '#edcf98'; ctx.fillRect(l, FLOOR, 2, 5); ctx.fillRect(r - 2, FLOOR, 2, 5);
  }
  // The active part rests on the footing with a soft blue glow.
  const slot = parts.active, sx = slot && screen(slot.x);
  if (slot && sx > -20 && sx < W + 20) {
    const pulse = reducedMotion.matches ? .5 : .5 + .5 * Math.sin(now * 4);
    ctx.fillStyle = `rgba(79, 157, 255, ${.14 + .12 * pulse})`; ctx.beginPath(); ctx.arc(sx, FLOOR - 9, 12, 0, Math.PI * 2); ctx.fill();
    drawPart(ctx, slot.part, sx, FLOOR - 1 - (reducedMotion.matches ? 0 : Math.round(pulse)), 2, layout.crew.palette);
  }
  const height = running || paused ? Math.sin(state.phase / PERIOD * Math.PI) * 96 : 0;
  const heroY = FLOOR - 2 - height + (dead ? Math.min(110, deathAge * deathAge * 160) : 0);
  if (!dead && get('overlay').hidden && markerMode !== 'off') {
    const projected = predictLanding(state, fast()), x = screen(projected);
    const visual = markerVisual(markerMode, markerMode === 'full' && isSafe(terrain, projected));
    ctx.strokeStyle = visual.color; ctx.lineWidth = 1; ctx.setLineDash([2, 5]);
    ctx.beginPath(); ctx.moveTo(HERO_X + 12, heroY - 12); ctx.lineTo(x, FLOOR - 5); ctx.stroke(); ctx.setLineDash([]);
    ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, FLOOR - 3, 12, 4, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, FLOOR - 22, 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - state.phase / PERIOD)); ctx.stroke();
    if (visual.hint) { ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = visual.color;
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
  if (crewAge >= 0) {
    // Assembly runs during play: parts leave the tray and meet behind the
    // hero, a small flash, the pod appears dark-eyed, then boots and follows.
    const x = HERO_X - COMPANION_GAP, y = FLOOR - 2 - companionLift(state.phase);
    const bob = !running || paused ? Math.round(Math.sin(now * 3) * 2) : 0;
    if (crewAge < ASSEMBLE_GATHER) {
      const k = gatherBlend(crewAge);
      // Stacked as the pod they become: antenna on top, engine underneath.
      layout.crew.parts.forEach((part, i) => {
        const ty = y - 8 + (i - 1) * 7;
        drawPart(ctx, part, trayX(i) + (x - trayX(i)) * k, TRAY_Y + 4 + (ty - TRAY_Y - 4) * k, 1, layout.crew.palette);
      });
    } else {
      if (!reducedMotion.matches && crewAge >= ASSEMBLE_BOOT && running) { ctx.fillStyle = (now * 12 | 0) % 2 ? '#4f9dff' : '#a9d6ff'; ctx.fillRect(x - 2, y + 2, 4, 2); }
      drawPod(ctx, x, y + bob, 1, { phase: companionPhase(state.phase), time: now, palette: layout.crew.palette, eyes: crewAge >= ASSEMBLE_BOOT });
    }
    if (crewAge > ASSEMBLE_GATHER - .05 && crewAge < ASSEMBLE_FLASH && !reducedMotion.matches) {
      const k = (crewAge - ASSEMBLE_GATHER + .05) / (ASSEMBLE_FLASH - ASSEMBLE_GATHER + .05);
      ctx.strokeStyle = `rgba(214, 238, 255, ${1 - k})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y - 12, 5 + k * 14, 0, Math.PI * 2); ctx.stroke();
    }
  }
  drawPod(ctx, HERO_X, heroY, 2, { phase: state.phase / PERIOD, fast: modeFast, land: Math.max(0, 1 - landAge / .13), dead: dead ? deathAge : 0, time: now, idle: !running, signal: sky.signal });
  if (signalAge < .7 && !reducedMotion.matches && !dead) {
    ctx.lineWidth = 2;
    for (const lag of [0, .18]) {
      const age = signalAge - lag; if (age < 0) continue;
      ctx.strokeStyle = `rgba(143, 208, 255, ${Math.max(0, 1 - age / .5)})`;
      ctx.beginPath(); ctx.arc(HERO_X, heroY - 60, 8 + age * 46, -Math.PI * .8, -Math.PI * .2); ctx.stroke();
    }
  }
  // Parts tray: three faint frames in the corner, only while a crew is being
  // built. A collected part lands in its frame when its little flight ends.
  const trayOn = !parts.complete && (parts.collected.length > 0 || state.hops >= layout.slot(0).hop - 3);
  if (trayOn || (crewAge >= 0 && crewAge < ASSEMBLE_GATHER)) {
    ctx.lineWidth = 1; ctx.strokeStyle = '#2c4656';
    layout.crew.parts.forEach((part, i) => {
      ctx.strokeRect(trayX(i) - 5.5, TRAY_Y - 5.5, 11, 11);
      if (trayOn && parts.collected.includes(part) && !flights.some(f => f.part === part)) drawPart(ctx, part, trayX(i), TRAY_Y + 4, 1, layout.crew.palette);
    });
  }
  for (const f of flights) {
    const i = layout.crew.parts.indexOf(f.part), k = 1 - (1 - Math.min(1, f.age / FLIGHT)) ** 2;
    drawPart(ctx, f.part, f.x + (trayX(i) - f.x) * k, f.y + (TRAY_Y + 4 - f.y) * k - Math.sin(k * Math.PI) * 24, k < .5 ? 2 : 1, layout.crew.palette);
  }
  // Signal bars: the only HUD trace of the worldview. No text.
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = i < sky.signal ? (signalAge < .7 ? '#e9f6ff' : '#8fd0ff') : '#24394a';
    ctx.fillRect(W - 40 + i * 6, 28 - (4 + i * 2), 4, 4 + i * 2);
  }
  ctx.textAlign = 'left'; ctx.font = 'bold 10px monospace'; ctx.fillStyle = modeFast ? '#ffb17b' : '#8ee6c4'; ctx.fillText(modeFast ? '» FAST' : '· SLOW', 16, 26);
  if (running && state.hops < 3) {
    ctx.textAlign = 'center'; ctx.fillStyle = '#c3d1c7'; ctx.font = '11px monospace';
    ctx.fillText(language==='ja' ? ['自動でジャンプ','押す → FAST','離す → SLOW'][state.hops] : ['AUTO HOP. YOUR PACE.', 'HOLD → FAST', 'RELEASE → SLOW'][state.hops], W / 2, 190);
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
        if (milestoneTier(state.hops)) showNotice('milestone',state.hops);
        if (best > 0 && state.hops > best && !recordNotified) {
          recordNotified = true; showNotice('record',state.hops);
        }
        const got = parts.land(state.x, state.hops);
        if (got?.type === 'collect') {
          audio.pickup(.03); flights.push({ part: got.part, x: Math.round(got.x - state.x + HERO_X), y: FLOOR - 9, age: 0 });
          if (!reducedMotion.matches) for (let i = 0; i < 8; i++) particles.push({x: got.x, vx: (i - 3.5) * 22, vy: -50 - i % 3 * 18, age: 0, color: i % 2 ? '#a9d6ff' : '#4f9dff'});
          if (got.complete) { crewAge = 0; audio.boot(ASSEMBLE_BOOT); }
        } else if (companionBell(state.hops, parts.completedAt, milestoneTier(state.hops))) audio.bell(COMPANION_LAG);
        if (!reducedMotion.matches) for (let i = 0; i < 8; i++) particles.push({x: state.x, vx: (i - 3.5) * 17, vy: -20 - i % 3 * 10, age: 0, color: i % 2 ? '#efdaad' : '#8ee6c4'});
      }
      const level = earthRise(state.x).signal;
      if (level > signal) signalAge = 0;
      signal = level; signalAge += dt;
      if (state.status === 'dead') endRun();
    }
  }
  if (deathAge > 0) deathAge += Math.min(dt, .05);
  if (crewAge >= 0) crewAge += Math.min(dt, .05);
  flights.forEach(f => f.age += Math.min(dt, .05)); flights = flights.filter(f => f.age < FLIGHT);
  particles.forEach(p => p.age += Math.min(dt, .05)); particles = particles.filter(p => p.age < .35);
  updateHud(); draw(worldTime); requestAnimationFrame(frame);
}
loadCourse(); requestAnimationFrame(frame);
// Browser tests may inject a probe before load to read (never write) the run.
if (globalThis.__rapippoProbe) globalThis.__rapippoProbe.read = () => ({ x: state.x, phase: state.phase, hops: state.hops, parts: [...parts.collected] });
