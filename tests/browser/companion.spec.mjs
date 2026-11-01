import {test,expect,devices} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {PERIOD,SLOW_SPEED,FAST_SPEED,Terrain} from '../../public/src/engine.mjs';
import {PartLayout,PartRun} from '../../public/src/parts.mjs';

const dir='output/playwright';
const BLUE=[169,214,255];
// Pixels of the blue crew body colour inside a region of a canvas.
const countBlue=(page,source,[x,y,w,h])=>page.evaluate(({source,x,y,w,h,BLUE})=>{
  const c=source==='play'?document.getElementById('play'):window.__card;
  const d=c.getContext('2d').getImageData(x,y,w,h).data;let n=0;
  for(let i=0;i<d.length;i+=4) if(d[i]===BLUE[0]&&d[i+1]===BLUE[1]&&d[i+2]===BLUE[2]) n++;return n;
},{source,x,y,w,h,BLUE});
const companionArea=page=>countBlue(page,'play',[20,230,45,150]);
const trayArea=page=>countBlue(page,'play',[12,32,40,18]);

async function open(page,seed) {
  // Read-only probe: lets the route correct for frame quantisation each hop.
  await page.addInitScript(()=>{window.__rapippoProbe={};});
  await page.clock.install({time:new Date('2026-11-01T03:00:00Z')});
  await page.goto('/?mode=free&seed='+seed);await page.clock.pauseAt(new Date('2026-11-01T03:00:01Z'));
  await page.locator('#action').click();await page.clock.runFor(32);
}
// Drives the real keyboard along the reference route, detouring onto parts
// while `take` allows. A node-side PartRun twin, fed the real landing x,
// picks each target and must agree with the game about collected parts.
function route(seed) {
  const plan=new Terrain(seed),parts=new PartRun(new PartLayout(seed));
  return {parts,async hop(page,take=true) {
    const now=await page.evaluate(()=>window.__rapippoProbe.read());
    plan.extendTo(now.x+2000);
    const next=now.hops+1,slot=parts.active;
    const target=slot&&slot.hop===next&&take?slot.x:plan.planPositions.get(next);
    const left=PERIOD-now.phase,hold=Math.max(0,Math.min(left,(target-now.x-SLOW_SPEED*left)/(FAST_SPEED-SLOW_SPEED)));
    const ms=Math.round(hold*1000);
    if(ms>0){await page.keyboard.down('Space');await page.clock.runFor(ms);await page.keyboard.up('Space');}
    await page.clock.runFor(Math.round((left-hold)*1000)+20);
    const after=await page.evaluate(()=>window.__rapippoProbe.read());
    expect(after.hops,`seed ${seed}: missed landing ${next}`).toBe(next);
    parts.land(after.x,after.hops);
    expect(after.parts).toEqual(parts.collected);
  }};
}
async function fall(page) {
  for(let i=0;i<30&&await page.locator('#overlay').isHidden();i++) await page.clock.runFor(780);
  await expect(page.locator('#share-actions')).toBeVisible();
}
async function card(page,name) {
  const download=page.waitForEvent('download');await page.locator('#save').click();
  await (await download).saveAs(`${dir}/${name}`);
  return page.evaluate(async()=>{
    let href;const native=HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click=function(){href=this.href;};
    document.getElementById('save').click();HTMLAnchorElement.prototype.click=native;
    const image=new Image();image.src=href;await image.decode();
    const c=document.createElement('canvas');c.width=image.width;c.height=image.height;c.getContext('2d').drawImage(image,0,0);
    window.__card=c;return [image.width,image.height];
  });
}
async function overlayFits(page,ids) {
  const bounds=await page.locator('#overlay').boundingBox();
  for(const id of ids) {
    const box=await page.locator('#'+id).boundingBox();
    expect(box.y+box.height).toBeLessThanOrEqual(bounds.y+bounds.height+1);
    expect(box.x).toBeGreaterThanOrEqual(bounds.x);expect(box.x+box.width).toBeLessThanOrEqual(bounds.x+bounds.width+1);
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
}

test('v0.4-C2: no parts → RAPIPPO alone on the result and PNG',async({page})=>{
  await mkdir(dir,{recursive:true});await open(page,42);
  await page.clock.runFor(6800);await expect(page.locator('#share-actions')).toBeVisible();
  await expect(page.locator('#result-crew')).toBeHidden();await expect(page.locator('#result-earth')).toHaveText('FAR SIDE');
  expect(await card(page,'v04c2-card-0-parts.png')).toEqual([1080,1350]);
  expect(await countBlue(page,'card',[0,0,1080,1350])).toBe(0);
});

test('v0.4-C2: one part → tray fills, no companion, result and PNG show the part',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await open(page,42);const r=route(42),first=r.parts.active;
  for(let hop=1;hop<first.hop-3;hop++) await r.hop(page);
  expect(await trayArea(page)).toBe(0);
  await r.hop(page);
  // The tray appears a few hops before the first part, still empty.
  await page.locator('#play').screenshot({path:`${dir}/v04c2-before-part.png`});
  while(r.parts.collected.length<1) {
    // Mid-air on the hop that lands on it: the glowing part is on screen.
    if((await page.evaluate(()=>window.__rapippoProbe.read())).hops+1===first.hop) {
      await page.clock.runFor(300);await page.locator('#play').screenshot({path:`${dir}/v04c2-part-ahead.png`});
      expect(await countBlue(page,'play',[100,350,260,40])).toBeGreaterThan(10);
    }
    await r.hop(page);
  }
  await page.clock.runFor(100);await page.locator('#play').screenshot({path:`${dir}/v04c2-part-flight.png`});
  await page.clock.runFor(400);
  expect(await trayArea(page)).toBeGreaterThan(5);
  expect(await companionArea(page)).toBe(0);
  await page.locator('#play').screenshot({path:`${dir}/v04c2-one-part.png`});
  await fall(page);
  await expect(page.locator('#result-crew-text')).toHaveText('BLUE POD PARTS 1/3 · '+{antenna:'ANTENNA',body:'BODY',engine:'ENGINE'}[r.parts.collected[0]]);
  await page.screenshot({path:`${dir}/v04c2-result-1-part.png`,fullPage:true});
  await card(page,'v04c2-card-1-part.png');
  const blue=await countBlue(page,'card',[340,700,120,240]);
  expect(blue).toBeGreaterThan(100);
  expect(await countBlue(page,'card',[300,780,200,100])).toBeLessThan(blue);
  expect(errors).toEqual([]);
});

for(const [name,options] of [['320px',{viewport:{width:320,height:568}}],['Android Pixel 5',(({defaultBrowserType,...d})=>d)(devices['Pixel 5'])]]) test.describe(name,()=>{
  test.use(options);
  test(`v0.4-C2: three parts assemble during play, then follow; result and PNG show the crew (${name})`,async({page})=>{
    test.setTimeout(90000);
    const errors=[];page.on('pageerror',e=>errors.push(String(e)));
    await open(page,42);const r=route(42);
    while(r.parts.collected.length<2) await r.hop(page);
    await page.clock.runFor(500);
    expect(await companionArea(page)).toBe(0);
    await page.locator('#play').screenshot({path:`${dir}/v04c2-two-parts-${name.replace(/\W+/g,'-')}.png`});
    while(!r.parts.complete) await r.hop(page);
    // Play never pauses: the overlay stays hidden through the assembly.
    await page.clock.runFor(200);await expect(page.locator('#overlay')).toBeHidden();
    await page.locator('#play').screenshot({path:`${dir}/v04c2-assembling-${name.replace(/\W+/g,'-')}.png`});
    for(let i=0;i<4;i++) await r.hop(page);
    await expect(page.locator('#score')).toHaveText(String(r.parts.completedAt+4));
    expect(await companionArea(page)).toBeGreaterThan(40);
    expect(await trayArea(page)).toBe(0);
    await page.locator('#play').screenshot({path:`${dir}/v04c2-crew-${name.replace(/\W+/g,'-')}.png`});
    expect(new URL(page.url()).searchParams.get('marker')).toBeNull();
    await fall(page);
    await expect(page.locator('#result-crew-text')).toHaveText('WITH BLUE POD');
    await overlayFits(page,['result-crew','result-earth','action','save']);
    await page.screenshot({path:`${dir}/v04c2-result-crew-${name.replace(/\W+/g,'-')}.png`,fullPage:true});
    await card(page,`v04c2-card-crew-${name.replace(/\W+/g,'-')}.png`);
    expect(await countBlue(page,'card',[300,700,200,260])).toBeGreaterThan(500);
    expect(errors).toEqual([]);
  });
});

test('v0.4-C2: same seed gives the same parts after retry; retry resets progress; BEST untouched mid-run',async({page})=>{
  await open(page,42);const r=route(42);
  while(r.parts.collected.length<1) await r.hop(page);
  await page.keyboard.press('r');await page.clock.runFor(100);
  await expect(page.locator('#score')).toHaveText('0');
  expect(await trayArea(page)).toBe(0);
  expect(await page.evaluate(()=>localStorage.getItem('hoppod.best.v4.free.marker.off'))).toBeNull();
  // A fresh run follows the same route and finds the same first part.
  const again=route(42);while(again.parts.collected.length<1) await again.hop(page);
  await page.clock.runFor(500);expect(await trayArea(page)).toBeGreaterThan(5);
  expect(again.parts.layout.slot(0)).toEqual(r.parts.layout.slot(0));
});
