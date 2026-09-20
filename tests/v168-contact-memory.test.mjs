import assert from 'node:assert/strict';
import test from 'node:test';
import {tick,spawnUnit,refreshVision,visibleToSide,contactSafeX,playCard,CARDS} from '../game/engine.ts';
import {CONTACT_CLEAR_CONFIRM_S} from '../game/world.ts';
import {contactSector} from './fixtures/contact-sector.mjs';
const step=(s,seconds)=>{for(let i=0;i<Math.round(seconds*60);i++)tick(s,1/60);};

test('losing a previously seen prone enemy behind a fresh crater does not erase the infantry or armor stop line',()=>{
  for(const side of [0,1])for(const id of ['infantry','tank']){
    const {s,u,e,dir,hideInCrater}=contactSector(side,id),gap=id==='infantry'?105:150;
    assert(visibleToSide(s,side,e));const report=structuredClone(s.groundContacts[side][0]);
    hideInCrater();assert(!visibleToSide(s,side,e));
    assert.equal(contactSafeX(s,u,u.x+dir*300),report.x-dir*gap);
    for(let i=0;i<360;i++){tick(s,1/60);assert((report.x-u.x)*dir>=gap-1e-7,`${side}/${id}: crossed known contact`);}
    assert((u.x-(side?2400:1000))*dir>0,'reinforcements can approach their own side of the line');
    assert.equal(contactSafeX(s,u,u.x-dir*40),u.x-dir*40,'withdrawal is never blocked');
  }
});

test('hidden motion, death and removal cannot update the last reported position or prematurely clear its line',()=>{
  for(const side of [0,1]){
    const base=contactSector(side);base.hideInCrater();const known=structuredClone(base.s.groundContacts[side]);
    for(const change of ['move','dead','removed','surrendered','wounded']){
      const s=structuredClone(base.s),u=s.units[0],e=s.units[1];
      if(change==='move')e.x+=(side?-1:1)*1000;
      if(change==='dead')e.hp=0;
      if(change==='removed')s.units.splice(1);
      if(change==='surrendered')e.surrendered=true;
      if(change==='wounded')e.wounded=true;
      s.time+=30;refreshVision(s);
      assert.deepEqual(s.groundContacts[side],known,change);
      assert.equal(contactSafeX(s,u,u.x+base.dir*500),known[0].x-base.dir*105,change);
    }
  }
});

test('an actually observed defeat releases the line, while an empty sector needs a sustained ground-level check',()=>{
  for(const outcome of ['dead','surrendered','wounded','gone']){
    const {s,u,e,hideInCrater}=contactSector();hideInCrater();
    if(outcome==='dead')e.hp=0;if(outcome==='surrendered')e.surrendered=true;if(outcome==='wounded')e.wounded=true;
    if(outcome==='gone')s.units.splice(1);
    s.players[0].hand=[{id:'flare',uid:++s.uid}];s.players[0].energy=10;
    assert(playCard(s,0,s.players[0].hand[0].uid,e.x).ok);refreshVision(s);
    if(outcome==='gone'){
      assert.equal(s.groundContacts[0].length,1);assert.equal(s.groundContacts[0][0].clearSince,s.time);
      s.time+=CONTACT_CLEAR_CONFIRM_S-.01;refreshVision(s);assert.equal(s.groundContacts[0].length,1);
      s.time+=.02;refreshVision(s);
    }
    assert.equal(s.groundContacts[0].length,0,outcome);
    assert.equal(contactSafeX(s,u,u.x+300),u.x+300,outcome);
  }
});

test('interrupted sector inspection restarts confirmation and reacquisition replaces only the observed snapshot',()=>{
  const {s,e,hideInCrater}=contactSector();hideInCrater();const enemyX=e.x;s.units.splice(1);
  s.flares.push({x:enemyX,y:350,life:10,radius:260,seed:1});refreshVision(s);
  s.time+=1;refreshVision(s);assert.equal(s.groundContacts[0][0].clearSince,0);
  s.flares=[];refreshVision(s);assert.equal(s.groundContacts[0][0].clearSince,undefined);
  s.flares.push({x:enemyX,y:350,life:10,radius:260,seed:1});s.time+=1;refreshVision(s);
  assert.equal(s.groundContacts[0][0].clearSince,2);
  s.units.push(e);e.x+=18;s.time+=.1;refreshVision(s);
  assert(visibleToSide(s,0,e));assert.equal(s.groundContacts[0][0].x,e.x);
  assert.equal(s.groundContacts[0][0].seenAt,s.time);assert.equal(s.groundContacts[0][0].clearSince,undefined);
});

test('unknown hidden units grant no contact knowledge; airborne insertions and aircraft do not create ground barriers',()=>{
  const {s,u,e}=contactSector();s.groundContacts=[[],[]];e.x=3000;refreshVision(s);
  assert(!visibleToSide(s,0,e));assert.deepEqual(s.groundContacts[0],[]);
  assert.equal(contactSafeX(s,u,1500),1500);
  e.x=1150;e.parachuting=true;refreshVision(s);assert(!s.groundContacts[0].some(c=>c.uid===e.uid));
  e.parachuting=false;e.rappelling=true;refreshVision(s);assert(!s.groundContacts[0].some(c=>c.uid===e.uid));
  spawnUnit(s,1,'helicopter',1100);refreshVision(s);assert.equal(s.groundContacts[0].length,0);
  e.rappelling=false;refreshVision(s);assert(s.groundContacts[0].some(c=>c.uid===e.uid));
  const aircraft=s.units.at(-1);assert.equal(contactSafeX(s,aircraft,aircraft.x-300),aircraft.x-300);
  e.side=0;refreshVision(s);assert(!s.groundContacts[0].some(c=>c.uid===e.uid),'an observed friendly is no longer an enemy report');
});

test('remembered safety lines also apply to support vehicles and gun crews without mutating the report',()=>{
  const {s,u,hideInCrater}=contactSector();hideInCrater();const before=JSON.stringify(s.groundContacts);
  for(const id of ['mortar_carrier','artillery','anti_tank_gun','medic_team','recovery_vehicle']){
    u.id=id;const gap=CARDS[id].members?105:150;
    assert.equal(contactSafeX(s,u,1400),1160-gap);assert.equal(JSON.stringify(s.groundContacts),before);
  }
});

test('a towed gun stopped at the uncleared line does not keep marching its animation in place',()=>{
  for(const id of ['artillery','anti_tank_gun']){
    const {s,u,hideInCrater}=contactSector(0,id);u.emplaced=false;hideInCrater();
    spawnUnit(s,0,'infantry',1700,{member:0});const escort=s.units.at(-1);
    Object.assign(escort,{x:1700,y:374,pace:0,cooldown:1e9,fragLeft:0});refreshVision(s);
    step(s,2);assert.equal(u.x,1010,id);const phase=u.walk;
    step(s,1);assert.equal(u.x,1010,id);assert.equal(u.moving,false,id);assert.equal(u.walk,phase,id);
  }
});

test('AI pays for a ready flare at the last observed point even with a single isolated squad',()=>{
  for(const hiddenChange of ['same','moved','dead']){
    const {s,e,hideInCrater}=contactSector(1);hideInCrater();const seenX=e.x;
    if(hiddenChange==='moved')e.x=1000;if(hiddenChange==='dead')e.hp=0;
    s.players[1].hand=[{id:'flare',uid:++s.uid}];s.players[1].deck=[];s.players[1].energy=10;s.aiIn=0;
    tick(s,.05);assert.equal(s.flares.length,1,hiddenChange);
    const flare=s.flares[0],launchX=flare.x-Math.sin(flare.life*2.2+flare.seed)*9*.05;
    assert(Math.abs(launchX-seenX)<1e-7,hiddenChange+' must aim at the snapshot before ordinary flare drift');
    assert.equal(s.players[1].energy,10-CARDS.flare.cost);assert.equal(s.players[1].hand.length,0);
    assert(s.players[1].discard.some(h=>h.id==='flare'));
  }
});

test('AI cannot invent a flare, spend unready cards or use never-observed enemies as illumination coordinates',()=>{
  for(const mode of ['poor','unready','unknown']){
    const {s,e,hideInCrater}=contactSector(1);hideInCrater();
    if(mode==='unknown'){s.groundContacts=[[],[]];e.x=500;refreshVision(s);}
    s.players[1].hand=[{id:'flare',uid:++s.uid,readyAt:mode==='unready'?30:0}];s.players[1].deck=[];
    s.players[1].energy=mode==='poor'?0:10;s.aiIn=0;tick(s,.05);
    assert.equal(s.flares.length,0,mode);assert.equal(s.players[1].hand.length,1,mode);
  }
});

test('the AI can reacquire and clear the reported sector instead of remaining permanently stopped',()=>{
  const {s,u,e,hideInCrater}=contactSector(1);hideInCrater();const x=u.x;
  s.units.splice(1);s.players[1].hand=[{id:'flare',uid:++s.uid}];s.players[1].deck=[];s.players[1].energy=10;s.aiIn=0;
  tick(s,.05);assert.equal(s.flares.length,1);s.aiIn=1e9;
  // Keep this lone test squad advancing after its actual paid recon action.
  s.players[1].order='rush';u.squadOrder=undefined;
  step(s,5);assert.equal(s.groundContacts[1].length,0);assert(u.x<x-80,'confirmed empty ground unlocks forward travel');
});
