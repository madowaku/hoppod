import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {COURSE} from '../../public/src/story/course.mjs';
import {storyFrom} from '../../public/src/story/sim.mjs';
import {BEAT} from '../../public/src/story/beat.mjs';
import {ENDING} from '../../public/src/story/music.mjs';
import {solve,hop} from '../helpers/story-solver.mjs';
// Real AudioContext and real time (no Playwright clock). Skips if the
// browser cannot run audio, unless STORY_AUDIO=required (CI and
// `npm run test:story-audio`), where a silent browser is a failure.
const required=process.env.STORY_AUDIO==='required';
const dir='output/playwright/story-audio';
async function open(page,cp) {
  await mkdir(dir,{recursive:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.addInitScript(()=>{globalThis.__rapippoStoryProbe={};});
  await page.goto('/story.html?lang=en&cp='+cp);
  await page.locator('#action').click();
  await page.waitForTimeout(600);
  const r=await read(page);
  if(required) expect(r.domain,'real audio required').toBe('audio');
  else test.skip(r.domain!=='audio','AudioContext not running in this browser');
  return errors;
}
const read=page=>page.evaluate(()=>globalThis.__rapippoStoryProbe.read());
const data=page=>page.evaluate(()=>({notes:globalThis.__rapippoStoryProbe.notes||[],events:globalThis.__rapippoStoryProbe.events||[]}));
// In-page driver: hold FAST for the first path[i] of hop i. Edges are sent
// by timers aimed at their exact story time (not on the next frame), so slow
// CI frames do not shift them; the event's own timestamp is what the game uses.
// A release and the next press at the same instant cancel out (FAST stays
// held): sent as two edges, the press would wait a frame and land short.
async function drive(page,path) {
  await page.evaluate(path=>{
    let down=false,pending=null;const key=on=>{if(on!==down){down=on;window.dispatchEvent(new KeyboardEvent(on?'keydown':'keyup',{code:'Space',bubbles:true}));}};
    const edges=[];path.forEach((f,i)=>{if(f<=0)return;const t=i*.78;
      if(edges.length&&!edges.at(-1)[1]&&Math.abs(edges.at(-1)[0]-t)<1e-9)edges.pop();else edges.push([t,true]);
      edges.push([(i+f)*.78,false]);});
    const tick=()=>{const r=globalThis.__rapippoStoryProbe.read();
      while(edges.length&&edges[0][0]<=r.s){key(edges.shift()[1]);}
      if(edges.length&&!pending&&edges[0][0]-r.s<.12){const [t,on]=edges[0];pending=setTimeout(()=>{pending=null;const now=globalThis.__rapippoStoryProbe.read().s;if(edges[0]&&edges[0][0]===t&&now>=t-.004){edges.shift();key(on);}},Math.max(0,(t-r.s)*1000));}
      if(r.status!=='docked')requestAnimationFrame(tick);};
    requestAnimationFrame(tick);
  },path);
}
const near=(a,b,eps=1e-6)=>Math.abs(a-b)<eps;
function checkBeatLock(notes,events) {
  // Every note sits on the sixteenth grid and is scheduled at s + offset.
  const offsets=notes.filter(n=>!n.part.startsWith('late:')).map(n=>n.at-n.s);
  expect(Math.max(...offsets)-Math.min(...offsets)).toBeLessThan(1e-6);
  for(const n of notes.filter(n=>!n.part.includes(':'))) expect(near(n.s/(BEAT/4),Math.round(n.s/(BEAT/4)))).toBe(true);
  // Each touchdown is a tick on exactly that beat.
  const ticks=new Set(notes.filter(n=>n.part==='tick').map(n=>Math.round(n.s/BEAT*4)));
  for(const e of events.filter(e=>e.type==='land')) { expect(near(e.t,e.beat*BEAT)).toBe(true); expect(ticks.has(e.beat*4),'tick at beat '+e.beat).toBe(true); }
  return offsets[0];
}

test('real audio: blue parts, predicted pickup cues, bell enters, pause/resume/mute',async({page})=>{
  test.setTimeout(120000);
  const start=storyFrom(COURSE,1);hop(start,COURSE,0);
  const {path}=solve(COURSE,start,{until:r=>r.parts.got===3&&r.beat-Math.round(r.parts.assembledAt/BEAT)>=10,order:[0,1,.5,.25,.75],robust:.08});
  const errors=await open(page,1);await drive(page,[0,...path]);
  // A fall here is the driver missing a hold, not the game: say so when it fails.
  await expect.poll(async()=>{const r=await read(page),{events}=await data(page);return r.blue==='follow'?'follow':`${r.blue}; falls at beats ${events.filter(e=>e.type==='fall').map(e=>e.beat)}`;},{timeout:40000}).toBe('follow');
  await page.waitForTimeout(6000);
  const r=await read(page),{notes,events}=await data(page);
  const offset=checkBeatLock(notes,events);
  const collects=events.filter(e=>e.type==='collect'),assemble=events.find(e=>e.type==='assemble');
  expect(collects.length).toBeGreaterThanOrEqual(2);
  for(const e of [...collects,assemble]) expect(notes.some(n=>n.part==='cue:'+e.type&&near(n.s,e.t)),'predicted '+e.type).toBe(true);
  const late=notes.filter(n=>n.part.startsWith('late:'));
  const bells=notes.filter(n=>n.part==='bell');
  // The song's first bar starts on the assembly touchdown; the melody breathes, so fewer notes.
  expect(bells.length).toBeGreaterThan(4);expect(Math.min(...bells.map(n=>n.s))).toBeCloseTo(assemble.t,6);
  // Pause freezes story time and schedules nothing new.
  await page.keyboard.press('Escape');await page.waitForTimeout(150);
  const paused=await read(page),count=(await data(page)).notes.length;
  await page.waitForTimeout(1500);
  const still=await read(page);expect(still.s).toBe(paused.s);expect((await data(page)).notes.length).toBe(count);
  expect(still.audio.state).toBe('running');
  // Resume continues on the same grid; mute zeroes the master but the beat runs on.
  await page.locator('#action').click();await page.waitForTimeout(1500);
  const resumed=await read(page);expect(resumed.s).toBeGreaterThan(paused.s+1);
  await page.locator('#sound').click();await page.waitForTimeout(600);
  const muted=await read(page);expect(muted.audio.master).toBeLessThan(.01);expect(muted.s).toBeGreaterThan(resumed.s+.4);
  const after=(await data(page)).notes;expect(after.length).toBeGreaterThan(count);
  const tail=after.slice(count).filter(n=>!n.part.includes(':'));
  for(const n of tail) expect(near(n.s/(BEAT/4),Math.round(n.s/(BEAT/4)))).toBe(true);
  await writeFile(dir+'/blue.json',JSON.stringify({offset,latency:r.latency,audio:r.audio,hasOutputTimestamp:r.hasOutputTimestamp,
    notes:notes.length,bells:bells.length,predictedCues:notes.filter(n=>n.part.startsWith('cue:')).map(n=>n.part),lateCues:late.map(n=>n.part)},null,2));
  expect(late.filter(n=>n.part!=='late:respawn')).toEqual([]);
  expect(errors).toEqual([]);
});

test('real audio: green bass follows, a predicted fall silences that beat, respawn ticks',async({page})=>{
  test.setTimeout(60000);
  const errors=await open(page,3);
  await expect.poll(async()=>(await data(page)).events.filter(e=>e.type==='respawn').length,{timeout:30000}).toBeGreaterThan(0);
  await page.waitForTimeout(3000);
  const r=await read(page),{notes,events}=await data(page);
  checkBeatLock(notes,events);
  expect(notes.filter(n=>n.part==='bass').length).toBeGreaterThan(2);
  const fall=events.find(e=>e.type==='fall'),respawn=events.find(e=>e.type==='respawn');
  const ticks=new Set(notes.filter(n=>n.part==='tick').map(n=>Math.round(n.s/BEAT)));
  expect(ticks.has(fall.beat),'no tick where the hero falls').toBe(false);
  expect(ticks.has(respawn.beat),'tick on the respawn touchdown').toBe(true);
  expect(notes.some(n=>n.part==='cue:fall'&&near(n.s,fall.t))).toBe(true);
  await writeFile(dir+'/green.json',JSON.stringify({latency:r.latency,audio:r.audio,fallBeat:fall.beat,respawnBeat:respawn.beat,bass:notes.filter(n=>n.part==='bass').length,
    lateCues:notes.filter(n=>n.part.startsWith('late:')).map(n=>n.part)},null,2));
  expect(errors).toEqual([]);
});

test('real audio: at the base all three friends play',async({page})=>{
  test.setTimeout(40000);
  const errors=await open(page,COURSE.checkpoints.findIndex(cp=>cp.chapter==='base'));
  await page.waitForTimeout(8000);
  const {notes,events}=await data(page);
  checkBeatLock(notes,events);
  for(const part of ['bell','bass','perc','tick']) expect(notes.filter(n=>n.part===part).length,part).toBeGreaterThan(2);
  expect(errors).toEqual([]);
});

test('real audio: red fetches green and their parts come back clearer with every hop',async({page})=>{
  test.setTimeout(90000);
  const i=COURSE.checkpoints.findIndex(cp=>cp.chapter==='rescue'&&cp.x<COURSE.crane.a&&cp.x>COURSE.redConsole);
  // The page starts driving after ~0.6s, so the first hop is a plain SLOW one.
  const start=storyFrom(COURSE,i);hop(start,COURSE,0);
  const {path}=solve(COURSE,start,{until:r=>r.together&&r.beat>=0,order:[.25,0,.5,.75,1],robust:.08});
  const after=solve(COURSE,(()=>{const r=storyFrom(COURSE,i);for(const f of [0,...path])hop(r,COURSE,f);return r;})(),{until:r=>r.beat>=start.beat+path.length+12,order:[.25,0,.5,.75,1],robust:.08}).path;
  const errors=await open(page,i);await drive(page,[0,...path,...after]);
  const samples=[];
  for(let k=0;k<160;k++){const r=await read(page);samples.push({s:r.s,red:r.red,levels:r.audio.levels,clarity:r.audio.clarity});if(r.red==='follow'&&samples.filter(x=>x.red==='follow').length>6)break;await page.waitForTimeout(250);}
  const {notes,events}=await data(page);
  expect(events.filter(e=>!['land','checkpoint'].includes(e.type)).map(e=>e.type+'@'+e.beat).filter(t=>t.startsWith('fall'))).toEqual([]);
  checkBeatLock(notes,events);
  const at=state=>samples.filter(x=>x.red===state);
  // Red flies off alone: its percussion fades to nothing.
  expect(Math.min(...at('rescue').map(x=>x.levels.perc))).toBeLessThan(.1);
  // From the pickup both parts return as a faint radio and grow clearer.
  const carry=at('carry');expect(carry.length).toBeGreaterThan(4);
  expect(Math.min(...carry.slice(2).map(x=>x.levels.bass))).toBeGreaterThan(.2);
  const third=Math.floor(carry.length/3);
  expect(carry[2*third].levels.bass).toBeGreaterThan(carry[1].levels.bass+.05);
  expect(carry.at(-1).levels.bass).toBeGreaterThan(carry[2*third].levels.bass);
  expect(carry.at(-1).clarity.bass).toBeGreaterThan(carry[2*third].clarity.bass);
  const together=at('follow').at(-1);expect(together.levels.bass).toBeGreaterThan(.8);expect(together.levels.perc).toBeGreaterThan(.8);expect(together.clarity.bass).toBeGreaterThan(8000);
  for(const type of ['notice','rescue','pickup','reunion']) {
    const e=events.find(e=>e.type===type);expect(e,type).toBeTruthy();
    // The reunion's time depends on the hero's speed; a key change inside the
    // lookahead window after it was scheduled moves it a few ms (inaudible).
    const eps=type==='reunion'?.03:1e-6;
    expect(notes.some(n=>n.part==='cue:'+type&&near(n.s,e.t,eps))||notes.some(n=>n.part==='late:'+type),'cue '+type+' at '+e.t+'; cued at '+notes.filter(n=>n.part==='cue:'+type).map(n=>n.s)).toBe(true);
  }
  const late=notes.filter(n=>n.part.startsWith('late:')).map(n=>n.part);
  await writeFile(dir+'/rescue.json',JSON.stringify({samples:samples.map(x=>({s:+x.s.toFixed(2),red:x.red,bass:+x.levels.bass.toFixed(3),perc:+x.levels.perc.toFixed(3),bassHz:Math.round(x.clarity.bass)})),late},null,2));
  expect(late).toEqual([]);
  expect(errors).toEqual([]);
});

test('real audio: ending hands the beat from the hero to the friends',async({page})=>{
  test.setTimeout(60000);
  const errors=await open(page,'end');
  await page.waitForTimeout(12*780);
  const {notes}=await data(page);const r=await read(page);
  const first=part=>Math.min(...notes.filter(n=>n.part===part).map(n=>Math.round(n.s/BEAT)));
  expect(notes.filter(n=>n.part==='tick').length).toBe(0);
  expect(first('bell')).toBe(r.dockAt+ENDING.bell);expect(first('bass')).toBe(r.dockAt+ENDING.bass);expect(first('perc')).toBe(r.dockAt+ENDING.perc);
  // D+1 carries the low hand-off bell under the arpeggio.
  expect(notes.filter(n=>n.part==='bell'&&Math.round(n.s/BEAT*4)===(r.dockAt+1)*4).length).toBe(2);
  expect(errors).toEqual([]);
});

test('offline render: the launch rumble lasts its full length; the mix never clips',async({page})=>{
  await page.goto('/story.html?lang=en');
  const m=await page.evaluate(async()=>{
    const {createStoryAudio,notesAt,STEP}=await import('/src/story/music.mjs');
    const Native=window.AudioContext;
    window.AudioContext=class extends OfflineAudioContext{constructor(){super(1,48000*9,48000);}get state(){return 'running';}resume(){return Promise.resolve();}};
    try{
      const audio=createStoryAudio();audio.unlock();const ctx=audio.context;
      audio.mix({tick:.9,bell:.85,bass:.9,perc:.9,sparkle:.7},0,{bass:1,perc:1});
      const song={dockBeat:null,parts:new Set(['bell','bass','perc','sparkle']),tick:()=>true};
      for(let n=0;n<Math.floor(8/STEP);n++)for(const note of notesAt(n,song))audio.note(note,.05+n*STEP);
      audio.rumble(.5,7);
      const data=(await ctx.startRendering()).getChannelData(0);
      const rms=(a,b)=>{let e=0;for(let i=a*48000;i<b*48000;i++)e+=data[i]**2;return Math.sqrt(e/((b-a)*48000));};
      let peak=0,nan=0;for(const v of data){if(Number.isNaN(v))nan++;peak=Math.max(peak,Math.abs(v));}
      // Rumble alone, to see it survive past the 0.5s noise buffer.
      window.AudioContext=class extends OfflineAudioContext{constructor(){super(1,48000*8,48000);}get state(){return 'running';}resume(){return Promise.resolve();}};
      const solo=createStoryAudio();solo.unlock();solo.rumble(.2,7);
      const r=(await solo.context.startRendering()).getChannelData(0);
      const win=(a,b)=>{let e=0;for(let i=a*48000;i<b*48000;i++)e+=r[i]**2;return Math.sqrt(e/((b-a)*48000));};
      return {peak,nan,full:rms(1,8),rumbleEarly:win(.4,1),rumbleLate:win(5,6.5)};
    }finally{window.AudioContext=Native;}
  });
  await mkdir(dir,{recursive:true});await writeFile(dir+'/offline.json',JSON.stringify(m,null,2));
  expect(m.nan).toBe(0);expect(m.peak).toBeGreaterThan(.01);expect(m.peak).toBeLessThan(.9);
  expect(m.rumbleLate).toBeGreaterThan(m.rumbleEarly*.1);
});
