/** All soldier cards, both sides, real engine decisions and combat. Produces
 * coverage data rather than equating "didn't throw" with visual completion. */
import {mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const {CARDS,createGame,startGame,spawnUnit,tick,ground,setOrder}=await import('../game/engine.ts');
const {soldierPose}=await import('../game/soldier-pose.ts');
const {MAP_IDS}=await import('../game/maps.ts');
const out=mkdtempSync(join(tmpdir(),'greyline-soldier-combat-'));console.log(JSON.stringify({out}));
const ids=Object.keys(CARDS).filter(id=>CARDS[id].members),trials=[],failures=[],jointJumps=[];
for(const [index,id]of ids.entries())for(const side of [0,1]){
  if(process.argv[2]&&id!==process.argv[2])continue;
  const map=MAP_IDS[index%MAP_IDS.length],s=createGame(178,undefined,undefined,map,{mapSeed:178,difficulty:'standard'});
  startGame(s);s.aiIn=1e9;s.weather.disabled=true;
  const x=side?2020:1500,enemy=1-side,ex=side?1500:2020;
  spawnUnit(s,side,id,x);const squad=s.units.filter(u=>u.id===id&&u.side===side);
  spawnUnit(s,enemy,'infantry',ex);
  if(CARDS[id].antiAir||id==='manpads')spawnUnit(s,enemy,'helicopter',ex+100*(side?-1:1));
  if(['rocket','javelin','antiarmor','airborne_at'].includes(id))spawnUnit(s,enemy,'tank',ex+100*(side?-1:1));
  if(CARDS[id].trait==='mechanic'){
    spawnUnit(s,side,'tank',x+60*(side?-1:1));const tank=s.units.at(-1);tank.hp=tank.maxHp*.5;
  }
  if(['medic','medic_team','field_hospital'].includes(id)){
    spawnUnit(s,side,'infantry',x+35*(side?-1:1));const patient=s.units.at(-1);
    Object.assign(patient,{wounded:true,woundedTime:1,hp:8,bleedOut:120,y:ground(s,patient.x)});
  }
  const records=new Map(squad.map(u=>[u.uid,{member:u.member,poses:new Set(),actions:new Set(),movingFrames:0,shots:0,distance:0,lowTransitions:0}]));
  for(let frame=0;frame<3600&&s.status==='playing';frame++){
    // Exercise the real order API while AI retains casualty/support/cover decisions.
    if(frame===600)setOrder(s,side,'crouch');
    if(frame===1200)setOrder(s,side,'prone');
    if(frame===1800)setOrder(s,side,'advance');
    const before=new Map(s.units.filter(u=>records.has(u.uid)).map(u=>[u.uid,{x:u.x,lane:u.lane,phase:u.gaitPhase??u.walk,
      pose:u.pose,motion:u.motion,rig:soldierPose(u,s.time)}]));
    tick(s,1/60);
    for(const u of s.units){
      const r=records.get(u.uid),last=before.get(u.uid);if(!r||!last)continue;
      const p=soldierPose(u,s.time),distance=Math.hypot(u.x-last.x,u.lane-last.lane);
      r.poses.add(u.pose);r.actions.add(p.action);r.shots=Math.max(r.shots,u.shots);r.distance+=distance;
      if(u.poseAnimProgress!==undefined)r.lowTransitions++;
      if(distance>1e-4&&distance<12&&['ground','bank'].includes(u.motion)&&!u.rappelling&&!u.parachuting&&
        u.draggedByUid===undefined&&u.hp>0){
        r.movingFrames++;
        if(Math.abs((u.gaitPhase??u.walk)-last.phase)<1e-9)failures.push({id,side,member:u.member,time:s.time,issue:'stationary gait during displacement'});
      }
      for(const key of ['hip','neck','nearKnee','farKnee','nearFoot','farFoot','nearHand','farHand'])
        assert(p[key].every(Number.isFinite),`${id}/${u.member}/${key}`);
      let joint='',largest=0;
      for(const key of ['hip','neck','nearKnee','farKnee','nearFoot','farFoot']){
        const change=Math.hypot(p[key][0]-last.rig[key][0],p[key][1]-last.rig[key][1]);
        if(change>largest){joint=key;largest=change;}
      }
      if(largest>6)jointJumps.push({id,side,member:u.member,time:s.time,joint,pixels:largest,
        from:{pose:last.pose,motion:last.motion,action:last.rig.action,phase:last.phase,low:last.rig.low},
        to:{pose:u.pose,motion:u.motion,action:p.action,phase:u.gaitPhase,low:p.low},
        gaitWeight:u.gaitWeight,crouchTravel:u.crouchTravel,proneTravel:u.proneTravel,
        woundedTime:u.woundedTime,hasFall:!!u.soldierFall,
        previousJoints:{hip:last.rig.hip,knee:last.rig.nearKnee,foot:last.rig.nearFoot},
        currentJoints:{hip:p.hip,knee:p.nearKnee,foot:p.nearFoot},
        poseAnimFrom:u.poseAnimFrom,poseAnimSeen:u.poseAnimSeen,poseAnimAt:u.poseAnimAt});
    }
  }
  trials.push({id,side,map,seconds:s.time,members:[...records.values()].map(r=>({...r,poses:[...r.poses],actions:[...r.actions]}))});
  console.log(JSON.stringify({id,side,shots:[...records.values()].reduce((a,r)=>a+r.shots,0),moving:[...records.values()].reduce((a,r)=>a+r.movingFrames,0)}));
}
const report={cards:ids.length,trials,failures,jointJumps};writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({out,trials:trials.length,failures:failures.length,jointJumps:jointJumps.length}));assert.equal(failures.length,0);
