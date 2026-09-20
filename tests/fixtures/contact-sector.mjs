import {createGame,startGame,spawnUnit,setOrder,ground,crater,refreshVision} from '../../game/engine.ts';

/** Real vision/terrain fixture: no forced visible ids or target knowledge. */
export function contactSector(side=0,id='infantry') {
  const s=createGame(168);startGame(s);s.units=[];s.scenery=[];s.walls=[];s.aiIn=1e9;
  s.night=false;s.weather.disabled=true;s.terrain.fill(374);s.original.fill(374);
  const x=side?2400:1000,dir=side?-1:1;
  spawnUnit(s,side,id,x,{member:0});spawnUnit(s,1-side,'infantry',x+dir*160,{member:0});
  const [u,e]=s.units;
  for(const [v,vx]of [[u,x],[e,x+dir*160]])Object.assign(v,{x:vx,y:374,lane:0,pace:v===u?1:0,
    pose:v===u?'idle':'prone',poseAnimSeen:v===u?'stand':'prone',stanceLockUntil:1e9,
    tactic:v===u?'advance':'prone',decisionIn:1e9,cooldown:1e9,secondaryCooldown:1e9,
    fragLeft:0,hp:10000,maxHp:10000,personalMorale:100,readyAt:-100});
  setOrder(s,side,'rush');setOrder(s,1-side,'hold');refreshVision(s);
  function hideInCrater(){crater(s,e.x,35,28);e.y=ground(s,e.x);refreshVision(s);}
  return {s,u,e,dir,x,hideInCrater};
}
