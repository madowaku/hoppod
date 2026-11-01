import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
test.use({trace:'off'});
async function open(page,query='?mode=free&seed=42&lang=en') {
  await page.clock.install({time:new Date('2026-11-01T03:00:00Z')});
  await page.goto('/'+query);await page.clock.pauseAt(new Date('2026-11-01T03:00:01Z'));
}
test('mouse settings clicks do not steal the next Space speed input',async({page})=>{
  await open(page);await page.locator('#action').click();await page.clock.runFor(32);
  for(const setting of ['language','sound']){
    await page.locator('#'+setting).click();await page.keyboard.down('Space');
    await expect(page.locator('#hold-state')).toHaveText('FAST');
    await page.keyboard.up('Space');await expect(page.locator('#hold-state')).toHaveText('SLOW');
    await expect(page.locator('#overlay')).toBeHidden();
  }
});
test('legacy marker-only URL is canonical C, paired comparison URL stays developer-only',async({page})=>{
  await open(page,'?mode=free&seed=7&marker=full');
  await expect(page.locator('#marker-off')).toHaveAttribute('aria-pressed','true');
  expect(new URL(page.url()).searchParams.has('marker')).toBe(false);
  await page.goto('/?mode=free&seed=7&marker=full&compare=1');
  await expect(page.locator('#marker-full')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#marker-compare')).toBeVisible();
});

test.describe('touch settings audit',()=>{
  test.use({hasTouch:true,isMobile:true,viewport:{width:320,height:640}});
  test('secondary touch on settings preserves held FAST; primary settings tap and cancel stay safe',async({page})=>{
    await open(page,'?mode=free&seed=7&lang=ja');await page.locator('#action').tap();await page.clock.runFor(32);
    const hold=await page.locator('#hold').boundingBox(),lang=await page.locator('#language').boundingBox();
    const p1={x:hold.x+hold.width/2,y:hold.y+hold.height/2,id:1},p2={x:lang.x+lang.width/2,y:lang.y+lang.height/2,id:2};
    const cdp=await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p1]});
    await expect(page.locator('#hold-state')).toHaveText('FAST');
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p1,p2]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[p2]});
    // Browsers may suppress a secondary-finger click. Either way it must
    // neither cancel the first pointer nor reset/obstruct the current run.
    await expect(page.locator('#hold-state')).toHaveText('FAST');await expect(page.locator('#score')).toHaveText('0');
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await expect(page.locator('#hold-state')).toHaveText('SLOW');
    const before=await page.locator('html').getAttribute('lang');await page.locator('#language').tap();
    await expect(page.locator('html')).toHaveAttribute('lang',before==='ja'?'en':'ja');
    await expect(page.locator('#overlay')).toBeHidden();
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p1]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await expect(page.locator('#hold-state')).toHaveText('SLOW');
  });
});

test('real Web Audio worst-case milestone/pickup/boot/bell mix has headroom and cancels on mute',async({page})=>{
  await page.goto('/');await mkdir('output/audit',{recursive:true});
  const metrics=await page.evaluate(async()=>{
    const {createAudio}=await import('/src/audio.mjs'),Native=window.AudioContext;
    async function render(mute){
      const off=new OfflineAudioContext(1,48000*3,48000);let now=0;
      window.AudioContext=class{get state(){return'running';}get currentTime(){return now;}get destination(){return off.destination;}createGain(){return off.createGain();}createOscillator(){return off.createOscillator();}createDynamicsCompressor(){return off.createDynamicsCompressor();}};
      const a=createAudio();a.unlock();a.play('land',100);a.pickup(.03);a.boot(.75);a.bell(1.17);
      if(mute){now=.1;a.toggle();}else{now=.78;a.play('land',101);now=1.56;a.play('land',102);a.bell(.39);}
      const data=(await off.startRendering()).getChannelData(0);let peak=0,tail=0;for(let i=0;i<data.length;i++){peak=Math.max(peak,Math.abs(data[i]));if(i>48000*.13)tail=Math.max(tail,Math.abs(data[i]));}return{peak,tail};
    }
    try{return{mix:await render(false),muted:await render(true)};}finally{window.AudioContext=Native;}
  });
  expect(metrics.mix.peak).toBeLessThan(.25);expect(metrics.mix.peak).toBeGreaterThan(.07);expect(metrics.muted.tail).toBe(0);
  await writeFile('output/audit/audio-mix.json',JSON.stringify(metrics,null,2));
});

test('1001 hops using only rendered footing and blue pixels: crew, JA/EN, PNG, bounded caches',async({page})=>{
  test.setTimeout(600000);
  await mkdir('output/audit',{recursive:true});
  await page.addInitScript(()=>localStorage.setItem('hoppod.pref.muted','1'));
  await page.route('**/src/app.mjs',async route=>{
    const response=await route.fetch();await route.fulfill({response,body:await response.text()+`
window.__auditRead=()=>({x:state.x,phase:state.phase,hops:state.hops,status:state.status,
collected:[...parts.collected],complete:parts.complete,crewAge,
retained:{ground:terrain.platforms.length,plan:terrain.plan.size,motifs:terrain.motifs.length,
shadow:layout.terrain.platforms.length,shadowPlan:layout.terrain.plan.size,slots:layout.slots.size??layout.slots.length,particles:particles.length,flights:flights.length}});`});
  });
  await open(page,'?mode=free&seed=42&lang=ja');await page.locator('#action').click();await page.clock.runFor(32);
  const readings=[];
  async function pick() {
    return page.evaluate(()=>{
      const s=window.__auditRead(),left=.78-s.phase,lo=80+105*left,hi=80+270*left;
      const g=document.getElementById('play').getContext('2d'),row=g.getImageData(0,383,360,1).data;
      const lit=x=>{const i=x*4;return(row[i]===168&&row[i+1]===183&&row[i+2]===165)||(row[i]===237&&row[i+1]===207&&row[i+2]===152);};
      const segments=[];let begin=null;
      for(let x=0;x<=360;x++){if(x<360&&lit(x)){begin??=x;}else if(begin!==null){const a=Math.max(begin+5,lo),b=Math.min(x-6,hi);if(a<=b)segments.push([a,b]);begin=null;}}
      const area=g.getImageData(0,362,360,20).data,blue=[];
      for(let x=Math.ceil(lo);x<=Math.floor(hi);x++){
        let n=0;for(let y=0;y<20;y++){const i=(y*360+x)*4;if((area[i]===169&&area[i+1]===214&&area[i+2]===255)||(area[i]===79&&area[i+1]===157&&area[i+2]===255))n++;}
        if(n>=2)blue.push(x);
      }
      const part=blue.length?blue.reduce((a,b)=>a+b,0)/blue.length:null;
      const viablePart=part!==null&&segments.some(([a,b])=>part>=a&&part<=b);
      const range=segments.at(-1),target=viablePart?part:range?(range[0]+range[1])/2:null;
      const unsafe=[];for(let x=Math.ceil(lo)+5;x<Math.floor(hi)-5;x++)if(!Array.from({length:11},(_,i)=>lit(x+i-5)).some(Boolean))unsafe.push(x);
      return{s,left,target,bad:unsafe.length?unsafe[Math.floor(unsafe.length/2)]:null,segments};
    });
  }
  async function steer(target,left){
    const ms=Math.round(Math.max(0,Math.min(left,(target-80-105*left)/165))*1000);
    if(ms>0){await page.keyboard.down('Space');await page.clock.runFor(ms);await page.keyboard.up('Space');}
    await page.clock.runFor(Math.round(left*1000)-ms+20);
  }
  for(let hop=1;hop<=1001;hop++){
    const p=await pick();expect(p.target,`no visible footing at hop ${hop}`).not.toBeNull();await steer(p.target,p.left);
    const s=await page.evaluate(()=>window.__auditRead());expect(s.hops).toBe(hop);expect(s.status).toBe('playing');
    expect(s.retained.ground).toBeLessThan(40);expect(s.retained.shadow).toBeLessThan(80);expect(s.retained.shadowPlan).toBeLessThan(100);expect(s.retained.slots).toBeLessThan(10);
    if([100,300,1001].includes(hop)){
      readings.push(s);await page.screenshot({path:`output/audit/pixel-route-${hop}.png`,fullPage:true});
      await page.locator('#language').click();expect((await page.evaluate(()=>window.__auditRead())).x).toBe(s.x);
      await expect(page.locator('#overlay')).toBeHidden();
    }
  }
  expect(readings.at(-1).collected.length).toBe(3);expect(readings.at(-1).complete).toBe(true);
  let p=await pick();for(let i=0;p.bad===null&&i<15;i++){await steer(p.target,p.left);p=await pick();}
  expect(p.bad).not.toBeNull();await steer(p.bad,p.left);await expect(page.locator('#share-actions')).toBeVisible();
  const ended=await page.evaluate(()=>window.__auditRead());
  for(const width of [390,320]){await page.setViewportSize({width,height:844});await page.screenshot({path:`output/audit/result-${width}.png`,fullPage:true});}
  // Toggle on the result without resetting it, and save both actual cards.
  for(let i=0;i<2;i++){
    const lang=await page.locator('html').getAttribute('lang');const download=page.waitForEvent('download');await page.locator('#save').click();await(await download).saveAs(`output/audit/card-${lang}.png`);
    await page.locator('#language').click();await expect(page.locator('#result-score')).toHaveText(String(ended.hops));
  }
  const glyphs=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=50;c.height=50;const g=c.getContext('2d');g.font='32px monospace';return [...'青地球部品動'].map(ch=>{g.clearRect(0,0,50,50);g.fillText(ch,0,35);return c.toDataURL();});});
  expect(new Set(glyphs).size,'Japanese must not collapse to identical missing-glyph boxes').toBeGreaterThanOrEqual(5);
  expect(await page.evaluate(()=>localStorage.getItem('hoppod.best.v4.free.marker.off'))).toBe(String(ended.hops));
  await page.evaluate(()=>{window.open=url=>window.__auditShare=url;});await page.locator('#share').click();
  const share=new URL(await page.evaluate(()=>window.__auditShare));expect(new URL(share.searchParams.get('url')).searchParams.get('seed')).toBe('42');
  expect(share.searchParams.get('url')).toBe(page.url());
  await writeFile('output/audit/long-browser.json',JSON.stringify({readings,ended},null,2));
});
