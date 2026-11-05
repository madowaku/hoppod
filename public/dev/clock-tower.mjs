import { PERIOD, INSET, footing } from '../src/engine.mjs';
import { drawPod } from '../src/pod.mjs';
import { createAudio } from '../src/audio.mjs';
import { chooseLanguage } from '../src/ui-copy.mjs';
import { LAB, CONTACT_WINDOW, feetY } from './string-trajectory.mjs';
import {
  COURSE, TOWER, FIRST_SAVE, newAttempt, advanceAttempt, advanceWithPlan, planIsFast, judge, bobAt, palletSpan, revival,
  WHEEL, wheelScreenX, heartPose, fullReach
} from './clock-tower-model.mjs';

const GEAR_COUNT = COURSE.gears.length, PALLET_COUNT = COURSE.pallets.length;
const MEMORY_KEY = 'hoppod.lab.clockTower.revived';
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
    chamber: '脱進機の間。金の板に着地すると大歯車が進む。長短で跳び分けよう',
    chamberRescue: '脱進機の間。金の板を3つ踏むと大歯車が回り切り、逃した歯車を1つ起こせる',
    stepHere: 'ここに着地', heartCause: 'ラピッポが跳ねるたび、針が進む',
    fullLost: '今回はもう★★に届かない。このまま鐘へ進もう（★★は「最初から」で）',
    resumeLost: '★★を狙うなら「最初から」へ', idleLost: '踊り場から再開します。★はここから届きます。★★を狙うなら「最初から」へ',
    idleRescue: '踊り場から再開します。逃した歯車1つは、脱進機で起こせます', restartFull: '最初から（★★も狙える）',
    tooth: n => `カチッ！ 大歯車 ${n}/${PALLET_COUNT}`, tick: 'カチッ', longer: '→ もっと長く', shorter: '← もっと短く',
    palletMissed: { longer: '金の板の手前。もう少し長く押そう', shorter: '金の板を越えた。もう少し短く押そう' },
    wheelWoke: '大歯車が回り切った！ 眠っていた歯車が目覚めた', wheelFull: '大歯車が回り切った！ 動力が塔じゅうに伝わった', woke: '目覚めた！',
    alive: 'もう押さなくても、時計は動き続ける', caption: '時計が動き出した', captionInside: '塔の中まで、全部目覚めた',
    remembered: 'この塔の時計は、ラピッポの拍で動き続けている。押すともう一度登れます。',
    labelWheel: '大歯車',
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
    chamber: 'The escapement. Land on a gold pallet to advance the great wheel. Mix long and short flights',
    chamberRescue: 'The escapement. Three gold pallets bring the great wheel round and wake one gear you missed',
    stepHere: 'LAND HERE', heartCause: 'Every hop moves the hands',
    fullLost: 'No ★★ this time. Carry on to the bell (★★ is open from the start)',
    resumeLost: 'For ★★, go back to the start', idleLost: 'Resuming from the landing. ★ is in reach from here. For ★★, go back to the start',
    idleRescue: 'Resuming from the landing. The escapement can still wake the gear you missed', restartFull: 'FROM THE START (★★ OPEN)',
    tooth: n => `Tick! Great wheel ${n}/${PALLET_COUNT}`, tick: 'TICK', longer: '→ LONGER', shorter: '← SHORTER',
    palletMissed: { longer: 'Short of the pallet. Hold a little longer', shorter: 'Past the pallet. Hold a little less' },
    wheelWoke: 'The great wheel came round! A sleeping gear woke', wheelFull: 'The great wheel came round! Power runs through the tower', woke: 'AWAKE!',
    alive: 'Stop pressing: the clock keeps going', caption: 'The clock is running', captionInside: 'Awake, all the way inside',
    remembered: 'This tower\'s clock is still running on your beat. Press to climb again.',
    labelWheel: 'WHEEL',
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
const canvas = $('scene');
let ctx = canvas.getContext('2d');
const heartCanvas = Object.assign(document.createElement('canvas'), { width: 360, height: 510 }), heartCtx = heartCanvas.getContext('2d');
const W = 360, H = 510, FLOOR = LAB.floorY, HERO_X = 80;
const GEAR_RADIUS = 13, GEAR_CENTRE_Y = TOWER.gearY - GEAR_RADIUS; // its lowest tooth is where the antennas turn it
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const audio = createAudio();
const readPref = key => { try { return localStorage.getItem(key); } catch { return null; } };
const params = new URL(location.href).searchParams;
const fresh = params.has('fresh'); // play as if for the first time
// ?room=4&gears=1,2 starts in a room holding those gears, to test one moment quickly.
function openingSave() {
  const checkpoint = Number(params.get('room')) - 1;
  if (!(checkpoint >= 1 && COURSE.checkpoints[checkpoint])) return FIRST_SAVE;
  const collected = (params.get('gears') ?? '').split(',').filter(Boolean).map(gear => Number(gear) - 1).filter(gear => COURSE.gears[gear]);
  return { checkpoint, time: COURSE.checkpoints[checkpoint].platform * PERIOD, collected };
}
let language = chooseLanguage(location.href, readPref('hoppod.pref.lang'), navigator.language);
const tr = () => TEXT[language];

let state = 'idle'; // idle | ready | run | done
let save = openingSave();
let run = newAttempt(COURSE, save);
let clock = 0, readyLeft = 0, appliedFast = false, edges = [], doneAt = -1, lastPaint = null, worldTime = 0;
let trail = [], ghost = [], plan = null;
let fails = 0, particles = [], landAge = 10, deathAge = 0, banner = '', bellAge = -1, gearAges = [], missAges = [], floats = [], struckY = 0, best = null;
let lastInput = 'none';
let revivedBefore = !fresh && readPref(MEMORY_KEY) === '1';
let fallTime = 0, lastBeat = -1, toothAge = 10, toothPallet = 0, wakeAge = 10, wakeGear = 0, reachSeen = 'open', palletAges = [], revived = null;
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
  tooth: n => [[0, 1760, .05, .05, 'square'], [0, 165, .16, .25, 'triangle'], [.04, 440 * 2 ** (n * 3 / 12), .07, .3, 'triangle']],
  driven: [[0, 110, .14, 1, 'triangle'], [.12, 330, .07, .6, 'triangle'], [.24, 440, .07, .6, 'triangle'], [.36, 660, .07, 1, 'triangle']],
  full: [[.35, 659, .08, 1, 'triangle'], [.5, 784, .08, 1, 'triangle'], [.65, 988, .08, 1.3, 'triangle']]
};

// What plays once the tower runs on the pod's beat: a tick for ever, and a loop of
// layers that build and then leave the tick alone, so it does not wear on an open tab.
const CHORDS = [[110, 440, 523, 659], [110, 440, 523, 659], [87.3, 349, 440, 523], [87.3, 349, 440, 523], [98, 392, 494, 587], [98, 392, 494, 587], [110, 440, 523, 659], [123.5, 415, 494, 659]];
function beatSound(beat, parts) {
  tones([[0, beat % 2 ? 1320 : 1760, .035, .05, 'square'], [0, 70, .12, .16, 'sine']]);
  const fade = Math.max(0, 1 - Math.max(0, beat - 24) / 8);
  if (fade <= 0 || beat < 1) return;
  const [root, a, b, c] = CHORDS[beat % CHORDS.length], half = PERIOD / 2;
  const layer = [[0, root, .1 * fade, .7, 'sine']];
  if (beat >= 3) layer.push([0, a, .035 * fade, .4, 'triangle'], [half, b, .035 * fade, .4, 'triangle']);
  if (beat >= 5) layer.push([0, c, .03 * fade, .7, 'sine'], [half, c * 2, .012 * fade, .4, 'sine']);
  if (beat >= 5 && parts.wheel) layer.push([half / 2, b * 2, .014 * fade, .25, 'triangle'], [half * 1.5, a * 2, .014 * fade, .25, 'triangle']);
  if (beat >= 7 && parts.inside) layer.push([0, c * 2, .03 * fade, 1, 'sine'], [half, b * 2, .025 * fade, .8, 'sine']);
  tones(layer);
}
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
  palletAges = COURSE.pallets.map(() => -1);
  fallTime = 0; lastBeat = -1; toothAge = 10; wakeAge = 10; revived = null; reachSeen = fullReach(run);
  delete document.body.dataset.beat;
}
function idleText() {
  const reach = fullReach(run), text = tr();
  if (save !== FIRST_SAVE && reach === 'lost') return text.idleLost;
  if (save !== FIRST_SAVE && reach === 'needsWheel') return text.idleRescue;
  return revivedBefore ? text.remembered : text.idle;
}
function toIdle(message) {
  state = 'idle'; plan = null;
  resetField();
  say(message ?? idleText());
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
    if (event.type === 'checkpoint' && !plan) {
      const chamber = event.checkpoint === COURSE.checkpoints.length - 1;
      say(!chamber ? tr().saved : fullReach(run) === 'needsWheel' ? tr().chamberRescue : tr().chamber);
    }
    if (event.type === 'tooth') {
      palletAges[event.pallet] = 0; toothAge = 0; toothPallet = event.pallet;
      tones(SOUND.tooth(event.teeth));
      burst(run.x, FLOOR - 4, 12, ['#ffe9a8', '#ffd27a'], 22);
      // Said at the wheel, not at the feet: this is where the eye should go.
      floats.push({ atWheel: true, y: WHEEL.y - 30, size: 24, text: tr().tick, colour: '#fff0d0', age: 0 });
      if (!plan) say(tr().tooth(event.teeth));
    }
    if (event.type === 'palletMissed') {
      tones(SOUND.gearMissed);
      floats.push({ x: run.x, y: FLOOR - 92, text: tr()[event.want], colour: '#d8a84e', age: 0 });
      if (!plan) say(tr().palletMissed[event.want]);
    }
    if (event.type === 'wheelDriven') {
      tones(SOUND.driven);
      if (event.woke !== null) { gearAges[event.woke] = 0; wakeAge = 0; wakeGear = event.woke; }
      floats.push({ x: run.x, y: FLOOR - 112, text: tr().woke, colour: '#fff0d0', age: 0 });
      if (!plan) say(event.woke !== null ? tr().wheelWoke : tr().wheelFull);
    }
    if (event.type === 'hit') { tones(SOUND.bump); deathAge = .001; burst(event.x, feetY(run.phase) - 30, 10, ['#ffb17b', '#fff0d0'], 30); }
    if (event.type === 'fall') { audio.play('fall'); deathAge = .001; }
    if (event.type === 'ring') {
      bellAge = 0;
      struckY = feetY(run.phase);
      fallTime = Math.sqrt(Math.max(0, feetY(0) - struckY) / 700);
      revived = revival(run);
      burst(event.x, TOWER.bellBottomY, 18, ['#fff0d0', '#ffd27a', '#ffc38e'], 26);
      tones(SOUND.bell);
      if (run.gears.every(Boolean)) tones(SOUND.full);
    }
  }
  // Said once, at the moment it happens, and never as a failure: the bell is still ahead.
  const reach = fullReach(run);
  if (reach === 'lost' && reachSeen !== 'lost' && !plan && run.status === 'playing') say(tr().fullLost);
  reachSeen = reach;
  if (run.status !== 'playing') finish();
}
function finish() {
  const verdict = judge(run), text = tr();
  state = 'done'; doneAt = clock;
  log.push({
    demo: Boolean(plan), input: lastInput, ok: verdict.ok, reason: verdict.reason, tier: verdict.tier,
    x: +run.x.toFixed(2), hops: run.hops, room: run.save.checkpoint + 1, hitBy: run.hitBy,
    gears: gearCount(), teeth: run.pallets.filter(Boolean).length, time: +run.time.toFixed(3), fast: +run.fastSeconds.toFixed(3),
    segments: run.segments.map(s => [s.hop, +s.from.toFixed(3), +s.to.toFixed(3)])
  });
  $('log').value = JSON.stringify(log);
  banner = verdict.tier === 'full' ? text.bannerFull : verdict.ok ? text.bannerClear
    : verdict.reason === 'hit' ? text.bannerHit : text.bannerFall;
  if (plan) { say(text.demoDone); plan = null; refresh(); return; }
  if (verdict.ok) {
    fails = 0; save = FIRST_SAVE;
    if (best !== 'full') best = verdict.tier;
    say((verdict.tier === 'full' ? text.full : text.clear(gearCount())) + ' ' + text.alive);
    revivedBefore = true;
    try { if (!fresh) localStorage.setItem(MEMORY_KEY, '1'); } catch { /* it just is not remembered */ }
  } else {
    save = run.save;
    fails += 1;
    const why = verdict.reason === 'hit' ? text.hit : text[verdict.reason];
    const lost = fullReach(newAttempt(COURSE, save)) === 'lost';
    say(fails >= 3 ? why + ' / ' + text.hint : lost ? why + ' / ' + text.resumeLost : why);
  }
  refresh();
}

// The first press sets up audio, which can hold the page for half a second. The run-up
// starts once the page answers: it is not a timed input, and it must not read as a stall.
const answeredAt = event => Math.max(event.timeStamp, performance.now()) / 1000;
function press(event, source) {
  unlock();
  lastInput = source;
  const now = event.timeStamp / 1000;
  // A long guard after the bell: a press still held from the climb must not cut the ending short.
  if (state === 'done' && now - doneAt < (run.status === 'rang' ? 1 : .18)) return;
  if (state === 'idle' || state === 'done' || plan) { startReady(answeredAt(event)); return; }
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
  $('wheel-state').textContent = `${run.pallets.filter(Boolean).length}/${PALLET_COUNT}`;
  $('label-wheel').textContent = text.labelWheel;
  $('room-state').textContent = `${run.save.checkpoint + 1}/${COURSE.checkpoints.length}`;
  $('best-state').textContent = best === 'full' ? '★★' : best ? '★' : '—';
  $('demo-clear').textContent = text.demoClear;
  $('demo-full').textContent = text.demoFull;
  $('retry').textContent = text.retry;
  const suggestStart = !plan && run.status !== 'rang' && fullReach(run) === 'lost';
  $('restart').textContent = suggestStart ? text.restartFull : text.restart;
  $('restart').classList.toggle('suggest', suggestStart);
  document.body.dataset.fullReach = fullReach(run);
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
    const beat = revivedBefore ? Math.floor(worldTime / PERIOD) : state === 'idle' ? 0 : Math.floor(Math.max(0, time) / PERIOD);
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
  const next = nextPallet();
  COURSE.pallets.forEach((_, index) => {
    const [from, to] = palletSpan(COURSE, index), l = screen(from), r = screen(to);
    if (r < -10 || l > W + 10) return;
    const pressed = run.pallets[index], age = palletAges[index] ?? -1;
    const callOut = !pressed && index === next && !reducedMotion.matches ? .5 + .5 * Math.sin(worldTime * 8) : 1;
    const rise = age >= 0 && age < .14 ? 1 : pressed ? 2 : 8;
    // It stands proud of the floor and stays gold, unmistakable from one hop away.
    ctx.fillStyle = pressed ? '#fff0d0' : '#ffc94f'; ctx.globalAlpha = pressed ? 1 : .6 + callOut * .4;
    ctx.fillRect(l, FLOOR - rise, r - l, rise + 3);
    ctx.globalAlpha = 1;
    ctx.fillStyle = pressed ? '#c79a4e' : '#9a6c22'; ctx.fillRect(l, FLOOR + 1, r - l, 2);
    if (index !== next) return;
    // Points at the next one. Before any tooth has moved, it also says what to do.
    const middle = (l + r) / 2, bob = reducedMotion.matches ? 0 : Math.abs(Math.sin(worldTime * 4)) * 8;
    ctx.fillStyle = '#ffd27a';
    ctx.beginPath(); ctx.moveTo(middle - 8, FLOOR - 34 - bob); ctx.lineTo(middle + 8, FLOOR - 34 - bob); ctx.lineTo(middle, FLOOR - 21 - bob); ctx.closePath(); ctx.fill();
    if (!run.pallets.some(Boolean)) {
      ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
      ctx.fillText(tr().stepHere, middle, FLOOR - 42 - bob);
      ctx.textAlign = 'left';
    }
  });
}
function nextPallet() {
  return COURSE.pallets.findIndex((_, index) => !run.pallets[index] && run.x <= palletSpan(COURSE, index)[1]);
}
// The great escape wheel behind the chamber. One tooth per pallet, and a rod that
// carries its power on to the bell and back through the tower.
function backOut(t) { // arrives, overshoots a little and settles: the snap of one tooth
  const c = 3.4, u = t - 1;
  return 1 + (c + 1) * u ** 3 + c * u ** 2;
}
function paintEscapement(screen) {
  const still = reducedMotion.matches;
  const x = wheelScreenX(run.x), teeth = run.pallets.filter(Boolean).length, driven = teeth === PALLET_COUNT;
  const rodY = 16, reach = WHEEL.radius + WHEEL.toothHeight;
  ctx.fillStyle = driven ? '#ffd27a' : '#3a3038';
  ctx.fillRect(screen(1400), rodY, screen(COURSE.bell.x) - screen(1400), 4);
  if (x < -reach - 40 || x > W + reach + 40) return;
  const moved = teeth === 0 ? 0 : still ? teeth : teeth - 1 + backOut(Math.min(1, toothAge / .14));
  const angle = moved * 2 * Math.PI / WHEEL.teeth, lit = teeth > 0, flash = toothAge < .22;
  ctx.strokeStyle = driven ? '#ffd27a' : '#a58a56'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x, rodY); ctx.lineTo(x, WHEEL.y); ctx.stroke();
  ctx.fillStyle = flash ? '#ffe9a8' : driven ? '#c79a4e' : lit ? '#8d6f3a' : '#4a3e4c';
  for (let i = 0; i < WHEEL.teeth; i++) {
    ctx.save(); ctx.translate(x, WHEEL.y); ctx.rotate(angle + i * 2 * Math.PI / WHEEL.teeth);
    ctx.beginPath(); ctx.moveTo(-9, -WHEEL.radius + 4); ctx.lineTo(9, -WHEEL.radius + 4); ctx.lineTo(13, -reach); ctx.lineTo(1, -WHEEL.radius - 11); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.beginPath(); ctx.arc(x, WHEEL.y, WHEEL.radius, 0, Math.PI * 2); ctx.arc(x, WHEEL.y, WHEEL.radius - 16, 0, Math.PI * 2, true); ctx.fill();
  for (let i = 0; i < 5; i++) {
    ctx.save(); ctx.translate(x, WHEEL.y); ctx.rotate(angle + i * 2 * Math.PI / 5);
    ctx.fillRect(-4, -WHEEL.radius + 8, 8, WHEEL.radius - 8);
    ctx.restore();
  }
  ctx.beginPath(); ctx.arc(x, WHEEL.y, 15, 0, Math.PI * 2); ctx.fill();
  // The rocking anchor: it flips with every tooth, tick and tock.
  const side = teeth % 2 ? 1 : -1, rock = side * .16 * (still ? 1 : Math.min(1, toothAge / .08) * 2 - 1 + (teeth ? 0 : 2));
  ctx.save(); ctx.translate(x, WHEEL.y - reach + 13); ctx.rotate(rock);
  ctx.strokeStyle = lit ? '#ffd27a' : '#7d6a66'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(-58, 4); ctx.lineTo(0, -14); ctx.lineTo(58, 4); ctx.stroke();
  ctx.restore();
  // Before a landing, a faint line from the next pallet to the wheel says they are joined.
  const middle = index => { const [a, b] = palletSpan(COURSE, index); return screen((a + b) / 2); };
  const next = nextPallet();
  if (next >= 0 && middle(next) < W + 20) {
    ctx.strokeStyle = '#a58a56'; ctx.lineWidth = 2; ctx.setLineDash([3, 7]);
    ctx.beginPath(); ctx.moveTo(middle(next), FLOOR - 9); ctx.lineTo(x, WHEEL.y); ctx.stroke();
    ctx.setLineDash([]);
  }
  // At a landing the power visibly runs up that line, and the wheel takes it.
  if (toothAge < .45) {
    const from = middle(toothPallet), travel = Math.min(1, toothAge / .1), fade = Math.min(1, (.45 - toothAge) / .25);
    ctx.globalAlpha = fade; ctx.strokeStyle = '#fff0d0'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(from, FLOOR - 4); ctx.lineTo(from + (x - from) * travel, FLOOR - 4 + (WHEEL.y - FLOOR + 4) * travel); ctx.stroke();
    if (travel === 1 && !still) {
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, WHEEL.y, 18 + (toothAge - .1) * 300, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  // One lamp per tooth and the count, so the wheel itself says what just changed.
  for (let i = 0; i < PALLET_COUNT; i++) {
    ctx.fillStyle = i < teeth ? '#ffe9a8' : '#201926';
    ctx.beginPath(); ctx.arc(x + (i - 1) * 15, WHEEL.y, 5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = 'rgba(18,15,28,.72)'; ctx.fillRect(x - 44, WHEEL.y + 24, 88, 18);
  ctx.fillStyle = lit ? '#ffe9a8' : '#c9bfae'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
  ctx.fillText(`${tr().labelWheel} ${teeth}/${PALLET_COUNT}`, x, WHEEL.y + 37);
  ctx.textAlign = 'left';
}
// The train the bell sets going: gears meshing outward from the pod, one pair a beat.
const TRAIN = (() => {
  const links = [], radii = [30, 18, 34, 16, 28, 20, 36, 14, 26, 18];
  const turns = [-.5, -.9, -.2, -1.3, -.4, -1.1, -.15, -.8, -1.5];
  let x = 80, y = 362, spin = 1;
  radii.forEach((radius, i) => {
    links.push({ x, y, radius, spin });
    if (i < turns.length) {
      const reach = radius + radii[i + 1] + 3;
      x += Math.cos(turns[i]) * reach; y += Math.sin(turns[i]) * reach; spin = -spin * radius / radii[i + 1];
    }
  });
  return links;
})();
function paintTrain(beat) {
  if (bellAge < 0) return;
  const still = reducedMotion.matches, count = Math.max(0, Math.floor(beat) + 1) * 2;
  const tick = Math.max(0, Math.floor(beat)) + Math.min(1, ((beat % 1) + 1) % 1 * 5);
  const into = ((beat % 1) + 1) % 1;
  if (beat >= 0 && !still) {
    // Each landing sends a ring out of the pod, and the next gears take it up.
    ctx.strokeStyle = '#ffd27a'; ctx.lineWidth = 3; ctx.globalAlpha = (1 - into) * .8;
    ctx.beginPath(); ctx.arc(HERO_X, FLOOR, 16 + into * 90, Math.PI, 0); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  TRAIN.forEach((gear, index) => {
    const lit = index < count, waking = lit && index >= count - 2 && into < .3;
    ctx.fillStyle = waking ? '#ffe9a8' : lit ? '#b98d46' : '#2a2230';
    for (let i = 0; i < 8; i++) {
      ctx.save(); ctx.translate(gear.x, gear.y); ctx.rotate((still || !lit ? 0 : tick * gear.spin * .4) + i * Math.PI / 4);
      ctx.fillRect(-gear.radius * .18, -gear.radius - 4, gear.radius * .36, 8);
      ctx.restore();
    }
    ctx.beginPath(); ctx.arc(gear.x, gear.y, gear.radius, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#17121f'; ctx.beginPath(); ctx.arc(gear.x, gear.y, gear.radius * .34, 0, Math.PI * 2); ctx.fill();
  });
}
// Five beats after the bell the view pulls back: the whole clock, running, and the
// pod at its centre where the arbor would be. It goes on until the player presses.
const HEART_BEAT = 5;
const STARS = Array.from({ length: 44 }, (_, i) => [(i * 83.7) % 360, (i * 47.3) % 150, 1 + i % 2]);
function paintHeart(beat, parts) {
  const cx = W / 2, cy = 272, radius = 128, still = reducedMotion.matches, inside = parts.inside;
  const pose = heartPose(beat), hub = 48;
  const zoom = (still ? 1 : pose.zoom) * (still ? 1 : 1 + pose.landing * .012);
  ctx.fillStyle = '#0d1630'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff0d0';
  STARS.slice(0, inside ? 44 : 14 + parts.gears * 6).forEach(([x, y, size]) => ctx.fillRect(x, y, size, size));
  ctx.fillStyle = '#ead6a4'; ctx.beginPath(); ctx.arc(312, 66, 22, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#0d1630'; ctx.beginPath(); ctx.arc(321, 59, 19, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.translate(cx, cy); ctx.scale(zoom, zoom); ctx.translate(-cx, -cy);
  ctx.fillStyle = '#231b2e'; ctx.fillRect(24, 104, W - 48, H);
  ctx.beginPath(); ctx.moveTo(10, 106); ctx.lineTo(cx, 30); ctx.lineTo(W - 10, 106); ctx.closePath(); ctx.fill();
  // The beat leaves the pod and crosses the tower.
  if (!still) {
    ctx.strokeStyle = inside ? '#ffd27a' : '#ffb17b'; ctx.lineWidth = 3; ctx.globalAlpha = (1 - pose.into) * .8;
    ctx.beginPath(); ctx.arc(cx, cy, hub + pose.into * 150, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = inside ? '#2f2436' : '#efe0b8';
  ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#d8a84e'; ctx.lineWidth = 6; ctx.stroke();
  // Behind a full result the face is open: the great wheel and every gear turning.
  const turn = still ? 0 : pose.second * 12 * Math.PI / 8;
  if (parts.wheel) {
    ctx.strokeStyle = inside ? '#7d6335' : '#d9c594'; ctx.lineWidth = 8;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-turn * .5);
    ctx.beginPath(); ctx.arc(0, 0, radius - 30, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = inside ? '#7d6335' : '#d9c594';
    for (let i = 0; i < WHEEL.teeth; i++) { ctx.rotate(2 * Math.PI / WHEEL.teeth); ctx.fillRect(-4, -radius + 16, 8, 12); }
    ctx.restore();
  }
  // Inlaid: one gear for each the journey woke. All of them, and the face stands open.
  const places = [[-73, 42, 22], [73, 42, 22], [0, -84, 22]];
  places.forEach(([dx, dy, size], index) => {
    const on = index < parts.gears;
    paintGear(cx + dx, cy + dy, size * (inside ? 1 : .8), on ? (index % 2 ? -turn : turn) : 0, on, !on);
  });
  ctx.fillStyle = inside ? '#ffd27a' : '#5c4636';
  for (let hour = 0; hour < 12; hour++) {
    const a = hour * Math.PI / 6, size = hour % 3 ? 3 : 5;
    ctx.fillRect(cx + Math.sin(a) * (radius - 13) - size / 2, cy - Math.cos(a) * (radius - 13) - size / 2, size, size);
  }
  // It stopped at five to midnight. One minute, and one mark of the second hand, per hop.
  const hand = (angle, length, width, colour, tail = 0) => {
    ctx.strokeStyle = colour; ctx.lineWidth = width;
    ctx.beginPath(); ctx.moveTo(cx - Math.sin(angle) * tail, cy + Math.cos(angle) * tail);
    ctx.lineTo(cx + Math.sin(angle) * length, cy - Math.cos(angle) * length); ctx.stroke();
  };
  const handColour = inside ? '#fff0d0' : '#2a1c18', secondAngle = pose.second * 2 * Math.PI;
  hand((pose.minutes / 720 + 11 / 12) * 2 * Math.PI, radius - 50, 8, handColour);
  hand(pose.minutes / 60 * 2 * Math.PI, radius - 22, 5, handColour);
  // The second hand wears the pod's colour and flares in the instant the pod lands.
  hand(secondAngle, radius - 12, 3 + pose.landing * 3, pose.landing > .1 ? '#ffe2c8' : '#ff8a5c');
  ctx.fillStyle = pose.landing > .1 ? '#ffe2c8' : '#ff8a5c';
  ctx.beginPath(); ctx.arc(cx + Math.sin(secondAngle) * (radius - 13), cy - Math.cos(secondAngle) * (radius - 13), 4 + pose.landing * 5, 0, Math.PI * 2); ctx.fill();
  // The pod is the heart: a lit arbor at the centre, at its full size, on the same 0.78s.
  ctx.fillStyle = inside ? '#4a3524' : '#231b2e';
  ctx.beginPath(); ctx.arc(cx, cy, hub, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#ffb17b'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(cx, cy, hub + (still ? 0 : pose.landing * 5), 0, Math.PI * 2); ctx.stroke();
  drawPod(ctx, cx, cy + 36 - (still ? 0 : pose.lift * 12), 2, { phase: still ? 0 : pose.into, fast: false, land: still ? 0 : Math.max(0, 1 - pose.into * 5), dead: 0, time: worldTime, idle: false });
  ctx.restore();
  // First what is happening, and then what it has become.
  const settled = beat >= 4, title = settled ? (inside ? tr().captionInside : tr().caption) : tr().heartCause;
  ctx.fillStyle = 'rgba(18,15,28,.72)'; ctx.fillRect(0, 418, W, settled ? 54 : 32);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff0d0'; ctx.font = 'bold 16px monospace'; ctx.fillText(title, cx, 440);
  if (settled) { ctx.fillStyle = '#ffb17b'; ctx.font = '12px monospace'; ctx.fillText(tr().heartCause, cx, 461); }
  ctx.textAlign = 'left';
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
  ctx.textAlign = 'center';
  for (const item of floats) {
    const x = item.atWheel ? wheelScreenX(run.x) : screen(item.x);
    ctx.font = `bold ${item.size ?? 15}px monospace`;
    ctx.globalAlpha = Math.max(0, 1 - item.age / .9);
    if (item.atWheel) { // it appears over a flashing wheel, so it brings its own ground
      const width = ctx.measureText(item.text).width + 16, size = item.size ?? 15;
      ctx.fillStyle = '#120f1c'; ctx.fillRect(x - width / 2, item.y - item.age * 22 - size, width, size + 7);
    }
    ctx.fillStyle = '#120f1c'; ctx.fillText(item.text, x + 1, item.y - item.age * 22 + 1);
    ctx.fillStyle = item.colour; ctx.fillText(item.text, x, item.y - item.age * 22);
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
function hudX(index) {
  const size = 22, gap = 10, start = (W - GEAR_COUNT * size - (GEAR_COUNT - 1) * gap) / 2;
  return start + index * (size + gap) + size / 2;
}
function paintHud() {
  const rescuable = fullReach(run) === 'needsWheel' && run.status === 'playing';
  COURSE.gears.forEach((_, i) => {
    const age = gearAges[i] ?? -1, missed = missAges[i] ?? -1;
    const grow = age >= 0 && age < .35 ? 1 + (.35 - age) * 1.5 : missed >= 0 && missed < .35 ? 1 + (.35 - missed) * .6 : 1;
    const behind = !run.gears[i] && run.x > COURSE.gears[i].x;
    if (rescuable && behind && !reducedMotion.matches) ctx.globalAlpha = .45 + .55 * Math.abs(Math.sin(worldTime * 4));
    paintGear(hudX(i), 22, 7 * grow, 0, run.gears[i], !run.gears[i]);
    ctx.globalAlpha = 1;
  });
  // The wheel's power reaching the gear it wakes.
  if (wakeAge < .5) {
    const fromX = wheelScreenX(run.x), t = Math.min(1, wakeAge / .3);
    ctx.globalAlpha = Math.min(1, (.5 - wakeAge) / .2); ctx.strokeStyle = '#fff0d0'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(fromX, WHEEL.y); ctx.lineTo(fromX + (hudX(wakeGear) - fromX) * t, WHEEL.y + (22 - WHEEL.y) * t); ctx.stroke();
    ctx.globalAlpha = 1;
  }
}
// Back on later climbs: a small steady beat, so the tower shows it was left running.
function paintPulse() {
  const now = (worldTime / PERIOD) % 1;
  ctx.fillStyle = '#ffb17b'; ctx.beginPath(); ctx.arc(20, 22, 4 + (1 - Math.min(1, now * 3)) * 2, 0, Math.PI * 2); ctx.fill();
  if (!reducedMotion.matches) {
    ctx.strokeStyle = '#ffb17b'; ctx.lineWidth = 1; ctx.globalAlpha = 1 - now;
    ctx.beginPath(); ctx.arc(20, 22, 6 + now * 10, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }
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
  const beat = bellAge >= 0 ? (bellAge - fallTime) / PERIOD : -1;
  paintEscapement(screen);
  paintTrain(beat);
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
  // Down from the bell, and then it keeps hopping on the spot with nobody pressing.
  const hopping = bellAge >= fallTime && bellAge >= 0 && !reducedMotion.matches;
  const heroPhase = hopping ? (beat % 1) * PERIOD : phase;
  const heroY = bellAge >= 0 ? (hopping ? feetY(heroPhase) : Math.min(feetY(0), struckY + bellAge * bellAge * 700))
    : feetY(phase) + (deathAge ? Math.min(110, deathAge * deathAge * 160) : 0);
  if (fast && !reducedMotion.matches) {
    ctx.fillStyle = '#ffb17b';
    for (let i = 0; i < 3; i++) ctx.fillRect(HERO_X - 28 - i * 10, heroY - 20 + i * 7, 5 + i * 2, 2);
  }
  drawPod(ctx, HERO_X, heroY, 2, {
    phase: heroPhase / PERIOD, fast, land: Math.max(0, 1 - landAge / .13),
    dead: deathAge, time: now, idle: state === 'idle'
  });
  paintFloats(screen);
  ctx.restore();
  if (bellAge >= 0 && bellAge < .22 && !reducedMotion.matches) {
    ctx.fillStyle = '#fff0d0'; ctx.globalAlpha = (.22 - bellAge) * 1.8; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
  }
  if (revived && beat >= HEART_BEAT) {
    const main = ctx;
    ctx = heartCtx; paintHeart(beat - HEART_BEAT, revived); ctx = main;
    ctx.globalAlpha = Math.min(1, (beat - HEART_BEAT) / (reducedMotion.matches ? .2 : .6));
    ctx.drawImage(heartCanvas, 0, 0);
    ctx.globalAlpha = 1;
  }
  paintHud();
  if (revivedBefore && !revived) paintPulse();
  if (run.status !== 'rang') paintTimeline();
  if (banner) {
    const rang = run.status === 'rang';
    // Over the whole clock it needs no plate, and the roof and moon stay in view.
    if (!(revived && beat >= HEART_BEAT)) { ctx.fillStyle = 'rgba(18,15,28,.78)'; ctx.fillRect(0, 42, W, rang ? 66 : 44); }
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
  palletAges = palletAges.map(age => age >= 0 ? age + dt : age);
  toothAge += dt;
  wakeAge += dt;
  if (revived && bellAge >= fallTime) {
    const beat = Math.floor((bellAge - fallTime) / PERIOD);
    if (beat > lastBeat) {
      lastBeat = beat;
      landAge = 0;
      beatSound(beat, revived);
      document.body.dataset.beat = String(beat);
    }
  }
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
    startReady(answeredAt(e), demo);
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
