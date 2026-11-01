import {test,expect} from '@playwright/test';
import {Terrain} from '../../public/src/engine.mjs';

test('language changes in place, persists through reload, and never resumes the start overlay during a run',async({page})=>{
  await page.clock.install({time:new Date('2026-11-01T03:00:00Z')});
  await page.goto('/?mode=free&seed=7&lang=ja');
  await page.clock.pauseAt(new Date('2026-11-01T03:00:01Z'));
  await expect(page.locator('html')).toHaveAttribute('lang','ja');
  await expect(page.locator('#daily')).toHaveText('デイリー');
  await expect(page.locator('#milestone-help')).toContainText('10 HOPS');
  await expect(page.locator('#action')).toHaveText('スタート');
  await page.locator('#action').click();
  await page.clock.runFor(3*780+40);
  await expect(page.locator('#score')).toHaveText('3');
  await page.locator('#language').click();
  await expect(page.locator('html')).toHaveAttribute('lang','en');
  await expect(page.locator('#overlay')).toBeHidden();
  await expect(page.locator('#score')).toHaveText('3');
  await expect(page.locator('#language')).toHaveText('日本語');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang','en');
  await expect(page.locator('#action')).toHaveText('LET’S HOP');
  await page.locator('#language').click();
  await expect(page.locator('#action')).toHaveText('スタート');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang','ja');
});
test('muted preference persists, can be changed while playing and does not alter HOPS',async({page})=>{
  await page.clock.install({time:new Date('2026-11-01T03:00:00Z')});
  await page.goto('/?mode=free&seed=7&lang=en');
  await page.clock.pauseAt(new Date('2026-11-01T03:00:01Z'));
  await page.locator('#action').click();await page.clock.runFor(3*780+40);
  await expect(page.locator('#score')).toHaveText('3');
  await page.locator('#sound').click();
  await expect(page.locator('#sound')).toHaveText('SOUND OFF');
  await expect(page.locator('#sound')).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('#overlay')).toBeHidden();
  await page.reload();
  await expect(page.locator('#sound')).toHaveText('SOUND OFF');
  await page.locator('#sound').click();
  await expect(page.locator('#sound')).toHaveText('SOUND ON');
  await page.reload();
  await expect(page.locator('#sound')).toHaveText('SOUND ON');
});
test('10 HOPS has a brief labelled audible reward, live BEST advances after previous record',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('hoppod.best.v4.free.marker.off','7'));
  await page.clock.install({time:new Date('2026-11-01T03:00:00Z')});
  await page.goto('/?mode=free&seed=42&lang=en');
  await page.clock.pauseAt(new Date('2026-11-01T03:00:01Z'));
  await expect(page.locator('#best')).toHaveText('7');
  await page.locator('#action').click();await page.clock.runFor(32);
  const terrain=new Terrain(42);
  for(let hop=1;hop<=10;hop++){
    terrain.extendTo(hop*200+4000);
    const hold=Math.round(terrain.plan.get(hop)*1000);
    if(hold>0){await page.keyboard.down('Space');await page.clock.runFor(hold);await page.keyboard.up('Space');}
    await page.clock.runFor(780-hold);
    await expect(page.locator('#score')).toHaveText(String(hop));
    if(hop===8) await expect(page.locator('#milestone-notice')).toContainText('NEW BEST');
  }
  await expect(page.locator('#best')).toHaveText('10');
  await expect(page.locator('#milestone-notice')).toBeVisible();
  await expect(page.locator('#milestone-notice')).toContainText('10 HOPS');
  await page.clock.runFor(1450);
  await expect(page.locator('#milestone-notice')).toBeHidden();
});
test('320px Japanese result overlay still fits; no beacon counts, score and share URL stay stable',async({page})=>{
  await page.setViewportSize({width:320,height:640});
  await page.clock.install({time:new Date('2026-11-01T03:00:00Z')});
  await page.goto('/?mode=free&seed=7&lang=ja');
  await page.clock.pauseAt(new Date('2026-11-01T03:00:01Z'));
  await page.locator('#action').click();await page.clock.runFor(6800);
  await expect(page.locator('#share-actions')).toBeVisible();
  await expect(page.locator('#result-details')).toBeVisible();
  await expect(page.locator('#result-score')).toHaveText('7');
  await expect(page.locator('#overlay-title')).toContainText('自己ベスト');
  await expect(page.locator('#overlay-subtitle')).toContainText('届かなかった');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const bounds=await page.locator('#overlay').boundingBox();
  for(const id of ['action','share','save']){
    const box=await page.locator('#'+id).boundingBox();
    expect(box.y+box.height).toBeLessThanOrEqual(bounds.y+bounds.height+1);
  }
  await page.evaluate(()=>{window.open=u=>{window.__share=u;};});
  await page.locator('#share').click();
  const link=new URL(await page.evaluate(()=>window.__share));
  expect(link.searchParams.get('text')).toContain('あと1回');
  expect(link.searchParams.get('url')).toBe(page.url());
});
