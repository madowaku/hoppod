import assert from 'node:assert/strict';
import test from 'node:test';
import {Terrain,MOTIFS,motifTier,COURSE_VERSION,PERIOD,SLOW_SPEED,FAST_SPEED,MIN_GAP,INSET,newRun,advance,isSafe,footing} from '../public/src/engine.mjs';

const SLOW_STEP=PERIOD*SLOW_SPEED,FAST_STEP=PERIOD*FAST_SPEED;

test('20 authored four-hop motifs: identity, progression, reachable step lengths',()=>{
  assert.equal(COURSE_VERSION,4);
  assert.equal(MOTIFS.length,20);
  assert.equal(new Set(MOTIFS.map(m=>m.id)).size,20);
  assert.deepEqual([0,1,2,3].map(t=>MOTIFS.filter(m=>m.tier===t).length),[4,6,6,4]);
  for(const m of MOTIFS) {
    assert.equal(m.steps.length,4,m.id);
    for(const [distance,half] of m.steps) {
      assert.ok(distance>=SLOW_STEP&&distance<=FAST_STEP,m.id);
      assert.ok(2*(half-2)>=96,`too narrow ${m.id}`);
    }
  }
  assert.deepEqual([7,31,32,63,64,119,120].map(motifTier),[0,0,1,1,2,2,3]);
});

test('all 20 motifs occur and replay deterministically across 64 seeds',()=>{
  const seen=new Set();
  for(let seed=0;seed<64;seed++) {
    const t=new Terrain(seed);t.extendTo(70000);
    for(const m of t.motifs)seen.add(m.id);
    const replay=new Terrain(seed);replay.extendTo(70000);
    assert.deepEqual(t.platforms,replay.platforms);
    assert.deepEqual(t.motifs,replay.motifs);
    assert.deepEqual([...t.plan],[...replay.plan]);
  }
  assert.deepEqual([...seen].sort(),MOTIFS.map(m=>m.id).sort());
});

test('128 seeds: all visible pits at least 16px; edge and middle landings have >=20px next-hop margin',()=>{
  for(let seed=0;seed<128;seed++) {
    const t=new Terrain(seed);t.extendTo(50000);
    for(let i=1;i<t.platforms.length;i++)
      assert.ok(t.platforms[i][0]-t.platforms[i-1][1]>=MIN_GAP,`${seed}/${i}`);
    for(let i=1;i<t.platforms.length-1;i++) {
      const [a,b]=t.platforms[i];
      for(const x of [a+INSET,(a+b)/2,b-INSET]) {
        const low=x+SLOW_STEP,high=x+FAST_STEP;
        assert.ok(t.platforms.slice(i,i+2).some(([c,d])=>
          Math.min(d-INSET,high)-Math.max(c+INSET,low)>=20-1e-7),
          `seed ${seed}, platform ${i}, position ${x}`);
      }
    }
  }
});

test('128 seeds x 300 hops: geometry-only steering survives +/-60ms input error',()=>{
  for(let seed=0;seed<128;seed++) {
    const t=new Terrain(seed),s=newRun();
    for(let hop=0;hop<300;hop++) {
      const lo=s.x+SLOW_STEP,hi=s.x+FAST_STEP;
      const targets=t.platforms.map(footing).map(([a,b])=>
        [Math.max(a+16,lo),Math.min(b-16,hi)]).filter(([a,b])=>a<=b);
      assert.ok(targets.length,`${seed}/${hop}`);
      const [a,b]=targets[0],hold=Math.max(0,Math.min(PERIOD,
        ((a+b)/2-lo)/(FAST_SPEED-SLOW_SPEED)+[-.06,0,.06][hop%3]));
      advance(s,t,hold,true);advance(s,t,PERIOD-hold,false);
      assert.equal(s.status,'playing',`${seed}/${hop}`);
      assert.equal(s.hops,hop+1);
      assert.ok(isSafe(t,s.x));
    }
  }
});

test('8 seeds x 2000 hops: experimental motif metadata stays bounded',()=>{
  for(let seed=0;seed<8;seed++) {
    const t=new Terrain(seed),s=newRun();
    for(let hop=0;hop<2000;hop++) {
      const lo=s.x+SLOW_STEP,hi=s.x+FAST_STEP;
      const targets=t.platforms.map(footing).map(([a,b])=>
        [Math.max(a+8,lo),Math.min(b-8,hi)]).filter(([a,b])=>a<=b);
      assert.ok(targets.length);
      const [a,b]=targets.at(-1),hold=((a+b)/2-lo)/(FAST_SPEED-SLOW_SPEED);
      advance(s,t,hold,true);advance(s,t,PERIOD-hold,false);
      assert.equal(s.status,'playing',`${seed}/${hop}`);
      assert.ok(t.motifs.length<20);
      assert.ok(t.platforms.length<30);
      assert.ok(t.plan.size<40);
    }
  }
});
