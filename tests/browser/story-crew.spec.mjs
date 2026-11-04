import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
const dir='output/playwright/story-crew';
// Renders the crew in both forms with the real drawing code and measures
// the silhouettes from pixels: same face, different job.
test('crew silhouettes differ by job, and each transformation reads at 1x',async({page})=>{
  await mkdir(dir,{recursive:true});
  await page.goto('/story.html?lang=en');
  const m=await page.evaluate(async()=>{
    const {drawPod}=await import('/src/pod.mjs');
    const {COMPANION_PALETTE}=await import('/src/companion.mjs');
    const {drawCrewParts,drawTransmit}=await import('/src/story/crew.mjs');
    const P={blue:COMPANION_PALETTE,green:{c:'#b4f2c8',w:'#ecfff2',s:'#73c290',a:'#3fcf7f'},red:{c:'#ffbcae',w:'#fff1ec',s:'#d98a7a',a:'#ff6a4f'}};
    const cell=(who,form)=>{
      const c=document.createElement('canvas');c.width=80;c.height=80;const g=c.getContext('2d');
      if(who==='hero'){drawPod(g,40,70,1,{phase:0});drawTransmit(g,40,70,1,form,form>0);}
      else{drawPod(g,40,70,1,{phase:0,palette:P[who]});drawCrewParts(g,who,40,70,1,{palette:P[who],form,top:-21,dir:'up'});}
      const d=g.getImageData(0,0,80,80).data;let l=80,r=-1,t=80,b=-1;
      for(let y=0;y<80;y++)for(let x=0;x<80;x++)if(d[(y*80+x)*4+3]>40){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}
      return {c,box:{w:r-l+1,h:b-t+1,left:40-l,right:r-40,top:70-t}};
    };
    const out={},sheet=document.createElement('canvas');sheet.width=4*80*4;sheet.height=2*80*4;
    const sg=sheet.getContext('2d');sg.imageSmoothingEnabled=false;sg.fillStyle='#0b1016';sg.fillRect(0,0,sheet.width,sheet.height);
    ['hero','blue','green','red'].forEach((who,i)=>[0,1].forEach(form=>{const {c,box}=cell(who,form);out[who+form]=box;sg.drawImage(c,i*320,form*320,320,320);}));
    return {boxes:out,png:sheet.toDataURL()};
  });
  const {writeFile}=await import('node:fs/promises');
  await writeFile(dir+'/lineup.png',Buffer.from(m.png.split(',')[1],'base64'));
  const b=m.boxes;
  // Normal: green is the widest, blue reaches highest (its lamp), red is lopsided.
  expect(b.green0.w).toBeGreaterThan(Math.max(b.hero0.w,b.blue0.w,b.red0.w));
  expect(b.blue0.top).toBeGreaterThan(Math.max(b.green0.top,b.red0.top));
  expect(b.red0.left-b.red0.right).toBeGreaterThanOrEqual(3);
  // Transformed: hero ears up, blue light opens wider, green spreads, red reaches out.
  expect(b.hero1.top).toBeGreaterThan(b.hero0.top);expect(b.hero1.w).toBeGreaterThan(b.hero0.w-1);
  expect(b.blue1.w).toBeGreaterThan(b.blue0.w);
  expect(b.green1.w).toBeGreaterThanOrEqual(b.green0.w+6);
  expect(b.red1.left).toBeGreaterThanOrEqual(b.red0.left+3);
  await writeFile(dir+'/boxes.json',JSON.stringify(b,null,2));
});
