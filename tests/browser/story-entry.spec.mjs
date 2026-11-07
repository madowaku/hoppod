import {test,expect} from '@playwright/test';
import {readFile,mkdir} from 'node:fs/promises';
import {extname,join} from 'node:path';
// Release entry: the bare address opens the stage select in English; FREE RUN and DAILY
// keep every old address; the language follows the player between pages.
const dir='output/playwright/entry';
const errorsOf=page=>{const errors=[];page.on('pageerror',e=>errors.push(e.message));return errors;};
const lang=page=>page.locator('html').getAttribute('lang');

test('the top address opens the stage select in English, before any game code loads',async({page})=>{
  const errors=errorsOf(page),scripts=[];
  page.on('request',r=>{if(r.url().includes('/src/'))scripts.push(new URL(r.url()).pathname);});
  await page.goto('/');
  await expect(page).toHaveURL(/\/select\.html$/);
  expect(await lang(page)).toBe('en');
  await expect(page.locator('#story')).toHaveAttribute('href','story.html?lang=en');
  await expect(page.locator('#workshop')).toHaveAttribute('href','workshop.html?lang=en');
  await expect(page.locator('#tower')).toHaveAttribute('href','clocktower.html?lang=en');
  await expect(page.locator('#free')).toHaveAttribute('href','index.html?mode=free&lang=en');
  expect(scripts.filter(p=>p==='/src/app.mjs'),'FREE RUN code never loads on the way').toEqual([]);
  await page.goto('/?lang=ja');
  await expect(page).toHaveURL(/\/select\.html\?lang=ja$/);
  expect(await lang(page)).toBe('ja');
  await expect(page.locator('#workshop strong')).toHaveText('月の楽器工房');
  await page.goto('/?lang=zz');await expect(page).toHaveURL(/\/select\.html$/);expect(await lang(page)).toBe('en');
  // Parameters that are not ours (itch.io's build stamp, trackers) never mean FREE RUN.
  for(const [query,to] of [['?v=1785088796','/select.html'],['?v=1785088796&lang=ja','/select.html?lang=ja'],['?utm_source=itch&ref=abc','/select.html'],['?v=4','/select.html']]) {
    await page.goto('/'+query);
    expect(new URL(page.url()).pathname+new URL(page.url()).search,query).toBe(to);
    await expect(page.locator('#free')).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('every stage opens from the select, and each leads back with the language kept',async({page})=>{
  const errors=errorsOf(page);
  for(const [id,path,back] of [['story','/story.html','#to-free'],['workshop','/workshop.html','#to-select'],['tower','/clocktower.html','#to-select'],['free','/index.html','#story']]) {
    await page.goto('/select.html?lang=ja');
    await page.locator('#'+id).click();
    await expect(page).toHaveURL(new RegExp(path.replace('.','\.')));
    await expect(page.locator(back)).toHaveAttribute('href','select.html?lang=ja');
    expect(await lang(page)).toBe('ja');
  }
  await page.goto('/clocktower.html?lang=en');
  await expect(page.locator('#demo-clear')).toBeHidden();await expect(page.locator('details')).toBeHidden();
  expect(errors).toEqual([]);
});

test.describe('a Japanese browser',()=>{
  test.use({locale:'ja-JP'});
  test('still starts in English; a saved choice or ?lang= wins',async({page})=>{
    expect(await page.evaluate(()=>navigator.language)).toBe('ja-JP');
    await page.goto('/');expect(await lang(page)).toBe('en');
    await page.goto('/?mode=free&seed=42');expect(await lang(page)).toBe('en');
    await page.evaluate(()=>localStorage.setItem('hoppod.pref.lang','ja'));
    await page.goto('/');expect(await lang(page)).toBe('ja');
    await page.goto('/story.html?lang=en');expect(await lang(page)).toBe('en');
  });
});

test('old FREE RUN and DAILY addresses stay on FREE RUN with the same course',async({page})=>{
  const errors=errorsOf(page);
  await page.clock.install({time:new Date('2026-11-01T03:00:00Z')});
  for(const [query,mode,key,value] of [
    ['?mode=daily&date=2026-10-30&v=3','daily','date','2026-10-30'],
    ['?mode=daily&date=2026-10-30','daily','date','2026-10-30'],
    ['?mode=free&seed=42','free','seed','42'],
    ['?mode=free&seed=42&v=4&lang=ja','free','seed','42'],
    ['?seed=7','daily','date','2026-11-01'],
    ['?date=2026-10-29','daily','date','2026-10-29'],
    ['?mode=daily','daily','date','2026-11-01'],
    // The same links with itch.io's stamp added still open FREE RUN.
    ['?mode=free&seed=42&v=1785088796','free','seed','42'],
    ['?mode=daily&date=2026-10-30&v=1785088796','daily','date','2026-10-30'],
  ]) {
    await page.goto('/'+query);
    await expect(page.locator('#daily')).toBeVisible();
    const url=new URL(page.url());
    expect(url.pathname,query).toBe('/');
    expect(url.searchParams.get('mode'),query).toBe(mode);expect(url.searchParams.get(key),query).toBe(value);
    await expect(page.locator('#'+mode)).toHaveAttribute('aria-pressed','true');
  }
  // The shared replay link still carries no language, and DAILY keeps its record key.
  await page.goto('/?mode=daily&date=2026-11-01&lang=ja');
  expect(new URL(page.url()).searchParams.has('lang')).toBe(false);
  await expect(page.locator('#story')).toHaveAttribute('href','select.html?lang=ja');
  expect(errors).toEqual([]);
});

test('STORY → FREE RUN → STORY keeps the language even where nothing can be saved',async({page})=>{
  const errors=errorsOf(page);
  await page.addInitScript(()=>{Object.defineProperty(window,'localStorage',{configurable:true,get(){throw new DOMException('blocked','SecurityError');}});});
  await page.goto('/story.html');expect(await lang(page)).toBe('en');
  await page.locator('#language').click();
  expect(await lang(page)).toBe('ja');
  expect(new URL(page.url()).searchParams.get('lang'),'the address follows the switch').toBe('ja');
  await expect(page.locator('#to-free')).toHaveAttribute('href','select.html?lang=ja');
  await expect(page.locator('#title-free')).toHaveAttribute('href','index.html?mode=free&lang=ja');
  await page.reload();expect(await lang(page)).toBe('ja');
  await page.locator('#title-free').click();
  await expect(page.locator('#free')).toHaveAttribute('aria-pressed','true');
  expect(new URL(page.url()).searchParams.get('mode')).toBe('free');
  expect(await lang(page)).toBe('ja');
  // A reload keeps it too, while the address stays the exact replay link (no ?lang=).
  const replay=page.url();expect(new URL(replay).searchParams.has('lang')).toBe(false);
  await page.reload();expect(await lang(page)).toBe('ja');expect(page.url()).toBe(replay);
  await page.locator('#language').click();expect(await lang(page)).toBe('en');
  expect(page.url()).toBe(replay);
  await page.reload();expect(await lang(page)).toBe('en');
  await page.locator('#story').click();
  await expect(page).toHaveURL(/\/select\.html\?lang=en$/);expect(await lang(page)).toBe('en');
  await page.locator('#story').click();
  await expect(page).toHaveURL(/\/story\.html\?lang=en$/);expect(await lang(page)).toBe('en');
  // Switching back in STORY never leaves a stale ?lang= that would win on reload.
  await page.locator('#language').click();await page.locator('#language').click();
  expect(new URL(page.url()).searchParams.get('lang')).toBe('en');
  expect(errors).toEqual([]);
});

test('the STORY end card goes to FREE RUN (not DAILY) in the same language',async({page})=>{
  await page.addInitScript(()=>{delete window.AudioContext;delete window.webkitAudioContext;});
  await page.clock.install({time:new Date('2026-11-02T03:00:00Z')});
  await page.goto('/story.html?lang=ja&cp=end');await page.clock.pauseAt(new Date('2026-11-02T03:00:01Z'));
  await page.locator('#action').click();
  for(let i=0;i<80&&await page.locator('#end-actions').isHidden();i++) await page.clock.runFor(1000);
  await expect(page.locator('#end-actions')).toBeVisible();
  await page.locator('#end-free').click();
  await expect(page.locator('#free')).toHaveAttribute('aria-pressed','true');
  expect(new URL(page.url()).searchParams.get('mode')).toBe('free');expect(await lang(page)).toBe('ja');
});

test('inside an itch.io-style ZIP (a sub-folder, explicit index.html) every path is relative',async({page})=>{
  const errors=errorsOf(page),types={'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};
  await page.route('https://itch.test/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(!path.startsWith('/html/123/')) return route.fulfill({status:404,body:'outside the game folder: '+path});
    try{route.fulfill({status:200,contentType:types[extname(path)]||'application/octet-stream',body:await readFile(join('public',path.slice('/html/123/'.length)))});}
    catch{route.fulfill({status:404,body:'missing '+path});}
  });
  await page.goto('https://itch.test/html/123/index.html');
  await expect(page).toHaveURL('https://itch.test/html/123/select.html');
  await page.locator('#story').click();
  await expect(page.locator('#action')).toBeVisible();
  await page.locator('#title-free').click();
  await expect(page.locator('#free')).toHaveAttribute('aria-pressed','true');
  // FREE RUN rewrites its address to the replay link (a seed), in the same folder.
  expect(page.url()).toMatch(/^https:\/\/itch\.test\/html\/123\/index\.html\?mode=free&seed=\d+&v=4$/);
  expect(await lang(page)).toBe('en');
  await page.locator('#story').click();
  await expect(page).toHaveURL('https://itch.test/html/123/select.html?lang=en');
  for(const id of ['workshop','tower']){await page.locator('#'+id).click();await expect(page.locator('#to-select')).toBeVisible();await page.locator('#to-select').click();await expect(page).toHaveURL('https://itch.test/html/123/select.html?lang=en');}
  await page.locator('#story').click();
  await expect(page).toHaveURL('https://itch.test/html/123/story.html?lang=en');
  expect(errors).toEqual([]);
});

test('Cloudflare assets: the top opens the select and index.html?mode=free opens FREE RUN',async({page})=>{
  await page.goto('http://127.0.0.1:8011/');
  await expect(page.locator('#free')).toBeVisible();expect(new URL(page.url()).pathname).toMatch(/^\/select(\.html)?$/);
  await page.locator('#free').click();
  await expect(page.locator('#free')).toHaveAttribute('aria-pressed','true');
  const url=new URL(page.url());expect(url.searchParams.get('mode')).toBe('free');expect(url.searchParams.get('lang')).toBe(null);
  expect(await lang(page)).toBe('en');
});

for(const [width,height] of [[360,640],[390,844]]) test(`STORY start screen fits ${width}×${height}`,async({page})=>{
  await mkdir(dir,{recursive:true});await page.setViewportSize({width,height});
  for(const l of ['en','ja']) {
    await page.goto('/story.html?lang='+l);
    const box=id=>page.locator(id).boundingBox();
    const area=await box('.play-area'),items=[];
    for(const id of ['#overlay-title','#overlay-subtitle','#auto-hop','.intro-controls','#headphones','#action']) {
      const b=await box(id);expect(b,id).not.toBeNull();
      expect(b.y,id+' inside the play area').toBeGreaterThanOrEqual(area.y);expect(b.y+b.height,id+' inside the play area').toBeLessThanOrEqual(area.y+area.height+.5);
      expect(b.x).toBeGreaterThanOrEqual(0);expect(b.x+b.width).toBeLessThanOrEqual(width);
      items.push([id,b]);
    }
    for(let i=1;i<items.length;i++) expect(items[i][1].y,items[i][0]+' below '+items[i-1][0]).toBeGreaterThanOrEqual(items[i-1][1].y+items[i-1][1].height-.5);
    // Both title buttons on one row, clear of the hero at the top of its hop (canvas y 444 - 81).
    const story=await box('#action'),free=await box('#title-free');
    expect(Math.abs(story.y-free.y)).toBeLessThan(1);
    expect(story.x+story.width).toBeLessThanOrEqual(free.x);
    expect(Math.max(story.y+story.height,free.y+free.height),'buttons above the hero').toBeLessThanOrEqual(area.y+area.height*(444-81)/510);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({path:`${dir}/story-start-${width}x${height}-${l}.png`});
  }
});
