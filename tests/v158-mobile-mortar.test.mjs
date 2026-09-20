import assert from 'node:assert/strict';
import test from 'node:test';
import {createGame,startGame,spawnUnit,tick,setOrder,refreshVision,CARDS,W} from '../game/engine.ts';
import {carrierScootGoal} from '../game/mobile-mortar.ts';

function arena(side=0,id='mortar_carrier',gap=360,x=1700) {
  const s=createGame(158);startGame(s);s.aiIn=1e9;s.units=[];s.scenery=[];s.walls=[];
  s.night=false;s.weather.disabled=true;s.terrain.fill(374);s.original.fill(374);
  const dir=side?-1:1;
  const one=(team,card,at)=>{const n=s.units.length;spawnUnit(s,team,card,at);const u=s.units[n];s.units.splice(n+1);
    Object.assign(u,{x:at,y:374,lane:0,pace:1,pose:CARDS[card].members?'crouch':'idle',
      poseAnimSeen:CARDS[card].members?'crouch':'stand',motion:'ground',cooldown:1000,decisionIn:1000,
      tactic:'advance',stillFor:10,readyAt:-100,fragLeft:0,hp:10000,maxHp:10000});return u;};
  const u=one(side,id,x),enemy=one(1-side,'infantry',x+dir*gap);u.cooldown=0;
  setOrder(s,side,'advance');setOrder(s,1-side,'hold');refreshVision(s);
  return {s,u,enemy,dir,one};
}
const run=(s,t,dt=1/60)=>{for(let i=0;i<Math.round(t/Math.min(dt,.05));i++)tick(s,dt);};
function launch(s,u){for(let i=0;i<180&&u.shots===0;i++)tick(s,1/60);assert.equal(u.shots,1);}

test('carrier displaces after its first shell, without waiting for enemy sound intelligence, on both sides',()=>{
  for(const side of [0,1]){
    const {s,u,dir,one}=arena(side),start=u.x;one(side,'scouts',start+dir*80);refreshVision(s);launch(s,u);
    assert(u.displaceGoal!==null&&u.displaceGoal!==undefined,'first-shot scoot must be planned');
    assert(s.batteryReports.filter(r=>r.side!==side).every(r=>r.hits===1));
    const goal=u.displaceGoal;assert.equal((start-goal)*dir,96);
    const shell=s.projectiles.find(p=>p.sourceUid===u.uid);assert(shell?.shell);const origin=shell.startX;
    run(s,.15);assert.equal(u.x,start,'let the authored firing recoil finish');
    let moves=0;
    for(let i=0;i<210;i++){const x=u.x,shots=u.shots;tick(s,1/60);
      if(u.x!==x){moves++;assert.equal(u.shots,shots);assert.equal(u.facing,dir);assert((u.x-start)*dir<=0);}
      assert(Math.abs(u.x-start)<=96.001);
    }
    assert(moves>20);assert(Math.abs(u.x-goal)<=2,JSON.stringify({side,x:u.x,goal,pending:u.displaceGoal,time:s.time,shots:u.shots}));assert.equal(u.displaceGoal,null);
    assert.equal(shell.startX,origin,'a launched shell does not follow its departing carrier');
    run(s,6);assert(u.shots>=2,'normal reload/fire resumes at the new position');
  }
});

test('hold suppresses new scoots and cancels one already under way without stranding its gun',()=>{
  for(const side of [0,1])for(const during of [false,true]){
    const {s,u}=arena(side);if(!during)setOrder(s,side,'hold');launch(s,u);
    if(during){run(s,1);assert(u.displaceGoal!=null);setOrder(s,side,'hold');}
    const x=u.x;run(s,.5);assert.equal(u.x,x);assert(u.displaceGoal==null);
    const shots=u.shots;run(s,9);assert(u.shots>shots);assert.equal(u.x,x);
  }
});

test('short range room and a friendly map edge never create an unreachable or oscillating scoot',()=>{
  for(const side of [0,1]){
    const edge=side?W-110:110,{s,u,dir}=arena(side,'mortar_carrier',360,edge);
    launch(s,u);assert(u.displaceGoal==null,'less than 48px usable room is not a bound');
    const x=u.x;run(s,3,.1);assert.equal(u.x,x);
    const b=arena(side,'mortar_carrier',360,side?W-145:145);launch(b.s,b.u);
    const goal=b.u.displaceGoal;assert.equal((b.u.x-goal)*b.dir,65);
    run(b.s,3,.2);assert(Math.abs(b.u.x-goal)<=2,JSON.stringify({side,x:b.u.x,goal,pending:b.u.displaceGoal,time:b.s.time}));assert.equal(b.u.displaceGoal,null);
    assert.equal(b.u.facing,dir);
    const c=arena(side),start=c.u.x;
    assert.equal(carrierScootGoal(c.u,start+dir*655,'advance',W),null);
    assert.equal(carrierScootGoal(c.u,start+dir*640,'advance',W),start-dir*60);
    assert.equal(carrierScootGoal(c.u,start-dir*200,'advance',W),null);
    assert.equal(CARDS.mortar_carrier.range-Math.abs(start+dir*640-(start-dir*60)),80);
  }
});

test('AI chooses dense foot mortar fire or a mobile battery from observed threats, not hidden guns',()=>{
  for(const mode of ['infantry','visible-gun','hidden-gun','sound-fix','stale-fix']){
    const {s}=arena();s.units=[];
    const group=(side,id,x)=>{const n=s.units.length;spawnUnit(s,side,id,x);s.units.slice(n).forEach(u=>
      Object.assign(u,{x,y:374,lane:0,pose:'idle',cooldown:1000,decisionIn:1000}));};
    group(1,'infantry',1900);group(1,'infantry',1980);group(0,'infantry',1600);
    if(mode==='visible-gun')group(0,'artillery',1700);
    if(mode==='hidden-gun')group(0,'artillery',100);
    if(mode==='sound-fix'||mode==='stale-fix')s.batteryReports.push({uid:++s.uid,side:1,x:900,maxLife:18,life:mode==='sound-fix'?12:2,hits:2,scatter:90});
    s.players[1].hand=['mortar','mortar_carrier'].map(id=>({id,uid:++s.uid}));
    s.players[1].deck=[];s.players[1].energy=10;s.aiIn=0;refreshVision(s);tick(s,.05);
    const added=s.units.filter(u=>u.side===1&&['mortar','mortar_carrier'].includes(u.id));
    assert(added.length,mode);
    assert.equal(added[0].id,['visible-gun','sound-fix'].includes(mode)?'mortar_carrier':'mortar',mode);
  }
});

test('foot mortar retains sustained first-shot fire and a hidden target does not cause phantom scoots',()=>{
  const {s,u}=arena(0,'mortar');launch(s,u);assert(u.displaceGoal==null);
  const full=arena(0,'mortar');const n=full.s.units.length;spawnUnit(full.s,0,'mortar',1700);
  const crew=full.s.units.slice(n);full.s.units=full.s.units.filter(v=>v===full.enemy||crew.includes(v));
  for(const v of crew)Object.assign(v,{x:1700,y:374,lane:0,pose:'crouch',poseAnimSeen:'crouch',cooldown:0,decisionIn:1000,tactic:'advance',readyAt:-100,pace:1,shots:0});
  refreshVision(full.s);run(full.s,2);
  assert(crew.every(v=>v.shots===1&&v.displaceGoal==null),JSON.stringify(crew.map(v=>({shots:v.shots,site:v.mortarSiteShots,goal:v.displaceGoal,x:v.x,pose:v.pose}))));
  const relocated=new Set();
  for(let i=0;i<540&&relocated.size<crew.length;i++){
    tick(full.s,1/60);for(const v of crew)if(v.displaceGoal!=null){assert(v.shots>=2);relocated.add(v.uid);}
  }
  assert.equal(relocated.size,crew.length,'every located crew member relocates after its own second round');
  const b=arena();b.enemy.x=4000;refreshVision(b.s);run(b.s,1);
  assert.equal(b.u.shots,0);assert(b.u.displaceGoal==null);
  assert(b.u.x>=1747,'normal movement must not stop for a firing-settle delay after each track step');
  b.u.shots=1;b.u.cooldown=0;const x=b.u.x;run(b.s,1);
  assert(b.u.x>=x+47,'after reloading, a battery without sight may continuously seek a new firing line');
});

test('the carrier finishes a stable stop before firing even if its reload is accelerated',()=>{
  const {s,u,one}=arena();one(0,'scouts',u.x+80);refreshVision(s);launch(s,u);run(s,.5);assert(u.moving);
  u.cooldown=0;const shots=u.shots;
  while(u.displaceGoal!=null){tick(s,1/60);assert.equal(u.shots,shots);}
  const stopped=s.time;run(s,.3);assert.equal(u.shots,shots);
  run(s,.5);assert(u.shots>shots,JSON.stringify({x:u.x,shots:u.shots,goal:u.displaceGoal,settle:u.carrierSettleUntil,time:s.time,moving:u.moving}));assert(s.time-stopped>=.55);
});

test('losing sight at the new position does not immediately undo the bound or permit blind fire',()=>{
  const {s,u}=arena();launch(s,u);const goal=u.displaceGoal;
  run(s,4);assert(Math.abs(u.x-goal)<=2);assert.equal(u.shots,1);
  run(s,2);assert(Math.abs(u.x-goal)<=2);assert.equal(u.shots,1);
});

test('a selected local withdrawal replaces automatic scooting and the mortar cannot fire on the move',()=>{
  for(const side of [0,1]){
    const {s,u,dir,one}=arena(side);one(side,'scouts',u.x+dir*80);refreshVision(s);launch(s,u);run(s,.5);
    Object.assign(u,{squadOrder:'retreat',squadOrderUntil:100,squadOrderX:u.x-dir*60,cooldown:0});
    const shots=u.shots;tick(s,1/60);assert.equal(u.displaceGoal,null);assert(u.moving);
    for(let i=0;i<65;i++){tick(s,1/60);assert.equal(u.shots,shots);}
    run(s,1.2);assert(u.shots>shots);assert.equal(u.squadOrder,'watch');
  }
});
