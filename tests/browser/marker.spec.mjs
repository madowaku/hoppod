import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

const dir='output/playwright';
async function startSeed(page,marker='off',compare=false) {
  await page.clock.install({time:new Date('2026-11-01T03:00:00Z')});
  const suffix=marker==='off'?'':'&marker='+marker;
  await page.goto('/?mode=free&seed=7'+suffix+(compare?'&compare=1':''));
  await page.clock.pauseAt(new Date('2026-11-01T03:00:01Z'));
}

test('v0.4-A: A dangerous first pit shows full warning; B only a neutral ring; C no marker or advice',async({page})=>{
  await mkdir(dir,{recursive:true});
  await page.addInitScript(()=>{
    const p=CanvasRenderingContext2D.prototype;
    const nativeEllipse=p.ellipse,nativeText=p.fillText;
    window.__markers={ellipses:[],hints:[]};
    p.ellipse=function(x,y,rx,ry,...args) {
      if(rx===12&&ry===4) window.__markers.ellipses.push({stroke:this.strokeStyle,x,y});
      return nativeEllipse.call(this,x,y,rx,ry,...args);
    };
    p.fillText=function(text,...args) {
      if(text==='HOLD'||text==='RELEASE') window.__markers.hints.push(text);
      return nativeText.call(this,text,...args);
    };
  });
  await startSeed(page,'full',true);
  for(const [mode,color,expectHints] of [
    ['full','#ff9b80',true],
    ['neutral','#d2d2bc',false],
    ['off',null,false],
  ]) {
    await expect(page.locator('#marker-'+mode)).toHaveAttribute('aria-pressed','true');
    await page.locator('#action').click();
    await page.clock.runFor(7*780+50);
    await expect(page.locator('#score')).toHaveText('7');
    await page.evaluate(()=>{window.__markers.ellipses=[];window.__markers.hints=[];});
    await page.clock.runFor(80);
    const marker=await page.evaluate(()=>window.__markers);
    if(color) {
      expect(marker.ellipses.length).toBeGreaterThan(0);
      expect(marker.ellipses.at(-1).stroke).toBe(color);
    } else expect(marker.ellipses).toEqual([]);
    if(expectHints) expect(marker.hints).toContain('HOLD');
    else expect(marker.hints).toEqual([]);
    await page.locator('#play').screenshot({path:`${dir}/v04a-marker-${mode}.png`});
    if(mode==='full') await page.locator('#marker-neutral').click();
    if(mode==='neutral') await page.locator('#marker-off').click();
    if(mode!=='off') {
      await expect(page.locator('#score')).toHaveText('0');
      await expect(page.locator('#overlay')).toHaveAttribute('data-screen','start');
    }
  }
  expect(new URL(page.url()).searchParams.get('seed')).toBe('7');
  expect(new URL(page.url()).searchParams.get('marker')).toBeNull();
});

test('A/B/C preserve course seed, query through reload, and independent bests per variant',async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('hoppod.best.v4.free','193');
    localStorage.setItem('hoppod.best.v4.free.marker.neutral','48');
    localStorage.setItem('hoppod.best.v4.free.marker.off','24');
  });
  await startSeed(page,'off',true);
  await expect(page.locator('#best')).toHaveText('24');
  for(const [mode,expected] of [['full','193'],['neutral','48'],['off','24']]) {
    await page.locator('#marker-'+mode).click();
    await expect(page.locator('#best')).toHaveText(expected);
    await expect(page.locator('#score')).toHaveText('0');
    expect(new URL(page.url()).searchParams.get('seed')).toBe('7');
    expect(new URL(page.url()).searchParams.get('marker')).toBe(mode==='off'?null:mode);
    await page.reload();
    await expect(page.locator('#marker-'+mode)).toHaveAttribute('aria-pressed','true');
    await expect(page.locator('#best')).toHaveText(expected);
  }
  await page.locator('#marker-neutral').click();
  await page.locator('#daily').click();
  expect(new URL(page.url()).searchParams.get('marker')).toBe('neutral');
  await page.locator('#free').click();
  expect(new URL(page.url()).searchParams.get('marker')).toBe('neutral');
});

test('C is the clean public default, while A/B remain available by explicit developer URL',async({page})=>{
  await startSeed(page);
  await expect(page.locator('#marker-compare')).toBeHidden();
  await expect(page.locator('#marker-guide')).toBeHidden();
  await expect(page.locator('#marker-off')).toHaveAttribute('aria-pressed','true');
  expect(new URL(page.url()).searchParams.get('marker')).toBeNull();
  await page.locator('#action').click();
  await page.clock.runFor(7*780+70);
  await expect(page.locator('#score')).toHaveText('7');
  const ordinary=page.url();
  await page.goto('/?mode=free&seed=7&marker=full');
  await expect(page.locator('#marker-off')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#marker-compare')).toBeHidden();
  expect(new URL(page.url()).searchParams.get('marker')).toBeNull();
  // Explicit comparison mode is an internal switch, never added to shared URLs.
  await page.goto('/?mode=free&seed=7&marker=neutral&compare=1');
  await expect(page.locator('#marker-compare')).toBeVisible();
  await page.locator('#marker-off').click();
  await expect(page.locator('#marker-compare')).toBeVisible();
  expect(new URL(page.url()).searchParams.get('marker')).toBeNull();
  expect(new URL(page.url()).searchParams.get('compare')).toBe('1');
  expect(new URL(ordinary).searchParams.get('marker')).toBeNull();
});
