import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  startGame,
  spawnUnit,
  tick,
  refreshVision,
  isCombatant,
  W,
  CARDS,
} from '../game/engine.ts';
import { wreckContact } from '../game/wreck-geometry.ts';
import { tankAimReady, TANK_ACQUIRE_S } from '../game/tank-fire-control.ts';
import { issueLogisticsOrder } from '../game/logistics-orders.ts';
const DT = 1 / 60,
  dir = (side) => (side ? -1 : 1),
  at = (side, x) => (side ? W - x : x);
function arena() {
  const s = createGame(218, undefined, undefined, undefined, {
    weather: false,
  });
  startGame(s);
  Object.assign(s, {
    units: [],
    scenery: [],
    walls: [],
    wrecks: [],
    aiIn: 1e9,
    night: false,
  });
  s.terrain.fill(374);
  s.original.fill(374);
  s.terrainVersion++;
  for (const p of s.players)
    Object.assign(p, {
      order: 'advance',
      hand: [],
      deck: [],
      discard: [],
      energy: 0,
    });
  return s;
}
function one(s, side, id, x, extra = {}) {
  const n = s.units.length;
  spawnUnit(s, side, id, x);
  s.units.splice(n + 1);
  const u = s.units[n];
  Object.assign(u, {
    x,
    y: 374,
    pace: 1,
    personalMorale: 100,
    cooldown: 0,
    secondaryCooldown: 0,
    fragCooldown: 1e9,
    ...extra,
  });
  return u;
}
function watch(u) {
  Object.assign(u, {
    squadOrder: 'watch',
    squadOrderX: u.x,
    squadOrderUntil: Infinity,
  });
}
function wreck(s, side, id, x) {
  const w = {
    id: ++s.uid,
    cardId: id,
    side,
    x,
    y: 374,
    angle: 0,
    age: 5,
    falling: false,
    vx: 0,
    vy: 0,
    facing: dir(side),
  };
  Object.assign(
    w,
    wreckContact(() => 374, w),
  );
  s.wrecks.push(w);
}
function run(s, seconds, inspect) {
  for (let i = 0; i < seconds / DT; i++) {
    tick(s, DT);
    inspect?.();
  }
}
function dense(side, kind, count, enemyX) {
  const s = arena();
  for (let i = 0; i < count; i++)
    wreck(s, 1 - side, kind, at(side, 1200 + i * 35));
  const tank = one(s, side, 'heavy_tank', at(side, 1060));
  const foe = one(s, 1 - side, 'infantry', at(side, enemyX), { cooldown: 1e9 });
  watch(foe);
  const scout = one(s, side, 'scouts', at(side, 1800), { cooldown: 1e9 });
  watch(scout);
  const foot = [];
  for (let i = 0; i < 12; i++)
    foot.push(
      one(s, side, 'infantry', at(side, 1100 - i * 10), {
        lane: (i % 4) * 12 - 18,
      }),
    );
  refreshVision(s);
  return { s, tank, foe, foot };
}
for (const side of [0, 1])
  for (const [kind, count, enemyX] of [
    ['tank', 1, 1230],
    ['tank', 3, 1230],
    ['light_tank', 3, 1330],
  ])
    test(`${side}/${kind}/${count}: dense troops engage across decorative wrecks and continue after defeating the defender`, () => {
      const { s, tank, foe, foot } = dense(side, kind, count, enemyX);
      let prior = new Map(s.units.map((u) => [u.uid, u.x])),
        enemyWalk = 0;
      run(s, 65, () => {
        for (const u of s.units) {
          if (!isCombatant(u)) continue;
          const old = prior.get(u.uid);
          if (old !== undefined && u.motion === 'ground')
            assert(
              Math.abs(u.x - old) < (CARDS[u.id].speed ?? 0) * 2.5 * DT + 0.001,
              'no teleport or blanket collision bypass',
            );
          prior.set(u.uid, u.x);
          if (u.firingGoal != null && u.lastThreat && isCombatant(foe))
            assert(
              (u.lastThreat.x - u.x) * (u.lastThreat.x - u.firingGoal) > 0,
              'chosen firing slot stays on this side of the observed contact',
            );
        }
        enemyWalk = Math.max(enemyWalk, Math.abs(foe.x - at(side, enemyX)));
      });
      assert(
        !isCombatant(foe),
        JSON.stringify({
          foe: foe.hp,
          x: foe.x,
          tank: tank.x,
          shots: tank.shots,
          foot: foot.map((u) => [u.x, u.shots, u.firingGoal]),
        }),
      );
      assert(
        (tank.x - at(side, enemyX)) * dir(side) > 60,
        'tank resumes the same battle beyond the wreck',
      );
      assert(
        enemyWalk <= 32,
        'a watch defender does not invent an exit from decorative wrecks',
      );
    });
for (const side of [0, 1])
  for (const id of ['tank', 'light_tank', 'heavy_tank'])
    test(`${side}/${id}: a visible target waits a full three seconds before the actual first shell`, () => {
      const s = arena(),
        u = one(s, side, id, at(side, 1000), { secondaryCooldown: 1e9 }),
        foe = one(s, 1 - side, 'tank', at(side, 1400), {
          cooldown: 1e9,
          secondaryCooldown: 1e9,
          hp: 10000,
          maxHp: 10000,
        });
      watch(u);
      watch(foe);
      refreshVision(s);
      const x = u.x;
      run(s, 2.9);
      assert.equal(u.shots, 0);
      assert.equal(u.x, x);
      run(s, 0.4);
      assert.equal(u.shots, 1);
      assert.equal(u.x, x);
      assert(foe.hp < 10000, 'shell actually strikes after aiming');
    });
test('actual movement and contact change restart the tank aim, continuing observation does not', () => {
  const u = { id: 'tank', x: 1000 };
  assert.equal(TANK_ACQUIRE_S, 3);
  for (let t = 0; t < 3; t += 0.1)
    assert(!tankAimReady(u, t, 'a', 1500 + t * 3, 330));
  assert(tankAimReady(u, 3.1, 'a', 1510, 330));
  u.x += 3;
  assert(!tankAimReady(u, 3.2, 'a', 1510, 330));
  for (let t = 3.3; t < 6.2; t += 0.1)
    assert(!tankAimReady(u, t, 'a', 1510, 330));
  assert(tankAimReady(u, 6.3, 'a', 1510, 330));
  assert(!tankAimReady(u, 6.4, 'b', 1550, 330));
});
test('an explicit supply hold does not acquire a wreck escape movement', () => {
  const { s, tank } = dense(0, 'tank', 3, 1230);
  tank.fuel = 40;
  assert(issueLogisticsOrder(s, tank.uid, 'hold'));
  const x = tank.x;
  run(s, 8);
  assert.equal(tank.x, x);
});

for (const side of [0, 1])
  test(`side ${side}: a buried defender also escapes when its own weapon is live`, () => {
    const { s, tank, foe } = dense(side, 'tank', 3, 1230);
    foe.cooldown = 0;
    run(s, 65);
    assert(!isCombatant(foe));
    assert(tank.hp > 0);
    assert((tank.x - at(side, 1230)) * dir(side) > 60);
  });

for (const side of [0, 1]) {
  test(`side ${side}: a quiet rifle fallback probes after regroup, without reading a hidden death`, () => {
    const s = arena(),
      u = one(s, side, 'infantry', at(side, 1000));
    const foe = one(s, 1 - side, 'infantry', at(side, 1500), { cooldown: 1e9 });
    watch(foe);
    Object.assign(u, {
      withdrawHeavyUid: foe.uid,
      withdrawSmallArms: true,
      withdrawHeavyX: foe.x,
      withdrawHeavyY: 350,
      withdrawStandby: true,
      withdrawStandbySince: 0,
      withdrawUntil: 0,
      withdrawAssessAt: 1e9,
    });
    // Only the previously observed snapshot is known. The current hidden
    // position and death must neither clear the wait early nor steer the probe.
    foe.x = at(side, 3000);
    foe.hp = 0;
    refreshVision(s);
    run(s, 5);
    assert.equal(u.withdrawHeavyUid, foe.uid);
    assert.equal(u.x, at(side, 1000));
    run(s, 5);
    assert.equal(u.withdrawHeavyUid, undefined);
    assert(
      (u.x - at(side, 1000)) * dir(side) > 10,
      'normal advance resumes after the quiet regroup',
    );
  });
  test(`side ${side}: regroup expiry never overrides a visible unsupported tank`, () => {
    const s = arena(),
      u = one(s, side, 'infantry', at(side, 1000));
    const tank = one(s, 1 - side, 'tank', at(side, 1450), {
      cooldown: 1e9,
      secondaryCooldown: 1e9,
    });
    watch(tank);
    Object.assign(u, {
      withdrawHeavyUid: tank.uid,
      withdrawSmallArms: false,
      withdrawHeavyX: tank.x,
      withdrawHeavyY: 330,
      withdrawStandby: true,
      withdrawStandbySince: 0,
      withdrawUntil: 0,
    });
    refreshVision(s);
    run(s, 20);
    assert.equal(u.withdrawHeavyUid, tank.uid);
    assert(
      (u.x - at(side, 1000)) * dir(side) <= 0,
      'rifleman never charges invulnerable armour',
    );
  });
}
