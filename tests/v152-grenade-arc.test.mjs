import assert from 'node:assert/strict';
import test from 'node:test';
import {createGame,startGame,spawnUnit,tick,setOrder,refreshVision,muzzlePoint,
  terrainIntercept,directShotIntercept,projectileIntercept,CARDS} from '../game/engine.ts';
import {ammunition,FLIGHT,magazine} from '../game/ballistics.ts';
import {lobY,lobIntercept} from '../game/lob-trajectory.ts';
import {adultFrameChoice} from '../game/adult-animation.ts';
import {grenadeLauncherFrame} from '../game/grenade-launcher-art.ts';

function arena(side=0,id='grenadiers') {
  const s=createGame(152);startGame(s);s.aiIn=1e9;s.units=[];s.scenery=[];s.walls=[];
  s.terrain.fill(374);s.original.fill(374);s.weather.disabled=true;s.night=false;
  const x=side?2400:1000,dir=side?-1:1;
  spawnUnit(s,side,id,x,{member:0});const u=s.units.at(-1);
  spawnUnit(s,1-side,'infantry',x+dir*300,{member:0});const enemy=s.units.at(-1);
  for(const [v,vx] of [[u,x],[enemy,x+dir*300]])Object.assign(v,{x:vx,y:374,lane:0,
    hp:10000,maxHp:10000,cooldown:v===u?0:10000,decisionIn:1000,tactic:'crouch',
    pose:'crouch',poseAnimSeen:'crouch',stanceLockUntil:100,moving:false,motion:'ground',
    stillFor:5,readyAt:-100,fragLeft:0,aimUntil:0,cover:0,coverGoal:null,firingGoal:null,
    personalMorale:96,suppression:0,shots:0});
  setOrder(s,0,'hold');setOrder(s,1,'hold');
  const mid=x+dir*150;s.terrain.fill(340,mid-24,mid+24);s.terrainVersion++;
  refreshVision(s);return{s,u,enemy,mid,dir};
}
test('grenade permissions follow the live parabola in both directions, not the rocket ray',()=>{
  for(const side of [0,1]) {
    const {s,u,enemy}=arena(side),m=muzzlePoint(u,enemy.x),ty=enemy.y-23;
    assert(terrainIntercept(s,m.x,m.y,enemy.x,ty));
    assert.equal(directShotIntercept(s,'grenade',m.x,m.y,enemy.x,ty),null);
    assert(directShotIntercept(s,'rocket',m.x,m.y,enemy.x,ty));
    assert.equal(ammunition(u.id),'grenade');assert.equal(magazine(u.id),null);
    assert(!CARDS[u.id].indirect);assert(!CARDS[u.id].antiAir);
    assert.equal(lobY(m.y,ty,FLIGHT.grenade.arc,.5),(m.y+ty)/2-70);
  }
});
test('real grenadiers launch over the bank and the travelled round reaches the target',()=>{
  for(const side of [0,1]) {
    const {s,u,enemy,mid}=arena(side),hp=enemy.hp;let launched,cleared=false;
    for(let i=0;i<120;i++) {
      tick(s,1/60);const p=s.projectiles.find(p=>p.sourceUid===u.uid);
      if(p){launched??={...p};if(Math.abs(p.x-mid)<20){assert(p.y<320);cleared=true;}}
      assert(!['signals4','reactions8'].includes(adultFrameChoice(u,s.time).group));
      assert.equal(u.pose,'crouch');
      if(enemy.hp<hp)break;
    }
    assert(launched,JSON.stringify({side,x:u.x,pose:u.pose,target:u.target,visible:s.visible}));
    assert.equal(launched.ammunition,'grenade');assert.equal(launched.arc,70);
    assert(cleared);assert(enemy.hp<hp);assert.equal(u.shots,1);
  }
});
test('high soil, an overhead roof and descent obstacles still block the complete arc',()=>{
  for(const side of [0,1])for(const block of ['soil','roof','descent']) {
    const {s,u,enemy,mid,dir}=arena(side),m=muzzlePoint(u,enemy.x),ty=enemy.y-23;
    if(block==='soil'){s.terrain.fill(250,mid-24,mid+24);s.terrainVersion++;}
    else {
      const x=block==='roof'?mid:enemy.x-dir*45;
      s.scenery=[{id:900,kind:'house',x,y:374,seed:1,parts:[{id:0,
        kind:block==='roof'?'roof':'wall',x:x-12,y:250,w:24,h:block==='roof'?50:124,hp:100,maxHp:100,brokenAt:-1}]}];
    }
    assert(directShotIntercept(s,'grenade',m.x,m.y,enemy.x,ty),`${side}/${block}`);
    const p={startX:m.x,startY:m.y,tx:enemy.x,ty,ammunition:'grenade',arc:70,side};
    const collision=lobIntercept(m.x,m.y,enemy.x,ty,70,(x0,y0,x1,y1)=>projectileIntercept(s,p,x0,y0,x1,y1));
    assert(collision,`live collision ${side}/${block}`);
  }
});
test('grenadiers gain no smoke/hidden-target or solid-muzzle escape privilege',()=>{
  for(const mode of ['smoke','hidden','muzzle']) {
    const {s,u,enemy,mid}=arena();
    if(mode==='smoke')s.smokes=[{x:mid,life:10}];
    if(mode==='hidden'){enemy.x=2100;enemy.y=374;}
    if(mode==='muzzle'){
      // A narrow bank immediately in front of the body, before the muzzle.
      s.terrain.fill(320,1008,1020);s.terrainVersion++;
    }
    refreshVision(s);
    for(let i=0;i<30;i++)tick(s,1/60);
    assert.equal(u.shots,0,mode);
  }
});
test('launcher drill runs exactly once per real shot and never replaces a hit, move or transition',()=>{
  const {s,u,enemy}=arena();let fired=false,previous=-1;const seen=new Set();
  for(let i=0;i<200;i++) {
    tick(s,1/60);if(u.shots&&!fired){fired=true;u.cooldown=10000;}
    if(!fired)continue;
    const f=grenadeLauncherFrame(u,s.time);assert(f!==null);seen.add(f);
    if(u.launcherCycleRemaining>0){assert(f>=previous);previous=f;}
    else assert.equal(f,8);
    assert.equal(u.pose,'crouch');assert.equal(u.shots,1);
  }
  assert.equal(seen.size,8);assert.equal(u.launcherCycleRemaining,0);
  for(const patch of [{moving:true},{motion:'bank'},{hp:0},{wounded:true},{surrendered:true},
    {climbing:1},{rappelling:true},{parachuting:true},{flash:.1},{fragThrow:1},{tending:true},
    {digging:true},{draggingUid:42},{crouchTravel:.5},
    {poseAnimFrom:'stand',poseAnimSeen:'crouch',poseAnimAt:s.time}])
    assert.equal(grenadeLauncherFrame({...u,...patch},s.time),null,JSON.stringify(patch));
});
