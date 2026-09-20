import {createGame,startGame,spawnUnit,setOrder,refreshVision} from '../../game/engine.ts';

export function grenadeTeamArena(side=0,pose='crouch',id='assault_grenadiers',enemyId='machinegun',member=0) {
  const s=createGame(169);startGame(s);s.aiIn=1e9;s.units=[];s.scenery=[];s.walls=[];
  s.terrain.fill(374);s.original.fill(374);s.weather.disabled=true;s.night=false;
  const x=side?2200:1300,dir=side?-1:1;
  spawnUnit(s,side,id,x);const squad=[...s.units];
  const settled=(u,vx,p=pose)=>Object.assign(u,{x:vx,y:374,lane:0,pose:p,
    poseAnimSeen:p==='idle'?'stand':p,poseAnimFrom:undefined,poseAnimAt:undefined,
    crouchTravel:0,stanceLockUntil:100,motion:'ground',moving:false,stillFor:5,readyAt:-100,
    hp:10000,maxHp:10000,shots:0,ammo:30,ammoReserve:150,cooldown:0,decisionIn:1000,
    tactic:p==='prone'?'prone':'crouch',aimUntil:0,cover:0,coverGoal:null,firingGoal:null,
    personalMorale:96,suppression:0});
  squad.forEach((u,i)=>settled(u,x-dir*i*10));
  const addEnemy=(id,offset,m=0)=>{
    spawnUnit(s,1-side,id,x+dir*offset,{member:m});const u=s.units.at(-1);
    settled(u,x+dir*offset,'crouch');u.cooldown=10000;u.fragLeft=0;return u;
  };
  const enemy=addEnemy(enemyId,180,member);
  setOrder(s,0,'hold');setOrder(s,1,'hold');refreshVision(s);
  return {s,squad,enemy,x,dir,addEnemy};
}
