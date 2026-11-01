import test from 'node:test';
import assert from 'node:assert/strict';
import {COMPANION_LAG,COMPANION_HOVER,ASSEMBLE_GATHER,ASSEMBLE_FLASH,ASSEMBLE_BOOT,companionBell,companionPhase,companionLift,gatherBlend} from '../public/src/companion.mjs';
import * as companion from '../public/src/companion.mjs';
import {earthLabel,EARTH_GLOW,EARTH_PEEK,EARTH_FULL} from '../public/src/earth.mjs';
import {milestoneTier} from '../public/src/audio.mjs';
import {PERIOD} from '../public/src/engine.mjs';

test('no automatic join: the companion only exists once its parts are built',()=>{
  assert.equal('COMPANION_HOPS' in companion,false);
  for(let hops=1;hops<=300;hops++) assert.equal(companionBell(hops,null,milestoneTier(hops)),false);
});

test('bell rings on every second landing after completion, never over a milestone',()=>{
  const rings=[];
  for(let hops=1;hops<=60;hops++) if(companionBell(hops,31,milestoneTier(hops))) rings.push(hops);
  assert.deepEqual(rings,[32,34,36,38,42,44,46,48,52,54,56,58]);
  assert.equal(companionBell(31,31,null),false,'not on the completing landing itself');
});

test('companion bobs half a hop behind and never touches the floor line',()=>{
  assert.equal(COMPANION_LAG,PERIOD/2);
  assert.ok(Math.abs(companionPhase(0)-.5)<1e-9);
  assert.ok(Math.abs(companionPhase(PERIOD/2))<1e-9);
  for(let t=0;t<PERIOD;t+=.01) assert.ok(companionLift(t)>=COMPANION_HOVER-1e-9);
});

test('assembly is short and ordered: gather, flash, boot within one hop',()=>{
  assert.ok(ASSEMBLE_GATHER<ASSEMBLE_FLASH&&ASSEMBLE_FLASH<ASSEMBLE_BOOT&&ASSEMBLE_BOOT<PERIOD);
  assert.equal(gatherBlend(0),0);assert.equal(gatherBlend(ASSEMBLE_GATHER),1);
});

test('Earth state labels follow the existing rise thresholds',()=>{
  assert.equal(earthLabel(0),'FAR SIDE');
  assert.equal(earthLabel(EARTH_GLOW+1),'EARTHGLOW');
  assert.equal(earthLabel(EARTH_PEEK),'EARTHRISE 1/4');
  assert.equal(earthLabel(EARTH_FULL),'FULL EARTH');
});
