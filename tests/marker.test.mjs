import test from 'node:test';
import assert from 'node:assert/strict';
import {MARKER_MODES,markerModeFromUrl,markerVisual} from '../public/src/marker.mjs';
import {Terrain,newRun,advance,PERIOD,SLOW_SPEED,FAST_SPEED} from '../public/src/engine.mjs';

test('A/B/C URL selection: invalid/default values default to no landing marker',()=>{
  assert.deepEqual(MARKER_MODES,['full','neutral','off']);
  for(const [query,expected] of [
    ['', 'off'],['?marker=full','off'],['?marker=neutral','off'],
    ['?marker=full&compare=1','full'],['?marker=neutral&compare=1','neutral'],
    ['?marker=off','off'],['?marker=missing','off'],['?marker=OFF','off']
  ]) assert.equal(markerModeFromUrl('http://localhost/'+query),expected);
});

test('marker A preserves original colors and advice; B never leaks safety; C renders nothing',()=>{
  assert.deepEqual(markerVisual('full',true),{visible:true,color:'#8ee6c4',hint:false});
  assert.deepEqual(markerVisual('full',false),{visible:true,color:'#ff9b80',hint:true});
  assert.deepEqual(markerVisual('neutral',true),markerVisual('neutral',false));
  assert.deepEqual(markerVisual('neutral',false),{visible:true,color:'#d2d2bc',hint:false});
  assert.deepEqual(markerVisual('off',true),markerVisual('off',false));
  assert.deepEqual(markerVisual('off',false),{visible:false,color:null,hint:false});
});

test('visual policy never alters generated terrain, physics, phase, score or outcome',()=>{
  for(let seed=0;seed<32;seed++) {
    const snapshots=MARKER_MODES.map(mode=>{
      const terrain=new Terrain(seed),state=newRun();
      for(let hop=0;hop<140&&state.status==='playing';hop++) {
        const desiredFast=hop%3!==0,dt=PERIOD*(desiredFast?.62:.21);
        // Exercise the view function (as the canvas would) but never use it to steer.
        markerVisual(mode,hop%2===0);
        advance(state,terrain,dt,desiredFast);
        advance(state,terrain,PERIOD-dt,!desiredFast);
      }
      return {state,platforms:terrain.platforms,beacons:terrain.beacons};
    });
    assert.deepEqual(snapshots[0],snapshots[1]);
    assert.deepEqual(snapshots[1],snapshots[2]);
  }
});
