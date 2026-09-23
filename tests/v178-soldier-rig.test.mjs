import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const {createCanvas,Image,loadImage}=createRequire(import.meta.url)('@napi-rs/canvas');
globalThis.document={createElement:()=>createCanvas(1,1)};
globalThis.Image=class extends Image {
  set src(v){super.src=v.startsWith('/')?fileURLToPath(new URL('../public'+v,import.meta.url)):v;}
  get src(){return super.src;}
};
const {soldierArt,soldierFrame}=await import('../game/soldier-art.ts');
const {soldierPose,soldierAppearance,soldierWeapon,updateSoldierGait,soldierMuzzle}=await import('../game/soldier-pose.ts');
const {CARDS}=await import('../game/cards.ts');
const {loadArt}=await import('../game/art.ts');
const {render}=await import('../game/render.ts');
const {grenadeReleaseOrigin}=await import('../game/grenade-geometry.ts');
const {GRENADE_RELEASE_S,GRENADE_THROW_S}=await import('../game/infantry-action-timing.ts');
const {createGame,startGame,spawnUnit,refreshVision,H,muzzleOffset,muzzleHeight}=await import('../game/engine.ts');
const art=soldierArt(await loadImage('public/art/soldier-parts-v178.png'),await loadImage('public/art/soldier-equipment-v178.png'));
const base={id:'infantry',uid:1,member:0,hp:100,pose:'idle',motion:'ground',moving:false,walk:0,fire:0,secondaryFire:0};
const members=Object.entries(CARDS).filter(([,c])=>c.members).flatMap(([id,c])=>Array.from({length:c.members},(_,member)=>({id,member})));
const states=[{}, {aimUntil:100,readyAt:0}, {fire:.2},
  ...['walk','run','crouch','hunker','prone'].flatMap(pose=>[false,true].map(moving=>({pose,moving,walk:2.3,crouchTravel:moving?1:0,proneTravel:moving?1:0}))),
  ...['idle','crouch','prone'].flatMap(pose=>[{pose,ammo:0,reloadingStartAt:19.2,reloadingUntil:21},
    {pose,fragThrow:.6,fragThrowStartedAt:19.5},{pose,tending:true,tendingKind:'medical',tendingTime:1},
    {pose,tending:true,tendingKind:'repair',tendingTime:1},{pose,digging:true,digElapsed:1}]),
  {rappelling:true},{parachuting:true},{motion:'jump',motionTime:.2,motionDuration:.6},
  {motion:'land',motionTime:.1,motionDuration:.3},{wounded:true,woundedTime:1},
  {wounded:true,woundedTime:1,crawling:true,moving:true},{surrendered:true,surrenderTime:1},
];
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
test('inventory includes all 41 soldier cards and 145 roles, not four representative models',()=>{
  assert.equal(new Set(members.map(u=>u.id)).size,41);assert.equal(members.length,145);
});
test('every role/action keeps appearance, fixed bones, one pixel grid and canonical canvas',()=>{
  for(const role of members)for(const patch of states){
    const u={...base,...role,...patch},before=JSON.stringify(u),{image,pose:p}=soldierFrame(art,u,20);
    assert.equal(JSON.stringify(u),before);
    assert.deepEqual(p.appearance,soldierAppearance(role));
    assert.equal(image.width,128);assert.equal(image.height,128);
    for(const [a,b,length]of [[p.hip,p.neck,22],[p.hip,p.nearKnee,17],[p.nearKnee,p.nearFoot,17],
      [p.shoulder,p.nearElbow,12],[p.nearElbow,p.nearHand,13]])
      assert(Math.abs(distance(a,b)-length)<1e-6,`${u.id}/${u.member}/${p.action} bone length`);
    const rgba=image.getContext('2d').getImageData(0,0,image.width,image.height).data;
    let opaque=0;
    for(let i=3;i<rgba.length;i+=4){assert(rgba[i]===0||rgba[i]===255,'all actions have hard pixel alpha');if(rgba[i])opaque++;}
    assert(opaque>150,`${u.id}/${p.action} is visibly drawn`);
  }
});
test('moving aim, fire and reload never replace or freeze the legs in any role',()=>{
  for(const role of members)for(const pose of ['walk','run','crouch','prone'])for(let walk=0;walk<8;walk+=.5){
    const u={...base,...role,pose,moving:true,walk,crouchTravel:1,proneTravel:1};
    const a=soldierPose(u,20);
    for(const patch of [{aimUntil:100,readyAt:19.9},{fire:.2},{ammo:0,reloadingStartAt:19,reloadingUntil:21}]){
      const b=soldierPose({...u,...patch},20);
      for(const key of ['hip','nearKnee','farKnee','nearFoot','farFoot'])assert.deepEqual(b[key],a[key]);
      assert.deepEqual(b.layers,a.layers);
    }
  }
});
test('all six stance transition directions have continuous joints, including kneel/prone IK handoff',()=>{
  for(const from of ['stand','crouch','prone'])for(const to of ['stand','crouch','prone'])if(from!==to){
    const duration=from==='stand'&&to==='prone'||from==='prone'&&to==='stand'?2.4:1.2;
    const u={...base,pose:to==='stand'?'idle':to,poseAnimFrom:from,poseAnimSeen:to,poseAnimAt:0};
    let last=soldierPose(u,0);
    for(let t=1/120;t<=duration+1e-6;t+=1/120){
      const p=soldierPose(u,t);
      for(const k of ['hip','neck','nearKnee','farKnee','nearFoot','farFoot'])
        assert(distance(last[k],p[k])<3,`${from}->${to} ${k} jump at ${t}: ${distance(last[k],p[k])}`);
      last=p;
    }
  }
});
test('gait wraps smoothly and front/back anatomical layers never reorder',()=>{
  for(const role of members)for(let walk=0;walk<16;walk+=.125){
    const u={...base,...role,pose:'walk',moving:true,walk};
    const a=soldierPose(u,20),b=soldierPose({...u,walk:walk+.01},20);
    assert(distance(a.nearFoot,b.nearFoot)<.3);assert(distance(a.farFoot,b.farFoot)<.3);
    assert.deepEqual(a.layers,['farLeg','farArm','backpack','torso','head','nearLeg','weapon','nearArm']);
  }
});
test('gait follows actual displacement including reverse, lane movement and stationary flags',()=>{
  const u={...base,x:100,lane:0,facing:1,walk:3.5,gaitPhase:3.5,gaitWeight:1,moving:true};
  updateSoldierGait(u,{x:100,lane:0},1/60,20);assert.equal(u.gaitPhase,3.5);
  u.x=101;updateSoldierGait(u,{x:100,lane:0},1/60,20);assert.equal(u.gaitPhase,3.625);
  u.x=100.5;updateSoldierGait(u,{x:101,lane:0},1/60,20);assert.equal(u.gaitPhase,3.5625);
  u.lane=1;updateSoldierGait(u,{x:100.5,lane:0},1/60,20);assert.equal(u.gaitPhase,3.6875);
  const before=u.gaitPhase;u.x=500;updateSoldierGait(u,{x:100.5,lane:1},1/60,20);assert.equal(u.gaitPhase,before);
});
test('specialist roles and rifle escorts keep their own weapon through actions',()=>{
  const expected=[['airborne_at',0,'rocket'],['airborne_at',2,'rifle'],['lmg_team',0,'lmg'],['lmg_team',1,'rifle'],
    ['heavy_mg',0,'hmg'],['heavy_mg',1,'rifle'],['flame_team',0,'flame'],['flame_team',1,'rifle'],
    ['light_mortar',0,'mortar'],['light_mortar',1,'rifle'],['sniper_team',0,'sniper'],['sniper_team',1,'rifle']];
  for(const [id,member,weapon]of expected)for(const patch of states)assert.equal(soldierWeapon({id,member,...patch}),weapon);
});
test('grenade release matches the solved hand at all heights, after expired stance clocks and in both directions',()=>{
  for(const role of members)for(const pose of ['idle','crouch','prone'])for(const facing of [1,-1]){
    const u={...base,...role,pose,x:900,y:374,facing,fragThrow:GRENADE_THROW_S-GRENADE_RELEASE_S,
      fragThrowStartedAt:20,poseAnimAt:10,poseAnimFrom:'stand',poseAnimSeen:pose==='idle'?'stand':pose};
    const p=soldierPose(u,20+GRENADE_RELEASE_S),origin=grenadeReleaseOrigin(u,facing);
    assert(Math.abs(origin.x-(u.x+facing*p.nearHand[0]))<1e-6);
    assert(Math.abs(origin.y-(u.y+3+p.nearHand[1]))<1e-6);
  }
});
test('a full gait cycle reuses identical raster geometry rather than growing an unbounded phase cache',()=>{
  const a=soldierFrame(art,{...base,pose:'walk',moving:true,walk:0},20);
  const b=soldierFrame(art,{...base,pose:'walk',moving:true,walk:8},20);
  assert.equal(a.image,b.image);
});
test('real renderer and ballistic origins use the unified soldier path for every role',async()=>{
  const full=await loadArt(),c=createCanvas(960,H),ctx=c.getContext('2d'),draw=ctx.drawImage.bind(ctx);let images=[];
  ctx.drawImage=(...args)=>{images.push(args[0]);return draw(...args);};
  for(const role of members){
    const s=createGame(178);startGame(s);s.units=[];s.scenery=[];s.walls=[];s.weather.disabled=true;s.time=20;
    spawnUnit(s,0,role.id,900,{member:role.member});const u=s.units.at(-1);s.units=[u];
    Object.assign(u,{...base,...role,x:900,y:374,moving:true,pose:'walk',walk:2.3,aimUntil:100,readyAt:0});refreshVision(s);
    const expected=soldierFrame(full.soldiers,u,s.time),before=JSON.stringify(u);
    images=[];render(ctx,s,full,null,null,true,500,960);assert(images.includes(expected.image),role.id+'/'+role.member);
    assert.equal(JSON.stringify(u),before);
    const m=soldierMuzzle(u);assert.equal(muzzleOffset(u),m.x);assert.equal(muzzleHeight(u),m.height);
    assert(Math.abs(expected.pose.muzzle[0]-m.x)<1e-8);assert(Math.abs(expected.pose.muzzle[1]+3+m.height)<1e-8);
  }
});
