import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {CARDS} from '../game/cards.ts';
import {soldierPose,soldierEyeOffset,soldierFootPlanted,soldierMuzzle,soldierBodyBottom,SHOVEL_GRIPS,updateSoldierGround} from '../game/soldier-pose.ts';
import {WEAPON_SIGHTS,weaponSocket} from '../game/soldier-weapon-rig.ts';
const base={id:'infantry',member:0,uid:0,hp:100,x:1000,y:374,lane:0,facing:1,
  pose:'idle',motion:'ground',climbing:0,moving:false,walk:0,rifleReady:1,aimUntil:100};
const roles=Object.entries(CARDS).filter(([,c])=>c.members).flatMap(([id,c])=>Array.from({length:c.members},(_,member)=>({id,member})));
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
test('aiming eye follows each real rear sight with eye relief at standing, kneeling and prone height',()=>{
  for(const role of roles)for(const pose of ['idle','crouch','prone']){
    const u={...base,...role,pose},p=soldierPose(u,20);if(p.weapon==='mortar')continue;
    const eye=weaponSocket(p.head,p.headAngle,soldierEyeOffset(u)),sight=WEAPON_SIGHTS[p.weapon];
    const target=weaponSocket(p.weaponOrigin,p.weaponAngle,[sight.rear[0]-sight.relief,sight.rear[1]]);
    assert(dist(eye,target)<1e-7,`${role.id}/${pose}: eye misses sight line`);
    assert(dist(p.head,p.neck)<11,`${role.id}/${pose}: detached head`);
  }
});
test('heavy gun carry keeps the head attached and reload leaves the mount at its deployed location',()=>{
  for(const pose of ['idle','walk','crouch','prone'])for(const travel of [0,.25,.5,.75,1]){
    const u={...base,id:'heavy_mg',pose,moving:travel>0,gaitWeight:travel,crouchTravel:travel,proneTravel:travel,gaitPhase:6};
    const p=soldierPose(u,20);assert(dist(p.head,p.neck)<11,`${pose}/${travel}: head in torso`);
    if(travel===0){
      const r=soldierPose({...u,ammo:0,reloadingStartAt:19,reloadingUntil:21},20);
      assert(dist(p.weaponOrigin,r.weaponOrigin)<1e-7,'reload moved tripod');
      const m=soldierMuzzle(u);assert(dist(r.muzzle,[m.x,-m.height-3])<1e-7);
    }
  }
});
test('run has a distinct airborne phase, folded recovery leg and landing compression',()=>{
  let flights=0,walkFlights=0,fold=0;const hips=[];
  for(let i=0;i<160;i++){
    const u={...base,pose:'run',moving:true,gaitWeight:1,gaitRun:1,gaitPhase:i/20};
    const p=soldierPose(u,20),w=soldierPose({...u,pose:'walk',gaitRun:0},20);
    if(p.nearFoot[1]<-3.1&&p.farFoot[1]<-3.1)flights++;
    if(w.nearFoot[1]<-3.1&&w.farFoot[1]<-3.1)walkFlights++;
    if(!soldierFootPlanted(u))fold=Math.max(fold,34-dist(p.hip,p.nearFoot));
    hips.push(p.hip[1]);
  }
  assert(flights>=20,'running never leaves ground');assert.equal(walkFlights,0);
  assert(fold>9,'run never folds its recovery knee');
  assert(Math.max(...hips)-Math.min(...hips)>4,'run lacks compression/extension');
});
test('resting prone legs extend behind the hips rather than folding above the back',()=>{
  const p=soldierPose({...base,pose:'prone'},20);
  for(const [k,f]of [['nearKnee','nearFoot'],['farKnee','farFoot']]){
    assert(p[f][0]<p.hip[0]-31);assert(p[k][1]>p.hip[1]);
  }
  assert(p.nearElbow[1]<-2&&p.nearElbow[1]>-6,'prone elbow is not supporting the body');
});
test('digging grips both points of one shovel through insertion, lifting and throwing, including terrain',()=>{
  let min=0,max=-100;
  for(const ground of [-7,0,6])for(let i=0;i<240;i++){
    const u={...base,pose:'crouch',digging:true,digElapsed:i/100};
    updateSoldierGround(u,()=>374+ground,20,1);const p=soldierPose(u,20);
    for(const [key,grip]of [['nearHand','top'],['farHand','shaft']])
      assert(dist(p[key],weaponSocket(p.toolOrigin,p.toolAngle,SHOVEL_GRIPS[grip]))<1e-7,`${ground}/${i}/${key}: shovel floats`);
    const tip=weaponSocket(p.toolOrigin,p.toolAngle,SHOVEL_GRIPS.tip);
    min=Math.min(min,tip[1]-ground);max=Math.max(max,tip[1]-ground);
    assert(tip[0]>p.nearFoot[0]+7,'shovel strikes the boot');
  }
  assert(min<-14&&max> -1.1,'shovel never lifts or reaches soil');
});
test('side-on surrender shows one raised open palm and preserves the shoulder-to-wrist bones',()=>{
  for(const pose of ['idle','crouch','prone']){
    const p=soldierPose({...base,pose,surrendered:true,surrenderTime:1},20);
    assert.equal(p.nearHandShape,'open');assert.equal(p.hideFarArm,true);
    assert(p.nearElbow[0]>p.shoulder[0]+7);
    assert(p.nearHand[1]<p.head[1]-10);
    assert(Math.abs(dist(p.shoulder,p.nearElbow)-12)<1e-7);
    assert(Math.abs(dist(p.nearElbow,p.nearHand)-13)<1e-7);
    assert(Math.abs(dist([p.shoulder[0]+1,p.shoulder[1]-1],p.farElbow)-12)<1e-7);
    assert(Math.abs(dist(p.farElbow,p.farHand)-13)<1e-7);
  }
});
test('the rendered shovel blade clears the complete boot during the entire digging stroke',async()=>{
  const {createCanvas,loadImage}=createRequire(import.meta.url)('@napi-rs/canvas');
  globalThis.document={createElement:()=>createCanvas(1,1)};
  const {soldierArt}=await import('../game/soldier-art.ts');
  const art=soldierArt(await loadImage('public/art/soldier-parts-v178.png'),await loadImage('public/art/soldier-equipment-v178.png'));
  const boots=createCanvas(128,128),blade=createCanvas(128,128),bc=boots.getContext('2d'),sc=blade.getContext('2d');
  bc.imageSmoothingEnabled=false;sc.imageSmoothingEnabled=false;
  for(const identity of Object.keys(art.bodies))for(let i=0;i<240;i++){
    const p=soldierPose({...base,pose:'crouch',digging:true,digElapsed:i/100},20);
    bc.clearRect(0,0,128,128);sc.clearRect(0,0,128,128);
    bc.drawImage(art.bodies[identity].boot,64+Math.round(p.nearFoot[0])-4,96+Math.round(p.nearFoot[1])-2);
    sc.save();sc.translate(64+Math.round(p.toolOrigin[0]),96+Math.round(p.toolOrigin[1]));sc.rotate(p.toolAngle);
    sc.drawImage(art.equipment.shovel,0,18,8,9,0,18,8,9);sc.restore();
    const a=bc.getImageData(0,0,128,128).data,b=sc.getImageData(0,0,128,128).data;
    for(let k=3;k<a.length;k+=4)assert(!(a[k]>127&&b[k]>127),`${identity}/${i}: blade cuts into boot`);
  }
});
test('four stable fall destinations share the exact hit frame and maintain continuous fixed-length limbs',()=>{
  const from=soldierPose({...base,pose:'run',moving:true,gaitWeight:1,gaitRun:1,gaitPhase:2},20),ends=[];
  for(let variant=0;variant<4;variant++){
    let last=from;
    for(let frame=0;frame<=84;frame++){
      const p=soldierPose({...base,fallVariant:variant,wounded:true,woundedTime:frame/120,soldierFall:from},20+frame/120);
      for(const key of ['hip','neck','nearKnee','farKnee','nearFoot','farFoot','nearHand','farHand','head'])
        assert(dist(last[key],p[key])<(frame?4:1e-8),`${variant}/${frame}/${key}: fall jumps`);
      assert(Math.abs(dist(p.hip,p.neck)-22)<1e-7);
      assert(Math.abs(dist(p.hip,p.nearKnee)-17)<1e-7);
      if(frame>0)assert(soldierBodyBottom(p)<=1e-8,'rotated body part penetrates the ground');
      last=p;
    }
    ends.push(last);
  }
  for(let a=0;a<4;a++)for(let b=a+1;b<4;b++)
    assert(dist(ends[a].head,ends[b].head)+dist(ends[a].farFoot,ends[b].farFoot)>7,'duplicate fall poses');
});
