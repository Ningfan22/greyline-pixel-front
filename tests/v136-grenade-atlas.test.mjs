import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { standingGrenadeFrames } from '../game/adult-atlas.ts';
const {createCanvas,loadImage}=createRequire(import.meta.url)('@napi-rs/canvas');
globalThis.document={createElement:()=>createCanvas(1,1)};
test('eight measured grenade cels retain the hand across the unequal gutter and share planted boots',async()=>{
  const source=await loadImage(new URL('../public/art/standing-grenade-v136.png',import.meta.url).pathname);
  const frames=standingGrenadeFrames(source),sheet=createCanvas(960,128),ctx=sheet.getContext('2d');
  ctx.fillStyle='#879b91';ctx.fillRect(0,0,960,128);
  const rights=[];
  for(const [i,f] of frames.entries()) {
    const d=f.getContext('2d').getImageData(0,0,96,96).data;
    let top=96,bottom=0,left=96,right=0,count=0;
    for(let y=0;y<96;y++)for(let x=0;x<96;x++)if(d[(y*96+x)*4+3]>80){
      top=Math.min(top,y);bottom=Math.max(bottom,y);left=Math.min(left,x);right=Math.max(right,x);count++;
    }
    assert(top>=31&&top<=33,`head ${i}: ${top}`);
    assert(bottom>=94&&bottom<=95,`feet ${i}: ${bottom}`);
    assert(left>22&&right<74,`neighbor/clipped limb ${i}: ${left}..${right}`);
    assert(count>800&&count<1900,`empty or neighboring figure ${i}: ${count}`);
    rights.push(right);ctx.drawImage(f,i*120+12,15);
  }
  assert(rights[4]>=67,'release hand was not clipped at nominal x=314');
  const file=join(mkdtempSync(join(tmpdir(),'greyline-grenade-')),'grenade.png');
  writeFileSync(file,sheet.toBuffer('image/png'));console.log(`Grenade contact sheet: ${file}`);
});
