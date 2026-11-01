import test from 'node:test';
import assert from 'node:assert/strict';
import {Terrain,PERIOD,SLOW_SPEED,FAST_SPEED,MIN_GAP,footing,newRun,advance,isSafe,COURSE_VERSION} from '../public/src/engine.mjs';
import {resolveRun} from '../public/src/links.mjs';

test('review: incremental generation equals one-shot layout at all merge/rest boundaries',()=>{
  for(let seed=0;seed<256;seed++) {
    const a=new Terrain(seed),b=new Terrain(seed);
    for(let x=1900;x<40000;x+=137)a.extendTo(x);
    b.extendTo(a.referenceX);
    assert.deepEqual(a.platforms,b.platforms);assert.deepEqual([...a.plan],[...b.plan]);
    for(let i=1;i<a.platforms.length;i++)assert.ok(a.platforms[i][0]-a.platforms[i-1][1]>=MIN_GAP);
  }
});

test('review: 16 seeds × 10000 non-reference hops retain fair footing and bounded storage',()=>{
  for(let seed=0;seed<16;seed++) {
    const t=new Terrain(seed),s=newRun();
    for(let hop=0;hop<10000;hop++) {
      const lo=s.x+PERIOD*SLOW_SPEED,hi=s.x+PERIOD*FAST_SPEED;
      const candidates=t.platforms.map(footing).map(([a,b])=>[Math.max(a+8,lo),Math.min(b-8,hi)]).filter(([a,b])=>a<=b);
      assert.ok(candidates.length,`${seed}/${hop}`);
      const [a,b]=seed%2?candidates.at(-1):candidates[0],hold=((a+b)/2-lo)/(FAST_SPEED-SLOW_SPEED);
      advance(s,t,hold,true);advance(s,t,PERIOD-hold,false);
      assert.equal(s.status,'playing');assert.equal(s.hops,hop+1);assert.ok(isSafe(t,s.x));
      assert.ok(t.plan.size<40);assert.equal(t.plan.size,t.planPositions.size);assert.ok(t.platforms.length<30);assert.ok(t.beacons.length<20);
    }
  }
});

test('review: a JST daily course round-trips independently of URL version and clock on another day',()=>{
  assert.equal(COURSE_VERSION,4);
  for(const date of ['2026-10-31','2026-11-01','2028-02-29']) {
    const a=resolveRun(`https://example.com/?mode=daily&date=${date}&v=2`,'2026-11-01');
    const b=resolveRun(a.url,'2026-11-03');
    assert.equal(a.seed,b.seed);assert.equal(a.date,date);assert.equal(new URL(a.url).searchParams.get('v'),'4');
    assert.deepEqual(new Terrain(a.seed).platforms,new Terrain(b.seed).platforms);
  }
});
