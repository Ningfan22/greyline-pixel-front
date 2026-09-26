import test from 'node:test';
import assert from 'node:assert/strict';
import {CARDS} from '../game/cards.ts';
import {soldierPose,soldierEyeOffset,soldierFootPlanted} from '../game/soldier-pose.ts';
import {WEAPON_SIGHTS,weaponSocket} from '../game/soldier-weapon-rig.ts';

const base={id:'infantry',member:0,uid:1,hp:100,x:1500,y:374,lane:0,facing:1,
  pose:'idle',motion:'ground',moving:false,walk:0,fire:0,secondaryFire:0,climbing:0,
  gaitWeight:0,gaitRun:0,gaitPhase:0,rifleReady:0,aimUntil:0};
const roles=Object.entries(CARDS).filter(([,card])=>card.members).flatMap(([id,card])=>
  Array.from({length:card.members},(_,member)=>({id,member})));
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const angle=(a,b)=>Math.atan2(b[1]-a[1],b[0]-a[0]);
const angleDelta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const farHip=p=>[p.hip[0]-1,p.hip[1]];
const farShoulder=p=>[p.shoulder[0]+1,p.shoulder[1]-1];
const label=u=>`${u.id}/${u.member}/${u.facing}/${u.gaitPhase}`;

function assertBones(p,context) {
  for(const [a,b,length] of [[p.hip,p.neck,22],[p.hip,p.nearKnee,17],
    [p.nearKnee,p.nearFoot,17],[farHip(p),p.farKnee,17],[p.farKnee,p.farFoot,17],
    [p.shoulder,p.nearElbow,12],[p.nearElbow,p.nearHand,13],
    [farShoulder(p),p.farElbow,12],[p.farElbow,p.farHand,13]])
    assert(Math.abs(distance(a,b)-length)<1e-7,`${context}: changed ${length}px bone`);
}

test('running ignores inherited aim readiness instead of keeping the cheek against the sight',()=>{
  for(const role of roles)for(const facing of [-1,1])for(const phase of [0,2,4,6]){
    const u={...base,...role,facing,pose:'run',moving:true,gaitWeight:1,gaitRun:1,gaitPhase:phase};
    const clear=soldierPose(u,20);
    for(const stale of [{rifleReady:1},{aimUntil:100},{rifleReady:1,aimUntil:100}]){
      const p=soldierPose({...u,...stale},20);
      assert.deepEqual(p.head,clear.head,`${label(u)}: inherited aim tucks the running head`);
      assert.deepEqual(p.weaponOrigin,clear.weaponOrigin,`${label(u)}: inherited aim raises the carried gun`);
      assert.equal(p.weaponAngle,clear.weaponAngle);
      const sight=WEAPON_SIGHTS[p.weapon];
      if(sight&&p.weapon!=='mortar'){
        const eye=weaponSocket(p.head,p.headAngle,soldierEyeOffset(u));
        const eyeRelief=weaponSocket(p.weaponOrigin,p.weaponAngle,[sight.rear[0]-sight.relief,sight.rear[1]]);
        assert(distance(eye,eyeRelief)>2,`${label(u)}: running eye remains locked to the sight`);
      }
    }
  }
});

test('the first running or crawling frame releases aim before the movement blend builds up',()=>{
  for(const role of roles)for(const pose of ['run','prone'])for(const facing of [-1,1]){
    const u={...base,...role,facing,pose,moving:true,gaitWeight:0,gaitRun:0};
    const free=soldierPose(u,20);
    const inherited=soldierPose({...u,rifleReady:1,aimUntil:100,fire:.2,secondaryFire:.2},20);
    assert.deepEqual(inherited.head,free.head,`${label(u)}/${pose}: movement starts with aimed head`);
    assert.deepEqual(inherited.weaponOrigin,free.weaponOrigin,`${label(u)}/${pose}: movement starts with aimed gun`);
    assert.equal(inherited.weaponAngle,free.weaponAngle);
  }
});

test('loaded running advances a low knee and low lead foot through the complete recovery arc',()=>{
  for(const role of roles){
    let leadSamples=0;
    for(let i=0;i<320;i++){
      const u={...base,...role,pose:'run',moving:true,gaitWeight:1,gaitRun:1,gaitPhase:i/40,
        rifleReady:1,aimUntil:100},p=soldierPose(u,20);
      for(const [knee,foot,far] of [['nearKnee','nearFoot',false],['farKnee','farFoot',true]]){
        const hip=far?farHip(p):p.hip;
        if(soldierFootPlanted(u,far)||p[foot][0]<=hip[0])continue;
        leadSamples++;
        assert(p[knee][1]-hip[1]>=7,`${label(u)}/${knee}: high-knee front swing`);
        assert(-3-p[foot][1]<=4,`${label(u)}/${foot}: lead foot rises above a loaded run`);
      }
      assertBones(p,label(u));
    }
    assert(leadSamples>80,`${role.id}/${role.member}: no lead-leg recovery was exercised`);
  }
});

test('ordinary marching carries the barrel below its distinct aimed position',()=>{
  for(const id of ['infantry','marines','armed_police','militia','machinegun','rocket','manpads','sniper_team'])
    for(const facing of [-1,1])for(const phase of [0,2,4,6]){
      const u={...base,id,facing,pose:'walk',moving:true,gaitWeight:1,gaitPhase:phase};
      const march=soldierPose(u,20),aim=soldierPose({...u,rifleReady:1,aimUntil:100},20);
      assert(march.weaponAngle-aim.weaponAngle>.06,`${label(u)}: patrol and aim share one barrel angle`);
      assert(march.muzzle[1]>aim.muzzle[1]+2,`${label(u)}: marching barrel never lowers`);
      assert(distance(march.head,aim.head)>2,`${label(u)}: marching head stays in the sight`);
      for(const key of ['hip','nearKnee','farKnee','nearFoot','farFoot'])
        assert.deepEqual(march[key],aim[key],`${label(u)}: aiming replaces the marching legs`);
    }
});

test('resting prone knees face the ground and the boots point rearward along the shins',()=>{
  for(const role of roles)for(const facing of [-1,1]){
    const u={...base,...role,facing,pose:'prone',rifleReady:1,aimUntil:100},p=soldierPose(u,20);
    for(const [knee,foot,bootAngle,far] of [['nearKnee','nearFoot','nearFootAngle',false],
      ['farKnee','farFoot','farFootAngle',true]]){
      const hip=far?farHip(p):p.hip;
      assert(p[knee][1]>hip[1]+4,`${label(u)}/${knee}: prone knee folds above the pelvis`);
      assert(p[foot][0]<p[knee][0]-12,`${label(u)}/${foot}: shin does not trail the knee`);
      assert(Number.isFinite(p[bootAngle]),`${label(u)}: prone boot has no orientation`);
      assert(Math.cos(p[bootAngle])<-.8,`${label(u)}: standing boot points forward on a prone leg`);
      assert(Math.abs(angleDelta(p[bootAngle],angle(p[knee],p[foot])))<.12,
        `${label(u)}: boot twists away from its trailing shin`);
    }
    assertBones(p,label(u));
  }
});

test('crawling advances the torso and support elbow while each leg keeps one continuous bend',()=>{
  for(const role of roles){
    const tracks={hip:[],neck:[],shoulder:[],farElbow:[]};let lastAngles;
    for(let i=0;i<=320;i++){
      const u={...base,...role,pose:'prone',moving:true,gaitWeight:1,gaitPhase:i/40,
        crouchTravel:0,proneTravel:1,rifleReady:1,aimUntil:100},p=soldierPose(u,20);
      const angles=[];
      for(const key of Object.keys(tracks))tracks[key].push(p[key]);
      for(const [knee,foot,far] of [['nearKnee','nearFoot',false],['farKnee','farFoot',true]]){
        const hip=far?farHip(p):p.hip,thigh=angle(hip,p[knee]),shin=angle(p[knee],p[foot]);
        const bend=angleDelta(shin,thigh);angles.push(thigh,shin);
        assert(bend>=-.02&&bend<1.15,`${label(u)}/${knee}: crawl leg reverses or folds back on itself`);
        assert(p[knee][1]>hip[1]+3,`${label(u)}/${knee}: crawl knee rises above the pelvis`);
      }
      if(lastAngles)for(let j=0;j<angles.length;j++)
        assert(Math.abs(angleDelta(angles[j],lastAngles[j]))<.12,
          `${label(u)}/${j}: crawl bone changes rotation branch`);
      lastAngles=angles;assertBones(p,label(u));
    }
    for(const [key,points] of Object.entries(tracks)){
      const span=axis=>Math.max(...points.map(p=>p[axis]))-Math.min(...points.map(p=>p[axis]));
      assert(Math.hypot(span(0),span(1))>.5,`${role.id}/${role.member}: ${key} freezes while legs crawl`);
      assert(distance(points[0],points.at(-1))<1e-6,`${role.id}/${role.member}: ${key} does not close its crawl cycle`);
    }
  }
});

test('rappel separates the overhead rope hand from the brake hand beside the hip',()=>{
  for(const role of roles)for(const facing of [-1,1]){
    const u={...base,...role,facing,rappelling:true,rifleReady:1,aimUntil:100};
    const p=soldierPose(u,20);
    assert.equal(p.action,'rappel');assert(p.slung);
    assert(p.farHand[1]<p.shoulder[1]-15,`${label(u)}: no hand holds the rope overhead`);
    assert(p.nearHand[1]>p.shoulder[1]+8,`${label(u)}: brake hand is incorrectly held overhead`);
    assert(distance(p.nearHand,p.farHand)>25,`${label(u)}: rappel hands collapse to one grip`);
    assertBones(p,label(u));
  }
});

test('surrender hides the overlapping far arm and shows an open raised palm',()=>{
  for(const role of roles)for(const pose of ['idle','crouch','prone']){
    const u={...base,...role,pose,surrendered:true,surrenderTime:1},p=soldierPose(u,20);
    assert.equal(p.hideFarArm,true,`${label(u)}: surrender paints a duplicate arm`);
    assert.equal(p.nearHandShape,'open');
    assert(p.nearHand[1]<p.shoulder[1]-10,`${label(u)}: surrender palm is not raised`);
    assertBones(p,label(u));
  }
});

test('a forward fall carries the hips beyond the original stance instead of pivoting on planted boots',()=>{
  for(const role of roles)for(const pose of ['idle','walk','run'])for(const facing of [-1,1]){
    const moving=pose!=='idle',u={...base,...role,facing,pose,moving,gaitWeight:moving?1:0,
      gaitRun:pose==='run'?1:0,gaitPhase:2},from=soldierPose(u,20);
    const fallen=soldierPose({...base,...role,facing,pose:'prone',wounded:true,woundedTime:.7,
      fallVariant:0,soldierFall:from},20.7);
    const worldForward=(facing*fallen.hip[0]-facing*from.hip[0])*facing;
    assert(worldForward>15,`${label(u)}: forward fall remains anchored over its old boots`);
  }
});

test('each upright fall releases both feet before settling and preserves continuous fixed-length anatomy',()=>{
  const points=['hip','neck','shoulder','head','nearKnee','farKnee','nearFoot','farFoot',
    'nearElbow','farElbow','nearHand','farHand'];
  for(const role of roles)for(const pose of ['idle','walk','run'])for(let variant=0;variant<4;variant++){
    const moving=pose!=='idle',u={...base,...role,pose,moving,gaitWeight:moving?1:0,
      gaitRun:pose==='run'?1:0,gaitPhase:2},from=soldierPose(u,20);
    let last=from,flight=0;
    for(let frame=0;frame<=84;frame++){
      const elapsed=frame/120,p=soldierPose({...base,...role,pose:'prone',wounded:true,
        woundedTime:elapsed,fallVariant:variant,soldierFall:from},20+elapsed);
      const context=`${role.id}/${role.member}/${pose}/${variant}/${frame}`;
      for(const key of points)
        assert(distance(last[key],p[key])<(frame?4:1e-8),`${context}/${key}: fall snaps away from its prior frame`);
      assertBones(p,context);
      if(frame>0&&frame<84)flight=Math.max(flight,Math.min(-3-p.nearFoot[1],-3-p.farFoot[1]));
      last=p;
    }
    assert(flight>3,`${role.id}/${role.member}/${pose}/${variant}: both boots stay pinned throughout the fall`);
  }
});
