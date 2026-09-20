import {createGame,startGame,spawnUnit,setOrder,refreshVision,CARDS} from '../../game/engine.ts';
export function tankRoleArena(id='tank',side=0,seed=160){
  const s=createGame(seed);startGame(s);s.aiIn=1e9;s.units=[];s.scenery=[];s.walls=[];
  s.night=false;s.weather.disabled=true;s.terrain.fill(374);s.original.fill(374);
  const dir=side?-1:1,x=side?2400:1400;
  function one(team,card,at,member=0){
    const n=s.units.length;spawnUnit(s,team,card,at,{member});const v=s.units[n];s.units.splice(n+1);
    Object.assign(v,{x:at,y:374,lane:0,pace:1,pose:CARDS[card].members?'crouch':'idle',
      poseAnimSeen:CARDS[card].members?'crouch':'stand',motion:'ground',cooldown:10000,
      secondaryCooldown:10000,decisionIn:1000,tactic:'advance',stillFor:10,readyAt:-100,
      fragLeft:0,stanceLockUntil:100,emplaced:true,emplacementSetupUntil:0});
    return v;
  }
  const tank=one(side,id,x);tank.cooldown=0;
  const add=(card,gap,member=0)=>one(1-side,card,x+dir*gap,member);
  const targets={
    armor:add('tank',490),launcher:add('antiarmor',390),gun:add('artillery',440),
    rifle1:add('infantry',285),rifle2:add('infantry',300),rifle3:add('infantry',315),
  };
  setOrder(s,0,'hold');setOrder(s,1,'hold');refreshVision(s);
  return {s,tank,targets,add,one,x,dir,side};
}
