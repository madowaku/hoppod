import { PERIOD, INSET, footing } from '../src/engine.mjs';
import { drawPod } from '../src/pod.mjs';
import { createAudio } from '../src/audio.mjs';
import { chooseLanguage } from '../src/ui-copy.mjs';
import { LAB, CONTACT_WINDOW, feetY } from './string-trajectory.mjs';
import {
  COURSE, TOWER, FIRST_SAVE, newAttempt, advanceAttempt, advanceWithPlan, planIsFast, judge, bobAt
} from './clock-tower-model.mjs';

const GEAR_COUNT = COURSE.gears.length;
const TEXT = {
  ja: {
    title: '時計台', goal: '振り子をよけて、鐘に体当たりで鳴らそう。金色の歯車にも触れると★★',
    start: '押すと時計が動く', fast: '押している間 FAST', slow: '離すと SLOW', next: '押してもう一度', again: '押して再開',
    idle: '押すと1拍おいて跳びます。何度でも、最後の踊り場から再開できます。',
    ready: '1拍の助走…', demoing: '見本を再生中。押すと自分の番に戻ります。', demoDone: '見本おわり。自分でやってみよう',
    short: '手前に落ちた。もう少し長く押そう', far: '飛びすぎた。もう少し早く離そう', hit: '振り子に当たった',
    hint: 'ヒント：跳んで少し待ってから押し、着地まで離さない',
    saved: '踊り場に着いた。ここから再開できる', gear: n => `歯車が回った！ ${n}/${GEAR_COUNT}`,
    gearMissed: '歯車に届かなかった。跳びのてっぺんで触れると回る', gearMissedShort: '届かず',
    clear: n => `★ 鐘を鳴らした！ 歯車 ${n}/${GEAR_COUNT}。全部回すと★★`, full: '★★ 歯車を全部回して、鐘を鳴らした！',
    stall: '処理が止まったので、やり直します',
    demoClear: '▶ 見本 ★', demoFull: '▶ 見本 ★★', retry: '踊り場から (R)', restart: '最初から',
    sound: ['音 ON', '音 OFF'], language: 'EN',
    labelGears: '歯車', labelRoom: '部屋', labelBest: 'ベスト',
    bannerClear: '★ ゴーン！', bannerFull: '★★ ゴーン！', bannerFall: 'FALL', bannerHit: 'ゴツン', bannerGears: n => `歯車 ${n}/${GEAR_COUNT}`,
    now: '今', high: '歯車に届く高さ',
    notesTitle: 'テスト記録と操作メモ',
    notes: '操作は押す・離すだけ（Space も可、R で踊り場から再開）。下の記録は端末の中だけにあり、送信されません。試遊の後でコピーして共有できます。',
    copy: '記録をコピー', copied: 'コピーしました', copyFailed: '選択したので手動でコピーしてください'
  },
  en: {
    title: 'CLOCK TOWER', goal: 'Dodge the pendulums and fly into the bell to ring it. Optional: touch the gold gears for ★★',
    start: 'PRESS TO WAKE THE CLOCK', fast: 'HOLDING = FAST', slow: 'RELEASED = SLOW', next: 'PRESS TO GO AGAIN', again: 'PRESS TO RESUME',
    idle: 'Press: one beat later you jump. You always resume from the last landing.',
    ready: 'One beat run-up…', demoing: 'Playing the demo. Press to take over.', demoDone: 'Demo finished. Your turn',
    short: 'Fell short. Hold a little longer', far: 'Flew too far. Release a little earlier', hit: 'A pendulum got you',
    hint: 'Hint: wait a moment after take-off, then hold until you land',
    saved: 'Landing reached. You resume from here', gear: n => `A gear turned! ${n}/${GEAR_COUNT}`,
    gearMissed: 'Missed a gear. Touch it at the top of a hop to turn it', gearMissedShort: 'MISSED',
    clear: n => `★ You rang the bell! Gears ${n}/${GEAR_COUNT}. Turn them all for ★★`, full: '★★ Every gear turned, and the bell rang!',
    stall: 'Playback stalled, restarting',
    demoClear: '▶ DEMO ★', demoFull: '▶ DEMO ★★', retry: 'FROM LANDING (R)', restart: 'FROM THE START',
    sound: ['SOUND ON', 'SOUND OFF'], language: '日本語',
    labelGears: 'GEARS', labelRoom: 'ROOM', labelBest: 'BEST',
    bannerClear: '★ BONG!', bannerFull: '★★ BONG!', bannerFall: 'FALL', bannerHit: 'BONK', bannerGears: n => `GEARS ${n}/${GEAR_COUNT}`,
    now: 'NOW', high: 'high enough for a gear',
    notesTitle: 'Test log and controls',
    notes: 'Just press and release (Space works, R resumes from the landing). The log stays on this device and is never sent. Copy it after a session to share it.',
    copy: 'COPY LOG', copied: 'Copied', copyFailed: 'Selected: copy it manually'
  }
};

const $ = id => document.getElementById(id);
const canvas = $('scene'), ctx = canvas.getContext('2d');
const W = 360, H = 510, FLOOR = LAB.floorY, HERO_X = 80;
const GEAR_RADIUS = 13, GEAR_CENTRE_Y = TOWER.gearY - GEAR_RADIUS; // its lowest tooth is where the antennas turn it
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const audio = createAudio();
const readPref = key => { try { return localStorage.getItem(key); } catch { return null; } };
let language = chooseLanguage(location.href, readPref('hoppod.pref.lang'), navigator.language);
const tr = () => TEXT[language];

let state = 'idle'; // idle | ready | run | done
let save = FIRST_SAVE;
let run = newAttempt(COURSE, save);
let clock = 0, readyLeft = 0, appliedFast = false, edges = [], doneAt = -1, lastPaint = null, worldTime = 0;
let trail = [], ghost = [], plan = null;
let fails = 0, particles = [], landAge = 10, deathAge = 0, banner = '', bellAge = -1, gearAges = [], missAges = [], floats = [], struckY = 0, best = null;
let lastInput = 'none';
let toneContext = null;
const pressedKeys = new Set(), pressedPointers = new Set();
const log = [];

const held = () => pressedKeys.size + pressedPointers.size > 0;
const currentFast = () => state === 'run' && (plan ? planIsFast(run, plan) : appliedFast);
const say = message => { $('outcome').textContent = message; };
const gearCount = () => run.gears.filter(Boolean).length;
// The tower is still until pressed; once moving, the beat runs on from the run-up.
const towerTime = () => state === 'ready' ? run.time - readyLeft : state === 'idle' ? run.time - PERIOD : run.time;

function unlock() {
  audio.unlock();
  try {
    toneContext ||= new (globalThis.AudioContext || globalThis.webkitAudioContext)();
    if (toneContext.state === 'suspended') toneContext.resume().catch(() => {});
  } catch { /* The visual result never depends on sound. */ }
}
function tones(partials) {
  if (audio.muted || toneContext?.state !== 'running') return;
  const t = toneContext.currentTime;
  for (const [delay, frequency, peak, decay, type] of partials) {
    const o = toneContext.createOscillator(), g = toneContext.createGain(), at = t + delay;
    o.type = type; o.frequency.setValueAtTime(frequency, at);
    g.gain.setValueAtTime(.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + .006);
    g.gain.exponentialRampToValueAtTime(.0001, at + decay);
    o.connect(g); g.connect(toneContext.destination);
    o.start(at); o.stop(at + decay + .05);
  }
}
const SOUND = {
  tick: [[0, 1760, .03, .05, 'square']],
  gear: [[0, 880, .09, .2, 'triangle'], [.07, 1319, .09, .3, 'triangle']],
  gearMissed: [[0, 620, .05, .06, 'square'], [.05, 470, .04, .07, 'square']],
  bump: [[0, 150, .16, .22, 'triangle'], [0, 90, .1, .3, 'sine']],
  // A big struck bell: the hum, the prime, two inharmonic partials and the strike itself.
  bell: [[0, 110, .1, 4, 'sine'], [0, 220, .14, 3.2, 'sine'], [0, 223, .07, 3.2, 'sine'], [0, 264, .07, 2, 'sine'], [0, 550, .04, 1, 'sine'], [0, 1320, .05, .12, 'triangle']],
  full: [[.35, 659, .08, 1, 'triangle'], [.5, 784, .08, 1, 'triangle'], [.65, 988, .08, 1.3, 'triangle']]
};

function burst(x, y, count, colours, spread = 24) {
  if (reducedMotion.matches) return;
  for (let i = 0; i < count; i++) {
    particles.push({ x, y, vx: (i - (count - 1) / 2) * spread, vy: -30 - (i % 3) * 24, age: 0, color: colours[i % colours.length], gravity: 180 });
  }
}
function resetField() {
  run = newAttempt(COURSE, plan ? FIRST_SAVE : save);
  if (trail.length > 1) ghost = trail;
  trail = [{ x: run.x, y: feetY(0) }];
  edges = []; banner = ''; deathAge = 0; bellAge = -1; floats = [];
  gearAges = COURSE.gears.map(() => -1);
  missAges = COURSE.gears.map(() => -1);
}
function toIdle(message = tr().idle) {
  state = 'idle'; plan = null;
  resetField();
  say(message);
  refresh();
}
function startReady(now, demoPlan = null) {
  plan = demoPlan;
  resetField();
  appliedFast = held();
  clock = now; readyLeft = PERIOD; state = 'ready';
  say(demoPlan ? tr().demoing : tr().ready);
  refresh();
}
function launch() {
  state = 'run';
  appliedFast = held();
  landAge = 0;
  audio.play('land', 0);
  say(plan ? tr().demoing : '');
}
function advanceTo(t) {
  let dt = t - clock;
  if (dt <= 0) return;
  clock = t;
  if (state === 'ready') {
    const used = Math.min(dt, readyLeft);
    readyLeft -= used; dt -= used;
    if (readyLeft > 1e-9) return;
    launch();
  }
  if (state !== 'run' || dt <= 0) return;
  const events = plan ? advanceWithPlan(run, dt, plan) : advanceAttempt(run, dt, appliedFast);
  trail.push({ x: run.x, y: feetY(run.phase) });
  handle(events);
}
// Input edges carry their own timestamps, so a press lands at the moment it
// happened and not at the next rendered frame.
function pump(now) {
  if (now - clock > .25) { toIdle(tr().stall); return; }
  while (edges.length && edges[0].t <= now && state !== 'done') {
    const edge = edges.shift();
    advanceTo(edge.t);
    appliedFast = edge.fast;
  }
  if (state !== 'done') advanceTo(now);
}
function handle(events) {
  for (const event of events) {
    if (event.type === 'gear') {
      gearAges[event.gear] = 0;
      tones(SOUND.gear);
      burst(COURSE.gears[event.gear].x, GEAR_CENTRE_Y, 14, ['#ffe9a8', '#ffc38e'], 30);
      floats.push({ x: COURSE.gears[event.gear].x, y: GEAR_CENTRE_Y - 24, text: `${gearCount()}/${GEAR_COUNT}`, colour: '#ffe9a8', age: 0 });
      if (!plan) say(tr().gear(gearCount()));
    }
    if (event.type === 'gearMissed') {
      missAges[event.gear] = 0;
      tones(SOUND.gearMissed);
      floats.push({ x: COURSE.gears[event.gear].x, y: GEAR_CENTRE_Y + 26, text: tr().gearMissedShort, colour: '#d8a84e', age: 0 });
      if (!plan) say(tr().gearMissed);
    }
    if (event.type === 'land') {
      landAge = 0;
      tones(SOUND.tick);
      audio.play('land', event.hops);
      burst(event.x, FLOOR - 5, 8, ['#efdaad', '#ffc38e'], 17);
    }
    if (event.type === 'checkpoint' && !plan) say(tr().saved);
    if (event.type === 'hit') { tones(SOUND.bump); deathAge = .001; burst(event.x, feetY(run.phase) - 30, 10, ['#ffb17b', '#fff0d0'], 30); }
    if (event.type === 'fall') { audio.play('fall'); deathAge = .001; }
    if (event.type === 'ring') {
      bellAge = 0;
      struckY = feetY(run.phase);
      burst(event.x, TOWER.bellBottomY, 18, ['#fff0d0', '#ffd27a', '#ffc38e'], 26);
      tones(SOUND.bell);
      if (run.gears.every(Boolean)) tones(SOUND.full);
    }
  }
  if (run.status !== 'playing') finish();
}
function finish() {
  const verdict = judge(run), text = tr();
  state = 'done'; doneAt = clock;
  log.push({
    demo: Boolean(plan), input: lastInput, ok: verdict.ok, reason: verdict.reason, tier: verdict.tier,
    x: +run.x.toFixed(2), hops: run.hops, room: run.save.checkpoint + 1, hitBy: run.hitBy,
    gears: gearCount(), time: +run.time.toFixed(3), fast: +run.fastSeconds.toFixed(3),
    segments: run.segments.map(s => [s.hop, +s.from.toFixed(3), +s.to.toFixed(3)])
  });
  $('log').value = JSON.stringify(log);
  banner = verdict.tier === 'full' ? text.bannerFull : verdict.ok ? text.bannerClear
    : verdict.reason === 'hit' ? text.bannerHit : text.bannerFall;
  if (plan) { say(text.demoDone); plan = null; refresh(); return; }
  if (verdict.ok) {
    fails = 0; save = FIRST_SAVE;
    if (best !== 'full') best = verdict.tier;
    say(verdict.tier === 'full' ? text.full : text.clear(gearCount()));
  } else {
    save = run.save;
    fails += 1;
    const why = verdict.reason === 'hit' ? text.hit : text[verdict.reason];
    say(fails >= 3 ? why + ' / ' + text.hint : why);
  }
  refresh();
}

function press(event, source) {
  unlock();
  lastInput = source;
  const now = event.timeStamp / 1000;
  if (state === 'done' && now - doneAt < .18) return;
  if (state === 'idle' || state === 'done' || plan) { startReady(now); return; }
  if (state === 'run') audio.play('fast');
  edges.push({ t: now, fast: true });
}
function release(event) {
  if ((state !== 'run' && state !== 'ready') || plan) return;
  if (!held()) {
    if (state === 'run') audio.play('slow');
    edges.push({ t: event.timeStamp / 1000, fast: false });
  }
}
function clearInput() { pressedKeys.clear(); pressedPointers.clear(); }
function abortForFocusLoss() {
  clearInput();
  if (state === 'run' || state === 'ready') toIdle();
  refresh();
}

function refresh() {
  const text = tr();
  document.documentElement.lang = language;
  $('title').textContent = text.title;
  $('goal').textContent = text.goal;
  const hold = $('hold');
  hold.classList.toggle('active', held());
  hold.textContent = state === 'run' || state === 'ready' ? (held() ? text.fast : text.slow)
    : state === 'done' ? (run.status === 'rang' && !plan ? text.next : text.again) : text.start;
  document.body.dataset.state = state;
  $('gears-state').textContent = `${gearCount()}/${GEAR_COUNT}`;
  $('room-state').textContent = `${run.save.checkpoint + 1}/${COURSE.checkpoints.length}`;
  $('best-state').textContent = best === 'full' ? '★★' : best ? '★' : '—';
  $('demo-clear').textContent = text.demoClear;
  $('demo-full').textContent = text.demoFull;
  $('retry').textContent = text.retry;
  $('restart').textContent = text.restart;
  $('sound').textContent = text.sound[audio.muted ? 1 : 0];
  $('language').textContent = text.language;
  $('label-gears').textContent = text.labelGears;
  $('label-room').textContent = text.labelRoom;
  $('label-best').textContent = text.labelBest;
  $('notes-title').textContent = text.notesTitle;
  $('notes').textContent = text.notes;
  $('copy').textContent = text.copy;
}

function paintTower(offset, time) {
  const far = offset * .35;
  ctx.fillStyle = '#17121f'; ctx.fillRect(0, 0, W, H);
  // Brick courses
  ctx.fillStyle = '#1f1828';
  for (let row = 0; row < 12; row++) {
    const y = row * 34, shift = row % 2 ? 40 : 0;
    for (let i = -1; i < 7; i++) {
      const x = ((i * 80 + shift - far) % 480 + 480) % 480 - 60;
      ctx.fillRect(x, y, 74, 30);
    }
  }
  // The great clock face, turning with the beat
  const faceX = 560 - far, faceY = 150, radius = 118;
  if (faceX > -radius && faceX < W + radius) {
    ctx.fillStyle = '#2c2433'; ctx.beginPath(); ctx.arc(faceX, faceY, radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#5c4c58'; ctx.lineWidth = 4; ctx.stroke();
    ctx.fillStyle = '#7c6a6c';
    for (let hour = 0; hour < 12; hour++) {
      const a = hour * Math.PI / 6;
      ctx.fillRect(faceX + Math.sin(a) * (radius - 14) - 2, faceY - Math.cos(a) * (radius - 14) - 2, 5, 5);
    }
    const hand = (angle, length, width, colour) => {
      ctx.strokeStyle = colour; ctx.lineWidth = width;
      ctx.beginPath(); ctx.moveTo(faceX, faceY);
      ctx.lineTo(faceX + Math.sin(angle) * length, faceY - Math.cos(angle) * length); ctx.stroke();
    };
    const beat = state === 'idle' ? 0 : Math.floor(Math.max(0, time) / PERIOD);
    hand(beat * Math.PI / 6, radius - 26, 3, '#a58f80');
    hand((gearCount() + 9) * Math.PI / 6, radius - 58, 5, gearCount() ? '#ffd27a' : '#a58f80');
    ctx.fillStyle = '#ffd27a'; ctx.fillRect(faceX - 3, faceY - 3, 7, 7);
  }
}
function paintPlatforms(screen) {
  ctx.fillStyle = '#07050b'; ctx.fillRect(0, FLOOR, W, H - FLOOR);
  COURSE.platforms.forEach((platform, index) => {
    const [left, right] = footing(platform);
    const l = screen(left), r = screen(right);
    if (r + INSET < 0 || l - INSET > W) return;
    ctx.fillStyle = '#463a44'; ctx.fillRect(l, FLOOR, r - l, H - FLOOR);
    for (let k = 0; k < INSET / 2; k++) {
      const drop = 3 + k * 3;
      ctx.fillStyle = '#3a2e3a'; ctx.fillRect(l - 2 - k * 2, FLOOR + drop, 2, H); ctx.fillRect(r + k * 2, FLOOR + drop, 2, H);
    }
    const saves = COURSE.checkpoints.some(c => c.platform === index && index > 0);
    ctx.fillStyle = saves ? '#ffd27a' : '#b7a693'; ctx.fillRect(l, FLOOR, r - l, 6);
    ctx.fillStyle = '#7d6a66'; ctx.fillRect(l, FLOOR + 6, r - l, 8);
  });
}
function paintGear(cx, cy, radius, angle, lit, small = false) {
  ctx.fillStyle = lit ? '#ffe9a8' : small ? '#6f5a38' : '#d8a84e';
  for (let i = 0; i < 8; i++) {
    const a = angle + i * Math.PI / 4;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
    ctx.fillRect(-radius * .2, -radius - 3, radius * .4 + 1, 6);
    ctx.restore();
  }
  ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#17121f'; ctx.beginPath(); ctx.arc(cx, cy, radius * .36, 0, Math.PI * 2); ctx.fill();
}
function paintGears(screen, time) {
  const beat = Math.max(0, time) / PERIOD, still = reducedMotion.matches;
  COURSE.gears.forEach((gear, index) => {
    const x = screen(gear.x);
    if (x < -40 || x > W + 40) return;
    const lit = run.gears[index], age = gearAges[index] ?? -1, missed = missAges[index] ?? -1;
    const pulse = age >= 0 && age < .35 ? 1 + (.35 - age) : 1;
    // Waiting gears tick on the beat and call out with a ring. Turned ones spin freely.
    const tick = Math.floor(beat) + Math.min(1, (beat % 1) * 5);
    const angle = still ? 0 : lit ? worldTime * 5 : tick * Math.PI / 8;
    const shake = !still && missed >= 0 && missed < .4 ? Math.sin(missed * 50) * 4 * (1 - missed / .4) : 0;
    ctx.strokeStyle = lit ? '#ffe9a8' : '#a58a56'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + shake, GEAR_CENTRE_Y - GEAR_RADIUS); ctx.stroke();
    if (!lit) {
      const call = still ? .35 : beat % 1;
      ctx.strokeStyle = '#ffd27a'; ctx.lineWidth = 2; ctx.globalAlpha = (1 - call) * .7;
      ctx.beginPath(); ctx.arc(x + shake, GEAR_CENTRE_Y, GEAR_RADIUS + 5 + call * 14, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = '#ffd27a'; ctx.globalAlpha = .22;
      ctx.beginPath(); ctx.arc(x, GEAR_CENTRE_Y, GEAR_RADIUS + 11, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    paintGear(x + shake, GEAR_CENTRE_Y, GEAR_RADIUS * pulse, angle, lit);
  });
}
function paintFloats(screen) {
  ctx.font = 'bold 15px monospace'; ctx.textAlign = 'center';
  for (const item of floats) {
    ctx.globalAlpha = Math.max(0, 1 - item.age / .9);
    ctx.fillStyle = '#120f1c'; ctx.fillText(item.text, screen(item.x) + 1, item.y - item.age * 22 + 1);
    ctx.fillStyle = item.colour; ctx.fillText(item.text, screen(item.x), item.y - item.age * 22);
  }
  ctx.globalAlpha = 1; ctx.textAlign = 'left';
}
function paintPendulums(screen, time) {
  for (const pendulum of COURSE.pendulums) {
    const pivot = screen(pendulum.x);
    const reach = pendulum.length * Math.sin(pendulum.amp);
    if (pivot + reach < -30 || pivot - reach > W + 30) continue;
    // The arc it sweeps, so where it can be is readable before it gets there.
    ctx.strokeStyle = '#3e3340'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(pivot, TOWER.pivotY, pendulum.length, Math.PI / 2 - pendulum.amp, Math.PI / 2 + pendulum.amp);
    ctx.stroke();
    const bob = bobAt(pendulum, time), x = bob.x - (pendulum.x - pivot);
    ctx.strokeStyle = '#a58a56'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(pivot, TOWER.pivotY); ctx.lineTo(x, bob.y); ctx.stroke();
    ctx.fillStyle = '#c0683f'; ctx.beginPath(); ctx.arc(x, bob.y, TOWER.bobDrawn, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffb17b'; ctx.beginPath(); ctx.arc(x - 4, bob.y - 4, 5, 0, Math.PI * 2); ctx.fill();
  }
}
function paintBell(screen) {
  const bellX = screen(COURSE.bell.x);
  if (bellX < -110 || bellX > W + 110) return;
  const ringing = bellAge >= 0, moving = ringing && !reducedMotion.matches;
  const swing = moving ? Math.sin(bellAge * 7) * 7 * Math.exp(-bellAge * .9) : 0;
  const mouth = TOWER.bellBottomY, half = TOWER.bellHalfWidth;
  // A window behind the bell, with the moon in it
  ctx.fillStyle = '#23304a'; ctx.beginPath(); ctx.arc(bellX + 92, 92, 48, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ead6a4'; ctx.beginPath(); ctx.arc(bellX + 106, 78, 16, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.translate(bellX, 0); ctx.rotate(swing * Math.PI / 180);
  ctx.fillStyle = '#7d6a66'; ctx.fillRect(-3, 0, 7, 96);
  // The body, its lip and a highlight. The clapper stays inside the mouth.
  ctx.fillStyle = ringing ? '#ffd27a' : '#c79a4e';
  ctx.beginPath();
  ctx.moveTo(-22, 96); ctx.quadraticCurveTo(0, 82, 22, 96);
  ctx.quadraticCurveTo(28, mouth - 44, half, mouth - 8); ctx.lineTo(half, mouth);
  ctx.lineTo(-half, mouth); ctx.lineTo(-half, mouth - 8);
  ctx.quadraticCurveTo(-28, mouth - 44, -22, 96); ctx.closePath(); ctx.fill();
  ctx.fillStyle = ringing ? '#fff0d0' : '#8d6c36'; ctx.fillRect(-half, mouth - 10, half * 2, 3);
  ctx.fillStyle = ringing ? '#fff8e4' : '#e2bd77'; ctx.fillRect(-13, 112, 5, mouth - 138);
  ctx.fillStyle = '#5c4636'; ctx.beginPath(); ctx.arc(moving ? Math.sin(bellAge * 7 + 1) * 16 * Math.exp(-bellAge * .9) : 0, mouth - 6, 7, Math.PI, 0); ctx.fill();
  ctx.restore();
  if (ringing && bellAge < 2 && !reducedMotion.matches) {
    ctx.strokeStyle = '#fff0d0'; ctx.lineWidth = 3; ctx.globalAlpha = Math.max(0, 1 - bellAge / 2);
    for (let ring = 0; ring < 3; ring++) {
      ctx.beginPath(); ctx.arc(bellX, 190, 60 + bellAge * 150 + ring * 34, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}
function paintTrail(points, screen, colour, width, alpha) {
  if (points.length < 2) return;
  ctx.strokeStyle = colour; ctx.lineWidth = width; ctx.globalAlpha = alpha;
  ctx.beginPath();
  points.forEach((p, i) => (i ? ctx.lineTo(screen(p.x), p.y - 26) : ctx.moveTo(screen(p.x), p.y - 26)));
  ctx.stroke(); ctx.globalAlpha = 1;
}
function paintHud() {
  const size = 22, gap = 10, start = (W - GEAR_COUNT * size - (GEAR_COUNT - 1) * gap) / 2;
  COURSE.gears.forEach((_, i) => {
    const age = gearAges[i] ?? -1, missed = missAges[i] ?? -1;
    const grow = age >= 0 && age < .35 ? 1 + (.35 - age) * 1.5 : missed >= 0 && missed < .35 ? 1 + (.35 - missed) * .6 : 1;
    paintGear(start + i * (size + gap) + size / 2, 22, 7 * grow, 0, run.gears[i], !run.gears[i]);
  });
}
// The current hop only: the band is when the antennas can reach a gear.
function paintTimeline() {
  const left = 40, width = W - 56, y = 462;
  const px = t => left + width * t / PERIOD;
  ctx.fillStyle = '#15101c'; ctx.fillRect(left, y, width, 12);
  ctx.fillStyle = '#6a5326'; ctx.fillRect(px(CONTACT_WINDOW[0]), y, px(CONTACT_WINDOW[1]) - px(CONTACT_WINDOW[0]), 12);
  ctx.fillStyle = '#ffc38e';
  for (const s of run.segments) if (s.hop === run.hops) ctx.fillRect(px(s.from), y + 3, Math.max(1, px(s.to) - px(s.from)), 6);
  if (state === 'run') { ctx.fillStyle = '#fff0d0'; ctx.fillRect(px(run.phase), y - 2, 2, 16); }
  ctx.fillStyle = '#bbb0a5'; ctx.font = '10px monospace'; ctx.textAlign = 'right';
  ctx.fillText(tr().now, left - 5, y + 10);
  ctx.textAlign = 'left';
  ctx.fillText('▮ ' + tr().high, left, y + 28);
}
function paint(now) {
  const offset = run.x - HERO_X, time = towerTime();
  const screen = x => Math.round(x - offset);
  // The strike is felt in the whole picture for an instant.
  const shaking = bellAge >= 0 && bellAge < .3 && !reducedMotion.matches;
  ctx.save();
  if (shaking) ctx.translate(Math.sin(bellAge * 70) * 4 * (1 - bellAge / .3), Math.cos(bellAge * 55) * 3 * (1 - bellAge / .3));
  paintTower(offset, time);
  paintBell(screen);
  paintPlatforms(screen);
  paintGears(screen, time);
  paintPendulums(screen, time);
  paintTrail(ghost, screen, '#bbb0a5', 1, .5);
  paintTrail(trail, screen, '#fff0d0', 2, .85);
  for (const p of particles) {
    ctx.fillStyle = p.color; ctx.globalAlpha = Math.max(0, 1 - p.age / .45);
    ctx.fillRect(screen(p.x) + p.vx * p.age, p.y + p.vy * p.age + p.gravity * p.age ** 2, 3, 3);
  }
  ctx.globalAlpha = 1;
  // After a hit the pod drops from where it was; after the strike it falls back to the floor.
  const phase = state === 'ready' ? PERIOD - readyLeft : state === 'run' || (state === 'done' && run.status === 'hit') ? run.phase : 0;
  const fast = currentFast();
  const heroY = bellAge >= 0 ? Math.min(feetY(0), struckY + bellAge * bellAge * 700)
    : feetY(phase) + (deathAge ? Math.min(110, deathAge * deathAge * 160) : 0);
  if (fast && !reducedMotion.matches) {
    ctx.fillStyle = '#ffb17b';
    for (let i = 0; i < 3; i++) ctx.fillRect(HERO_X - 28 - i * 10, heroY - 20 + i * 7, 5 + i * 2, 2);
  }
  drawPod(ctx, HERO_X, heroY, 2, {
    phase: phase / PERIOD, fast, land: Math.max(0, 1 - landAge / .13),
    dead: deathAge, time: now, idle: state === 'idle'
  });
  paintFloats(screen);
  ctx.restore();
  if (bellAge >= 0 && bellAge < .22 && !reducedMotion.matches) {
    ctx.fillStyle = '#fff0d0'; ctx.globalAlpha = (.22 - bellAge) * 1.8; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
  }
  paintHud();
  paintTimeline();
  if (banner) {
    const rang = run.status === 'rang';
    ctx.fillStyle = 'rgba(18,15,28,.78)'; ctx.fillRect(0, 42, W, rang ? 66 : 44);
    ctx.fillStyle = '#fff0d0'; ctx.font = 'bold 24px monospace'; ctx.textAlign = 'center';
    ctx.fillText(banner, W / 2, 73);
    if (rang) { ctx.fillStyle = '#ffd27a'; ctx.font = 'bold 14px monospace'; ctx.fillText(tr().bannerGears(gearCount()), W / 2, 96); }
    ctx.textAlign = 'left';
  }
}

function frame(ms) {
  const now = ms / 1000;
  const dt = lastPaint === null ? 0 : Math.min(.05, now - lastPaint);
  lastPaint = now; worldTime += dt;
  if (state === 'ready' || state === 'run') pump(now);
  landAge += dt;
  if (deathAge) deathAge += dt;
  if (bellAge >= 0) bellAge += dt;
  gearAges = gearAges.map(age => age >= 0 ? age + dt : age);
  missAges = missAges.map(age => age >= 0 ? age + dt : age);
  floats.forEach(item => { item.age += dt; });
  floats = floats.filter(item => item.age < .9);
  particles.forEach(p => { p.age += dt; });
  particles = particles.filter(p => p.age < .45);
  refresh();
  paint(worldTime);
  requestAnimationFrame(frame);
}

for (const target of [canvas, $('hold')]) {
  target.addEventListener('contextmenu', e => e.preventDefault());
  target.addEventListener('pointerdown', e => {
    if (e.button > 0) return;
    e.preventDefault();
    pressedPointers.add(e.pointerId);
    try { target.setPointerCapture(e.pointerId); } catch { /* still released by window */ }
    press(e, e.pointerType || 'pointer');
  });
}
const pointerUp = e => {
  if (!pressedPointers.delete(e.pointerId)) return;
  release(e);
};
for (const name of ['pointerup', 'pointercancel']) window.addEventListener(name, pointerUp);
$('hold').addEventListener('lostpointercapture', pointerUp);
canvas.addEventListener('lostpointercapture', pointerUp);
window.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.code === 'KeyR' && !e.repeat) { toIdle(); return; }
  if (e.code !== 'Space') return;
  const active = document.activeElement;
  if (active?.tagName === 'BUTTON' && active !== $('hold')) return;
  if (active?.tagName === 'TEXTAREA') return;
  e.preventDefault();
  if (e.repeat || pressedKeys.has('Space')) return;
  pressedKeys.add('Space');
  press(e, 'keyboard');
});
window.addEventListener('keyup', e => {
  if (e.code !== 'Space' || !pressedKeys.delete('Space')) return;
  release(e);
});
for (const [id, demo] of [['demo-clear', COURSE.demos.clear], ['demo-full', COURSE.demos.full]]) {
  $(id).addEventListener('click', e => {
    e.currentTarget.blur();
    unlock();
    clearInput();
    ghost = []; trail = [];
    startReady(e.timeStamp / 1000, demo);
  });
}
$('retry').addEventListener('click', e => { e.currentTarget.blur(); toIdle(); });
$('restart').addEventListener('click', e => {
  e.currentTarget.blur();
  save = FIRST_SAVE; fails = 0; ghost = []; trail = [];
  toIdle();
});
$('sound').addEventListener('click', e => {
  e.currentTarget.blur();
  unlock(); audio.toggle(); refresh();
});
$('language').addEventListener('click', e => {
  e.currentTarget.blur();
  language = language === 'ja' ? 'en' : 'ja';
  if (state === 'idle') say(tr().idle);
  refresh();
});
$('copy').addEventListener('click', async () => {
  const area = $('log');
  try { await navigator.clipboard.writeText(area.value); say(tr().copied); }
  catch { area.select(); say(tr().copyFailed); }
});
window.addEventListener('blur', abortForFocusLoss);
window.addEventListener('pagehide', abortForFocusLoss);
document.addEventListener('visibilitychange', () => { if (document.hidden) abortForFocusLoss(); });

toIdle();
requestAnimationFrame(frame);
