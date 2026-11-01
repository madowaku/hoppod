import test from 'node:test';
import assert from 'node:assert/strict';
import {COMPANION_HOPS,COMPANION_LAG,COMPANION_HOVER,companionJoins,companionBell,companionPhase,companionLift,joinBlend} from '../public/src/companion.mjs';
import {earthLabel,EARTH_GLOW,EARTH_PEEK,EARTH_FULL} from '../public/src/earth.mjs';
import {milestoneTier} from '../public/src/audio.mjs';
import {Terrain,newRun,advance,PERIOD} from '../public/src/engine.mjs';

test('the blue pod joins once, at 30 HOPS',()=>{
  assert.equal(COMPANION_HOPS,30);
  assert.equal(companionJoins(29,false),false);
  assert.equal(companionJoins(30,false),true);
  assert.equal(companionJoins(31,true),false);
});

test('bell rings on every second landing after joining, never over a milestone',()=>{
  const rings=[];
  for(let hops=1;hops<=60;hops++) if(companionBell(hops,hops>=30,milestoneTier(hops))) rings.push(hops);
  assert.deepEqual(rings,[32,34,36,38,42,44,46,48,52,54,56,58]);
  assert.equal(companionBell(32,false,null),false);
});

test('companion bobs half a hop behind and never touches the floor line',()=>{
  assert.equal(COMPANION_LAG,PERIOD/2);
  assert.ok(Math.abs(companionPhase(0)-.5)<1e-9);
  assert.ok(Math.abs(companionPhase(PERIOD/2))<1e-9);
  for(let t=0;t<PERIOD;t+=.01) assert.ok(companionLift(t)>=COMPANION_HOVER-1e-9);
  assert.equal(joinBlend(0),0);assert.equal(joinBlend(5),1);
});

test('Earth state labels follow the existing rise thresholds',()=>{
  assert.equal(earthLabel(0),'FAR SIDE');
  assert.equal(earthLabel(EARTH_GLOW+1),'EARTHGLOW');
  assert.equal(earthLabel(EARTH_PEEK),'EARTHRISE 1/4');
  assert.equal(earthLabel(EARTH_FULL),'FULL EARTH');
});

test('companion helpers never alter terrain, physics, phase, score or outcome',()=>{
  for(let seed=0;seed<16;seed++) {
    const runs=[false,true].map(withCompanion=>{
      const terrain=new Terrain(seed),state=newRun();let joined=false;
      for(let hop=0;hop<140&&state.status==='playing';hop++) {
        const desiredFast=hop%3!==0,dt=PERIOD*(desiredFast?.62:.21);
        for(const [step,f] of [[dt,desiredFast],[PERIOD-dt,!desiredFast]]) {
          const events=advance(state,terrain,step,f);
          if(withCompanion) {
            companionLift(state.phase);
            if(events.includes('land')) { if(companionJoins(state.hops,joined)) joined=true; companionBell(state.hops,joined,milestoneTier(state.hops)); }
          }
        }
      }
      return {state,platforms:terrain.platforms,beacons:terrain.beacons};
    });
    assert.deepEqual(runs[0],runs[1]);
  }
});
