import assert from 'node:assert/strict';
import test from 'node:test';
import {createGame,startGame,spawnUnit,tick,setOrder,refreshVision,visibleToSide,playCard,CARDS,W} from '../game/engine.ts';
import {finishInfantryInsertion,landingGuide} from '../game/infantry-specialties.ts';
import {setSquadOrder} from '../game/squad-orders.ts';
import {adultFrameChoice} from '../game/adult-animation.ts';

function arena(){const s=createGame(155);startGame(s);s.aiIn=1e9;s.units=[];s.scenery=[];s.walls=[];
  s.night=false;s.weather.disabled=true;s.terrain.fill(374);s.original.fill(374);return s;}
function one(s,side,id,x,extra={}){const n=s.units.length;spawnUnit(s,side,id,x,{member:0});
  const u=s.units[n];s.units.splice(n+1);Object.assign(u,{x,y:374,lane:0,pace:1,pose:'idle',poseAnimSeen:'stand',
    motion:'ground',hp:1000,maxHp:1000,shots:0,decisionIn:1000,tactic:'advance',cooldown:1000,
    stillFor:3,moving:false,personalMorale:95,suppression:0,fragLeft:0,stanceLockUntil:100,...extra});return u;}
const step=(s,n)=>{for(let i=0;i<n;i++)tick(s,1/60);};
function drop(s,side,id,x){const token={id,uid:++s.uid};s.players[side].hand=[token];s.players[side].energy=10;
  const n=s.units.length;assert(playCard(s,side,token.uid,x).ok);return s.units.slice(n);}

test('only rapid cards gain a landing sprint; parachute exposure never consumes its eight seconds',()=>{
  for(const side of [0,1])for(const id of ['rapid_insertion','recon_jump','pathfinders','airborne_at']){
    const s=arena(),units=drop(s,side,id,1800);setOrder(s,side,'hold');
    assert(units.every(u=>!(u.rapidUntil>0)));
    let landed;
    for(let i=0;i<240;i++){tick(s,1/60);if(units.every(u=>!u.parachuting)){landed=s.time;break;}}
    assert(landed);for(const u of units){
      assert.equal(u.rapidUntil,id==='rapid_insertion'?landed+8:0,`${id}/${side}`);
      assert(!u.rappelling);
    }
    step(s,30);for(const u of units){const f=adultFrameChoice(u,s.time);
      assert(f.group!=='actions20'||![8,9,10,11].includes(f.index));}
  }
});

test('rope insertion preserves the actual cargo role and respects an existing player order',()=>{
  for(const side of [0,1])for(const id of ['paratroopers','infantry','recon_jump']){
    const s=arena(),u=one(s,side,id,1700,{rappelling:true,rappellingStartAt:0,y:373,
      squadOrder:'attack',squadOrderUntil:100,rapidUntil:0});setOrder(s,side,'hold');tick(s,1/60);
    assert(!u.rappelling);assert.equal(u.rapidUntil,id==='paratroopers'?s.time+8:0);
    assert.equal(u.squadOrder,'attack');
  }
});

test('recon jump watches its landing ground, provides sight and moves only after a new order',()=>{
  for(const side of [0,1]){
    const s=arena(),pair=drop(s,side,'recon_jump',1800);step(s,190);
    assert(pair.every(u=>u.squadOrder==='watch'&&u.rapidUntil===0));const xs=pair.map(u=>u.x);
    step(s,180);assert.deepEqual(pair.map(u=>u.x),xs);assert(!landingGuide(s,side,1800));
    assert.equal(CARDS.recon_jump.sight,850);assert.equal(CARDS.recon_jump.range,700);
    const enemy=one(s,1-side,'infantry',1800+(side?-1:1)*800);refreshVision(s);
    assert(visibleToSide(s,side,enemy));enemy.hp=0;
    setSquadOrder(s,side,pair[0].squad,'attack');step(s,45);
    assert(pair.some((u,i)=>(u.x-xs[i])*(side?-1:1)>0));
  }
});

test('rapid sprint has real movement value but ends on the first shot and never accelerates retreat',()=>{
  for(const side of [0,1]){
    const a=arena(),u=one(a,side,'rapid_insertion',1700),b=structuredClone(a),v=b.units[0];
    finishInfantryInsertion(u,0);v.rapidUntil=0;setOrder(a,side,'advance');setOrder(b,side,'advance');
    step(a,30);step(b,30);assert(Math.abs((u.x-1700)/(v.x-1700)-1.8)<1e-6);
    const c=arena(),r=one(c,side,'rapid_insertion',1700,{tactic:'retreat'}),d=structuredClone(c),q=d.units[0];
    finishInfantryInsertion(r,0);q.rapidUntil=0;setOrder(c,side,'retreat');setOrder(d,side,'retreat');
    step(c,30);step(d,30);assert(Math.abs(r.x-q.x)<1e-8);
    const fight=arena(),f=one(fight,side,'rapid_insertion',1700,{cooldown:0}),
      e=one(fight,1-side,'infantry',1700+(side?-1:1)*280);finishInfantryInsertion(f,0);
    setOrder(fight,0,'hold');setOrder(fight,1,'hold');refreshVision(fight);
    for(let i=0;i<120&&!f.shots;i++)tick(fight,1/60);
    assert(f.shots>0);assert.equal(f.rapidUntil,0);
  }
});

function aiScene(enemyX,card='rapid_insertion'){
  const s=arena();s.aiIn=0;
  one(s,0,'infantry',enemyX);one(s,1,'infantry',enemyX+260);one(s,1,'rangers',enemyX+300);
  s.players[1].deck=[];s.players[1].hand=[{id:card,uid:++s.uid}];s.players[1].energy=10;
  refreshVision(s);return s;
}
test('AI rapid reserves land on their own side of all observed contacts, including an emergency',()=>{
  for(const emergency of [false,true]){
    const front=emergency?W-645:1850,s=aiScene(front);
    one(s,0,'infantry',front-300);refreshVision(s);tick(s,.05);
    const units=s.units.filter(u=>u.side===1&&u.id==='rapid_insertion');assert.equal(units.length,3);
    assert(units.every(u=>u.x>front+100));assert.equal(s.players[1].discard.at(-1).id,'rapid_insertion');
  }
});

test('AI does not deploy a defensive reserve behind an enemy occupying the last legal landing band',()=>{
  const s=aiScene(W-510);tick(s,.05);
  assert(!s.units.some(u=>u.id==='rapid_insertion'));
  assert(s.players[1].hand.some(h=>h.id==='rapid_insertion'));assert(s.players[1].energy>=10);
});

test('an exposed emergency sector prefers rapid reserve, but chooses ground infantry if no friendly drop fits',()=>{
  for(const open of [true,false]){
    const s=arena();s.aiIn=0;one(s,0,'infantry',W-(open?645:510));one(s,1,'scouts',W-430);
    s.players[1].deck=[];s.players[1].hand=['rapid_insertion','infantry'].map(id=>({id,uid:++s.uid}));
    s.players[1].energy=10;refreshVision(s);tick(s,.05);
    assert.equal(s.players[1].discard.at(-1)?.id,open?'rapid_insertion':'infantry');
    assert.equal(s.players[1].hand.length,1);
  }
});

test('recon can establish new forward sight from its own line without knowing hidden enemies',()=>{
  const centers=[];
  for(const hidden of [false,true]){
    const s=arena();s.aiIn=0;one(s,1,'infantry',2700);one(s,1,'infantry',2780);
    if(hidden)one(s,0,'heavy_tank',100);
    s.players[1].deck=[];s.players[1].hand=[{id:'recon_jump',uid:++s.uid}];s.players[1].energy=10;
    refreshVision(s);tick(s,.05);const pair=s.units.filter(u=>u.id==='recon_jump');
    assert.equal(pair.length,2);const center=pair.reduce((n,u)=>n+u.x,0)/pair.length;
    assert(Math.abs(center-2400)<50);centers.push(center);
  }
  assert.equal(centers[0],centers[1]);
});

test('AI rejects obstacle relocation across the hostile front and ignores hidden extra contacts',()=>{
  const centers=[];
  for(const hidden of [false,true]){
    const s=aiScene(1900);if(hidden)one(s,0,'heavy_tank',100);
    // Legacy wall fixture exercises the same shared landing footprint used by houses/wrecks.
    s.walls=[{uid:++s.uid,x:2160,width:80,height:60,hp:100,maxHp:100}];
    refreshVision(s);tick(s,.05);const units=s.units.filter(u=>u.id==='rapid_insertion');
    assert.equal(units.length,3);const center=units.reduce((n,u)=>n+u.x,0)/units.length;
    assert(center>=2060);assert(Math.abs(center-2160)>=130);centers.push(center);
  }
  assert.equal(centers[0],centers[1]);
});

test('urgent anti-armor selection retains a verified friendly landing guide instead of losing its target',()=>{
  for(const hidden of [false,true]){
    const s=arena();s.aiIn=0;one(s,0,'tank',2350);
    one(s,1,'infantry',2700);one(s,1,'rangers',2800);
    const guide=one(s,1,'pathfinders',2660,{squadOrder:'watch'});
    if(hidden)one(s,0,'heavy_tank',100);
    s.players[1].deck=[];s.players[1].hand=[{id:'airborne_at',uid:++s.uid}];s.players[1].energy=10;
    refreshVision(s);tick(s,.05);
    const units=s.units.filter(u=>u.id==='airborne_at');assert.equal(units.length,4);
    const center=units.reduce((n,u)=>n+u.x,0)/units.length;
    assert(Math.abs(center-guide.x)<60,`lost selected landing: ${center}`);
  }
});
