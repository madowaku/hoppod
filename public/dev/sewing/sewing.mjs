// 銀河縫いのミシン工房 LAB: drawing, sound, input. Rules: sewing-model.mjs.
// Rapippo only hops on the beat; each landing drives the needle. The cloth
// (the world) is what speeds up. No speed effects on the hero.
import { drawPod } from '../../src/pod.mjs';
import { drawCrewParts } from '../../src/story/crew.mjs';
import { COMPANION_PALETTE } from '../../src/companion.mjs';
import {
  PERIOD, BEAT_LIMIT, CLOTH, RIP_NEED, SLOW_FEED, newRun, step, predictDrop, summary, zoneAt, feedOf, nextReverse,
  mendedAt as mendedIn, ripStrength, nextMark, redNext, MARK_HALF,
} from './sewing-model.mjs';

const W = 360, H = 510;
const canvas = document.getElementById('scene'), g = canvas.getContext('2d');
const $ = id => document.getElementById(id);
const PALETTE = { blue: COMPANION_PALETTE, green: { c: '#b4f2c8', w: '#ecfff2', s: '#73c290', a: '#3fcf7f' }, red: { c: '#ffbcae', w: '#fff1ec', s: '#d98a7a', a: '#ff6a4f' } };
const GOLD = '#ffd27a';
const THREAD = { blue: '#8cc8ff', green: '#6cf0a2', red: '#ff8a70', plain: '#f3e6c8' };
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Scene geometry (screen px).
// v0.3: no machine. Rapippo is the needle: big, standing on the cloth, a
// needle under its spring and the thread running from its foot.
const NX = 150;                 // where Rapippo (the needle) stands
const SEAM = 352;               // seam line y on the cloth
const CLOTH_TOP = SEAM - 60, CLOTH_BOT = SEAM + 50;
const HERO_SCALE = 3, NEEDLE = 10;
const HERO_FEET = SEAM - NEEDLE + 2;  // landed: the needle tip is just through the cloth
const HOP = 52;
const GREEN_HOLD_X = NX + 64, GREEN_REST_X = NX + 156, GREEN_ON_CLOTH = SEAM + 42;
const FRIEND_FEET = CLOTH_BOT + 26;
// v0.4: red directs from the thread stand at the back of the table.
const STAND_X = NX - 62, TABLE_EDGE = CLOTH_TOP - 4, SPOOL_Y = TABLE_EDGE - 58, RED_X = NX - 112;
const THREAD_NAME = { blue: '青', green: '緑', red: '赤', plain: 'いつもの' };

// ---------- state ----------
let run, input = false, screen = 'title', idleT = 0, endT = 0, lastLand = -9;
let greenX = GREEN_REST_X, greenSlipAt = -9, pinFx = [], fluff = [], bubble = null, message = '', messageT = 0, redCall = null, greenRelief = -9;
let greenPullX = null, redSwapAt = -9, redSign = null, warned = null;
let awake = { red: 0, blue: 0, green: 0 };
function reset() {
  run = newRun(); screen = 'title'; endT = 0; lastLand = -9; greenX = GREEN_REST_X; greenSlipAt = -9; greenPullX = null; redSwapAt = -9; redSign = null; warned = null;
  pinFx = []; bubble = null; redCall = null; greenRelief = -9; message = ''; awake = { red: 0, blue: 0, green: 0 };
  fluff = Array.from({ length: 22 }, (_, i) => ({ c: i * 61 % 1300 - 40, y: CLOTH_TOP + 6 + (i * 37) % 76, k: i % 3 }));
  say('押すと、ラピッポが縫いはじめる。');
  updateHud();
}

// ---------- sound ----------
let ac = null, out = null, soundOn = true, clothFilter = null, clothGain = null;
const CHORDS = [
  { root: 98, bell: [392, 494, 587, 784] },   // G
  { root: 82.4, bell: [330, 392, 494, 587] }, // Em7
  { root: 65.4, bell: [523, 659, 784, 988] }, // Cmaj7
  { root: 73.4, bell: [440, 587, 740, 880] }, // D
  { root: 98, bell: [392, 494, 587, 784] },   // G
  { root: 61.7, bell: [494, 587, 740, 880] }, // Bm7
  { root: 65.4, bell: [523, 659, 784, 988] }, // Cmaj7
  { root: 65.4, bell: [523, 622, 784, 880] }, // Cm6
];
const TUNE = [0, 1, 2, 3, 2, 1, 2, 0];
let tuneAt = 0;
function audio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return ac; }
  try {
    ac = new AudioContext();
    const lim = ac.createDynamicsCompressor(); lim.threshold.value = -10; lim.ratio.value = 8;
    out = ac.createGain(); out.gain.value = soundOn ? 1.6 : 0; out.connect(lim); lim.connect(ac.destination);
    // The cloth running under Rapippo: シュルルルッ when FAST, スル……スル…… when SLOW.
    const len = ac.sampleRate * 2, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
    clothFilter = ac.createBiquadFilter(); clothFilter.type = 'bandpass'; clothFilter.Q.value = .8; clothFilter.frequency.value = 900;
    clothGain = ac.createGain(); clothGain.gain.value = 0;
    src.connect(clothFilter); clothFilter.connect(clothGain); clothGain.connect(out); src.start();
  } catch { ac = null; }
  return ac;
}
function tone(freq, { at = 0, dur = .2, vol = .1, type = 'sine', attack = .004, glide = 0 } = {}) {
  if (!ac) return;
  const t = ac.currentTime + at, o = ac.createOscillator(), v = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t); if (glide) o.frequency.exponentialRampToValueAtTime(freq * glide, t + dur);
  v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(vol, t + attack); v.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(v); v.connect(out); o.start(t); o.stop(t + dur + .05);
}
let noiseBuf = null;
function noise({ at = 0, dur = .05, vol = .1, freq = 3000, q = 1, type = 'bandpass' } = {}) {
  if (!ac) return;
  if (!noiseBuf) { noiseBuf = ac.createBuffer(1, ac.sampleRate * .5, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const t = ac.currentTime + at, s = ac.createBufferSource(), f = ac.createBiquadFilter(), v = ac.createGain();
  s.buffer = noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q;
  v.gain.setValueAtTime(vol, t); v.gain.exponentialRampToValueAtTime(.0001, t + dur);
  s.connect(f); f.connect(v); v.connect(out); s.start(t); s.stop(t + dur + .02);
}
const chordOf = beat => CHORDS[Math.floor(Math.max(0, beat - 1) / 4) % CHORDS.length];
// One beat of the workshop. Rapippo's needle always; the others play while
// they work, and keep playing softly once they have joined.
function beatSound(stitch) {
  if (!ac) return;
  const beat = stitch.beat, inBar = (beat - 1) % 4, ch = chordOf(beat);
  // Rapippo, the needle: on every landing, same beat. FAST a strong カタン！, SLOW a neat コトン.
  if (stitch.fast) { noise({ dur: .05, vol: .2, freq: 2600, q: 2 }); tone(150, { dur: .12, vol: .16, glide: .6 }); }
  else { tone(880, { dur: .07, vol: .08, type: 'triangle' }); noise({ dur: .025, vol: .07, freq: 5200, q: 3 }); }
  // The thread pulls tight: キュッ.
  tone(1500, { at: .03, dur: .05, vol: .025, glide: 1.5 });
  noise({ at: PERIOD / 2, dur: .03, vol: .04, freq: 7000, q: 1 });
  if (stitch.pin) { tone(2637, { dur: .12, vol: .07, type: 'square' }); tone(1975, { at: .05, dur: .1, vol: .05, type: 'square' }); return; }
  // Red: ゴトン, the feed, while it pulls. Pulling back, the pattern turns round (wood first, then the thump).
  const red = stitch.fast || stitch.back ? 1 : awake.red ? .35 : 0;
  if (red) {
    const thump = stitch.back ? inBar % 2 === 1 : inBar % 2 === 0;
    if (thump) tone(110, { dur: .16, vol: .2 * red, glide: stitch.back ? 1.6 : .5 });
    else noise({ dur: .06, vol: .12 * red, freq: stitch.back ? 1300 : 900, q: 4 });
  }
  // Green: トントン, low, while it holds the cloth down.
  const green = greenHolding() ? 1 : awake.green ? .4 : 0;
  if (green && (inBar === 0 || inBar === 2)) tone(ch.root, { dur: .45, vol: .22 * green, type: 'triangle', attack: .01 });
  if (green && inBar === 3) tone(ch.root * 1.5, { at: PERIOD / 2, dur: .2, vol: .12 * green, type: 'triangle' });
  // Blue: チリン, where its light lands on a mended stitch (or softly on the downbeat once it has joined).
  // A chalk mark hit plays the tune at full voice; mending without a mark, softly.
  const blue = stitch.mark >= 0 ? 1 : stitch.mend ? .45 : awake.blue && inBar === 0 ? .3 : 0;
  if (blue) {
    const f = ch.bell[TUNE[tuneAt++ % TUNE.length]];
    tone(f, { dur: .7, vol: .09 * blue }); tone(f * 2, { dur: .25, vol: .025 * blue });
    tone(f, { at: PERIOD * .75, dur: .4, vol: .03 * blue });
  }
}
// Red throws the feed lever: a ratchet, three clicks.
function reverseSound() { for (let i = 0; i < 3; i++) noise({ at: i * .06, dur: .03, vol: .14, freq: 2400 - i * 500, q: 6 }); }
function swapSound() { tone(523, { dur: .08, vol: .05, type: 'triangle' }); noise({ at: .08, dur: .03, vol: .1, freq: 3000, q: 4 }); }
function strongSound() { if (ac) [587, 784, 988, 1175].forEach((f, i) => tone(f, { at: i * .09, dur: .5, vol: .05 })); }
function slipSound() { noise({ dur: .32, vol: .14, freq: 400, q: .7, type: 'lowpass' }); }
function finishSound() {
  if (!ac) return;
  // The machine stops: one last clunk, then the four play the G chord together.
  tone(70, { dur: .3, vol: .25, glide: .6 });
  [196, 247, 294, 392].forEach((f, i) => tone(f, { at: PERIOD * 2 + i * PERIOD, dur: PERIOD * (8 - i), vol: .05, type: 'triangle', attack: .4 }));
}
function glowSound(i) { if (ac) tone([784, 988, 1175, 1568, 1319, 1175, 988][i % 7], { dur: .9, vol: .05 }); }

// ---------- input ----------
const holdButton = $('hold');
function press(on) {
  input = on; holdButton.classList.toggle('active', on);
  if (on) {
    audio();
    if (screen === 'title') { screen = 'sew'; run.started = true; say('布が流れてきた。'); }
    else if (screen === 'end' && endT > 12) reset();
  }
}
holdButton.addEventListener('pointerdown', e => { e.preventDefault(); holdButton.setPointerCapture(e.pointerId); press(true); });
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) holdButton.addEventListener(ev, () => press(false));
canvas.addEventListener('pointerdown', e => { e.preventDefault(); canvas.setPointerCapture(e.pointerId); press(true); });
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(ev, () => press(false));
addEventListener('keydown', e => { if (e.code === 'Space' || e.code === 'Enter') { if (e.target.closest?.('button,a,textarea') && e.target !== holdButton) return; e.preventDefault(); if (!e.repeat) press(true); } });
addEventListener('keyup', e => { if (e.code === 'Space' || e.code === 'Enter') press(false); });
addEventListener('blur', () => press(false));
$('restart').addEventListener('click', reset);
$('sound').addEventListener('click', () => { soundOn = !soundOn; $('sound').textContent = soundOn ? '音 ON' : '音 OFF'; if (out) out.gain.value = soundOn ? 1.6 : 0; });
$('copy').addEventListener('click', () => navigator.clipboard?.writeText($('log').value));
// Demo: sew the whole cloth with a sensible hand, instantly, then show the ending.
$('skip').addEventListener('click', () => {
  audio(); reset(); run.started = true; screen = 'sew';
  while (!run.done) {
    if (run.dir < 0) { step(run, 1 / 240, nextReverse(run)?.why !== 'rip'); continue; }
    // Aim at the next chalk mark: FAST only while staying SLOW would fall short of it.
    const m = nextMark(run), left = PERIOD - (run.t - run.beat * PERIOD);
    const tear = [run.x, run.x + 12].some(x => zoneAt(x)?.kind === 'tear');
    step(run, 1 / 240, m !== null && m < run.x + 57 ? run.x + SLOW_FEED * left < m : !tear);
  }
  finish();
});

// ---------- helpers ----------
const sx = c => NX + (c - run.x);         // cloth coordinate → screen x
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = v => v * v * (3 - 2 * v);
function say(text) { message = text; messageT = 0; $('outcome').textContent = text; }
function greenHolding() {
  // Green holds the cloth down from a little before a tear or pins until they pass.
  return run.dir < 0 || CLOTH.zones.some(z => z.kind !== 'plain' && run.x + 90 > z.a && run.x - 10 < z.b);
}
// Is the seam under the needle still weak (the rip, not yet strong enough)?
function ripWeak() { return zoneAt(run.x)?.kind === 'rip' && ripStrength(run, run.x) < RIP_NEED; }
function hash(n) { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); }
// Each tear (and the rip) hides a small constellation in its friend's colour.
const STARS = CLOTH.zones.filter(z => z.who).map(z => ({
  who: z.who, a: z.a, b: z.b,
  dots: Array.from({ length: 7 }, (_, i) => ({ c: z.a + 6 + (z.len - 12) * (i / 6), y: Math.round((hash(z.a * 3 + i * 7) - .5) * 52) })),
}));
const mendedAt = c => mendedIn(run, c);
const lo = s => Math.min(s.from, s.x), hi = s => Math.max(s.from, s.x);
// Each pass over the same place sits a pixel apart, so a back-tack reads as a thicker seam.
const PASS_Y = [0, 2, -2, 1, -1, 3];
const passY = s => SEAM + PASS_Y[(s.pass ?? 0) % PASS_Y.length];

// ---------- frame ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(.1, (now - last) / 1000); last = now;
  update(dt); draw();
  requestAnimationFrame(frame);
}
function update(dt) {
  idleT += dt; messageT += dt;
  if (screen === 'sew') {
    const before = run.beat, made = step(run, dt, input);
    for (const s of made) onStitch(s);
    if (run.beat !== before) lastLand = run.t;
    if (run.done) finish();
    // Green walks to the cloth when it is needed, and back when it is not.
    const target = greenHolding() ? GREEN_HOLD_X : GREEN_REST_X;
    greenX += clamp(target - greenX, -90 * dt, 90 * dt);
    // Green's magnets pull a tear closed just ahead of Rapippo, unless it is being dragged.
    greenPullX = greenHolding() && Math.abs(greenX - GREEN_HOLD_X) < 3 && run.t - greenSlipAt > .9 ? greenX : null;
    // Red calls what is coming a little ahead: a reverse or a change of thread.
    const nx = redNext(run), key = nx && `${nx.type}${run.reverseIndex}${run.swapIndex}`;
    if (nx && nx.d < 34 && nx.d > 0 && warned !== key) {
      warned = key;
      if (nx.type === 'reverse') { redSign = { arrow: -1, t: run.t }; redCall = { t: run.t, text: 'もどすよ！' }; }
      else if (nx.type === 'forward') { redSign = { arrow: 1, t: run.t }; redCall = { t: run.t, text: 'すすめ！' }; }
      else redCall = { t: run.t, text: `${THREAD_NAME[nx.thread]}の糸！` };
    }
  } else if (screen === 'end') endT += dt;
  pinFx = pinFx.filter(p => (p.t += dt) < 1.2);
  if (clothGain) {
    // Louder while the cloth moves; a soft swell within each beat (スル……スル……).
    const moving = screen === 'sew', ph = moving ? (run.t % PERIOD) / PERIOD : 0, swell = .6 + .4 * Math.sin(ph * Math.PI);
    clothGain.gain.setTargetAtTime(moving ? (input ? .09 : .035) * swell : 0, ac.currentTime, .04);
    clothFilter.frequency.setTargetAtTime(input ? 2200 : 800, ac.currentTime, .06);
  }
  updateHud();
}
function onStitch(s) {
  if (s.mark >= 0 || s.mend) awake.blue = 1;
  if (greenHolding()) awake.green = 1;
  awake.red = 1;
  beatSound(s);
  const now = run.events.filter(e => e.beat === s.beat), has = t => now.find(e => e.type === t);
  if (s.pin) { pinFx.push({ c: s.x, t: 0 }); say('カツン！ まち針に当たって、針がはじかれた。'); return; }
  if (has('thread')) { swapSound(); redSwapAt = run.t; say(`赤が${THREAD_NAME[has('thread').thread]}の糸に替えた。`); }
  if (has('reverse')) {
    reverseSound(); redSign = { arrow: -1, t: run.t };
    const why = has('reverse').why;
    say(why === 'rip' ? '赤の合図で返し縫い！ ゆっくりなら細かく重なる。' : why === 'tack' ? '縫い始めは、少し戻って糸を留める（返し縫い）。' : '縫い終わりも、少し戻って留める。');
    return;
  }
  if (has('ripdone')) { strongSound(); greenRelief = run.t; say('縫い目が三重になった。緑もようやく一安心。'); return; }
  if (has('forward')) { redSign = { arrow: 1, t: run.t }; say(has('forward').why === 'rip' ? 'また前へ。もう一度、上から縫う。' : '前へ。'); return; }
  if (has('thread')) return;
  if (s.back) { if (messageT > 2.5) say(s.fine ? '細かく重なって、縫い目がキラキラ光る。' : '速く戻ると、ひと針が長い。'); return; }
  if (has('slip')) { greenSlipAt = run.t; slipSound(); say('ズズッ…緑が布ごと引きずられた！ 破れ目はゆっくり。'); }
  else if (has('wait')) { bubble = { t: run.t }; if (messageT > 2) say('赤「まだ？」 まっすぐな所は速くていい。'); }
  else if (s.mark >= 0 && run.markStreak >= 5 && messageT > 3) say(`印にぴったり ${run.markStreak}連続。青のベルが歌う。`);
  else if (s.mend && messageT > 2.5) say('青の光の中に、模様が浮かびあがる。');
}
function finish() {
  if (screen === 'end') return;
  screen = 'end'; endT = 0; input = false; holdButton.classList.remove('active');
  finishSound();
  say(run.unfinished ? '曲が終わって、ラピッポが跳ぶのをやめた。' : '最後の一針。4人が手を止めた。');
  const s = summary(run);
  $('log').value = JSON.stringify({ summary: s, stitches: run.stitches.map(t => [t.beat, +t.x.toFixed(1), +t.len.toFixed(1), t.fast ? 'F' : 'S', t.back ? 'back' : 'fwd', t.kind, t.mend ? 'mend' : t.pin ? 'pin' : '']) }, null, 0).replace(/\],\[/g, '],\n[');
}
function updateHud() {
  $('beats').textContent = `${run.beat}/${BEAT_LIMIT}`;
  $('stitches').textContent = `${run.marksHit.length}/${CLOTH.marks.length}`;
  const s = summary(run), pct = v => Math.round(v * 10);
  $('mend').textContent = `${pct(s.mend.blue)}/${pct(s.mend.green)}/${pct(s.mend.red)}`;
  $('pins').textContent = `${s.pinHits}回`;
}

// ---------- drawing ----------
const px = (c, x, y, w, h) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };
function draw() {
  g.imageSmoothingEnabled = false;
  if (screen === 'end' && endT > 2.2) { drawReveal(); return; }
  drawRoom();
  drawCloth();
  drawStand();
  drawFriends();
  drawHero();
  if (screen === 'title') banner('押すと、ラピッポが縫いはじめる', '押す＝布が速く　離す＝細かく縫う');
  if (screen === 'end') { g.globalAlpha = clamp((endT - 1.2) / 1, 0, 1); px('#0c0a16', 0, 0, W, H); g.globalAlpha = 1; }
}
function drawRoom() {
  const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#1d1830'); sky.addColorStop(1, '#2a2030');
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  // Wall planks and a round window onto the moon's night.
  for (let y = 0; y < CLOTH_TOP; y += 22) px('#241d34', 0, y, W, 1);
  g.save(); g.beginPath(); g.arc(66, 70, 42, 0, Math.PI * 2); g.clip();
  px('#070a1c', 0, 0, 140, 140);
  for (let i = 0; i < 26; i++) { const tw = .5 + .5 * Math.sin(idleT * 2 + i); g.globalAlpha = .3 + .6 * tw * hash(i); px('#e9f0ff', 26 + hash(i + 3) * 84, 30 + hash(i + 9) * 80, 1, 1); }
  g.globalAlpha = .18; px('#a9c8ff', 20, 62, 100, 3); px('#a9c8ff', 30, 58, 80, 2); g.globalAlpha = 1; // a band of galaxy
  g.restore();
  g.strokeStyle = '#5a4a6a'; g.lineWidth = 4; g.beginPath(); g.arc(66, 70, 42, 0, Math.PI * 2); g.stroke();
  px('#5a4a6a', 22, 68, 88, 3); px('#5a4a6a', 64, 28, 3, 84);
  // Spools on a shelf: blue, green, red, cream.
  px('#3a2e46', 236, 64, 108, 4);
  [['#8cc8ff', 246], ['#6cf0a2', 272], ['#ff8a70', 298], ['#f3e6c8', 324]].forEach(([c, x]) => { px('#c8a878', x - 1, 44, 12, 3); px(c, x, 47, 10, 14); px('#c8a878', x - 1, 61, 12, 3); });
  // Table.
  px('#4a3428', 0, CLOTH_TOP - 8, W, H - CLOTH_TOP + 8); px('#5c4232', 0, CLOTH_TOP - 8, W, 3);
  for (let y = CLOTH_BOT + 34; y < H; y += 26) px('#3e2c22', 0, y, W, 1);
}
function drawCloth() {
  const x0 = Math.max(-2, sx(-40)), x1 = Math.min(W + 2, sx(CLOTH.length + 6));
  if (x1 <= x0) return;
  // The cloth: deep indigo with a woven texture that streams past.
  px('#1c1a3e', x0, CLOTH_TOP + 3, x1 - x0, CLOTH_BOT - CLOTH_TOP);
  px('#2c2c66', x0, CLOTH_TOP, x1 - x0, CLOTH_BOT - CLOTH_TOP);
  for (let c = Math.ceil((run.x - NX) / 6) * 6; sx(c) < x1; c += 6) {
    if (sx(c) < x0) continue;
    for (let y = CLOTH_TOP + 3; y < CLOTH_BOT - 2; y += 6) px((c / 6 + y / 6) % 2 ? '#33357a' : '#28296a', sx(c), y, 3, 1);
  }
  // Fluff drifting on the cloth: it rides with the cloth, so FAST shows here.
  for (const f of fluff) { const x = sx(f.c); if (x > x0 && x < x1) px(['#5a5ea8', '#4a4e96', '#6a6eb8'][f.k], x, f.y, 2, 1); }
  // Seam guide (chalk) ahead of the furthest stitch.
  const furthest = run.stitches.reduce((m, s) => Math.max(m, hi(s)), 0);
  for (let c = Math.ceil(furthest / 8) * 8; sx(c) < x1; c += 8) if (sx(c) > NX + 2) px('#56569a', sx(c), SEAM, 4, 1);
  // Tears: a jagged slit along the seam, closed where it is mended. The rip is
  // wider and closes a little with each pass, fully at strength 2.
  for (const z of CLOTH.zones) {
    if ((z.kind !== 'tear' && z.kind !== 'rip') || sx(z.b) < 0 || sx(z.a) > W) continue;
    for (let c = z.a; c < z.b; c += 2) {
      const x = sx(c); if (x < -2 || x > W + 2) continue;
      const wild = Math.round(2 * Math.sin(c * .9) + hash(c) * 2);
      let gap;
      if (z.kind === 'rip') gap = Math.max(0, Math.round((7 + wild) * (1 - ripStrength(run, c) / RIP_NEED)));
      else { const sewn = c < furthest, mend = sewn && mendedAt(c); gap = mend ? 0 : sewn ? 2 : 4 + wild; }
      // Under green's magnets the edges are drawn together, ready for the needle.
      if (gap > 1 && greenPullX !== null && Math.abs(x - greenPullX) < 30 && !(c < furthest)) gap = 1;
      if (gap) { px('#0b0a1a', x, SEAM - gap, 2, gap * 2); px('#7a76b8', x, SEAM - gap - 1, 2, 1); }
      // Where the rip is strong, blue's light catches it.
      else if (z.kind === 'rip' && (reduced || Math.sin(idleT * 4 + c * .7) > .6)) px('#fff6d8', x, SEAM - 3 + (c % 3) * 3, 1, 1);
    }
    // Frayed threads at both ends tell a tear is coming.
    for (const e of [z.a, z.b]) for (let k = 0; k < 3; k++) px('#8a86c8', sx(e) + (k - 1) * 2, SEAM - 8 + k * 6, 1, 3);
  }
  // Constellations hidden in the tears: they light where blue's light finds mended stitches.
  for (const st of STARS) {
    if (sx(st.b) < -10 || sx(st.a) > W + 10) continue;
    let prev = null;
    for (const d of st.dots) {
      const lit = mendedAt(d.c), x = sx(d.c), y = SEAM + d.y;
      if (lit) {
        if (prev) { g.strokeStyle = THREAD[st.who]; g.globalAlpha = .55; g.lineWidth = 1; g.beginPath(); g.moveTo(prev[0] + .5, prev[1] + .5); g.lineTo(x + .5, y + .5); g.stroke(); g.globalAlpha = 1; }
        px(THREAD[st.who], x - 1, y - 1, 3, 3); px('#ffffff', x, y, 1, 1); prev = [x, y];
      } else { g.globalAlpha = .35; px(THREAD[st.who], x, y, 1, 1); g.globalAlpha = 1; prev = null; }
    }
  }
  // Chalk marks: an × where the needle should land; gold once hit, faded once passed.
  CLOTH.marks.forEach((m, i) => {
    const x = Math.round(sx(m)); if (x < -4 || x > W + 4) return;
    if (run.marksHit.includes(i)) { px(GOLD, x - 1, SEAM - 4, 3, 1); px(GOLD, x - 1, SEAM + 4, 3, 1); px(GOLD, x, SEAM - 5, 1, 2); px(GOLD, x, SEAM + 4, 1, 2); return; }
    if (m < furthest - MARK_HALF) { g.globalAlpha = .3; px('#d8d4e8', x, SEAM - 4, 1, 1); g.globalAlpha = 1; return; }
    g.globalAlpha = .9;
    for (let k = -2; k <= 2; k++) { px('#f2eee0', x + k, SEAM - 5 + k + 2, 1, 1); px('#f2eee0', x + k, SEAM - 1 - k, 1, 1); }
    g.globalAlpha = 1;
  });
  // Stitches: running stitch on the seam, coloured by the tear they mend.
  for (const s of run.stitches) {
    if (s.pin) continue;
    const a = sx(lo(s)), b = sx(hi(s)), y = passY(s); if (b < -4 || a > W + 4) continue;
    const col = THREAD[s.thread ?? 'plain'];
    if (s.kind === 'tear' && !s.mend) {
      // Too long over a tear: the thread sags and the slit shows through.
      g.strokeStyle = col; g.lineWidth = 1; g.beginPath(); g.moveTo(a + 1, y); g.quadraticCurveTo((a + b) / 2, y + 6, b - 1, y); g.stroke();
    } else px(col, a + 1, y, Math.max(1, b - a - 2), 1);
    px('#0e0c22', sx(s.x), SEAM, 1, 1);
  }
  // Pins: a coloured head and a steel shaft across the seam.
  for (const p of run.pinsLeft) {
    const x = sx(p); if (x < -6 || x > W + 6) continue;
    g.strokeStyle = '#c9d2de'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + .5, SEAM - 20); g.lineTo(x + 2.5, SEAM + 16); g.stroke();
    px('#172638', x - 3, SEAM - 26, 7, 7); px('#ffd27a', x - 2, SEAM - 25, 5, 5); px('#fff6d8', x - 1, SEAM - 24, 2, 2);
  }
  for (const f of pinFx) {
    // A struck pin springs out and tumbles away.
    const x = sx(f.c) + f.t * 30, y = SEAM - 22 - 60 * f.t + 120 * f.t * f.t;
    g.save(); g.translate(x, y); g.rotate(f.t * 9); g.globalAlpha = 1 - f.t / 1.2;
    px('#c9d2de', -1, 0, 2, 18); px('#ffd27a', -3, -6, 6, 6); g.restore(); g.globalAlpha = 1;
  }
  // The end of the cloth, and its raw edge.
  if (sx(CLOTH.length) < W) for (let y = CLOTH_TOP; y < CLOTH_BOT; y += 3) px('#4a4a90', sx(CLOTH.length) + (y % 2), y, 2, 2);
}
function hop() {
  if (screen !== 'sew') return { y: 0, phase: 0, land: 0 };
  const ph = (run.t % PERIOD) / PERIOD;
  return { y: HOP * 4 * ph * (1 - ph), phase: ph, land: clamp(1 - (run.t - lastLand) / .12, 0, 1) };
}
// Rapippo's shadow on the cloth, then the thread, the needle and Rapippo.
// In the air the thread hangs slack from its foot to the last hole; on the
// landing it pulls tight (キュッ).
function drawHero() {
  const h = hop(), title = screen === 'title', feet = HERO_FEET - h.y, tip = feet + NEEDLE;
  g.globalAlpha = .35 - .2 * (h.y / HOP); g.fillStyle = '#0b0a1a'; g.beginPath(); g.ellipse(NX, SEAM + 3, 14 - 5 * (h.y / HOP), 3, 0, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
  if (run.stitches.length || screen === 'sew') {
    const hx = run.stitches.length ? sx(run.lastDrop) : NX - 30, tight = h.land > 0 || h.y < 2;
    g.strokeStyle = THREAD[run.thread]; g.lineWidth = 1; g.beginPath(); g.moveTo(hx + .5, SEAM + .5);
    if (tight) g.lineTo(NX + .5, Math.min(tip, SEAM) + .5);
    else g.quadraticCurveTo((hx + NX) / 2, SEAM + 10, NX + .5, tip - 2);
    g.stroke();
    if (h.land > .5) { g.globalAlpha = h.land; px('#fff6d8', NX - 3, SEAM - 1, 7, 1); px('#fff6d8', NX, SEAM - 4, 1, 7); g.globalAlpha = 1; }
  }
  // The needle under its spring: through the cloth on each landing.
  px('#172638', NX - 2, feet - 1, 4, NEEDLE); px('#dfe6ee', NX - 1, feet, 2, NEEDLE - 1); px('#ffffff', NX - 1, tip - 1, 1, 1);
  if (h.y < 1) px('#2c2c66', NX - 2, SEAM + 1, 4, Math.max(0, tip - SEAM)); // the part under the cloth is hidden
  drawPod(g, NX, feet, HERO_SCALE, { phase: h.phase, land: h.land, time: idleT, idle: title });
}
function drawFriends() {
  const beatPh = screen === 'sew' ? (run.t % PERIOD) / PERIOD : (idleT % PERIOD) / PERIOD;
  const bob = (k = 1) => Math.round(Math.sin(beatPh * Math.PI * 2) * k);
  // Blue floats over the cloth ahead of Rapippo; its lamp lights where the next stitch will land.
  const bx = NX + 84, by = 252 + bob(2);
  if (screen === 'sew') {
    const drop = predictDrop(run), spot = sx(drop), mendHere = ['tear', 'rip'].includes(zoneAt(drop)?.kind) && !input;
    const mk = run.dir > 0 ? nextMark(run) : null, onMark = mk !== null && Math.abs(drop - mk) < MARK_HALF;
    const lamp = [bx, by - 70];
    g.globalAlpha = mendHere || onMark ? .32 : .18; g.fillStyle = onMark ? '#ffe7a8' : '#cfe8ff';
    g.beginPath(); g.moveTo(lamp[0] - 2, lamp[1]); g.lineTo(spot - 10, SEAM - 4); g.lineTo(spot + 10, SEAM - 4); g.lineTo(lamp[0] + 2, lamp[1]); g.closePath(); g.fill();
    g.globalAlpha = mendHere || onMark ? .7 : .45; g.beginPath(); g.ellipse(spot, SEAM, onMark ? 6 : mendHere ? 12 : 8, onMark ? 4 : 5, 0, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
  }
  drawPod(g, bx, by, 2, { palette: PALETTE.blue, phase: .5, time: idleT, idle: true });
  drawCrewParts(g, 'blue', bx, by, 2, { palette: PALETTE.blue, on: true });

  // Green stands on the cloth ahead of Rapippo and pulls the two sides of a
  // tear together with its magnets; dragged when the cloth runs too fast.
  const slipAge = screen === 'sew' ? run.t - greenSlipAt : 9;
  const slip = slipAge < .9 ? Math.sin(clamp(slipAge / .9, 0, 1) * Math.PI) * 18 : 0;
  const near = clamp(1 - Math.abs(greenX - GREEN_HOLD_X) / (GREEN_REST_X - GREEN_HOLD_X), 0, 1);
  const holding = screen === 'sew' && greenHolding() && near > .97;
  // Over a weak rip green holds on with everything (it shakes); once it is strong, one relieved hop.
  const strain = holding && ripWeak() && !reduced ? Math.round(Math.sin(idleT * 40)) : 0;
  const relief = screen === 'sew' ? run.t - greenRelief : 9, reliefHop = relief < PERIOD ? Math.sin(relief / PERIOD * Math.PI) * 14 : 0;
  const walkHop = near > .02 && near < .97 ? Math.abs(Math.sin(greenX * .12)) * 10 : 0;
  const gx = greenX - slip + strain, gy = FRIEND_FEET + (GREEN_ON_CLOTH - FRIEND_FEET) * near - (holding ? reliefHop : walkHop + Math.max(0, bob(2)));
  if (holding && slip < 2) {
    // Magnet field: brackets above and below the seam, pulling the edges in.
    const pulse = .45 + .35 * Math.sin(idleT * 8);
    g.globalAlpha = pulse;
    for (let k = -2; k <= 2; k++) { const x = gx + k * 11; px('#5fe39a', x, SEAM - 13, 1, 6); px('#5fe39a', x - 1, SEAM - 8, 3, 1); px('#5fe39a', x, SEAM + 8, 1, 6); px('#5fe39a', x - 1, SEAM + 8, 3, 1); }
    g.globalAlpha = 1;
  }
  drawPod(g, gx, gy, 2, { palette: PALETTE.green, phase: holding ? 0 : beatPh, land: holding ? 1 : 0, time: idleT, idle: !holding });
  drawCrewParts(g, 'green', gx, gy, 2, { palette: PALETTE.green, form: holding ? 1 : 0, plant: holding ? (slipAge < .4 ? slipAge : 9) : null });
  if (slip > 2) { g.globalAlpha = .7; for (let k = 0; k < 4; k++) px('#c9e8d4', gx + 22 + k * 5, gy - 2 - k * 2, 2, 2); g.globalAlpha = 1; }

  // Red directs from the thread stand: it swaps the spool with its crane, and
  // holds up the arrow that says which way the cloth goes.
  const waiting = bubble && screen === 'sew' && run.t - bubble.t < 1.6;
  const swapAge = screen === 'sew' ? run.t - redSwapAt : 9, swapping = swapAge < .7;
  const signAge = redSign && screen === 'sew' ? run.t - redSign.t : 9, signing = signAge < PERIOD * 2.5 || (screen === 'sew' && run.dir < 0);
  const ry = TABLE_EDGE - (waiting ? Math.round(Math.abs(Math.sin(idleT * 14)) * 3) : 0);
  // The crane arm: to the spool when swapping, straight up with the sign when signalling.
  let to = null;
  if (swapping) to = [(STAND_X - RED_X) / -2, (SPOOL_Y + 4 - ry) / 2 - Math.sin(swapAge / .7 * Math.PI) * 4];
  else if (signing) to = [-2, -44];
  g.save(); g.translate(RED_X, ry); g.scale(-1, 1);
  drawPod(g, 0, 0, 2, { palette: PALETTE.red, phase: beatPh, time: idleT, idle: screen !== 'sew' });
  drawCrewParts(g, 'red', 0, 0, 2, { palette: PALETTE.red, form: to ? 1 : 0, to, grip: swapping ? 1 : 0 });
  g.restore();
  if (signing && !swapping) {
    // The sign at the tip of the arm: forward or back.
    const sx0 = RED_X - 8, sy0 = ry - 104, arrow = run.dir < 0 ? -1 : (redSign?.arrow ?? 1);
    px('#172638', sx0 - 1, sy0 - 1, 26, 18); px(arrow < 0 ? '#ffd27a' : '#fff0d0', sx0, sy0, 24, 16);
    g.fillStyle = '#2a1c18'; g.beginPath();
    if (arrow < 0) { g.moveTo(sx0 + 4, sy0 + 8); g.lineTo(sx0 + 13, sy0 + 2); g.lineTo(sx0 + 13, sy0 + 14); }
    else { g.moveTo(sx0 + 20, sy0 + 8); g.lineTo(sx0 + 11, sy0 + 2); g.lineTo(sx0 + 11, sy0 + 14); }
    g.closePath(); g.fill(); px('#2a1c18', arrow < 0 ? sx0 + 13 : sx0 + 5, sy0 + 7, 6, 2);
  }
  const calling = redCall && screen === 'sew' && run.t - redCall.t < 1.4;
  if (waiting || calling) speech(waiting ? 'まだ？' : redCall.text, RED_X + 18, ry - 70);
}
// The thread stand behind Rapippo: the spool red changes, and the thread running to Rapippo.
function drawStand() {
  px('#3e2c22', STAND_X - 10, TABLE_EDGE - 3, 20, 4);
  px('#8a7a66', STAND_X - 1, SPOOL_Y + 10, 3, TABLE_EDGE - SPOOL_Y - 10);
  const swapAge = screen === 'sew' ? run.t - redSwapAt : 9, lift = swapAge < .7 ? Math.sin(swapAge / .7 * Math.PI) * 8 : 0;
  const y = SPOOL_Y - lift, col = THREAD[run.thread];
  px('#c8a878', STAND_X - 8, y, 18, 3); px(col, STAND_X - 6, y + 3, 14, 12); px('#ffffff', STAND_X - 4, y + 5, 2, 8); px('#c8a878', STAND_X - 8, y + 15, 18, 3);
  // The thread from the spool to Rapippo's ear: Rapippo carries it down to the needle.
  const h = hop(), earY = HERO_FEET - h.y - 3 * 28;
  g.strokeStyle = col; g.globalAlpha = .8; g.lineWidth = 1; g.beginPath(); g.moveTo(STAND_X + 1, y + 2); g.quadraticCurveTo((STAND_X + NX) / 2, Math.min(y, earY) - 10, NX - 14, earY); g.stroke(); g.globalAlpha = 1;
}
function speech(text, x, y) {
  g.font = 'bold 11px "Hiragino Sans","Yu Gothic",sans-serif';
  const w = Math.ceil(g.measureText(text).width) + 8;
  px('#fff0d0', x, y, w, 18); px('#fff0d0', x + 14, y + 18, 4, 4);
  g.fillStyle = '#2a1c18'; g.fillText(text, x + 4, y + 13);
}
function banner(a, b) {
  g.globalAlpha = .82; px('#0c0a16', 30, 138, 300, 56); g.globalAlpha = 1;
  g.fillStyle = '#ffe3ad'; g.font = 'bold 15px "Hiragino Sans","Yu Gothic",sans-serif'; g.textAlign = 'center';
  g.fillText(a, W / 2, 162); g.fillStyle = '#cfe4ff'; g.font = '11px "Hiragino Sans","Yu Gothic",sans-serif'; g.fillText(b, W / 2, 182); g.textAlign = 'left';
}

// ---------- the reveal ----------
// The cloth comes off the machine, the four spread it out together, and blue's
// light makes the stitches shine like a constellation.
const SEAM_X = (c, a, k) => SHEET_X + (c - a) * k;
const ROWS = 4, SHEET_W = 312, SHEET_X = (W - SHEET_W) / 2, ROW_H = 46, SHEET_Y = 96;
let glowed = 0;
function drawReveal() {
  const t = endT - 2.2, beat = t / PERIOD;
  const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#070a1c'); sky.addColorStop(1, '#1d1830');
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 50; i++) { g.globalAlpha = .2 + .5 * hash(i + 40); px('#e9f0ff', hash(i) * W, hash(i + 7) * 260, 1, 1); }
  g.globalAlpha = 1;
  const per = CLOTH.length / ROWS, k = SHEET_W / per;
  // せーの: the rows unfold one per beat, from the bottom up.
  const shown = clamp(beat - 1, 0, ROWS);
  const lightOn = clamp((beat - 7) / 2, 0, 1);
  const sewnTo = Math.min(run.stitches.reduce((m, s) => Math.max(m, hi(s)), 0), CLOTH.length);
  for (let r = 0; r < ROWS; r++) {
    const unfold = ease(clamp(shown - (ROWS - 1 - r), 0, 1));
    if (unfold <= 0) continue;
    const y0 = SHEET_Y + r * ROW_H, h = ROW_H * unfold, cy = y0 + ROW_H / 2, a = r * per;
    px('#2c2c66', SHEET_X, y0 + ROW_H - h, SHEET_W, h);
    for (let x = 0; x < SHEET_W; x += 6) for (let y = y0 + ROW_H - h + 2; y < y0 + ROW_H - 2; y += 6) px('#33357a', SHEET_X + x, y, 3, 1);
    if (unfold < 1) continue;
    px('#1c1a3e', SHEET_X, y0 + ROW_H - 1, SHEET_W, 1);
    // Unsewn cloth is left plain and frayed at its end.
    for (const z of CLOTH.zones) if ((z.kind === 'tear' || z.kind === 'rip') && z.b > a && z.a < a + per) {
      for (let c = Math.max(z.a, a); c < Math.min(z.b, a + per); c += 2) if (!mendedAt(c)) px('#0b0a1a', SHEET_X + (c - a) * k, cy - 2, 2, 4);
    }
    for (const st of STARS) {
      let prev = null;
      for (const d of st.dots) {
        if (d.c < a || d.c >= a + per) { prev = null; continue; }
        const x = SHEET_X + (d.c - a) * k, y = cy + d.y * .55, lit = mendedAt(d.c);
        if (!lit) { g.globalAlpha = .3; px(THREAD[st.who], x, y, 1, 1); g.globalAlpha = 1; prev = null; continue; }
        if (prev) { g.strokeStyle = THREAD[st.who]; g.globalAlpha = .4 + .5 * lightOn; g.beginPath(); g.moveTo(prev[0], prev[1]); g.lineTo(x, y); g.stroke(); g.globalAlpha = 1; }
        px(THREAD[st.who], x - 1, y - 1, 3, 3); prev = [x, y];
      }
    }
    for (const s of run.stitches) {
      if (s.pin || hi(s) <= a || lo(s) >= a + per) continue;
      const x0 = SHEET_X + (Math.max(lo(s), a) - a) * k, x1 = SHEET_X + (Math.min(hi(s), a + per) - a) * k, y = cy + (passY(s) - SEAM) * .5;
      const col = THREAD[s.thread ?? 'plain'];
      px(col, x0 + .5, y, Math.max(1, x1 - x0 - 1), 1);
      // Blue's light: each needle hole becomes a star, one after another.
      const order = s.beat / run.beat, on = lightOn > 0 && order < (beat - 8) / 3;
      if (on && s.x >= a && s.x < a + per) {
        const hx = SHEET_X + (s.x - a) * k, tw = reduced ? 1 : .6 + .4 * Math.sin(endT * 3 + s.beat);
        g.globalAlpha = tw; px('#ffffff', hx - 1, cy - 1, 3, 3); px(col, hx - 2, cy, 5, 1); px(col, hx, cy - 2, 1, 5); g.globalAlpha = 1;
      }
    }
    // Rapippo's own constellation: every chalk mark hit, joined to the next one hit.
    if (lightOn > 0) {
      g.globalAlpha = lightOn;
      CLOTH.marks.forEach((m, i) => {
        if (m < a || m >= a + per || !run.marksHit.includes(i)) return;
        const x = SHEET_X + (m - a) * k, y = cy - 12 + (i % 3) * 3;
        const n = CLOTH.marks[i + 1];
        if (n !== undefined && n < a + per && run.marksHit.includes(i + 1)) { g.strokeStyle = GOLD; g.globalAlpha = .45 * lightOn; g.beginPath(); g.moveTo(x, y); g.lineTo(SEAM_X(n, a, k), cy - 12 + ((i + 1) % 3) * 3); g.stroke(); g.globalAlpha = lightOn; }
        px(GOLD, x - 1, y - 1, 3, 3); px('#ffffff', x, y, 1, 1);
      });
      g.globalAlpha = 1;
    }
    if (sewnTo < a + per && sewnTo > a) for (let y = y0; y < y0 + ROW_H; y += 3) px('#8a86c8', SHEET_X + (sewnTo - a) * k, y, 1, 2);
  }
  // Rising stars-sound, one note per stitch row lit.
  const lit = Math.floor(clamp((beat - 8) / 3, 0, 1) * 7);
  while (glowed < lit) glowSound(glowed++);
  if (beat < 8) glowed = 0;
  // The four hold the bottom edge; they hop together on the beat.
  const feet = SHEET_Y + ROWS * ROW_H + 58, ph = (t % PERIOD) / PERIOD, hy = beat > 1 && beat < 5 ? HOP * .6 * 4 * ph * (1 - ph) : 0;
  [['red', 60], ['hero', 140], ['blue', 220], ['green', 300]].forEach(([who, x]) => {
    const y = feet - (who === 'blue' ? 6 : 0) - hy;
    if (who === 'hero') drawPod(g, x, y, 2, { phase: ph, time: endT, idle: hy === 0 });
    else { drawPod(g, x, y, 2, { palette: PALETTE[who], phase: ph, time: endT, idle: hy === 0 }); drawCrewParts(g, who, x, y, 2, { palette: PALETTE[who], form: who === 'blue' ? lightOn : 0, on: true, pulse: who === 'blue' ? (1 - (t % PERIOD) / PERIOD) * lightOn : 0 }); }
    if (shown > 0) px('#2c2c66', x - 6, SHEET_Y + ROWS * ROW_H - 2, 12, feet - 40 - (SHEET_Y + ROWS * ROW_H) - hy);
  });
  // A few words, no score.
  if (beat > 12) {
    const s = summary(run), fade = clamp((beat - 12) / 2, 0, 1);
    g.globalAlpha = fade; g.textAlign = 'center';
    g.fillStyle = '#ffe3ad'; g.font = 'bold 15px "Hiragino Sans","Yu Gothic",sans-serif';
    g.fillText(s.unfinished ? 'ここまで縫えた' : 'できあがり', W / 2, 52);
    g.fillStyle = '#cfe4ff'; g.font = '11px "Hiragino Sans","Yu Gothic",sans-serif';
    g.fillText(`${s.stitches}針　青・緑・赤の星座が ${['blue', 'green', 'red'].filter(w => s.mend[w] > .8).length}つ`, W / 2, 72);
    g.fillStyle = GOLD; g.fillText(s.marks === s.markTotal ? `印 ${s.marks}/${s.markTotal}　ラピッポの星座が完成！` : `印 ${s.marks}/${s.markTotal}　ラピッポの星座`, W / 2, 88);
    g.fillText('押すと、もう一枚', W / 2, H - 24);
    g.textAlign = 'left'; g.globalAlpha = 1;
  }
}

reset();
requestAnimationFrame(frame);
