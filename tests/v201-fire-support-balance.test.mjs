import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createGame, startGame, spawnUnit, tick, refreshVision, W } from '../game/engine.ts';
import { CARDS, weaponCard } from '../game/cards.ts';
import { ammunition, magazine, indirectBlastKind, drawBlast } from '../game/ballistics.ts';

const DT = 1 / 60;
function arena(seed = 201401) {
  const s = createGame(seed, undefined, undefined, undefined, { difficulty: 'standard', weather: false });
  startGame(s);
  Object.assign(s, { units: [], scenery: [], walls: [], wrecks: [], aiIn: 1e9, night: false });
  s.terrain.fill(374); s.original.fill(374); s.weather.disabled = true;
  for (const p of s.players) Object.assign(p, { order: 'hold', hand: [], deck: [], discard: [], energy: 0 });
  return s;
}
function one(s, side, id, x, member = 0) {
  const before = s.units.length;
  spawnUnit(s, side, id, x, { member });
  const u = s.units[before]; s.units.splice(before + 1);
  Object.assign(u, { x, y: 374, lane: 0, pace: 1, motion: 'ground',
    pose: CARDS[id].members ? 'crouch' : 'idle', poseAnimSeen: CARDS[id].members ? 'crouch' : 'stand',
    squadOrder: 'watch', squadOrderX: x, squadOrderUntil: Infinity,
    cooldown: 1e9, secondaryCooldown: 1e9, decisionIn: 1e9, tactic: 'advance',
    buildUntil: 0, shots: 0, secondaryShots: 0, fragLeft: 0, personalMorale: 100,
    readyAt: -100, stillFor: 10 });
  return u;
}
function until(s, predicate, seconds) {
  for (let i = 0; i < Math.ceil(seconds / DT); i++) {
    tick(s, DT);
    if (predicate()) return;
  }
  assert.fail(`condition not reached after ${seconds}s`);
}
function bulletHit(id, member, side, baseline, coax = false, distance = 270) {
  const s = arena(), x = side ? W - 1400 : 1400, dir = side ? -1 : 1;
  const gun = one(s, side, id, x, member);
  const target = one(s, 1 - side, 'infantry', x + dir * distance);
  target.hp = target.maxHp = 1000;
  gun[coax ? 'secondaryCooldown' : 'cooldown'] = 0;
  refreshVision(s);
  let snapshot;
  const seen = new Set(), hp = target.hp;
  until(s, () => {
    for (const p of s.projectiles) {
      if (p.sourceUid !== gun.uid || (p.weapon === 'coax') !== coax || seen.has(p)) continue;
      seen.add(p); snapshot = {...p};
      if (baseline) p.infantryMultiplier = 1;
    }
    return target.hp < hp;
  }, 8);
  gun.cooldown = gun.secondaryCooldown = 1e9;
  assert(snapshot, `${id} must emit a real projectile before the hit`);
  return { damage: hp - target.hp, projectile: snapshot, gun };
}

for (const side of [0, 1]) {
  test(`side ${side}: actual machine-gun hits remove 50% more infantry HP, including forts and vehicle guns`, () => {
    for (const id of ['machinegun', 'lmg_team', 'heavy_mg', 'fort_machinegun',
      'pickup', 'command_vehicle', 'mine_clearer', 'scout_car']) {
      const base = bulletHit(id, 0, side, true);
      const tuned = bulletHit(id, 0, side, false);
      assert.equal(tuned.projectile.ammunition, 'machinegun', id);
      assert.equal(tuned.projectile.damage, base.projectile.damage, `${id}: the base bullet is unchanged`);
      assert(Math.abs(tuned.damage / base.damage - 1.5) < 1e-8, `${id}: ${tuned.damage} / ${base.damage}`);
    }
    for (const id of ['tank', 'tow_ifv']) {
      const base = bulletHit(id, 0, side, true, true);
      const tuned = bulletHit(id, 0, side, false, true);
      assert.equal(tuned.projectile.ammunition, 'machinegun');
      assert(Math.abs(tuned.damage / base.damage - 1.5) < 1e-8, `${id} coax: ${tuned.damage} / ${base.damage}`);
    }
  });

  test(`side ${side}: machine-gun rifle escorts and personal anti-tank sidearms receive no damage increase`, () => {
    for (const id of ['machinegun', 'lmg_team', 'heavy_mg']) {
      const base = bulletHit(id, 1, side, true);
      const tuned = bulletHit(id, 1, side, false);
      assert.equal(tuned.projectile.ammunition, 'rifle');
      assert.equal(tuned.projectile.infantryMultiplier, 1);
      assert.equal(tuned.damage, base.damage);
    }
    const personalBase = bulletHit('javelin', 0, side, true, true, 180);
    const personalTuned = bulletHit('javelin', 0, side, false, true, 180);
    assert.equal(personalTuned.projectile.ammunition, 'rifle');
    assert.equal(personalTuned.projectile.infantryMultiplier, 1);
    assert.equal(personalTuned.damage, personalBase.damage);
    assert.equal(weaponCard({id:'antiarmor', member:0}).damage, 60);
    assert.equal(weaponCard({id:'antiarmor', member:0}).armorMultiplier, 1.8);
    assert.equal(weaponCard({id:'javelin', member:0}).armorMultiplier, 2.4);
  });
}

test('the infantry-only bonus preserves bullet damage, cadence and ammunition', () => {
  for (const [id, damage, rate, mag] of [['machinegun', 5, .22, 100], ['lmg_team', 4, .16, 60], ['heavy_mg', 7, .16, 150]]) {
    assert.equal(CARDS[id].damage, damage);
    assert.equal(CARDS[id].rate, rate);
    assert.equal(magazine(id, 0).mag, mag);
    assert.equal(ammunition(id, 1), 'rifle');
    assert.equal(weaponCard({id, member:1}).damage, 4);
    assert.equal(weaponCard({id, member:1}).infantryMultiplier, 1);
  }
});

function firedShell(id) {
  const s = arena(201402), gun = one(s, 0, id, 1200);
  const targetX = 1200 + Math.min(610, CARDS[id].range - 70);
  const target = one(s, 1, 'infantry', targetX);
  target.hp = target.maxHp = 1000;
  one(s, 0, 'infantry', 1550);
  gun.cooldown = 0; refreshVision(s);
  let shell;
  until(s, () => {
    shell = s.projectiles.find(p => p.sourceUid === gun.uid);
    return !!shell;
  }, 8);
  return {s, gun, shell: {...shell}};
}

test('howitzers launch heavier wider shells while retaining their slow reload intervals', () => {
  for (const [id, damage, radius, rate] of [['artillery',64,54,12], ['barrage',96,70,17],
    ['precision',90,42,15], ['field_gun',44,42,6.5], ['siege_gun',130,86,17]]) {
    const {gun, shell} = firedShell(id);
    assert.equal(shell.damage, damage, id);
    assert.equal(shell.radius, radius, id);
    assert.equal(shell.effect, 'artillery', id);
    assert.equal(CARDS[id].rate, rate);
    assert(gun.cooldown >= rate - DT, `${id} must really enter its long reload: ${gun.cooldown}`);
    assert(radius > CARDS.mortar.radius * 1.3);
  }
  for (const id of ['mortar', 'light_mortar', 'mortar_carrier']) {
    const {shell} = firedShell(id);
    assert.equal(shell.effect, 'he', `${id}: small mortar bombs must not use the howitzer plume`);
    assert.equal(indirectBlastKind(id), 'he');
    assert(shell.radius <= 30);
  }
});

function groundImpact(id) {
  const launched = firedShell(id).shell;
  const s = arena(201403), victim = one(s, 1, 'infantry', 1852);
  victim.hp = victim.maxHp = 1000;
  // Put the real emitted shell on its final unobstructed flight segment. The
  // impact and falloff still run through the normal projectile/explosion loop.
  s.projectiles.push({...launched, uid:++s.uid, sourceUid:undefined, targetUid:null,
    x:1800, y:373, tx:1800, ty:374, startX:1800, startY:373,
    arc:0, life:DT/2, total:DT/2, base:null});
  tick(s, DT);
  return {damage:1000-victim.hp, blast:s.blasts[0], clouds:s.particles.filter(p => p.kind === 'cloud')};
}

test('a howitzer shell damages infantry beyond mortar reach and leaves a larger longer smoke column', () => {
  const mortar = groundImpact('mortar'), field = groundImpact('artillery'), heavy = groundImpact('barrage');
  assert.equal(mortar.damage, 0, '52px is outside the mortar blast and its fringe');
  assert(field.damage > 0, 'the same infantry position lies within the howitzer blast');
  assert(heavy.damage > field.damage, 'the heavy shell retains more damage at this distance');
  assert.equal(field.blast.kind, 'artillery'); assert.equal(mortar.blast.kind, 'he');
  assert(Math.max(...field.clouds.map(p=>p.size)) > Math.max(...mortar.clouds.map(p=>p.size)) * 1.6);
  assert(Math.max(...field.clouds.map(p=>p.maxLife)) > Math.max(...mortar.clouds.map(p=>p.maxLife)));
  assert(Math.min(...field.clouds.map(p=>p.vy)) < Math.min(...mortar.clouds.map(p=>p.vy)));
});

test('the native blast draw preserves authored pixels and separates mortar, field and heavy plume sizes', () => {
  const {createCanvas} = createRequire(import.meta.url)('@napi-rs/canvas');
  globalThis.document = {createElement: () => createCanvas(1,1)};
  const source = createCanvas(144,160), sourceCtx = source.getContext('2d');
  sourceCtx.fillStyle = '#675641'; sourceCtx.fillRect(30,20,84,134);
  const canvas = createCanvas(700,600), ctx = canvas.getContext('2d'), draws = [];
  const draw = ctx.drawImage.bind(ctx);
  ctx.drawImage = (...args) => {draws.push(args);return draw(...args);};
  const painted = {he:[source],earth:[source],fuel:[source]};
  const sizes = [];
  for (const id of ['mortar','artillery','barrage']) {
    draws.length = 0;
    drawBlast(ctx,{x:350,y:580,age:0,seed:0,radius:CARDS[id].radius,kind:indirectBlastKind(id)},[[source],[source]],undefined,undefined,painted);
    assert.equal(draws[0][0], source);
    sizes.push(draws[0][3]);
  }
  assert(sizes[1] > sizes[0] * 1.8, `field plume ${sizes[1]} vs mortar ${sizes[0]}`);
  assert(sizes[2] > sizes[1] * 1.2, `heavy plume ${sizes[2]} vs field ${sizes[1]}`);
});
