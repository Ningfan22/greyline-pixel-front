import test from 'node:test';
import assert from 'node:assert/strict';
import {soldierPose} from '../game/soldier-pose.ts';

const base={id:'infantry',uid:0,member:0,hp:100,x:1000,y:374,lane:0,facing:1,
  pose:'idle',motion:'ground',moving:false,gaitWeight:0,gaitRun:0,gaitPhase:0,
  rifleReady:1,aimUntil:100,fire:0,secondaryFire:0};
const angle=(a,b)=>Math.atan2(b[1]-a[1],b[0]-a[0]);
const delta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const lean=p=>angle(p.hip,p.neck)+Math.PI/2;
function flexion(p,side,part) {
  const far=side==='far';
  const root=part==='leg'?[p.hip[0]-(far?1:0),p.hip[1]]:
    [p.shoulder[0]+(far?1:0),p.shoulder[1]-(far?1:0)];
  const joint=p[side+(part==='leg'?'Knee':'Elbow')],end=p[side+(part==='leg'?'Foot':'Hand')];
  return delta(angle(joint,end),angle(root,joint));
}
// Every stance needs to survive the actual hit snapshot. Heavy weapons have
// different source elbows; prone elbows can legitimately have opposite signs.
const trajectories=[];
for(const id of ['infantry','marines','armed_police','militia','rocket','heavy_mg','mortar','sniper_team'])
  for(const pose of ['idle','walk','run','crouch','prone'])for(const phase of pose==='walk'||pose==='run'?[1,5]:[0]){
    const moving=pose==='walk'||pose==='run';
    const u={...base,id,pose,moving,gaitWeight:moving?1:0,gaitRun:pose==='run'?1:0,gaitPhase:phase};
    const from=soldierPose(u,20);
    for(let variant=0;variant<4;variant++){
      const frames=Array.from({length:85},(_,i)=>soldierPose({...base,id,pose:'prone',wounded:true,
        woundedTime:i/120,fallVariant:variant,soldierFall:from},20+i/120));
      trajectories.push({context:`${id}/${pose}/${phase}/fall${variant}`,from,frames});
    }
  }

test('all four falls preserve a forward knee hinge through impact and rest',()=>{
  for(const {context,frames} of trajectories)for(const [i,p] of frames.entries())for(const side of ['near','far']){
    const bend=flexion(p,side,'leg');
    assert(bend>=-1e-6,`${context}/${i}/${side}: knee hyperextends backwards (${bend})`);
    assert(bend<=2.4,`${context}/${i}/${side}: calf folds through the thigh (${bend})`);
    if(i)assert(Math.abs(delta(bend,flexion(frames[i-1],side,'leg')))<.2,
      `${context}/${i}/${side}: knee abruptly swaps its hinge branch`);
  }
});

test('fall elbows retain their source hinge instead of turning inside out',()=>{
  for(const {context,from,frames} of trajectories)for(const side of ['near','far']){
    const initial=flexion(from,side,'arm'),sign=Math.sign(initial)||-1;
    for(const [i,p] of frames.entries()){
      const bend=flexion(p,side,'arm');
      assert(bend*sign>=-1e-6,`${context}/${i}/${side}: elbow reverses its original bend (${initial} -> ${bend})`);
      assert(Math.abs(bend)<=Math.max(2.65,Math.abs(initial))+1e-6,
        `${context}/${i}/${side}: forearm folds through the upper arm (${bend})`);
      if(i)assert(Math.abs(delta(bend,flexion(frames[i-1],side,'arm')))<.2,
        `${context}/${i}/${side}: elbow snaps while the shoulder rotates`);
    }
  }
});

test('a fallen head follows the chest and its neck never extends beyond the source attachment',()=>{
  for(const {context,from,frames} of trajectories){
    const sourceFlex=Math.abs(delta(from.headAngle,lean(from)));
    const sourceOffset=distance(from.head,from.neck);
    for(const [i,p] of frames.entries()){
      const flex=Math.abs(delta(p.headAngle,lean(p)));
      assert(flex<=Math.max(sourceFlex,.4)+.015,
        `${context}/${i}: neck rotates farther away from the chest during the fall (${flex})`);
      assert(distance(p.head,p.neck)<=Math.max(sourceOffset,Math.sqrt(5))+.05,
        `${context}/${i}: head attachment length grows during the fall`);
    }
    const rest=frames.at(-1);
    assert(Math.abs(delta(rest.headAngle,lean(rest)))<=.4,
      `${context}: resting head remains twisted against the chest`);
    const neckOffset=[rest.head[0]-rest.neck[0],rest.head[1]-rest.neck[1]],a=-lean(rest);
    const local=[neckOffset[0]*Math.cos(a)-neckOffset[1]*Math.sin(a),neckOffset[0]*Math.sin(a)+neckOffset[1]*Math.cos(a)];
    assert(local[1]>=-.5&&local[1]<=3.5&&Math.abs(local[0])<=3,
      `${context}: head anchor remains in world space while the chest rotates`);
  }
});
