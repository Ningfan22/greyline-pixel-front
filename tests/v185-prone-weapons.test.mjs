import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {soldierPose,soldierEyeOffset} from '../game/soldier-pose.ts';
import {WEAPON_GRIPS,WEAPON_SIGHTS,weaponPlacement,weaponSocket} from '../game/soldier-weapon-rig.ts';

const base={uid:1,member:0,hp:100,x:950,y:374,lane:0,facing:1,
  pose:'prone',motion:'ground',moving:false,walk:0,gaitWeight:0,gaitRun:0,
  gaitPhase:0,fire:0,secondaryFire:0,rifleReady:1,aimUntil:100};
const roles=['infantry','machinegun','sniper_team','rocket','manpads','grenadiers','flame_team'];
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);

test('resting prone guns sit in the shoulder pocket with a low sight line and a grounded trigger elbow',()=>{
  for(const id of roles)for(const facing of [-1,1]){
    const u={...base,id,facing},p=soldierPose(u,20),grips=WEAPON_GRIPS[p.weapon];
    const stock=weaponSocket(p.weaponOrigin,p.weaponAngle,grips.shoulder);
    assert(stock[1]>=p.shoulder[1]-1.3,`${id}: gun rests above the shoulder`);
    assert(stock[1]<=p.shoulder[1]+1,`${id}: gun drops out of the shoulder pocket`);
    assert(distance(stock,p.shoulder)<5.1,`${id}: stock separates from the shoulder`);
    assert(p.nearElbow[1]>-6&&p.nearElbow[1]<=-2,`${id}: trigger elbow folds upward or passes through the floor`);
    assert(p.farElbow[1]>p.shoulder[1]-1,`${id}: support elbow folds above the shoulder`);
    for(const [hand,key] of [['nearHand','trigger'],['farHand','support']])
      assert(distance(p[hand],weaponSocket(p.weaponOrigin,p.weaponAngle,grips[key]))<1e-8,`${id}: hand misses its gun grip`);
    const sight=WEAPON_SIGHTS[p.weapon],eye=weaponSocket(p.head,p.headAngle,soldierEyeOffset(u));
    const aim=weaponSocket(p.weaponOrigin,p.weaponAngle,[sight.rear[0]-sight.relief,sight.rear[1]]);
    assert(distance(eye,aim)<1e-8,`${id}: lowered gun loses the eye line`);
    assert(distance(p.head,p.neck)<7,`${id}: head separates from the neck`);
  }
});

test('standing, kneeling, walking and running retain all accepted v184 weapon placements',()=>{
  const placements=[];
  for(const name of ['rifle','lmg','sniper','rocket','manpads','grenade','flame','hmg','mortar'])
    for(const low of [0,.25,.5,.75,1])for(const travel of [0,.3,1])
      for(const ready of [0,.5,1])for(const run of [0,.5,1])
        placements.push(weaponPlacement(name,[3,-34],low,travel,ready,0,run));
  // Captured before the prone-only repair: 1,215 complete transforms.
  assert.equal(createHash('sha256').update(JSON.stringify(placements)).digest('hex'),
    '36009411500b16c39f8cf862c350d999389789ba5f307fa5bcc20e65edb23020');
});

test('the accepted crawling gun transform remains unchanged while the stationary gun settles lower',()=>{
  for(const id of roles){
    const u={...base,id,moving:true,gaitWeight:1,proneTravel:1};
    for(const phase of [0,1,2,3,4,5,6,7]){
      const p=soldierPose({...u,gaitPhase:phase},20),grips=WEAPON_GRIPS[p.weapon];
      const stock=weaponSocket(p.weaponOrigin,p.weaponAngle,grips.shoulder);
      assert(distance(stock,[p.shoulder[0]-1,p.shoulder[1]-5])<1e-8,`${id}/${phase}: crawling carry changed`);
    }
    const stand=soldierPose({...base,id},20),crawl=soldierPose(u,20);
    assert(stand.muzzle[1]-stand.shoulder[1]>crawl.muzzle[1]-crawl.shoulder[1]+3.7,
      `${id}: the settled gun does not lower from the crawling carry`);
  }
});

test('lowering a rifle from crawling carry to prone support never reverses the elbow bend',()=>{
  for(const id of ['infantry','machinegun','sniper_team','manpads','flame_team'])
    for(let phase=0;phase<8;phase+=.25){
      let previous;
      for(let step=0;step<=100;step++){
        const weight=step/100,p=soldierPose({...base,id,moving:weight>0,gaitWeight:weight,
          proneTravel:1,gaitPhase:phase,rifleReady:0},20);
        assert(p.nearElbow[1]>p.shoulder[1],`${id}/${phase}/${weight}: elbow turns above its shoulder`);
        if(previous)assert(distance(previous,p.nearElbow)<.25,`${id}/${phase}/${weight}: elbow snaps during settling`);
        previous=p.nearElbow;
      }
    }
});
