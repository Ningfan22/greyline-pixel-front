import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createGame, startGame, spawnUnit, explode, tick, refreshVision } from '../game/engine.ts';
import { CARDS } from '../game/cards.ts';
import { createScenery, buildingStage, ARTILLERY_STRUCTURE_MULTIPLIER } from '../game/world.ts';
import { gunMount, gunPose } from '../game/gun-geometry.ts';
import { HELI_LAYOUT } from '../game/weapon-layout-v204.ts';
import { loadBakedBattleArt } from '../game/battle-art-baked.ts';
const { createCanvas, Image } = createRequire(import.meta.url)('@napi-rs/canvas');
globalThis.document = { createElement: () => createCanvas(1, 1) };
globalThis.Image = class extends Image {
  set src(path) { super.src = fileURLToPath(new URL('../public' + path, import.meta.url)); }
};
const art = await loadBakedBattleArt();
function arena() {
  const s = createGame(206, undefined, undefined, undefined, { weather: false });
  startGame(s);
  Object.assign(s, { units: [], scenery: [], walls: [], wrecks: [], aiIn: 1e9, night: false });
  s.terrain.fill(374); s.original.fill(374); s.terrainVersion++;
  for (const p of s.players) Object.assign(p, { hand: [], deck: [], discard: [], energy: 0 });
  return s;
}
const near = (a,b) => assert(Math.abs(a-b) < 1e-5, `${a} != ${b}`);
const health = prop => prop.parts.reduce((n,p) => n + Math.max(0,p.hp),0);
test('chin barrel sweeps clear of its own nose on both facings and hull pitches', () => {
  const parts = art.helicopterParts;
  assert(parts, 'actual compiled helicopter parts');
  for (const facing of [-1,1]) for (const hullAngle of [-.1,0,.1])
    for (const elevation of [-1.36,-.5,0,gunMount('helicopter').maxElevation,1]) {
      const u = { id: 'helicopter', x: 300, y: 280, facing, gunFacing: facing, hullAngle, gunElevation: elevation };
      const body = createCanvas(600,400), gun = createCanvas(600,400);
      const b = body.getContext('2d'), g = gun.getContext('2d');
      b.imageSmoothingEnabled = g.imageSmoothingEnabled = false;
      b.translate(u.x,u.y); b.rotate(hullAngle); b.scale(facing,1);
      b.drawImage(parts.body,-parts.body.width/2,-parts.body.height);
      const pose = gunPose(u);
      g.translate(pose.pivot.x,pose.pivot.y); g.rotate(pose.angle); g.scale(1,facing);
      g.drawImage(parts.gun,-parts.gunPivot[0],-parts.gunPivot[1]);
      const bp = b.getImageData(0,0,600,400).data, gp = g.getImageData(0,0,600,400).data;
      let overlaps = 0;
      for (let i=3;i<bp.length;i+=4) if(bp[i]>190 && gp[i]>190) {
        const index = (i-3)/4, x=index%600, y=Math.floor(index/600);
        if(Math.hypot(x-pose.pivot.x,y-pose.pivot.y)>4) overlaps++;
      }
      assert.equal(overlaps,0, `nose overlap: facing ${facing}, hull ${hullAngle}, aim ${elevation}`);
      assert(pose.elevation <= 8*Math.PI/180 + 1e-8);
    }
  assert.equal(HELI_LAYOUT.gunSocket[1],531);
});
for (const state of ['standing','partial']) test(`heavy blast gives ${state} buildings 3x damage without changing trees`, () => {
  function strike(kind) {
    const s = arena(), props=createScenery(s.original);
    const house = props.find(p=>p.kind==='house'), tree=props.find(p=>p.kind==='tree');
    for(const part of house.parts) {part.hp=part.maxHp=10000;}
    if(state==='partial') {house.parts.find(p=>p.kind==='roof').hp=0; assert.equal(buildingStage(house),2);}
    s.scenery=[house];
    const before=health(house); explode(s,house.x,house.y-40,220,20,0,1,1,kind);
    const houseLoss=before-health(house);
    s.scenery=[tree]; for(const p of tree.parts) p.hp=p.maxHp=10000;
    const treeBefore=health(tree); explode(s,tree.x,tree.y-40,220,20,0,1,1,kind);
    return {houseLoss,treeLoss:treeBefore-health(tree)};
  }
  const ordinary=strike('he'), artillery=strike('artillery');
  assert(ordinary.houseLoss>0); near(artillery.houseLoss,ordinary.houseLoss*ARTILLERY_STRUCTURE_MULTIPLIER);
  near(artillery.treeLoss,ordinary.treeLoss);
});
test('demolition bonus affects fortifications and walls, not armour, infantry or headquarters', () => {
  function strike(kind,id) {
    const s=arena(); spawnUnit(s,1,id,1700); const u=s.units[0];
    s.units=[u]; Object.assign(u,{hp:1e6,maxHp:1e6,buildUntil:0});
    const before=u.hp; explode(s,u.x,u.y-20,80,5,0,1,1,kind);
    return before-u.hp;
  }
  near(strike('artillery','fort_bunker'),strike('he','fort_bunker')*3);
  for(const id of ['tank','infantry']) near(strike('artillery',id),strike('he',id));
  const s=arena(); s.walls=[{x:1000,width:30,height:50,hp:1000}];
  explode(s,1000,354,40,20,0,1,1,'artillery'); assert.equal(s.walls[0].hp,940);
  function base(kind) {const s=arena(),before=s.players[1].hp; explode(s,3200,354,10000,20,0,.15,1,kind);return before-s.players[1].hp;}
  near(base('artillery'),base('he'));
});
test('shorter live 16-rocket salvo keeps every tube, damage and supply cost', () => {
  const s=arena(); spawnUnit(s,0,'mlrs',750); const u=s.units[0];
  spawnUnit(s,0,'pathfinders',1270); spawnUnit(s,1,'barrage',1470); const target=s.units.at(-1);
  Object.assign(target,{hp:1e6,maxHp:1e6,cooldown:1e9,squadOrder:'watch',squadOrderUntil:Infinity});
  Object.assign(u,{squadOrder:'watch',squadOrderUntil:Infinity}); refreshVision(s);
  const shots=[]; let old=0;
  for(let i=0;i<8*60;i++) {tick(s,1/60); if(u.shots!==old) {const p=s.projectiles.findLast(p=>p.sourceUid===u.uid);shots.push({time:s.time,port:p.launcherTube,damage:p.damage});old=u.shots;}}
  assert.equal(shots.length,16); assert.deepEqual(shots.map(p=>p.port),Array.from({length:16},(_,i)=>i));
  assert(shots.at(-1).time-shots[0].time<3.3);
  assert.equal(u.ammo,0); assert.equal(u.ammoReserve,16);
  assert(u.reloadingUntil - shots.at(-1).time <= 12.1, 'real loaded-rack timer follows 12-second rule');
  assert(shots.every(p=>p.damage===10)); assert.equal(CARDS.mlrs.burstPause,12);
  for(const [id,rate] of [['field_gun',5.5],['artillery',10],['barrage',14],['precision',12],['siege_gun',14]]) assert.equal(CARDS[id].rate,rate);
  assert.equal(CARDS.mortar.rate,10,'previous mortar nerf retained');
});
