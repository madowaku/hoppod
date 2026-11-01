import assert from 'node:assert/strict';
import test from 'node:test';
import {createAudio,milestoneTier,LAND_NOTES} from '../public/src/audio.mjs';

// Minimal Web Audio stand-in that records the graph and gain automation.
function fakeContext(state='running') {
  const log={oscillators:[],compressors:0};
  const param=()=>({value:0,events:[],setValueAtTime(v,t){this.events.push(['set',v,t]);},exponentialRampToValueAtTime(v,t){this.events.push(['ramp',v,t]);}});
  const node=extra=>({connections:[],connect(n){this.connections.push(n);},disconnect(){this.disconnected=true;},...extra});
  class Context {
    constructor(){this.state=state;this.currentTime=10;this.destination=node({name:'destination'});}
    resume(){return Promise.resolve();}
    createOscillator(){const o=node({type:'sine',frequency:param(),start(t){this.startAt=t;},stop(t){this.stopAt=t;}});log.oscillators.push(o);return o;}
    createGain(){return node({gain:param()});}
    createDynamicsCompressor(){log.compressors++;return node({name:'compressor',threshold:param(),knee:param(),ratio:param(),attack:param(),release:param()});}
  }
  globalThis.AudioContext=Context;
  return log;
}
const peak=o=>Math.max(...o.connections[0].gain.events.map(e=>e[1]));
const target=o=>o.connections[0].connections[0].name;
// Gain at time t from set/exponential-ramp automation events.
function envelope(o,t) {
  const events=o.connections[0].gain.events;let [,value,time]=events[0];
  if(t<time) return 0;
  for(const [,next,at] of events.slice(1)) {
    if(t<=at) return value*(next/value)**((t-time)/(at-time));
    value=next;time=at;
  }
  return t<=o.stopAt?value:0;
}

test('milestone tiers: 10s, 50s, 100s; highest tier wins; zero is silent',()=>{
  assert.deepEqual([0,1,9,10,20,40,50,60,90,100,150,200,250,1000].map(milestoneTier),
    [null,null,null,'ten','ten','ten','fifty','ten','ten','hundred','fifty','hundred','fifty','hundred']);
});

test('ordinary landings keep the v0.2 voice exactly',()=>{
  const log=fakeContext(),audio=createAudio();audio.unlock();
  for(let hops=1;hops<=9;hops++) audio.play('land',hops);
  assert.equal(log.oscillators.length,9);
  log.oscillators.forEach((o,i)=>{
    assert.equal(o.type,'sine');assert.equal(o.frequency.events[0][1],LAND_NOTES[(i+1)%5]);
    assert.equal(peak(o),.07);assert.equal(target(o),'destination');
  });
  assert.deepEqual(LAND_NOTES,[330,392,440,523,587]);
});

test('milestones layer quiet accents on a compressed bus without touching the land voice',()=>{
  for(const [hops,voices] of [[10,2],[50,5],[100,5]]) {
    const log=fakeContext(),audio=createAudio();audio.unlock();audio.play('land',hops);
    const [land,...accents]=log.oscillators;
    assert.equal(peak(land),.07);assert.equal(target(land),'destination');
    assert.equal(accents.length,voices);assert.equal(log.compressors,1);
    for(const o of accents) { assert.equal(target(o),'compressor'); assert.ok(peak(o)<=.03); assert.ok(o.startAt>=10&&o.stopAt<=10+1.7); }
    // The summed accent envelope never exceeds a single land voice.
    let loudest=0;
    for(let t=10;t<12;t+=.002) loudest=Math.max(loudest,accents.reduce((sum,o)=>sum+envelope(o,t),0));
    assert.ok(loudest<=.07,`${hops}: ${loudest}`);
  }
});

test('accent voices are capped and released; one bus is reused',()=>{
  const log=fakeContext(),audio=createAudio();audio.unlock();
  for(let i=0;i<10;i++) audio.play('land',100);
  assert.equal(log.compressors,1);
  assert.equal(log.oscillators.filter(o=>target(o)==='compressor').length,12);
  log.oscillators.forEach(o=>o.onended?.());
  audio.play('land',10);
  assert.equal(log.oscillators.filter(o=>target(o)==='compressor').length,14);
});

test('classic A/B mode, mute and a suspended context produce no accents',()=>{
  let log=fakeContext(),audio=createAudio({accents:false});audio.unlock();audio.play('land',100);
  assert.equal(log.oscillators.length,1);
  audio.accents=true;audio.play('land',100);assert.equal(log.oscillators.length,7);
  log=fakeContext();audio=createAudio();audio.unlock();audio.toggle();audio.play('land',100);
  assert.equal(log.oscillators.length,0);
  log=fakeContext('suspended');audio=createAudio();audio.unlock();audio.play('land',100);
  assert.equal(log.oscillators.length,0);
});

test('muting a hundred chord stops its running and future-scheduled voices',()=>{
  const log=fakeContext(),audio=createAudio();audio.unlock();audio.play('land',100);
  audio.toggle();
  for(const o of log.oscillators) assert.ok(o.stopAt<=10.02,`voice still scheduled until ${o.stopAt}`);
});

test('reset stop releases voices and lets the next run celebrate again',()=>{
  const log=fakeContext(),audio=createAudio();audio.unlock();audio.play('land',100);
  assert.equal(typeof audio.stop,'function','run lifecycle needs a sound cancellation API');
  audio.stop();
  for(const o of log.oscillators) assert.ok(o.stopAt<=10.02);
  log.oscillators.forEach(o=>o.onended?.());
  audio.play('land',10);assert.equal(log.oscillators.length,9);
});

test('ordinary landing nodes disconnect when ended, as well as accent nodes',()=>{
  const log=fakeContext(),audio=createAudio();audio.unlock();audio.play('land',100);
  for(const o of log.oscillators){o.onended();o.onended();assert.equal(o.disconnected,true);assert.equal(o.connections[0].disconnected,true);}
  audio.play('land',100);assert.equal(log.oscillators.length,12);
});
