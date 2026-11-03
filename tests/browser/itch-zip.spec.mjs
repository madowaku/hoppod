import {test,expect} from '@playwright/test';
import {inflateRawSync} from 'node:zlib';
import {extname} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {playableFiles,buildZip} from '../../scripts/build-itch.mjs';
// The itch.io upload itself: the ZIP that scripts/build-itch.mjs writes is
// read back here and served from a sub-folder of another origin, inside an
// iframe on an itch-like page, as itch.io embeds HTML games.
function unzip(zip) {
  const files=new Map(),end=zip.lastIndexOf(Buffer.from([0x50,0x4b,0x05,0x06]));
  let at=zip.readUInt32LE(end+16);
  for(let i=0;i<zip.readUInt16LE(end+10);i++){
    const method=zip.readUInt16LE(at+10),size=zip.readUInt32LE(at+20),nameLength=zip.readUInt16LE(at+28),extra=zip.readUInt16LE(at+30),comment=zip.readUInt16LE(at+32),local=zip.readUInt32LE(at+42);
    const name=zip.toString('utf8',at+46,at+46+nameLength),start=local+30+zip.readUInt16LE(local+26)+zip.readUInt16LE(local+28),body=zip.subarray(start,start+size);
    files.set(name,method===8?inflateRawSync(body):body);at+=46+nameLength+extra+comment;
  }
  return files;
}
const TYPES={'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};
const GAME='https://html.itch.test/html/123/';

// itch.io loads the game with a build stamp: index.html?v=<number>.
const embed=src=>`<!doctype html><title>itch</title><body style="margin:0;background:#222"><iframe id="game" src="${GAME}${src}" width="360" height="640" allow="autoplay; fullscreen" style="border:0"></iframe></body>`;

test("the itch.io ZIP opens on the STORY title inside an embed iframe (with itch.io's ?v= stamp) and plays",async({page})=>{
  const zip=await buildZip(await playableFiles()),files=unzip(zip),missing=[],errors=[];
  await mkdir('output/itch',{recursive:true});await writeFile('output/itch/rapippo.zip',zip);
  expect([...files.keys()].some(n=>n.startsWith('dev/')||n.startsWith('.')),'no developer files').toBe(false);
  expect(files.has('index.html')).toBe(true);
  await page.route('https://html.itch.test/**',route=>{
    const url=new URL(route.request().url()),name=url.pathname.startsWith('/html/123/')?url.pathname.slice('/html/123/'.length):null;
    if(name===null||!files.has(name)){missing.push(url.pathname);return route.fulfill({status:404,body:'not in the ZIP'});}
    return route.fulfill({status:200,contentType:TYPES[extname(name)]||'application/octet-stream',body:files.get(name)});
  });
  await page.route('https://itch.test/game',route=>route.fulfill({status:200,contentType:'text/html',
    body:embed('index.html?v=1785088796')}));
  page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:400,height:700});
  await page.goto('https://itch.test/game');
  const game=page.frameLocator('#game');
  await expect(game.locator('#action')).toHaveText('STORY');
  // Straight to the STORY title: the stamp is not a FREE RUN address.
  expect(page.frames().find(f=>f.url().startsWith(GAME)).url()).toBe(GAME+'story.html');
  await expect(game.locator('#title-free')).toBeVisible();await expect(game.locator('#daily')).toHaveCount(0);
  // It plays: a few beats in, pause and resume from the touch button.
  await game.locator('#action').click();
  await expect(game.locator('#pause')).toBeVisible();
  await page.waitForTimeout(1800);
  await game.locator('#pause').click();await expect(game.locator('#overlay')).toHaveAttribute('data-screen','pause');
  await game.locator('#action').click();await expect(game.locator('#pause')).toBeVisible();
  await page.screenshot({path:'output/itch/embed-play.png'});
  // FREE RUN and back, all inside the folder, in the same language.
  await game.locator('#pause').click();await game.locator('#to-free').click();
  await expect(game.locator('#free')).toHaveAttribute('aria-pressed','true');
  await game.locator('#story').click();await expect(game.locator('#action')).toHaveText('STORY');
  expect(missing,'every request is a file in the ZIP').toEqual([]);
  expect(errors).toEqual([]);
});

test('in the itch.io iframe, FREE RUN and replay links with the stamp still open FREE RUN',async({page})=>{
  const files=unzip(await buildZip(await playableFiles()));
  await page.route('https://html.itch.test/**',route=>{
    const name=new URL(route.request().url()).pathname.slice('/html/123/'.length);
    return files.has(name)?route.fulfill({status:200,contentType:TYPES[extname(name)]||'application/octet-stream',body:files.get(name)}):route.fulfill({status:404,body:'not in the ZIP'});
  });
  for(const [query,mode,key,value] of [['mode=free&v=1785088796','free',null,null],['mode=free&seed=42&v=4&v=1785088796','free','seed','42'],['mode=daily&date=2026-10-30&v=1785088796','daily','date','2026-10-30']]) {
    await page.route('https://itch.test/game',route=>route.fulfill({status:200,contentType:'text/html',body:embed('index.html?'+query)}));
    await page.goto('https://itch.test/game');
    const game=page.frameLocator('#game');
    await expect(game.locator('#'+mode),query).toHaveAttribute('aria-pressed','true');
    const url=new URL(page.frames().find(f=>f.url().startsWith(GAME)).url());
    expect(url.pathname).toBe('/html/123/index.html');
    if(key) expect(url.searchParams.get(key)).toBe(value);
    await page.unroute('https://itch.test/game');
  }
});
