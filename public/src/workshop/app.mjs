// The workshop's page: input, the beat clock, sound scheduling and the screens.
// The rules live in sim.mjs and arrange.mjs; drawing lives in draw.mjs.
import { PERIOD as BEAT } from '../engine.mjs';
import { drawPod } from '../pod.mjs';
import { BeatClock, TimedInput, heardFromContext, beatIndex } from '../story/beat.mjs';
import { COURSE, stationAt, heightAt, rodLean, ROD_LENGTH, CART_HALF, CART_SPEED } from './course.mjs';
import { newRun, runFrom, advance, cloneRun, cartTarget, FALL_BEATS } from './sim.mjs';
import { STEP, BAR, PARTS, ENTRY, TUTTI_FROM, TUTTI_END, CARD_BAR, finaleBar, freeBar, bandBar, bedBar, brassPitch, liveNote, encodeTake, decodeTake, demoRecording, WOOD_MOTIF, replayPartAt, loopFraction } from './arrange.mjs';
import { createWorkshopAudio } from './audio.mjs';
import { workshopCopy, chooseLanguage, withLanguage } from './copy.mjs';
import { W, H, FLOOR, drawBackdrop, drawStationBack, drawPlatforms, drawHarp, drawStrings, drawCart, drawTrombone, drawBellowsAura, drawDarkness, crashRing, drawMetronome, drawGoalStage, drawRunway, drawBurst, drawLockedHero, rodTip, drawBand, drawReplay, drawAllReplay, drawScore, drawLanterns, drawFallHint } from './draw.mjs';

const $ = id => document.getElementById(id);
const canvas = $('play'), ctx = canvas.getContext('2d');
const HERO_X = 130, LOOKAHEAD = .15, STALL = .5;
const SAVE_KEY = 'hoppod.workshop.v1';
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const audio = createWorkshopAudio();
const clock = new BeatClock(perf => heardFromContext(audio.context, perf));
const input = new TimedInput();
const pointers = new Set(), keys = new Set();
const params = new URL(location.href).searchParams;
const read = key => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key, value) => { try { localStorage.setItem(key, value); } catch { /* this session only */ } };
let language = chooseLanguage(location.href, read('hoppod.pref.lang'));
const tr = key => workshopCopy(language, key);
if (read('hoppod.pref.muted') === '1') audio.setMuted(true);
const canBuzz = typeof navigator.vibrate === 'function';
let buzzOn = canBuzz && read('hoppod.pref.buzz') !== '0';
const BUZZ = { wake: [14], chime: [10], dock: [70], crash: [18] };
const buzz = type => { if (buzzOn && BUZZ[type]) try { navigator.vibrate(BUZZ[type]); } catch { /* ignored */ } };

function loadSave() {
  try {
    const save = JSON.parse(read(SAVE_KEY) || 'null');
    if (!save || !Number.isInteger(save.checkpoint) || save.checkpoint < 0 || save.checkpoint >= COURSE.checkpoints.length) return null;
    // Anything malformed is dropped here, not met halfway through the song.
    const clean = take => take && Object.keys(take).length ? decodeTake(encodeTake(take)) ?? {} : {};
    return { checkpoint: save.checkpoint, recording: clean(save.recording), lastTake: save.lastTake ? clean(save.lastTake) : undefined };
  } catch { return null; }
}
const sharedTake = params.has('take') ? decodeTake(params.get('take')) : null;
let saved = loadSave();

// Modes: title → play → (ending) → end card; free: the unlocked free play.
let screen = 'start', mode = 'play', run = newRun(), ahead = null, s = 0, nextStep = 0, banner = null;
let cam = 0, camDelta = 0;
const rings = new Map(), plucks = new Map(), particles = [];
const cued = new Set();
let finaleT0 = null, flash = {}, echoes = {}, heardParts = new Set(), scheduledBar = new Map(), bursts = [];
let takeForFinale = null, freeWide = 0, crashes = [], lockAt = null, cardShown = false, copiedAt = -9;
const perfNow = () => performance.now() / 1000;
const fast = () => pointers.size + keys.size > 0;
const playing = () => screen === 'play';
const steering = () => playing() && (mode === 'free' || (run.status !== 'docked'));
const finaleBeats = () => finaleT0 === null ? -1 : (s - finaleT0) / BEAT;
const finaleBarNow = () => finaleT0 === null ? -1 : Math.floor(finaleBeats() / 4);
const devStart = () => {
  const cp = Number(params.get('cp'));
  if (Number.isInteger(cp) && cp > 0 && cp < COURSE.checkpoints.length) return { checkpoint: cp, recording: demoSubset(COURSE.checkpoints[cp].station) };
  return null;
};
function demoSubset(stationNo) {
  const demo = demoRecording(), out = {};
  for (const part of PARTS) if (COURSE.stations.findIndex(st => st.id === part) < stationNo) out[part] = demo[part];
  return out;
}

function reset() {
  rings.clear(); plucks.clear(); particles.length = 0; cued.clear(); crashes = []; litLanterns.clear(); fallGap = null; hint = null; toast = null;
  cam = 0; camDelta = 0; finaleT0 = null; flash = {}; echoes = {}; bursts = []; heardParts = new Set(); scheduledBar = new Map(); banner = null; lockAt = null; cardShown = false; freeWide = 0;
}
function start(fromSave = null) {
  audio.unlock(); audio.cancel(); reset();
  mode = 'play';
  run = fromSave ? runFrom(COURSE, fromSave.checkpoint, fromSave.recording || {}) : newRun();
  ahead = cloneRun(run); s = 0;
  clock.start(0, perfNow()); input.reset(0, false); nextStep = 0;
  releaseInput(); screen = 'play'; updateHud(); $('overlay').hidden = true; $('action').blur();
  showBanner(run.stationId);
  cam = run.x - HERO_X;
}
function startFinale(recording, listen = false) {
  audio.unlock(); audio.cancel(); reset();
  mode = 'finale'; takeForFinale = recording;
  run = newRun(); run.status = 'docked'; run.x = COURSE.dockX + 24; run.stationId = 'metronome'; run.dockAt = 0; run.listen = listen;
  ahead = cloneRun(run); s = 0; lockAt = 0; finaleT0 = BEAT;
  clock.start(0, perfNow()); input.reset(0, false); nextStep = 0; releaseInput();
  screen = 'play'; updateHud(); $('overlay').hidden = true;
}
function startFree() {
  audio.unlock(); audio.cancel(); reset();
  mode = 'free'; takeForFinale = saved?.lastTake || sharedTake || demoRecording();
  run = newRun(); run.status = 'docked'; run.x = COURSE.dockX; run.stationId = 'metronome'; run.dockAt = 0;
  ahead = cloneRun(run); s = 0; finaleT0 = 0; lockAt = -9;
  clock.start(0, perfNow()); input.reset(0, false); nextStep = 0; releaseInput();
  screen = 'play'; updateHud(); $('overlay').dataset.screen = 'free'; refreshOverlay(); $('overlay').hidden = false;
}
function pause() {
  releaseInput();
  if (!playing()) return;
  clock.pause(perfNow(), s); audio.cancel(); screen = 'pause'; updateHud();
  cued.clear(); scheduledBar = new Map();
  for (const id of [...rings.keys()]) if (rings.get(id) > s) rings.delete(id);
  $('overlay').dataset.screen = 'pause'; refreshOverlay(); $('overlay').hidden = false;
}
function resume() {
  audio.unlock(); clock.resume(perfNow());
  s = clock.now(perfNow()); input.reset(s, false); nextStep = Math.ceil(s / STEP);
  releaseInput(); screen = 'play'; updateHud(); $('action').blur();
  if (mode === 'free') { $('overlay').dataset.screen = 'free'; refreshOverlay(); } else if (cardShown) { $('overlay').dataset.screen = 'end'; refreshOverlay(); } else $('overlay').hidden = true;
}
function toEndCard() {
  cardShown = true;
  $('overlay').dataset.screen = 'end'; refreshOverlay(); $('overlay').hidden = false;
  $('copy-link').textContent = tr('copyLink');
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
function showBanner(id) { banner = { id, at: s }; $('chapter-label').textContent = tr('stations')[id] || ''; updateHud(); }

function refreshOverlay() {
  const kind = $('overlay').dataset.screen;
  $('intro-mark').textContent = '✦ ' + tr('tag') + ' ✦';
  $('title-text').textContent = kind === 'pause' ? tr('pauseTitle') : tr('title');
  $('work-title').textContent = tr('tag');
  $('overlay-subtitle').textContent = kind === 'pause' ? tr('pauseText') : kind === 'end' ? (run.listen ? tr('listening') : '') : kind === 'free' ? tr('freeHint') : sharedTake ? tr('listening') : tr('subtitle');
  $('action').textContent = kind === 'pause' ? tr('resume') : sharedTake ? '▶' : tr('begin');
  $('continue').textContent = sharedTake ? tr('listenOwn') : tr('cont');
  $('continue').hidden = kind !== 'start' || (!sharedTake && (!saved || saved.checkpoint <= 0));
  $('free').textContent = kind === 'free' ? tr('leave') : tr('free');
  $('free').hidden = !((kind === 'start' && read(SAVE_KEY + '.cleared') === '1') || kind === 'free');
  $('end-actions').hidden = kind !== 'end';
  const hideControls = kind !== 'start';
  document.querySelector('.intro-controls').style.display = hideControls ? 'none' : '';
  $('title-text').hidden = kind === 'free';
}
function refreshCopy() {
  document.documentElement.lang = language;
  $('story-tag').textContent = tr('tag');
  $('auto-hop').textContent = tr('autoHop'); $('intro-hold').textContent = tr('hold'); $('intro-release').textContent = tr('release');
  $('headphones').textContent = tr('headphones'); $('again').textContent = tr('again'); $('save-png').textContent = tr('savePng');
  $('copy-link').textContent = tr('copyLink'); $('footer-tag').textContent = tr('footer'); $('footer-keys').textContent = tr('keys');
  $('pause').setAttribute('aria-label', tr('pause')); const stages = $('to-select'); if (stages) { stages.textContent = tr('stages'); stages.href = 'select.html?lang=' + language; } // an old cached page may lack it
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
  // On the bellows the button wears the colour of the plate this input can land on.
  if (playing() && mode === 'play' && run.stationId === 'bellows') $('hold').dataset.tint = on ? 'push' : 'pull'; else delete $('hold').dataset.tint;
  $('hold-state').textContent = on ? 'FAST' : 'SLOW';
  $('hold-instruction').textContent = tr(on ? 'toSlow' : 'toFast');
}
$('action').addEventListener('click', () => {
  if (screen === 'pause') { resume(); return; }
  const dev = devStart();
  if (params.get('end') === '1') startFinale(demoRecording());
  else if (sharedTake && !run.listen && !params.has('play')) startFinale(sharedTake, true);
  else { saved = { checkpoint: 0, recording: {}, lastTake: saved?.lastTake }; write(SAVE_KEY, JSON.stringify(saved)); start(dev); }
});
$('continue').addEventListener('click', () => { if (sharedTake) start(null); else if (saved) start(saved); });
$('free').addEventListener('click', () => {
  $('free').blur();
  if (mode === 'free') { audio.cancel(); mode = 'play'; screen = 'start'; run = newRun(); $('overlay').dataset.screen = 'start'; refreshOverlay(); updateHud(); return; }
  startFree();
});
$('again').addEventListener('click', () => { audio.cancel(); screen = 'start'; mode = 'play'; run = newRun(); $('overlay').dataset.screen = 'start'; saved = loadSave(); refreshOverlay(); updateHud(); });
$('pause').addEventListener('click', () => { $('pause').blur(); pause(); });
$('sound').addEventListener('click', () => { $('sound').blur(); audio.unlock(); audio.setMuted(!audio.muted); write('hoppod.pref.muted', audio.muted ? '1' : '0'); refreshCopy(); });
$('buzz').hidden = !canBuzz;
$('buzz').addEventListener('click', () => { $('buzz').blur(); buzzOn = !buzzOn; write('hoppod.pref.buzz', buzzOn ? '1' : '0'); refreshCopy(); });
$('language').addEventListener('click', () => {
  $('language').blur(); language = language === 'ja' ? 'en' : 'ja';
  write('hoppod.pref.lang', language); history.replaceState(history.state, '', withLanguage(location.href, language)); refreshCopy();
});
$('save-png').addEventListener('click', saveCard);
$('copy-link').addEventListener('click', async () => {
  const url = new URL(location.href); url.search = ''; url.searchParams.set('take', encodeTake(takeForFinale || run.recording)); url.searchParams.set('lang', language);
  try { await navigator.clipboard.writeText(url.toString()); $('copy-link').textContent = tr('copied'); copiedAt = perfNow(); } catch { window.prompt(tr('copyLink'), url.toString()); }
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
const ctxAt = t => clock.contextTime(t);
const when = t => { const c = audio.context, at = ctxAt(t); return c && at !== null ? Math.max(c.currentTime + .004, at) : null; };
const eventKey = e => e.type === 'chatter' ? 'chatter:' + Math.round(e.t * 100) : e.type + ':' + (e.part ?? '') + ':' + e.beat + ':' + (e.string ?? '');
const PREDICTED = new Set(['land', 'note', 'crash', 'rung', 'wake', 'chime', 'fall', 'respawn', 'dock', 'chatter', 'board']);
function playEvent(e) {
  const at = when(e.t ?? s);
  if (at === null) return;
  probeNote(e.type === 'note' ? e.part : e.type, at, e.t);
  if (e.type === 'land') audio.hopTick(at);
  else if (e.type === 'chatter') audio.chatter(at);
  else if (e.type === 'note') {
    if (e.part === 'drums') audio.note({ part: 'drums', voice: e.voice, v: e.soft ? .5 : .85 }, at, 'live');
    else if (e.part === 'brass') { /* the held slide takes its accent in the frame */ }
    else audio.note({ part: e.part, midi: e.midi, dur: e.part === 'strings' ? 1.1 : e.part === 'bellows' ? (e.push ? .34 : .5) : .6, v: e.v ?? (e.part === 'harp' ? .5 : e.part === 'bellows' ? .55 : .7) }, at, 'live');
  }
  else if (e.type === 'crash') audio.note({ part: 'crash', v: e.soft ? .35 : e.last ? 1.1 : .75 }, at, 'live');
  else if (e.type === 'rung') audio.note({ part: 'harp', midi: 67 + e.rung * 5, dur: .3, v: .45 }, at, 'live');
  else if (e.type === 'wake') audio.wake(at);
  else if (e.type === 'chime') audio.chime(at);
  else if (e.type === 'fall') audio.fall(at, e.kind === 'brass');
  else if (e.type === 'respawn') audio.respawn(at);
  else if (e.type === 'dock') audio.lock(at);
}
function predict() {
  if (!audio.running || clock.domain !== 'audio' || run.status === 'docked') { ahead = run; return; }
  ahead = cloneRun(run);
  const front = audio.context.currentTime + LOOKAHEAD - clock.offset, events = [];
  if (front > run.t) advance(ahead, COURSE, front, input.fast, events);
  for (const e of events) if (PREDICTED.has(e.type) && !cued.has(eventKey(e))) { cued.add(eventKey(e)); playEvent(e); }
}
// Each bar's notes are worked out once, then played as their moments come round.
function barNotes(bar) {
  if (scheduledBar.has(bar)) return scheduledBar.get(bar);
  let notes = [];
  if (mode === 'free') notes = freeBar(takeForFinale, bar);
  else if (finaleT0 !== null) notes = finaleBar(takeForFinale ?? run.recording, bar);
  else notes = bedNotes(bar);
  notes = notes.map(n => ({ ...n, slotT: n.t }));
  scheduledBar.set(bar, notes);
  if (scheduledBar.size > 6) scheduledBar.delete(scheduledBar.keys().next().value);
  return notes;
}
// While playing, what has woken so far quietly keeps time under the hero.
function bedNotes(bar) {
  const woken = new Set(PARTS.filter(p => run.recording[p]));
  const id = stationAt(run.x).id;
  if (!woken.size || id === 'metronome') return [];
  const band = bandBar(run.recording, bar, { active: woken, limit: id === 'cymbal' ? 8 : 14 });
  const out = band.map(n => ({ ...n, v: n.v * .5 }));
  if (run.recording.keys && id !== 'cymbal') out.push(...bedBar(bar, .5));
  return out;
}
function scheduleMusic() {
  const c = audio.context;
  const origin = finaleT0 ?? 0;
  if (!audio.running || clock.domain !== 'audio') { nextStep = Math.max(nextStep, Math.ceil(s / STEP)); markHeard(); return; }
  const horizon = c.currentTime + LOOKAHEAD;
  if (nextStep * STEP < s - .5) nextStep = Math.ceil(s / STEP);
  for (;;) {
    const t = nextStep * STEP, at = ctxAt(t);
    if (at > horizon) break;
    if (at > c.currentTime + .003) {
      const rel = t - origin;
      if (rel >= -1e-9) {
        const beatRel = Math.round(rel / STEP);
        const bar = Math.floor(beatRel / 16);
        if (beatRel % 4 === 0 && finaleT0 !== null) { audio.tick(at, beatRel % 8 === 4); probeNote('tick', at, t); }
        // Rail joints pass every half beat at the cart's speed: its wheels keep time.
        if (finaleT0 === null && beatRel % 2 === 0 && run.cart.state === 'ride' && run.status === 'playing') audio.clack(at, beatRel % 4 === 0);
        for (const n of barNotes(bar)) {
          const slot = Math.round(n.slotT / STEP * 3);
          if (Math.floor(slot / 3) !== beatRel % 16) continue;
          const exact = at + (n.slotT - (beatRel % 16) * STEP);
          audio.note(n, exact, finaleT0 !== null ? 'live' : 'bed');
          probeNote(n.part, exact, t + (n.slotT - (beatRel % 16) * STEP), { by: n.by, bar });
          flash[n.part] = t; if (PARTS.includes(n.part)) heardParts.add(n.part);
          if (n.by === 'player') echoes[n.part] = t + (n.slotT - (beatRel % 16) * STEP);
        }
      }
    }
    nextStep += 1;
  }
  markHeard();
}
function markHeard() {
  // Without audio the band still lights up, from the same score.
  if (finaleT0 === null || audio.running) return;
  const rel = s - finaleT0; if (rel < 0) return;
  const bar = Math.floor(rel / BAR), into = rel - bar * BAR;
  for (const n of barNotes(bar)) if (n.slotT <= into && into - n.slotT < .05 && PARTS.includes(n.part)) { flash[n.part] = s; heardParts.add(n.part); if (n.by === 'player') echoes[n.part] = s; }
}
function mixMusic() {
  if (!audio.running) return;
  const id = stationAt(run.x).id;
  audio.mix(finaleT0 !== null ? 1 : id === 'metronome' ? 0 : id === 'cymbal' ? .4 : 1);
}

// ---------- events ----------
function handle(events) {
  for (const e of events) {
    if (PREDICTED.has(e.type) && !cued.has(eventKey(e))) { cued.add(eventKey(e)); playEvent(e); }
    probeEvent(e); buzz(e.type);
    if (e.platform !== undefined) rings.set(e.platform, e.t ?? s);
    if (e.string !== undefined && e.part === 'harp') plucks.set(e.string, e.t ?? s);
    if (e.string !== undefined && e.part === 'strings') plucks.set('s' + e.string, e.t ?? s);
    if (e.type === 'land' && !reducedMotion.matches) particles.push({ x: run.x, age: 0 });
    if (e.type === 'reed') { if (e.on) audio.reedOn(e.midi); else audio.reedOff(); }
    if (e.type === 'board') { audio.slideOn(brassPitch(0)); audio.couple(when(e.t ?? s)); showHint('cartHint'); }
    if (e.type === 'note' && e.slide) { audio.slideTo(e.midi, 1); bellAt = e.t ?? s; }
    if (e.type === 'rung') { const r = COURSE.rungs[e.rung]; bursts.push({ x: (r.a + r.b) / 2, y: FLOOR - r.h, at: e.t ?? s, power: .25 + e.rung * .1 }); }
    if (e.type === 'wake') { flash[e.part] = e.t ?? s; toast = { part: e.part, at: e.t ?? s }; }
    if (e.type === 'station') {
      showBanner(e.id);
      if (e.id !== 'brass') audio.slideOff();
      save();
    }
    if (e.type === 'fall') { audio.slideOff(); audio.reedOff(); fallGap = run.fails[run.checkpoint] >= 2 ? { x: run.fallX, checkpoint: run.checkpoint } : null; if (run.stationId === 'tongue') showHint('resHint'); if (run.stationId === 'bellows') showHint('bellowsHint'); }
    if (e.type === 'respawn') camDelta = 0;
    if (e.type === 'crash') crashes.push({ x: e.x, at: e.t });
    if (e.type === 'checkpoint') { litLanterns.add(e.index); fallGap = null; save(); }
    if (e.type === 'dock') beginFinale(e);
  }
}
function save() {
  saved = { checkpoint: run.checkpoint, recording: run.recording, lastTake: saved?.lastTake };
  write(SAVE_KEY, JSON.stringify(saved));
}
function beginFinale(e) {
  releaseInput(); lockAt = e.t; finaleT0 = e.t + BEAT; takeForFinale = run.recording;
  scheduledBar = new Map(); nextStep = Math.ceil(finaleT0 / STEP); audio.slideOff(); audio.reedOff();
  write(SAVE_KEY + '.cleared', '1');
  saved = { checkpoint: 0, recording: {}, lastTake: run.recording }; write(SAVE_KEY, JSON.stringify(saved));
  showBanner('metronome');
}
let hint = null, fallGap = null, toast = null, bellAt = -9;
const litLanterns = new Set();
function showHint(key) { hint = { key, at: s }; }
const probe = globalThis.__rapippoWorkshopProbe;
function probeNote(part, at, storyTime, extra) { if (probe) (probe.notes ||= []).push({ part, at, s: storyTime, ...extra }); }
function probeEvent(e) { if (probe) (probe.events ||= []).push({ type: e.type, t: e.t, beat: e.beat, part: e.part, id: e.id, station: e.station }); }

// ---------- drawing ----------
const groundH = x => x >= COURSE.dockX ? ROD_LENGTH * Math.cos(rodLean(x)) : x >= COURSE.rungs[0].a ? heightAt(x) : 0;
const heroDrawX = x => x >= COURSE.dockX ? COURSE.dockX + ROD_LENGTH * Math.sin(rodLean(x)) : x;
function heroState() {
  if (run.status === 'falling') {
    const k = Math.max(0, (s - run.fallAt * BEAT) / (FALL_BEATS * BEAT));
    return { y: FLOOR - 2 + k * k * 170, phase: 0, land: 0, dead: k };
  }
  const beat = beatIndex(s), phase = Math.max(0, Math.min(1, (s - beat * BEAT) / BEAT));
  const base = groundH(run.x);
  // Stairs: a hop always takes 0.78s; only its feet travel up to the next ledge.
  const from = groundH(run.hopStartX), h = from + (base - from) * phase;
  return { y: FLOOR - 2 - h - Math.sin(phase * Math.PI) * 96, phase, land: s - beat * BEAT < .1 ? 1 - (s - beat * BEAT) / .1 : 0, dead: 0 };
}
// The camera trails a moving target by speed / rate; on the cart that would push the
// whole cart off the right edge, so the ride view leads by the same amount.
const CAMERA_RATE = 4;
function steerCamera(dt) {
  let target = run.x - HERO_X;
  // Towards the goal the hero drops back in the frame, so the metronome is seen coming.
  if (run.stationId === 'metronome') target = run.x - 62;
  else if (run.stationId === 'brass' && run.cart.state === 'ride' && run.x > COURSE.cart.x0 - CART_HALF) target = run.cart.x - W / 2 + CART_SPEED / CAMERA_RATE;
  else if (run.stationId === 'brass' && run.cart.state === 'wait' && run.x > COURSE.cart.x0 - CART_HALF - 200) target = Math.max(target, COURSE.cart.x0 - W / 2 - 40);
  target = Math.min(target, COURSE.dockX - W / 2);
  camDelta += cam - (target + camDelta);
  camDelta *= Math.exp(-dt * CAMERA_RATE);
  cam = target + camDelta;
}
function drawWorld() {
  const id = run.stationId, station = stationAt(run.x);
  drawBackdrop(ctx, cam, id, s, reducedMotion.matches);
  drawStationBack(ctx, cam, id, station.from, station.to);
  const hero = heroState(), screenX = heroDrawX(run.x) - cam;
  if (id === 'harp') drawHarp(ctx, cam, run, s, plucks);
  if (id === 'strings') drawStrings(ctx, cam, run, s, plucks);
  const reduced = reducedMotion.matches, plateLabels = id === 'bellows' ? tr('plates') : null;
  if (id === 'metronome') {
    // The room the finale happens in, already there: its floor and the sleeping band.
    const px = COURSE.dockX - cam, floorFrom = Math.max(0, COURSE.rungs[0].a - cam);
    drawGoalStage(ctx, px);
    ctx.fillStyle = '#231c1a'; ctx.fillRect(floorFrom, FLOOR + 14, W - floorFrom, H);
    ctx.fillStyle = '#ffd98a55'; ctx.fillRect(floorFrom, FLOOR + 14, W - floorFrom, 2);
    ctx.save(); ctx.translate(px - W / 2, 0); drawBand(ctx, {}, s, new Set(), FLOOR + 62); ctx.restore();
  }
  drawPlatforms(ctx, cam, run, s, rings, 0, plateLabels);
  drawLanterns(ctx, cam, litLanterns, s);
  if (fallGap) drawFallHint(ctx, cam, fallGap.x, s);
  const rideView = id === 'brass';
  if (rideView) drawCart(ctx, cam, run, s, run.cart.state === 'ride' ? cartTarget(run, COURSE) : null, run.cart.state === 'ride', reduced);
  if (id === 'metronome') {
    const px = COURSE.dockX - cam, angle = rodLean(run.x) + (reduced ? 0 : Math.sin(s * Math.PI * 2 / run.rod.tick) * .012);
    drawRunway(ctx, cam, station.from, COURSE.rungs[0].a, s, reduced);
    drawMetronome(ctx, px, FLOOR, angle, { rungAt: run.rod.rung, cam });
    for (const b of bursts) drawBurst(ctx, b.x - cam, b.y, s - b.at, b.power, reduced);
  }
  if (rideView) { const onCart = run.status === 'playing' && Math.abs(run.x - run.cart.x) <= CART_HALF + 30 && run.cart.state !== 'wait'; drawTrombone(ctx, cam, run, s, screenX, hero.y, onCart, s - bellAt, reduced); }
  if (id === 'bellows' && run.status === 'playing') drawBellowsAura(ctx, screenX, hero.y, input.fast, s, reduced);
  for (const p of particles) { p.age += 1 / 60; if (p.age < .3) { ctx.globalAlpha = 1 - p.age / .3; ctx.fillStyle = '#efdaad'; ctx.fillRect(p.x - cam - 12 - p.age * 40, hero.y + 2, 3, 2); ctx.fillRect(p.x - cam + 9 + p.age * 40, hero.y + 2, 3, 2); ctx.globalAlpha = 1; } }
  let dark = 0;
  if (id === 'cymbal') {
    dark = drawDarkness(ctx, cam, run, s, screenX, hero.y - 20);
    for (const c of crashes) crashRing(ctx, c.x - cam, s - c.at);
    drawPlatforms(ctx, cam, run, s, rings, dark);
  }
  drawPod(ctx, screenX, hero.y, 2, { phase: hero.phase, land: hero.land, fast: input.fast, time: s, dead: hero.dead });
  // The band so far, along the top: who is awake, and who just sounded.
  drawBand(ctx, flash, s, new Set(PARTS.filter(p => run.recording[p])), 24, .55);
  drawHints();
}
const smooth01 = k => { const v = Math.max(0, Math.min(1, k)); return v * v * (3 - 2 * v); };
function drawHints() {
  ctx.textAlign = 'center';
  if (toast && s - toast.at < 2.4) {
    ctx.globalAlpha = Math.min(1, (2.4 - (s - toast.at)) / .5); ctx.fillStyle = '#ffe6aa'; ctx.font = 'bold 11px sans-serif';
    ctx.fillText('✦ ' + (tr('tags')[toast.part] || '') + ' ✦', W / 2, 50); ctx.globalAlpha = 1;
  }
  if (banner && s - banner.at < 3.4) {
    const a = Math.min(1, (s - banner.at) / .3, (3.4 - (s - banner.at)) / .4);
    ctx.globalAlpha = a; ctx.fillStyle = '#0b0a14cc'; ctx.fillRect(0, 196, W, 48);
    ctx.fillStyle = '#f0c67a'; ctx.font = 'bold 15px sans-serif'; ctx.fillText(tr('stations')[banner.id] || '', W / 2, 216);
    ctx.fillStyle = '#f6e4c2'; ctx.font = '11px sans-serif'; ctx.fillText(tr('finds')[banner.id] || '', W / 2, 234);
    ctx.globalAlpha = 1;
  } else if (hint && s - hint.at < 3) {
    ctx.globalAlpha = Math.min(1, (3 - (s - hint.at)) / .4); ctx.fillStyle = '#f6e4c2'; ctx.font = '11px sans-serif'; ctx.fillText(tr(hint.key), W / 2, 216); ctx.globalAlpha = 1;
  }
}
// The finale's camera never moves: playtest found a swinging frame made people
// queasy. The rod swings, with the hero on it, inside a still room.
function rodAngle() {
  if (lockAt === null) return 0;
  const reduced = reducedMotion.matches, wide = reduced ? .05 : .2 + (mode === 'free' ? freeWide * .16 : 0);
  if (s < finaleT0) return swingStart() * Math.cos(Math.max(0, Math.min(1, (s - lockAt) / BEAT)) * Math.PI / 2);
  return wide * Math.sin(Math.PI * (s - finaleT0) / BEAT) * Math.min(1, .55 + (s - finaleT0) * .2);
}
function swingStart() { return rodLean(run.x); }
function drawFinale() {
  const angle = rodAngle(), px = W / 2, py = FLOOR, tip = rodTip(px, py, angle), bar = finaleBarNow(), reduced = reducedMotion.matches;
  drawBackdrop(ctx, COURSE.dockX, 'metronome', s, reduced);
  // The room warms as the band gathers.
  drawGoalStage(ctx, px, .6 + .5 * (mode === 'free' ? 1 : heardParts.size / PARTS.length));
  ctx.fillStyle = '#231c1a'; ctx.fillRect(0, FLOOR + 14, W, H);
  ctx.fillStyle = '#ffd98a55'; ctx.fillRect(0, FLOOR + 14, W, 2);
  drawBand(ctx, flash, s, heardParts, FLOOR + 62, 1, echoes, reduced);
  drawMetronome(ctx, px, py, angle, { rungs: false, lit: 0 });
  const onBeat = finaleT0 !== null && s >= finaleT0 && (s - finaleT0) % BEAT < .12;
  // During the silent beat the legs fold out; the eyes blink from the first tick on.
  drawLockedHero(ctx, tip.x, tip.y, angle, s, onBeat, reduced, smooth01((s - lockAt) / .22));
  if (mode !== 'free') {
    // The arrival: one flash and a burst from the seat. The silent beat stays silent.
    const since = s - lockAt;
    if (since >= 0 && since < .5) { ctx.globalAlpha = (1 - since / .5) * (reduced ? .2 : .55); ctx.fillStyle = '#fff1c9'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    drawBurst(ctx, tip.x, tip.y - 20, since, 1, reduced);
    const tutti = s - finaleT0 - TUTTI_FROM * BAR;
    if (tutti >= 0) drawBurst(ctx, tip.x, tip.y - 20, tutti, .8, reduced);
    drawOwnSong(bar);
  }
}
const loopAt = (rel, part, len) => loopFraction(rel, ENTRY[part], len);
const replayCaption = (part, take) => run.listen ? tr('theirs') + ' · ' + (tr('tags')[part] || '') : take.events.length ? tr('yours')[part] : tr('workshopFill');
// The song is yours, and it says so: each part comes in with its own loop and the
// hops you made running through it, then all of them together.
function drawOwnSong(bar) {
  const song = takeForFinale || {}, rel = s - finaleT0, bars = finaleBeats() / 4;
  if (bar >= CARD_BAR - 1) {
    drawAllReplay(ctx, song, rel, s, tr('tags'), null, loopAt, 14, 12, W - 28, 96, smooth01(bars - (CARD_BAR - 1)));
    return;
  }
  const part = replayPartAt(bar);
  if (part === 'all') { drawAllReplay(ctx, song, rel, s, tr('tags'), run.listen ? null : tr('allYours'), loopAt, 14, 10, W - 28, 72, smooth01(bars - TUTTI_FROM) * smooth01(TUTTI_END - bars)); return; }
  const take = part && song[part];
  // A player who never breathed has an honest tail: the tick alone, with nothing claimed.
  if (!take || (bar >= TUTTI_END && !take.events.length)) return;
  const entered = bar >= TUTTI_END ? TUTTI_END : ENTRY[part];
  const fade = smooth01((bars - entered) * 2) * (bar >= TUTTI_END ? 1 - smooth01(bars - (CARD_BAR - 1.5)) : 1);
  drawReplay(ctx, part, take, loopAt(rel, part, take.len), s, bar >= TUTTI_END && !run.listen ? tr('breathLast') : replayCaption(part, take), fade);
}
function drawTitle(t) {
  drawBackdrop(ctx, 2200, 'metronome', t, reducedMotion.matches);
  ctx.fillStyle = '#231c1a'; ctx.fillRect(0, FLOOR + 14, W, H); ctx.fillStyle = '#ffd98a55'; ctx.fillRect(0, FLOOR + 14, W, 2);
  // Weightless, the rod shivers at the wrong speed. The hero hops at its own.
  const shake = reducedMotion.matches ? 0 : Math.sin(t * Math.PI * 2 / (BEAT * 5 / 7)) * .012;
  ctx.save(); ctx.translate(250, FLOOR + 12); ctx.scale(.66, .66); ctx.translate(-250, -FLOOR - 12);
  drawMetronome(ctx, 250, FLOOR - 2, shake, { rungs: false });
  ctx.restore();
  const phase = (t % BEAT) / BEAT;
  drawPod(ctx, 92, FLOOR + 12 - Math.sin(phase * Math.PI) * 34, 2, { phase, time: t, land: phase < .1 ? 1 - phase * 10 : 0 });
}
function saveCard() {
  const take = takeForFinale || {}, out = document.createElement('canvas');
  out.width = 1080; out.height = 1350;
  const g = out.getContext('2d');
  g.fillStyle = '#0b0a14'; g.fillRect(0, 0, 1080, 1350);
  g.textAlign = 'center'; g.fillStyle = '#fff1d2'; g.font = '900 86px sans-serif'; g.fillText('RAPIPPO', 540, 120);
  g.fillStyle = '#f0c67a'; g.font = '700 40px sans-serif'; g.fillText(tr('tag'), 540, 176);
  drawScore(g, take, 70, 230, 940, 880, { labels: tr('tags') });
  g.save(); g.translate(540, 1150);
  g.fillStyle = '#3a2a1a'; g.beginPath(); g.moveTo(-90, 80); g.lineTo(-40, -30); g.lineTo(40, -30); g.lineTo(90, 80); g.fill();
  g.strokeStyle = '#e8b95a'; g.lineWidth = 6; g.beginPath(); g.moveTo(0, 60); g.lineTo(0, -80); g.stroke();
  g.restore();
  drawPod(g, 540, 1076, 4, { land: 1 });
  const link = document.createElement('a'); link.download = 'rapippo-moon-workshop.png'; link.href = out.toDataURL('image/png'); link.click();
}
function frame() {
  const dt = 1 / 60;
  if (playing()) {
    const now = clock.now(perfNow());
    if (now - s > STALL) pause();
    else {
      s = now;
      const events = [];
      if (mode === 'free' || mode === 'finale') {
        run.t = s; if (mode === 'free') { input.advance(s, () => {}); const held = fast(); freeWide += ((held ? 1 : 0) - freeWide) * .02; if (held !== freePressed) freeEdge(held); }
      } else if (run.status === 'docked') run.t = s;
      else input.advance(s, (from, to, f) => advance(run, COURSE, to, f, events));
      predict(); handle(events);
      if (run.cart.state === 'ride' && run.status === 'playing') { audio.slideOn(brassPitch(run.x - run.cart.x)); audio.slideTo(liveNote('brass', brassPitch(run.x - run.cart.x), run.beat, 0) * .4 + brassPitch(run.x - run.cart.x) * .6); }
      steerCamera(dt); mixMusic(); scheduleMusic();
      if (finaleT0 !== null && mode !== 'free' && finaleBeats() / 4 >= CARD_BAR && !cardShown) toEndCard();
    }
  }
  if (screen === 'start') drawTitle(perfNow());
  else if (finaleT0 !== null && (mode !== 'play' || run.status === 'docked')) drawFinale();
  else drawWorld();
  if (copiedAt > 0 && perfNow() - copiedAt > 2) { $('copy-link').textContent = tr('copyLink'); copiedAt = -9; }
  $('beat-mark').classList.toggle('on', playing() && steering() && s - beatIndex(s) * BEAT < .1);
  requestAnimationFrame(frame);
}
// Free play: the swing widens with the hold; a press is one breath on the grid.
let freePressed = false, freeNote = 0;
function freeEdge(on) {
  freePressed = on;
  if (on) { audio.reedOn(liveNote('wood', WOOD_MOTIF[freeNote++ % WOOD_MOTIF.length], Math.floor((s - finaleT0) / BEAT))); probeEvent({ type: 'freeNote', t: s }); }
  else audio.reedOff();
}
run = newRun(); ahead = run; refreshCopy();
requestAnimationFrame(frame);
if (globalThis.__rapippoWorkshopProbe) globalThis.__rapippoWorkshopProbe.read = () => ({
  screen, mode, s, x: run.x, beat: run.beat, status: run.status, station: run.stationId, checkpoint: run.checkpoint, hops: run.hops, fails: run.fails, cart: run.cart,
  recording: run.recording, finaleBar: finaleBarNow(), replay: finaleT0 === null || mode === 'free' ? null : replayPartAt(finaleBarNow()), echoes: { ...echoes }, tint: $('hold').dataset.tint ?? null, angle: rodAngle(), heard: [...heardParts], card: cardShown, domain: clock.domain, audio: audio.debug(), cam, resonance: run.resonance, wide: freeWide, take: takeForFinale,
});
