import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {PartLayout,PartRun,PART_CATCH} from '../public/src/parts.mjs';
import {markerModeFromUrl} from '../public/src/marker.mjs';
import {Terrain,footing,PERIOD,SLOW_SPEED,FAST_SPEED} from '../public/src/engine.mjs';

test('official C policy: old marker-only links cannot restore a public prediction overlay',()=>{
  for(const mode of ['full','neutral']) {
    assert.equal(markerModeFromUrl('https://example.com/?marker='+mode),'off');
    assert.equal(markerModeFromUrl('https://example.com/?marker='+mode+'&compare=1'),mode);
  }
});

test('both part catch endpoints collect; just-outside landings do not complete or duplicate a part',()=>{
  for(const offset of [-PART_CATCH,PART_CATCH,-PART_CATCH-.001,PART_CATCH+.001]){
    const layout=new PartLayout(42),run=new PartRun(layout),slot=run.active;
    const result=run.land(slot.x+offset,slot.hop);
    assert.equal(run.collected.length,Math.abs(offset)<=PART_CATCH?1:0);
    assert.equal(run.complete,false);
    if(result?.type==='collect'){run.land(slot.x+offset,slot.hop);assert.equal(run.collected.length,1);}
    else assert.equal(run.active.part,layout.order[0]);
  }
});

test('missing 400 slots does not retain every shadow platform, reference landing and slot',()=>{
  const layout=new PartLayout(42),run=new PartRun(layout);
  for(let i=0;i<400;i++){const s=run.active;run.land(s.x+21,s.hop);}
  assert.equal(run.collected.length,0);
  assert.ok(layout.terrain.platforms.length<80,`shadow platforms: ${layout.terrain.platforms.length}`);
  assert.ok(layout.terrain.plan.size<100,`shadow reference points: ${layout.terrain.plan.size}`);
  assert.ok((layout.slots.size??layout.slots.length)<10,'slot cache must be bounded');
});

test('audit fixes preserve pre-audit first 100 part slots and order exactly',()=>{
  const golden=[
    [0,'9cc27b5dc045ca27d81321c82b82573b109d6d12e76fd91d3898a389083c79f6'],
    [1,'f5ed9a36f7257adf1572278ef37a910c1854970197006c139aaecfb23b2264c9'],
    [7,'23a85dffe9b46eb29eed778b86575d06435bf4bbcc3da41f071c3002a8f2e5e3'],
    [42,'dfeed68c89a30b3632a371d41eec12e79cb26b9589a2a43ab9ece2d495d8047f'],
    [4294967295,'bb5df172dc35e60fbdc6b279602f344d263f200150f425a6daeab7739998a547'],
  ];
  for(const [seed,expected] of golden){
    const layout=new PartLayout(seed),slots=Array.from({length:100},(_,i)=>layout.slot(i));
    assert.equal(createHash('sha256').update(JSON.stringify([layout.order,slots])).digest('hex'),expected);
    const streaming=new PartLayout(seed),run=new PartRun(streaming),actual=[];
    for(let i=0;i<100;i++){const s=run.active;actual.push({hop:s.hop,x:s.x});run.land(s.x+21,s.hop);}
    assert.equal(createHash('sha256').update(JSON.stringify([streaming.order,actual])).digest('hex'),expected);
    assert.deepEqual(streaming.slot(1),slots[1],'a historical research query replays without changing the live stream');
    assert.deepEqual(streaming.slot(0),slots[0]);
  }
});

test('dense interior audit: every sampled footing position retains a positive next-hop corridor',t=>{
  let points=0,least=Infinity,example;
  for(let seed=0;seed<256;seed++){
    const terrain=new Terrain(seed);terrain.extendTo(50000);
    for(let i=1;i<terrain.platforms.length-1;i++){
      const[a,b]=footing(terrain.platforms[i]),ground=terrain.platforms.slice(i,i+2).map(footing);
      for(let x=a;x<=b;x+=1.7){
        const width=Math.max(...ground.map(([l,r])=>Math.max(0,Math.min(r,x+PERIOD*FAST_SPEED)-Math.max(l,x+PERIOD*SLOW_SPEED))));points++;
        if(width<=0)assert.fail(`no corridor at seed ${seed}, platform ${i}, x=${x}`);
        if(width<least){least=width;example={seed,platform:i,x};}
      }
    }
  }
  t.diagnostic(JSON.stringify({points,minimumCorridor:least,example}));
});
