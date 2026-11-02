import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {COURSE} from '../../public/src/story/course.mjs';
import {storyFrom} from '../../public/src/story/sim.mjs';
import {solve} from '../helpers/story-solver.mjs';
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
  const start=storyFrom(COURSE,1),{path}=solve(COURSE,start,{until:r=>r.parts.got===3,order:[.25,0,.5,.75,1]});
  const errors=await open(page,1);let done=false;
  await play(page,path,async r=>{});
  await shot(page,'blue-0-assemble');
  for(const [ms,name] of [[300,'blue-1-dawn'],[900,'blue-2-opening'],[3000,'blue-3-wide']]){await page.clock.runFor(ms);await shot(page,name);}
  done=(await read(page)).blue==='follow';expect(done).toBe(true);expect(errors).toEqual([]);
});

test('P2 green: the valley breaks the link once, a relay restores it, then the switch',async({page})=>{
  const start=storyFrom(COURSE,3);
  const {path}=solve(COURSE,start,{until:r=>r.x>COURSE.bridge.b+40,order:[.25,0,.5,.75,1]});
  const errors=await open(page,3);const seen={};
  await play(page,path,async r=>{
    const key=r.green==='lost'?'green-1-lost':r.green==='catch'?'green-2-relink':r.switchOn?'green-4-switch':r.green==='follow'&&Math.abs(r.greenX-COURSE.switchX)<60?'green-3-over-switch':null;
    if(key&&!seen[key]){seen[key]=true;await shot(page,key);}
  });
  await shot(page,'green-5-alone');
  for(const k of ['green-1-lost','green-2-relink','green-4-switch']) expect(seen[k],k).toBe(true);
  expect(errors).toEqual([]);
});
