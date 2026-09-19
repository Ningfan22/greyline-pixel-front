import assert from 'node:assert/strict';
import test from 'node:test';
import {createGame,startGame,spawnUnit,playCard,tick,refreshVision,setOrder,CARDS,W} from '../game/engine.ts';
import {copyLimit,validDeck,DECK} from '../game/cards.ts';
import {MAP_IDS,createMapLayout} from '../game/maps.ts';
import {gliderLanding,clearGliderLanding,airborneTarget,gliderArtIndex} from '../game/glider.ts';
import {setSquadOrder,ordersForUnit} from '../game/squad-orders.ts';
import {collectionProgress,loadCollection,openPack,deckLimit} from '../game/collection.ts';
import {drawWreckFire,drawWreckSmoke} from '../game/ambience.ts';
import {isEngineVehicle} from '../game/engine-sound.ts';
const step=(s,t)=>{for(let i=0;i<Math.ceil(t*60);i++)tick(s,1/60);};
function arena(){const s=createGame(141);startGame(s);s.aiIn=1e9;s.units=[];s.scenery=[];s.walls=[];
  s.terrain.fill(374);s.original.fill(374);s.night=false;s.weather.disabled=true;return s;}
function call(s,side=0,x=1600,id='glider_assault'){
  const p=s.players[side],card={id,uid:++s.uid};p.hand=[card];p.deck=[];p.energy=10;
  const result=playCard(s,side,card.uid,x);return {result,u:s.units.at(-1),card};
}
test('transport is not a 117th collectible, cannot enter decks or packs, and preserves glider ownership',()=>{
  assert.equal(Object.values(CARDS).filter(c=>!c.internal).length,116);
  assert.equal(copyLimit('glider_transport'),0);assert(!validDeck(['glider_transport',...DECK.slice(1)]));
  let state=loadCollection();state.gold=100000;
  let seed=141;const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
  for(let i=0;i<100;i++){const result=openPack(state,rng);assert(result.drawn.every(c=>c.id!=='glider_transport'));state=result.state;}
  assert.equal(collectionProgress(state).total,116);assert.equal(deckLimit(state,'glider_transport'),0);
  const s=arena(),{result}=call(s,0,1600,'glider_transport');assert(!result.ok);assert.equal(s.players[0].energy,10);assert.equal(s.units.length,0);
});
test('both sides fly, roll, wait for the door and disembark sequentially; empty hull remains without a blast',()=>{
  for(const side of [0,1]){
    const s=arena(),{u,result,card}=call(s,side,side?W-1600:1600);assert(result.ok);assert(u.glider);
    assert.equal(s.units.length,1);assert(!isEngineVehicle(u));assert.equal(ordersForUnit(u.id).length,0);
    assert(!setSquadOrder(s,side,u.squad,'watch').ok);
    let previous=u.x,lastCount=0;const stages=new Set(),arrivals=[];let rollAt,unloadAt;
    for(let i=0;i<700;i++){
      tick(s,1/60);stages.add(u.glider.phase);
      assert((u.x-previous)*(side?-1:1)>=-.0001);previous=u.x;
      if(u.glider.phase==='roll')rollAt??=s.time;
      if(u.glider.phase==='unload')unloadAt??=s.time;
      const soldiers=s.units.filter(v=>v.id==='glider_assault');
      if(soldiers.length!==lastCount){assert.equal(soldiers.length,lastCount+1);arrivals.push(s.time);lastCount=soldiers.length;}
      assert.equal(u.shots,0);assert(soldiers.every(v=>!v.parachuting&&!v.rappelling));
      if(soldiers.length===4)break;
    }
    const people=s.units.filter(v=>v.id==='glider_assault');
    assert.deepEqual([...stages],['approach','roll','unload']);assert.equal(people.length,4);
    assert.equal(new Set(people.map(v=>v.squad)).size,1);assert.deepEqual(people.map(v=>v.member),[0,1,2,3]);
    assert(unloadAt-rollAt>=1.19);assert(arrivals[0]-unloadAt>=1.04);
    for(let i=1;i<arrivals.length;i++)assert(arrivals[i]-arrivals[i-1]>=.449);
    assert(s.wrecks.some(w=>w.cardId==='glider_transport'&&w.abandoned&&!w.falling));
    assert.equal(s.blasts.length,0);assert.equal(s.players[1-side].kills,0);
    assert(s.players[side].discard.includes(card));assert.equal(s.players[side].deck.length,0);
    // Unpowered wood/metal hull has no invented fuel fire or engine smoke.
    const ctx=new Proxy({}, {get(){throw new Error('glider emitted generic wreck flame/smoke');}});
    drawWreckFire(ctx,s,0,W);drawWreckSmoke(ctx,s,0,W);
  }
});
test('clear runway checks terrain, obstacles and hulls; invalid calls keep card and energy',()=>{
  const s=arena();assert.equal(gliderLanding(s,1600,0),1600);
  s.walls=[{x:1600,width:1000,height:60,hp:100,maxHp:100}];
  assert.equal(gliderLanding(s,1600,0),null);const {result,card}=call(s);assert(!result.ok);
  assert.equal(s.players[0].energy,10);assert(s.players[0].hand.includes(card));assert.equal(s.units.length,0);
  s.walls=[];s.terrain[1600]=500;assert(!clearGliderLanding(s,1600,0));s.terrain.fill(374);
  s.wrecks=[{cardId:'tank',x:1600,y:374,angle:0,side:0}];assert(!clearGliderLanding(s,1600,0));
});
test('interception destroys occupied hull; landed hull is no longer an airborne target',()=>{
  const s=arena(),{u}=call(s,0,2600);
  spawnUnit(s,1,'sam_vehicle',1300);setOrder(s,1,'hold');
  s.units.at(-1).cooldown=0;refreshVision(s);
  let damage=false;for(let i=0;i<700&&u.hp>0;i++){tick(s,1/60);if(u.hp<u.maxHp)damage=true;}
  assert(damage,'real AA must damage it');assert.equal(u.hp,0);assert(!s.units.some(v=>v.id==='glider_assault'));
  step(s,3);assert(s.wrecks.some(w=>w.cardId==='glider_transport'&&!w.falling));
  const t=arena(),{u:v}=call(t);assert(airborneTarget(v));
  while(v.glider.phase==='approach')tick(t,1/60);assert(!airborneTarget(v));
});
test('healthy unloading cannot choose the unintentionally damaged opening cels',()=>{
  const s=arena(),{u}=call(s);u.glider.phase='unload';u.glider.phaseAt=0;
  for(let time=0;time<5;time+=.05)assert.equal(gliderArtIndex(u,time),3);
  u.hp=20;assert.equal(gliderArtIndex(u,5),5);
});
test('late runway obstruction causes collision, never teleport or cargo appearing in a wall',()=>{
  const s=arena(),{u}=call(s);s.walls=[{x:1450,width:20,height:300,hp:100,maxHp:100}];
  for(let i=0;i<600&&u.hp>0;i++)tick(s,1/60);
  assert.equal(u.hp,0);assert(!s.units.some(v=>v.id==='glider_assault'));assert.equal(s.blasts.length,0);assert.equal(s.players[1].kills,0);
});
test('32 reproducible maps retain real landing opportunities rather than making this card unusable',()=>{
  for(const map of MAP_IDS)for(let seed=1;seed<=8;seed++){
    const s=createGame(seed,undefined,undefined,map,{mapSeed:seed});
    for(const side of [0,1]){
      const found=[];for(let x=800;x<W-650;x+=200){const p=gliderLanding(s,x,side);if(p!==null){assert(clearGliderLanding(s,p,side));found.push(p);}}
      assert(found.length>0,`${map} seed${seed} side${side} has no runway`);
    }
  }
});
test('random-map landing routes can actually deliver passengers from both HQs',()=>{
  for(const map of MAP_IDS)for(const side of [0,1]){
    let delivered=false;
    for(let x=800;x<W-650&&!delivered;x+=150){
      const s=createGame(141,undefined,undefined,map,{mapSeed:141});startGame(s);s.aiIn=1e9;s.weather.disabled=true;
      if(gliderLanding(s,x,side)===null)continue;
      const {u}=call(s,side,x);step(s,15);
      delivered=s.units.filter(v=>v.id==='glider_assault').length===4;
    }
    assert(delivered,`${map}/${side}: every physical approach crashed`);
  }
});
test('a landing field never removes the village building-style variety or destabilizes seeded maps',()=>{
  for(let seed=1;seed<=100;seed++){
    const m=createMapLayout('greyline',W,seed);
    assert.equal(new Set(m.scenerySites.filter(p=>p.kind==='house').map(p=>p.building)).size,3);
    assert.deepEqual(m,createMapLayout('greyline',W,seed));
  }
});
test('a landed carrier can be shot by ground troops and loses only passengers still aboard',()=>{
  const s=arena(),{u}=call(s);
  while(u.glider.dropped<1)tick(s,1/60);
  s.units.filter(v=>v.id==='glider_assault').forEach(v=>{v.x=400;v.cooldown=1000;});
  // Make the shot lethal and let the ordinary rifle targeting/projectile path resolve it.
  u.hp=.01;spawnUnit(s,1,'infantry',u.x+200);setOrder(s,0,'hold');setOrder(s,1,'hold');
  for(const foe of s.units.filter(v=>v.side===1)){foe.cooldown=0;foe.readyAt=-100;foe.stillFor=10;foe.ammo=100;}
  refreshVision(s);let aliveBefore;
  for(let i=0;i<240&&!u.destroyed;i++){aliveBefore=u.glider.dropped;tick(s,1/60);}
  assert(u.destroyed&&!s.wrecks.find(w=>w.id===u.uid)?.abandoned,JSON.stringify({hp:u.hp,phase:u.glider,foes:s.units.filter(v=>v.side===1).map(v=>({shots:v.shots,target:v.aimTargetUid,ready:v.readyAt,cooldown:v.cooldown,pose:v.pose})),p:s.projectiles}));
  assert(u.glider.dropped<4);step(s,2);
  assert.equal(s.units.filter(v=>v.id==='glider_assault').length,aliveBefore);
});
