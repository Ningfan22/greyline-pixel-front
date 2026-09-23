import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {createCanvas,loadImage}=createRequire(import.meta.url)('@napi-rs/canvas');
globalThis.document={createElement:()=>createCanvas(1,1)};
const {soldierArt,soldierFrame,paintSoldier}=await import('../game/soldier-art.ts');
const {soldierPose,soldierAppearance,updateSoldierGait}=await import('../game/soldier-pose.ts');
const {CARDS}=await import('../game/cards.ts');
const {createGame,startGame,spawnUnit,explode,tick}=await import('../game/engine.ts');
const art=soldierArt(await loadImage('public/art/soldier-parts-v178.png'),await loadImage('public/art/soldier-equipment-v178.png'));
const base={id:'infantry',member:0,uid:1,hp:100,pose:'idle',motion:'ground',moving:false,
  walk:0,fire:0,secondaryFire:0,ammo:30,shots:0,cooldown:0,climbing:0,facing:1};
const roles=Object.entries(CARDS).filter(([,c])=>c.members).flatMap(([id,c])=>Array.from({length:c.members},(_,member)=>({id,member})));
const actions=[
  ['ready',{}],['reload',{ammo:0,reloadingStartAt:19,reloadingUntil:21}],
  ['throw',{fragThrow:.6,fragThrowStartedAt:19.5}],
  ['medical',{tending:true,tendingKind:'medical',tendingTime:1}],
  ['repair',{tending:true,tendingKind:'repair',tendingTime:1}],['dig',{digging:true,digElapsed:1}],
  ['drag',{draggingUid:99,moving:true,gaitWeight:1,walk:2}],['share',{ammoShareUntil:21}],
  ['scavenge',{scavengeUntil:21}],['signal',{ammoSignalUntil:21}],['observe',{observingUntil:21}],
  ['deploy',{emplacementSetupUntil:21}],['barrel',{overheatedUntil:21}],
  ['casualty',{wounded:true,woundedTime:1}],['surrender',{surrendered:true,surrenderTime:1}],
  ['rappel',{rappelling:true}],['parachute',{parachuting:true}],['vault',{climbing:1}],
];
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
test('all 145 member roles retain body parts and pixel scale in the complete synthetic action matrix',()=>{
  assert.equal(roles.length,145);
  for(const role of roles)for(const facing of [-1,1])for(const pose of ['idle','crouch','prone'])for(const [action,patch]of actions){
    const u={...base,...role,facing,pose,...patch},before=JSON.stringify(u),{image,pose:p}=soldierFrame(art,u,20);
    assert.equal(p.action,action,JSON.stringify(u));assert.deepEqual(p.appearance,soldierAppearance(u));
    assert.equal(JSON.stringify(u),before);assert.equal(image.width,128);assert.equal(image.height,128);
    for(const [a,b,l] of [[p.hip,p.neck,22],[p.hip,p.nearKnee,17],[p.nearKnee,p.nearFoot,17],
      [[p.hip[0]-1,p.hip[1]],p.farKnee,17],[p.farKnee,p.farFoot,17],
      [p.shoulder,p.nearElbow,12],[p.nearElbow,p.nearHand,13],
      [[p.shoulder[0]+1,p.shoulder[1]-1],p.farElbow,12],[p.farElbow,p.farHand,13]])
      assert(Math.abs(dist(a,b)-l)<1e-6,`${role.id}/${role.member}/${action} bone length`);
    const pixels=image.getContext('2d').getImageData(0,0,image.width,image.height).data;
    let count=0;for(let i=3;i<pixels.length;i+=4){assert(pixels[i]===0||pixels[i]===255);if(pixels[i])count++;}
    assert(count>150,`${role.id}/${action} invisible`);
  }
});
test('both anatomical feet stay planted in world space, including backward movement and moving upper-body actions',()=>{
  for(const role of roles)for(const pose of ['walk','run','crouch','hunker','prone'])for(const direction of [-1,1])for(const facing of [-1,1]){
    for(let phase=.1;phase<7.9;phase+=.2){
      const leg=phase<4?'nearFoot':'farFoot';
      for(const patch of [{},{fire:.2},{ammo:0,reloadingStartAt:19,reloadingUntil:21},{draggingUid:99},{tactic:'retreat'}]){
        const u={...base,...role,...patch,pose,facing,x:500,lane:0,moving:true,gaitWeight:1,gaitPhase:phase,
          crouchTravel:1,proneTravel:1};
        const a=soldierPose(u,20);u.x+=direction*.01;updateSoldierGait(u,{x:500,lane:0},1/6000,20);
        const b=soldierPose(u,20);
        assert(Math.abs(a[leg][0]*facing+500-(b[leg][0]*facing+u.x))<1e-7,`${role.id}/${pose}/${leg} slides`);
        assert(Math.abs(a[leg][1]+3)<1e-7,`${role.id}/${pose}/${leg} hovers`);
      }
    }
  }
});
test('slung specialists draw their own equipment instead of secretly substituting a rifle canvas',()=>{
  const canvas=createCanvas(128,96),ctx=canvas.getContext('2d'),original=ctx.drawImage.bind(ctx);let seen=[];
  ctx.drawImage=(...args)=>{seen.push(args[0]);return original(...args);};
  for(const role of roles)for(const [action,patch]of actions){
    const p=soldierPose({...base,...role,...patch},20);if(!p.slung||!p.weaponVisible||p.weapon==='rifle')continue;
    seen=[];paintSoldier(ctx,art,p);
    assert(seen.includes(art.equipment[p.weapon]),`${role.id}/${role.member}/${action} lost ${p.weapon}`);
    const costume=art.uniforms.get(p.appearance.identity+'/'+p.appearance.uniform);
    assert(!seen.includes(costume.near.rifle),`${role.id}/${action} became a rifleman`);
  }
});
test('sharing hands off the magazine with the reaching hand; reloading uses the loading hand',()=>{
  const share=soldierPose({...base,ammoShareUntil:21},20),reload=soldierPose({...base,ammo:0,reloadingStartAt:19,reloadingUntil:21},20);
  assert.equal(share.prop,'magazine');assert.equal(share.propHand,'near');
  assert.equal(reload.prop,'magazine');assert.equal(reload.propHand,'far');
});
test('rocket, mortar, belt and grenade launcher drills use distinct ammunition and feed paths',()=>{
  for(const [id,prop]of [['rocket','rocketRound'],['manpads','rocketRound'],['mortar','mortarRound'],
    ['heavy_mg','belt'],['machinegun','belt'],['grenadiers','shell'],['infantry','magazine']]){
    const p=soldierPose({...base,id,pose:'crouch',ammo:0,reloadingStartAt:19,reloadingUntil:21},20);
    assert.equal(p.prop,prop);assert.equal(p.propHand,'far');
  }
  const gun=soldierPose({...base,id:'heavy_mg',pose:'crouch',emplacementSetupUntil:21},20);
  assert.equal(gun.action,'deploy');assert.equal(gun.slung,false);
});
test('bolt cycles stay with the sniper; each of the 19 action names is exercised',()=>{
  const covered=new Set(actions.map(([action])=>action));
  for(const role of roles){
    const p=soldierPose({...base,...role,shots:1,lastCombatShotAt:19.7,cooldown:1},20);
    if(p.weapon==='sniper'){assert.equal(p.action,'cycle');covered.add(p.action);}
  }
  assert.equal(covered.size,19);
});
test('head alert motion and contact signals never rotate the body or freeze the legs',()=>{
  for(const role of roles)for(const pose of ['idle','crouch','prone']){
    const u={...base,...role,pose},a=soldierPose(u,20),b=soldierPose({...u,blastGlanceUntil:20.5,blastGlanceDir:-1},20);
    assert.notEqual(a.headAngle,b.headAngle);
    for(const key of ['hip','neck','nearKnee','farKnee','nearFoot','farFoot','muzzle'])assert.deepEqual(a[key],b[key]);
    const signal=soldierPose({...u,pointUntil:21,pointDir:-1},20);assert.equal(signal.action,'signal');
    for(const key of ['hip','neck','nearKnee','farKnee','nearFoot','farFoot'])assert.deepEqual(a[key],signal[key]);
  }
});
test('small angular changes cannot reuse the wrong cached raster',()=>{
  const a=soldierFrame(art,{...base,aimUntil:21,flash:.1},20),b=soldierFrame(art,{...base,aimUntil:21,flash:.4},20);
  assert.notEqual(a.pose.headAngle,b.pose.headAngle);assert.notEqual(a.image,b.image);
  assert(art.frames.size<=768);
});
const bodyKeys=['hip','neck','shoulder','head','nearKnee','farKnee','nearFoot','farFoot','nearElbow','farElbow','nearHand','farHand'];
test('switching from running to walking or stopping does not snap the hip and knees to another gait',()=>{
  for(const role of roles)for(const target of ['walk','idle'])for(let phase=0;phase<8;phase+=.5){
    const u={...base,...role,pose:'run',moving:true,x:500,lane:0,gaitWeight:1,gaitRun:1,gaitPhase:phase};
    let last=soldierPose(u,20);u.pose=target;u.moving=target==='walk';
    for(let i=0;i<40;i++){
      const before={x:u.x,lane:0};if(u.moving)u.x+=.5;updateSoldierGait(u,before,1/120,20+i/120);
      const next=soldierPose(u,20+i/120);
      for(const k of ['hip','neck','nearKnee','farKnee','nearFoot','farFoot'])
        assert(dist(last[k],next[k])<3,`${role.id}/${target}/${phase}/${k} snapped`);
      last=next;
    }
  }
});
test('falls begin at the actual moving skeleton and keep continuous fixed-length limbs for every role',()=>{
  for(const role of roles)for(const pose of ['walk','run','crouch','prone']){
    const live={...base,...role,pose,moving:true,gaitWeight:1,gaitPhase:2.3,crouchTravel:1,proneTravel:1},from=soldierPose(live,20);
    let last=from;
    for(let frame=0;frame<=84;frame++){
      const p=soldierPose({...base,...role,pose:'prone',wounded:true,woundedTime:frame/120,soldierFall:from},20+frame/120);
      for(const key of bodyKeys)assert(dist(last[key],p[key])<(frame===0?1e-8:4),`${role.id}/${pose}/${frame}/${key} teleports`);
      assert(p.nearFoot[1]<=-3+1e-8&&p.farFoot[1]<=-3+1e-8,'falling feet cannot pass through the ground');
      for(const [a,b,l]of [[p.hip,p.neck,22],[p.hip,p.nearKnee,17],[p.nearKnee,p.nearFoot,17],
        [p.shoulder,p.nearElbow,12],[p.nearElbow,p.nearHand,13]])assert(Math.abs(dist(a,b)-l)<1e-7);
      assert.deepEqual(p.appearance,from.appearance);last=p;
    }
  }
});
test('real fatal hits preserve every member role and its exact current legs in the wreck',()=>{
  const s=createGame(179);startGame(s);s.aiIn=1e9;s.scenery=[];s.walls=[];s.time=20;
  for(const role of roles){
    s.units=[];s.wrecks=[];s.terrain.fill(374);s.original.fill(374);
    spawnUnit(s,0,role.id,900,{member:role.member});const u=s.units.at(-1);s.units=[u];
    Object.assign(u,{...role,x:900,y:374,pose:'run',motion:'ground',moving:true,gaitWeight:1,gaitPhase:2.3,
      poseAnimAt:undefined,poseAnimProgress:undefined,rappelling:false,parachuting:false,wounded:false});
    const before=soldierPose(u,s.time);explode(s,900,364,40,1e6,1);
    const w=s.wrecks.find(v=>v.id===u.uid);assert(w?.soldierFall,role.id+' missing live skeleton');assert.equal(w.member,role.member);
    const after=soldierPose({...base,...role,pose:w.pose,wounded:true,woundedTime:0,soldierFall:w.soldierFall},s.time);
    for(const key of ['hip','neck','nearKnee','farKnee','nearFoot','farFoot'])assert(dist(before[key],after[key])<1e-8,`${role.id}/${key}`);
  }
});
test('the real revive branch hands off the wounded skeleton without resetting legs or hands',()=>{
  const s=createGame(179);startGame(s);s.aiIn=1e9;s.scenery=[];s.walls=[];s.terrain.fill(374);s.original.fill(374);
  for(const role of roles){
    s.units=[];spawnUnit(s,0,role.id,90,{member:role.member});const u=s.units.at(-1);s.units=[u];
    Object.assign(u,{...role,x:90,y:374,pose:'prone',motion:'ground',moving:false,gaitWeight:0,wounded:true,woundedTime:3,
      bleedOut:60,rescueProgress:2,hp:u.maxHp*.5,poseAnimAt:undefined,poseAnimProgress:undefined,
      rappelling:false,parachuting:false,soldierRise:undefined,soldierFall:undefined});
    const before=soldierPose(u,s.time);tick(s,1/60);assert(!u.wounded&&u.soldierRise,role.id+' not revived');
    const after=soldierPose(u,s.time);for(const key of bodyKeys)assert(dist(before[key],after[key])<1e-8,`${role.id}/${key}`);
  }
});
test('every mobile member plants its feet during the real prone-to-kneel carrier transition, then resumes dragging',()=>{
  const s=createGame(179);startGame(s);s.aiIn=1e9;s.scenery=[];s.walls=[];s.terrain.fill(374);s.original.fill(374);
  // Fixed field hospitals cannot haul; v181 separately verifies that they
  // release invalid drag assignments and leave the patient available for aid.
  for(const role of roles.filter(role=>(CARDS[role.id].speed??0)>0)){
    s.units=[];spawnUnit(s,0,role.id,900,{member:role.member});const u=s.units.at(-1);
    spawnUnit(s,0,'infantry',916);const patient=s.units.at(-1);s.units=[u,patient];
    Object.assign(patient,{x:916,y:374,pose:'prone',wounded:true,woundedTime:3,hp:8,bleedOut:120,
      draggedByUid:u.uid,rappelling:false,parachuting:false,firstAidByUid:undefined,rescueProgress:0});
    const start=s.time;
    Object.assign(u,{...role,x:900,y:374,pose:'crouch',motion:'ground',moving:true,gaitWeight:1,gaitPhase:2.3,
      poseAnimFrom:'prone',poseAnimSeen:'crouch',poseAnimFromTravel:1,poseAnimToTravel:0,poseAnimAt:start,
      rappelling:false,parachuting:false,hp:u.maxHp,wounded:false,draggingUid:patient.uid,personalMorale:80});
    let last=soldierPose(u,s.time);
    for(let i=0;i<96;i++){
      tick(s,1/60);const p=soldierPose(u,s.time);
      if(s.time-start<1.2-1e-8){assert.equal(u.x,900);assert.equal(patient.x,916);assert.equal(u.moving,false);}
      for(const key of ['hip','nearKnee','farKnee','nearFoot','farFoot'])assert(dist(last[key],p[key])<6,`${role.id}/${i}/${key} carrier jump`);
      last=p;
    }
    assert(u.x<897&&patient.x<913,role.id+' failed to resume hauling');
  }
});
