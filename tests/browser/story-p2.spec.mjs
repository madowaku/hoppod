import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {COURSE} from '../../public/src/story/course.mjs';
import {storyFrom} from '../../public/src/story/sim.mjs';
import {solve,hop} from '../helpers/story-solver.mjs';
const dir='output/playwright/story-p2';
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
async function play(page,path,onHop) {
  for(const [i,f] of path.entries()) {
    const hold=Math.round(f*780);
    if(hold>0){await page.keyboard.down('Space');await page.clock.runFor(hold);await page.keyboard.up('Space');}
    await page.clock.runFor(780-hold);
    await onHop(await read(page),i);
  }
}
const shot=(page,name)=>page.locator('#play').screenshot({path:`${dir}/${name}.png`});

test('P2 blue: the third part opens the dark into a wide moon',async({page})=>{
  const start=storyFrom(COURSE,2),{path}=solve(COURSE,start,{until:r=>r.parts.got===3,order:[.25,0,.5,.75,1]});
  const errors=await open(page,2);let done=false;
  await play(page,path,async r=>{});
  await shot(page,'blue-0-assemble');
  for(const [ms,name] of [[300,'blue-1-dawn'],[900,'blue-2-opening'],[3000,'blue-3-wide']]){await page.clock.runFor(ms);await shot(page,name);}
  done=(await read(page)).blue==='follow';expect(done).toBe(true);expect(errors).toEqual([]);
});

test('P2 green: rushing the valley leaves green behind, a relay boosts it, then it holds the bridge',async({page})=>{
  const start=storyFrom(COURSE,4);
  // FAST-first through the valley (green falls out of range), SLOW-first on the field.
  const valley=solve(COURSE,start,{until:r=>r.x>=COURSE.fieldStart+60,order:[1,.75,.5,.25,0]}).path;
  const mid=storyFrom(COURSE,4);for(const f of valley)hop(mid,COURSE,f);
  const field=solve(COURSE,mid,{until:r=>r.x>COURSE.bridge.b+40,order:[0,.25,.5,.75,1]}).path;
  const errors=await open(page,4);const seen={};
  await play(page,[...valley,...field],async r=>{
    const key=r.green==='catch'?'green-1-boost':r.switchOn?'green-3-bridge':r.green==='follow'&&r.greenX>COURSE.switchX-80&&r.greenX<COURSE.switchX?'green-2-near-socket':null;
    if(key&&!seen[key]){seen[key]=true;await shot(page,key);}
  });
  await shot(page,'green-4-alone');
  for(const k of ['green-1-boost','green-2-near-socket','green-3-bridge']) expect(seen[k],k).toBe(true);
  expect(errors).toEqual([]);
});
