import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createGame,
  startGame,
  spawnUnit,
  tick,
  refreshVision,
  W,
  isCombatant,
} from '../game/engine.ts';
import { setSquadOrder, SQUAD_ORDERS } from '../game/squad-orders.ts';
const dt = 1 / 60;
function arena(side = 0, seed = 733) {
  const s = createGame(seed);
  startGame(s);
  Object.assign(s, {
    units: [],
    scenery: [],
    walls: [],
    wrecks: [],
    aiIn: 1e9,
  });
  s.terrain.fill(374);
  s.original.fill(374);
  s.players[side].order = 'advance';
  s.players[1 - side].order = 'hold';
  return s;
}
const at = (side, x) => (side ? W - x : x);
function add(s, side, id, x) {
  const n = s.units.length;
  spawnUnit(s, side, id, at(side, x));
  return s.units.slice(n);
}
function advance(s, seconds) {
  for (let i = 0; i < seconds * 60; i++) tick(s, dt);
}
function heavyScene(side, heavy, seconds = 30) {
  const s = arena(side),
    dir = side ? -1 : 1,
    own = [];
  for (let g = 0; g < 4; g++)
    own.push(...add(s, side, 'infantry', 1200 - g * 65));
  own.forEach((u, i) => {
    u.x = at(side, 1200 - Math.floor(i / 6) * 65 - (i % 6) * 18);
    u.y = 374;
  });
  const foe = add(s, 1 - side, heavy, W - 1510)[0];
  foe.cooldown = foe.secondaryCooldown = 3;
  refreshVision(s);
  let forwardAfter6 = 0,
    backward = 0,
    movingFrames = 0,
    coveredFrames = 0,
    allBackFrames = 0;
  const committed = new Set();
  const firstRetreat = new Map();
  let lateRetreat = false;
  for (let i = 0; i < seconds * 60; i++) {
    const before = new Map(own.map((u) => [u.uid, u.x]));
    tick(s, dt);
    const live = own.filter(isCombatant);
    const back = live.filter((u) => u.backpedaling);
    if (back.length) {
      movingFrames++;
      if (back.length === live.length) allBackFrames++;
    }
    if (
      back.length &&
      live.some((u) => !u.moving && s.time - (u.lastCombatShotAt ?? -100) < 1.4)
    )
      coveredFrames++;
    for (const u of live) {
      if (u.withdrawHeavyUid !== undefined) {
        committed.add(u.uid);
        if (!firstRetreat.has(u.uid)) firstRetreat.set(u.uid, s.time);
      }
      const delta = (u.x - before.get(u.uid)) * dir;
      if (committed.has(u.uid) && s.time > 6 && u.personalMorale >= 35)
        forwardAfter6 += Math.max(0, delta);
      if (u.backpedaling) {
        backward += Math.max(0, -delta);
        assert.equal(u.facing, Math.sign(foe.x - u.x));
        if (s.time > 6) lateRetreat = true;
      }
    }
  }
  return {
    s,
    own,
    foe,
    forwardAfter6,
    backward,
    movingFrames,
    coveredFrames,
    allBackFrames,
    firstRetreat,
    lateRetreat,
  };
}
for (const side of [0, 1]) {
  for (const heavy of ['tank', 'helicopter'])
    test(`side ${side}: 30s unsupported ${heavy} contact cannot restart a forward charge after its first bound`, () => {
      const r = heavyScene(side, heavy);
      assert(
        r.foe.shots + r.foe.secondaryShots > 5,
        'hostile weapon really fires',
      );
      assert(
        r.firstRetreat.size >= 12 && r.backward > 800 && r.movingFrames > 90,
      );
      assert(r.lateRetreat, 'withdrawal continues beyond the old 4.8s window');
      assert(
        r.forwardAfter6 < 1,
        'normal-morale soldiers never turn forward again into the uncountered heavy',
      );
      assert.equal(r.allBackFrames, 0, 'bounds remain phased');
      const survivors = r.own.filter(isCombatant);
      assert(survivors.length >= 4);
      assert(
        Math.max(...survivors.map((u) => u.x)) -
          Math.min(...survivors.map((u) => u.x)) >
          45,
        'safe positions do not collapse onto the range boundary',
      );
      assert(
        survivors.some((u) => u.withdrawStandby),
        'soldiers actually reach a safe observation position',
      );
      if (heavy === 'helicopter')
        assert.equal(
          r.own.reduce((n, u) => n + u.shots - u.member, 0),
          0,
        );
    });
  for (const heavy of ['tank', 'helicopter'])
    test(`side ${side}: matching reinforcements release remembered ${heavy} withdrawal and actually engage`, () => {
      const r = heavyScene(side, heavy, 12),
        live = r.own.filter(isCombatant);
      assert(live.some((u) => u.withdrawHeavyUid !== undefined));
      const support = add(
        r.s,
        side,
        heavy === 'tank' ? 'javelin' : 'manpads',
        1120,
      );
      refreshVision(r.s);
      advance(r.s, 8);
      assert(
        support.some((u) => u.shots > u.member),
        'the new support must bring its real matching weapon to bear',
      );
      assert(
        r.own.filter(isCombatant).some((u) => u.withdrawHeavyUid === undefined),
        'support must release the tactical hold',
      );
      assert(r.foe.hp < r.foe.maxHp);
    });
  test(`side ${side}: default squads follow a moving tank from dispersed rear positions for 30s`, () => {
    const s = arena(side),
      tank = add(s, side, 'tank', 1380)[0],
      own = [
        ...add(s, side, 'infantry', 1240),
        ...add(s, side, 'infantry', 1100),
      ];
    const start = tank.x,
      dir = side ? -1 : 1;
    let maxLead = -Infinity;
    for (let i = 0; i < 30 * 60; i++) {
      tick(s, dt);
      for (const u of own) maxLead = Math.max(maxLead, (u.x - tank.x) * dir);
    }
    assert((tank.x - start) * dir > 400);
    assert(
      own.every(
        (u) => u.escortTankUid === tank.uid && u.squadOrder === undefined,
      ),
    );
    assert(maxLead < 0, 'uncommanded infantry never outruns its tank');
    assert(
      own.every((u) => (tank.x - u.x) * dir > 80 && (tank.x - u.x) * dir < 300),
    );
    assert(
      new Set(own.map((u) => Math.round(u.x / 12))).size >= 5,
      'two squads occupy distinct rear slots',
    );
  });
  test(`side ${side}: escorts fire real volleys at nearby infantry without stepping ahead of their tank`, () => {
    const s = arena(side),
      tank = add(s, side, 'tank', 1380)[0],
      own = add(s, side, 'infantry', 1260),
      foes = add(s, 1 - side, 'infantry', W - 1480);
    s.players[side].order = 'hold';
    assert(setSquadOrder(s, side, own[0].squad, 'escort').ok);
    foes.forEach((u) => {
      u.squadOrder = 'watch';
      u.squadOrderX = u.x;
    });
    refreshVision(s);
    advance(s, 10);
    assert(
      own.some((u) => u.shots > u.member),
      'escorts cannot be a movement-only formation',
    );
    assert(
      own
        .filter(isCombatant)
        .every((u) => (tank.x - u.x) * (side ? -1 : 1) > 70),
    );
  });
  test(`side ${side}: explicit orders survive nearby tanks, attack leaves escort, and escort reselects the nearest tank`, () => {
    const s = arena(side),
      tank = add(s, side, 'tank', 1380)[0],
      own = add(s, side, 'infantry', 1250);
    advance(s, 1);
    assert(own.every((u) => u.escortTankUid === tank.uid));
    for (const order of ['hold', 'watch', 'retreat', 'attack']) {
      assert(setSquadOrder(s, side, own[0].squad, order).ok);
      advance(s, 0.1);
      assert(own.every((u) => u.escortTankUid === undefined));
      assert(own.every((u) => u.squadOrder === order));
    }
    assert(setSquadOrder(s, side, own[0].squad, 'escort').ok);
    assert(own.every((u) => u.escortTankUid === tank.uid));
    const center = own.reduce((n, u) => n + u.x, 0) / own.length;
    spawnUnit(s, side, 'light_tank', center + 25 * (side ? -1 : 1));
    const closer = s.units.at(-1);
    assert(setSquadOrder(s, side, own[0].squad, 'escort').ok);
    assert(own.every((u) => u.escortTankUid === closer.uid));
  });
  test(`side ${side}: a destroyed escort tank releases the slot; manual escorts wait for and acquire a replacement`, () => {
    const s = arena(side),
      tank = add(s, side, 'tank', 1380)[0],
      own = add(s, side, 'infantry', 1250);
    setSquadOrder(s, side, own[0].squad, 'escort');
    advance(s, 3);
    tank.hp = 0;
    advance(s, 7);
    assert(
      own.every(
        (u) => u.escortTankUid === undefined && u.squadOrder === 'escort',
      ),
    );
    const resting = own.map((u) => u.x);
    advance(s, 2);
    own.forEach((u, i) => assert(Math.abs(u.x - resting[i]) < 1));
    const next = add(s, side, 'tank', 1380)[0];
    advance(s, 1);
    assert(own.every((u) => u.escortTankUid === next.uid));
  });
}
test('five distinct squad commands include the manually selectable escort', () => {
  assert.equal(SQUAD_ORDERS.length, 5);
  assert.equal(new Set(SQUAD_ORDERS.map((o) => o.id)).size, 5);
  assert(SQUAD_ORDERS.some((o) => o.id === 'escort'));
});
