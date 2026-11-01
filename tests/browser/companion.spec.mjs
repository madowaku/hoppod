import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {Terrain} from '../../public/src/engine.mjs';

const dir='output/playwright';
// Pixels of the blue companion body colour inside a canvas region.
const bluePod=(source,[x,y,w,h])=>`(()=>{const g=${source}.getContext('2d');const d=g.getImageData(${x},${y},${w},${h}).data;let n=0;
  for(let i=0;i<d.length;i+=4) if(d[i]===169&&d[i+1]===214&&d[i+2]===255) n++;return n;})()`;
const canvasPod=page=>page.evaluate(bluePod("document.getElementById('play')",[20,230,50,150]));
async function hopTo(page,terrain,from,to) {
  for(let hop=from;hop<=to;hop++) {
    terrain.extendTo(hop*200+4000);const hold=Math.round(terrain.plan.get(hop)*1000);
    if(hold>0){await page.keyboard.down('Space');await page.clock.runFor(hold);await page.keyboard.up('Space');}
    await page.clock.runFor(780-hold);
  }
}

for(const [width,height] of [[390,844],[320,568]]) test(`v0.4-C: blue pod joins at 30 HOPS in C mode and rides into result and PNG (${width}px)`,async({page})=>{
  await mkdir(dir,{recursive:true});await page.setViewportSize({width,height});
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.clock.install({time:new Date('2026-11-01T03:00:00Z')});
  await page.goto('/?mode=free&seed=42');await page.clock.pauseAt(new Date('2026-11-01T03:00:01Z'));
  await page.locator('#action').click();await page.clock.runFor(32);
  const terrain=new Terrain(42);
  await hopTo(page,terrain,1,29);
  await expect(page.locator('#score')).toHaveText('29');
  expect(await canvasPod(page)).toBe(0);
  await hopTo(page,terrain,30,36);
  await expect(page.locator('#score')).toHaveText('36');
  expect(await canvasPod(page)).toBeGreaterThan(40);
  // Default C: still no landing marker while the companion is aboard.
  expect(new URL(page.url()).searchParams.get('marker')).toBeNull();
  await page.locator('#play').screenshot({path:`${dir}/v04c-companion-${width}.png`});
  // Release control entirely; SLOW soon misses a gap.
  for(let i=0;i<30&&await page.locator('#overlay').isHidden();i++) await page.clock.runFor(780);
  await expect(page.locator('#share-actions')).toBeVisible();
  await expect(page.locator('#result-crew')).toBeVisible();
  await expect(page.locator('#result-earth')).toHaveText(/EARTH/);
  const bounds=await page.locator('#overlay').boundingBox();
  for(const id of ['result-crew','result-earth','action','save']) {
    const box=await page.locator('#'+id).boundingBox();
    expect(box.y+box.height).toBeLessThanOrEqual(bounds.y+bounds.height+1);
    expect(box.x).toBeGreaterThanOrEqual(bounds.x);expect(box.x+box.width).toBeLessThanOrEqual(bounds.x+bounds.width+1);
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`${dir}/v04c-result-${width}.png`,fullPage:true});
  const download=page.waitForEvent('download');await page.locator('#save').click();
  await (await download).saveAs(`${dir}/v04c-score-${width}.png`);
  const png=await page.evaluate(async source=>{
    let href;const native=HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click=function(){href=this.href;};
    document.getElementById('save').click();HTMLAnchorElement.prototype.click=native;
    const image=new Image();image.src=href;await image.decode();
    const c=document.createElement('canvas');c.width=image.width;c.height=image.height;c.getContext('2d').drawImage(image,0,0);
    window.__card=c;return [image.width,image.height];
  });
  expect(png).toEqual([1080,1350]);
  expect(await page.evaluate(bluePod('window.__card',[300,700,200,260]))).toBeGreaterThan(500);
  expect(errors).toEqual([]);
});

test('v0.4-C: score card without the companion has no blue pod',async({page})=>{
  await page.clock.install({time:new Date('2026-11-01T03:00:00Z')});
  await page.goto('/?mode=free&seed=42');await page.clock.pauseAt(new Date('2026-11-01T03:00:01Z'));
  await page.locator('#action').click();await page.clock.runFor(6800);
  await expect(page.locator('#share-actions')).toBeVisible();
  await expect(page.locator('#result-crew')).toBeHidden();
  await expect(page.locator('#result-earth')).toHaveText('FAR SIDE');
  const count=await page.evaluate(async source=>{
    let href;const native=HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click=function(){href=this.href;};
    document.getElementById('save').click();HTMLAnchorElement.prototype.click=native;
    const image=new Image();image.src=href;await image.decode();
    const c=document.createElement('canvas');c.width=image.width;c.height=image.height;c.getContext('2d').drawImage(image,0,0);
    const d=c.getContext('2d').getImageData(0,0,1080,1350).data;let n=0;
    for(let i=0;i<d.length;i+=4) if(d[i]===169&&d[i+1]===214&&d[i+2]===255) n++;return n;
  });
  expect(count).toBe(0);
});
