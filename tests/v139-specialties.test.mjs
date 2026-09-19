import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame,startGame,spawnUnit,tick,setOrder,refreshVision,visibleToSide,playCard,explode,CARDS } from '../game/engine.ts';
import { ambushConcealed,landingGuide,pathfinderReady } from '../game/infantry-specialties.ts';
import { adultFrameChoice } from '../game/adult-animation.ts';
import { setSquadOrder } from '../game/squad-orders.ts';

function arena() {
  const s=createGame(139);startGame(s);s.aiIn=1e9;s.units=[];s.scenery=[];s.walls=[];
  s.night=false;s.weather.disabled=true;s.terrain.fill(374);s.original.fill(374);return s;
}
function one(s,side,id,x,extra={}) {
  const n=s.units.length;spawnUnit(s,side,id,x);const u=s.units[n];s.units.splice(n+1);
  Object.assign(u,{x,y:374,lane:0,pace:1,pose:'idle',poseAnimSeen:'stand',motion:'ground',
    hp:1000,maxHp:1000,shots:0,decisionIn:1000,tactic:'advance',cooldown:1000,stillFor:3,
    moving:false,personalMorale:90,suppression:0, ...extra});return u;
}
function ambusher(s,side=0) {
  return one(s,side,'ambush_squad',1000,{pose:'prone',poseAnimSeen:'prone',
    stanceLockUntil:100,camouflageFor:3,ambushFor:3});
}
const step=(s,seconds)=>{for(let i=0;i<seconds*60;i++)tick(s,1/60);};
function drop(s,id,x,side=0) {
  const token={id,uid:++s.uid};s.players[side].hand.push(token);s.players[side].energy=10;
  const n=s.units.length;assert.equal(playCard(s,side,token.uid,x).ok,true);return s.units.slice(n);
}

test('prepared low-profile ambushers hide only from enemy observation, never their own side',()=>{
  const s=arena(),u=ambusher(s),e=one(s,1,'infantry',1350);
  refreshVision(s);assert(ambushConcealed(u,s.time));assert(visibleToSide(s,0,u));assert(!visibleToSide(s,1,u));
  e.x=1170;refreshVision(s);assert(visibleToSide(s,1,u));assert.equal(u.camouflageRevealedUntil,8);
  e.x=1350;
  for(let t=0;t<8;t+=.2){s.time=t;refreshVision(s);assert(visibleToSide(s,1,u),'no contact flicker');}
});

test('scouts, a ready precision observer, flares and recon expose ambushes through real sight only',()=>{
  for(const mode of ['scout','precision','flare','recon','smoke']) {
    const s=arena(),u=ambusher(s);
    one(s,1,mode==='scout'||mode==='smoke'?'scouts':mode==='precision'?'sniper_team':'infantry',1450,
      mode==='precision'?{member:1}:{});
    if(mode==='flare')s.flares.push({x:u.x,y:u.y,life:10,radius:160});
    if(mode==='recon')s.players[1].recon=10;
    if(mode==='smoke')s.smokes.push({x:1250,life:10,side:0});
    refreshVision(s);assert.equal(visibleToSide(s,1,u),mode!=='smoke',mode);
  }
});

test('camouflage preparation needs three stationary low seconds and resets on motion or injury',()=>{
  const s=arena(),u=ambusher(s);u.camouflageFor=0;setOrder(s,0,'hold');
  step(s,2.8);assert(!ambushConcealed(u,s.time));step(s,.3);assert(ambushConcealed(u,s.time));
  u.moving=true;assert(!ambushConcealed(u,s.time));tick(s,1/60);assert.equal(u.camouflageFor,0);
  u.moving=false;u.camouflageFor=3;u.stillFor=3;
  explode(s,u.x,u.y,40,8,1);assert(!ambushConcealed(u,s.time));assert(u.camouflageRevealedUntil>s.time);
  for(let i=0;i<120;i++){tick(s,1/60);const f=adultFrameChoice(u,s.time);assert.notEqual(f.group,'signals4');
    if(f.group==='actions20')assert(![8,9,10,11].includes(f.index));}
});

test('ambushers let a distant patrol approach, then fire with bonus and become visible',()=>{
  const s=arena(),u=ambusher(s),e=one(s,1,'infantry',1380);u.cooldown=0;
  setOrder(s,0,'hold');setOrder(s,1,'hold');refreshVision(s);step(s,.7);
  assert.equal(u.shots,0);assert.equal(u.x,1000);e.x=1280;refreshVision(s);
  let shot;
  for(let i=0;i<60&&!shot;i++){tick(s,1/60);shot=s.projectiles.find(p=>p.sourceUid===u.uid);}
  assert(shot);assert.equal(shot.damage,18);assert(u.camouflageRevealedUntil>s.time);
  refreshVision(s);assert(visibleToSide(s,1,u));
});

test('explicit attack overrides ambush hold, while rangers retain mobile scout/grenade identity',()=>{
  const s=arena(),u=ambusher(s);one(s,1,'infantry',1380);u.cooldown=0;
  setOrder(s,1,'hold');u.squadOrder='attack';u.squadOrderUntil=100;refreshVision(s);
  step(s,.4);assert(u.shots>0);
  assert.equal(CARDS.rangers.sight,720);assert.equal(CARDS.rangers.frags,2);
  const ranger=one(s,0,'rangers',900,{pose:'prone',camouflageFor:100});assert(!ambushConcealed(ranger,s.time));
});

test('pathfinders land into watch, set up a guide after two seconds, and can be ordered away',()=>{
  const s=arena(),pair=drop(s,'pathfinders',1300);
  step(s,2);assert(pair.every(u=>u.parachuting));assert(!landingGuide(s,0,1300));
  step(s,1.1);assert(pair.every(u=>!u.parachuting&&u.squadOrder==='watch'));
  assert(!landingGuide(s,0,1300));const positions=pair.map(u=>u.x);step(s,2.5);
  assert(landingGuide(s,0,1300));assert.deepEqual(pair.map(u=>u.x),positions);
  setSquadOrder(s,0,pair[0].squad,'attack');step(s,.5);
  assert(pair.some((u,i)=>u.x!==positions[i]));assert(!landingGuide(s,0,1300));
});

test('only ready nearby friendly pathfinders guide; injury, movement, suppression and jamming cancel it',()=>{
  const patches=[{hp:0},{wounded:true},{surrendered:true},{moving:true},{motion:'land'},
    {parachuting:true},{rappelling:true},{stillFor:1.9},{suppression:45},{tactic:'retreat'},
    {squadOrder:'retreat'},{tending:true},{side:1},{x:1221}];
  for(const patch of patches){const s=arena(),u=one(s,0,'pathfinders',1000);
    assert.equal(landingGuide(s,0,1000),u);Object.assign(u,patch);assert(!landingGuide(s,0,1000),JSON.stringify(patch));}
  for(const mode of ['jam','blackout']){const s=arena();one(s,0,'pathfinders',1000);
    if(mode==='jam')s.players[0].jam=10;else s.players[0].blackoutUntil=10;
    assert(!landingGuide(s,0,1000));}
  const s=arena();one(s,0,'recon_jump',1000);assert(!landingGuide(s,0,1000));
});

test('guidance changes real descent and landing recovery, and is lost mid-descent if the guide dies',()=>{
  for(const mode of ['guided','plain','lost']) {
    const s=arena(),guide=mode!=='plain'?one(s,0,'pathfinders',1250,{squadOrder:'watch'}):null;
    const [u]=drop(s,'recon_jump',1300);u.personalMorale=50;u.suppression=40;
    step(s,1);
    assert(Math.abs(u.y-(34+135*(mode==='plain'?1:1.35)))<.01);
    if(mode==='lost')guide.hp=0;
    let landedAt;
    for(let i=0;i<160;i++){tick(s,1/60);if(!u.parachuting){landedAt=s.time;break;}}
    assert(landedAt);assert.equal(u.suppression,mode==='guided'?10:40);
    assert.equal(u.personalMorale,mode==='guided'?62:50);
    if(mode==='guided')assert(landedAt<1.9);else assert(landedAt>2.1);
  }
});

test('AI uses a ready safe friendly guide, but a jammed guide cannot attract its drop',()=>{
  for(const mode of ['ready','jammed','hidden-foe']) {
    const s=arena();s.aiIn=0;
    one(s,0,'infantry',1500);
    one(s,1,'infantry',1980);one(s,1,'rangers',2020);
    const guide=one(s,1,'pathfinders',1770,{squadOrder:'watch'});
    if(mode==='jammed')s.players[1].jam=10;
    if(mode==='hidden-foe')one(s,0,'tank',100);
    s.players[1].deck=[];s.players[1].hand=[{id:'recon_jump',uid:++s.uid}];s.players[1].energy=10;
    refreshVision(s);tick(s,.05);
    const jump=s.units.filter(u=>u.id==='recon_jump');assert.equal(jump.length,2,mode);
    const center=jump.reduce((sum,u)=>sum+u.x,0)/jump.length;
    if(mode==='jammed')assert(Math.abs(center-guide.x)>220);
    else assert(Math.abs(center-guide.x)<60);
  }
});

test('AI inserts pathfinders behind the nearest known hostile front instead of between enemy groups',()=>{
  const s=arena();s.aiIn=0;
  one(s,0,'infantry',1500);one(s,0,'infantry',1900);
  one(s,1,'infantry',2300);one(s,1,'rangers',2400);one(s,1,'scouts',2200);
  s.players[1].deck=[];s.players[1].hand=[{id:'pathfinders',uid:++s.uid}];s.players[1].energy=10;
  refreshVision(s);tick(s,.05);
  const pair=s.units.filter(u=>u.id==='pathfinders');assert.equal(pair.length,2);
  assert(pair.every(u=>u.x>2100));
});
