import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const {createCanvas,Image}=createRequire(import.meta.url)('@napi-rs/canvas');
globalThis.document={createElement:()=>createCanvas(1,1)};
globalThis.Image=class extends Image {
  set src(v){super.src=v.startsWith('/')?fileURLToPath(new URL('../public'+v,import.meta.url)):v;}
  get src(){return super.src;}
};
const {loadArt,uniformFrame}=await import('../game/art.ts');
const {render}=await import('../game/render.ts');
const {adultFrameChoice,adultIdentity}=await import('../game/adult-animation.ts');
const {createGame,startGame,spawnUnit,refreshVision,CARDS,H}=await import('../game/engine.ts');

test('actual renderer draws all eight own-identity raised-rifle gait images, not a static patrol torso',async()=>{
  const art=await loadArt(),canvas=createCanvas(960,H),ctx=canvas.getContext('2d'),draw=ctx.drawImage.bind(ctx);
  let calls=[];ctx.drawImage=(...args)=>{calls.push(args[0]);return draw(...args);};
  for(const id of ['infantry','marines','armed_police','militia']){
    const s=createGame(177);startGame(s);s.scenery=[];s.walls=[];s.units=[];s.weather.disabled=true;
    spawnUnit(s,0,id,900);s.units.splice(1);const u=s.units[0];
    Object.assign(u,{hp:100,moving:true,motion:'ground',pose:'walk',climbing:0,aimUntil:100,readyAt:0,poseAnimAt:undefined,fire:0,flash:0});
    s.time=20;refreshVision(s);
    for(let i=0;i<8;i++){
      u.walk=i;const snapshot=JSON.stringify(u),choice=adultFrameChoice(u,s.time),adult=art.adults[adultIdentity(id)];
      const expected=uniformFrame(adult[choice.group][choice.index],CARDS[id].uniform);
      calls=[];render(ctx,s,art,null,null,true,500,960);
      assert(calls.includes(expected),`${id} gait ${i} must reach the screen`);
      assert.equal(JSON.stringify(u),snapshot,'drawing must never modify movement state');
    }
  }
});
