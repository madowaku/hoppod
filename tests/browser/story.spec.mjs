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
  await expect(page.locator('#story')).toHaveAttribute('href','story.html?lang=en');
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
  const shots={join:false,switchOn:false,reunion:false};let inset=0;
  for(const f of path) {
    const hold=Math.round(f*780);
    if(hold>0){await page.keyboard.down('Space');await page.clock.runFor(hold);await page.keyboard.up('Space');}
    await page.clock.runFor(780-hold);
    const r=await read(page);
    expect(r.status).not.toBe('falling');inset=Math.max(inset,r.inset);
    if(r.green==='follow'&&!shots.join){shots.join=true;await page.locator('#play').screenshot({path:artifacts+'/story-green.png'});}
    if(r.switchOn&&!shots.switchOn){shots.switchOn=true;await page.locator('#play').screenshot({path:artifacts+'/story-switch.png'});}
    if(r.red==='follow'&&!shots.reunion){shots.reunion=true;await page.locator('#play').screenshot({path:artifacts+'/story-reunion.png'});}
  }
  // The clock starts a few ms after the click, so let the last touchdown land.
  await page.clock.runFor(100);
  let r=await read(page);expect(r.status).toBe('docked');
  // Every story beat happened, in order, and red's trip was shown in its window.
  const types=(await page.evaluate(()=>globalThis.__rapippoStoryProbe.events)).map(e=>e.type);
  const order=['collect','assemble','kit','fit','join','socket','switch','kit','fit','join','notice','rescue','pickup','reunion','station','station','station','dock'];
  let at=0;for(const t of types)if(t===order[at])at++;
  expect(order.slice(at),'missing story beats').toEqual([]);
  expect(inset).toBeGreaterThan(.9);
  // The hero stops for good: no more touchdowns after the dock.
  const lands=(await page.evaluate(()=>globalThis.__rapippoStoryProbe.events)).filter(e=>e.type==='land').length;
  await page.clock.runFor(780*6);
  expect((await page.evaluate(()=>globalThis.__rapippoStoryProbe.events)).filter(e=>e.type==='land').length).toBe(lands);
  r=await read(page);expect(r.friendY.blue).not.toBeCloseTo(378,0);
  await page.clock.runFor((ENDING.lights-6)*780);await page.locator('#play').screenshot({path:artifacts+'/story-lights.png'});
  r=await read(page);expect(r.lights.length).toBe(4);
  await page.clock.runFor((ENDING.card-ENDING.lights)*780+500);
  await expect(page.locator('#overlay')).toHaveAttribute('data-screen','end');
  await expect(page.locator('#again')).toBeVisible();
  expect(errors).toEqual([]);
});

test('touch PAUSE: only while playing, releases a held FAST, resumes on the beat, again and again',async({page})=>{
  const errors=await open(page);
  const pauseButton=page.locator('#pause');
  await expect(pauseButton).toBeHidden();await expect(pauseButton).toHaveAttribute('aria-label','Pause');
  await page.locator('#action').click();await page.clock.runFor(780*2+100);
  await expect(pauseButton).toBeVisible();
  const box=await pauseButton.boundingBox();expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);
  for(let k=0;k<5;k++) {
    // Hold FAST, then tap PAUSE with the key still down.
    await page.keyboard.down('Space');await page.clock.runFor(120);
    await expect(page.locator('#hold-state')).toHaveText('FAST');
    await pauseButton.click();
    const paused=await read(page);
    expect(paused.screen).toBe('pause');
    await expect(page.locator('#hold-state')).toHaveText('SLOW');
    await expect(pauseButton).toBeHidden();await expect(page.locator('#hold')).toBeDisabled();
    await page.clock.runFor(3000);expect((await read(page)).s).toBe(paused.s);
    // Half the time the key is let go only after RESUME: it is already released.
    if(k%2===0) await page.keyboard.up('Space');
    await page.locator('#action').click();
    await expect(page.locator('#hold-state')).toHaveText('SLOW');
    if(k%2===1) {await page.keyboard.up('Space');await expect(page.locator('#hold-state')).toHaveText('SLOW');}
    await page.clock.runFor(780);
    const resumed=await read(page);
    expect(resumed.screen).toBe('play');await expect(pauseButton).toBeVisible();
    expect(Math.abs(resumed.s-paused.s-.78)).toBeLessThan(.05);
    expect(resumed.beat).toBe(Math.floor(resumed.s/.78+1e-9));
  }
  // Escape still pauses.
  await page.keyboard.press('Escape');expect((await read(page)).screen).toBe('pause');
  await page.locator('#action').click();
  // Japanese label.
  await page.keyboard.press('Escape');await page.locator('#language').click();await page.locator('#action').click();
  await expect(pauseButton).toHaveAttribute('aria-label','一時停止');
  expect(errors).toEqual([]);
});

test('from the dock on, FAST/SLOW takes no input; a FAST held into the dock is released',async({page})=>{
  test.setTimeout(120000);
  const errors=await open(page,'&cp='+(COURSE.checkpoints.length-1));
  await page.locator('#action').click();
  for(const f of [1,.75,.5]){const hold=Math.round(f*780);await page.keyboard.down('Space');await page.clock.runFor(hold);await page.keyboard.up('Space');await page.clock.runFor(780-hold);}
  // The last hop: FAST, SLOW, then FAST again and still held as it docks.
  await page.keyboard.down('Space');await page.clock.runFor(390);await page.keyboard.up('Space');await page.clock.runFor(312);
  await page.keyboard.down('Space');await page.clock.runFor(30);
  await expect(page.locator('#hold-state'),'just before the dock FAST still steers').toHaveText('FAST');
  await page.clock.runFor(150);
  const docked=await read(page);expect(docked.status).toBe('docked');
  await expect(page.locator('#hold-state')).toHaveText('SLOW');await expect(page.locator('#hold')).toBeDisabled();
  await expect(page.locator('#pause')).toBeVisible();
  // Nothing turns it back on: the key again, a press on the screen.
  await page.keyboard.up('Space');await page.keyboard.down('Space');await page.clock.runFor(100);
  await expect(page.locator('#hold-state')).toHaveText('SLOW');await page.keyboard.up('Space');
  const canvas=await page.locator('#play').boundingBox();
  await page.mouse.move(canvas.x+canvas.width/2,canvas.y+canvas.height/2);await page.mouse.down();await page.clock.runFor(100);
  await expect(page.locator('#hold-state')).toHaveText('SLOW');await expect(page.locator('#hold')).toHaveAttribute('aria-pressed','false');
  await page.mouse.up();
  // The ending runs on untouched: the hero never lands again, four lights, the end card.
  const lands=(await page.evaluate(()=>globalThis.__rapippoStoryProbe.events)).filter(e=>e.type==='land').length;
  await page.clock.runFor((ENDING.lights+1)*780);
  const r=await read(page);expect(r.dockAt).toBe(docked.dockAt);expect(r.lights.length).toBe(4);
  expect((await page.evaluate(()=>globalThis.__rapippoStoryProbe.events)).filter(e=>e.type==='land').length).toBe(lands);
  await page.clock.runFor((ENDING.card-ENDING.lights)*780);
  await expect(page.locator('#overlay')).toHaveAttribute('data-screen','end');
  await expect(page.locator('#pause')).toBeHidden();await expect(page.locator('#hold')).toBeDisabled();
  expect(errors).toEqual([]);
});

for(const [width,height] of [[360,640],[390,844]]) test(`STORY header at ${width}×${height}: PAUSE beside FREE RUN, clear of the brand and the screen`,async({page})=>{
  await page.setViewportSize({width,height});
  const errors=await open(page);
  await page.locator('#action').click();await page.clock.runFor(500);
  const b=async sel=>page.locator(sel).boundingBox();
  for(const lang of ['en','ja']) {
    if(lang==='ja'){await page.locator('#language').click();await expect(page.locator('#to-free')).toHaveText('フリーラン ›');}
    const brand=await b('.brand'),pauseBox=await b('#pause'),free=await b('#to-free'),area=await b('.play-area');
    expect(pauseBox.x).toBeGreaterThanOrEqual(brand.x+brand.width);
    expect(pauseBox.x+pauseBox.width).toBeLessThanOrEqual(free.x);
    expect(free.x+free.width).toBeLessThanOrEqual(width);
    expect(pauseBox.y+pauseBox.height).toBeLessThanOrEqual(area.y);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({path:`${artifacts}/story-header-${width}x${height}-${lang}.png`});
  }
  expect(errors).toEqual([]);
});

test('on the safe ground the hints follow the player, and end before the first hole',async({page})=>{
  await page.addInitScript(()=>{
    const fillText=CanvasRenderingContext2D.prototype.fillText;globalThis.__hints=[];
    CanvasRenderingContext2D.prototype.fillText=function(text,...rest){if(/^(IT HOPS|HOLD|RELEASE)/.test(text))globalThis.__hints.push(text);return fillText.call(this,text,...rest);};
  });
  const errors=await open(page);
  const shown=async ms=>{await page.evaluate(()=>{globalThis.__hints.length=0;});await page.clock.runFor(ms);return [...new Set(await page.evaluate(()=>globalThis.__hints))];};
  await page.locator('#action').click();
  expect(await shown(780*2)).toEqual(['IT HOPS ON THE BEAT.']);
  await page.clock.runFor(780*1+100);
  expect(await shown(200)).toEqual(['HOLD → FAST']);
  await page.keyboard.down('Space');
  expect(await shown(200)).toEqual(['RELEASE → SLOW']);
  await page.keyboard.up('Space');
  expect(await shown(200)).toEqual(['HOLD → FAST']);
  // By the checkpoint near the plain's end (at SLOW, about 9 hops in) they are gone.
  await page.clock.runFor(780*9);
  const r=await read(page);expect(r.checkpoint).toBe(1);expect(r.status).toBe('playing');
  expect(await shown(200)).toEqual([]);
  await page.locator('#play').screenshot({path:artifacts+'/story-plain-end.png'});
  expect(errors).toEqual([]);
});
