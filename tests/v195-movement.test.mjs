import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame, startGame, spawnUnit, tick, refreshVision, W } from '../game/engine.ts';
import { setSquadOrder, updateSquadOrders } from '../game/squad-orders.ts';
import { CARDS } from '../game/cards.ts';
import { ECONOMY_RULES, initialEconomy, energyInterval, updateEconomy, applyEconomy } from '../game/economy.ts';

const DT = 1 / 60;
const dir = side => side ? -1 : 1;
const x = (side, value) => side ? W - value : value;
function arena(side = 0) {
  const s = createGame(195, undefined, undefined, undefined, { difficulty: 'standard', weather: false });
  startGame(s);
  Object.assign(s, { units: [], walls: [], scenery: [], wrecks: [], aiIn: 1e9 });
  s.terrain.fill(374); s.original.fill(374);
  s.players[side].order = 'advance';
  s.players[1 - side].order = 'hold';
  return s;
}
function add(s, side, id, value) {
  const n = s.units.length;
  spawnUnit(s, side, id, x(side, value));
  const units = s.units.slice(n);
  for (const u of units) {
    u.cooldown = u.secondaryCooldown = 1e9;
    u.personalMorale = 100;
  }
  return units;
}
function run(s, seconds) {
  for (let i = 0; i < Math.round(seconds / DT); i++) tick(s, DT);
}
function enemy(s, side, value, id = 'infantry') {
  const units = add(s, 1 - side, id, W - value);
  for (const u of units) {
    u.squadOrder = 'watch';
    u.squadOrderUntil = Infinity;
    u.hp = u.maxHp = 1e6;
  }
  refreshVision(s);
  return units;
}

for (const side of [0, 1]) {
  test(`side ${side}: a sustained combat halt releases rear infantry into an attack in front`, () => {
    const s = arena(side);
    const tank = add(s, side, 'tank', 1380)[0];
    const own = add(s, side, 'infantry', 1240);
    const start = own.map(u => u.x);
    setSquadOrder(s, side, own[0].squad, 'escort');
    enemy(s, side, 1840);
    run(s, 0.5);
    assert(own.every(u => u.squadOrder === 'escort'), 'brief halts retain the escort');
    run(s, 7.5);
    assert(own.every(u => u.squadOrder === 'attack' && u.escortTankUid === undefined));
    assert(own.some(u => (u.x - tank.x) * dir(side) > 35), 'infantry really take a forward position');
    assert(own.some((u, i) => (u.x - start[i]) * dir(side) > 150));
    run(s, 2);
    assert(own.every(u => u.squadOrder === 'attack'), 'the attack never snaps back to a rear slot');
  });

  test(`side ${side}: stopped tanks without contact and momentary combat stops keep escorts`, () => {
    const s = arena(side);
    const tank = add(s, side, 'tank', 1380)[0];
    tank.pace = 0;
    const own = add(s, side, 'infantry', 1240);
    setSquadOrder(s, side, own[0].squad, 'escort');
    run(s, 3);
    assert(own.every(u => u.squadOrder === 'escort'));
    const foes = enemy(s, side, 1840);
    run(s, 0.5);
    for (const foe of foes) foe.hp = 0;
    refreshVision(s);
    run(s, 1);
    assert(own.every(u => u.squadOrder === 'escort'));
  });

  test(`side ${side}: a healthy tank reverses from a close infantry contact while facing it`, () => {
    const s = arena(side);
    const tank = add(s, side, 'tank', 1500)[0];
    tank.pace = 1;
    enemy(s, side, 1670);
    const start = tank.x;
    run(s, 1);
    assert(tank.hp >= tank.maxHp * 0.99, 'health is not the trigger');
    assert.equal(tank.vehicleReverseReason, 'close');
    assert((tank.vehicleReverseUntil ?? 0) > s.time);
    assert((start - tank.x) * dir(side) > 10);
    assert((start - tank.x) * dir(side) < CARDS.tank.speed * 0.8, 'reverse is slower than forward travel');
    assert.equal(tank.facing, dir(side));
    const positions = [];
    for (let i = 0; i < 9 * 60; i++) {
      tick(s, DT);
      positions.push(tank.x);
    }
    assert(positions.every((at, i) => !i || (at - positions[i - 1]) * dir(side) < 0.01),
      'a held firing line does not alternate forward and reverse');
  });

  test(`side ${side}: a healthy tank holds its safe firing distance`, () => {
    const s = arena(side);
    const tank = add(s, side, 'tank', 1500)[0];
    enemy(s, side, 1900);
    run(s, 2);
    assert((tank.vehicleReverseUntil ?? 0) <= s.time);
  });

  test(`side ${side}: a parked tank can reverse without snapping back to its old watch anchor`, () => {
    const s = arena(side);
    const tank = add(s, side, 'tank', 1500)[0];
    tank.pace = 1;
    setSquadOrder(s, side, tank.squad, 'watch');
    enemy(s, side, 1670);
    const start = tank.x;
    run(s, 10);
    assert((start - tank.x) * dir(side) > 100);
    assert(Math.abs(tank.squadOrderX - tank.x) < 1);
    const settled = tank.x;
    run(s, 1);
    assert(Math.abs(tank.x - settled) < 1);
  });

  test(`side ${side}: walking is slower and manual withdrawal stays below walking pace`, () => {
    const walking = arena(side), withdrawing = arena(side);
    const walker = add(walking, side, 'infantry', 1200)[0];
    const retreat = add(withdrawing, side, 'infantry', 1200)[0];
    walking.units = [walker]; withdrawing.units = [retreat];
    walker.pace = retreat.pace = 1;
    setSquadOrder(walking, side, walker.squad, 'attack');
    setSquadOrder(withdrawing, side, retreat.squad, 'retreat');
    withdrawing.players[side].blitzUntil = 20;
    const startWalk = walker.x, startRetreat = retreat.x;
    run(walking, 2); run(withdrawing, 2);
    const walkDistance = (walker.x - startWalk) * dir(side);
    const retreatDistance = (startRetreat - retreat.x) * dir(side);
    assert(walkDistance > 60 && walkDistance <= CARDS.infantry.speed * 0.8 * 2 + 0.01);
    assert(retreatDistance > 20 && retreatDistance < walkDistance * 0.7,
      'a movement buff cannot make the withdrawal faster than walking');
  });
}

test('escort contact detection uses side visibility, never an unseen enemy position', () => {
  const s = arena();
  add(s, 0, 'tank', 1380);
  const own = add(s, 0, 'infantry', 1240);
  enemy(s, 0, 1840);
  s.visible[0] = [];
  setSquadOrder(s, 0, own[0].squad, 'escort');
  for (let i = 0; i < 120; i++) { s.time += DT; updateSquadOrders(s, DT); }
  assert(own.every(u => u.squadOrder === 'escort'));
});

test('normal command recharge is 5.5 seconds per point and economy boosts remain useful', () => {
  const s = { time: 0, players: [initialEconomy(0, { difficulty: 'standard' }), initialEconomy(1, { difficulty: 'standard' })] };
  assert.equal(ECONOMY_RULES.baseInterval, 5.5);
  updateEconomy(s, 0, 5.5);
  assert.equal(s.players[0].energy, 1);
  applyEconomy(s.players[0], 'logistics', 0);
  assert.equal(energyInterval(s, 0), 5.05);
  applyEconomy(s.players[0], 'logistics', 0);
  assert.equal(energyInterval(s, 0), 4.6);
  applyEconomy(s.players[0], 'production', 0);
  assert(energyInterval(s, 0) < 4.6);
});
