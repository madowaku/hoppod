import assert from 'node:assert/strict';
import test from 'node:test';
import {PERIOD,SLOW_SPEED,FAST_SPEED,INSET,Terrain,newRun,advance,isSafe,predictLanding,landingMiss} from '../public/src/engine.mjs';
import {jstDate,validDate,resolveRun,shareUrl} from '../public/src/links.mjs';

test('first three hops accept every whole-hop FAST/SLOW combination',()=>{
  for(let seed=0;seed<128;seed++) for(let mask=0;mask<8;mask++) {
    const s=newRun(),t=new Terrain(seed);
    for(let h=0;h<3;h++) advance(s,t,PERIOD,Boolean(mask & (1<<h)));
    assert.equal(s.hops,3); assert.equal(s.status,'playing');
  }
});

test('128 seeds, 300 hops: visible nearest-footing controller with ±60ms switch error',()=>{
  // No access to terrain.plan. Aim at a visible safe interval at least 16px
  // inside its landing bounds; each hop can start anywhere on the platform.
  for(let seed=0;seed<128;seed++) {
    const s=newRun(),t=new Terrain(seed);
    for(let h=0;h<300;h++) {
      const low=s.x+SLOW_SPEED*PERIOD,high=s.x+FAST_SPEED*PERIOD;
      const options=t.platforms.map(([a,b])=>[Math.max(a+INSET+16,low),Math.min(b-INSET-16,high)]).filter(([a,b])=>a<=b);
      assert.ok(options.length,`no recoverable landing: ${seed}/${h}/${s.x}`);
      const [a,b]=options[0],target=(a+b)/2;
      const hold=(target-low)/(FAST_SPEED-SLOW_SPEED);
      const error=[-.06,0,.06][h%3];
      const duration=Math.max(0,Math.min(PERIOD,hold+error));
      advance(s,t,duration,true); advance(s,t,PERIOD-duration,false);
      assert.equal(s.status,'playing',`seed ${seed}, hop ${h}, target ${target}`);
      assert.equal(s.hops,h+1);
    }
    assert.ok(t.platforms.length<30); assert.ok(t.beacons.length<20); assert.ok(t.plan.size<40);
  }
});

test('non-intro platform edge landings retain a next-hop solution with reaction margin',()=>{
  for(let seed=0;seed<128;seed++) {
    const t=new Terrain(seed);t.extendTo(50000);
    for(let i=1;i<t.platforms.length-1;i++) {
      const [a,b]=t.platforms[i];
      for(const x of [a+INSET,(a+b)/2,b-INSET]) {
        const low=x+SLOW_SPEED*PERIOD,high=x+FAST_SPEED*PERIOD;
        assert.ok(t.platforms.slice(i,i+2).some(([c,d])=>Math.min(d-INSET,high)-Math.max(c+INSET,low)>=20),`${seed}/${i}/${x}`);
      }
    }
  }
});

test('real 30/60/120/144Hz frame grid: identical event-time switches and predictions',()=>{
  for(const switchAt of [.03,.17,.39,.61,.75]) {
    const results=[];
    for(const hz of [30,60,120,144]) {
      const s=newRun(),t=new Terrain(88);let time=0;
      const switches=Array.from({length:12},(_,i)=>[i*PERIOD+switchAt,i*PERIOD+PERIOD]).flat();
      let index=0,fast=true;
      while(time<12*PERIOD-1e-9 && s.status==='playing') {
        const next=Math.min((Math.floor((time+1e-9)*hz)+1)/hz,switches[index] ?? Infinity,12*PERIOD);
        const predicted=predictLanding(s,fast);
        const willLand=s.phase+(next-time)>=PERIOD-1e-9;
        advance(s,t,next-time,fast);time=next;
        if(willLand) assert.ok(Math.abs(predicted-s.x)<1e-6);
        if(Math.abs(time-switches[index])<1e-8) {fast=!fast;index++;}
      }
      results.push([s.status,s.hops,Math.round(s.x*1e5)]);
    }
    results.forEach(r=>assert.deepEqual(r,results[0]));
  }
});

test('exact landing boundary does not award duplicate points; prediction uses collision inset',()=>{
  const s=newRun(),t=new Terrain(2);
  advance(s,t,PERIOD-1e-7,false);assert.equal(s.hops,0);
  advance(s,t,1e-7,false);assert.equal(s.hops,1);
  advance(s,t,0,false);assert.equal(s.hops,1);
  assert.equal(isSafe(t,INSET),true); assert.equal(isSafe(t,INSET-.01),false);
  assert.equal(isSafe(t,735-INSET),true);assert.equal(isSafe(t,735-INSET+.01),false);
});

test('failure advice uses the nearest supported edge, including the invisible inset',()=>{
  const t={platforms:[[0,100],[160,260]]};
  assert.equal(landingMiss(t,93),'far');assert.equal(landingMiss(t,167),'short');
  assert.equal(landingMiss(t,110),'far');assert.equal(landingMiss(t,150),'short');
});

test('32 seeds × 1000 aggressive hops: trimming is tied to world position, not score',()=>{
  for(let seed=0;seed<32;seed++) {
    const s=newRun(),t=new Terrain(seed);
    for(let h=0;h<1000;h++) {
      const low=s.x+SLOW_SPEED*PERIOD,high=s.x+FAST_SPEED*PERIOD;
      const options=t.platforms.map(([a,b])=>[Math.max(a+INSET+8,low),Math.min(b-INSET-8,high)]).filter(([a,b])=>a<=b);
      assert.ok(options.length);
      const [a,b]=options.at(-1),target=(a+b)/2,hold=(target-low)/(FAST_SPEED-SLOW_SPEED);
      advance(s,t,hold,true);advance(s,t,PERIOD-hold,false);
      assert.equal(s.status,'playing');
      assert.ok(t.plan.size<35);assert.equal(t.plan.size,t.planPositions.size);assert.ok(t.platforms.length<25);
    }
  }
});

test('daily date is JST, validates real calendar days, replays a shared past day',()=>{
  assert.equal(jstDate(new Date('2026-10-31T14:59:59Z')),'2026-10-31');
  assert.equal(jstDate(new Date('2026-10-31T15:00:00Z')),'2026-11-01');
  assert.equal(validDate('2026-02-30'),false);assert.equal(validDate('2028-02-29'),true);
  const a=resolveRun('https://example.com/?mode=daily&date=2026-10-31&seed=9','2026-11-01');
  const b=resolveRun(a.url,'2026-11-02');assert.equal(a.seed,b.seed);assert.equal(b.date,'2026-10-31');
  assert.equal(resolveRun('https://example.com/?date=2026-02-30','2026-11-01').date,'2026-11-01');
});

test('FREE RUN absence is random, zero is valid, invalid seeds normalize, share includes exact course',()=>{
  for(const search of ['?mode=free','?mode=free&seed=-1','?mode=free&seed=4294967296','?mode=free&seed='])
    assert.equal(resolveRun('https://example.com/'+search,'2026-11-01',()=>123).seed,123);
  for(const seed of [0,42,4294967295]) {
    const r=resolveRun('https://example.com/?mode=free&seed='+seed);
    assert.equal(r.seed,seed);assert.equal(resolveRun(r.url).seed,seed);
    const link=new URL(shareUrl(r,17,28));
    assert.equal(link.searchParams.get('url'),r.url);assert.match(link.searchParams.get('text'),/17 HOPS · BEST 28/);
    assert.equal(new URL(r.url).searchParams.get('v'),'2');
  }
});
