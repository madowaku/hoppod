import assert from 'node:assert/strict';
import test from 'node:test';
import {PERIOD,SLOW_SPEED,FAST_SPEED,INSET,MIN_GAP,INTRO_END,FIRST_GAP,Terrain,newRun,advance,isSafe,predictLanding,landingMiss,addPlatform,footing} from '../public/src/engine.mjs';

// P0: what is drawn as ground is ground. A pit is always a visible opening of
// at least MIN_GAP, and the only unsafe ground is the drawn INSET rim.

test('overlapping, touching and micro-gap platforms merge into one ground',()=>{
  const cases=[
    [[0,100],[90,200],[[0,200]]],                // overlap
    [[0,100],[100,200],[[0,200]]],               // touching
    [[0,100],[100+MIN_GAP-.01,200],[[0,200]]],   // invisible seam
    [[0,100],[20,60],[[0,100]]],                 // contained: never shortens
    [[0,100],[100+MIN_GAP,200],[[0,100],[100+MIN_GAP,200]]], // real pit stays
  ];
  for(const [first,next,expected] of cases) {
    const platforms=[[...first]];addPlatform(platforms,next);
    assert.deepEqual(platforms,expected,JSON.stringify([first,next]));
  }
  const t={platforms:[[0,200]]};
  assert.equal(isSafe(t,110),true,'former seam is solid footing after merge');
});

test('footing endpoints: collision equals the drawn flat top to the pixel edge',()=>{
  const t={platforms:[[100,300]]};
  assert.deepEqual(footing([100,300]),[100+INSET,300-INSET]);
  for(const [x,safe] of [[100+INSET,true],[100+INSET-.01,false],[300-INSET,true],[300-INSET+.01,false],[100,false],[300,false],[200,true]])
    assert.equal(isSafe(t,x),safe,String(x));
});

test('512 seeds: sorted ground, visible pits ≥ MIN_GAP, unsafe ground only on drawn rims',()=>{
  for(let seed=0;seed<512;seed++) {
    const t=new Terrain(seed);t.extendTo(30000);const p=t.platforms;
    assert.deepEqual(p[0],[0,INTRO_END]);
    assert.ok(p[1][0]-INTRO_END>=FIRST_GAP,`first pit seed ${seed}`);
    for(let i=0;i<p.length;i++) {
      const [a,b]=p[i];
      assert.ok(b-a>=2*INSET+80,`narrow footing ${seed}/${i}`);
      if(i) assert.ok(a-p[i-1][1]>=MIN_GAP,`seam ${seed}/${i}: ${p[i-1][1]}→${a}`);
    }
    // Sample the drawn world: an unsafe point inside a platform must be on its rim.
    for(let x=0,i=0;x<p.at(-1)[1];x+=1.7) {
      while(p[i][1]<x) i++;
      // Sorted and separated (asserted above), so neighbours decide isSafe.
      const own=x>=p[i][0]?p[i]:null,near={platforms:p.slice(Math.max(0,i-1),i+2)};
      if(own&&!isSafe(near,x)) assert.ok(Math.min(x-own[0],own[1]-x)<INSET+1e-6,`hidden pit ${seed} at ${x}`);
      if(!own) assert.equal(isSafe(near,x),false);
    }
  }
});

test('SLOW-only intro: seven hops, then a fall into the clearly visible first pit',()=>{
  for(let seed=0;seed<128;seed++) {
    const s=newRun(),t=new Terrain(seed);
    advance(s,t,PERIOD*12,false);
    assert.equal(s.hops,7);assert.equal(s.status,'dead');
    assert.ok(s.x>INTRO_END-INSET&&s.x<t.platforms[1][0],`fell at ${s.x}, seed ${seed}`);
    assert.ok(s.x-(INTRO_END-INSET)>10,'clearly past the footing, not a pixel judgement');
    assert.equal(landingMiss(t,s.x,s.hopStartX),'short');
  }
});

test('landing ring colour always equals the collision outcome at the current input',()=>{
  // Deterministic pseudo-random switching; at every step the ring's verdict
  // for the held input must equal the result of holding that input.
  let r=7;const rand=()=>(r=(r*1103515245+12345)>>>0)/2**32;
  for(let seed=0;seed<64;seed++) {
    const s=newRun(),t=new Terrain(seed);let fast=false;
    for(let step=0;step<1500&&s.status==='playing';step++) {
      if(rand()<.08) fast=!fast;
      const ghost={...s},world=new Terrain(seed);world.platforms=t.platforms.map(p=>[...p]);
      const ringSafe=isSafe(t,predictLanding(s,fast));
      advance(ghost,world,PERIOD-s.phase,fast);
      assert.equal(ghost.status==='playing',ringSafe,`seed ${seed} step ${step}`);
      advance(s,t,.02+rand()*.03,fast);
    }
  }
});

test('version-3 terrain keeps the reference route and first-three-hop guarantee',()=>{
  for(let seed=0;seed<128;seed++) {
    const t=new Terrain(seed);t.extendTo(8000);
    for(const [hop,x] of t.planPositions) assert.ok(isSafe(t,x),`reference ${seed}/${hop}`);
    assert.ok(75+3*PERIOD*FAST_SPEED<=INTRO_END-INSET);
    assert.ok(75+7*PERIOD*SLOW_SPEED<=INTRO_END-INSET);
  }
});
