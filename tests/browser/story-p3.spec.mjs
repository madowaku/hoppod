import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {COURSE} from '../../public/src/story/course.mjs';
import {storyFrom} from '../../public/src/story/sim.mjs';
import {ENDING} from '../../public/src/story/music.mjs';
import {solve} from '../helpers/story-solver.mjs';
const dir='output/playwright/story-p3';
async function open(page,cp) {
  await mkdir(dir,{recursive:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{delete window.AudioContext;delete window.webkitAudioContext;globalThis.__rapippoStoryProbe={};});
  await page.clock.install({time:new Date('2026-11-02T03:00:00Z')});
  await page.goto('/story.html?lang=en&cp='+cp);
  await page.clock.pauseAt(new Date('2026-11-02T03:00:01Z'));
  await page.locator('#action').click();
  return errors;
}
const read=page=>page.evaluate(()=>globalThis.__rapippoStoryProbe.read());
// onMid runs half-way through each hop (FAST may still be held), onHop at its end.
async function play(page,path,onHop,onMid=async()=>{}) {
  for(const [i,f] of path.entries()) {
    const hold=Math.round(f*780);
    if(hold>0)await page.keyboard.down('Space');
    if(hold>0&&hold<390){await page.clock.runFor(hold);await page.keyboard.up('Space');await page.clock.runFor(390-hold);}
    else await page.clock.runFor(390);
    await onMid(await read(page),i);
    if(hold>390){await page.clock.runFor(hold-390);await page.keyboard.up('Space');await page.clock.runFor(780-hold);}
    else if(hold===390){await page.keyboard.up('Space');await page.clock.runFor(390);}
    else await page.clock.runFor(390);
    await onHop(await read(page),i);
  }
}
const shot=(page,name)=>page.locator('#play').screenshot({path:`${dir}/${name}.png`});
const rescueCp=COURSE.checkpoints.findIndex(cp=>cp.chapter==='rescue'&&cp.x<COURSE.crane.a&&cp.x>COURSE.redConsole);

test('P3 red: looks back, leaves on its own, is seen fetching green, and the music returns with them',async({page})=>{
  test.setTimeout(120000);
  const start=storyFrom(COURSE,rescueCp);
  const {path,end}=solve(COURSE,start,{until:r=>r.together&&r.beat>=0,order:[.25,0,.5,.75,1]});
  expect(end).toBeTruthy();
  const errors=await open(page,rescueCp);const seen={},log=[];
  const look=async r=>{
    log.push(r);
    const key=r.red==='notice'?'red-1-notice':r.red==='rescue'&&!seen['red-2-leaves']?'red-2-leaves':r.red==='rescue'&&r.inset>.9?'red-3-window':r.red==='carry'&&r.inset>.9?'red-4-pickup':r.red==='carry'&&r.inset<.1?'red-5-coming':null;
    if(key&&!seen[key]){seen[key]=true;await shot(page,key);}
  };
  await play(page,path,async()=>{},look);
  await page.clock.runFor(300);await shot(page,'red-6-reunion');
  for(const k of ['red-1-notice','red-2-leaves','red-3-window','red-4-pickup','red-5-coming']) expect(seen[k],k).toBe(true);
  // Red waits exactly one beat at the crane before leaving.
  const events=await page.evaluate(()=>globalThis.__rapippoStoryProbe.events);
  const beatOf=type=>events.find(e=>e.type===type).beat;
  expect(beatOf('rescue')-beatOf('notice')).toBe(1);
  expect(beatOf('pickup')).toBeLessThan(beatOf('reunion'));
  expect((await read(page)).red).toBe('follow');
  expect(errors).toEqual([]);
});

test('P3 dock: the hero stops, blue takes the next beat, then green and red; the rocket looks back at four lights',async({page})=>{
  test.setTimeout(120000);
  const last=COURSE.checkpoints.length-1,start=storyFrom(COURSE,last);
  const {path}=solve(COURSE,start,{order:[.25,0,.5,.75,1]});
  const errors=await open(page,last);
  await play(page,path,async()=>{});
  await page.clock.runFor(100);
  const r0=await read(page);expect(r0.status).toBe('docked');
  const at=async b=>{const r=await read(page);await page.clock.runFor(Math.max(0,Math.round(((r0.dockAt+b)*.78-r.s)*1000)));return read(page);};
  // D: everyone holds still; the hero's light is not yet on.
  let r=await at(.3);expect(r.heroLit).toBe(false);
  for(const who of ['blue','green','red']) expect(r.friendY[who]).toBeCloseTo(378,0);
  await shot(page,'dock-1-stop');
  r=await at(.9);expect(r.heroLit).toBe(false);await shot(page,'dock-2-still');
  // D+1: blue touches down on the beat and the hero's light blinks with it.
  r=await at(1.05);expect(r.heroLit).toBe(true);expect(r.friendY.blue).toBeGreaterThan(374);expect(r.friendY.green).toBeCloseTo(378,0);
  await shot(page,'dock-3-blue-beat');
  r=await at(1.5);expect(r.heroLit).toBe(false);expect(r.friendY.blue).toBeLessThan(370);expect(r.friendY.green).toBeCloseTo(378,0);
  r=await at(ENDING.bass+.5);expect(r.friendY.green).toBeLessThan(370);expect(r.friendY.red).toBeCloseTo(378,0);await shot(page,'dock-4-green');
  r=await at(ENDING.perc+.5);expect(r.friendY.red).toBeLessThan(370);await shot(page,'dock-5-red');
  // The light blinks on every beat: on just after it, off between.
  for(const b of [ENDING.perc+1,ENDING.perc+2,ENDING.perc+3]){expect((await at(b+.05)).heroLit).toBe(true);expect((await at(b+.5)).heroLit).toBe(false);}
  await at(ENDING.launch+2.5);await shot(page,'end-1-launch');
  await at(ENDING.turn+3);await shot(page,'end-2-window');
  await at(ENDING.away+12);await shot(page,'end-3-receding');
  r=await at(ENDING.lights+.05);await shot(page,'end-4-lights');
  expect(r.lights.map(l=>l.who)).toEqual(['blue','green','red','hero']);
  // On a phone (this viewport is 390px wide) the four lights stay apart.
  const box=await page.locator('#play').boundingBox(),k=box.width/360;
  for(let i=0;i<4;i++)for(let j=i+1;j<4;j++){const d=Math.hypot(r.lights[i].x-r.lights[j].x,r.lights[i].y-r.lights[j].y)*k;expect(d,'css px between lights').toBeGreaterThan(14);}
  for(const l of r.lights){expect(Math.hypot(l.x-180,l.y-245)).toBeLessThan(150);}
  await at(ENDING.black+1);await shot(page,'end-5-black');
  expect(errors).toEqual([]);
});
