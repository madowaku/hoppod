import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {Terrain,isSafe,PERIOD,SLOW_SPEED,FAST_SPEED,footing} from '../../public/src/engine.mjs';
const dir='output/review';
// These hooks are appended to the response by the test, never shipped.
async function hooks(page) {
  await page.route('**/src/app.mjs',async route=>{
    const response=await route.fetch();
    await route.fulfill({response,body:await response.text()+`
window.__review={audio,snapshot:()=>({...state,earth:earthRise(state.x)}),
scene(x,hops,platforms){state={...newRun(),x,hopStartX:x,hops};if(platforms)terrain.platforms=platforms;running=false;paused=false;get('overlay').hidden=true;draw(0);},
result(){state.status='dead';endRun();draw(0);}};`});
  });
}
async function open(page,query='?mode=free&seed=42') {
  await mkdir(dir,{recursive:true});await hooks(page);
  await page.clock.install({time:new Date('2026-11-01T03:00:00Z')});
  await page.goto('/'+query);await page.clock.pauseAt(new Date('2026-11-01T03:00:01Z'));
}
async function start(page) {await page.locator('#action').click();await page.clock.runFor(32);}

test('review: running and delayed 100-HOPS voices end on mute, retry, pause and course change',async({page})=>{
  await page.addInitScript(()=>{
    window.__voices=[];
    const create=AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator=function(){
      const o=create.call(this),record={ended:false,stopAt:0};window.__voices.push(record);
      o.addEventListener('ended',()=>record.ended=true);
      const stop=o.stop.bind(o);o.stop=t=>{record.stopAt=t;stop(t);};return o;
    };
  });
  await open(page);await start(page);
  for(const action of ['mute','retry','pause','mode']) {
    await page.evaluate(()=>window.__review.audio.play('land',100));
    const begin=await page.evaluate(()=>window.__voices.length-6);
    expect(begin).toBeGreaterThanOrEqual(0);
    if(action==='mute') await page.locator('#sound').click();
    if(action==='retry') await page.keyboard.press('r');
    if(action==='pause') await page.keyboard.press('Escape');
    if(action==='mode') await page.locator('#daily').click();
    await expect.poll(()=>page.evaluate(i=>window.__voices.slice(i).every(o=>o.ended),begin),{timeout:1000}).toBe(true);
    if(action==='mute') await page.locator('#sound').click();
    if(action==='pause') await page.locator('#action').click();
  }
});

test('review: actual Web Audio render has headroom and mute cancels sustained and scheduled notes',async({page})=>{
  await page.goto('/');
  const rendered=await page.evaluate(async()=>{
    const {createAudio}=await import('/src/audio.mjs');
    const Native=window.AudioContext;
    async function render({accents=true,mute=false,ordinary=false}={}) {
      const offline=new OfflineAudioContext(1,48000*2,48000);let at=0;
      window.AudioContext=class{
        get state(){return 'running';}get currentTime(){return at;}get destination(){return offline.destination;}
        createOscillator(){return offline.createOscillator();}createGain(){return offline.createGain();}
        createDynamicsCompressor(){return offline.createDynamicsCompressor();}
      };
      const audio=createAudio({accents});audio.unlock();audio.play('land',ordinary?9:100);
      if(mute){at=.10;audio.toggle();}else if(!ordinary){at=.78;audio.play('land',101);at=1.56;audio.play('land',102);}
      const buffer=await offline.startRendering();const data=buffer.getChannelData(0);
      let peak=0,late=0,energy=0;for(let i=0;i<data.length;i++){peak=Math.max(peak,Math.abs(data[i]));energy+=data[i]**2;if(i>48000*.13)late=Math.max(late,Math.abs(data[i]));}
      let wav;
      if(!mute&&!ordinary){
        const bytes=new Uint8Array(44+data.length*2),view=new DataView(bytes.buffer);
        const text=(at,s)=>[...s].forEach((c,i)=>view.setUint8(at+i,c.charCodeAt(0)));
        text(0,'RIFF');view.setUint32(4,bytes.length-8,true);text(8,'WAVE');text(12,'fmt ');
        view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,48000,true);view.setUint32(28,96000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);
        text(36,'data');view.setUint32(40,data.length*2,true);for(let i=0;i<data.length;i++)view.setInt16(44+i*2,Math.round(Math.max(-1,Math.min(1,data[i]))*32767),true);
        let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));wav=btoa(binary);
      }
      return {peak,late,rms:Math.sqrt(energy/data.length),samples:Array.from(data.slice(0,12000)),wav};
    }
    try{
      const layered=await render(),classic=await render({accents:false}),muted=await render({mute:true});
      const ordinary=await render({ordinary:true}),ordinaryClassic=await render({accents:false,ordinary:true});
      const same=ordinary.samples.every((v,i)=>v===ordinaryClassic.samples[i]);
      return {layered:{peak:layered.peak,rms:layered.rms},classic:{peak:classic.peak,rms:classic.rms},muteTail:muted.late,ordinaryIdentical:same,clips:{layered:layered.wav,classic:classic.wav}};
    }finally{window.AudioContext=Native;}
  });
  const {clips,...metrics}=rendered;
  for(const [name,data] of Object.entries(clips))await writeFile(`${dir}/hundred-${name}.wav`,Buffer.from(data,'base64'));
  await writeFile(dir+'/audio-metrics.json',JSON.stringify(metrics,null,2));
  expect(metrics.layered.peak).toBeGreaterThan(0);expect(metrics.layered.peak).toBeLessThan(.15);
  expect(metrics.muteTail).toBeLessThan(.00001);expect(metrics.ordinaryIdentical).toBe(true);
});

test('review: classic query works with blocked sessionStorage and survives normalization',async({page})=>{
  await page.addInitScript(()=>Object.defineProperty(window,'sessionStorage',{get(){throw new Error('blocked');}}));
  await open(page,'?mode=free&seed=42&sfx=classic');
  expect(await page.evaluate(()=>window.__review.audio.accents)).toBe(false);
  expect(new URL(page.url()).searchParams.has('sfx')).toBe(false);
  await start(page);await page.keyboard.press('r');
  expect(await page.evaluate(()=>window.__review.audio.accents)).toBe(false);
});

test('review: 193 keyboard hops; each milestone once; high-score scene, PNG and v4 persistence',async({page})=>{
  test.setTimeout(120000);
  await page.addInitScript(()=>{
    window.__milestones=[];const create=AudioContext.prototype.createDynamicsCompressor;
    AudioContext.prototype.createDynamicsCompressor=function(){window.__buses=(window.__buses||0)+1;return create.call(this);};
    localStorage.setItem('hoppod.best.v2.free','999');
  });
  await open(page);
  await page.evaluate(()=>{const a=window.__review.audio,p=a.play;a.play=(kind,hops)=>{if(kind==='land'&&hops%10===0)window.__milestones.push(hops);return p(kind,hops);};});
  await expect(page.locator('#best')).toHaveText('0');await start(page);
  const t=new Terrain(42),captures=[50,100,150,193];
  for(let hop=1;hop<=193;hop++) {
    t.extendTo(hop*220+4000);
    // Do not blindly replay the ideal reference hold time: small browser event
    // timing differences accumulate across 193 hops, especially on narrow v4
    // terrain. Steer from the ACTUAL browser state to a reachable safe interval.
    const current=await page.evaluate(()=>window.__review.snapshot());
    expect(current.status).toBe('playing');
    expect(current.hops).toBe(hop-1);
    const remaining=PERIOD-current.phase,low=current.x+SLOW_SPEED*remaining,high=current.x+FAST_SPEED*remaining;
    const windows=t.platforms.map(footing).map(([a,b])=>[
      Math.max(a+12,low),Math.min(b-12,high)
    ]).filter(([a,b])=>a<=b);
    expect(windows.length).toBeGreaterThan(0);
    const reference=t.planPositions.get(hop);
    const targets=windows.map(([a,b])=>Math.max(a,Math.min(b,reference)));
    const target=targets.reduce((best,x)=>Math.abs(x-reference)<Math.abs(best-reference)?x:best);
    const duration=Math.max(0,Math.min(remaining,(target-low)/(FAST_SPEED-SLOW_SPEED)));
    const hold=Math.round(duration*1000);
    if(hold>0){await page.keyboard.down('Space');await page.clock.runFor(hold);await page.keyboard.up('Space');}
    await page.clock.runFor(Math.max(0,Math.ceil(remaining*1000)-hold)+16);
    // The extra frame guarantees a hop-end rAF and is accounted for using
    // current.phase on the next iteration. Score must never skip a landing.
    await expect(page.locator('#score')).toHaveText(String(hop));
  }
  expect(await page.evaluate(()=>window.__milestones)).toEqual(Array.from({length:19},(_,i)=>(i+1)*10));
  expect(await page.evaluate(()=>window.__buses)).toBe(1);
  // Choose a real failing input from the current reachable interval, then
  // exercise the actual endRun/save/share paths without changing the score.
  const s=await page.evaluate(()=>window.__review.snapshot());t.extendTo(s.x+2000);
  const remaining=.78-s.phase;let hold;
  for(let d=0;d<remaining;d+=.001){const x=s.x+105*remaining+165*d;if(!isSafe(t,x-5)&&!isSafe(t,x+5)&&!isSafe(t,x)){hold=d;break;}}
  expect(hold).toBeDefined();
  await page.keyboard.down('Space');await page.clock.runFor(Math.round(hold*1000));await page.keyboard.up('Space');await page.clock.runFor(Math.round((remaining-hold)*1000)+48);
  await expect(page.locator('#result-score')).toHaveText('193');
  for(const width of [390,320]){await page.setViewportSize({width,height:844});await page.screenshot({path:`${dir}/result-193-${width}.png`,fullPage:true});}
  const download=page.waitForEvent('download');await page.locator('#save').click();await(await download).saveAs(dir+'/score-193.png');
  await page.evaluate(()=>{window.open=url=>window.__shared=url;});await page.locator('#share').click();
  const share=new URL(await page.evaluate(()=>window.__shared));expect(new URL(share.searchParams.get('url')).searchParams.get('v')).toBe('4');
  expect(share.searchParams.get('text')).toContain('193 HOPS');
  expect(await page.evaluate(()=>localStorage.getItem('hoppod.best.v4.free'))).toBe('193');
  await page.reload();await expect(page.locator('#best')).toHaveText('193');
});

test('review: rendered 16px pit and merged seam match collision; Earth does not recolor the ring',async({page})=>{
  await open(page);await start(page);
  await page.evaluate(()=>window.__review.scene(75,0,[[0,200],[216,450]]));
  const pixels=await page.evaluate(()=>{const g=document.getElementById('play').getContext('2d');return [197,205,213,221,229].map(x=>[...g.getImageData(x,383,1,1).data].slice(0,3));});
  expect(pixels[0]).toEqual([4,8,12]);expect(pixels[2]).toEqual([4,8,12]);expect(pixels[4]).not.toEqual([4,8,12]);
  await page.screenshot({path:dir+'/pit-16.png'});
  await page.evaluate(()=>window.__review.scene(75,0,[[0,450]]));
  expect(await page.evaluate(()=>[...document.getElementById('play').getContext('2d').getImageData(213,383,1,1).data].slice(0,3))).not.toEqual([4,8,12]);
  for(const [x,hops] of [[10000,60],[17000,100],[25000,150],[33000,200]]) {
    await page.evaluate(({x,hops})=>window.__review.scene(x,hops,[[x-100,x+500]]),{x,hops});
    const mint=await page.evaluate(()=>{const d=document.getElementById('play').getContext('2d').getImageData(145,374,38,12).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]===142&&d[i+1]===230&&d[i+2]===196)n++;return n;});
    expect(mint).toBeGreaterThan(0);
  }
});

test('review: real Wrangler excludes the sound bench and metadata from static assets',async({request})=>{
  for(const path of ['/','/src/app.mjs','/src/audio.mjs','/src/earth.mjs'])
    expect((await request.get('http://127.0.0.1:8011'+path)).status()).toBe(200);
  for(const path of ['/dev/sfx.html','/dev/sfx','/.assetsignore'])
    expect((await request.get('http://127.0.0.1:8011'+path)).status()).toBe(404);
  // The Python authoring server intentionally keeps the comparison page.
  expect((await request.get('/dev/sfx.html')).status()).toBe(200);
});

test('review: compare current and delayed full-disc timing at 100, 150 and 193 hops',async({page})=>{
  await page.goto('/');await mkdir(dir,{recursive:true});
  const t=new Terrain(42);t.extendTo(40000);
  const points=[100,150,193].map(hops=>({hops,x:t.planPositions.get(hops)}));
  const comparison=await page.evaluate(async points=>{
    const {earthRise,earthCenterY,drawEarth}=await import('/src/earth.mjs');
    const c=document.createElement('canvas');c.id='earth-comparison';c.width=720;c.height=620;document.body.replaceChildren(c);
    const g=c.getContext('2d');const rows=[];g.fillStyle='#101f2c';g.fillRect(0,0,720,620);
    for(let row=0;row<2;row++)for(let i=0;i<points.length;i++){
      const {hops,x}=points[i],full=row?24750:16500,clamp=n=>Math.max(0,Math.min(1,n));
      const sky=row?{rise:clamp((x-3300)/(full-3300)),climb:clamp((x-full)/(33000-full))}:earthRise(x);
      const y=earthCenterY(sky,230,28,62);rows.push({full,hops,x,y});
      g.save();g.translate(i*240,row*310);g.fillStyle='#fff0d0';g.font='13px monospace';g.fillText(`${hops} HOPS`,20,30);
      g.fillStyle='#9db4b6';g.font='11px monospace';g.fillText(row?'Full ~150 (proposal)':'Full ~100 (current)',20,51);
      drawEarth(g,175,y,28,0);g.fillStyle='#0d1a24';g.fillRect(0,230,240,80);
      g.fillStyle='#9db4b6';g.fillText(`distance ${Math.round(x)}px`,20,280);g.restore();
    }
    return rows;
  },points);
  await page.locator('#earth-comparison').screenshot({path:dir+'/earth-timing-comparison.png'});
  await writeFile(dir+'/earth-comparison.json',JSON.stringify(comparison,null,2));
  expect(comparison).toHaveLength(6);
});
