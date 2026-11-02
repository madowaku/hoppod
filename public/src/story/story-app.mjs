// RAPIPPO STORY. Separate page and modules; FREE RUN code is only imported
// read-only (physics constants, footing, pod artwork).
import { INSET, footing } from '../engine.mjs';
import { drawPod } from '../pod.mjs';
import { COMPANION_PALETTE } from '../companion.mjs';
import { BEAT, BeatClock, TimedInput, heardFromContext, beatIndex } from './beat.mjs';
import { COURSE } from './course.mjs';
import { newStory, storyFrom, advanceStory, craneSolid, hopLift, RANGE, FOLLOW_GAP, FALL_BEATS } from './sim.mjs';
import { createStoryAudio, notesAt, STEP, ENDING } from './music.mjs';
import { chooseLanguage, storyCopy } from './copy.mjs';

const get = id => document.getElementById(id);
const canvas = get('play'), ctx = canvas.getContext('2d');
const W = 360, H = 510, FLOOR = 382, HERO_X = 130, LOOKAHEAD = .15;
const PALETTE = { blue: COMPANION_PALETTE, green: { c: '#b4f2c8', w: '#ecfff2', s: '#73c290', a: '#3fcf7f' }, red: { c: '#ffbcae', w: '#fff1ec', s: '#d98a7a', a: '#ff6a4f' } };
const GLOW = { blue: '#6fb6ff', green: '#5fe39a', red: '#ff7f66', hero: '#bfe6ff' };
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const audio = createStoryAudio();
const clock = new BeatClock(perf => heardFromContext(audio.context, perf));
const input = new TimedInput();
const pointers = new Set(), keys = new Set();
const params = new URL(location.href).searchParams;
function readPreference(key) { try { return localStorage.getItem(key); } catch { return null; } }
function savePreference(key, value) { try { localStorage.setItem(key, value); } catch { /* this session only */ } }
let language = chooseLanguage(location.href, readPreference('hoppod.pref.lang'), navigator.language);
const tr = key => storyCopy(language, key);
audio.setMuted(readPreference('hoppod.pref.muted') === '1');

let cull = 20;
let flashes = [];
let run, screen = 'start', s = 0, nextStep = 0, particles = [], banner = null, launched = false;
const perfNow = () => performance.now() / 1000;
const fast = () => pointers.size + keys.size > 0;
const playing = () => screen === 'play';

function initialRun() {
  const cp = params.get('cp');
  if (cp === 'end') {
    const r = storyFrom(COURSE, COURSE.checkpoints.length - 1);
    for (const who of ['blue', 'green', 'red']) { r[who].state = 'station'; r[who].x = COURSE.stations.find(st => st.who === who).x; }
    Object.assign(r, { status: 'docked', dockAt: 0, x: COURSE.dockX, chapter: 'base' });
    return r;
  }
  const i = Number(cp);
  return Number.isInteger(i) && i > 0 && i < COURSE.checkpoints.length ? storyFrom(COURSE, i) : newStory(COURSE);
}
function begin() {
  audio.unlock(); audio.cancel();
  run = initialRun(); ahead = structuredClone(run); cued.clear(); s = 0; heroX = HERO_X; cameraS = 0; particles = []; flashes = []; launched = false;
  clock.start(0, perfNow()); input.reset(0, false); nextStep = 0;
  releaseInput(); screen = 'play'; showBanner(run.status === 'docked' ? 'send' : run.chapter);
  get('overlay').hidden = true; get('action').blur();
}
function pause() {
  releaseInput();
  if (!playing()) return;
  clock.pause(perfNow()); audio.cancel(); screen = 'pause';
  get('overlay').dataset.screen = 'pause'; refreshOverlay(); get('overlay').hidden = false;
}
function resume() {
  audio.unlock(); clock.resume(perfNow());
  s = clock.now(perfNow()); input.reset(s, false); nextStep = Math.ceil(s / STEP);
  releaseInput(); screen = 'play'; get('overlay').hidden = true; get('action').blur();
}
function finish() {
  screen = 'end'; get('overlay').dataset.screen = 'end'; refreshOverlay(); get('overlay').hidden = false;
}
function releaseInput() {
  pointers.clear(); keys.clear();
  if (playing()) input.push(clock.at(perfNow()), false);
  updateHud();
}
function press(on, stamp) {
  if (!playing() || run.status === 'docked') return;
  // Event stamps share performance.now()'s origin; distrust any that do not.
  const now = perfNow(), at = Math.abs(stamp / 1000 - now) < .25 ? Math.min(now, stamp / 1000) : now;
  input.push(clock.at(at), on);
}
function showBanner(id) { banner = { id, at: s }; get('chapter-label').textContent = tr('chapters')[id] || ''; }

function refreshOverlay() {
  const kind = get('overlay').dataset.screen;
  get('intro-mark').textContent = '✦ ' + tr('tag') + ' ✦';
  get('overlay-title').textContent = kind === 'pause' ? tr('pauseTitle') : tr('title');
  get('overlay-subtitle').textContent = kind === 'pause' ? tr('pauseText') : kind === 'end' ? tr('thanks') : tr('subtitle');
  get('action').textContent = kind === 'pause' ? tr('resume') : tr('begin');
  get('end-actions').hidden = kind !== 'end';
}
function refreshCopy() {
  document.documentElement.lang = language;
  get('story-tag').textContent = tr('tag'); get('to-free').textContent = tr('free'); get('end-free').textContent = tr('free');
  get('intro-hold').textContent = tr('hold'); get('intro-release').textContent = tr('release');
  get('headphones').textContent = tr('headphones'); get('again').textContent = tr('again');
  get('footer-tag').textContent = tr('footer'); get('footer-keys').textContent = tr('keys');
  get('language').textContent = language === 'ja' ? 'EN' : '日本語'; get('language').setAttribute('aria-label', tr('switchLanguage'));
  get('sound').textContent = tr(audio.muted ? 'soundOff' : 'soundOn'); get('sound').setAttribute('aria-pressed', String(!audio.muted));
  if (banner) get('chapter-label').textContent = tr('chapters')[banner.id] || '';
  refreshOverlay(); updateHud();
}
function updateHud() {
  const on = fast();
  get('hold').classList.toggle('active', on); get('hold').setAttribute('aria-pressed', String(on));
  get('hold-state').textContent = on ? 'FAST' : 'SLOW';
  get('hold-instruction').textContent = tr(on ? 'toSlow' : 'toFast');
}

get('action').addEventListener('click', () => { if (screen === 'pause') resume(); else begin(); });
get('again').addEventListener('click', () => { get('overlay').dataset.screen = 'start'; begin(); });
get('sound').addEventListener('click', () => {
  get('sound').blur(); audio.unlock(); audio.setMuted(!audio.muted);
  savePreference('hoppod.pref.muted', audio.muted ? '1' : '0'); refreshCopy();
});
get('language').addEventListener('click', () => {
  get('language').blur(); language = language === 'ja' ? 'en' : 'ja';
  savePreference('hoppod.pref.lang', language); refreshCopy();
});
for (const target of [canvas, get('hold')]) {
  target.addEventListener('pointerdown', e => {
    if (!playing() || e.button > 0) return;
    e.preventDefault(); audio.unlock(); pointers.add(e.pointerId); target.setPointerCapture(e.pointerId);
    press(true, e.timeStamp); updateHud();
  });
  target.addEventListener('lostpointercapture', e => { if (pointers.delete(e.pointerId) && !fast()) press(false, e.timeStamp); updateHud(); });
}
window.addEventListener('pointerup', e => { if (pointers.delete(e.pointerId) && !fast()) press(false, e.timeStamp); updateHud(); });
window.addEventListener('pointercancel', releaseInput);
window.addEventListener('keydown', e => {
  if (e.code === 'Space') {
    if (!playing() || (document.activeElement?.tagName === 'BUTTON' && document.activeElement !== get('hold'))) return;
    e.preventDefault();
    if (!e.repeat && !keys.has('Space')) { audio.unlock(); const was = fast(); keys.add('Space'); if (!was) press(true, e.timeStamp); updateHud(); }
  }
  if (e.code === 'Escape') pause();
});
window.addEventListener('keyup', e => { if (e.code === 'Space' && keys.delete('Space')) { if (!fast()) press(false, e.timeStamp); updateHud(); } });
window.addEventListener('blur', pause);
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('pagehide', pause);

// ---------- music ----------
// The audio side works ahead of the picture by output latency + lookahead.
// `ahead` is the run simulated to that point with the current input held, so
// scheduled notes and cues land with the touchdowns they belong to, even on
// Bluetooth. A late input change can rarely make a cue wrong; an event that
// was not predicted still sounds, just late.
let ahead = null;
const cued = new Map();
const CUES = new Set(['collect', 'assemble', 'join', 'switch', 'strand', 'relink', 'reunion', 'station', 'dock', 'fall', 'respawn']);
const eventKey = e => e.type + ':' + e.beat + ':' + (e.who ?? e.index ?? '');
function predict() {
  ahead = structuredClone(run);
  if (!audio.running || clock.domain !== 'audio' || run.status === 'docked') return;
  const front = audio.context.currentTime + LOOKAHEAD - clock.offset, events = [];
  if (front > run.t) advanceStory(ahead, COURSE, front, input.fast, events);
  for (const e of events) {
    if (!CUES.has(e.type) || cued.has(eventKey(e))) continue;
    const at = clock.contextTime(e.t);
    if (at > audio.context.currentTime + .003) { audio.cue(e.type, at); cued.set(eventKey(e), e.t); probeNote('cue:' + e.type, at, e.t); }
  }
  for (const [key, t] of cued) if (t < s - 8) cued.delete(key);
}
const song = {
  get dockBeat() { return ahead.status === 'docked' ? ahead.dockAt : null; },
  parts: new Set(),
  // The clockwork tick sounds on every beat the hero touches down; a beat
  // predicted to be a fall stays silent.
  tick: beat => ahead.status === 'playing' || (ahead.status === 'falling' && beat === ahead.fallAt + FALL_BEATS) || (ahead.status === 'docked' && beat <= ahead.dockAt),
};
const smooth = (a, b, x) => { const k = Math.max(0, Math.min(1, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
// A friend's part by distance: inside the range it is full and clear, at
// the edge it thins; beyond it, it turns into a faint, muffled radio that
// fades out over a few hops.
function friendSound(friend) {
  if (friend.state === 'dormant') return { level: 0, clarity: 1 };
  if (friend.state === 'station') return { level: 1, clarity: 1 };
  const d = Math.abs(run.x - friend.x);
  if (d <= RANGE && friend.state !== 'lost' && friend.state !== 'switch') return { level: 1 - .3 * smooth(RANGE * .4, RANGE, d), clarity: 1 - .45 * smooth(RANGE * .6, RANGE, d) };
  return { level: .5 * (1 - smooth(RANGE, RANGE * 4.5, d)), clarity: .3 * (1 - smooth(RANGE, RANGE * 3, d)) };
}
const lightOpen = () => run.parts.assembledAt === null ? 0 : smooth(0, 3, run.t - run.parts.assembledAt);
const after = () => run.status === 'docked' ? s / BEAT - run.dockAt : -1;
function mixMusic() {
  song.parts.clear();
  if (ahead.blue.state !== 'parts') song.parts.add('bell');
  if (ahead.green.state !== 'dormant') song.parts.add('bass');
  if (ahead.red.state !== 'dormant') song.parts.add('perc');
  const green = friendSound(run.green), red = friendSound(run.red), clarity = { bass: green.clarity, perc: red.clarity, bell: 1 };
  const a = after(), levels = { tick: .9, bell: .85 * lightOpen(), bass: .9 * green.level, perc: .9 * red.level, sparkle: 0 };
  let muffle = 1 - lightOpen();
  if (a >= 0) {
    // Seen from the rocket: the base's music thins with distance; a little
    // sparkle stays until the very end.
    const k = smooth(ENDING.away, ENDING.lights, a), out = 1 - smooth(ENDING.black - 2, ENDING.black + 2, a);
    levels.tick = 0; levels.bell = levels.bass = levels.perc = (1 - k) ** 2 * out;
    levels.sparkle = smooth(ENDING.away, ENDING.away + 8, a) * .7 * out; muffle = k * .85;
    if (a >= ENDING.away) song.parts.add('sparkle');
  }
  audio.mix(levels, muffle, clarity);
}
function scheduleMusic() {
  const c = audio.context, horizon = c && c.currentTime + LOOKAHEAD;
  if (!audio.running || clock.domain !== 'audio') { nextStep = Math.ceil(s / STEP); return; }
  if (nextStep * STEP < s - .5) nextStep = Math.ceil(s / STEP);
  for (;;) {
    const at = clock.contextTime(nextStep * STEP);
    if (at > horizon) break;
    if (at > c.currentTime + .003) for (const note of notesAt(nextStep, song)) { audio.note(note, at); probeNote(note.part, at, nextStep * STEP); }
    nextStep += 1;
  }
}

// ---------- events ----------
function burst(x, y, colors, n = 8) {
  if (reducedMotion.matches) return;
  for (let i = 0; i < n; i++) particles.push({ x, y, vx: (i - n / 2) * 20, vy: -40 - i % 3 * 18, age: 0, color: colors[i % colors.length] });
}
function handle(events) {
  for (const e of events) {
    if (CUES.has(e.type) && !cued.has(eventKey(e))) { audio.cue(e.type); probeNote('late:' + e.type, audio.context?.currentTime ?? 0, e.t); }
    probeEvent(e);
    if (e.type === 'land') burst(run.x, FLOOR - 4, ['#efdaad', '#8ee6c4'], 6);
    else if (e.type === 'collect') burst(e.x, FLOOR - 10, ['#a9d6ff', '#4f9dff'], 10);
    else if (e.type === 'strand') flashes.push({ kind: 'snap', x: e.x, at: e.t });
    else if (e.type === 'relink') flashes.push({ kind: 'relink', x: COURSE.relays.filter(r => r <= run.x).at(-1), at: s });
    else if (e.type === 'switch') flashes.push({ kind: 'switch', x: COURSE.switchX, at: e.t });
    else if (e.type === 'assemble') flashes.push({ kind: 'dawn', x: run.x, at: s });
    else if (e.type === 'dock') { releaseInput(); showBanner('send'); }
    else if (e.type === 'chapter') showBanner(e.id);
  }
}
// Test probe: scheduled notes and events (only when a probe is injected).
const probe = globalThis.__rapippoStoryProbe;
function probeNote(part, at, storyTime) { if (probe) (probe.notes ||= []).push({ part, at, s: storyTime }); }
function probeEvent(e) { if (probe) (probe.events ||= []).push({ type: e.type, t: e.t, beat: e.beat }); }

// ---------- drawing ----------
const heroBlink = () => beatIndex(s) !== beatIndex(s - .12) || (s % BEAT) < .12;
// The hero's screen x. While a friend lags behind (green in II, red at the
// crane in III), the camera slides so both stay in view: the player watches
// the gap open and sees the friend they leave behind.
let heroX = HERO_X, cameraS = 0;
function steerCamera() {
  let lag = 0;
  for (const f of [run.green, run.red]) {
    if (run.together || ['dormant', 'station'].includes(f.state)) continue;
    const d = run.x - f.x;
    // Capped so a full FAST hop ahead always stays visible.
    if (d > 0 && d < RANGE * 2) lag = Math.max(lag, Math.min(d - FOLLOW_GAP, 50) * (1 - smooth(RANGE * 1.5, RANGE * 2, d)));
  }
  const dt = Math.max(0, Math.min(.1, s - cameraS)); cameraS = s;
  heroX += (HERO_X + Math.max(0, lag) - heroX) * (1 - Math.exp(-dt * 5));
}
const camera = () => run.x - heroX;
function friendY(who, friend) {
  const lag = { blue: .5, green: .25, red: .75 }[who];
  const phase = ((s / BEAT + lag) % 1 + 1) % 1;
  if (friend.state === 'station') return FLOOR - 2 - Math.abs(Math.sin(phase * Math.PI)) * 18;
  if (friend.state === 'dormant' || friend.state === 'lost') return FLOOR - 2;
  if (friend.state === 'switch') return FLOOR - 6 - Math.abs(Math.sin(phase * Math.PI)) * 6;
  return FLOOR - 18 - Math.sin(phase * Math.PI) * 44;
}
function drawPlatforms(cam) {
  for (const p of COURSE.platforms) {
    const [left, right] = footing([p.a, p.b]), l = Math.round(left - cam), r = Math.round(right - cam);
    if (r < -cull || l > W + cull || p.kind === 'crane') continue;
    ctx.fillStyle = '#2e4850'; ctx.fillRect(l, FLOOR, r - l, H - FLOOR);
    ctx.fillStyle = '#26404a'; ctx.fillRect(l - INSET, FLOOR + 6, INSET, H); ctx.fillRect(r, FLOOR + 6, INSET, H);
    ctx.fillStyle = p.kind === 'station' ? '#c9d9ff' : p.kind === 'dock' ? '#ffe3ac' : '#a8b7a5'; ctx.fillRect(l, FLOOR, r - l, 6);
    ctx.fillStyle = '#65858a'; ctx.fillRect(l, FLOOR + 6, r - l, 8);
  }
}
function drawGlints(cam) {
  // Even in the dark, each footing's lit edge stays visible: the next
  // landing can always be judged.
  ctx.fillStyle = 'rgba(232, 214, 170, .55)';
  for (const p of COURSE.platforms) {
    if (p.kind === 'crane') continue;
    const [left, right] = footing([p.a, p.b]), l = Math.round(left - cam), r = Math.round(right - cam);
    if (r < -cull || l > W + cull) continue;
    ctx.fillRect(l, FLOOR, 3, 2); ctx.fillRect(r - 3, FLOOR, 3, 2);
    for (let x = l + 10; x < r - 8; x += 18) ctx.fillRect(x, FLOOR, 2, 1);
  }
}
function drawDevices(cam) {
  // Relay antennas: they carry the signal to a stranded friend.
  for (const rx of COURSE.relays) {
    const x = rx - cam; if (x < -30 - cull || x > W + 30 + cull) continue;
    ctx.fillStyle = '#4c6a66'; ctx.fillRect(x - 1, FLOOR - 64, 3, 64); ctx.fillRect(x - 7, FLOOR - 64, 15, 2);
    ctx.fillStyle = beatIndex(s) % 2 ? '#5fe39a' : '#27503c'; ctx.fillRect(x - 2, FLOOR - 70, 5, 5);
  }
  // The switch is a socket shaped like green: it glows whenever green floats
  // over it and the bridge stirs, before the player ever leaves green there.
  const sx = COURSE.switchX - cam, g = run.green;
  const over = !run.switchOn && g.state === 'follow' && Math.abs(g.x - COURSE.switchX) < 40;
  if (sx > -40 - cull && sx < W + 40 + cull) {
    ctx.fillStyle = run.switchOn ? '#5fe39a' : over ? '#3f8f66' : '#2d4a44'; ctx.fillRect(sx - 16, FLOOR - 4, 32, 4);
    ctx.strokeStyle = run.switchOn ? '#c8ffdc' : over ? '#9ff0c4' : '#4f7a6c'; ctx.lineWidth = 1; ctx.setLineDash(run.switchOn ? [] : [2, 2]);
    ctx.beginPath(); ctx.arc(sx, FLOOR - 15, 9, Math.PI, 0); ctx.lineTo(sx + 9, FLOOR - 5); ctx.lineTo(sx - 9, FLOOR - 5); ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = ctx.strokeStyle; ctx.fillRect(sx - 6, FLOOR - 31, 2, 7); ctx.fillRect(sx + 4, FLOOR - 31, 2, 7);
    if (over) { ctx.fillStyle = 'rgba(95,227,154,.18)'; ctx.beginPath(); ctx.arc(sx, FLOOR - 14, 22, 0, Math.PI * 2); ctx.fill(); }
  }
  const ba = COURSE.bridge.a - cam, bb = COURSE.bridge.b - cam;
  if (bb > -10 - cull && ba < W + 10 + cull) {
    // Once on, the planks run out from the near edge over one beat.
    const k = run.switchOn ? smooth(0, BEAT, run.t - run.switchAt) : over ? .12 + .04 * Math.sin(s * 20) : 0;
    const end = ba + (bb - ba) * k;
    ctx.fillStyle = '#2d4a44'; ctx.fillRect(ba - 4, FLOOR - 2, 6, 14); ctx.fillRect(bb - 2, FLOOR - 2, 6, 14);
    ctx.fillStyle = run.switchOn ? '#5fe39a' : '#27503c'; ctx.fillRect(ba - 3, FLOOR - 6, 4, 4); ctx.fillRect(bb - 1, FLOOR - 6, 4, 4);
    if (k > 0) {
      ctx.fillStyle = '#3d6b58'; ctx.fillRect(ba, FLOOR, end - ba, 10);
      ctx.fillStyle = '#9ff0c4'; for (let x = ba; x < end - 10; x += 14) ctx.fillRect(x, FLOOR, 10, 3);
    }
    if (k < 1) {
      ctx.strokeStyle = '#27403c'; ctx.setLineDash([3, 7]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(end, FLOOR + 2); ctx.lineTo(bb, FLOOR + 2); ctx.stroke(); ctx.setLineDash([]);
    }
  }
  // Crane: the span drops on its two solid beats of every four.
  const crane = COURSE.crane, cx = (crane.a + crane.b) / 2 - cam;
  if (cx > -160 - cull && cx < W + 160 + cull) {
    const k = beatIndex(s), phase = (s - k * BEAT) / BEAT;
    const yFor = beat => craneSolid(run, beat) ? 0 : -70;
    const y = FLOOR + yFor(k) + (yFor(k + 1) - yFor(k)) * smooth(0, .4, phase);
    ctx.fillStyle = '#4a3a36'; ctx.fillRect(crane.a - cam - 70, 120, 8, FLOOR - 120);
    ctx.fillRect(crane.a - cam - 70, 120, cx - (crane.a - cam - 70) + 10, 6);
    ctx.strokeStyle = '#8a6a60'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx, 126); ctx.lineTo(cx, y); ctx.stroke();
    const [l, r] = footing([crane.a, crane.b]);
    ctx.fillStyle = run.red.state === 'dormant' ? '#4b4a48' : '#c46f5c'; ctx.fillRect(l - cam, y, r - l, 8);
    ctx.fillStyle = '#ffd2c4'; ctx.fillRect(l - cam, y, r - l, 2);
  }
  // Base: dock mast and the transport rocket on its pad.
  const dx = COURSE.dockX - cam;
  if (dx > -80 - cull && dx < W + 200 + cull) {
    ctx.fillStyle = '#5b6f7a'; ctx.fillRect(dx - 3, FLOOR - 120, 6, 120);
    ctx.fillStyle = '#ffe3ac'; ctx.fillRect(dx - 14, FLOOR - 124, 28, 4);
    const a = after(), lift = a > ENDING.launch ? (a - ENDING.launch) ** 2 * 14 : 0, rx = COURSE.rocketX - cam, ry = FLOOR - lift;
    ctx.fillStyle = '#3a4a52'; ctx.fillRect(rx - 26, FLOOR - 4, 52, 4);
    ctx.fillStyle = '#e8e2d0'; ctx.fillRect(rx - 9, ry - 70, 18, 60);
    ctx.fillStyle = '#ff9161'; ctx.beginPath(); ctx.moveTo(rx - 9, ry - 70); ctx.lineTo(rx, ry - 88); ctx.lineTo(rx + 9, ry - 70); ctx.fill();
    ctx.fillRect(rx - 15, ry - 22, 6, 14); ctx.fillRect(rx + 9, ry - 22, 6, 14);
    ctx.fillStyle = '#8fd0ff'; ctx.fillRect(rx - 4, ry - 56, 8, 8);
    if (a > ENDING.launch - 2) { ctx.fillStyle = (s * 20 | 0) % 2 ? '#ffd28a' : '#ff9161'; ctx.fillRect(rx - 6, ry - 8, 12, 10 + (s * 30 | 0) % 8); }
  }
}
function drawFriends(cam) {
  for (const who of ['red', 'green', 'blue']) {
    const f = run[who];
    if (who === 'blue' && f.state === 'parts') continue;
    const slide = f.state === 'switch' && run.switchAt > 0 ? smooth(0, BEAT * .6, run.t - run.switchAt) : 1;
    const x = (f.from !== undefined && slide < 1 ? f.from + (f.x - f.from) * slide : f.x) - cam, y = friendY(who, f);
    if (x < -30 - cull || x > W + 30 + cull) continue;
    const awake = !['dormant', 'lost'].includes(f.state);
    if (who === 'green' && !run.together) drawGreenSignal(f, x, y);
    // A friend that lost the link goes dark-eyed with grey antenna tips.
    const palette = f.state === 'lost' ? { ...PALETTE[who], a: '#3a4a44' } : PALETTE[who];
    if (who === 'blue') {
      // Blue is the lamp: a soft pool of light under it.
      const glow = ctx.createRadialGradient(x, FLOOR - 4, 2, x, FLOOR - 4, 46);
      glow.addColorStop(0, `rgba(111,182,255,${.22 * lightOpen()})`); glow.addColorStop(1, 'rgba(111,182,255,0)');
      ctx.fillStyle = glow; ctx.fillRect(x - 46, FLOOR - 50, 92, 60);
    }
    drawPod(ctx, x, y, 1, { phase: (s / BEAT) % 1, time: s, palette, eyes: awake, idle: !awake });
  }
}
// Green's link: a dotted line to the hero and three bars over green. Both
// thin as the distance grows and flicker at the edge; when the link breaks
// the bars drop out and green's eyes go dark. It was left behind by the
// player's own speed, not by a script.
function drawGreenSignal(f, x, y) {
  if (f.state === 'dormant') return;
  const k = Math.abs(run.x - f.x) / RANGE, linked = f.state === 'follow' || f.state === 'catch';
  const bars = !linked ? 0 : k < .5 ? 3 : k < .78 ? 2 : 1, edge = linked && k > .78 && (s * 12 | 0) % 2;
  if (linked) {
    ctx.strokeStyle = `rgba(95, 227, 154, ${edge ? .08 : Math.max(.15, .75 - k * .55)})`;
    ctx.setLineDash([2, 4]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(heroX, heroY() - 56); ctx.lineTo(x, y - 30); ctx.stroke(); ctx.setLineDash([]);
  }
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i < bars ? (edge ? '#2c5a44' : '#5fe39a') : '#24342f';
    ctx.fillRect(x + 9 + i * 3, y - 38 - i * 2, 2, 3 + i * 2);
  }
  if (f.state === 'lost' && (s * 3 | 0) % 2) {
    ctx.fillStyle = '#ff9b80';
    for (const [dx, dy] of [[0, 0], [4, 0], [2, 2], [0, 4], [4, 4]]) ctx.fillRect(x + 9 + dx, y - 46 + dy, 2, 2);
  }
}
// Off the left edge, a small marker keeps a left-behind friend in mind while
// its music can still be heard.
function drawBehind(cam) {
  for (const who of ['green', 'red']) {
    const f = run[who], x = f.x - cam;
    if (run.together || x > -6 || ['dormant', 'station'].includes(f.state)) continue;
    const fade = 1 - smooth(RANGE, RANGE * 4.5, run.x - f.x);
    if (fade <= 0) continue;
    ctx.globalAlpha = fade; ctx.fillStyle = PALETTE[who].a;
    ctx.beginPath(); ctx.moveTo(4, FLOOR - 40); ctx.lineTo(11, FLOOR - 45); ctx.lineTo(11, FLOOR - 35); ctx.fill();
    ctx.fillStyle = f.state === 'lost' ? '#3a4a44' : PALETTE[who].c; ctx.fillRect(14, FLOOR - 44, 7, 8);
    ctx.fillStyle = f.state === 'lost' || f.state === 'dormant' ? '#24342f' : '#172638'; ctx.fillRect(15, FLOOR - 42, 2, 2); ctx.fillRect(18, FLOOR - 42, 2, 2);
    ctx.globalAlpha = 1;
  }
}
// The communication range, a faint ring while green follows in chapter II.
function drawRange() {
  const g = run.green;
  if (run.together || !(g.state === 'follow' || g.state === 'catch') || run.chapter !== 'apart') return;
  const k = (run.x - g.x) / RANGE;
  ctx.strokeStyle = `rgba(95, 227, 154, ${.07 + .25 * smooth(.55, 1, k)})`; ctx.lineWidth = 1; ctx.setLineDash([3, 6]);
  ctx.beginPath(); ctx.arc(heroX, heroY() - 56, RANGE, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
}
function drawFlashes(cam) {
  for (const f of flashes) {
    const age = s - f.at, x = f.x - cam;
    if (f.kind === 'snap' && age < .5) {
      ctx.fillStyle = `rgba(255,155,128,${1 - age / .5})`;
      for (let i = 0; i < 6; i++) ctx.fillRect(x + Math.cos(i) * age * 60, FLOOR - 40 + Math.sin(i * 2) * age * 40, 2, 2);
    } else if (f.kind === 'relink' && age < 1.2) {
      ctx.strokeStyle = `rgba(95,227,154,${1 - age / 1.2})`; ctx.lineWidth = 2;
      for (const lag of [0, .25]) { const r = Math.max(0, age - lag) * 160; ctx.beginPath(); ctx.arc(x, FLOOR - 68, r, Math.PI, Math.PI * 2); ctx.stroke(); }
    } else if (f.kind === 'switch' && age < 1) {
      ctx.strokeStyle = `rgba(200,255,220,${1 - age})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, FLOOR - 14, 10 + age * 40, 0, Math.PI * 2); ctx.stroke();
    } else if (f.kind === 'dawn' && age < 2.2) {
      // The light rolls out from the newly built lamp across the moon.
      ctx.strokeStyle = `rgba(169,214,255,${.7 * (1 - age / 2.2)})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(heroX - 30, FLOOR - 30, age * 260, 0, Math.PI * 2); ctx.stroke();
      if (age < .3) { ctx.fillStyle = `rgba(230,244,255,${.5 * (1 - age / .3)})`; ctx.fillRect(0, 0, W, H); }
    }
  }
  flashes = flashes.filter(f => s - f.at < 2.5 && s >= f.at - 1);
}
function heroY() {
  if (run.status === 'falling') { const age = s - run.fallAt * BEAT; return FLOOR - 2 + Math.min(150, age * age * 260); }
  return FLOOR - 2 - hopLift(run) * 96;
}
function drawHero(cam) {
  const x = (run.status === 'falling' ? run.fallX : run.x) - cam, docked = run.status === 'docked';
  const phase = (s % BEAT) / BEAT;
  drawPod(ctx, x, heroY(), 2, { phase: docked ? 0 : phase, fast: fast() && playing() && !docked, land: docked ? 0 : Math.max(0, 1 - phase / .17), time: s, signal: docked ? (heroBlink() ? 1 : 0) : 0 });
  if (docked && heroBlink()) { ctx.fillStyle = GLOW.hero; ctx.fillRect(x - 12, heroY() - 66, 3, 3); ctx.fillRect(x + 9, heroY() - 66, 3, 3); }
}
function drawDarkness() {
  const open = lightOpen();
  if (open >= 1 || run.chapter !== 'wake') return;
  // The hero's own glow pulses wider at each touchdown.
  const touch = Math.max(0, 1 - (s % BEAT) / .3), r = 64 + touch * 22 + open * 600;
  const gx = heroX, gy = heroY() - 20;
  const g = ctx.createRadialGradient(gx, gy, r * .35, gx, gy, r);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(2,4,6,${.95 * (1 - open)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function drawScene() {
  const cam = camera();
  drawBackdrop(cam);
  ctx.fillStyle = '#020406'; ctx.fillRect(0, FLOOR, W, H - FLOOR);
  drawRange(); drawPlatforms(cam); drawDevices(cam); drawFriends(cam); drawHero(cam);
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, 1 - p.age / .4); ctx.fillStyle = p.color;
    ctx.fillRect(p.x - cam + p.vx * p.age, p.y + p.vy * p.age + 120 * p.age ** 2, 3, 3);
  }
  ctx.globalAlpha = 1;
  drawDarkness(); drawGlints(cam); drawFlashes(cam); drawBehind(cam);
  // The active blue part glows through the dark.
  if (run.parts.got < COURSE.parts.length) {
    const px = run.parts.x - cam, pulse = reducedMotion.matches ? .5 : .5 + .5 * Math.sin(s * 4);
    if (px > -20 && px < W + 20) {
      ctx.fillStyle = `rgba(79,157,255,${.25 + .2 * pulse})`; ctx.beginPath(); ctx.arc(px, FLOOR - 10, 13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#a9d6ff'; ctx.fillRect(px - 4, FLOOR - 14, 8, 8);
    }
  }
  if (run.parts.got > 0 && run.parts.got < COURSE.parts.length) for (let i = 0; i < COURSE.parts.length; i++) {
    ctx.strokeStyle = '#2c4656'; ctx.strokeRect(16 + i * 14, 36, 10, 10);
    if (i < run.parts.got) { ctx.fillStyle = '#a9d6ff'; ctx.fillRect(18 + i * 14, 38, 6, 6); }
  }
}
function drawBackdrop(cam, alpha = 1) {
  ctx.fillStyle = '#05080c'; ctx.fillRect(0, 0, W, H);
  const stars = .25 + .75 * lightOpen();
  for (let i = 0; i < 60; i++) {
    const x = ((i * 97 - cam * .06) % 390 + 390) % 390;
    ctx.fillStyle = i % 7 ? `rgba(82,105,118,${stars})` : `rgba(234,214,164,${stars})`;
    ctx.fillRect(x | 0, 18 + i * 37 % 260, 2, i % 7 ? 2 : 3);
  }
  // Out of the dark: a horizon glow and a far range with lit rims appear only
  // once blue's light opens. The moon was always this wide.
  const open = lightOpen() * alpha;
  if (open > 0) {
    const sky = ctx.createLinearGradient(0, 150, 0, FLOOR);
    sky.addColorStop(0, 'rgba(40,70,100,0)'); sky.addColorStop(1, `rgba(60,100,140,${.35 * open})`);
    ctx.fillStyle = sky; ctx.fillRect(0, 150, W, FLOOR - 150);
    for (let x = -40; x < W + 40; x += 4) {
      const wx = x + cam * .015, h = 50 + Math.sin(wx * .011) * 28 + Math.sin(wx * .037) * 10;
      ctx.fillStyle = `rgba(22,38,50,${open})`; ctx.fillRect(x, FLOOR - 40 - h, 4, h);
      ctx.fillStyle = `rgba(150,190,220,${.45 * open})`; ctx.fillRect(x, FLOOR - 40 - h, 4, 1);
    }
  }
  ctx.globalAlpha = alpha;
  for (let layer = 0; layer < 2; layer++) {
    ctx.fillStyle = layer ? '#14242e' : '#101d26';
    for (let x = -28; x < W + 28; x += 28) {
      const h = 18 + (Math.sin((x + cam * (.04 + layer * .03)) * .025) + 1) * (22 + layer * 10);
      ctx.fillRect(x, FLOOR - h, 29, h);
    }
  }
  ctx.globalAlpha = 1;
}
function drawEnding() {
  // The view settles on the whole base, then turns into the rocket's window
  // and recedes until only four small lights remain.
  const a = after(), fit = smooth(0, 6, a), turn = smooth(ENDING.turn, ENDING.away, a), away = smooth(ENDING.away, ENDING.lights, a);
  const zoom = (1 - .42 * fit) * (1 - .3 * turn) * Math.exp(-2.3 * away);
  const cam = (run.x - heroX) * (1 - fit) + (COURSE.baseCenter - W / 2) * fit;
  const cy = FLOOR - 70 * fit + (H / 2 + 40 - FLOOR + 70) * turn;
  drawBackdrop(cam, 1 - turn);
  ctx.save(); ctx.translate(W / 2, cy); ctx.scale(zoom, zoom); ctx.translate(-W / 2, -FLOOR); cull = W / zoom;
  ctx.fillStyle = `rgba(14,26,34,${turn})`; ctx.fillRect(-W * 30, FLOOR, W * 61, H * 30);
  drawPlatforms(cam); drawDevices(cam); drawFriends(cam); drawHero(cam);
  ctx.restore(); cull = 20;
  // Four lights stay readable at any scale; the hero's blinks on the beat.
  const glow = smooth(ENDING.away + 6, ENDING.lights - 8, a);
  for (const [who, wx, wy] of [['blue', run.blue.x, friendY('blue', run.blue)], ['green', run.green.x, friendY('green', run.green)], ['red', run.red.x, friendY('red', run.red)], ['hero', COURSE.dockX, heroY() - 60]]) {
    const on = who !== 'hero' || heroBlink();
    const x = W / 2 + (wx - cam - W / 2) * zoom, y = cy + (wy - 20 - FLOOR) * zoom;
    ctx.globalAlpha = glow * (on ? 1 : .2); ctx.fillStyle = GLOW[who];
    ctx.beginPath(); ctx.arc(x, y, who === 'hero' && on ? 3 : 2.4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  if (turn > 0) {
    const r = 430 - 270 * turn;
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(W / 2, H / 2 - 10, r, 0, Math.PI * 2, true); ctx.fill('evenodd');
    ctx.strokeStyle = `rgba(120,140,150,${turn * .6})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(W / 2, H / 2 - 10, r, 0, Math.PI * 2); ctx.stroke();
  }
  const black = smooth(ENDING.black - 2, ENDING.black, a);
  if (black > 0) { ctx.fillStyle = `rgba(0,0,0,${black})`; ctx.fillRect(0, 0, W, H); }
  if (a >= ENDING.title) {
    ctx.globalAlpha = smooth(ENDING.title, ENDING.title + 2, a); ctx.fillStyle = '#fff0d0'; ctx.font = 'bold 30px monospace'; ctx.textAlign = 'center';
    ctx.fillText('RAPIPPO', W / 2, H / 2); ctx.globalAlpha = 1;
  }
}
function drawHints() {
  if (!playing() || run.hops >= 3 || run.status !== 'playing' || run.checkpoint > 0) return;
  ctx.textAlign = 'center'; ctx.fillStyle = '#c3d1c7'; ctx.font = '11px monospace';
  ctx.fillText(tr('hints')[run.hops], W / 2, 190);
}
function drawBanner() {
  if (!banner || !playing()) return;
  const age = (s - banner.at) / BEAT;
  if (age > 5) return;
  ctx.globalAlpha = smooth(0, .8, age) * (1 - smooth(4, 5, age));
  ctx.fillStyle = '#e9d9b0'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center';
  ctx.fillText(tr('chapters')[banner.id] || '', W / 2, 120); ctx.globalAlpha = 1;
}

// ---------- loop ----------
let lastS = 0;
function frame() {
  if (playing()) {
    s = clock.now(perfNow());
    if (s - lastS > .5 && lastS > 0) { lastS = s; pause(); }
    else {
      const events = [];
      if (run.status === 'docked') { run.t = s; }
      else input.advance(s, (from, to, f) => advanceStory(run, COURSE, to, f, events));
      lastS = s;
      predict(); handle(events); steerCamera();
      mixMusic(); scheduleMusic();
      const a = after();
      if (a >= ENDING.launch && !launched) { launched = true; audio.rumble(clock.contextTime(s) ?? 0, 7); }
      if (a >= ENDING.card) finish();
    }
  }
  particles.forEach(p => p.age += 1 / 60); particles = particles.filter(p => p.age < .4);
  if (run.status === 'docked' && after() >= 0) drawEnding(); else drawScene();
  drawHints(); drawBanner();
  requestAnimationFrame(frame);
}
run = initialRun(); ahead = structuredClone(run); refreshCopy(); requestAnimationFrame(frame);
// Browser tests read (never write) the run through an injected probe.
if (globalThis.__rapippoStoryProbe) globalThis.__rapippoStoryProbe.read = () => ({
  screen, s, x: run.x, beat: run.beat, status: run.status, chapter: run.chapter, checkpoint: run.checkpoint,
  parts: run.parts.got, blue: run.blue.state, green: run.green.state, red: run.red.state, switchOn: run.switchOn, greenX: run.green.x, redX: run.red.x,
  domain: clock.domain, dockAt: run.dockAt, offset: clock.offset, audio: audio.debug(),
  // How far the context clock runs ahead of what is heard right now.
  latency: audio.running ? audio.context.currentTime - heardFromContext(audio.context, perfNow()) : null,
  hasOutputTimestamp: !!audio.context?.getOutputTimestamp,
});
