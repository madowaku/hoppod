import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {Terrain} from '../../public/src/engine.mjs';
const artifacts='output/playwright';
async function open(page,query='?mode=free&seed=42') {
  await page.clock.install({time:new Date('2026-11-01T03:00:00Z')});
  await page.goto('/'+query);
  await page.clock.pauseAt(new Date('2026-11-01T03:00:01Z'));
}
async function start(page) { await page.locator('#action').click(); await page.clock.runFor(32); }
test('16 browser hops with real FAST/SLOW keyboard events across islands',async({page})=>{
  await open(page);await start(page);const terrain=new Terrain(42);terrain.extendTo(4000);
  for(let hop=1;hop<=16;hop++) {
    const hold=terrain.plan.get(hop)*1000;
    if(hold>0) {
      await page.keyboard.down('Space');await page.clock.runFor(Math.round(hold));
      if(hop===10) await page.screenshot({path:artifacts+'/v02-fast.png'});
      await page.keyboard.up('Space');
    }
    await page.clock.runFor(780-Math.round(hold));
    await expect(page.locator('#overlay')).toBeHidden();
    await expect(page.locator('#score')).toHaveText(String(hop));
  }
  await page.screenshot({path:artifacts+'/v02-islands.png'});
});
test('P0: SLOW-only falls into a visible first pit, never on drawn ground',async({page})=>{
  // Seed 7 overlapped its first two platforms in v2: the pod fell at x≈730 on solid-looking ground.
  await open(page,'?mode=free&seed=7');await start(page);
  await page.clock.runFor(Math.round(780*7.55));
  await page.locator('#play').screenshot({path:artifacts+'/v03-first-pit.png'});
  await page.clock.runFor(Math.round(780*.5));
  await expect(page.locator('#overlay-subtitle')).toHaveText('TOO SHORT · HOLD A LITTLE LONGER');
  await expect(page.locator('#result-score')).toHaveText('7');
  // Canvas pixels below the floor where the pod fell: void, flanked by real ground.
  const [pit,ground]=await page.evaluate(()=>{const g=document.getElementById('play').getContext('2d');
    return [[...g.getImageData(100,495,1,1).data],[...g.getImageData(30,440,1,1).data]];});
  expect(Math.max(...pit.slice(0,3))).toBeLessThan(20);
  expect(Math.max(...ground.slice(0,3))).toBeGreaterThan(40);
});
for(const [query,compressors] of [['',1],['&sfx=classic',0]]) test(`P1: 10 HOPS milestone accent on real Web Audio${query||' (layered)'}`,async({page})=>{
  await page.addInitScript(()=>{
    window.__audio={oscillators:0,compressors:0,state:''};
    const P=AudioContext.prototype,osc=P.createOscillator,comp=P.createDynamicsCompressor;
    P.createOscillator=function(){window.__audio.oscillators++;window.__audio.state=this.state;return osc.call(this);};
    P.createDynamicsCompressor=function(){window.__audio.compressors++;return comp.call(this);};
  });
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await open(page,'?mode=free&seed=42'+query);await start(page);
  const terrain=new Terrain(42);terrain.extendTo(4000);
  for(let hop=1;hop<=10;hop++) {
    const hold=Math.round(terrain.plan.get(hop)*1000);
    if(hold>0){await page.keyboard.down('Space');await page.clock.runFor(hold);await page.keyboard.up('Space');}
    await page.clock.runFor(780-hold);
  }
  await expect(page.locator('#score')).toHaveText('10');
  const audio=await page.evaluate(()=>window.__audio);
  test.skip(audio.state!=='running','AudioContext not running in this browser');
  expect(audio.compressors).toBe(compressors);
  expect(new URL(page.url()).searchParams.get('sfx')).toBeNull();
  expect(errors).toEqual([]);
});
test('P2: far side is dark; Earth and signal bars appear as the pod travels',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await open(page);await start(page);
  // Earth-blue pixels in the sky region, and lit signal bars in the HUD corner.
  const sample=()=>page.evaluate(()=>{const g=document.getElementById('play').getContext('2d');
    const blue=d=>{let n=0;for(let i=0;i<d.length;i+=4) if(d[i+2]>150&&d[i+2]>d[i]+60) n++;return n;};
    return {earth:blue(g.getImageData(230,120,120,190).data),bars:blue(g.getImageData(320,14,26,16).data)};});
  expect(await sample()).toEqual({earth:0,bars:0});
  const terrain=new Terrain(42);
  for(let hop=1;hop<=60;hop++) {
    terrain.extendTo(hop*200+4000);const hold=Math.round(terrain.plan.get(hop)*1000);
    if(hold>0){await page.keyboard.down('Space');await page.clock.runFor(hold);await page.keyboard.up('Space');}
    await page.clock.runFor(780-hold);
  }
  await expect(page.locator('#score')).toHaveText('60');
  const later=await sample();
  expect(later.earth).toBeGreaterThan(200);expect(later.bars).toBeGreaterThan(0);
  await page.locator('#play').screenshot({path:artifacts+'/v03-earth-60.png'});
  expect(errors).toEqual([]);
});
test('real-time start → 3+ landings → fall → immediate retry',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('/?mode=free&seed=42');await page.locator('#action').click();
  await expect.poll(async()=>Number(await page.locator('#score').textContent()),{timeout:4500}).toBeGreaterThanOrEqual(3);
  await page.screenshot({path:artifacts+'/v02-playing.png'});
  await expect(page.locator('#overlay')).toBeVisible({timeout:10000});
  await expect(page.locator('#overlay-subtitle')).toHaveText('TOO SHORT · HOLD A LITTLE LONGER');
  await page.screenshot({path:artifacts+'/v02-result.png'});
  await page.locator('#action').click();await expect(page.locator('#score')).toHaveText('0');
  await expect(page.locator('#hold-state')).toHaveText('SLOW');await expect(page.locator('#overlay')).toBeHidden();
  expect(errors).toEqual([]);
});
test('pointer, cancellation, capture loss, blur, visibility, pagehide, retry clear input',async({page})=>{
  await open(page);await start(page);
  const box=await page.locator('#hold').boundingBox();
  await page.mouse.move(box.x+30,box.y+20);await page.mouse.down();
  await expect(page.locator('#hold-state')).toHaveText('FAST');
  await page.evaluate(()=>window.dispatchEvent(new PointerEvent('pointercancel',{pointerId:1})));
  await expect(page.locator('#hold-state')).toHaveText('SLOW');await page.mouse.up();
  await page.keyboard.down('Space');await expect(page.locator('#hold-state')).toHaveText('FAST');
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  await expect(page.locator('#action')).toHaveText('RESUME');await expect(page.locator('#hold-state')).toHaveText('SLOW');
  await page.keyboard.up('Space');await page.locator('#action').click();
  await page.keyboard.down('Space');await page.keyboard.press('r');
  await expect(page.locator('#hold-state')).toHaveText('SLOW');await expect(page.locator('#score')).toHaveText('0');
  await page.keyboard.up('Space');
  await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));await expect(page.locator('#action')).toHaveText('RESUME');
  await page.locator('#action').click();
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  await expect(page.locator('#action')).toHaveText('RESUME');
  await page.locator('#free').click();await expect(page.locator('#hold-state')).toHaveText('SLOW');
  await expect(page.locator('#overlay')).toHaveAttribute('data-screen','start');
});
test('captured pointer release outside control and keyboard START activation',async({page})=>{
  await open(page);await page.locator('#action').focus();await page.keyboard.press('Space');await page.clock.runFor(32);
  await expect(page.locator('#overlay')).toBeHidden();
  const b=await page.locator('#hold').boundingBox();await page.mouse.move(b.x+20,b.y+20);await page.mouse.down();
  await expect(page.locator('#hold-state')).toHaveText('FAST');
  await page.mouse.move(1,1);await page.mouse.up();await expect(page.locator('#hold-state')).toHaveText('SLOW');
  await page.keyboard.down('Space');await expect(page.locator('#hold-state')).toHaveText('FAST');
  await page.locator('#daily').click();await page.keyboard.up('Space');await expect(page.locator('#hold-state')).toHaveText('SLOW');
  expect(new URL(page.url()).searchParams.get('date')).toBe('2026-11-01');
});
test('blocked storage, reduced motion, and a long frame stall remain playable',async({page})=>{
  await page.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new Error('Storage blocked');}});});
  await page.emulateMedia({reducedMotion:'reduce'});await open(page);await start(page);
  await page.clock.runFor(2400);await expect(page.locator('#score')).toHaveText('3');
  await page.clock.fastForward(2000);await expect(page.locator('#action')).toHaveText('RESUME');
  await page.locator('#action').click();await page.clock.runFor(6800);
  await expect(page.locator('#share-actions')).toBeVisible();
});
test('PNG download has expected dimensions; X composer receives exact replay URL and best',async({page})=>{
  await open(page);await start(page);await page.clock.runFor(6800);
  await expect(page.locator('#share-actions')).toBeVisible();
  const download=page.waitForEvent('download');await page.locator('#save').click();const d=await download;
  await d.saveAs(artifacts+'/score.png');expect(d.suggestedFilename()).toMatch(/^HOPPOD-\d+-hops.png$/);
  const size=await page.evaluate(async()=>{
    const image=new Image();const a=document.createElement('a');
    const native=a.click;let href;
    HTMLAnchorElement.prototype.click=function(){href=this.href;};
    document.getElementById('save').click();HTMLAnchorElement.prototype.click=native;
    image.src=href;await image.decode();return [image.width,image.height];
  });expect(size).toEqual([1080,1350]);
  await page.evaluate(()=>{window.open=(url)=>{window.__share=url;};});
  await page.locator('#share').click();const link=new URL(await page.evaluate(()=>window.__share));
  expect(link.origin+link.pathname).toBe('https://twitter.com/intent/tweet');
  expect(link.searchParams.get('url')).toBe(page.url());expect(link.searchParams.get('text')).toContain('BEST');
  await page.reload();await expect(page.locator('#best')).not.toHaveText('0');
});
for(const [width,height] of [[320,568],[390,844],[1440,900],[844,390]]) test(`visual layout ${width}×${height}`,async({page})=>{
  await page.setViewportSize({width,height});await open(page);await mkdir(artifacts,{recursive:true});
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await expect(page.locator('#action')).toBeInViewport();await page.screenshot({path:`${artifacts}/v02-start-${width}.png`,fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await start(page);await page.clock.runFor(6800);
  await expect(page.locator('#share')).toBeVisible();
  // Children must remain inside the canvas overlay, including at 320px.
  const bounds=await page.locator('#overlay').boundingBox();
  for(const id of ['action','share','save','overlay-subtitle']) {
    const box=await page.locator('#'+id).boundingBox();
    expect(box.y+box.height).toBeLessThanOrEqual(bounds.y+bounds.height+1);
    expect(box.x).toBeGreaterThanOrEqual(bounds.x);
    expect(box.x+box.width).toBeLessThanOrEqual(bounds.x+bounds.width+1);
  }
  await page.screenshot({path:`${artifacts}/v02-result-${width}.png`,fullPage:true});expect(errors).toEqual([]);
});
