import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame, startGame, spawnUnit, tick, setOrder, refreshVision, unitRange, W } from '../game/engine.ts';
import { weaponCard } from '../game/cards.ts';
import { magazine } from '../game/ballistics.ts';
import { sightRange, visibleToSide } from '../game/world.ts';
import { isPrecisionObserver, precisionObserverReady } from '../game/precision-team.ts';
import { unitSynergy } from '../game/synergy.ts';
import { adultFrameChoice } from '../game/adult-animation.ts';

function arena() {
  const s = createGame(138); startGame(s); s.aiIn = 1e9;
  s.units = []; s.scenery = []; s.walls = []; s.night = false;
  s.terrain.fill(374); s.original.fill(374); s.weather.disabled = true;
  return s;
}
function group(s, side, id, x) {
  const n = s.units.length; spawnUnit(s, side, id, x);
  const units = s.units.slice(n);
  for (const u of units) Object.assign(u, { x: x - (side ? -1 : 1) * u.member * 36, y: 374,
    lane: 0, pace: 1, pose: 'idle', poseAnimSeen: 'stand', stanceLockUntil: 0,
    moving: false, stillFor: 1, tactic: 'advance', decisionIn: 1000,
    cooldown: 0, shots: 0, hp: 1000, maxHp: 1000, readyAt: -100, personalMorale: 100 });
  return units;
}
function single(s, side, id, x) {
  const [u, ...others] = group(s, side, id, x);
  s.units = s.units.filter(v => !others.includes(v));
  u.cooldown = 1000; return u;
}
const advance = (s, t) => { for(let i=0;i<t*60;i++) tick(s,1/60); };

test('precision team has one five-round rifle and a genuinely unarmed observer', () => {
  assert.deepEqual(magazine('sniper_team',0), {mag:5,reserve:25,reload:3});
  assert.equal(magazine('sniper_team',1),null);
  assert.equal(weaponCard({id:'sniper_team',member:0}).damage,52);
  assert.equal(weaponCard({id:'sniper_team',member:1}).damage,0);
  for (const id of ['sniper','sniper_team']) {
    const s=arena(), [a,b]=group(s,0,id,1000);
    single(s,1,'infantry',1450);
    setOrder(s,0,'hold');setOrder(s,1,'hold'); refreshVision(s);
    advance(s,7);
    assert(a.shots>=2, `${id}: shooter fires`);
    assert.equal(b.shots>0,id==='sniper',`${id}: second member role`);
    if(id==='sniper_team') {assert.equal(b.ammo,-1);assert.equal(b.reloadingUntil??0,0);}
  }
});

test('range and vision require a settled, capable observer from the same pair', () => {
  const invalid = [{hp:0},{wounded:true},{surrendered:true},{moving:true},{stillFor:0.5},
    {suppression:55},{motion:'jump'},{parachuting:true},{rappelling:true},{climbing:1},
    {tactic:'retreat'},{squadOrder:'retreat'},{tending:true},{draggingUid:99},
    {withdrawStandby:true},{firstAidTargetUid:99},{x:800},{squad:999}];
  for(const patch of invalid) {
    const s=arena(),[a,b]=group(s,0,'sniper_team',1000);
    assert.equal(unitRange(s,a),880); assert.equal(unitRange(s,b),0);
    assert.equal(sightRange(b),920); Object.assign(b,patch);
    assert.equal(unitRange(s,a),650,JSON.stringify(patch));
    if(!('x' in patch)&&!('squad' in patch)) assert.equal(sightRange(b),440);
  }
});

test('observer enables a real 800px shot, but smoke and blindness still deny vision', () => {
  for(const mode of ['clear','smoke','blind','lost']) {
    const s=arena(),[a,b]=group(s,0,'sniper_team',1000), e=single(s,1,'infantry',1800);
    setOrder(s,0,'hold');setOrder(s,1,'hold');
    if(mode==='smoke')s.smokes.push({x:1400,life:10,side:1});
    if(mode==='blind')s.players[0].sensorBlindUntil=10;
    if(mode==='lost') b.hp=0;
    refreshVision(s); assert.equal(visibleToSide(s,0,e),mode==='clear',mode);
    // The new stand→prone drill owns the hands for 2.4s before the first shot.
    advance(s,4);
    assert.equal(a.shots>0,mode==='clear',mode);
  }
});

test('precision rifle chooses the weapon operator, not a nearer rifle escort', () => {
  for(const side of [0,1]) {
    const s=arena(),x=side?W-1000:1000,dir=side?-1:1;
    const [a]=group(s,side,'sniper_team',x);
    single(s,1-side,'infantry',x+dir*350);
    const mg=group(s,1-side,'machinegun',x+dir*500);
    for(const u of mg)u.cooldown=1000;
    setOrder(s,side,'hold');setOrder(s,1-side,'hold');refreshVision(s);
    const shots=[];
    for(let i=0;i<180;i++) {tick(s,1/60); shots.push(...s.projectiles.filter(p=>p.sourceUid===a.uid && !p.missed).map(p=>({...p})));}
    assert(shots.length>0); assert(shots.every(p=>p.targetUid===mg[0].uid),JSON.stringify({side,mg:mg.map(v=>[v.uid,v.member,v.x]),targets:shots.map(p=>p.targetUid)}));
  }
});

test('observer follows the rifle on both sides and cannot march through a contact', () => {
  for(const side of [0,1]) {
    const s=arena(), dir=side?-1:1, x=side?W-1500:1500;
    const [a,b]=group(s,side,'sniper_team',x); b.x=x-dir*200;
    a.cooldown=1000; const e=single(s,1-side,'infantry',x+dir*130);
    setOrder(s,1-side,'hold');refreshVision(s);
    const start=b.x;
    advance(s,9);
    assert((b.x-start)*dir>30,'observer closes the separation');
    assert(Math.abs(b.x-a.x)<120,'regains paired range');
    assert((e.x-b.x)*dir>=105,'contact line stays intact');
    assert.equal(b.y,374);assert.equal(b.shots,0);
  }
});

test('orphan observer holds instead of charging, and an explicit retreat still works', () => {
  const s=arena(),[a,b]=group(s,0,'sniper_team',1500); a.hp=0;
  const start=b.x;advance(s,3);
  assert.equal(b.x,start);assert.equal(b.shots,0);
  Object.assign(b,{squadOrder:'retreat',squadOrderX:start-120,squadOrderUntil:100});
  advance(s,4);
  assert(b.x<start-20,'does not ignore a player fallback');
});

test('only the observer provides artillery spotting; only the rifle provides overwatch', () => {
  for(const role of [0,1]) {
    const s=arena(), pair=group(s,0,'sniper_team',1000);
    pair[1-role].hp=0;
    const gun=single(s,0,'mortar',1100), foot=single(s,0,'infantry',1150);
    assert.equal(unitSynergy(s,gun,s.time).recon_spot,role===1);
    assert.equal(unitSynergy(s,foot,s.time).overwatch,role===0);
  }
});

test('observer changing contact state never selects rope/command art or bypasses stance locks', () => {
  const s=arena(),[a,b]=group(s,0,'sniper_team',1000);a.cooldown=1000;
  const stance = p => p==='prone'?'prone':['crouch','hunker'].includes(p)?'crouch':'stand';
  let last=stance(b.pose),lastChange=-100;
  for(let i=0;i<1440;i++) {
    if(i%60===0) {a.x=1000+(i%120?40:0);setOrder(s,0,i%120?'advance':'hold');}
    tick(s,1/60); const current=stance(b.pose);
    if(current!==last) {assert(s.time-lastChange>=10-1e-8);lastChange=s.time;last=current;}
    const f=adultFrameChoice(b,s.time);
    assert.notEqual(f.group,'signals4');
    if(f.group==='actions20') assert(![8,9,10,11].includes(f.index),JSON.stringify(f));
    assert.equal(b.y,374);
  }
});

test('rifle reloads after five shots; actual damage gains local designation, not an extra gun', () => {
  for(const withObserver of [false,true]) {
    const s=arena(),[a,b]=group(s,0,'sniper_team',1000);
    if(!withObserver)b.hp=0;
    // Damage test begins with an already-settled spotter. A spotter still
    // lowering his body correctly cannot grant an observation bonus yet.
    Object.assign(b,{pose:'prone',poseAnimSeen:'prone',stanceLockUntil:100});
    const e=single(s,1,'infantry',1450);
    setOrder(s,0,'hold');setOrder(s,1,'hold');refreshVision(s);
    const rounds=new Map(); let dry=false, reload=false;
    for(let i=0;i<1200;i++) {
      tick(s,1/60);
      if(a.ammo===0) {dry=true;assert(a.reloadingUntil>s.time);}
      if(dry&&a.ammo>0)reload=true;
      for(const p of s.projectiles) if(p.sourceUid===a.uid&&!p.missed) rounds.set(p.uid,p.damage);
    }
    assert(rounds.size>=6);assert(dry);assert(reload);assert(a.ammoReserve<25);
    assert.equal(rounds.values().next().value,withObserver?65:52);
    assert.equal(b.shots,0);
  }
});
