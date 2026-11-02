import {test,expect} from '@playwright/test';
import {COURSE} from '../../public/src/story/course.mjs';
import {newStory} from '../../public/src/story/sim.mjs';
import {ENDING} from '../../public/src/story/music.mjs';
import {solve} from '../helpers/story-solver.mjs';
const artifacts='output/playwright';
// Without Web Audio the beat clock runs on performance time, which the
// Playwright clock controls exactly.
async function open(page,query='') {
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{delete window.AudioContext;delete window.webkitAudioContext;globalThis.__rapippoStoryProbe={};});
  await page.clock.install({time:new Date('2026-11-02T03:00:00Z')});
  await page.goto('/story.html?lang=en'+query);
  await page.clock.pauseAt(new Date('2026-11-02T03:00:01Z'));
  return errors;
}
const read=page=>page.evaluate(()=>globalThis.__rapippoStoryProbe.read());

test('FREE RUN links to STORY without changing its own controls',async({page})=>{
  await page.goto('/?mode=free&seed=42');
  await expect(page.locator('#story')).toHaveAttribute('href','./story.html');
  await expect(page.locator('#daily')).toBeVisible();await expect(page.locator('#free')).toBeVisible();
});

test('STORY starts on the beat, pauses without losing phase',async({page})=>{
  const errors=await open(page);
  await page.locator('#action').click();await page.clock.runFor(780*5+100);
  let r=await read(page);
  expect(r.screen).toBe('play');expect(r.beat).toBe(5);expect(r.status).toBe('playing');expect(r.domain).toBe('perf');
  await page.keyboard.press('Escape');const paused=(await read(page)).s;
  await page.clock.runFor(5000);r=await read(page);
  expect(r.screen).toBe('pause');expect(r.s).toBe(paused);
  await page.locator('#action').click();await page.clock.runFor(780);
  r=await read(page);expect(r.beat).toBe(6);
  await page.locator('#play').screenshot({path:artifacts+'/story-wake.png'});
  expect(errors).toEqual([]);
});

test('the whole STORY plays through with real key events to the end card',async({page})=>{
  test.setTimeout(300000);
  const {path}=solve(COURSE,newStory(COURSE),{order:[.25,0,.5,.75,1]});
  const errors=await open(page);
  await page.locator('#action').click();
  const shots={join:false,switchOn:false,reunion:false};
  for(const f of path) {
    const hold=Math.round(f*780);
    if(hold>0){await page.keyboard.down('Space');await page.clock.runFor(hold);await page.keyboard.up('Space');}
    await page.clock.runFor(780-hold);
    const r=await read(page);
    expect(r.status).not.toBe('falling');
    if(r.green==='follow'&&!shots.join){shots.join=true;await page.locator('#play').screenshot({path:artifacts+'/story-green.png'});}
    if(r.switchOn&&!shots.switchOn){shots.switchOn=true;await page.locator('#play').screenshot({path:artifacts+'/story-switch.png'});}
    if(r.red==='follow'&&!shots.reunion){shots.reunion=true;await page.locator('#play').screenshot({path:artifacts+'/story-reunion.png'});}
  }
  let r=await read(page);expect(r.status).toBe('docked');
  await page.clock.runFor(ENDING.lights*780);await page.locator('#play').screenshot({path:artifacts+'/story-lights.png'});
  await page.clock.runFor((ENDING.card-ENDING.lights)*780+500);
  await expect(page.locator('#overlay')).toHaveAttribute('data-screen','end');
  await expect(page.locator('#again')).toBeVisible();
  expect(errors).toEqual([]);
});
