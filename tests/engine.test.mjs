import assert from 'node:assert/strict';
import test from 'node:test';
import {PERIOD,SLOW_SPEED,FAST_SPEED,Terrain,hashSeed,newRun,advance,isSafe,predictLanding} from '../public/src/engine.mjs';

test('keeps HOPSCROLL core timing and input speeds',()=>{
  assert.equal(PERIOD,0.78); assert.equal(SLOW_SPEED,105); assert.equal(FAST_SPEED,270);
  const s=newRun();assert.equal(predictLanding(s,false),75+PERIOD*SLOW_SPEED);
  assert.equal(predictLanding(s,true),75+PERIOD*FAST_SPEED);
});
test('deterministic generator creates reproducible geometry',()=>{
  const a=new Terrain(12345),b=new Terrain(12345);
  a.extendTo(10000);b.extendTo(10000);
  assert.deepEqual(a.platforms,b.platforms);
  assert.deepEqual(a.beacons,b.beacons);
  assert.deepEqual([...a.plan],[...b.plan]);
  assert.equal(hashSeed('HOPPOD-2026-10-31'),hashSeed('HOPPOD-2026-10-31'));
});
test('100 seeds: 100 safe reference landings, no terminal course',()=>{
  for(let seed=1;seed<=100;seed++){
    const terrain=new Terrain(seed),state=newRun();
    for(let i=0;i<100;i++){
      terrain.extendTo(state.x+1600);
      const fast=terrain.plan.get(state.hops+1);
      assert.equal(typeof fast,'boolean','plan present seed '+seed+' hop '+i);
      const events=advance(state,terrain,PERIOD,fast);
      assert.equal(state.status,'playing','seed '+seed+' hop '+i);
      assert.equal(state.hops,i+1);
      assert.ok(events.includes('land'));
      assert.ok(isSafe(terrain,state.x));
    }
    assert.ok(terrain.platforms.length<60,'trim keeps terrain bounded');
    assert.ok(terrain.plan.size<50,'trim keeps plan bounded');
  }
});
test('landing score is earned only on a successful landing',()=>{
  const terrain=new Terrain(1),s=newRun();
  advance(s,terrain,PERIOD/2,false);
  assert.equal(s.hops,0);assert.equal(s.status,'playing');
  advance(s,terrain,PERIOD/2,false);
  assert.equal(s.hops,1);
  const constantFast=newRun(),world=new Terrain(1);
  advance(constantFast,world,PERIOD*20,true);
  assert.equal(constantFast.status,'dead');
  const before=constantFast.hops;
  advance(constantFast,world,PERIOD*10,true);
  assert.equal(constantFast.hops,before);
});
test('30/60/120/144 Hz independent of animation frame rate',()=>{
  const results=[];
  for(const hz of [30,60,120,144]){
    const terrain=new Terrain(42),s=newRun();
    for(let hop=0;hop<60;hop++){
      const fast=terrain.plan.get(s.hops+1);
      for(let tick=0;tick<hz;tick++)advance(s,terrain,PERIOD/hz,fast);
    }
    assert.equal(s.status,'playing');results.push([s.hops,s.beacons,Math.round(s.x*1000)]);
  }
  for(const r of results)assert.deepEqual(r,results[0]);
});
test('handles invalid delta safely',()=>{
  const s=newRun(),terrain=new Terrain(1);
  assert.deepEqual(advance(s,terrain,NaN,true),[]);
  assert.deepEqual(advance(s,terrain,-1,true),[]);
  assert.equal(s.hops,0);
});
