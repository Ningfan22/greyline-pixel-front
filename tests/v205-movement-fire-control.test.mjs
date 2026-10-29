import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, startGame, spawnUnit, tick, refreshVision, ground, explode, W, CARDS } from '../game/engine.ts';
import { artilleryAimReady } from '../game/artillery-fire-control.ts';

const DT = 1 / 30, dir = side => side ? -1 : 1, at = (side, x) => side ? W - x : x;
function arena() {
  const s = createGame(205, undefined, undefined, undefined, { weather: false }); startGame(s);
  Object.assign(s, { units: [], scenery: [], walls: [], wrecks: [], aiIn: 1e9 });
  s.terrain.fill(374); s.original.fill(374); s.terrainVersion++;
  for (const p of s.players) Object.assign(p, { order: 'advance', hand: [], deck: [], discard: [], energy: 0 });
  return s;
}
function one(s, side, id, x, patch = {}) {
  const n = s.units.length; spawnUnit(s, side, id, x); const u = s.units[n]; s.units.splice(n + 1);
  Object.assign(u, { x, y: ground(s, x), pace: 1, personalMorale: 100,
    tactic: 'advance', decisionIn: 1e9, cooldown: 1e9, secondaryCooldown: 1e9,
    squadOrder: 'attack', squadOrderUntil: Infinity, shots: 0, ...patch });
  return u;
}
function watch(u) { Object.assign(u, { squadOrder: 'watch', squadOrderX: u.x, emplaced: true, emplacementSetupUntil: 0 }); }
function run(s, seconds, inspect) { for (let i = 0; i < Math.round(seconds / DT); i++) { tick(s, DT); inspect?.(); } }

for (const side of [0, 1]) {
  test(`side ${side}: blocked tank probes a passable ridge without a shovel order or unsafe charge`, () => {
    const s = arena();
    for (let x = 940; x < 1200; x++) s.terrain[at(side, x)] = 374 - Math.min(170, (x - 940) * 1.5, (1200 - x) * 1.5);
    s.original = [...s.terrain]; s.terrainVersion++;
    const tank = one(s, side, 'tank', at(side, 900));
    const foe = one(s, 1 - side, 'tank', at(side, 1450), { hp: 1e6, maxHp: 1e6 }); watch(foe);
    const scout = one(s, side, 'scouts', at(side, 1400), { pace: 0 }); watch(scout);
    refreshVision(s); let previous = tank.x;
    run(s, 10, () => {
      const step = (tank.x - previous) * dir(side);
      assert(step >= -1e-8 && step <= CARDS.tank.speed * .8 * DT + 1e-8, 'supported powered steps, no oscillation or teleport');
      assert(Math.abs(tank.x - foe.x) >= 280, 'observed contact safety line remains intact'); previous = tank.x;
    });
    assert((tank.x - at(side, 900)) * dir(side) > 100, 'the old permanently stopped tank advances to reassess');
    assert.equal(tank.shots, 0, 'probing never invents a shot through the ridge');
  });

  test(`side ${side}: a mortar crew can bank out of a crater while retaining a visible target`, () => {
    const s = arena();
    for (let x = 965; x <= 1035; x++) s.terrain[at(side, x)] = 374 + Math.min(44, (x - 965) * 2.2, (1035 - x) * 2.2);
    s.terrainVersion++;
    const mortar = one(s, side, 'mortar', at(side, 990), {
      pose: 'crouch', stanceLockUntil: Infinity, displaceGoal: at(side, 940),
      displaceUntil: 100, mortarSiteShots: 2, lane: 0,
    });
    const foe = one(s, 1 - side, 'infantry', at(side, 1360), { hp: 1e6, maxHp: 1e6 }); watch(foe);
    refreshVision(s); const start = mortar.x; let bank = false;
    run(s, 7, () => { bank ||= mortar.motion === 'bank'; });
    assert(bank, 'an intentional displacement starts the real bank drill despite contact');
    assert((start - mortar.x) * dir(side) > 30, 'crew really clears the lip rather than freezing there');
    assert(Number.isFinite(mortar.y));
  });

  for (const id of ['artillery', 'field_gun', 'barrage', 'mlrs', 'mortar']) {
    test(`side ${side}: ${id} ranges a new visible target before its actual first projectile`, () => {
      const s = arena(), gun = one(s, side, id, at(side, 1000), { cooldown: 0 }); watch(gun);
      const foe = one(s, 1 - side, 'tank', at(side, 1550), { hp: 1e6, maxHp: 1e6 }); watch(foe);
      const scout = one(s, side, 'scouts', at(side, 1500), { pace: 0 }); watch(scout);
      refreshVision(s); let launchedAt;
      run(s, .8); assert.equal(gun.shots, 0, 'sighting is not instant firing');
      run(s, 5, () => {
        const p = s.projectiles.find(p => p.sourceUid === gun.uid);
        if (p && launchedAt === undefined) launchedAt = s.time;
      });
      assert(launchedAt >= 1.4 && launchedAt < 5, `actual measured first launch ${launchedAt}`);
      assert(gun.shots > 0, 'ranging eventually completes rather than permanently blocking fire');
    });
  }

  test(`side ${side}: real artillery blast damages friends and enemies equally, but never credits friendly kills`, () => {
    const s = arena(), gun = one(s, side, 'artillery', at(side, 800)); watch(gun);
    const friend = one(s, side, 'infantry', at(side, 1200), { pose: 'idle', hp: 1000, maxHp: 1000 });
    const enemy = one(s, 1 - side, 'infantry', friend.x, { pose: 'idle', hp: 1000, maxHp: 1000 });
    explode(s, friend.x, friend.y - 20, 75, 30, side, 1, 1, 'artillery', 1, gun.uid);
    assert(friend.hp < 1000); assert.equal(friend.hp, enemy.hp, 'same physical blast falloff and protection');
    assert(s.notices.some(n => n.text.includes('炮弹') && n.text.includes('误伤')));
    enemy.x = at(side, 1700); friend.hp = 1; const kills = gun.kills ?? 0;
    explode(s, friend.x, friend.y - 20, 75, 100, side, 1, 1, 'artillery', 1, gun.uid);
    assert(friend.hp <= 0); assert.equal(gun.kills ?? 0, kills);
  });
}

test('ranging survives ordinary corrections and reload, resets on changed target, loss of contact or movement', () => {
  const u = { id: 'artillery', x: 1000 };
  assert(!artilleryAimReady(u, 0, 'unit:1', 1600, 370));
  const deadline = u.artilleryAim.readyAt;
  for (let time = .2; time < deadline; time += .2) assert(!artilleryAimReady(u, time, 'unit:1', 1610, 370));
  assert(artilleryAimReady(u, deadline + .1, 'unit:1', 1610, 370));
  assert(artilleryAimReady(u, deadline + .3, 'unit:1', 1620, 370));
  assert(!artilleryAimReady(u, deadline + .4, 'unit:2', 1620, 370));
  const first = u.artilleryAim.readyAt;
  u.x += 10; assert(!artilleryAimReady(u, deadline + .6, 'unit:2', 1620, 370)); assert(u.artilleryAim.readyAt > first);
  const moved = u.artilleryAim.readyAt;
  assert(!artilleryAimReady(u, deadline + 1.6, 'unit:2', 1620, 370)); assert(u.artilleryAim.readyAt > moved);
});

test('friendly mortar HE also hurts allies; ordinary tank HE retains its existing rules', () => {
  for (const id of ['mortar', 'tank']) {
    const s = arena(), gun = one(s, 0, id, 800), ally = one(s, 0, 'infantry', 1200, { pose: 'idle' });
    const hp = ally.hp;
    explode(s, ally.x, ally.y - 20, 50, 10, 0, 1, 1, 'he', 1, gun.uid);
    assert.equal(ally.hp < hp, id === 'mortar');
  }
});

test('a travelling mortar shell retains friendly blast damage after its crew has been removed', () => {
  const s = arena(), gun = one(s, 0, 'mortar', 1000, { cooldown: 0 }); watch(gun);
  const foe = one(s, 1, 'tank', 1450, { hp: 1e6, maxHp: 1e6 }); watch(foe);
  refreshVision(s);
  for (let i = 0; i < 4 / DT && !gun.shots; i++) tick(s, DT);
  const p = s.projectiles.find(p => p.sourceUid === gun.uid);
  assert(p?.shell && p.sourceCardId === 'mortar');
  const ally = one(s, 0, 'infantry', p.tx, { pose: 'idle', hp: 1000, maxHp: 1000 }); watch(ally);
  s.units = s.units.filter(u => u !== gun);
  run(s, 4);
  assert(ally.hp < 1000, 'the launched round cannot lose its physical friendly blast with its source');
});

test('called artillery impacts also damage nearby friends', () => {
  const s = arena(), ally = one(s, 0, 'infantry', 1200, { pose: 'idle', hp: 1000, maxHp: 1000 }); watch(ally);
  s.markers.push({ side: 0, x: ally.x, impacts: [ally.x], kind: 'artillery', timer: 0, wave: 0 });
  tick(s, DT); assert(ally.hp < 1000);
});
