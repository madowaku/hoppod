import { PERIOD, CART, HALF_TRAVEL, cartX, relativeX, newCartRun, advanceCart, PHRASES } from './trombone-cart-model.mjs';
import { drawPod } from '../src/pod.mjs';
import { createTromboneAudio } from './trombone-cart-audio.mjs';
const $ = id => document.getElementById(id), canvas = $('scene'), g = canvas.getContext('2d');
const audio = createTromboneAudio(), pointers = new Set(), keys = new Set();
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let direction = 'up', run = newCartRun(), state = 'idle', clock = performance.now() / 1000, ready = PERIOD, lastNote = null;
const held = () => pointers.size + keys.size > 0;
const name = pitch => pitch === 'low' ? '低' : '高';
function clearInput() { pointers.clear(); keys.clear(); }
function unlock() {
  audio.unlock().then(ok => { $('audio-status').textContent = ok ? '' : '音声を開始できません。音ボタンでもう一度試せます。'; });
}
function begin() {
  audio.stop(); run = newCartRun(direction); ready = PERIOD; lastNote = null;
  state = 'ready'; clock = performance.now() / 1000; unlock();
  $('outcome').textContent = '1拍の準備… ' + (direction === 'up' ? '離して左へ' : '押して右へ');
  $('start').textContent = '最初から'; $('pause').disabled = false; $('pause').textContent = '一時停止';
  update();
}
function update() {
  $('hops').textContent = `${run.hops} HOPS`;
  const x = Math.round(relativeX(run));
  $('position').textContent = `台車の中央から ${x >= 0 ? '+' : ''}${x}px`;
  $('notes').textContent = run.notes.length ? run.notes.map(name).join(' → ') : 'まだ音はありません';
  $('hold').classList.toggle('active', held());
  $('hold').textContent = held() ? 'FAST → 右へ' : '押している間 FAST →';
  canvas.dataset.state = state; canvas.dataset.hops = run.hops; canvas.dataset.relative = relativeX(run).toFixed(3);
  canvas.dataset.completed = String(run.completed); canvas.dataset.audio = audio.debug().state;
}
function advanceTo(now) {
  const dt = now - clock; clock = Math.max(clock, now);
  if (dt <= 0 || !['ready', 'playing'].includes(state)) return;
  if (dt > .5) { pause(); $('outcome').textContent = '画面の更新が止まったため一時停止しました。'; return; }
  let seconds = dt;
  if (state === 'ready') {
    const wait = Math.min(seconds, ready); ready -= wait; seconds -= wait;
    if (ready > 1e-9) return;
    state = 'playing'; $('outcome').textContent = '目標：' + PHRASES[direction].map(name).join(' → ');
  }
  for (const event of advanceCart(run, seconds, held())) {
    if (event.type === 'note') { audio.note(event.pitch); lastNote = event.pitch; }
    if (event.type === 'phrase') $('outcome').textContent = `♪ 往復できた！ ${event.cycles}回目。そのまま続けて弾けます。`;
    if (event.type === 'fall') {
      state = 'fall'; clearInput(); audio.stop(); $('pause').disabled = true;
      $('outcome').textContent = '台車から外れました。端へ寄ったら、反対の速さに切り替えてみよう。';
    }
  }
  update();
}
let pausedFrom = 'playing';
function pause() {
  if (!['ready', 'playing'].includes(state)) return;
  pausedFrom = state; state = 'paused'; clearInput(); audio.stop();
  $('pause').textContent = '再開'; $('outcome').textContent = '一時停止中。再開時はSLOWです。'; update();
}
function resume() { state = pausedFrom; clock = performance.now() / 1000; unlock(); $('pause').textContent = '一時停止'; $('outcome').textContent = '目標：' + PHRASES[direction].map(name).join(' → '); update(); }
for (const id of ['up', 'down']) $(id).addEventListener('click', () => {
  direction = id; clearInput(); audio.stop(); run = newCartRun(direction); state = 'idle'; lastNote = null;
  $('up').setAttribute('aria-pressed', String(id === 'up')); $('down').setAttribute('aria-pressed', String(id === 'down'));
  $('outcome').textContent = id === 'up' ? 'スタート後、離したままで低音へ。次は押して高音へ。' : 'スタート後、押して高音へ。次は離して低音へ。';
  $('pause').disabled = true; $('start').textContent = 'スタート'; update();
});
$('start').addEventListener('click', () => { clearInput(); begin(); });
$('pause').addEventListener('click', () => { advanceTo(performance.now() / 1000); state === 'paused' ? resume() : pause(); });
$('sound').addEventListener('click', () => { unlock(); const muted = audio.toggle(); $('sound').textContent = muted ? '音 OFF' : '音 ON'; $('sound').setAttribute('aria-pressed', String(muted)); });
for (const surface of [canvas, $('hold')]) {
  surface.addEventListener('contextmenu', e => e.preventDefault());
  surface.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.preventDefault(); advanceTo(e.timeStamp / 1000);
    if (state === 'paused') return;
    if (state === 'idle' || state === 'fall') begin();
    pointers.add(e.pointerId); surface.setPointerCapture(e.pointerId); unlock(); update();
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) surface.addEventListener(type, e => { advanceTo(e.timeStamp / 1000); pointers.delete(e.pointerId); update(); });
}
addEventListener('keydown', e => {
  if (e.code === 'Escape') { e.preventDefault(); advanceTo(e.timeStamp / 1000); state === 'paused' ? resume() : pause(); }
  if (e.code !== 'Space' || e.repeat || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  e.preventDefault(); advanceTo(e.timeStamp / 1000);
  if (state === 'paused') return;
  if (state === 'idle' || state === 'fall') begin();
  keys.add(e.code); unlock(); update();
});
addEventListener('keyup', e => { if (e.code === 'Space') { e.preventDefault(); advanceTo(e.timeStamp / 1000); keys.delete(e.code); update(); } });
addEventListener('blur', () => { pause(); clearInput(); update(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { pause(); clearInput(); update(); } });

function draw() {
  const r = relativeX(run), center = 320, floor = CART.y;
  g.fillStyle = '#0d1b2b'; g.fillRect(0, 0, 640, 460);
  g.fillStyle = '#cbd9c7'; g.beginPath(); g.arc(552, 60, 27, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#476077';
  for (let i = 0; i < 28; i++) g.fillRect((i * 139 + 17) % 640, 26 + (i * 47) % 170, 2, 2);
  // The foreground cart is fixed in camera coordinates; world rail marks move.
  g.fillStyle = '#1a2b3d'; g.fillRect(0, 437, 640, 23);
  const scroll = reduced.matches ? 0 : cartX(run.time) % 80;
  g.fillStyle = '#567084'; for (let x = -80; x < 720; x += 80) g.fillRect(x - scroll, 447, 28, 3);
  const left = center - CART.halfWidth, width = CART.halfWidth * 2;
  g.fillStyle = '#425b6e'; g.fillRect(left, floor, width, 26);
  g.fillStyle = '#7baab1'; g.fillRect(left + 8, floor, CART.halfWidth - 8, 8);
  g.fillStyle = '#cfa969'; g.fillRect(center, floor, CART.halfWidth - 8, 8);
  g.fillStyle = '#ffe9be'; g.fillRect(center - 1, floor - 16, 2, 42);
  for (let x = -120; x <= 120; x += 30) { g.fillStyle = '#dce3cf'; g.fillRect(center + x, floor + 12, 1, x % 60 ? 4 : 8); }
  for (const x of [left + 35, left + width - 35]) { g.fillStyle = '#0b1420'; g.beginPath(); g.arc(x, floor + 33, 15, 0, Math.PI * 2); g.fill(); g.fillStyle = '#7b8f9d'; g.beginPath(); g.arc(x, floor + 33, 5, 0, Math.PI * 2); g.fill(); }
  g.textAlign = 'center'; g.font = 'bold 20px system-ui';
  g.fillStyle = '#a5d8dd'; g.fillText('低い音', center - 70, floor + 64);
  g.fillStyle = '#f3ca86'; g.fillText('高い音', center + 70, floor + 64);
  const phase = run.phase / PERIOD, height = state === 'fall' ? -24 : Math.sin(Math.PI * phase) * 96;
  const hero = center + r, feet = floor - 2 - height;
  drawPod(g, hero, feet, 2, { phase, fast: held(), time: run.time, dead: state === 'fall' ? .25 : 0 });
  // Brass bell and telescoping slide follow the pod's cart-relative position.
  const slide = Math.max(10, Math.min(48, 29 - r * .15));
  g.strokeStyle = '#edc373'; g.lineWidth = 5; g.beginPath(); g.moveTo(hero + 13, feet - 23); g.lineTo(hero + 30 + slide, feet - 23); g.lineTo(hero + 30 + slide, feet - 12); g.lineTo(hero + 20, feet - 12); g.stroke();
  g.fillStyle = '#edc373'; g.beginPath(); g.moveTo(hero + 19, feet - 27); g.lineTo(hero + 19, feet - 7); g.lineTo(hero + 34, feet - 2); g.lineTo(hero + 34, feet - 32); g.closePath(); g.fill();
  g.fillStyle = '#102333'; g.font = 'bold 14px system-ui'; g.fillText('0', center, floor + 36);
  g.fillStyle = '#fff0d0'; g.font = 'bold 19px system-ui';
  g.fillText(state === 'ready' ? '1拍待って、出発' : state === 'paused' ? 'PAUSED' : '← SLOW      台車基準      FAST →', center, 238);
  if (lastNote) { g.fillStyle = lastNote === 'low' ? '#a5d8dd' : '#f3ca86'; g.fillText('♪ ' + name(lastNote), center, 185); }
}
function frame(now) { advanceTo(now / 1000); draw(); requestAnimationFrame(frame); }
update(); requestAnimationFrame(frame);
