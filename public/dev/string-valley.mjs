import { PERIOD, SLOW_SPEED, FAST_SPEED } from '../src/engine.mjs';
import { LAB, PROGRAMS, newAttempt, advanceAttempt, heroY } from './string-trajectory.mjs';

const $ = id => document.getElementById(id);
const canvas = $('scene'), ctx = canvas.getContext('2d');
const pressedKeys = new Set(), pressedPointers = new Set();
const drawX = x => 42 + (x - 60) * 2;
let run = null, demo = null, lastFrame = null, trail = [];
let audio = null;

function getAudio() {
  try {
    if (!audio) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      audio = new AudioContext();
    }
    if (audio.state === 'suspended') audio.resume().catch(() => {});
    return audio;
  } catch { return null; }
}
function pluck() {
  const context = getAudio();
  if (!context) return;
  try {
    const now = context.currentTime;
    const o = context.createOscillator();
    const g = context.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(659.25, now); // A single original E5 note
    o.frequency.exponentialRampToValueAtTime(622.25, now + .25);
    g.gain.setValueAtTime(.0001, now);
    g.gain.exponentialRampToValueAtTime(.13, now + .008);
    g.gain.exponentialRampToValueAtTime(.0001, now + .55);
    o.connect(g); g.connect(context.destination);
    o.start(now); o.stop(now + .56);
  } catch {}
}
function outcome(message) { $('outcome').textContent = message; }
function isFast() { return pressedPointers.size + pressedKeys.size > 0; }
function begin(which = null) {
  getAudio(); // Synchronously invoked from button or keyboard interaction.
  pressedKeys.clear(); pressedPointers.clear();
  $('hold').classList.remove('held');
  run = newAttempt();
  demo = which;
  trail = [{ x: run.x, y: heroY(0) }];
  lastFrame = null;
  outcome(which === 'early' ? 'WATCH: FAST for the first half, then SLOW.' :
    which === 'late' ? 'WATCH: SLOW for the first half, then FAST.' :
    'MANUAL: Try FAST early, release after roughly half a beat.');
  update();
}

function integrate(dt) {
  if (!run || run.status !== 'playing') return;
  let events = [];
  if (!demo) {
    events = advanceAttempt(run, dt, isFast());
  } else {
    // Split at 0.39 s, including when the split occurs inside a render frame.
    let remaining = dt;
    while (remaining > 1e-10 && run.status === 'playing') {
      const mid = PERIOD / 2;
      const beforeMid = run.phase < mid - 1e-10;
      const step = beforeMid ? Math.min(remaining, mid - run.phase) : remaining;
      events.push(...advanceAttempt(run, step, demo === 'early' ? beforeMid : !beforeMid));
      remaining -= step;
    }
  }
  trail.push({ x: run.x, y: heroY(run.phase) });
  if (trail.length > 240) trail.shift();
  for (const event of events) {
    if (event.type === 'note') { pluck(); outcome('♪ STRING! You struck the glowing wire mid-air. Now land on the pad.'); }
    if (event.type === 'passed') outcome('The string stayed silent: you passed underneath its glowing tip.');
    if (event.type === 'clear') outcome('♪ CLEAR! The string rang and the robot landed safely. Same destination, different path!');
    if (event.type === 'silent') outcome('SAFE LANDING, NO NOTE. Try shifting the FAST portion earlier without changing its total time.');
    if (event.type === 'fall') outcome('FELL SHORT OR LONG. Use FAST for about half of the 0.78s hop.');
  }
}
function update() {
  $('fast-seconds').textContent = (run?.fastSeconds ?? 0).toFixed(2) + 's';
  $('string-state').textContent = !run?.stringCross ? '—' : run.stringCross.touched ? '♪ HIT' : 'MISSED';
  $('landing-state').textContent = !run ? '—' :
    run.status === 'playing' ? 'IN AIR' :
    run.status === 'fall' ? 'FELL' : run.x.toFixed(1) + 'px';
  $('hold').classList.toggle('held', run?.status === 'playing' && !demo && isFast());
}

function path(early) {
  ctx.beginPath();
  for (let i = 0; i <= 80; i++) {
    const t = PERIOD * i / 80, half = PERIOD / 2;
    const x = LAB.startX + (early
      ? FAST_SPEED * Math.min(half, t) + SLOW_SPEED * Math.max(0, t-half)
      : SLOW_SPEED * Math.min(half, t) + FAST_SPEED * Math.max(0, t-half));
    if (i === 0) ctx.moveTo(drawX(x), heroY(t));
    else ctx.lineTo(drawX(x), heroY(t));
  }
  ctx.strokeStyle = early ? '#9be2d4' : '#f7c787';
  ctx.lineWidth = 2; ctx.setLineDash([5,6]); ctx.globalAlpha = .75;
  ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
}
function paint() {
  const W = canvas.width, H = canvas.height, floor = LAB.floorY;
  const sky = ctx.createLinearGradient(0,0,0,H);
  sky.addColorStop(0,'#101d34'); sky.addColorStop(1,'#2a3f59');
  ctx.fillStyle = sky; ctx.fillRect(0,0,W,H);
  for (let i=0;i<62;i++) {
    const x=(i*127+53)%W, y=(i*73+17)%216;
    ctx.fillStyle = '#c5d8e8'; ctx.globalAlpha=.3+(i%4)*.12;
    ctx.fillRect(x,y,i%13===0?2:1,i%13===0?2:1);
  }
  ctx.globalAlpha=1;
  ctx.fillStyle='#214263';ctx.beginPath();ctx.arc(510,89,48,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#91cbd8';ctx.lineWidth=3;ctx.stroke();
  ctx.fillStyle='#3b7186';ctx.beginPath();ctx.ellipse(499,86,18,12,.4,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#2b4c68';ctx.beginPath();ctx.ellipse(520,113,16,8,-.3,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#293f59'; ctx.fillRect(0,floor+25,W,H-floor-25);
  // Start platform, landing pad and visible gap.
  const pads=[[0,132],[...LAB.landingPad]];
  for(let i=0;i<pads.length;i++) {
    const [a,b]=pads[i], x=drawX(a), w=drawX(b)-x;
    ctx.fillStyle=i?'#476c74':'#6a8195';ctx.fillRect(x,floor,w,27);
    ctx.fillStyle=i?'#b7efd6':'#bdd1df';ctx.fillRect(x,floor-6,w,7);
    ctx.fillStyle='#284655';ctx.fillRect(x+10,floor+9,w-20,4);
  }
  // Hanging string with a small glowing, touch-sensitive tip.
  const stringX=drawX(LAB.stringX);
  ctx.strokeStyle='#607f99';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(stringX,42);ctx.lineTo(stringX,LAB.activeStringTop);ctx.stroke();
  ctx.lineWidth=5;ctx.lineCap='round';
  ctx.strokeStyle=run?.stringCross?.touched?'#f8e7b2':'#97f5d7';
  ctx.shadowBlur=15;ctx.shadowColor='#8ef3d9';
  ctx.beginPath();ctx.moveTo(stringX,LAB.activeStringTop);
  ctx.lineTo(stringX,LAB.activeStringBottom);ctx.stroke();ctx.shadowBlur=0;
  ctx.fillStyle='#c3eddf';ctx.font='bold 12px system-ui';ctx.textAlign='center';
  ctx.fillText('STRING', stringX,28);
  ctx.fillStyle='#d9e6f0';ctx.font='12px system-ui';
  ctx.fillText('PAD',drawX((LAB.landingPad[0]+LAB.landingPad[1])/2),floor+46);
  ctx.textAlign='left';
  // The dotted reference paths are *identical in horizontal endpoint*.
  path(true); path(false);
  // Actual path is bolder; no note is emitted by visuals alone.
  if(trail.length>1) {
    ctx.beginPath();
    for(let i=0;i<trail.length;i++) {
      if(i===0) ctx.moveTo(drawX(trail[i].x),trail[i].y);
      else ctx.lineTo(drawX(trail[i].x),trail[i].y);
    }
    ctx.strokeStyle='#ffffff';ctx.lineWidth=3;ctx.stroke();
  }
  // Robot: consistent silhouette with two antenna ears.
  const heroX=drawX(run?.x ?? LAB.startX);
  const heroCenterY=heroY(run?.phase ?? 0);
  const y=heroCenterY;
  ctx.fillStyle='rgba(151,233,211,.35)';ctx.beginPath();
  ctx.ellipse(heroX,floor-2,24,4,0,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#ebe4d6';ctx.lineCap='round';ctx.lineWidth=6;
  ctx.beginPath();ctx.moveTo(heroX-8,y-12);ctx.lineTo(heroX-11,y-27);ctx.stroke();
  ctx.beginPath();ctx.moveTo(heroX+8,y-12);ctx.lineTo(heroX+11,y-27);ctx.stroke();
  ctx.fillStyle='#f0e8db';ctx.beginPath();ctx.roundRect(heroX-18,y-20,36,40,15);ctx.fill();
  ctx.fillStyle='#1c3349';ctx.beginPath();ctx.roundRect(heroX-14,y-13,28,21,8);ctx.fill();
  ctx.fillStyle='#baf7e6';ctx.fillRect(heroX-7,y-6,4,8);ctx.fillRect(heroX+4,y-6,4,8);
  // Visible diode at exactly the sensor height used by the crossing model.
  ctx.fillStyle='#ffe8ab';ctx.beginPath();ctx.arc(heroX,y-LAB.sensorOffsetY,3,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#d0ae77';ctx.fillRect(heroX-5,y+13,10,3);
  ctx.textAlign='left';ctx.font='bold 15px system-ui';ctx.fillStyle='#f0f5ed';
  ctx.fillText('D  /  TRAJECTORY',19,23);
  ctx.fillStyle='#b9cde0';ctx.font='12px system-ui';
  ctx.fillText('0.78s per hop · same landing, different sound',19,347);
  ctx.fillStyle='#365d75';ctx.fillRect(19,356,W-38,5);
  ctx.fillStyle='#9fe5d0';ctx.fillRect(19,356,(W-38)*(run?.phase??0)/PERIOD,5);
  if(!run || run.status!=='playing') {
    ctx.fillStyle='rgba(12,22,41,.60)';ctx.fillRect(0,102,W,66);
    ctx.textAlign='center';ctx.font='bold 24px system-ui';ctx.fillStyle='#f9f1e0';
    ctx.fillText(!run?'READY':run.status==='clear'?'♪ STRING CLEAR':
      run.status==='silent'?'SILENT LANDING':'FALL',W/2,145);
    ctx.textAlign='left';
  }
}
function frame(timestamp) {
  if(lastFrame!==null && run?.status==='playing' && !document.hidden) {
    const dt=Math.max(0,Math.min(.05,(timestamp-lastFrame)/1000));
    integrate(dt);
    update();
  }
  lastFrame=timestamp;
  paint();
  requestAnimationFrame(frame);
}

$('start').addEventListener('click',()=>begin());
$('demo-early').addEventListener('click',()=>begin('early'));
$('demo-late').addEventListener('click',()=>begin('late'));
$('hold').addEventListener('pointerdown',e=>{
  if(demo || !run || run.status!=='playing') begin();
  e.preventDefault();
  pressedPointers.add(e.pointerId);
  try{$('hold').setPointerCapture(e.pointerId);}catch{}
  update();
});
for(const event of ['pointerup','pointercancel','lostpointercapture']) {
  $('hold').addEventListener(event,e=>{pressedPointers.delete(e.pointerId);update();});
}
document.addEventListener('keydown',e=>{
  if(e.code==='KeyR' && !e.repeat){begin();return;}
  if(e.code!=='Space')return;
  e.preventDefault();
  if(!e.repeat) {
    if(demo || !run || run.status!=='playing')begin();
    pressedKeys.add('Space');update();
  }
});
document.addEventListener('keyup',e=>{if(e.code==='Space'){e.preventDefault();pressedKeys.delete('Space');update();}});
window.addEventListener('blur',()=>{pressedKeys.clear();pressedPointers.clear();lastFrame=null;update();});
document.addEventListener('visibilitychange',()=>{pressedKeys.clear();pressedPointers.clear();lastFrame=null;update();});
update();
requestAnimationFrame(frame);
