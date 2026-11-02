// RAPIPPO STORY. Separate page and modules; FREE RUN code is only imported
// read-only (physics constants, footing, pod artwork).
import { INSET, FAST_SPEED, footing } from '../engine.mjs';
import { drawPod } from '../pod.mjs';
import { COMPANION_PALETTE } from '../companion.mjs';
import { BEAT, BeatClock, TimedInput, heardFromContext, beatIndex } from './beat.mjs';
import { COURSE } from './course.mjs';
import { newStory, storyFrom, advanceStory, craneSolid, hopLift, switchTries, switchSnap, RANGE, FOLLOW_GAP, FALL_BEATS } from './sim.mjs';
import { createStoryAudio, notesAt, STEP, ENDING } from './music.mjs';
import { chooseLanguage, storyCopy } from './copy.mjs';
import { drawCrewParts, drawTransmit } from './crew.mjs';

const get = id => document.getElementById(id);
const canvas = get('play'), ctx = canvas.getContext('2d');
const W = 360, H = 510, FLOOR = 382, HERO_X = 130, LOOKAHEAD = .15;
const LAG_MAX = Math.floor(W - 8 - HERO_X - FAST_SPEED * BEAT);
const PALETTE = { blue: COMPANION_PALETTE, green: { c: '#b4f2c8', w: '#ecfff2', s: '#73c290', a: '#3fcf7f' }, red: { c: '#ffbcae', w: '#fff1ec', s: '#d98a7a', a: '#ff6a4f' } };
const GLOW = { blue: '#6fb6ff', green: '#5fe39a', red: '#ff7f66', hero: '#bfe6ff' };
// Each friend's part, and so the ending beat it rejoins on.
const PART = { blue: 'bell', green: 'bass', red: 'perc' };
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
  run = initialRun(); ahead = structuredClone(run); cued.clear(); s = 0; heroX = HERO_X; cameraS = 0; particles = []; flashes = []; launched = false; inset = 0; pickupAt = null;
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
const CUES = new Set(['collect', 'assemble', 'join', 'socket', 'switch', 'strand', 'relink', 'notice', 'rescue', 'pickup', 'reunion', 'station', 'dock', 'fall', 'respawn']);
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
  // Bar 1 of the song falls on the beat blue is assembled.
  get origin() { return ahead.parts.assembledAt === null ? 0 : Math.round(ahead.parts.assembledAt / BEAT); },
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
  const far = { level: .5 * (1 - smooth(RANGE, RANGE * 4.5, d)), clarity: .3 * (1 - smooth(RANGE, RANGE * 3, d)) };
  // Once red has green, both parts come back through red's own link: faint
  // and thin at first, clearer with every hop until they are beside you.
  if (friend.state === 'carry') {
    const near = smooth(Math.log(6000), Math.log(RANGE), Math.log(Math.max(d, 1)));
    return { level: Math.max(far.level, .3 + .6 * near), clarity: Math.max(far.clarity, .12 + .6 * near) };
  }
  return far;
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
    // The base keeps playing to the very end; only the distance grows.
    // The pad exists only here: the four of them, finally all together.
    levels.tick = 0; levels.bell = levels.bass = levels.perc = levels.pad = (.12 + .88 * (1 - k) ** 2) * out;
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
    else if (e.type === 'notice') flashes.push({ kind: 'ping', x: run.red.x, at: e.t });
    else if (e.type === 'pickup') { pickupAt = e.t; flashes.push({ kind: 'pickup', x: e.x, at: e.t }); }
    else if (e.type === 'reunion') flashes.push({ kind: 'reunion', x: run.x, at: e.t });
    else if (e.type === 'dock') { releaseInput(); showBanner('send'); flashes.push({ kind: 'dock', x: COURSE.dockX, at: e.t }); }
    else if (e.type === 'chapter') showBanner(e.id);
  }
}
// Test probe: scheduled notes and events (only when a probe is injected).
const probe = globalThis.__rapippoStoryProbe;
function probeNote(part, at, storyTime) { if (probe) (probe.notes ||= []).push({ part, at, s: storyTime }); }
function probeEvent(e) { if (probe) (probe.events ||= []).push({ type: e.type, t: e.t, beat: e.beat }); }

// ---------- drawing ----------
// Docked, the hero's light blinks for 0.12s on every beat from D+1: the
// first blink is the beat blue takes over.
const heroBlink = () => run.status === 'docked' && after() >= 1 && s - beatIndex(s) * BEAT < .12;
// The hero's screen x. While a friend lags behind (green in II, red at the
// crane in III), the camera slides so both stay in view: the player watches
// the gap open and sees the friend they leave behind.
let heroX = HERO_X, cameraS = 0;
function steerCamera() {
  let lag = 0;
  for (const f of [run.green, run.red]) {
    if (run.together || ['dormant', 'station'].includes(f.state)) continue;
    const d = run.x - f.x;
    // Capped so the landing of a full FAST hop (HERO_X + 210.6px) never
    // leaves the screen; past that, the ring and the edge marker show the
    // friend left behind. Red looks back from right beside the hero.
    if (d > 0 && d < RANGE * 2) lag = Math.max(lag, Math.min(d - FOLLOW_GAP, LAG_MAX) * (1 - smooth(RANGE * 1.5, RANGE * 2, d)));
  }
  const dt = Math.max(0, Math.min(.1, s - cameraS)); cameraS = s;
  heroX += (HERO_X + Math.max(0, lag) - heroX) * (1 - Math.exp(-dt * 5));
}
const camera = () => run.x - heroX;
function friendY(who, friend) {
  const lag = { blue: .5, green: .25, red: .75 }[who];
  const phase = ((s / BEAT + lag) % 1 + 1) % 1;
  if (friend.state === 'station') {
    // At their stations friends touch down on the beat with the hero. When
    // the hero stops they hold still, and each starts again on its own beat.
    if (run.status === 'docked' && after() < ENDING[PART[who]]) return FLOOR - 4;
    return FLOOR - 2 - Math.sin((((s / BEAT) % 1) + 1) % 1 * Math.PI) * 18;
  }
  if (friend.state === 'dormant' || friend.state === 'lost') return FLOOR - 2;
  // Red sits on the crane's beam (y 120) while it works the span.
  if (friend.state === 'crane') return 119 + (FLOOR - 18 - Math.sin(phase * Math.PI) * 44 - 119) * smooth(0, 260, Math.abs(friend.x - (COURSE.crane.a + COURSE.crane.b) / 2));
  if (friend.state === 'notice') return 119 + (FLOOR - 44 - 119) * smooth(0, BEAT * .6, s - friend.noticeAt * BEAT);
  if (friend.state === 'rescue' || friend.state === 'carry') return FLOOR - 64 + Math.sin(s * 6) * 3 + (who === 'green' ? 18 : 0);
  if (friend.state === 'switch') return FLOOR - 6 - Math.abs(Math.sin(phase * Math.PI)) * 6;
  // Habits: blue floats high and soft, green hops low and heavy, red is
  // brisk (sharp take-off, quick landing).
  const arc = Math.sin(phase * Math.PI);
  if (who === 'blue') return FLOOR - 30 - arc * 30;
  if (who === 'green') return FLOOR - 10 - arc * 30;
  return FLOOR - 16 - Math.pow(arc, .6) * 40;
}
function drawPlatforms(cam, flat = false) {
  for (const p of COURSE.platforms) {
    const [left, right] = footing([p.a, p.b]), l = Math.round(left - cam), r = Math.round(right - cam);
    if (r < -cull || l > W + cull || p.kind === 'crane') continue;
    // Seen from the rocket only the lit tops show on the moon's surface.
    if (flat) { ctx.fillStyle = p.kind === 'station' ? '#c9d9ff' : p.kind === 'dock' ? '#ffe3ac' : '#4a636a'; ctx.fillRect(l, FLOOR, r - l, 8); continue; }
    ctx.fillStyle = '#2e4850'; ctx.fillRect(l, FLOOR, r - l, H);
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
  const sx = COURSE.switchX - cam, g = run.green, tries = run.chapter === 'apart' ? switchTries(run) : 0;
  const over = !run.switchOn && g.state === 'follow' && Math.abs(g.x - COURSE.switchX) < Math.max(40, tries ? switchSnap(run) : 0);
  if (sx > -200 - cull && sx < W + 200 + cull) {
    // After a fall the socket shows where green may stop: the band widens
    // with each try, and from the second it pulses on every beat.
    if (tries && !run.switchOn) {
      const snap = switchSnap(run);
      ctx.fillStyle = `rgba(95,227,154,${.08 + .04 * Math.min(3, tries)})`; ctx.fillRect(sx - snap, FLOOR, snap * 2, 3);
      ctx.fillStyle = 'rgba(159,240,196,.5)'; ctx.fillRect(sx - snap, FLOOR - 3, 2, 6); ctx.fillRect(sx + snap - 2, FLOOR - 3, 2, 6);
      if (tries >= 2 && run.x >= COURSE.fieldStart) {
        const age = s - beatIndex(s) * BEAT;
        ctx.strokeStyle = `rgba(159,240,196,${.5 * (1 - age / BEAT)})`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(sx, FLOOR - 14, 12 + age * 30, Math.PI, 0); ctx.stroke();
      }
    }
    ctx.fillStyle = run.switchOn ? '#5fe39a' : over ? '#3f8f66' : '#2d4a44'; ctx.fillRect(sx - 16, FLOOR - 4, 32, 4);
    ctx.strokeStyle = run.switchOn ? '#c8ffdc' : over ? '#9ff0c4' : '#4f7a6c'; ctx.lineWidth = 1; ctx.setLineDash(run.switchOn ? [] : [2, 2]);
    ctx.beginPath(); ctx.arc(sx, FLOOR - 15, 9, Math.PI, 0); ctx.lineTo(sx + 9, FLOOR - 5); ctx.lineTo(sx - 9, FLOOR - 5); ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = ctx.strokeStyle; ctx.fillRect(sx - 6, FLOOR - 31, 2, 7); ctx.fillRect(sx + 4, FLOOR - 31, 2, 7);
    if (over) { ctx.fillStyle = 'rgba(95,227,154,.18)'; ctx.beginPath(); ctx.arc(sx, FLOOR - 14, 22 + 8 * Math.min(3, tries), 0, Math.PI * 2); ctx.fill(); }
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
    const a = after();
    if (a >= 0) {
      // The connector drops onto the hero on the dock beat; from D+1 the mast
      // sends a ring out on every beat: the hero's light, broadcast.
      const top = FLOOR - 118, head = heroY() - 58, k = smooth(0, .22, a);
      ctx.strokeStyle = '#ffe3ac'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(dx + 6, top); ctx.lineTo(dx + 6, top + (head - top) * k); ctx.stroke();
      ctx.fillStyle = '#ffe3ac'; ctx.fillRect(dx + 3, top + (head - top) * k - 3, 7, 4);
      if (a >= 1) {
        const age = s - beatIndex(s) * BEAT;
        ctx.strokeStyle = `rgba(191,230,255,${.6 * (1 - age / BEAT)})`; ctx.lineWidth = 1.5;
        for (const lag of [0, .3]) { const r = 6 + Math.max(0, age - lag * BEAT) * 70; ctx.beginPath(); ctx.arc(dx, FLOOR - 124, r, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); }
      }
    }
    const lift = rocketLift(a), rx = COURSE.rocketX - cam, ry = FLOOR - lift;
    if (a < ENDING.turn) {
    ctx.fillStyle = '#3a4a52'; ctx.fillRect(rx - 26, FLOOR - 4, 52, 4);
    ctx.fillStyle = '#e8e2d0'; ctx.fillRect(rx - 9, ry - 70, 18, 60);
    ctx.fillStyle = '#ff9161'; ctx.beginPath(); ctx.moveTo(rx - 9, ry - 70); ctx.lineTo(rx, ry - 88); ctx.lineTo(rx + 9, ry - 70); ctx.fill();
    ctx.fillRect(rx - 15, ry - 22, 6, 14); ctx.fillRect(rx + 9, ry - 22, 6, 14);
    ctx.fillStyle = '#8fd0ff'; ctx.fillRect(rx - 4, ry - 56, 8, 8);
    if (a > ENDING.launch - 2) { ctx.fillStyle = (s * 20 | 0) % 2 ? '#ffd28a' : '#ff9161'; ctx.fillRect(rx - 6, ry - 8, 12, 10 + (s * 30 | 0) % 8); }
    }
  }
}
const rocketLift = a => a > ENDING.launch ? (a - ENDING.launch) ** 2 * 14 : 0;
function drawFriends(cam, inset = false) {
  for (const who of ['red', 'green', 'blue']) {
    const f = run[who];
    if (who === 'blue' && f.state === 'parts') continue;
    const slide = f.state === 'switch' && run.switchAt > 0 ? smooth(0, BEAT * .6, run.t - run.switchAt) : 1;
    const x = (f.from !== undefined && slide < 1 ? f.from + (f.x - f.from) * slide : f.x) - cam, y = friendY(who, f);
    if (x < -30 - cull || x > W + 30 + cull) continue;
    const awake = !['dormant', 'lost'].includes(f.state);
    if (who === 'green' && !run.together && !inset) drawGreenSignal(f, x, y);
    if (who === 'red' && (f.state === 'rescue' || f.state === 'carry')) {
      // Red flies on its own: a streak behind it, and its own signal ring.
      const dir = f.state === 'rescue' ? 1 : -1;
      ctx.fillStyle = 'rgba(255,127,102,.35)'; ctx.fillRect(x + dir * 10, y - 22, dir * 50, 2); ctx.fillRect(x + dir * 14, y - 16, dir * 30, 1);
      ctx.strokeStyle = `rgba(255,127,102,${.25 + .2 * Math.sin(s * 8)})`; ctx.lineWidth = 1; ctx.setLineDash([3, 5]);
      ctx.beginPath(); ctx.arc(x, y - 20, 40, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }
    // A friend that lost the link goes dark-eyed with grey antenna tips.
    const palette = f.state === 'lost' ? { ...PALETTE[who], a: '#3a4a44' } : PALETTE[who];
    if (who === 'blue') {
      // Blue is the lamp: a soft pool of light under it.
      const glow = ctx.createRadialGradient(x, FLOOR - 4, 2, x, FLOOR - 4, 46);
      glow.addColorStop(0, `rgba(111,182,255,${.22 * lightOpen()})`); glow.addColorStop(1, 'rgba(111,182,255,0)');
      ctx.fillStyle = glow; ctx.fillRect(x - 46, FLOOR - 50, 92, 60);
    }
    drawPod(ctx, x, y, 1, { phase: (s / BEAT) % 1, time: s, palette, eyes: awake, idle: !awake });
    drawCrewParts(ctx, who, x, y, 1, crewForm(who, f));
    // In the ending each friend's touchdown on its beat leaves a small ring.
    if (f.state === 'station' && run.status === 'docked' && after() >= ENDING[PART[who]]) {
      const age = s - beatIndex(s) * BEAT;
      if (age < .35) { ctx.strokeStyle = GLOW[who]; ctx.globalAlpha = 1 - age / .35; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(x, FLOOR - 1, 10 + age * 50, 3 + age * 8, 0, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
    }
  }
}
// Same face, different job: each friend's transformed form while it works.
// blue opens its light for the dawn and on its bell beats at the base; green
// plants its legs on the switch and at its station; red half-opens its arm
// while it works the crane and looks back, fully while it fetches and carries.
const formSince = {}, formWas = {};
function crewForm(who, f) {
  const a = after(), beatAge = s - beatIndex(s) * BEAT, docked = run.status === 'docked';
  const plays = f.state === 'station' && (!docked || a >= ENDING[PART[who]]);
  let target = 0, pulse = 0, dir = 'up';
  if (who === 'blue') {
    const dawn = run.parts.assembledAt === null ? 0 : 1 - smooth(2.5, 4, run.t - run.parts.assembledAt);
    target = Math.max(dawn, plays ? 1 : 0); pulse = plays ? Math.max(0, 1 - beatAge / .3) : 0;
  } else if (who === 'green') target = f.state === 'switch' || plays ? 1 : 0;
  else if (who === 'red') { target = { crane: .5, notice: .5, rescue: 1, carry: 1 }[f.state] ?? 0; dir = f.state === 'carry' ? 'down' : 'up'; }
  if (formWas[who] !== target) { formWas[who] = target; formSince[who] = s; }
  const age = s - (formSince[who] ?? -9), form = target ? target * smooth(0, .18, age) : 0;
  const phase = ((s / BEAT) % 1 + 1) % 1;
  return { palette: PALETTE[who], form, pulse, dir, snap: who === 'green' && target === 1 && age > .06 && age < .12, top: -18 - Math.round(3 + Math.sin(phase * Math.PI) * 2), on: f.state !== 'lost' && f.state !== 'dormant' };
}
// Red's trip back, seen through a small comms window while it is off
// screen: red reaches green on the switch, green's eyes light again, and the
// two lift off together. No words; the main view keeps playing.
let inset = 0, insetS = 0, pickupAt = null;
function insetWanted() {
  const { red, green } = run;
  if (red.state === 'rescue') return red.x - green.x < 1400;
  return red.state === 'carry' && pickupAt !== null && s - pickupAt < 4.5 && red.x - camera() < -30;
}
function drawInset() {
  const dt = Math.max(0, Math.min(.1, s - insetS)); insetS = s;
  inset += ((insetWanted() ? 1 : 0) - inset) * (1 - Math.exp(-dt * 8));
  if (inset < .02) return;
  const { red, green } = run, w = 176, h = 100, x0 = 10, y0 = 50, scale = .6;
  const focus = red.state === 'rescue' ? green.x + 40 : red.x - 30;
  const cam = focus - W / 2;
  ctx.save(); ctx.globalAlpha = inset;
  ctx.beginPath(); ctx.roundRect(x0, y0, w, h, 6); ctx.clip();
  ctx.fillStyle = '#060b10'; ctx.fillRect(x0, y0, w, h);
  ctx.translate(x0 + w / 2, y0 + h - 18); ctx.scale(scale, scale); ctx.translate(-W / 2, -FLOOR); cull = W;
  drawPlatforms(cam); drawDevices(cam); drawFriends(cam, true);
  if (pickupAt !== null && s - pickupAt < 1.2) {
    const age = s - pickupAt;
    ctx.strokeStyle = `rgba(255,127,102,${1 - age / 1.2})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(green.x - cam, FLOOR - 60, 10 + age * 120, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore(); cull = 20;
  ctx.save(); ctx.globalAlpha = inset;
  ctx.fillStyle = 'rgba(255,255,255,.04)'; for (let y = y0; y < y0 + h; y += 3) ctx.fillRect(x0, y, w, 1);
  ctx.strokeStyle = 'rgba(255,127,102,.7)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(x0, y0, w, h, 6); ctx.stroke();
  ctx.fillStyle = (s * 2 | 0) % 2 ? '#ff7f66' : '#7a3a30'; ctx.fillRect(x0 + w - 10, y0 + 5, 4, 4);
  ctx.restore();
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
    if (who === 'green' && f.state === 'carry') continue;
    // A carried pair is coming back: its marker stays until it arrives.
    const fade = f.state === 'carry' ? 1 : 1 - smooth(RANGE, RANGE * 4.5, run.x - f.x);
    if (fade <= 0) continue;
    ctx.globalAlpha = fade; ctx.fillStyle = PALETTE[who].a;
    ctx.beginPath(); ctx.moveTo(4, FLOOR - 40); ctx.lineTo(11, FLOOR - 45); ctx.lineTo(11, FLOOR - 35); ctx.fill();
    ctx.fillStyle = f.state === 'lost' ? '#3a4a44' : PALETTE[who].c; ctx.fillRect(14, FLOOR - 44, 7, 8);
    ctx.fillStyle = f.state === 'lost' || f.state === 'dormant' ? '#24342f' : '#172638'; ctx.fillRect(15, FLOOR - 42, 2, 2); ctx.fillRect(18, FLOOR - 42, 2, 2);
    if (f.state === 'carry') { ctx.fillStyle = PALETTE.green.c; ctx.fillRect(14, FLOOR - 33, 7, 7); }
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
    } else if (f.kind === 'ping' && age < BEAT) {
      // Red looks back: pings sent from where it is towards where green was left.
      const rx = run.red.x - cam, ry = friendY('red', run.red) - 20;
      ctx.strokeStyle = `rgba(255,127,102,${1 - age / BEAT})`; ctx.lineWidth = 2;
      for (const lag of [0, .2]) { const r = 14 + Math.max(0, age - lag) * 120; ctx.beginPath(); ctx.arc(rx, ry, r, Math.PI * .75, Math.PI * 1.25); ctx.stroke(); }
    } else if (f.kind === 'reunion' && age < 1.4) {
      ctx.lineWidth = 2;
      for (const [i, c] of ['#6fb6ff', '#5fe39a', '#ff7f66'].entries()) {
        const r = Math.max(0, age - i * .12) * 150; ctx.strokeStyle = c; ctx.globalAlpha = Math.max(0, 1 - age / 1.4);
        ctx.beginPath(); ctx.arc(heroX, heroY() - 30, r, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else if (f.kind === 'dock' && age < 1) {
      ctx.strokeStyle = `rgba(255,227,172,${1 - age})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x, FLOOR - 1, 12 + age * 70, 4 + age * 10, 0, 0, Math.PI * 2); ctx.stroke();
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
  // Docked, the hero becomes the transmitter: taller ears, a locked base,
  // a light that blinks on every beat although it no longer hops.
  if (docked && after() >= 0) drawTransmit(ctx, x, heroY(), 2, smooth(0, .3, after()), heroBlink());
}
// Wind-up: a low, ragged rock ceiling presses down while the hero ticks
// through the dark. When blue is built it lifts away over three seconds and
// the sky, the far range and the horizon open above: the moon was always
// this wide. It never reaches the ground, so landings stay readable.
function drawCeiling(cam) {
  const open = lightOpen();
  if (open >= 1 || run.chapter !== 'wake') return;
  const lift = 190 * open * open;
  ctx.fillStyle = '#0b1319';
  ctx.beginPath(); ctx.moveTo(0, -10);
  for (let x = 0; x <= W; x += 6) {
    const wx = x + cam * .6, h = 128 + Math.sin(wx * .021) * 24 + Math.sin(wx * .083) * 9 + (Math.sin(wx * .4) > .85 ? 16 : 0);
    ctx.lineTo(x, h - lift);
  }
  ctx.lineTo(W, -10); ctx.closePath(); ctx.fill();
  // Its underside catches the hero's glow on each touchdown.
  const touch = Math.max(0, 1 - (s % BEAT) / .3);
  ctx.strokeStyle = `rgba(140,170,180,${.3 + .25 * touch})`; ctx.lineWidth = 1.5; ctx.beginPath();
  for (let x = 0; x <= W; x += 6) {
    const wx = x + cam * .6, h = 128 + Math.sin(wx * .021) * 24 + Math.sin(wx * .083) * 9 + (Math.sin(wx * .4) > .85 ? 16 : 0);
    x ? ctx.lineTo(x, h - lift) : ctx.moveTo(x, h - lift);
  }
  ctx.stroke();
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
  drawDarkness(); drawCeiling(cam); drawGlints(cam); drawFlashes(cam); drawBehind(cam); drawInset();
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
    // On the far ridge, the base's lights: where this road goes. Nearly at
    // infinity, they drift only a few pixels over the whole journey.
    for (const [i, x0] of [[0, 268], [1, 281], [2, 302]]) {
      const x = x0 - Math.min(40, cam * .0014), wx = x + cam * .015, ridge = FLOOR - 40 - (50 + Math.sin(wx * .011) * 28 + Math.sin(wx * .037) * 10);
      ctx.globalAlpha = open * (.45 + .4 * Math.sin(s * 1.3 + i * 2)); ctx.fillStyle = i === 1 ? '#ffe3ac' : '#bfe6ff';
      ctx.fillRect(x | 0, (ridge | 0) - 3, 2, 2);
    }
    ctx.globalAlpha = 1;
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
// The ending: the view settles on the whole base, follows the rocket up,
// dips, and opens again in the rocket's window looking back at the base. The
// base recedes until only four lights remain; the camera never turns away.
let lights = [];
function drawEnding() {
  const a = after();
  if (a < ENDING.turn) drawBaseView(a); else drawWindowView(a);
  const dip = smooth(ENDING.turn - .7, ENDING.turn, a) * (1 - smooth(ENDING.turn, ENDING.turn + 1, a));
  const black = Math.max(dip, smooth(ENDING.black - 2, ENDING.black, a));
  if (black > 0) { ctx.fillStyle = `rgba(0,0,0,${black})`; ctx.fillRect(0, 0, W, H); }
  if (a >= ENDING.title) {
    ctx.globalAlpha = smooth(ENDING.title, ENDING.title + 2, a); ctx.fillStyle = '#fff0d0'; ctx.font = 'bold 30px monospace'; ctx.textAlign = 'center';
    ctx.fillText('RAPIPPO', W / 2, H / 2); ctx.globalAlpha = 1;
  }
}
function drawBaseView(a) {
  // The camera pulls back on the stopping beat, so by D+1 the whole base,
  // and blue taking the beat, is in view.
  const fit = smooth(0, .9, a), follow = smooth(ENDING.launch, ENDING.launch + 3.5, a);
  const zoom = 1 - .48 * fit;
  const cam = ((run.x - heroX) * (1 - fit) + (COURSE.baseCenter - W / 2) * fit) * (1 - follow * .5) + (COURSE.rocketX - W / 2) * follow * .5;
  const cy = FLOOR - 70 * fit + rocketLift(a) * zoom * follow * .8;
  drawBackdrop(cam);
  ctx.save(); ctx.translate(W / 2, cy); ctx.scale(zoom, zoom); ctx.translate(-W / 2, -FLOOR); cull = W / zoom;
  ctx.fillStyle = '#020406'; ctx.fillRect(-W, FLOOR + 14, W * 3, H * 2);
  drawPlatforms(cam); drawDevices(cam); drawFriends(cam); drawHero(cam); drawFlashes(cam);
  ctx.restore(); cull = 20; lights = [];
}
function drawWindowView(a) {
  // Climbing away: the base shrinks and sinks in the window, the horizon curves.
  const k = smooth(ENDING.turn, ENDING.lights, a), zoom = .55 * Math.pow(.19 / .55, k), drop = 20 + 50 * k;
  const cx = W / 2, cy = H / 2 - 10, cam = (COURSE.stations[0].x + COURSE.dockX) / 2 - W / 2, tilt = reducedMotion.matches ? 0 : .05 * Math.sin(a * .35);
  ctx.fillStyle = '#04070b'; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 70; i++) { ctx.fillStyle = i % 6 ? '#3a4d58' : '#d8c9a0'; ctx.fillRect((i * 131 + a * 2) % W | 0, (i * 71) % H, 1.5, 1.5); }
  ctx.save(); ctx.translate(cx, cy + drop); ctx.rotate(tilt); ctx.scale(zoom, zoom); ctx.translate(-W / 2, -FLOOR); cull = W / zoom;
  // The moon's curve shows as the rocket climbs.
  const R = 5200;
  ctx.fillStyle = '#121e25'; ctx.beginPath(); ctx.arc(W / 2, FLOOR + R, R, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#38505a'; ctx.lineWidth = 3 / zoom; ctx.beginPath(); ctx.arc(W / 2, FLOOR + R, R, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke();
  drawPlatforms(cam, true); drawDevices(cam); drawFriends(cam); drawHero(cam);
  ctx.restore(); cull = 20;
  // Four lights stay readable at any scale; the hero's blinks on the beat.
  const project = (wx, wy) => {
    const dx = (wx - cam - W / 2) * zoom, dy = (wy - FLOOR) * zoom, c = Math.cos(tilt), sn = Math.sin(tilt);
    return [cx + dx * c - dy * sn, cy + drop + dx * sn + dy * c];
  };
  const glow = smooth(ENDING.away, ENDING.away + 10, a);
  lights = [['blue', run.blue.x, friendY('blue', run.blue) - 20], ['green', run.green.x, friendY('green', run.green) - 20], ['red', run.red.x, friendY('red', run.red) - 20], ['hero', COURSE.dockX, heroY() - 80]]
    .map(([who, wx, wy]) => { const [x, y] = project(wx, wy); return { who, x, y, on: who !== 'hero' || heroBlink() }; });
  for (const l of lights) {
    ctx.globalAlpha = glow * (l.on ? .28 : .06); ctx.fillStyle = GLOW[l.who];
    ctx.beginPath(); ctx.arc(l.x, l.y, 7, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = glow * (l.on ? 1 : .22);
    ctx.beginPath(); ctx.arc(l.x, l.y, l.who === 'hero' && l.on ? 3.6 : 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // The rocket's window.
  const open = smooth(ENDING.turn, ENDING.turn + 1.5, a), r = 200 - 40 * open;
  ctx.fillStyle = '#000'; ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(cx, cy, r, 0, Math.PI * 2, true); ctx.fill('evenodd');
  ctx.strokeStyle = 'rgba(120,140,150,.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(120,140,150,.25)'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(cx, cy, r + 7, 0, Math.PI * 2); ctx.stroke();
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
  domain: clock.domain, dockAt: run.dockAt, offset: clock.offset, audio: audio.debug(), after: after(), inset, heroLit: heroBlink(), lights,
  friendY: { blue: friendY('blue', run.blue), green: friendY('green', run.green), red: friendY('red', run.red) }, tries: switchTries(run),
  // How far the context clock runs ahead of what is heard right now.
  latency: audio.running ? audio.context.currentTime - heardFromContext(audio.context, perfNow()) : null,
  hasOutputTimestamp: !!audio.context?.getOutputTimestamp,
});
