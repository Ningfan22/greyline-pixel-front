import {createGame,startGame,spawnUnit,setOrder} from '../../game/engine.ts';
export function proneStartStop(side=0,id='infantry',member=0) {
  const s=createGame(170);startGame(s);s.aiIn=1e9;s.units=[];s.scenery=[];s.walls=[];
  s.terrain.fill(374);s.original.fill(374);s.weather.disabled=true;s.night=false;
  const x=side?2400:1000;spawnUnit(s,side,id,x,{member});const u=s.units.at(-1);
  Object.assign(u,{x,y:374,lane:0,pace:1,pose:'prone',poseAnimSeen:'prone',
    poseAnimFrom:undefined,poseAnimAt:undefined,stanceLockUntil:100,motion:'ground',
    hp:10000,maxHp:10000,decisionIn:1000,tactic:'prone',cooldown:1000,stillFor:0,
    moving:false,personalMorale:100,suppression:0,readyAt:-100,fragLeft:0,
    fire:0,flash:0,secondaryFire:0,aimUntil:0});
  setOrder(s,side,'prone');return{s,u,x,dir:side?-1:1};
}
