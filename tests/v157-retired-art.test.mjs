import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const {createCanvas,Image}=createRequire(import.meta.url)('@napi-rs/canvas');
const requested=[];
globalThis.document={createElement:()=>createCanvas(1,1)};
globalThis.Image=class extends Image{
  set src(v){requested.push(v);assert(!v.includes('adult-signals-'),'retired command art must not download');
    super.src=v.startsWith('/')?fileURLToPath(new URL('../public'+v,import.meta.url)):v;}
  get src(){return super.src;}
};
const {loadArt}=await import('../game/art.ts');
const {adultFrameChoice,idlePoseChoice}=await import('../game/adult-animation.ts');
const {createGame,spawnUnit}=await import('../game/engine.ts');
test('production artwork loads completely with command-sheet downloads forbidden',async()=>{
  const art=await loadArt();assert(requested.length>20);
  for(const adult of Object.values(art.adults)){
    assert.equal(adult.signals4.length,0);
    for(const name of ['stance16','reload8','lowReload16','medical24','repair34'])assert(adult[name].length>0);
  }
});
test('legacy signal flags cannot make either live selector request a missing command frame',()=>{
  const s=createGame(157);spawnUnit(s,0,'infantry',1000);const u=s.units[0];
  for(const pose of ['idle','walk','run','crouch','hunker','prone'])for(const moving of [false,true]){
    Object.assign(u,{pose,moving,leader:true,pointUntil:100,pointDir:1,calloutUntil:100,calloutDir:-1,
      ammoSignalUntil:100,ammoShareUntil:100,flash:0,fire:0,aimUntil:0,reloadingUntil:0});
    for(let i=0;i<120;i++){
      assert.notEqual(adultFrameChoice(u,i/6).group,'signals4');assert.notEqual(idlePoseChoice(u,i/6)?.group,'signals4');
    }
  }
});
