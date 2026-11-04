import { PERIOD, SLOW_SPEED, FAST_SPEED, INSET } from '../src/engine.mjs';
import { TARGET_RADIUS, modeInfo, relayPlatforms, layouts } from './fastslow-layouts.mjs';

// Three deliberately isolated experiments. The production terrain, seeded
// replays, STORY beat clock, storage and game modes are never modified.
const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d');
const $ = id => document.getElementById(id);
const FLOOR = 292;
const HERO_X = 108;

function fresh(selected, attempts = 1) {
  return {
    x: 75, phase: 0, hops: 0, attempts,
    relay: false, perfect: 0, targets: 0, status: 'ready',
    lastLanding: null
  };
}
let game = fresh(mode);

function fast() { return keys.size + pointers.size > 0; }
function say(value) { message = value; $('message').textContent = value; }
function activePlatforms() {
  return mode === 'relay' && game.relay
    ? [...layouts[mode], ...relayPlatforms]
    : layouts[mode];
}
function landedPlatform(x) {
  return activePlatforms().find(([a, b]) => x >= a + INSET - 1e-7 && x <= b - INSET + 1e-7);
}
function start() {
  const attempts = game.status === 'ready' ? game.attempts : game.attempts + 1;
  game = fresh(mode, attempts);
  game.status = 'playing';
  lastFrame = null;
  say(modeInfo[mode].description);
  update();
}
function selectMode(next) {
  mode = next;
  game = fresh(mode);
  keys.clear(); pointers.clear();
  $('hold').classList.remove('held');
  document.querySelectorAll('.mode').forEach(button =>
    button.setAttribute('aria-pressed', String(button.dataset.mode === mode)));
  lastFrame = null;
  say(modeInfo[mode].description);
  update();
}
function complete() {
  game.status = 'clear';
  if (mode === 'precision') saved.precision = Math.max(game.perfect, saved.precision ?? 0);
  if (mode === 'shortcut') saved.shortcut = Math.min(game.hops, saved.shortcut ?? Infinity);
  if (mode === 'relay') saved.relay = true;
  if (mode === 'precision') say('CLEAR! ' + game.perfect + ' perfect landings. Can you improve your accuracy?');
  if (mode === 'shortcut') say('CLEAR in ' + game.hops + ' hops (' + (game.hops * PERIOD).toFixed(2) + ' seconds). Try a shortcut!');
  if (mode === 'relay') say('CLEAR! You powered the bridge by landing on the antenna. Now you know its secret.');
}
function land() {
  const platform = landedPlatform(game.x);
  if (!platform) {
    game.status = 'dead';
    if (mode === 'relay' && !game.relay) say('The bridge is still dark. Try landing on the small antenna BEFORE crossing.');
    else say('Missed the platform! A different FAST/SLOW mixture may work. Press RETRY.');
    return;
  }
  game.hops++;
  game.lastLanding = game.x;
  if (mode === 'precision' && platform !== layouts.precision[0]) {
    const center = (platform[0] + platform[1]) / 2;
    const error = Math.abs(game.x - center);
    game.targets++;
    if (error <= TARGET_RADIUS) {
      game.perfect++;
      say('PERFECT! ' + Math.round(error) + 'px from the center.');
    } else say('Landed ' + Math.round(error) + 'px from the center. Aim within 12px.');
  }
  // Landing, not merely passing, activates the relay.
  if (mode === 'relay' && !game.relay && game.x >= 300 && game.x <= 332) {
    game.relay = true;
    say('RELAY ONLINE! The dark bridge just became solid.');
  }
  if (game.x >= modeInfo[mode].goal) complete();
}
function advance(dt) {
  let remaining = dt;
  while (remaining > 1e-9 && game.status === 'playing') {
    const slice = Math.min(remaining, PERIOD - game.phase);
    game.x += (fast() ? FAST_SPEED : SLOW_SPEED) * slice;
    game.phase += slice;
    remaining -= slice;
    if (game.phase >= PERIOD - 1e-9) {
      game.phase = 0;
      land();
    }
  }
}
function update() {
  $('hops').textContent = String(game.hops);
  $('attempts').textContent = String(game.attempts);
  if (mode === 'precision') {
    $('stat-label').textContent = 'PERFECT';
    $('stat-value').textContent = String(game.perfect) + '/' + String(game.targets);
  } else if (mode === 'shortcut') {
    $('stat-label').textContent = 'BEST HOPS';
    $('stat-value').textContent = saved.shortcut ?? '—';
  } else {
    $('stat-label').textContent = 'BRIDGE';
    $('stat-value').textContent = game.relay ? 'ON' : 'OFF';
  }
}
function line(x1, y1, x2, y2, color, width = 2) {
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
}
function draw() {
  const W = canvas.width, H = canvas.height;
  const camera = game.x - HERO_X;
  const sx = x => x - camera;
  const progress = Math.min(1, game.x / modeInfo[mode].goal);
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#0e1e3a'); sky.addColorStop(1, '#243753');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  // Deterministic stars, Earthrise, distant moon ridges.
  for (let i = 0; i < 70; i++) {
    const x = (i * 181 + 19) % W, y = (i * 79 + 23) % 210;
    ctx.fillStyle = i % 7 ? '#a9bedf' : '#fcf4d4';
    ctx.globalAlpha = .26 + (i % 4) * .14;
    ctx.fillRect(x, y, i % 11 === 0 ? 2 : 1, i % 11 === 0 ? 2 : 1);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#1b3b64'; ctx.beginPath();
  ctx.arc(502, 112, 61, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#79bdd2'; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = '#2b6075';
  ctx.beginPath(); ctx.ellipse(482, 95, 29, 15, .35, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(515, 131, 23, 12, -.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#465973'; ctx.beginPath();
  ctx.moveTo(0, FLOOR + 32);
  for (let i = 0; i <= 12; i++) ctx.lineTo(i * 60, FLOOR + 19 + Math.sin(i * 1.72 + camera * .003) * 8);
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
  for (const [a, b] of layouts[mode]) {
    const x = sx(a), width = b - a;
    if (x > W + 60 || x + width < -60) continue;
    ctx.fillStyle = '#596c85'; ctx.fillRect(x, FLOOR, width, 28);
    ctx.fillStyle = '#a5b8c5'; ctx.fillRect(x, FLOOR - 5, width, 6);
    ctx.fillStyle = '#30465f'; ctx.fillRect(x + 10, FLOOR + 10, Math.max(0, width - 20), 4);
  }
  if (mode === 'precision') for (const x of modeInfo.precision.centers) {
    if (sx(x) < -30 || sx(x) > W + 30) continue;
    ctx.fillStyle = '#e5c988';
    ctx.fillRect(sx(x) - 2, FLOOR - 14, 4, 10);
    ctx.beginPath(); ctx.arc(sx(x), FLOOR - 17, 4, 0, Math.PI * 2); ctx.fill();
  }
  if (mode === 'shortcut') for (let i = 1; i < layouts.shortcut.length; i++) {
    const [a, b] = layouts.shortcut[i], x = sx((a+b)/2);
    if (x < 0 || x > W) continue;
    if (i % 2 === 0) {
      ctx.fillStyle = '#efb970'; ctx.font = '12px sans-serif';
      ctx.fillText('»', x - 6, FLOOR - 17);
    }
  }
  if (mode === 'relay') {
    for (const [a, b] of relayPlatforms) {
      const x = sx(a), width = b - a;
      if (x > W + 30 || x + width < -30) continue;
      ctx.globalAlpha = game.relay ? 1 : .28;
      ctx.fillStyle = game.relay ? '#5ad3ba' : '#7899b0';
      ctx.fillRect(x, FLOOR - 5, width, 7);
      if (game.relay) {ctx.fillStyle = '#395d72'; ctx.fillRect(x, FLOOR + 2, width, 25);}
      ctx.globalAlpha = 1;
    }
    const antenna = sx(315);
    if (antenna > -50 && antenna < W + 50) {
      line(antenna, FLOOR - 6, antenna, FLOOR - 43, game.relay ? '#8cffe0' : '#e0ba72', 3);
      line(antenna - 9, FLOOR - 37, antenna, FLOOR - 49, '#e9d0a0', 2);
      line(antenna + 9, FLOOR - 37, antenna, FLOOR - 49, '#e9d0a0', 2);
      ctx.fillStyle = game.relay ? '#8cffe0' : '#e0ba72';
      ctx.beginPath(); ctx.arc(antenna, FLOOR - 49, 5, 0, Math.PI * 2); ctx.fill();
      ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('SIGNAL', antenna, FLOOR - 59); ctx.textAlign = 'left';
    }
    ctx.setLineDash([5,6]);
    line(sx(318), FLOOR - 48, sx(417), FLOOR - 34, game.relay ? '#8cffe0' : '#936e58', 2);
    ctx.setLineDash([]);
  }
  const goalX = sx(modeInfo[mode].goal);
  if (goalX > -20 && goalX < W + 30) {
    line(goalX, FLOOR - 7, goalX, FLOOR - 82, '#ffe2a5', 3);
    ctx.fillStyle = '#f8c981';
    ctx.beginPath(); ctx.moveTo(goalX+2,FLOOR-81); ctx.lineTo(goalX+38,FLOOR-69);
    ctx.lineTo(goalX+2,FLOOR-55); ctx.closePath(); ctx.fill();
  }
  // The bouncing robot is always the same size and height in every experiment.
  const airborne = game.status === 'playing' ? Math.sin(Math.PI * game.phase / PERIOD) * 78 : 0;
  const py = FLOOR - 25 - airborne;
  ctx.globalAlpha = .6;
  ctx.fillStyle = '#9adccf'; ctx.beginPath();
  ctx.ellipse(HERO_X, FLOOR-2, 19 + airborne*.08, 4, 0, 0, Math.PI*2); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#e7ddc9'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  line(HERO_X-8,py-16,HERO_X-11,py-31,'#e7ddc9',5);
  line(HERO_X+8,py-16,HERO_X+11,py-31,'#e7ddc9',5);
  ctx.fillStyle = '#eee9df'; ctx.beginPath();
  ctx.roundRect(HERO_X-19,py-23,38,42,16); ctx.fill();
  ctx.fillStyle = '#23354e'; ctx.beginPath();
  ctx.roundRect(HERO_X-14,py-15,28,22,9); ctx.fill();
  ctx.fillStyle = '#b4f3e1'; ctx.fillRect(HERO_X-7,py-8,4,9);
  ctx.fillRect(HERO_X+4,py-8,4,9);
  ctx.fillStyle = '#d6ad70'; ctx.fillRect(HERO_X-5,py+13,10,3);
  // HUD & progress bar.
  ctx.fillStyle = '#eef6ff'; ctx.font = 'bold 17px system-ui';
  ctx.fillText(modeInfo[mode].name, 17, 28);
  ctx.textAlign = 'right'; ctx.font = 'bold 14px system-ui';
  ctx.fillStyle = fast() ? '#ffd0a2' : '#a2f4d9';
  ctx.fillText(fast() ? '» FAST' : '· SLOW', W-18, 28);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#465f7b'; ctx.fillRect(18,H-17,W-36,5);
  ctx.fillStyle = '#83dcc7'; ctx.fillRect(18,H-17,(W-36)*progress,5);
  if (game.status !== 'playing') {
    ctx.fillStyle = 'rgba(9,18,34,.77)'; ctx.fillRect(0,114,W,117);
    ctx.fillStyle = '#f7edd8'; ctx.textAlign = 'center';
    ctx.font = 'bold 29px system-ui';
    ctx.fillText(game.status === 'ready' ? 'READY TO HOP?' : game.status === 'clear' ? 'COURSE CLEAR!' : 'TRY AGAIN!', W/2, 160);
    ctx.font = '14px system-ui'; ctx.fillStyle = '#b9cfe3';
    ctx.fillText(game.status === 'ready' ? 'Press START to begin' : 'Press RETRY or R to repeat', W/2, 191);
    ctx.textAlign = 'left';
  }
}

function frame(timestamp) {
  if (lastFrame !== null && game.status === 'playing' && !document.hidden) {
    // Never simulate an off-screen/large frame stall. Preserve play feel only.
    const dt = Math.max(0, Math.min(.05, (timestamp - lastFrame) / 1000));
    advance(dt);
    update();
  }
  lastFrame = timestamp;
  draw();
  requestAnimationFrame(frame);
}
document.querySelectorAll('.mode').forEach(button =>
  button.addEventListener('click', () => selectMode(button.dataset.mode)));
$('restart').addEventListener('click', start);
$('hold').addEventListener('pointerdown', e => {
  e.preventDefault();
  if (game.status !== 'playing') start();
  pointers.add(e.pointerId);
  $('hold').classList.add('held');
  try { $('hold').setPointerCapture(e.pointerId); } catch {}
});
for (const event of ['pointerup','pointercancel','lostpointercapture']) {
  $('hold').addEventListener(event, e => {
    pointers.delete(e.pointerId);
    if (!pointers.size) $('hold').classList.remove('held');
  });
}
document.addEventListener('keydown', e => {
  if (e.code === 'KeyR') { if (!e.repeat) start(); return; }
  if (e.code !== 'Space') return;
  e.preventDefault();
  if (!e.repeat) {
    if (game.status !== 'playing') start();
    keys.add('Space');
  }
});
document.addEventListener('keyup', e => {
  if (e.code === 'Space') { e.preventDefault(); keys.delete('Space'); }
});
window.addEventListener('blur', () => { keys.clear(); pointers.clear(); lastFrame=null; });
document.addEventListener('visibilitychange', () => { lastFrame = null; keys.clear(); pointers.clear(); });
say(modeInfo[mode].description);
update();
requestAnimationFrame(frame);
