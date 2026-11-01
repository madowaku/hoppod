import assert from 'node:assert/strict';
import test from 'node:test';
import {chooseLanguage,copy,earthText,partsText,milestoneText} from '../public/src/ui-copy.mjs';
import {resolveRun,shareUrl} from '../public/src/links.mjs';
import {Terrain,newRun,advance,PERIOD} from '../public/src/engine.mjs';

test('Japanese and English preferences choose query, saved preference then browser without modifying course',()=>{
  const url='https://example.test/?mode=free&seed=42';
  assert.equal(chooseLanguage(url,null,'ja-JP'),'ja');
  assert.equal(chooseLanguage(url,null,'en-US'),'en');
  assert.equal(chooseLanguage(url,'ja','en-US'),'ja');
  assert.equal(chooseLanguage(url+'\&lang=en','ja','ja-JP'),'en');
  assert.equal(chooseLanguage(url+'\&lang=zz',null,'en-US'),'en');
  const a=resolveRun(url,'2026-11-01',()=>1),b=resolveRun(url+'\&lang=ja','2026-11-01',()=>1);
  assert.deepEqual(a,b);
});
test('both languages explain milestone sounds and all companion/result states',()=>{
  assert.match(copy('ja','milestoneHelp'),/10 HOPS/);
  assert.match(copy('en','milestoneHelp'),/Every 10 HOPS/);
  assert.match(milestoneText('ja',10),/10 HOPS/);
  assert.match(milestoneText('en',100),/100 HOPS/);
  assert.equal(earthText('ja','EARTHRISE 2/4'),'地球が昇る 2/4');
  assert.equal(earthText('ja','FAR SIDE'),'月の裏側');
  assert.equal(earthText('en','FULL EARTH'),'FULL EARTH');
  assert.match(partsText('ja',['antenna','engine'],3),/アンテナ.*動力部/);
  assert.equal(partsText('en',['antenna','body','engine'],3),'WITH BLUE POD');
});
test('localization changes only post text, never the exact replay URL or DAILY seed',()=>{
  const run=resolveRun('https://example.test/?mode=daily&date=2026-11-01','2026-11-01');
  const en=new URL(shareUrl(run,80,280,'en')),ja=new URL(shareUrl(run,80,280,'ja'));
  assert.equal(en.searchParams.get('url'),ja.searchParams.get('url'));
  assert.equal(en.searchParams.get('url'),run.url);
  assert.match(ja.searchParams.get('text'),/あと1回/);
  assert.match(ja.searchParams.get('text'),/#RAPIPPO/);
});
test('obsolete gold beacons are absent; the same jump rhythm earns only HOPS',()=>{
  const t=new Terrain(42),s=newRun();
  assert.equal('beacons' in t,false);assert.equal('beacons' in s,false);
  for(let h=1;h<=20;h++){
    t.extendTo(s.x+2500);
    const hold=t.plan.get(h);
    const events=[...advance(s,t,hold,true),...advance(s,t,PERIOD-hold,false)];
    assert.deepEqual(events,['land']);
  }
  assert.equal(s.hops,20);
});
