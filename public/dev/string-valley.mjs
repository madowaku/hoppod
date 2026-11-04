import { PERIOD, INSET, footing } from '../src/engine.mjs';
import { drawPod } from '../src/pod.mjs';
import { createAudio } from '../src/audio.mjs';
import { chooseLanguage } from '../src/ui-copy.mjs';
import {
  LAB, STAGES, CONTACT_WINDOW, newAttempt, advanceAttempt, advanceWithPlan,
  planIsFast, judge, feetY
} from './string-trajectory.mjs';

const TEXT = {
  ja: {
    stages: ['① 鳴らす', '② くぐる', '③ 近い弦', '④ 同じ旗', '⑤ 4連'],
    goals: [
      '弦を鳴らして、パッドに着地しよう',
      '今度は弦に触れずに、パッドに着地しよう',
      '近い弦を鳴らして着地。さっきと同じ飛び方で鳴るかな？',
      '旗に2回着地しよう。1回は鳴らして、1回は鳴らさずに',
      '止まらず4ホップ。金の弦は鳴らす、青の弦は鳴らさない'
    ],
    hints: [
      'ヒント：跳んですぐ押して、頂上あたりで離す',
      'ヒント：前半は待って、頂上を過ぎてから押す',
      'ヒント：弦が近いと、急ぐほど弦の下を抜ける。前半はゆっくり',
      'ヒント：押す長さはどちらも約0.39秒。順番だけを変える',
      'ヒント：弦が近ければゆっくりが先、遠ければ急ぐのが先'
    ],
    start: '押すとスタート', fast: '押している間 FAST', slow: '離すと SLOW', next: '押すと次へ', again: '押してもう一度',
    demoButton: '▶ 見本を見る', retry: 'やり直す (R)', sound: ['音 ON', '音 OFF'], language: 'EN',
    labelFast: 'FAST時間', labelString: '弦', labelLanding: '着地',
    hit: '♪ 鳴った', silent: '無音', inAir: '飛行中', fell: '落下',
    idle: '押すと1拍おいて跳びます。もう押し始めていれば、最初から FAST です。',
    ready: '1拍の助走…', demoing: '見本を再生中。押すと自分の番に戻ります。',
    short: '手前に落ちた。もう少し長く押そう', far: '飛びすぎた。もう少し早く離そう',
    offFlag: d => `着地はできたけれど、旗から ${d}px ずれた`,
    wrongRing: '着地はできたけれど、鳴らせなかった', wrongSilent: '着地はできたけれど、鳴ってしまった',
    wrongPhrase: n => `最後まで着いた！ ただし ${n} 本違う弦があった`,
    cleared: '★ クリア！', flagFirstRing: '鳴らして旗に着地！ 次は鳴らさずに', flagFirstSilent: '鳴らさず旗に着地！ 次は鳴らして',
    flagAgain: 'その音はもう取った。今度は逆の音で', allClear: '全ステージ達成！ おつかれさま',
    stall: '処理が止まったので、やり直します', demoDone: '見本おわり。自分でやってみよう',
    bannerClear: '★ CLEAR', bannerFall: 'FALL', bannerMiss: 'もう一度',
    now: '今', prev: '前回', high: '弦に届く高さ',
    notesTitle: 'テスト記録と操作メモ',
    notes: '操作は押す・離すだけ（Space も可、R でやり直し）。下の記録は端末の中だけにあり、送信されません。試遊の後でコピーして共有できます。',
    copy: '記録をコピー', copied: 'コピーしました', copyFailed: '選択したので手動でコピーしてください'
  },
  en: {
    stages: ['1 RING', '2 UNDER', '3 NEAR', '4 FLAG', '5 PHRASE'],
    goals: [
      'Ring the string and land on the pad',
      'Now land on the pad without touching the string',
      'Ring the near string and land. Does the same flight still work?',
      'Land on the flag twice: once ringing, once silent',
      'Four hops without stopping. Ring the gold, leave the blue silent'
    ],
    hints: [
      'Hint: press right after take-off, release around the top',
      'Hint: wait through the first half, press after the top',
      'Hint: a near string slips by if you rush. Start slow',
      'Hint: hold about 0.39s both times. Only the order changes',
      'Hint: near string, slow first. Far string, fast first'
    ],
    start: 'PRESS TO START', fast: 'HOLDING = FAST', slow: 'RELEASED = SLOW', next: 'PRESS FOR NEXT', again: 'PRESS TO RETRY',
    demoButton: '▶ WATCH A DEMO', retry: 'RETRY (R)', sound: ['SOUND ON', 'SOUND OFF'], language: '日本語',
    labelFast: 'FAST TIME', labelString: 'STRING', labelLanding: 'LANDING',
    hit: '♪ RANG', silent: 'SILENT', inAir: 'IN AIR', fell: 'FELL',
    idle: 'Press: one beat later you jump. Already holding means FAST from the start.',
    ready: 'One beat run-up…', demoing: 'Playing the demo. Press to take over.',
    short: 'Fell short. Hold a little longer', far: 'Flew too far. Release a little earlier',
    offFlag: d => `Landed, but ${d}px off the flag`,
    wrongRing: 'Landed, but the string stayed silent', wrongSilent: 'Landed, but the string rang',
    wrongPhrase: n => `You made it! ${n} string(s) were wrong`,
    cleared: '★ CLEAR!', flagFirstRing: 'Rang and hit the flag! Now do it silently', flagFirstSilent: 'Silent on the flag! Now ring it',
    flagAgain: 'You already have that sound. Try the opposite', allClear: 'All stages done. Well played!',
    stall: 'Playback stalled, restarting', demoDone: 'Demo finished. Your turn',
    bannerClear: '★ CLEAR', bannerFall: 'FALL', bannerMiss: 'AGAIN',
    now: 'NOW', prev: 'LAST', high: 'high enough to touch',
    notesTitle: 'Test log and controls',
    notes: 'Just press and release (Space works, R retries). The log stays on this device and is never sent. Copy it after a session to share it.',
    copy: 'COPY LOG', copied: 'Copied', copyFailed: 'Selected: copy it manually'
  }
};

const $ = id => document.getElementById(id);
const canvas = $('scene'), ctx = canvas.getContext('2d');
const W = 360, H = 510, FLOOR = LAB.floorY, HERO_X = 80;
const params = new URL(location.href).searchParams;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const audio = createAudio();
const readPref = key => { try { return localStorage.getItem(key); } catch { return null; } };
let language = chooseLanguage(location.href, readPref('hoppod.pref.lang'), navigator.language);
const tr = () => TEXT[language];

let stageIndex = Math.max(0, STAGES.findIndex(s => s.id === params.get('stage')));
let state = 'idle'; // idle | ready | run | done
let run = newAttempt(STAGES[stageIndex]);
let clock = 0, readyLeft = 0, appliedFast = false, edges = [], doneAt = -1, lastPaint = null, worldTime = 0;
let trail = [], ghost = [], lastSegments = null, plan = null, demoQueue = [], demoWait = 0;
let fails = 0, advanceOnPress = false, stringFx = [], particles = [], landAge = 10, deathAge = 0, banner = '';
let lastInput = 'none';
let pluckContext = null;
const pressedKeys = new Set(), pressedPointers = new Set();
const cleared = new Set(), flagSounds = new Set();
const log = [];

const stage = () => STAGES[stageIndex];
const held = () => pressedKeys.size + pressedPointers.size > 0;
const currentFast = () => state === 'run' && (plan ? planIsFast(run, plan) : appliedFast);
const say = message => { $('outcome').textContent = message; };

function unlock() {
  audio.unlock();
  try {
    pluckContext ||= new (globalThis.AudioContext || globalThis.webkitAudioContext)();
    if (pluckContext.state === 'suspended') pluckContext.resume().catch(() => {});
  } catch { /* The visual result never depends on sound. */ }
}
// note === null is a damped string: a rest you were supposed to leave alone.
function pluck(note) {
  if (audio.muted || pluckContext?.state !== 'running') return;
  const t = pluckContext.currentTime;
  const partials = note === null ? [[110, .16, .13, 'triangle']]
    : [[note, .15, .7, 'triangle'], [note * 2, .05, .28, 'sine'], [note * 3, .02, .12, 'sine']];
  for (const [frequency, peak, decay, type] of partials) {
    const o = pluckContext.createOscillator(), g = pluckContext.createGain();
    o.type = type; o.frequency.setValueAtTime(frequency, t);
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + .005);
    g.gain.exponentialRampToValueAtTime(.0001, t + decay);
    o.connect(g); g.connect(pluckContext.destination);
    o.start(t); o.stop(t + decay + .05);
  }
}

function resetField() {
  run = newAttempt(stage());
  if (trail.length > 1) { ghost = trail; lastSegments = trail.segments ?? null; }
  trail = [{ x: run.x, y: feetY(0) }];
  edges = []; banner = ''; deathAge = 0;
  stringFx = stage().strings.map(() => ({ age: -1 }));
}
function toIdle(message = tr().idle) {
  state = 'idle'; plan = null; demoQueue = []; demoWait = 0; advanceOnPress = false;
  resetField();
  say(message);
  refresh();
}
function startReady(now, demoPlan = null) {
  resetField();
  plan = demoPlan;
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
    if (event.type === 'note') {
      pluck(stage().strings[event.string].note);
      stringFx[event.string].age = 0;
      if (!reducedMotion.matches) for (let i = 0; i < 8; i++) {
        particles.push({ x: stage().strings[event.string].x, y: LAB.stringBottomY, vx: (i - 3.5) * 24, vy: -30 - (i % 3) * 24, age: 0, color: i % 2 ? '#ffe9a8' : '#8ee6c4', gravity: 180 });
      }
    }
    if (event.type === 'land') {
      landAge = 0;
      audio.play('land', event.hops);
      if (!reducedMotion.matches) for (let i = 0; i < 8; i++) {
        particles.push({ x: event.x, y: FLOOR - 5, vx: (i - 3.5) * 17, vy: -20 - (i % 3) * 10, age: 0, color: i % 2 ? '#efdaad' : '#8ee6c4', gravity: 100 });
      }
    }
    if (event.type === 'fall') { audio.play('fall'); deathAge = .001; }
  }
  if (run.status !== 'playing') finish();
}
function finish() {
  const verdict = judge(run);
  const text = tr();
  state = 'done'; doneAt = clock;
  trail.segments = run.segments;
  const touched = run.strings.map(s => s.touched);
  if (plan) {
    const wasDemo = plan;
    if (demoQueue.length) { demoWait = 1.1; say(verdict.ok ? text.cleared : describe(verdict)); }
    else { say(text.demoDone); }
    banner = verdict.ok ? text.bannerClear : verdict.reason === 'short' || verdict.reason === 'far' ? text.bannerFall : text.bannerMiss;
    log.push(entry(verdict, touched, wasDemo));
    plan = null;
  } else {
    log.push(entry(verdict, touched, null));
    resolvePlayer(verdict, touched);
  }
  $('log').value = JSON.stringify(log);
  refresh();
}
function entry(verdict, touched, demoPlan) {
  return {
    stage: stage().id, demo: Boolean(demoPlan), input: lastInput, ok: verdict.ok, reason: verdict.reason,
    x: +run.x.toFixed(2), hops: run.hops, touched, fast: +run.fastSeconds.toFixed(3),
    segments: run.segments.map(s => [s.hop, +s.from.toFixed(3), +s.to.toFixed(3)])
  };
}
function describe(verdict) {
  const text = tr();
  if (verdict.reason === 'short') return text.short;
  if (verdict.reason === 'far') return text.far;
  if (verdict.reason === 'off-flag') return text.offFlag(Math.round(Math.abs(run.x - stage().flag)));
  if (stage().strings.length > 1) return text.wrongPhrase(verdict.wrong.length);
  return stage().strings[0].want === 'ring' ? text.wrongRing : text.wrongSilent;
}
function resolvePlayer(verdict, touched) {
  const text = tr();
  let done = verdict.ok, message;
  if (stage().id === 'flag' && verdict.ok) {
    const sound = touched[0] ? 'ring' : 'silent';
    if (flagSounds.has(sound)) { done = false; message = text.flagAgain; }
    else {
      flagSounds.add(sound);
      done = flagSounds.size === 2;
      if (!done) message = sound === 'ring' ? text.flagFirstRing : text.flagFirstSilent;
    }
  }
  if (done) {
    cleared.add(stage().id); fails = 0; advanceOnPress = true;
    banner = text.bannerClear;
    say(cleared.size === STAGES.length ? text.allClear : text.cleared);
    return;
  }
  banner = verdict.reason === 'short' || verdict.reason === 'far' ? text.bannerFall : text.bannerMiss;
  if (message) { say(message); return; }
  fails += 1;
  say(fails >= 3 ? describe(verdict) + ' / ' + text.hints[stageIndex] : describe(verdict));
}
function selectStage(index) {
  stageIndex = index; fails = 0; flagSounds.clear(); ghost = []; trail = []; lastSegments = null;
  toIdle();
}

function press(event, source) {
  unlock();
  lastInput = source;
  const now = event.timeStamp / 1000;
  if (state === 'done' && now - doneAt < .18) return;
  if (state === 'idle' || state === 'done' || plan || demoQueue.length) {
    if (state === 'done' && advanceOnPress) {
      advanceOnPress = false;
      if (stageIndex < STAGES.length - 1) { selectStage(stageIndex + 1); return; }
    }
    plan = null; demoQueue = []; demoWait = 0;
    startReady(now);
    return;
  }
  if (state === 'run') audio.play('fast');
  edges.push({ t: now, fast: true });
}
function release(event) {
  if (state !== 'run' && state !== 'ready') return;
  if (plan) return;
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
  $('goal').textContent = text.goals[stageIndex];
  [...$('stages').children].forEach((button, index) => {
    button.textContent = text.stages[index];
    button.classList.toggle('cleared', cleared.has(STAGES[index].id));
    button.setAttribute('aria-current', String(index === stageIndex));
  });
  const hold = $('hold');
  hold.classList.toggle('active', held());
  hold.textContent = state === 'run' || state === 'ready' ? (held() ? text.fast : text.slow)
    : state === 'done' ? (advanceOnPress ? text.next : text.again) : text.start;
  document.body.dataset.state = state;
  $('fast-seconds').textContent = run.fastSeconds.toFixed(2) + 's';
  const anyTouched = run.strings.some(s => s.touched);
  $('string-state').textContent = state === 'done' || anyTouched
    ? (anyTouched ? text.hit : text.silent) : '—';
  $('landing-state').textContent = state === 'done'
    ? (run.status === 'fall' ? text.fell : Math.round(run.x) + 'px')
    : state === 'run' ? text.inAir : '—';
  $('demo').textContent = text.demoButton;
  $('retry').textContent = text.retry;
  $('sound').textContent = text.sound[audio.muted ? 1 : 0];
  $('language').textContent = text.language;
  $('label-fast').textContent = text.labelFast;
  $('label-string').textContent = text.labelString;
  $('label-landing').textContent = text.labelLanding;
  $('notes-title').textContent = text.notesTitle;
  $('notes').textContent = text.notes;
  $('copy').textContent = text.copy;
}

function paintStars(offset) {
  for (let i = 0; i < 44; i++) {
    const x = ((i * 97 - offset * .09) % 390 + 390) % 390;
    ctx.fillStyle = i % 7 ? '#526976' : '#ead6a4';
    ctx.fillRect(x | 0, 22 + i * 37 % 220, 2, i % 7 ? 2 : 3);
  }
}
function paintPlatforms(screen) {
  ctx.fillStyle = '#04080c'; ctx.fillRect(0, FLOOR, W, H - FLOOR);
  for (const platform of stage().platforms) {
    const [left, right] = footing(platform);
    const l = screen(left), r = screen(right);
    if (r + INSET < 0 || l - INSET > W) continue;
    ctx.fillStyle = '#2e4850'; ctx.fillRect(l, FLOOR, r - l, H - FLOOR);
    for (let k = 0; k < INSET / 2; k++) {
      const drop = 3 + k * 3;
      ctx.fillStyle = '#26404a'; ctx.fillRect(l - 2 - k * 2, FLOOR + drop, 2, H); ctx.fillRect(r + k * 2, FLOOR + drop, 2, H);
      ctx.fillStyle = '#56737a'; ctx.fillRect(l - 2 - k * 2, FLOOR + drop, 2, 2); ctx.fillRect(r + k * 2, FLOOR + drop, 2, 2);
    }
    ctx.fillStyle = '#a8b7a5'; ctx.fillRect(l, FLOOR, r - l, 6);
    ctx.fillStyle = '#65858a'; ctx.fillRect(l, FLOOR + 6, r - l, 8);
    ctx.fillStyle = '#edcf98'; ctx.fillRect(l, FLOOR, 2, 5); ctx.fillRect(r - 2, FLOOR, 2, 5);
  }
}
function paintFlag(screen) {
  const flag = stage().flag;
  if (flag === undefined) return;
  const a = screen(flag - LAB.flagTolerance), b = screen(flag + LAB.flagTolerance), x = screen(flag);
  ctx.fillStyle = '#ffd27a'; ctx.fillRect(a, FLOOR, b - a, 6);
  ctx.fillStyle = '#e9d9b0'; ctx.fillRect(x, FLOOR - 34, 2, 34);
  ctx.fillStyle = '#ff9161'; ctx.fillRect(x + 2, FLOOR - 34, 14, 9);
}
function paintStrings(screen) {
  stage().strings.forEach((string, index) => {
    const x = screen(string.x);
    if (x < -20 || x > W + 20) return;
    const age = stringFx[index]?.age ?? -1, active = age >= 0;
    const swing = active && !reducedMotion.matches ? Math.sin(age * 46) * 9 * Math.exp(-age * 3.5) : 0;
    const bottom = LAB.stringBottomY;
    const colour = string.want === 'silent' ? '#7fb2e6' : string.want === 'either' ? '#8ee6c4' : '#ffd27a';
    const flash = active && age < .35;
    ctx.strokeStyle = flash ? '#fff6d8' : colour;
    ctx.globalAlpha = flash ? 1 : .72;
    ctx.lineWidth = flash ? 2 : 1;
    ctx.beginPath(); ctx.moveTo(x, 0);
    ctx.quadraticCurveTo(x + swing * 2, bottom * .5, x + swing, bottom - 8);
    ctx.stroke();
    ctx.globalAlpha = 1;
    // The bead's lower edge is exactly the height the antennas must reach.
    ctx.fillStyle = flash ? '#fff6d8' : colour;
    ctx.fillRect(Math.round(x + swing) - 3, bottom - 8, 7, 8);
    if (string.note === null) { ctx.fillStyle = '#172638'; ctx.fillRect(Math.round(x + swing) - 2, bottom - 5, 5, 2); }
    if (active && age < .9 && string.note !== null) {
      ctx.globalAlpha = 1 - age / .9;
      ctx.fillStyle = '#fff6d8'; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center';
      ctx.fillText('♪', x + 12, bottom - 18 - age * 34);
      ctx.globalAlpha = 1;
    }
  });
}
function paintTrail(points, screen, colour, width, alpha) {
  if (points.length < 2) return;
  ctx.strokeStyle = colour; ctx.lineWidth = width; ctx.globalAlpha = alpha;
  ctx.beginPath();
  points.forEach((p, i) => (i ? ctx.lineTo(screen(p.x), p.y - 26) : ctx.moveTo(screen(p.x), p.y - 26)));
  ctx.stroke(); ctx.globalAlpha = 1;
}
// When the button was held across the beat. Same length, different order is
// the whole discovery, so it is drawn rather than explained.
function paintTimeline(y, segments, label, showPhase) {
  const left = 40, width = W - 56, span = stage().beats * PERIOD;
  const px = t => left + width * t / span;
  ctx.fillStyle = '#0d1c25'; ctx.fillRect(left, y, width, 12);
  for (let beat = 0; beat < stage().beats; beat++) {
    const base = beat * PERIOD;
    ctx.fillStyle = '#2a4a4f';
    ctx.fillRect(px(base + CONTACT_WINDOW[0]), y, px(CONTACT_WINDOW[1]) - px(CONTACT_WINDOW[0]), 12);
    ctx.fillStyle = '#1e333a'; ctx.fillRect(px(base), y, 1, 12);
  }
  ctx.fillStyle = '#ffc38e';
  for (const s of segments ?? []) {
    if (s.hop >= stage().beats) continue;
    ctx.fillRect(px(s.hop * PERIOD + s.from), y + 3, Math.max(1, px(s.to) - px(s.from)), 6);
  }
  if (showPhase) {
    ctx.fillStyle = '#fff0d0';
    ctx.fillRect(px(Math.min(run.time, span)), y - 2, 2, 16);
  }
  ctx.fillStyle = '#a5bbbc'; ctx.font = '10px monospace'; ctx.textAlign = 'right';
  ctx.fillText(label, left - 5, y + 10);
}
function paintPhraseChips() {
  const { strings } = stage();
  if (strings.length < 2) return;
  const size = 22, gap = 8, start = (W - strings.length * size - (strings.length - 1) * gap) / 2;
  strings.forEach((string, i) => {
    const x = start + i * (size + gap), state2 = run.strings[i];
    const want = string.want === 'ring';
    const resolved = state2.touched || state2.passed || run.status !== 'playing';
    const good = want === state2.touched;
    ctx.fillStyle = !resolved ? '#142731' : good ? '#2d6a57' : '#7b3d33';
    ctx.fillRect(x, 8, size, size);
    ctx.strokeStyle = want ? '#ffd27a' : '#7fb2e6'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, 9, size - 2, size - 2);
    ctx.fillStyle = want ? '#ffd27a' : '#7fb2e6'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center';
    ctx.fillText(want ? '♪' : '−', x + size / 2, 24);
  });
}
function paint(now) {
  const offset = run.x - HERO_X;
  const screen = x => Math.round(x - offset);
  ctx.fillStyle = '#101f2c'; ctx.fillRect(0, 0, W, H);
  paintStars(offset);
  paintPlatforms(screen);
  paintFlag(screen);
  paintStrings(screen);
  paintTrail(ghost, screen, '#a5bbbc', 1, .55);
  paintTrail(trail, screen, '#fff0d0', 2, .85);
  for (const p of particles) {
    ctx.fillStyle = p.color; ctx.globalAlpha = Math.max(0, 1 - p.age / .45);
    ctx.fillRect(screen(p.x) + p.vx * p.age, p.y + p.vy * p.age + p.gravity * p.age ** 2, 3, 3);
  }
  ctx.globalAlpha = 1;
  const phase = state === 'ready' ? PERIOD - readyLeft : state === 'run' ? run.phase : 0;
  const fast = currentFast();
  const heroY = feetY(phase) + (deathAge ? Math.min(110, deathAge * deathAge * 160) : 0);
  if (fast && !reducedMotion.matches) {
    ctx.fillStyle = '#ffb17b';
    for (let i = 0; i < 3; i++) ctx.fillRect(HERO_X - 28 - i * 10, heroY - 20 + i * 7, 5 + i * 2, 2);
  }
  drawPod(ctx, HERO_X, heroY, 2, {
    phase: phase / PERIOD, fast, land: Math.max(0, 1 - landAge / .13),
    dead: deathAge, time: now, idle: state === 'idle'
  });
  paintPhraseChips();
  paintTimeline(446, run.segments, tr().now, state === 'run');
  paintTimeline(466, lastSegments, tr().prev, false);
  ctx.fillStyle = '#a5bbbc'; ctx.font = '10px monospace'; ctx.textAlign = 'left';
  ctx.fillText('▮ ' + tr().high, 40, 495);
  if (banner) {
    ctx.fillStyle = 'rgba(11,23,32,.72)'; ctx.fillRect(0, 96, W, 44);
    ctx.fillStyle = '#fff0d0'; ctx.font = 'bold 22px monospace'; ctx.textAlign = 'center';
    ctx.fillText(banner, W / 2, 126);
  }
  ctx.textAlign = 'left';
}

function frame(ms) {
  const now = ms / 1000;
  const dt = lastPaint === null ? 0 : Math.min(.05, now - lastPaint);
  lastPaint = now; worldTime += dt;
  if (state === 'ready' || state === 'run') pump(now);
  if (state === 'done' && demoWait > 0) {
    demoWait -= dt;
    if (demoWait <= 0 && demoQueue.length) startReady(now, demoQueue.shift());
  }
  landAge += dt;
  if (deathAge) deathAge += dt;
  for (const fx of stringFx) if (fx.age >= 0) fx.age += dt;
  particles.forEach(p => { p.age += dt; });
  particles = particles.filter(p => p.age < .45);
  refresh();
  paint(worldTime);
  requestAnimationFrame(frame);
}

for (const [index, s] of STAGES.entries()) {
  const button = document.createElement('button');
  button.type = 'button'; button.dataset.stage = s.id;
  button.addEventListener('click', () => { button.blur(); selectStage(index); });
  $('stages').append(button);
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
$('demo').addEventListener('click', e => {
  e.currentTarget.blur();
  unlock();
  const [first, ...rest] = stage().demos;
  clearInput();
  ghost = []; trail = []; lastSegments = null; advanceOnPress = false;
  demoQueue = rest;
  startReady(e.timeStamp / 1000, first);
});
$('retry').addEventListener('click', e => { e.currentTarget.blur(); toIdle(); });
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
