import assert from 'node:assert/strict';
import test from 'node:test';
import {tick,refreshVision,visibleToSide,spawnUnit,CARDS,createGame,startGame} from '../game/engine.ts';
import {setSquadOrder} from '../game/squad-orders.ts';
import {grenadePriorityTarget,grenadeRelayReady} from '../game/grenade-team.ts';
import {adultFrameChoice} from '../game/adult-animation.ts';
import {grenadeTeamArena} from './fixtures/grenade-team-arena.mjs';
const step=(s,n)=>{for(let i=0;i<n;i++)tick(s,1/60);};

test('specialists distinguish real heavy operators from their escorts and armored vehicles',()=>{
  for(const [id,member,expected] of [['machinegun',0,true],['machinegun',1,false],
    ['antiarmor',0,true],['antiarmor',2,false],['mortar',0,true],['anti_tank_gun',0,true],
    ['tank',0,false],['pickup',0,false],['helicopter',0,false],['infantry',0,false]])
    assert.equal(grenadePriorityTarget({id,member}),expected,`${id}/${member}`);
  assert.equal(CARDS.assault_grenadiers.frags,3);
  assert.equal(CARDS.assault.infantryAbility,'smoke_assault');
});

test('both directions and all postures throw at a single gunner under real rifle cover, without changing pose',()=>{
  for(const side of [0,1])for(const pose of ['idle','crouch','prone']) {
    const {s,squad,enemy}=grenadeTeamArena(side,pose);const hp=enemy.hp;
    let thrower,shotsAtStart,coveredShots=0,released=false;const cels=new Set();
    for(let i=0;i<180;i++) {
      const before=squad.map(u=>u.shots);tick(s,1/60);
      assert(squad.filter(u=>(u.fragThrow??0)>0).length<=1);
      thrower??=squad.find(u=>(u.fragThrow??0)>0);
      if(!thrower)continue;
      shotsAtStart??=thrower.shots;
      if(thrower.fragThrow>0) {
        assert.equal(thrower.shots,shotsAtStart);assert.equal(thrower.pose,pose);
        const f=adultFrameChoice(thrower,s.time);
        assert.equal(f.group,pose==='idle'?'grenade8':'lowGrenade32');cels.add(f.index);
        coveredShots+=squad.reduce((sum,u,j)=>sum+(u===thrower?0:u.shots-before[j]),0);
      }
      if(s.projectiles.some(p=>p.sourceUid===thrower.uid&&p.ammunition==='grenade'))released=true;
    }
    assert(thrower,`${side}/${pose}: no covered throw`);assert(released);assert(coveredShots>0);
    assert.equal(cels.size,pose==='idle'?8:16);assert(enemy.hp<hp);
    assert.equal(s.smokes.length,0,'no borrowed smoke-assault ability');
  }
});

test('one squad never overlaps a wind-up with a previous live grenade, and spends each grenade only once',()=>{
  const {s,squad}=grenadeTeamArena();const owners=new Set(squad.map(u=>u.uid)),rounds=new Set();
  const starts=new Set();let overlapShots=0;
  for(let i=0;i<900;i++) {
    const before=squad.reduce((a,u)=>a+u.shots,0);tick(s,1/60);
    const inFlight=s.projectiles.filter(p=>p.ammunition==='grenade'&&owners.has(p.sourceUid));
    assert(inFlight.length<=1);inFlight.forEach(p=>rounds.add(p.uid));
    const throwing=squad.filter(u=>(u.fragThrow??0)>0);assert(throwing.length<=1);
    if(throwing.length) {
      const u=throwing[0];starts.add(`${u.uid}/${u.fragThrowStartedAt}`);
      assert(inFlight.every(p=>p.sourceUid===u.uid));
      overlapShots+=squad.reduce((a,v)=>a+v.shots,0)-before;
    }
    assert.equal(squad.reduce((a,u)=>a+3-u.fragLeft,0),rounds.size);
  }
  assert(starts.size>=2);assert(rounds.size>=2);assert(overlapShots>0);
});

test('the released hand grenade physically lands and damages the gunner without further rifle hits',()=>{
  const {s,squad,enemy}=grenadeTeamArena();let grenade;
  for(let i=0;i<180&&!grenade;i++){tick(s,1/60);grenade=s.projectiles.find(p=>p.ammunition==='grenade');}
  assert(grenade);assert.equal(grenade.damage,42);assert.equal(grenade.radius,40);
  squad.forEach(u=>u.cooldown=10000);
  step(s,6);assert(s.projectiles.some(p=>p.uid===grenade.uid));
  assert(s.projectiles.every(p=>p.ammunition==='grenade'),'earlier rifle rounds already resolved');
  const hp=enemy.hp;step(s,90);assert(enemy.hp<hp);
  assert(!s.projectiles.some(p=>p.uid===grenade.uid));
});

test('ordinary assault needs a cluster; specialists do not waste grenades on one rifle escort',()=>{
  for(const [id,enemyId,member] of [['assault','machinegun',0],['rangers','machinegun',0],
    ['assault_grenadiers','machinegun',1],['assault_grenadiers','infantry',0],['assault_grenadiers','tank',0]]) {
    const {s,squad}=grenadeTeamArena(0,'crouch',id,enemyId,member);step(s,180);
    assert(squad.every(u=>u.fragLeft===CARDS[id].frags),`${id}/${enemyId}/${member}`);
    assert(squad.some(u=>u.shots>0),'still uses its rifle');
  }
});

test('cover is not supplied by a busy, empty, distant, hidden or merely nominal teammate',()=>{
  const patches=[{x:500},{lane:50},{hp:0},{wounded:true},{surrendered:true},{moving:true},
    {rappelling:true},{parachuting:true},{motion:'bank'},{climbing:1},{suppression:60},
    {personalMorale:30},{tending:true},{digging:true},{fragThrow:.5},{ammo:2},{reloadingUntil:20,tacticalReload:true},
    {lastCombatShotAt:7},{poseAnimFrom:'stand',poseAnimAt:9.5},{crouchTravel:.5},{stillFor:.2},
    {tactic:'retreat'},{squadOrder:'retreat'},{withdrawUntil:12},{firstAidUntil:12}];
  for(const patch of patches) {
    const {s,squad}=grenadeTeamArena();s.time=10;s.units.splice(2,2);
    const [u,mate]=squad;mate.lastCombatShotAt=9.8;
    assert(grenadeRelayReady(s,u,()=>true));Object.assign(mate,patch);
    assert(!grenadeRelayReady(s,u,()=>true),JSON.stringify(patch));
  }
  const {s,squad}=grenadeTeamArena();s.time=10;squad.forEach(v=>v.lastCombatShotAt=9.8);
  assert(!grenadeRelayReady(s,squad[0],()=>false));
});

test('no throws through smoke, roofs, at unseen guns, into allies, or by a separated survivor',()=>{
  for(const mode of ['smoke','roof','hidden','ally','solo','retreat']) {
    const {s,squad,enemy,x}=grenadeTeamArena();
    if(mode==='smoke')s.smokes=[{x:x+90,life:20}];
    if(mode==='roof')s.scenery=[{id:900,kind:'house',x:x+90,y:374,seed:1,parts:[{
      id:0,kind:'roof',x:x+60,y:230,w:50,h:70,hp:10000,maxHp:10000,brokenAt:-1}]}];
    if(mode==='hidden')enemy.x=3200;
    if(mode==='ally')spawnUnit(s,0,'infantry',enemy.x-10,{member:0});
    if(mode==='solo')s.units=[squad[0],enemy];
    if(mode==='retreat')assert(setSquadOrder(s,0,squad[0].squad,'retreat').ok);
    refreshVision(s);if(mode==='hidden'||mode==='smoke')assert(!visibleToSide(s,0,enemy));
    step(s,120);assert(squad.every(u=>u.fragLeft===3),mode);
    if(mode==='roof')assert(squad.some(u=>u.shots>0),'rifle ray still passes below the roof');
  }
});

test('AI prefers covered grenadiers against known operators, not escorts or invisible weapons',()=>{
  for(const [mode,id,member,x,expected] of [
    ['crew','machinegun',0,1620,'assault_grenadiers'],['escort','machinegun',1,1620,'assault'],
    ['rifle','infantry',0,1620,'assault'],['hidden','machinegun',0,100,'assault']]) {
    const s=createGame(169);startGame(s);s.units=[];s.scenery=[];s.walls=[];
    s.terrain.fill(374);s.original.fill(374);s.weather.disabled=true;s.night=false;s.time=120;
    for(const x of [1900,1980])spawnUnit(s,1,'infantry',x);
    s.units.forEach(v=>Object.assign(v,{y:374,cooldown:10000,decisionIn:1000}));
    spawnUnit(s,0,id,x,{member});s.units.at(-1).y=374;
    s.players[1].hand=['assault','assault_grenadiers'].map(id=>({id,uid:++s.uid}));
    s.players[1].energy=10;s.players[1].deck=[];s.aiIn=0;refreshVision(s);tick(s,.05);
    assert.equal(s.units.find(v=>v.side===1&&['assault','assault_grenadiers'].includes(v.id))?.id,expected,mode);
    assert.equal(s.players[1].played,1);assert.equal(s.players[1].hand.length,1);
  }
});
