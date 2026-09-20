import assert from 'node:assert/strict';
import test from 'node:test';
import {createGame,startGame,spawnUnit,setOrder,tick,ground,refreshVision} from '../game/engine.ts';
import {adultFrameChoice} from '../game/adult-animation.ts';
import {stanceHeightClass,stanceTransitionActive} from '../game/infantry-action-timing.ts';
import {infantryGeometry} from '../game/infantry-geometry.ts';

export function bankScene(side=0,pose='idle') {
  const s=createGame(156);startGame(s);s.aiIn=1e9;s.units=[];s.scenery=[];s.walls=[];
  s.night=false;s.weather.disabled=true;s.terrain.fill(374);s.original.fill(374);
  for(let x=860;x<=940;x++)s.terrain[x]=374+Math.min(44,(x-860)*2.2,(940-x)*2.2);
  spawnUnit(s,side,'infantry',900);s.units=[s.units[0]];const u=s.units[0];
  Object.assign(u,{x:900,y:ground(s,900),lane:0,pace:1,pose,poseAnimSeen:stanceHeightClass(pose),
    decisionIn:1000,tactic:pose==='idle'?'advance':pose,crouchTravel:pose==='crouch'?1:undefined,
    walk:0,hp:10000,maxHp:10000,personalMorale:95,suppression:0,fragLeft:0});
  setOrder(s,side,pose==='idle'?'advance':pose);return {s,u};
}
function reachBank(s,u){for(let i=0;i<240&&u.motion!=='bank';i++)tick(s,1/60);assert.equal(u.motion,'bank');}

test('both sides retain the committed body height through a bank, with no hidden posture drill',()=>{
  for(const side of [0,1])for(const pose of ['idle','crouch','prone']){
    const {s,u}=bankScene(side,pose);reachBank(s,u);const c=stanceHeightClass(pose);
    let frames=0;
    while(u.motion==='bank'){
      assert.equal(stanceHeightClass(u.pose),c,`${side}/${pose}`);
      assert(!stanceTransitionActive(u,s.time),'a bank must not conceal a posture clock');
      assert(Math.abs(u.y-ground(s,u.x))<1e-6,'planted body must not bob above the bank');
      const choice=adultFrameChoice(u,s.time);
      assert(choice.group!=='signals4');
      assert(choice.group!=='actions20'||![8,9,10,11].includes(choice.index));
      tick(s,1/60);assert(++frames<100);
    }
    assert(frames>20);assert.equal(stanceHeightClass(u.pose),c);assert(!stanceTransitionActive(u,s.time));
    assert((u.x-900)*(side?-1:1)>35);
  }
});

test('crouch travel height is retained on the first frame after reaching the bank top',()=>{
  for(const side of [0,1]){const {s,u}=bankScene(side,'crouch');reachBank(s,u);
    do {assert.equal(u.crouchTravel,1);assert.equal(infantryGeometry(u).bodyHeight,28);tick(s,1/60);}
    while(u.motion==='bank');
    assert.equal(u.crouchTravel,1);assert.equal(infantryGeometry(u).bodyHeight,28);
    assert.equal(adultFrameChoice(u,s.time).group,'crouch8');
  }
});

test('bank footwork advances with real distance instead of sliding a frozen frame',()=>{
  for(const pose of ['idle','crouch','prone']){const {s,u}=bankScene(0,pose);reachBank(s,u);
    const x=u.x,walk=u.walk;while(u.motion==='bank')tick(s,1/60);
    assert(Math.abs(u.walk-walk-Math.abs(u.x-x)/(pose==='prone'?4:6))<1e-8);
  }
});

test('a new order waits for grounded support, then plays the normal slow posture transition',()=>{
  const {s,u}=bankScene();reachBank(s,u);setOrder(s,0,'prone');
  while(u.motion==='bank'){assert.equal(stanceHeightClass(u.pose),'stand');assert(!stanceTransitionActive(u,s.time));tick(s,1/60);}
  const x=u.x;tick(s,1/60);assert(stanceTransitionActive(u,s.time));
  assert.equal(u.poseAnimFrom,'stand');assert.equal(u.poseAnimSeen,'prone');
  for(let i=0;i<100;i++){tick(s,1/60);assert.equal(u.x,x);assert.equal(adultFrameChoice(u,s.time).group,'stance16');}
});

test('revealed contact stops an ongoing forward bank at the same safety line as normal movement',()=>{
  for(const side of [0,1]){const {s,u}=bankScene(side);reachBank(s,u);tick(s,.15);
    const x=u.x,dir=side?-1:1;spawnUnit(s,1-side,'infantry',x+dir*105);const enemy=s.units[1];s.units=[u,enemy];
    Object.assign(enemy,{x:x+dir*105,y:ground(s,x+dir*105),pace:0,cooldown:1000,fragLeft:0});
    setOrder(s,1-side,'hold');refreshVision(s);tick(s,1/60);
    assert.equal(u.x,x);assert.equal(u.motion,'ground');assert.equal(u.moving,false);
    assert(Math.abs(u.y-ground(s,u.x))<1e-6);
  }
});

test('a bank retreat remains available and unseen contacts do not affect traversal',()=>{
  for(const side of [0,1])for(const retreat of [false,true]){
    const {s,u}=bankScene(side);reachBank(s,u);const dir=side?-1:1;
    if(retreat){u.motionFromX=u.x;u.motionToX=u.x-dir*24;}
    spawnUnit(s,1-side,'infantry',u.x+dir*(retreat?105:1800));const enemy=s.units[1];s.units=[u,enemy];
    Object.assign(enemy,{x:u.x+dir*(retreat?105:1800),pace:0,cooldown:1000,fragLeft:0});
    setOrder(s,1-side,'hold');refreshVision(s);const x=u.x;
    tick(s,.2);assert((u.x-x)*dir*(retreat?-1:1)>0);assert.equal(u.motion,'bank');
  }
});
