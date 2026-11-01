import assert from 'node:assert/strict';
import test from 'node:test';
import {EARTH_PEEK,EARTH_FULL,EARTH_HIGH,earthRise,earthCenterY} from '../public/src/earth.mjs';
import {PERIOD,Terrain,newRun,advance} from '../public/src/engine.mjs';

test('Earth rise is monotonic in distance and never ends the run',()=>{
  let previous=earthRise(0);
  assert.deepEqual(previous,{glow:0,rise:0,climb:0,signal:0});
  for(let x=0;x<=EARTH_HIGH*3;x+=37) {
    const now=earthRise(x);
    for(const key of ['glow','rise','climb','signal']) assert.ok(now[key]>=previous[key],`${key} at ${x}`);
    previous=now;
  }
  assert.deepEqual(earthRise(1e9),{glow:1,rise:1,climb:1,signal:4});
});

test('signal levels: none on the far side, 1 on first light, 4 once the disc clears',()=>{
  assert.equal(earthRise(EARTH_PEEK-1).signal,0);
  assert.equal(earthRise(EARTH_PEEK).signal,1);
  assert.equal(earthRise(EARTH_FULL-1).signal,3);
  assert.equal(earthRise(EARTH_FULL).signal,4);
});

test('disc geometry: touches the horizon, clears it, then climbs to the sky slot',()=>{
  const horizon=330,r=28,high=84;
  assert.equal(earthCenterY(earthRise(0),horizon,r,high)-r,horizon);
  assert.equal(earthCenterY(earthRise(EARTH_FULL),horizon,r,high)+r,horizon);
  assert.equal(earthCenterY(earthRise(EARTH_HIGH),horizon,r,high),high);
  assert.ok(earthCenterY(earthRise(1e9),horizon,r,high)-r>28,'stays below the HUD signal bars');
});

test('on real reference routes: glow by ~12 HOPS, first light by ~25, full Earth near 100',()=>{
  for(let seed=0;seed<64;seed++) {
    const t=new Terrain(seed),s=newRun(),at={};
    while(s.hops<220) {
      t.extendTo(s.x+1600);const d=t.plan.get(s.hops+1);
      advance(s,t,d,true);advance(s,t,PERIOD-d,false);
      assert.equal(s.status,'playing');at[s.hops]=earthRise(s.x);
    }
    assert.equal(at[8].glow,0,'far side is dark during the tutorial');
    assert.ok(at[14].glow>0,`glow ${seed}`);
    assert.ok(at[25].signal>=1,`first light ${seed}`);
    assert.ok(at[85].signal<4&&at[115].signal===4,`full Earth ${seed}`);
    assert.ok(at[220].climb===1,`top ${seed}`);
  }
});
