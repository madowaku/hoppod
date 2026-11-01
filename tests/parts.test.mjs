import test from 'node:test';
import assert from 'node:assert/strict';
import {PART_CATCH,PART_MARGIN,PART_EDGE,PART_FIRST,CREWS,PartLayout,PartRun,comfortable} from '../public/src/parts.mjs';
import {PERIOD,SLOW_SPEED,FAST_SPEED,Terrain,newRun,advance,footing,isSafe} from '../public/src/engine.mjs';
import {companionBell} from '../public/src/companion.mjs';
import {milestoneTier} from '../public/src/audio.mjs';

const SLOW_STEP=PERIOD*SLOW_SPEED,FAST_STEP=PERIOD*FAST_SPEED;
const SEEDS=400;
// Hold time that lands exactly on `target` from the current landing.
const holdFor=(state,target)=>(target-state.x-SLOW_STEP)/(FAST_SPEED-SLOW_SPEED);
// Autoplay: reference route, detouring onto each active part when `take`
// says so, or deliberately landing beside it (outside the catch window) when not.
function autoplay(seed,hops,take=()=>true) {
  const terrain=new Terrain(seed),state=newRun(),layout=new PartLayout(seed),run=new PartRun(layout),events=[];
  const plan=new Terrain(seed);let forced=0;
  for(let i=0;i<hops&&state.status==='playing';i++) {
    plan.extendTo(state.x+2000);
    const next=state.hops+1,slot=run.active;
    let target=plan.planPositions.get(next);
    if(slot&&slot.hop===next) {
      if(take(slot,run)) target=slot.x;
      else if(Math.abs(target-slot.x)<=PART_CATCH) {
        const around=[-30,30,-38,38,-46,46].map(d=>slot.x+d).find(x=>
          isSafe(terrain,x-3)&&isSafe(terrain,x+3)&&x-state.x>=SLOW_STEP&&x-state.x<=FAST_STEP&&comfortable(plan.planPositions.get(next+1)-x));
        // A part on a short footing can be unavoidable on this exact route.
        if(around===undefined) forced++; else target=around;
      }
    }
    const hold=holdFor(state,target);
    assert.ok(hold>=-1e-9&&hold<=PERIOD+1e-9,`seed ${seed} hop ${next}: hold ${hold}`);
    const land=[...advance(state,terrain,Math.max(0,hold),true),...advance(state,terrain,PERIOD-Math.max(0,hold),false)];
    assert.equal(state.status,'playing',`seed ${seed} fell at hop ${next}`);
    assert.ok(land.includes('land'));
    const got=run.land(state.x,state.hops);
    if(got) events.push({...got,hops:state.hops});
  }
  return {state,run,layout,events,terrain,forced};
}

test('same seed, same parts: order and slots are reproducible and seed-specific',()=>{
  const signatures=new Set();
  for(let seed=0;seed<64;seed++) {
    const a=new PartLayout(seed),b=new PartLayout(seed);
    const slots=l=>[0,1,2,3,4].map(i=>l.slot(i));
    assert.deepEqual(a.order,b.order);assert.deepEqual(slots(a),slots(b));
    // Asking in a different order does not change the result.
    const c=new PartLayout(seed);c.slot(4);assert.deepEqual(slots(c),slots(a));
    signatures.add(JSON.stringify(slots(a)));
  }
  assert.ok(signatures.size>60);
  assert.deepEqual([...new PartLayout(1).order].sort(),[...CREWS[0].parts].sort());
});

test('part layout never consumes or alters the terrain generator',()=>{
  for(let seed=0;seed<64;seed++) {
    const plain=new Terrain(seed);plain.extendTo(25000);
    const layout=new PartLayout(seed);for(let i=0;i<6;i++) layout.slot(i);
    const after=new Terrain(seed);after.extendTo(25000);
    assert.deepEqual(after.platforms,plain.platforms);assert.deepEqual([...after.plan],[...plain.plan]);
    assert.deepEqual(after.beacons,plain.beacons);assert.deepEqual(after.motifs,plain.motifs);
    // The shadow terrain is the same world the player sees (the last platform
    // of either may still widen as generation continues).
    const n=Math.min(layout.terrain.platforms.length,plain.platforms.length)-1;
    assert.deepEqual(layout.terrain.platforms.slice(0,n),plain.platforms.slice(0,n));
  }
});

test(`${SEEDS} seeds: every slot is fair, on lit footing, off beacon hops, in the 20–40 HOPS opening`,()=>{
  const firsts=[];
  for(let seed=0;seed<SEEDS;seed++) {
    const layout=new PartLayout(seed),t=layout.terrain;
    for(let i=0;i<6;i++) {
      const {hop,x}=layout.slot(i);
      if(i===0) { firsts.push(hop);assert.ok(hop>=PART_FIRST[0]&&hop<=PART_FIRST[1]+1,`first ${seed}: ${hop}`); }
      else assert.ok(hop-layout.slot(i-1).hop>=22,`gap ${seed}/${i}`);
      assert.notEqual(hop%5,0,`beacon hop ${seed}/${i}`);
      const ground=t.platforms.map(footing).find(([l,r])=>x>=l&&x<=r);
      assert.ok(ground,`not on footing ${seed}/${i}`);
      assert.ok(x-ground[0]>=PART_EDGE&&ground[1]-x>=PART_EDGE,`edge ${seed}/${i}`);
      // The whole catch window is safe ground or at least half of it is.
      let safe=0;for(let d=-PART_CATCH;d<=PART_CATCH;d++) if(isSafe(t,x+d)) safe++;
      assert.ok(safe>=PART_CATCH+1,`window ${seed}/${i}: ${safe}`);
      assert.ok(comfortable(x-t.planPositions.get(hop-1)),`reach ${seed}/${i}`);
      assert.ok(comfortable(t.planPositions.get(hop+1)-x),`leave ${seed}/${i}`);
    }
  }
  firsts.sort((a,b)=>a-b);assert.ok(firsts[0]>=20&&firsts.at(-1)<=40);
});

test(`${SEEDS} seeds: reachable-set solver confirms each part can be landed on from the start`,()=>{
  const merge=list=>list.sort((a,b)=>a[0]-b[0]).reduce((out,[a,b])=>{const last=out.at(-1);if(last&&a<=last[1]+1e-9) last[1]=Math.max(last[1],b);else out.push([a,b]);return out;},[]);
  for(let seed=0;seed<SEEDS;seed++) {
    const layout=new PartLayout(seed),slots=[0,1,2].map(i=>layout.slot(i));
    const t=new Terrain(seed);t.extendTo(slots.at(-1).x+2000);
    const ground=t.platforms.map(footing);
    let reach=[[75,75]];const found=new Set();
    while(reach[0][0]<slots.at(-1).x+PART_CATCH) {
      reach=merge(reach.flatMap(([a,b])=>ground.map(([l,r])=>[Math.max(a+SLOW_STEP,l),Math.min(b+FAST_STEP,r)]).filter(([a2,b2])=>a2<=b2)));
      assert.ok(reach.length,`seed ${seed}: no reachable landing`);
      slots.forEach((s,i)=>{ if(reach.some(([a,b])=>Math.min(b,s.x+PART_CATCH)-Math.max(a,s.x-PART_CATCH)>=PART_MARGIN)) found.add(i); });
    }
    assert.equal(found.size,3,`seed ${seed}: reachable parts ${[...found]}`);
  }
});

test(`${SEEDS} seeds long autoplay: collecting every part completes the crew exactly once, ~66–100 HOPS`,()=>{
  const done=[];
  for(let seed=0;seed<SEEDS;seed++) {
    const {run,events}=autoplay(seed,140);
    const collects=events.filter(e=>e.type==='collect');
    assert.equal(collects.length,3,`seed ${seed}`);
    assert.equal(new Set(collects.map(e=>e.part)).size,3,'no duplicates');
    assert.deepEqual(collects.map(e=>e.complete),[false,false,true]);
    assert.equal(run.completedAt,collects[2].hops);assert.equal(run.active,null);
    done.push(run.completedAt);
  }
  done.sort((a,b)=>a-b);
  assert.ok(done[0]>=60&&done.at(-1)<=110,`${done[0]}..${done.at(-1)}`);
  assert.ok(done[done.length>>1]>=75&&done[done.length>>1]<=95);
});

test('ignoring parts never blocks progress; a missed part returns at the next slot',()=>{
  for(let seed=0;seed<100;seed++) {
    const ignore=autoplay(seed,160,()=>false);
    assert.equal(ignore.state.hops,160);assert.equal(ignore.run.collected.length,ignore.forced);
    if(ignore.forced<3) assert.equal(ignore.run.completedAt,null);
    // Skip the first slot only: its part is offered again and collected later.
    let skipped=null;
    const later=autoplay(seed,200,(slot,run)=>{ if(run.index===0){skipped=slot.part;return false;} return true; });
    if(later.forced) continue;
    const types=later.events.map(e=>e.type+':'+e.part);
    assert.equal(types[0],'miss:'+skipped);assert.equal(types[1],'collect:'+skipped);
    assert.equal(later.run.collected.length,3);assert.ok(later.run.completedAt>ignore.run.layout.slot(2).hop);
  }
});

test('no duplicate pickup and no crew before all three parts',()=>{
  const layout=new PartLayout(42),run=new PartRun(layout),first=layout.slot(0);
  assert.deepEqual(run.land(first.x-PART_CATCH-1,first.hop-1),null);
  const got=run.land(first.x+PART_CATCH,first.hop);
  assert.equal(got.type,'collect');assert.equal(got.part,layout.order[0]);
  assert.equal(run.land(first.x+PART_CATCH,first.hop+1),null,'standing still does not collect again');
  assert.deepEqual(run.collected,[layout.order[0]]);
  assert.equal(run.completedAt,null);assert.equal(companionBell(first.hop+1,run.completedAt,null),false);
  const second=run.active;assert.equal(second.part,layout.order[1]);
  run.land(second.x,second.hop);
  const third=run.active;assert.equal(run.land(third.x,third.hop).complete,true);
  assert.equal(run.active,null);assert.equal(run.land(third.x+500,third.hop+5),null,'completes only once');
});

test('parts never change score, physics or outcome',()=>{
  for(let seed=0;seed<32;seed++) {
    const withParts=autoplay(seed,120).state,terrain=new Terrain(seed),plain=newRun(),plan=new Terrain(seed);
    const route=autoplay(seed,120).events.filter(e=>e.type==='collect').map(e=>e.hops);
    // Replay the identical inputs without the parts layer.
    const layout=new PartLayout(seed);const run=new PartRun(layout);
    for(let i=0;i<120;i++) {
      plan.extendTo(plain.x+2000);
      const next=plain.hops+1,slot=run.active;
      const target=slot&&slot.hop===next?slot.x:plan.planPositions.get(next);
      if(slot&&slot.hop===next) run.land(target,next);
      const hold=Math.max(0,holdFor(plain,target));
      advance(plain,terrain,hold,true);advance(plain,terrain,PERIOD-hold,false);
    }
    assert.deepEqual(plain,withParts);assert.equal(route.length,3);
  }
});

test('DAILY: a date maps to one seed and therefore one part layout for everyone',async()=>{
  const {resolveRun}=await import('../public/src/links.mjs');
  const a=resolveRun('https://example.test/?mode=daily&date=2026-11-01','2026-11-01');
  const b=resolveRun('https://example.test/?mode=daily&date=2026-11-01','2026-12-31');
  const c=resolveRun('https://example.test/?mode=daily&date=2026-11-02','2026-11-02');
  assert.equal(a.seed,b.seed);
  const slots=seed=>{const l=new PartLayout(seed);return [l.order,[0,1,2].map(i=>l.slot(i))];};
  assert.deepEqual(slots(a.seed),slots(b.seed));assert.notDeepEqual(slots(a.seed),slots(c.seed));
});
