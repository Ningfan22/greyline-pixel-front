import assert from 'node:assert/strict';
import test from 'node:test';
import {createGame,startGame,spawnUnit,tick,setOrder,refreshVision,CARDS} from '../game/engine.ts';
import {tryVeteranReload,relayReloadActive} from '../game/veteran-team.ts';
import {adultFrameChoice} from '../game/adult-animation.ts';
import {setSquadOrder} from '../game/squad-orders.ts';

function arena(side=0,id='veteran_squad') {
  const s=createGame(151);startGame(s);s.aiIn=1e9;s.units=[];s.scenery=[];s.walls=[];
  s.terrain.fill(374);s.original.fill(374);s.weather.disabled=true;s.night=false;
  const x=side?2400:1000,dir=side?-1:1;spawnUnit(s,side,id,x);const squad=[...s.units];
  squad.forEach((u,i)=>Object.assign(u,{x:x-dir*i*18,y:374,lane:0,pose:'crouch',poseAnimSeen:'crouch',
    crouchTravel:0,stanceLockUntil:100,motion:'ground',moving:false,stillFor:5,readyAt:-100,
    hp:10000,maxHp:10000,shots:0,ammo:12,ammoReserve:90,cooldown:0,decisionIn:1000,tactic:'crouch',
    fragLeft:0,aimUntil:0,cover:0,coverGoal:null,firingGoal:null,personalMorale:96,suppression:0}));
  const n=s.units.length;spawnUnit(s,1-side,'infantry',x+dir*300);s.units.splice(n+1);const enemy=s.units[n];
  Object.assign(enemy,{x:x+dir*300,y:374,lane:0,hp:100000,maxHp:100000,cooldown:10000,
    decisionIn:1000,tactic:'crouch',pose:'crouch',poseAnimSeen:'crouch',stanceLockUntil:100,
    moving:false,readyAt:-100,fragLeft:0});
  setOrder(s,0,'hold');setOrder(s,1,'hold');refreshVision(s);return{s,squad,enemy};
}
test('veterans have a sustained-fire drill, not the commando ambush ability; collection identity unchanged',()=>{
  assert.equal(CARDS.veteran_squad.infantryAbility,'fire_discipline');
  assert.equal(CARDS.commandos.infantryAbility,'elite');
  assert.deepEqual([CARDS.veteran_squad.cost,CARDS.veteran_squad.members,CARDS.veteran_squad.hp],[4,6,260]);
});
test('a real squad swaps one magazine under two nearby active riflemen, spending no ammo on start',()=>{
  const {s,squad}=arena();s.time=10;const [u,a,b,...rest]=squad;
  a.ammo=b.ammo=25;a.lastCombatShotAt=b.lastCombatShotAt=9.8;
  rest.forEach(v=>v.lastCombatShotAt=-100);
  assert(tryVeteranReload(s,u,()=>true));assert(relayReloadActive(u,10));
  assert.equal(u.reloadingUntil-u.reloadingStartAt,2.5);assert.equal(u.ammo,12);assert.equal(u.ammoReserve,90);
  assert(!tryVeteranReload(s,rest[0],()=>true));
});
test('no remote, empty, incapacitated, busy, moving or unable-to-hit mate counts as covering fire',()=>{
  const patches=[{x:600},{lane:50},{ammo:2},{hp:0},{wounded:true},{surrendered:true},
    {moving:true},{motion:'bank'},{climbing:1},{rappelling:true},{parachuting:true},{stillFor:.2},
    {suppression:55},{tactic:'retreat'},{tending:true},{digging:true},{fragThrow:.5},
    {lastCombatShotAt:7},{reloadingUntil:12,tacticalReload:true},{crouchTravel:.5},
    {poseAnimFrom:'stand',poseAnimAt:9.5},{coverGoal:800},{firingGoal:800}];
  for(const patch of patches) {
    const {s,squad}=arena();s.time=10;const [u,a,b,...rest]=squad;
    a.lastCombatShotAt=b.lastCombatShotAt=9.8;rest.forEach(v=>v.lastCombatShotAt=-100);
    Object.assign(b,patch);assert(!tryVeteranReload(s,u,()=>true),JSON.stringify(patch));
  }
  const {s,squad}=arena();s.time=10;squad.forEach(v=>v.lastCombatShotAt=10);
  assert(!tryVeteranReload(s,squad[0],()=>false));
});
test('both sides complete all eight grounded reload cels while squadmates keep firing',()=>{
  for(const side of [0,1]) {
    const {s,squad}=arena(side);let selected,startAmmo,startReserve,startShots,startPosition;
    const seen=new Set();let completed=false,coveredShots=0;
    for(let i=0;i<360&&!completed;i++) {
      const before=squad.reduce((n,u)=>n+u.shots,0);tick(s,1/60);
      assert(squad.filter(u=>relayReloadActive(u,s.time)).length<=1);
      selected??=squad.find(u=>relayReloadActive(u,s.time));if(!selected)continue;
      if(startAmmo===undefined){startAmmo=selected.ammo;startReserve=selected.ammoReserve;
        startShots=selected.shots;startPosition=[selected.x,selected.lane];}
      if(relayReloadActive(selected,s.time)) {
        assert.deepEqual([selected.x,selected.lane],startPosition);assert.equal(selected.shots,startShots);
        assert.equal(selected.ammo,startAmmo);assert.equal(selected.ammoReserve,startReserve);
        const f=adultFrameChoice(selected,s.time);assert.equal(f.group,'lowReload16');seen.add(f.index);
        coveredShots+=squad.reduce((n,u)=>n+u.shots,0)-before;
      } else {
        assert(selected.ammo>=29);assert.equal(selected.ammoReserve,startReserve-(30-startAmmo));completed=true;
      }
    }
    assert(completed,JSON.stringify(squad.map(u=>({ammo:u.ammo,shots:u.shots,contact:u.contactUntil,coverGoal:u.coverGoal,firingGoal:u.firingGoal,post:u.stillFor,pose:u.pose,step:u.crouchTravel,last:u.lastCombatShotAt,relay:u.relayReload,withdraw:u.withdrawUntil}))));assert(coveredShots>=5);assert.deepEqual([...seen],[0,1,2,3,4,5,6,7]);
  }
});
test('close threats and forced rush never start a new drill, and retreat can escape an active one',()=>{
  for(const mode of ['close','rush','retreat']) {
    const {s,squad,enemy}=arena();s.time=10;squad.forEach(u=>u.lastCombatShotAt=10);
    if(mode==='close')enemy.x=1090;
    if(mode==='rush')setOrder(s,0,'rush');
    if(mode==='retreat') {
      const u=squad[0];assert(tryVeteranReload(s,u,()=>true));const start=u.x;
      assert(setSquadOrder(s,0,u.squad,'retreat').ok);
      for(let i=0;i<120;i++)tick(s,1/60);assert(u.x<start-5,JSON.stringify({x:u.x,start,pose:u.pose,order:u.squadOrder,tactic:u.tactic,step:u.crouchTravel}));continue;
    }
    for(let i=0;i<60;i++)tick(s,1/60);
    assert(mode==='close'?!squad[0].relayReload:!squad.some(u=>u.relayReload),mode);
  }
});
test('new veteran bullets lose the elite opening multiplier, while commandos keep it',()=>{
  for(const [id,multiplier] of [['veteran_squad',1],['commandos',1.5]]) {
    const {s,squad}=arena(0,id);squad.forEach(u=>Object.assign(u,{ammo:30,ambushFor:4}));
    let p;for(let i=0;i<90&&!p;i++){tick(s,1/60);p=s.projectiles.find(p=>p.sourceUid===squad[0].uid);}
    assert(p);assert(Math.abs(p.damage-CARDS[id].damage/CARDS[id].members*multiplier)<1e-9);
  }
});

test('live 90-second trial measures sustained fire and conserves every cartridge',()=>{
  const results=[];
  for(const relay of [false,true]) {
    const ability=CARDS.veteran_squad.infantryAbility;
    try {
      if(!relay)CARDS.veteran_squad.infantryAbility=undefined;
      const {s,squad}=arena();let starts=0,longestGap=0,gap=0,lastShots=0;
      const active=new Set();
      for(let i=0;i<5400;i++) {
        tick(s,1/60);const shots=squad.reduce((n,u)=>n+u.shots,0);
        gap=shots===lastShots?gap+1/60:0;lastShots=shots;longestGap=Math.max(longestGap,gap);
        for(const u of squad) {
          assert.equal(u.ammo+u.ammoReserve+u.shots,102);
          if(relayReloadActive(u,s.time)&&!active.has(u.uid)){starts++;active.add(u.uid);}
          if(!relayReloadActive(u,s.time))active.delete(u.uid);
          const f=adultFrameChoice(u,s.time);assert.notEqual(f.group,'signals4');
          if(f.group==='actions20')assert(![8,9,10,11].includes(f.index));
        }
      }
      results.push({relay,starts,shots:lastShots,longestGap});
    }finally{CARDS.veteran_squad.infantryAbility=ability;}
  }
  assert(results[1].starts>=6);assert(results[1].longestGap<results[0].longestGap);
  console.log('v151 live trial',JSON.stringify(results));
});
