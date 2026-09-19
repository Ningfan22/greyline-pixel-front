import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame, startGame, spawnUnit, tick, setOrder, refreshVision, explode, projectileIntercept, CARDS, W } from '../game/engine.ts';
import { weaponCard, weaponModel } from '../game/cards.ts';
import { ammunition } from '../game/ballistics.ts';
import { adultFrameChoice } from '../game/adult-animation.ts';
import { GRENADE_THROW_S, GRENADE_RELEASE_S } from '../game/infantry-action-timing.ts';

function arena() {
  const s = createGame(136);
  startGame(s);
  s.aiIn = 1e9;
  s.units = []; s.scenery = []; s.walls = [];
  s.terrain.fill(374); s.original.fill(374);
  return s;
}
function single(s, side, id, x, pose = 'idle') {
  const n = s.units.length;
  spawnUnit(s, side, id, x);
  const u = s.units[n]; s.units.splice(n + 1);
  Object.assign(u, { x, y: 374, lane: 0, pace: 1, pose, poseAnimSeen: pose === 'prone' ? 'prone' : 'stand',
    stanceLockUntil: 100, tactic: 'advance', decisionIn: 1000, cooldown: 100,
    hp: 1000, maxHp: 1000 });
  return u;
}
function grenadeScene(side = 0) {
  const s = arena(), dir = side ? -1 : 1;
  const u = single(s, side, 'assault_grenadiers', 1800);
  const e = single(s, 1-side, 'infantry', u.x + dir * 170);
  const e2 = single(s, 1-side, 'infantry', e.x + dir * 20);
  setOrder(s, 0, 'hold'); setOrder(s, 1, 'hold');
  refreshVision(s);
  return { s, u, e, e2, dir };
}
const advance = (s, t) => { for (let i=0; i<t*60; i++) tick(s, 1/60); };

test('a real hand throw winds up, releases once from the hand, and plants the feet on both sides', () => {
  for (const side of [0, 1]) {
    const { s, u, dir } = grenadeScene(side), ammo = u.fragLeft, x = u.x;
    tick(s, 1/60);
    assert.equal(u.fragThrow, GRENADE_THROW_S);
    assert.equal(s.projectiles.length, 0, 'no projectile during preparation');
    assert.equal(u.fragLeft, ammo, 'grenade is consumed at release');
    const released = new Set();
    for (let i=0; i<67; i++) {
      tick(s, 1/60);
      const elapsed = s.time - (u.fragThrowStartedAt ?? 1/60);
      const p = s.projectiles.find(p => p.sourceUid === u.uid && p.ammunition === 'grenade');
      if (elapsed < GRENADE_RELEASE_S - 1e-9) assert.equal(p, undefined);
      if (p) { released.add(p.uid); assert.equal(p.startX, x + dir*21); assert.equal(p.startY, 323); }
      assert.equal(u.x, x); assert.equal(u.shots, 0); assert.equal(u.fire, 0);
      assert.equal(u.pose, 'idle');
      if (u.fragThrow > 0) assert.equal(adultFrameChoice(u, s.time).group, 'grenade8');
    }
    assert.equal(released.size, 1); assert.equal(u.fragLeft, ammo-1);
    assert.equal(u.fragThrow, 0); assert.equal(u.fragAim, undefined);
  }
});

test('casualty and surrender during wind-up cancel the throw permanently', () => {
  for (const state of ['wounded', 'surrendered', 'dead']) {
    const {s,u} = grenadeScene(); const ammo = u.fragLeft;
    tick(s,1/60); assert(u.fragThrow>0);
    if(state==='dead') u.hp=0;
    else u[state]=true;
    if(state==='wounded') u.bleedOut=20;
    advance(s,0.8);
    assert.equal(s.projectiles.filter(p=>p.sourceUid===u.uid).length,0);
    assert.equal(u.fragThrow,0); assert.equal(u.fragAim,undefined);
    assert.equal(u.fragLeft,ammo);
  }
});

test('no throw into an ally, at a lone target, or during magazine replacement', () => {
  for (const mode of ['ally','single','reload']) {
    const {s,u,e2} = grenadeScene();
    if(mode==='ally') single(s,0,'infantry',u.x+165);
    if(mode==='single') s.units=s.units.filter(v=>v!==e2);
    if(mode==='reload') {u.ammo=0;u.ammoReserve=30;u.reloadingUntil=3;}
    advance(s,0.5);
    assert.equal(u.fragThrow??0,0,mode);
    assert.equal(s.projectiles.filter(p=>p.sourceUid===u.uid).length,0,mode);
  }
});

test('low stance remains committed during a hand throw, including hunker', () => {
  for(const pose of ['crouch','hunker','prone']) {
    const {s,u}=grenadeScene();
    Object.assign(u,{pose,poseAnimSeen:pose==='prone'?'prone':'crouch'});
    tick(s,1/60); assert(u.fragThrow>0);
    for(let i=0;i<65;i++) {
      tick(s,1/60);
      const f=adultFrameChoice(u,s.time);
      assert.equal(f.group,'actions20');
      assert((pose==='prone'?[2,3,12]:[1,13]).includes(f.index),`${pose}: ${f.index}`);
      assert(pose==='prone'?u.pose==='prone':['crouch','hunker'].includes(u.pose));
    }
  }
});

test('locked prone shooters reposition instead of accepting a fictitious standing shot', () => {
  for(const side of [0,1]) {
    const s=arena(), mirror=x=>side?W-x:x;
    const u=single(s,side,'infantry',mirror(600),'prone');
    const e=single(s,1-side,'infantry',mirror(900),'prone');
    u.cooldown=0;
    setOrder(s,1-side,'hold');
    for(let x=640;x<=660;x++) s.terrain[mirror(x)]=335;
    spawnUnit(s,side,'scout_drone',mirror(840));
    refreshVision(s);
    const start=u.x;
    tick(s,1/60);
    assert.equal(u.shots,0,'the real low muzzle is blocked by the bank');
    assert(u.firingGoal!==null,'must seek a position that works from prone');
    advance(s,6.5);
    assert((u.x-start)*(side?-1:1)>10,'does not remain stuck behind cover');
    assert.equal(u.pose,'prone','movement may not bypass the posture lock');
    assert(u.shots>0,'must regain a real firing ray');
    assert(Math.abs(e.x-u.x)>=105,'does not walk into the enemy');
  }
});

test('first-half cover clearance includes wrecks, keeps enemy-side cover, and never bypasses soil', () => {
  for (const side of [0,1]) {
    const s=arena(), mirror=x=>side?W-x:x;
    const p={ammunition:'rifle',startX:mirror(600),startY:350,tx:mirror(1000),ty:350};
    const wreck={id:99,cardId:'tank',side,x:mirror(700),y:374,angle:0,age:10,falling:false,vx:0,vy:0};
    s.wrecks=[wreck];
    for(let x=600;x<790;x+=5) assert.equal(projectileIntercept(s,p,mirror(x),350,mirror(x+5),350),null);
    wreck.x=mirror(950);
    s.time+=1; // world geometry cache is rebuilt on the next simulation tick
    assert(projectileIntercept(s,p,mirror(810),350,mirror(1000),350),'distant cover still intercepts');
    s.wrecks=[];
    for(let x=660;x<680;x++)s.terrain[mirror(x)]=340;
    s.terrainVersion++;
    assert(projectileIntercept(s,p,mirror(600),350,mirror(710),350),'solid earth is never skipped');
  }
});

test('airborne anti-armor has two real launchers and two rifle escorts, not four renamed riflemen', () => {
  const s=arena();
  spawnUnit(s,0,'airborne_at',1000);
  const own=[...s.units];
  const target=single(s,1,'tank',1400);
  setOrder(s,0,'hold');setOrder(s,1,'hold');
  for(const u of own) Object.assign(u,{parachuting:false,rappelling:false,y:374,motion:'ground',pose:'idle',
    stanceLockUntil:100,cooldown:0,decisionIn:100,tactic:'advance',hp:1000,maxHp:1000});
  refreshVision(s);
  const rounds=new Map();
  for(let i=0;i<80;i++) {
    tick(s,1/60);
    for(const p of s.projectiles) if(own.some(u=>u.uid===p.sourceUid)) rounds.set(p.sourceUid,p.ammunition);
  }
  assert.equal(own.length,4);
  for(const u of own) {
    const rocket=u.member<2;
    assert.equal(ammunition(u.id,u.member),rocket?'rocket':'rifle');
    assert.equal(weaponModel(u),rocket?'rocket':'infantry');
    assert.equal(weaponCard(u).armorOnly,rocket);
    if(rocket) assert.equal(rounds.get(u.uid),'rocket');
  }
  assert(target.hp<target.maxHp,'actual rocket impacts damage the tank');
});

test('assault sapper blast protection halves actual blast damage and does not create an anti-tank bonus', () => {
  const losses=[];
  for(const id of ['sapper_assault','infantry']) {
    const s=arena(),u=single(s,0,id,1000);
    explode(s,1000,354,60,40,1);
    losses.push(u.maxHp-u.hp);
  }
  assert(losses[0]>0);assert(Math.abs(losses[0]*2-losses[1])<1e-6);
  assert.equal(CARDS.sapper_assault.armorMultiplier,undefined);
  assert.equal(CARDS.sapper_assault.trait,'engineer');
  assert.equal(CARDS.combat_engineers.trait,'mechanic');
});

test('assault sapper protection does not reduce bullets or poison', () => {
  for(const kind of ['rifle','gas']) {
    const losses=[];
    for(const id of ['sapper_assault','infantry']) {
      const s=arena(),u=single(s,0,id,1000);setOrder(s,0,'hold');
      if(kind==='gas') s.comeback={reserves:[],withdrawing:[],gas:{side:1,start:0,end:5,nextTick:0}};
      else s.projectiles.push({uid:++s.uid,ammunition:'rifle',x:1100,y:340,startX:1100,startY:340,
        tx:1000,ty:340,side:1,targetUid:u.uid,base:null,damage:20,radius:0,life:0.1,total:0.1});
      advance(s,0.25);losses.push(u.maxHp-u.hp);
    }
    assert(losses[0]>0,kind);assert.equal(losses[0],losses[1],kind);
  }
});
