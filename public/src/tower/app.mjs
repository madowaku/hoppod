// The tower's page: input, the beat clock, sound and the screens. The rules live
// in sim.mjs and course.mjs; drawing lives in draw.mjs.
import { PERIOD as BEAT } from '../engine.mjs';
import { drawPod } from '../pod.mjs';
import { BeatClock, TimedInput, heardFromContext, beatIndex } from '../story/beat.mjs';
import { createWorkshopAudio } from '../workshop/audio.mjs';
import { COURSE, stationAt, heightAt, STATIONS } from './course.mjs';
import { newRun, runFrom, advance, cloneRun, assisted, FALL_BEATS, ASSIST_FAILS } from './sim.mjs';
import { BAR, STEP, towerBar, heartBar, CARD_BAR, DAWN_FROM } from './music.mjs';
import { towerCopy, chooseLanguage, withLanguage } from './copy.mjs';
import { W, H, FLOOR, rect, drawBackdrop, drawPlatforms, drawPendulums, drawGears, drawBell, drawLanterns, drawBurst, drawMorning, drawFace, drawGear } from './draw.mjs';

const $ = id => document.getElementById(id);
const canvas = $('play'), ctx = canvas.getContext('2d');
const HERO_X = 130, LOOKAHEAD = .15, STALL = .5;
const SAVE_KEY = 'hoppod.tower.v1';
// From the strike: the hero drops into the clock, and the heart's first tick comes
// this many beats later.
const HEART_AFTER = 3;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const audio = createWorkshopAudio();
const clock = new BeatClock(perf => heardFromContext(audio.context, perf));
const input = new TimedInput();
const pointers = new Set(), keys = new Set();
const params = new URL(location.href).searchParams;
const read = key => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key, value) => { try { localStorage.setItem(key, value); } catch { /* this session only */ } };
let language = chooseLanguage(location.href, read('hoppod.pref.lang'));
const tr = key => towerCopy(language, key);
if (read('hoppod.pref.muted') === '1') audio.setMuted(true);
const canBuzz = typeof navigator.vibrate === 'function';
let buzzOn = canBuzz && read('hoppod.pref.buzz') !== '0';
const BUZZ = { gear: [10], hit: [40], spring: [14], dock: [80] };
const buzz = type => { if (buzzOn && BUZZ[type]) try { navigator.vibrate(BUZZ[type]); } catch { /* ignored */ } };

function loadSave() {
  try {
    const save = JSON.parse(read(SAVE_KEY) || 'null');
    if (!save || !Number.isInteger(save.checkpoint) || save.checkpoint < 0 || save.checkpoint >= COURSE.checkpoints.length) return null;
    const gears = Array.isArray(save.gears) ? save.gears.filter(g => Number.isInteger(g) && g >= 0 && g < COURSE.gears.length) : [];
    return { checkpoint: save.checkpoint, gears: [...new Set(gears)] };
  } catch { return null; }
}
let saved = loadSave();

let screen = 'start', run = newRun(), ahead = run, s = 0, nextStep = 0, banner = null, cam = 0, camDelta = 0;
const rings = new Map(), crumble = new Map(), gotAt = new Map(), litLanterns = new Set(), cued = new Set(), particles = [];
let hint = null, assistShown = -1, lockAt = null, finaleT0 = null, cardShown = false, rangAt = -9, bursts = [];
const perfNow = () => performance.now() / 1000;
const fast = () => pointers.size + keys.size > 0;
const playing = () => screen === 'play';
const steering = () => playing() && run.status !== 'docked';
const level = () => Math.max(0, STATIONS.indexOf(run.stationId));
const heartBeats = () => finaleT0 === null ? -99 : (s - finaleT0) / BEAT;

function reset() {
  rings.clear(); crumble.clear(); gotAt.clear(); litLanterns.clear(); cued.clear(); particles.length = 0; bursts = [];
  hint = null; banner = null; assistShown = -1; lockAt = null; finaleT0 = null; cardShown = false; rangAt = -9; cam = 0; camDelta = 0;
}
function start(from = null) {
  audio.unlock(); audio.cancel(); reset();
  run = from ? runFrom(COURSE, from.checkpoint, { gears: from.gears }) : newRun();
  for (let i = 1; i <= run.checkpoint; i++) litLanterns.add(i);
  ahead = cloneRun(run); s = run.t;
  clock.start(s, perfNow()); input.reset(s, false); nextStep = Math.ceil(s / STEP);
  releaseInput(); screen = 'play'; $('overlay').hidden = true; $('action').blur();
  showBanner(run.stationId); cam = run.x - HERO_X; save(); updateHud();
}
// ?end=1 shows the morning at once, for review.
function startMorning(found = 7) {
  audio.unlock(); audio.cancel(); reset();
  run = newRun(); run.status = 'docked'; run.x = COURSE.dockX + 20; run.stationId = 'bell'; run.station = STATIONS.length - 1;
  run.gears = Array.from({ length: found }, (_, i) => i); run.dockAt = 0;
  s = 0; lockAt = 0; rangAt = 0; finaleT0 = HEART_AFTER * BEAT;
  clock.start(0, perfNow()); input.reset(0, false); nextStep = 0; releaseInput();
  screen = 'play'; $('overlay').hidden = true; updateHud();
}
function pause() {
  releaseInput();
  if (!playing()) return;
  clock.pause(perfNow(), s); audio.cancel(); screen = 'pause'; cued.clear();
  $('overlay').dataset.screen = 'pause'; refreshOverlay(); $('overlay').hidden = false; updateHud();
}
function resume() {
  audio.unlock(); clock.resume(perfNow());
  s = clock.now(perfNow()); input.reset(s, false); nextStep = Math.ceil(s / STEP);
  releaseInput(); screen = 'play'; $('action').blur();
  if (cardShown) { $('overlay').dataset.screen = 'end'; refreshOverlay(); } else $('overlay').hidden = true;
  updateHud();
}
function toEndCard() {
  cardShown = true;
  $('overlay').dataset.screen = 'end'; refreshOverlay(); $('overlay').hidden = false;
}
function releaseInput() {
  pointers.clear(); keys.clear();
  if (playing()) input.push(clock.at(perfNow()), false);
  updateHud();
}
function press(on, stamp) {
  if (!steering()) return;
  const now = perfNow(), at = Math.abs(stamp / 1000 - now) < .25 ? Math.min(now, stamp / 1000) : now;
  input.push(clock.at(at), on);
}
function showBanner(id) { banner = { id, at: s }; $('chapter-label').textContent = tr('stations')[id] || ''; }
function showHint(key) { hint = { text: typeof key === 'string' ? (tr('hints')[key] ?? key) : key, at: s }; }

function refreshOverlay() {
  const kind = $('overlay').dataset.screen;
  $('intro-mark').textContent = '✦ ' + tr('tag') + ' ✦';
  $('title-text').textContent = kind === 'pause' ? tr('pauseTitle') : tr('title');
  $('work-title').textContent = tr('tag');
  $('overlay-subtitle').textContent = kind === 'pause' ? tr('pauseText') : kind === 'end' ? tr('end') + '\n' + tr('gearLine')(run.gears.length) : tr('subtitle');
  $('action').textContent = kind === 'pause' ? tr('resume') : tr('begin');
  $('continue').textContent = tr('cont');
  $('continue').hidden = kind !== 'start' || !saved || saved.checkpoint <= 0;
  $('end-actions').hidden = kind !== 'end';
  document.querySelector('.intro-controls').style.display = kind !== 'start' ? 'none' : '';
}
function refreshCopy() {
  document.documentElement.lang = language;
  $('story-tag').textContent = tr('tag');
  $('auto-hop').textContent = tr('autoHop'); $('intro-hold').textContent = tr('hold'); $('intro-release').textContent = tr('release');
  $('headphones').textContent = tr('headphones'); $('again').textContent = tr('again');
  $('footer-tag').textContent = tr('footer'); $('footer-keys').textContent = tr('keys');
  $('pause').setAttribute('aria-label', tr('pause'));
  const stages = $('to-select'); if (stages) { stages.textContent = tr('stages'); stages.href = 'select.html?lang=' + language; }
  $('language').textContent = language === 'ja' ? 'EN' : '日本語'; $('language').setAttribute('aria-label', tr('switchLanguage'));
  $('buzz').textContent = tr(buzzOn ? 'buzzOn' : 'buzzOff'); $('buzz').setAttribute('aria-pressed', String(buzzOn));
  $('sound').textContent = tr(audio.muted ? 'soundOff' : 'soundOn'); $('sound').setAttribute('aria-pressed', String(!audio.muted));
  if (banner) $('chapter-label').textContent = tr('stations')[banner.id] || '';
  refreshOverlay(); updateHud();
}
function updateHud() {
  const on = fast();
  $('hold').disabled = !steering(); $('pause').hidden = !playing();
  $('hold').classList.toggle('active', on); $('hold').setAttribute('aria-pressed', String(on));
  $('hold-state').textContent = on ? 'FAST' : 'SLOW';
  $('hold-instruction').textContent = tr(on ? 'toSlow' : 'toFast');
}
$('action').addEventListener('click', () => {
  if (screen === 'pause') { resume(); return; }
  if (params.get('end') === '1') { startMorning(Number(params.get('gears') ?? 7)); return; }
  const cp = Number(params.get('cp'));
  saved = { checkpoint: 0, gears: [] }; write(SAVE_KEY, JSON.stringify(saved));
  start(Number.isInteger(cp) && cp > 0 && cp < COURSE.checkpoints.length ? { checkpoint: cp, gears: [] } : null);
});
$('continue').addEventListener('click', () => { if (saved) start(saved); });
$('again').addEventListener('click', () => { audio.cancel(); screen = 'start'; run = newRun(); reset(); saved = loadSave(); $('overlay').dataset.screen = 'start'; refreshOverlay(); updateHud(); });
$('pause').addEventListener('click', () => { $('pause').blur(); pause(); });
$('sound').addEventListener('click', () => { $('sound').blur(); audio.unlock(); audio.setMuted(!audio.muted); write('hoppod.pref.muted', audio.muted ? '1' : '0'); refreshCopy(); });
$('buzz').hidden = !canBuzz;
$('buzz').addEventListener('click', () => { $('buzz').blur(); buzzOn = !buzzOn; write('hoppod.pref.buzz', buzzOn ? '1' : '0'); refreshCopy(); });
$('language').addEventListener('click', () => {
  $('language').blur(); language = language === 'ja' ? 'en' : 'ja';
  write('hoppod.pref.lang', language); history.replaceState(history.state, '', withLanguage(location.href, language)); refreshCopy();
});
for (const target of [canvas, $('hold')]) {
  target.addEventListener('pointerdown', e => {
    if (!steering() || e.button > 0) return;
    e.preventDefault(); audio.unlock(); pointers.add(e.pointerId); target.setPointerCapture(e.pointerId);
    press(true, e.timeStamp); updateHud();
  });
  target.addEventListener('lostpointercapture', e => { if (pointers.delete(e.pointerId) && !fast()) press(false, e.timeStamp); updateHud(); });
}
window.addEventListener('pointerup', e => { if (pointers.delete(e.pointerId) && !fast()) press(false, e.timeStamp); updateHud(); });
window.addEventListener('pointercancel', releaseInput);
window.addEventListener('keydown', e => {
  if (e.code === 'Space') {
    if (!playing() || (document.activeElement?.tagName === 'BUTTON' && document.activeElement !== $('hold'))) return;
    e.preventDefault();
    if (!steering()) return;
    if (!e.repeat && !keys.has('Space')) { audio.unlock(); const was = fast(); keys.add('Space'); if (!was) press(true, e.timeStamp); updateHud(); }
  }
  if (e.code === 'Escape') pause();
});
window.addEventListener('keyup', e => { if (e.code === 'Space' && keys.delete('Space')) { if (!fast()) press(false, e.timeStamp); updateHud(); } });
window.addEventListener('blur', pause);
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('pagehide', pause);

// ---------- sound ----------
const when = t => { const c = audio.context, at = clock.contextTime(t); return c && at !== null ? Math.max(c.currentTime + .004, at) : null; };
const eventKey = e => e.type + ':' + e.beat + ':' + (e.gear ?? e.platform ?? '') + ':' + Math.round((e.t ?? 0) * 240);
const PREDICTED = new Set(['land', 'spring', 'gear', 'hit', 'fall', 'respawn', 'dock']);
function bell(at, v = 1) {
  for (const [m, d, vol] of [[43, 5, .9], [55, 4, .7], [62, 3.2, .45], [67, 2.6, .35], [74, 1.8, .25]]) audio.note({ part: 'tongue', midi: m, dur: d, v: vol * v }, at, 'live');
  audio.note({ part: 'crash', v: .45 * v }, at, 'live');
}
function playEvent(e) {
  const at = when(e.t ?? s);
  if (at === null) return;
  probeNote(e.type, at, e.t);
  if (e.type === 'land') {
    audio.hopTick(at);
    if (e.kind === 'tick') audio.note({ part: 'drums', voice: 'block', v: .7 }, at, 'live');
    else if (e.kind === 'tock') audio.note({ part: 'keys', midi: 60, dur: .1, v: .45 }, at, 'live');
    else if (e.kind === 'hand') audio.note({ part: 'harp', midi: 79, dur: .3, v: .4 }, at, 'live');
    else if (e.kind === 'sand') audio.note({ part: 'drums', voice: 'snare', v: .25 }, at, 'live');
    else if (e.kind === 'stair' || e.kind === 'top') audio.note({ part: 'keys', midi: 67 + COURSE.stairs.findIndex(p => p.i === e.platform) * 2, dur: .3, v: .4 }, at, 'live');
  }
  else if (e.type === 'spring') { audio.note({ part: 'harp', midi: 60, dur: .2, v: .5, from: 48 }, at, 'live'); audio.note({ part: 'harp', midi: 72, dur: .3, v: .4, from: 60 }, at + .05, 'live'); }
  else if (e.type === 'gear') audio.chime(at);
  else if (e.type === 'hit') { audio.note({ part: 'drums', voice: 'block', v: 1 }, at, 'live'); audio.fall(at + .05); }
  else if (e.type === 'fall') audio.fall(at);
  else if (e.type === 'respawn') audio.respawn(at);
  else if (e.type === 'dock') bell(at);
}
function predict() {
  if (!audio.running || clock.domain !== 'audio' || run.status === 'docked') { ahead = run; return; }
  ahead = cloneRun(run);
  const front = audio.context.currentTime + LOOKAHEAD - clock.offset, events = [];
  if (front > run.t) advance(ahead, COURSE, front, input.fast, events);
  for (const e of events) if (PREDICTED.has(e.type) && !cued.has(eventKey(e))) { cued.add(eventKey(e)); playEvent(e); }
}
const barCache = new Map();
function barNotes(bar) {
  const key = (finaleT0 === null ? 'p' + level() : 'h') + ':' + bar;
  if (!barCache.has(key)) { barCache.set(key, finaleT0 === null ? towerBar(bar, level(), { v: .55 }) : heartBar(bar)); if (barCache.size > 24) barCache.delete(barCache.keys().next().value); }
  return barCache.get(key);
}
function scheduleMusic() {
  const c = audio.context;
  if (!audio.running || clock.domain !== 'audio') { nextStep = Math.max(nextStep, Math.ceil(s / STEP)); return; }
  const horizon = c.currentTime + LOOKAHEAD, origin = finaleT0 ?? 0;
  if (nextStep * STEP < s - .5) nextStep = Math.ceil(s / STEP);
  // Between the strike and the heart, only the bell.
  if (finaleT0 !== null && s < finaleT0 - LOOKAHEAD) { nextStep = Math.ceil(finaleT0 / STEP); return; }
  for (;;) {
    const t = nextStep * STEP, at = clock.contextTime(t);
    if (at > horizon) break;
    if (at > c.currentTime + .003 && t - origin >= -1e-9) {
      const rel = Math.round((t - origin) / STEP), bar = Math.floor(rel / 16), into = (rel % 16) * STEP;
      if (finaleT0 !== null && rel % 4 === 0) audio.tick(at, rel % 8 === 4);
      if (finaleT0 !== null || run.status === 'playing') for (const n of barNotes(bar)) if (n.t >= into - 1e-9 && n.t < into + STEP - 1e-9) { audio.note(n, at + n.t - into, finaleT0 !== null ? 'live' : 'bed'); probeNote(n.part, at + n.t - into, t); }
      if (finaleT0 !== null && rel === DAWN_FROM * 16) bell(at, .7);
    }
    nextStep += 1;
  }
}

// ---------- events ----------
function handle(events) {
  for (const e of events) {
    if (PREDICTED.has(e.type) && !cued.has(eventKey(e))) { cued.add(eventKey(e)); playEvent(e); }
    probeEvent(e); buzz(e.type);
    if (e.type === 'land') {
      rings.set(e.platform, e.t ?? s);
      if (!reducedMotion.matches) particles.push({ x: e.x, at: e.t ?? s });
      for (const i of run.sandUsed) if (!crumble.has(i)) crumble.set(i, e.t ?? s);
    }
    if (e.type === 'gear') gotAt.set(e.gear, e.t ?? s);
    if (e.type === 'station') { showBanner(e.id); save(); }
    if (e.type === 'checkpoint') { litLanterns.add(e.index); save(); }
    if (e.type === 'fall' || e.type === 'hit') {
      for (const i of run.sandUsed) if (!crumble.has(i)) crumble.set(i, e.t ?? s);
      const fails = run.fails[run.checkpoint] || 0;
      if (fails >= ASSIST_FAILS && assistShown !== run.checkpoint) { assistShown = run.checkpoint; showHint(tr('assist')); }
      else if (fails >= 2) showHint(e.type === 'hit' ? 'hit' : e.kind);
    }
    if (e.type === 'respawn') { camDelta = 0; crumble.clear(); for (const p of COURSE.platforms) if (p.kind === 'sand') rings.delete(p.i); }
    if (e.type === 'dock') beginMorning(e);
  }
}
function save() { saved = { checkpoint: run.checkpoint, gears: run.gears }; write(SAVE_KEY, JSON.stringify(saved)); }
function beginMorning(e) {
  releaseInput(); lockAt = e.t; rangAt = e.t; finaleT0 = e.t + HEART_AFTER * BEAT; nextStep = Math.ceil(finaleT0 / STEP);
  bursts.push({ x: COURSE.bellX, y: FLOOR - 110 - 70, at: e.t, power: 1 });
  write(SAVE_KEY + '.cleared', '1');
  const best = Number(read(SAVE_KEY + '.best') || 0); if (run.gears.length > best) write(SAVE_KEY + '.best', String(run.gears.length));
  saved = { checkpoint: 0, gears: [] }; write(SAVE_KEY, JSON.stringify(saved));
  updateHud();
}
const probe = globalThis.__rapippoTowerProbe;
function probeNote(part, at, storyTime) { if (probe) (probe.notes ||= []).push({ part, at, s: storyTime }); }
function probeEvent(e) { if (probe) (probe.events ||= []).push({ type: e.type, t: e.t, beat: e.beat, kind: e.kind, gear: e.gear }); }

// ---------- drawing ----------
const smooth01 = k => { const v = Math.max(0, Math.min(1, k)); return v * v * (3 - 2 * v); };
function heroState() {
  if (run.status === 'falling') {
    const k = Math.max(0, (s - run.fallAt * BEAT) / (FALL_BEATS * BEAT));
    if (run.fallKind === 'hit') return { x: run.fallX - k * 40, y: FLOOR - 2 - Math.sin(Math.min(1, k * 2) * Math.PI) * 40 + k * k * 160, phase: 0, land: 0, dead: k };
    return { x: run.fallX, y: FLOOR - 2 + k * k * 170, phase: 0, land: 0, dead: k };
  }
  const beat = beatIndex(s), phase = Math.max(0, Math.min(1, (s - beat * BEAT) / BEAT));
  const to = heightAt(run.x), from = heightAt(run.hopStartX), h = from + (to - from) * phase;
  const arc = run.boost ? 124 : 96;
  return { x: run.x, y: FLOOR - 2 - h - Math.sin(phase * Math.PI) * arc, phase, land: s - beat * BEAT < .1 ? 1 - (s - beat * BEAT) / .1 : 0, dead: 0 };
}
const CAMERA_RATE = 4;
function steerCamera(dt) {
  let target = run.x - HERO_X;
  // Before a clock hand the view moves on ahead, so the hand and its lamps are in
  // sight while there is still ledge to wait on (owner playtest).
  const hand = COURSE.platforms.find(p => p.kind === 'hand' && p.b > run.x);
  if (hand && hand.a - run.x < 560) target = run.x - 36;
  if (run.stationId === 'bell') target = Math.min(target, COURSE.bellX - W / 2 - 30);
  camDelta += cam - (target + camDelta);
  camDelta *= Math.exp(-dt * CAMERA_RATE);
  cam = target + camDelta;
}
function drawWorld() {
  const reduced = reducedMotion.matches, hero = heroState(), screenX = hero.x - cam;
  drawBackdrop(ctx, cam, level(), s, reduced);
  drawGears(ctx, cam, run.gears, s, gotAt);
  drawBell(ctx, cam, s, rangAt);
  drawPlatforms(ctx, cam, run, s, rings, crumble, assisted(run));
  drawLanterns(ctx, cam, litLanterns, s);
  drawPendulums(ctx, cam, s, assisted(run));
  for (const p of particles) { const age = s - p.at; if (age >= 0 && age < .3) { ctx.globalAlpha = 1 - age / .3; rect(ctx, '#efdaad', p.x - cam - 12 - age * 40, FLOOR - heightAt(p.x), 3, 2); rect(ctx, '#efdaad', p.x - cam + 9 + age * 40, FLOOR - heightAt(p.x), 3, 2); ctx.globalAlpha = 1; } }
  while (particles.length && s - particles[0].at > 1) particles.shift();
  // A coil's hop leaves a short trail.
  if (run.boost && run.status === 'playing' && !reduced) for (let k = 1; k <= 3; k++) { ctx.globalAlpha = .25 / k; drawPod(ctx, screenX - k * 14, hero.y + k * 3, 2, { phase: hero.phase, time: s }); }
  ctx.globalAlpha = 1;
  drawPod(ctx, screenX, hero.y, 2, { phase: hero.phase, land: hero.land, fast: input.fast, time: s, dead: hero.dead });
  for (const b of bursts) drawBurst(ctx, b.x - cam, b.y, s - b.at, b.power, reduced);
  drawHud();
  drawHints();
}
function drawHud() {
  drawGear(ctx, 18, 18, 8, s * .5, '#e8a838');
  ctx.fillStyle = '#ffe6aa'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText(`${run.gears.length}/${COURSE.gears.length}`, 30, 22);
  // The tower's height: one notch per room, the current one lit.
  for (let k = 0; k < STATIONS.length; k++) rect(ctx, k <= level() ? '#ffd98a' : '#4a3f52', W - 14, 14 + (STATIONS.length - 1 - k) * 8, 6, 5);
}
function drawHints() {
  ctx.textAlign = 'center';
  if (banner && s - banner.at < 3.4) {
    const a = Math.min(1, (s - banner.at) / .3, (3.4 - (s - banner.at)) / .4);
    ctx.globalAlpha = a; ctx.fillStyle = '#0b0a14cc'; ctx.fillRect(0, 196, W, 48);
    ctx.fillStyle = '#f0c67a'; ctx.font = 'bold 15px sans-serif'; ctx.fillText(tr('stations')[banner.id] || '', W / 2, 216);
    ctx.fillStyle = '#f6e4c2'; ctx.font = '11px sans-serif'; ctx.fillText(tr('finds')[banner.id] || '', W / 2, 234);
    ctx.globalAlpha = 1;
  } else if (hint && s - hint.at < 3.4) {
    ctx.globalAlpha = Math.min(1, (3.4 - (s - hint.at)) / .4); ctx.fillStyle = '#0b0a14aa'; ctx.fillRect(0, 202, W, 22);
    ctx.fillStyle = '#f6e4c2'; ctx.font = '11px sans-serif'; ctx.fillText(hint.text, W / 2, 217); ctx.globalAlpha = 1;
  }
}
// The strike, the drop into the clock, then the heart and the morning.
function drawFinale() {
  const reduced = reducedMotion.matches, since = s - lockAt, beats = heartBeats();
  if (beats < -1) {
    // The strike: the world, the bell swinging, the hero bouncing off it upwards.
    drawBackdrop(ctx, cam, 7, s, reduced); drawBell(ctx, cam, s, rangAt); drawPlatforms(ctx, cam, run, s, rings, crumble, false);
    const k = Math.min(1, since / (BEAT * 1.5)), x = run.x - cam + k * 40, y = FLOOR - 112 - Math.sin(k * Math.PI) * 120 - k * 40;
    drawPod(ctx, x, y, 2, { phase: .5, time: s });
    for (const b of bursts) drawBurst(ctx, b.x - cam, b.y, s - b.at, b.power, reduced);
    if (since < .5) { ctx.globalAlpha = (1 - since / .5) * (reduced ? .2 : .5); rect(ctx, '#fff1c9', 0, 0, W, H); ctx.globalAlpha = 1; }
    return;
  }
  const scene = drawMorning(ctx, Math.max(0, beats), run.gears.length, s, reduced);
  // The face: 11:55 until the heart starts; one minute a hop to midnight; then the
  // hands run sunwise round to six in the morning while the sun comes up.
  const landings = Math.max(0, Math.floor(beats + 1e-9)), into = beats - Math.floor(beats);
  const snap = Math.min(1, into * 6);
  const toMidnight = Math.min(5, landings + (landings < 5 ? snap : 0));
  const run6 = smooth01((beats - 6) / 22) * 6;
  const minutes = 55 + toMidnight + run6 * 60, hours = 11 + minutes / 60;
  const lit = Math.min(run.gears.length, Math.max(0, landings - 1));
  drawFace(ctx, scene.cx, scene.cy, 96, { minutes, hours, lit, glow: 1 });
  // The heart: the hero at the hub, hopping on the beat it no longer has to make.
  const drop = beats < 0 ? smooth01(beats + 1) : 1;
  const hop = beats >= 0 ? Math.sin(Math.PI * into) : 0;
  const hy = scene.cy + 20 - hop * 22 - (1 - drop) * 220;
  drawPod(ctx, scene.cx, hy, 2, { phase: beats >= 0 ? into : .5, land: beats >= 0 && into < .1 ? 1 - into * 10 : 0, time: s });
  if (beats >= 0 && into < .15 && !reduced) { ctx.globalAlpha = (1 - into / .15) * .5; ctx.strokeStyle = '#ffd98a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(scene.cx, scene.cy, 30 + into * 300, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
  if (beats < .5) { ctx.globalAlpha = 1 - smooth01(beats + 1); rect(ctx, '#0b0a14', 0, 0, W, H); ctx.globalAlpha = 1; }
  // Captions, one at a time, never over the face.
  const caption = beats < 0 ? null : beats < 6 ? tr('heart') : beats < 13 ? tr('every') : beats < 30 ? tr('dawn') : null;
  if (caption) {
    const start = beats < 6 ? 0 : beats < 13 ? 6 : 13, end = beats < 6 ? 6 : beats < 13 ? 13 : 30;
    ctx.globalAlpha = Math.min(1, (beats - start) * 2, (end - beats) * 2); ctx.textAlign = 'center';
    ctx.fillStyle = '#0b0a14aa'; ctx.fillRect(0, 410, W, 28); ctx.fillStyle = '#fff1d2'; ctx.font = 'bold 13px sans-serif'; ctx.fillText(caption, W / 2, 429); ctx.globalAlpha = 1;
  }
}
function drawTitle(t) {
  drawMorning(ctx, 0, 0, t, reducedMotion.matches);
  drawFace(ctx, 180, 420, 44, { minutes: 55, hours: 11.92 });
  const phase = (t % BEAT) / BEAT;
  drawPod(ctx, 60, H - 42 - Math.sin(phase * Math.PI) * 34, 2, { phase, time: t, land: phase < .1 ? 1 - phase * 10 : 0 });
}
function frame() {
  const dt = 1 / 60;
  if (playing()) {
    const now = clock.now(perfNow());
    if (now - s > STALL) pause();
    else {
      s = now;
      const events = [];
      if (run.status === 'docked') run.t = s;
      else input.advance(s, (from, to, f) => advance(run, COURSE, to, f, events));
      predict(); handle(events); steerCamera(dt); scheduleMusic();
      if (audio.running) audio.mix(run.status === 'falling' ? .5 : 1);
      if (finaleT0 !== null && heartBeats() >= CARD_BAR * 4 && !cardShown) toEndCard();
    }
  }
  if (screen === 'start') drawTitle(perfNow());
  else if (lockAt !== null) drawFinale();
  else drawWorld();
  $('beat-mark').classList.toggle('on', playing() && steering() && s - beatIndex(s) * BEAT < .1);
  requestAnimationFrame(frame);
}
run = newRun(); ahead = run; $('overlay').dataset.screen = 'start'; refreshCopy();
requestAnimationFrame(frame);
if (probe) probe.read = () => ({
  screen, s, x: run.x, beat: run.beat, status: run.status, station: run.stationId, checkpoint: run.checkpoint, hops: run.hops, fails: run.fails,
  gears: [...run.gears], heart: heartBeats(), card: cardShown, cam, domain: clock.domain, audio: audio.debug(),
});
