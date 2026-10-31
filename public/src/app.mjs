import { PERIOD, SLOW_SPEED, FAST_SPEED, Terrain, hashSeed, newRun, advance, isSafe, predictLanding } from './engine.mjs';

const get = id => document.getElementById(id);
const canvas = get('play'), ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height, FLOOR = 370, HERO_X = 80;
const pointerIds = new Set(), keys = new Set();
let state, terrain, running = false, paused = false, lastTime = null;
let mode = 'daily', seed = 1, date = '', best = 0;
let frameFlash = 0;

function jstDate() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const p = type => parts.find(part => part.type === type).value;
  return p('year') + '-' + p('month') + '-' + p('day');
}
function applyUrl() {
  const params = new URLSearchParams(location.search);
  mode = params.get('mode') === 'free' ? 'free' : 'daily';
  date = /^\d{4}-\d{2}-\d{2}$/.test(params.get('date') || '') ? params.get('date') : jstDate();
  const raw = Number(params.get('seed'));
  seed = mode === 'daily' ? hashSeed('HOPPOD-' + date) : (Number.isInteger(raw) && raw >= 0 && raw <= 4294967295 ? raw >>> 0 : randomSeed());
  const url = new URL(location.href);
  url.searchParams.set('mode', mode);
  if (mode === 'daily') { url.searchParams.set('date', date); url.searchParams.delete('seed'); }
  else { url.searchParams.set('seed', String(seed)); url.searchParams.delete('date'); }
  history.replaceState(null, '', url);
  get('mode-name').textContent = mode === 'daily' ? 'DAILY MOON ' + date : 'FREE RUN';
  get('daily').classList.toggle('selected', mode === 'daily');
  get('free').classList.toggle('selected', mode === 'free');
  readBest();
}
function randomSeed() {
  const values = new Uint32Array(1);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(values);
  else values[0] = Date.now() >>> 0;
  return values[0];
}
function bestKey() { return 'hoppod.best.v1.' + (mode === 'daily' ? date : 'free'); }
function readBest() {
  try { best = Math.max(0, Number(localStorage.getItem(bestKey())) || 0); } catch { best = 0; }
  get('best').textContent = String(best);
}
function saveBest() {
  if (state.hops <= best) return false;
  best = state.hops;
  try { localStorage.setItem(bestKey(), String(best)); } catch {}
  get('best').textContent = String(best);
  return true;
}
function releaseInput() { pointerIds.clear(); keys.clear(); get('hold').classList.remove('active'); }
function fast() { return pointerIds.size + keys.size > 0; }
function setOverlay(title, subtitle, button) {
  get('overlay-title').textContent = title;
  get('overlay-subtitle').textContent = subtitle;
  get('action').textContent = button;
  get('overlay').hidden = false;
}
function reset() {
  releaseInput();
  terrain = new Terrain(seed);
  state = newRun();
  lastTime = null;
  paused = false;
  running = true;
  frameFlash = 0;
  get('overlay').hidden = true;
  updateHud();
}
function updateHud() {
  get('score').textContent = String(state.hops);
  get('beacons').textContent = String(state.beacons);
  get('hold').textContent = fast() ? 'FAST · RELEASE TO BRAKE' : 'HOLD = FAST';
  get('hold').classList.toggle('active', fast());
}
function endRun() {
  running = false;
  releaseInput();
  const record = saveBest();
  setOverlay(record ? 'NEW BEST!  ' + state.hops : state.hops + ' HOPS', 'SIGNAL LOST · ' + state.beacons + ' BEACONS', 'TRY AGAIN');
  get('share-actions').hidden = false;
  get('save').hidden = false;
}
function pause() {
  releaseInput();
  if (!running || paused) return;
  paused = true;
  lastTime = null;
  setOverlay('PAUSED', 'Tap to resume with SLOW.', 'RESUME');
}
function changeMode(next) {
  releaseInput();
  mode = next;
  const url = new URL(location.href);
  url.search = next === 'daily' ? '?mode=daily&date=' + jstDate() : '?mode=free&seed=' + randomSeed();
  history.replaceState(null, '', url);
  applyUrl();
  terrain = new Terrain(seed);
  state = newRun();
  paused = false;
  running = false;
  get('share-actions').hidden = true;
  setOverlay('HOPPOD', 'HOLD TO SPEED UP · RELEASE TO SLOW DOWN', 'START');
  updateHud();
}
get('action').addEventListener('click', () => {
  if (paused) { paused = false; releaseInput(); lastTime = null; get('overlay').hidden = true; }
  else reset();
});
get('daily').addEventListener('click', () => changeMode('daily'));
get('free').addEventListener('click', () => changeMode('free'));
for (const target of [canvas, get('hold')]) {
  target.addEventListener('pointerdown', e => {
    if (!running || paused) return;
    e.preventDefault(); pointerIds.add(e.pointerId);
    target.setPointerCapture(e.pointerId);
  });
  target.addEventListener('lostpointercapture', e => pointerIds.delete(e.pointerId));
}
window.addEventListener('pointerup', e => pointerIds.delete(e.pointerId));
window.addEventListener('pointercancel', releaseInput);
window.addEventListener('keydown', e => {
  if (e.code === 'Space') { e.preventDefault(); if (!e.repeat && running && !paused) keys.add('Space'); }
  if (e.code === 'KeyR' && !e.repeat) reset();
});
window.addEventListener('keyup', e => { if (e.code === 'Space') keys.delete('Space'); });
window.addEventListener('blur', pause);
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('pagehide', pause);

function shareText() { return 'HOPPOD 🚀 ' + state.hops + ' HOPS! How far can you bounce? #HOPPOD'; }
get('share').addEventListener('click', () => {
  const link = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(shareText()) + '&url=' + encodeURIComponent(location.href);
  window.open(link, '_blank', 'noopener,noreferrer');
});
get('save').addEventListener('click', () => {
  const c = document.createElement('canvas');
  c.width = 1080; c.height = 1350;
  const g = c.getContext('2d');
  const gradient = g.createLinearGradient(0,0,0,1350);
  gradient.addColorStop(0, '#101d37'); gradient.addColorStop(1, '#3b325a');
  g.fillStyle = gradient; g.fillRect(0,0,1080,1350);
  g.fillStyle = '#d5dfff'; g.font = 'bold 92px monospace'; g.textAlign = 'center';
  g.fillText('HOPPOD', 540, 210);
  g.fillStyle = '#ffe19a'; g.font = 'bold 196px monospace'; g.fillText(String(state.hops), 540, 530);
  g.font = '48px monospace'; g.fillText('HOPS', 540, 620);
  drawPod(g, 540, 920, 7, false, 0);
  g.fillStyle = '#e3e7f3'; g.font = '42px monospace';
  g.fillText(mode === 'daily' ? 'DAILY ' + date : 'FREE RUN', 540, 1160);
  g.font = '30px monospace'; g.fillText('#HOPPOD', 540, 1230);
  const link = document.createElement('a');
  link.href = c.toDataURL('image/png'); link.download = 'HOPPOD-' + state.hops + '-hops.png';
  link.click();
});
function drawPod(g, x, y, s, falling, phase) {
  g.save();
  g.translate(Math.round(x), Math.round(y));
  g.rotate(falling ? 0.55 : 0);
  g.scale(s, s);
  const rect = (color,x,y,w,h) => { g.fillStyle=color; g.fillRect(x,y,w,h); };
  const outline='#23314d', shell='#fff2d8', orange='#ff9871', dark='#27314a', gold='#ffe286';
  // Two angular ear antennas; body is a capsule with a spring below.
  rect(outline,-9,-27,6,17); rect(outline,5,-27,6,17);
  rect(shell,-8,-26,4,14); rect(shell,6,-26,4,14);
  rect(orange,-7,-24,2,10); rect(orange,7,-24,2,10);
  rect(outline,-15,-13,30,29); rect(shell,-13,-11,26,23);
  rect(orange,-13,5,26,8); rect(dark,-9,-7,18,16);
  rect(gold,-5,-3,3,9); rect(gold,3,-3,3,9);
  rect(outline,-7,16,14,3); rect(shell,-5,19,10,2);
  rect(outline,-7,21,14,2); rect(shell,-5,23,10,2);
  if (phase > 0.45 && !falling) rect('#fff8ec',-12,13,24,3);
  g.restore();
}
function draw() {
  ctx.fillStyle = '#101b32'; ctx.fillRect(0,0,W,H);
  const offset = state.x - HERO_X;
  ctx.fillStyle = '#ebe4cb'; ctx.beginPath(); ctx.arc(283,72,34,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = '#bfc4d4'; ctx.beginPath(); ctx.arc(274,65,8,0,Math.PI*2); ctx.fill();
  for (let i=0;i<44;i++) {
    const px=(i*97 - offset*.12) % (W+30), py=25+(i*37)%205;
    ctx.fillStyle='#7687b8';ctx.fillRect(((px+W+30)%(W+30))|0, py, i%7===0?3:2,2);
  }
  ctx.fillStyle='#273450';
  for(let x=0;x<W+40;x+=28) {
    const h=12+(Math.sin((x+offset*.05)*.035)+1)*10;
    ctx.fillRect(x,H-110-h,30,110+h);
  }
  ctx.fillStyle='#a1a7c8';ctx.font='bold 12px monospace';
  ctx.fillText(fast()?'FAST':'SLOW',16,28);
  const groundY=FLOOR;
  const screen = x => Math.round(x - offset);
  for(const [a,b] of terrain.platforms) {
    const sx=screen(a), ex=screen(b);
    if(ex < -15 || sx > W+15) continue;
    ctx.fillStyle='#52627f';ctx.fillRect(sx,groundY,ex-sx,H-groundY);
    ctx.fillStyle='#d4d4e2';ctx.fillRect(sx,groundY,ex-sx,7);
    ctx.fillStyle='#8193b3';
    for(let tx=sx;tx<ex;tx+=18)ctx.fillRect(tx,groundY+17,2,8);
  }
  for(const item of terrain.beacons) {
    if(item.taken)continue;
    const sx=screen(item.x);
    if(sx<-15||sx>W+15)continue;
    ctx.fillStyle='#ffdc88';ctx.fillRect(sx-6,groundY-32,12,12);
    ctx.fillStyle='#fff7da';ctx.fillRect(sx-2,groundY-28,4,4);
  }
  const landing=screen(predictLanding(state,fast()));
  ctx.strokeStyle=isSafe(terrain,predictLanding(state,fast()))?'#7df6d4':'#ff8e9e';
  ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(landing,groundY-8,13,4,0,0,Math.PI*2);ctx.stroke();
  ctx.setLineDash([3,6]);ctx.beginPath();ctx.moveTo(HERO_X,groundY-22);ctx.lineTo(landing,groundY-22);ctx.stroke();ctx.setLineDash([]);
  const height = state.status==='dead'?15:Math.sin(state.phase/PERIOD*Math.PI)*96;
  drawPod(ctx,HERO_X,groundY-29-height,2,state.status==='dead',state.phase/PERIOD);
  if(frameFlash>0){ ctx.fillStyle='rgba(255,225,150,0.10)';ctx.fillRect(0,0,W,H);frameFlash--; }
}
function frame(now) {
  if(running && !paused && lastTime !== null) {
    const events=advance(state,terrain,Math.min(0.05,Math.max(0,(now-lastTime)/1000)),fast());
    if(events.includes('beacon'))frameFlash=4;
    if(state.status==='dead')endRun();
  }
  lastTime = now; updateHud(); draw();
  requestAnimationFrame(frame);
}
applyUrl();
terrain=new Terrain(seed);state=newRun();
get('share-actions').hidden=true;
setOverlay('HOPPOD', 'HOLD TO SPEED UP · RELEASE TO SLOW DOWN', 'START');
updateHud();
requestAnimationFrame(frame);
