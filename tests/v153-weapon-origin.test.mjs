import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {createGame,startGame,spawnUnit,tick,setOrder,refreshVision,muzzlePoint,muzzleHeight,CARDS} from '../game/engine.ts';
import {adultFrameChoice} from '../game/adult-animation.ts';
import {specialistAtlas,specialistSprite} from '../game/adult-specialists.ts';
import {packedWeaponStances} from '../game/weapon-stance-art.ts';
import {packedGrenadeLauncher,grenadeLauncherSprite} from '../game/grenade-launcher-art.ts';
import {heavyMGAtlas,heavyMGSprite} from '../game/heavy-mg-art.ts';
import {infantryWeaponMuzzle} from '../game/infantry-weapon-geometry.ts';
import {infantryGeometry} from '../game/infantry-geometry.ts';
const {createCanvas,loadImage}=createRequire(import.meta.url)('@napi-rs/canvas');
globalThis.document={createElement:()=>createCanvas(1,1)};
const load=async name=>loadImage(new URL('../public/art/'+name,import.meta.url).pathname);
const launcher=packedGrenadeLauncher(await load('grenade-launcher-frames-v152.png'));
const stances={...packedWeaponStances(await load('weapon-stance-frames-v147.png')),grenade:launcher.stances};
const legacy=specialistAtlas(await load('adult-specialists-v13.png'));
const heavy=heavyMGAtlas(await load('heavy-mg-v140.png'));
const bases=new Map();
function baseFor(choice){const key=choice.group+choice.index;if(!bases.has(key))bases.set(key,createCanvas(96,96));return bases.get(key);}
function arena(side=0,id='grenadiers',member=0) {
  const s=createGame(153);startGame(s);s.aiIn=1e9;s.units=[];s.scenery=[];s.walls=[];
  s.terrain.fill(374);s.original.fill(374);s.weather.disabled=true;s.night=false;
  const x=side?2400:1000,dir=side?-1:1;spawnUnit(s,side,id,x,{member});const u=s.units.at(-1);
  spawnUnit(s,1-side,'infantry',x+dir*300,{member:0});const enemy=s.units.at(-1);
  for(const [v,vx]of[[u,x],[enemy,x+dir*300]])Object.assign(v,{x:vx,y:374,lane:0,
    hp:10000,maxHp:10000,shots:0,cooldown:v===u?0:10000,decisionIn:1000,tactic:'crouch',
    pose:'crouch',poseAnimSeen:'crouch',stanceLockUntil:100,moving:false,motion:'ground',
    stillFor:5,readyAt:-100,fragLeft:0,aimUntil:0,cover:0,coverGoal:null,firingGoal:null,
    personalMorale:96,suppression:0,flash:0});
  setOrder(s,0,'hold');setOrder(s,1,'hold');refreshVision(s);return{s,u,enemy,dir};
}
const roles=['grenadiers','rocket','javelin','antiarmor','airborne_at','sniper','sniper_team','machinegun','lmg_team','heavy_mg','medic_team'];
test('prepared art and real muzzles agree for every specialist, both facings and each locomotion phase',()=>{
  let checks=0;
  for(const id of roles)for(const side of[0,1])for(const moving of[false,true])for(const pose of['idle','crouch','hunker','prone','run'])for(let walk=0;walk<8;walk++){
    const {u}=arena(side,id);Object.assign(u,{pose,moving,walk,crouchTravel:moving&&['crouch','hunker'].includes(pose)?1:0,poseAnimSeen:pose==='prone'?'prone':['crouch','hunker'].includes(pose)?'crouch':'stand',facing:side?-1:1});
    const before=JSON.stringify(u),choice=adultFrameChoice(u,10);
    const image=grenadeLauncherSprite(u,10,launcher.cycle)??heavyMGSprite(u,10,heavy)??specialistSprite(baseFor(choice),choice,u,legacy,stances);
    assert(image?.muzzle,`${id}/${pose}/${moving}/${walk}`);
    const p=muzzlePoint(u,u.x+u.facing*300);
    assert(Math.abs(p.x-(u.x+u.facing*image.muzzle.x))<1e-7,`${id}/${pose}/${moving}/${walk}: x`);
    assert(Math.abs(p.y-(u.y+3-image.muzzle.height))<1e-7,`${id}/${pose}/${moving}/${walk}: y ${p.y} vs ${u.y+3-image.muzzle.height}`);
    assert.equal(JSON.stringify(u),before);checks++;
  }
  console.log('v153 specialist origin comparisons',checks);
});
test('mixed-team escorts and precision observers keep their rifles and unchanged hit geometry',()=>{
  for(const [id,member]of[['infantry',0],['antiarmor',1],['airborne_at',2],['machinegun',1],['lmg_team',1],['heavy_mg',1],['sniper_team',1]]){
    const {u}=arena(0,id,member);
    for(const pose of['idle','crouch','prone']){
      u.pose=pose;assert.equal(infantryWeaponMuzzle(u),null);assert.equal(muzzleHeight(u),infantryGeometry(u).muzzleHeight);
    }
  }
  for(const id of roles){const {u}=arena(0,id);assert.equal(infantryGeometry(u).bodyHeight,23);}
});
test('exposed specialist barrels really fire over close soil banks while buried ones remain blocked',()=>{
  for(const side of[0,1])for(const id of['grenadiers','rocket','sniper','lmg_team'])for(const blocked of[false,true]){
    const {s,u,enemy,dir}=arena(side,id),bank=u.x+dir*12;
    s.terrain.fill(blocked?320:id==='grenadiers'?340:345,bank-4,bank+5);s.terrainVersion++;refreshVision(s);
    let p;
    for(let i=0;i<30&&!p;i++){tick(s,1/60);p=s.projectiles.find(p=>p.sourceUid===u.uid);}
    if(blocked)assert.equal(u.shots,0,`${side}/${id}/buried`);
    else {
      assert(u.shots>0,`${side}/${id}/exposed: ${JSON.stringify({x:u.x,pose:u.pose,seen:s.visible,shot:u.shots})}`);
      assert(p);assert.equal(p.startX,u.muzzleX);assert.equal(p.startY,u.muzzleY);
      assert.equal(u.pose,'crouch');
    }
  }
});
test('all specialist muzzle forecasts move continuously through stance changes without changing the hit body',()=>{
  for(const id of roles)for(const [from,to]of[['stand','prone'],['prone','stand'],['crouch','stand'],['stand','crouch']]){
    const {u}=arena(0,id);Object.assign(u,{pose:to==='stand'?'idle':to,poseAnimFrom:from,poseAnimSeen:to});let last;
    for(let i=0;i<120;i++){
      u.poseAnimProgress=i/120;const p=infantryWeaponMuzzle(u),hit=infantryGeometry(u);
      assert(p&&Number.isFinite(p.height)&&Number.isFinite(hit.bodyHeight));
      if(last)assert(Math.abs(p.height-last.height)<1.2&&Math.abs(p.x-last.x)<1.2,`${id}/${from}->${to}`);last=p;
    }
  }
});
test('specialists plan their real standing height once and finish the posture drill before firing',()=>{
  for(const side of[0,1])for(const id of['grenadiers','rocket','sniper','lmg_team']){
    const {s,u,dir}=arena(side,id),bank=u.x+dir*12;
    s.terrain.fill(330,bank-4,bank+5);s.terrainVersion++;u.stanceLockUntil=-1;
    setOrder(s,side,'advance');refreshVision(s);let changes=0,previous=u.pose,startedAt;
    for(let i=0;i<360;i++){
      tick(s,1/60);
      if(u.pose!==previous){changes++;previous=u.pose;startedAt??=s.time;}
      if(u.poseAnimProgress!==undefined&&u.poseAnimProgress<1)assert.equal(u.shots,0);
    }
    assert.equal(u.pose,'idle',`${side}/${id}`);assert.equal(changes,1,`${side}/${id}`);
    assert(u.shots>0&&s.time-startedAt>1.2,`${side}/${id}`);
  }
});
