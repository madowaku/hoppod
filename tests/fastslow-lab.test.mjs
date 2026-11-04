import test from 'node:test';
import assert from 'node:assert/strict';
import { PERIOD, SLOW_SPEED, FAST_SPEED, INSET } from '../public/src/engine.mjs';
import { layouts, modeInfo, relayPlatforms } from '../public/dev/fastslow-layouts.mjs';

const MIN_STEP = PERIOD * SLOW_SPEED;
const MAX_STEP = PERIOD * FAST_SPEED;

function verifyRoute(mode, landings, allowRelay = true) {
  let x = 75, powered = false;
  for (const landing of landings) {
    assert.ok(landing - x >= MIN_STEP - .0001,
      mode + ': landing ' + landing + ' is too near from ' + x);
    assert.ok(landing - x <= MAX_STEP + .0001,
      mode + ': landing ' + landing + ' is too far from ' + x);
    const solid = [
      ...layouts[mode],
      ...(mode === 'relay' && powered && allowRelay ? relayPlatforms : [])
    ];
    assert.ok(solid.some(([a,b]) => landing >= a+INSET && landing <= b-INSET),
      mode + ': landing ' + landing + ' has no solid platform');
    x = landing;
    if (mode === 'relay' && allowRelay && x >= 300 && x <= 332) powered = true;
  }
  assert.ok(x >= modeInfo[mode].goal, mode + ': did not reach goal');
  return { hops: landings.length, powered };
}

test('precision course has a physically reachable finish', () => {
  const route = [157,355,565,727,873,1043,1199,1373,1525,1707,1845,2011];
  assert.equal(verifyRoute('precision',route).hops, 12);
});

test('shortcut course has at least two different clear strategies', () => {
  const fast = [159,369,579,789,987,1197,1395,1605,1803,2013];
  const safe = [157,239,369,579,789,987,1197,1395,1605,1803,2013];
  assert.equal(verifyRoute('shortcut', fast).hops, 10);
  assert.equal(verifyRoute('shortcut', safe).hops, 11);
});

test('discovery bridge can be powered via a real landing and then cleared', () => {
  const route = [157,301,481,691,901,1111,1321];
  assert.deepEqual(verifyRoute('relay', route), { hops:7, powered:true });
});

test('discovery cannot bypass the unpowered bridge on the same path', () => {
  assert.throws(() => verifyRoute('relay', [157,301,481,691,901,1111,1321], false),
    /no solid platform/);
});

test('no experimental course changes the production beat or speed constants', () => {
  assert.equal(PERIOD, .78);
  assert.equal(SLOW_SPEED, 105);
  assert.equal(FAST_SPEED, 270);
});