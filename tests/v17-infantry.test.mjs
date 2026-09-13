import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createGame,
  startGame,
  spawnUnit,
  tick,
  refreshVision,
  ground,
  W,
  terrainIntercept,
  projectileIntercept,
  isCombatant,
} from '../game/engine.ts';
import { createScenery, obstacleBoxes, traversalBoxes } from '../game/world.ts';
import { setSquadOrder } from '../game/squad-orders.ts';
const dt = 1 / 60;
function arena(seed = 37) {
  const s = createGame(seed);
  startGame(s);
  s.units = [];
  s.walls = [];
  s.scenery = [];
  s.terrain.fill(374);
  s.original.fill(374);
  s.aiIn = 1e9;
  s.players.forEach((p) => (p.order = 'advance'));
  return s;
}
function advance(s, t, each = () => {}) {
  for (let f = 0; f < Math.round(t / dt); f++) {
    tick(s, dt);
    each(f);
  }
}
function squad(s, side, id, x) {
  const n = s.units.length;
  spawnUnit(s, side, id, x);
  const units = s.units.slice(n);
  units.forEach((u) =>
    Object.assign(u, { pace: 1, cooldown: 0, shots: 0, y: 374 }),
  );
  return units;
}
function one(s, side, id, x) {
  const us = squad(s, side, id, x);
  s.units = s.units.filter((u) => !us.slice(1).includes(u));
  Object.assign(us[0], { x, y: 374 });
  return us[0];
}
function shell(
  s,
  {
    side = 1,
    x = 1200,
    tx = 1500,
    life = 2.8,
    total = 2.8,
    damage = 0,
    radius = 48,
  } = {},
) {
  const p = {
    uid: ++s.uid,
    shell: true,
    side,
    x,
    y: 300,
    startX: x,
    startY: 300,
    tx,
    ty: 366,
    total,
    life,
    arc: 170,
    ammunition: 'mortar',
    targetUid: null,
    base: null,
    radius,
    damage,
  };
  s.projectiles.push(p);
  return p;
}
for (const side of [0, 1])
  test(`长队通过房屋、四名前排和坦克残骸，方向 ${side}`, () => {
    const s = arena(),
      dir = side === 0 ? 1 : -1,
      x = (v) => (side === 0 ? v : W - v);
    s.scenery = createScenery(s.terrain, [
      { kind: 'house', x: x(900), seed: 4, building: 0 },
    ]);
    s.wrecks.push({
      id: 99001,
      cardId: 'tank',
      side,
      x: x(980),
      y: 374,
      angle: 0,
      age: 5,
      falling: false,
      vx: 0,
      vy: 0,
    });
    const tank = one(s, side, 'tank', x(800));
    tank.pace = 0;
    const front = squad(s, side, 'javelin', x(950));
    while (front.length < 4) front.push(one(s, side, 'javelin', x(950)));
    front.forEach((u, i) =>
      Object.assign(u, {
        x: x(950),
        lane: (i - 1.5) * 6,
        squadOrder: 'watch',
        squadOrderX: x(950),
        pace: 0,
      }),
    );
    const convoy = [];
    for (let g = 0; g < 5; g++)
      convoy.push(...squad(s, side, 'infantry', x(850 - g * 18)));
    convoy.forEach((u, i) =>
      Object.assign(u, {
        x: x(870 - Math.floor(i / 6) * 26),
        lane: ((i % 6) - 2.5) * 5,
      }),
    );
    // The passage order explicitly overrides automatic following of the parked friendly tank.
    for (const squadId of new Set(convoy.map((u) => u.squad)))
      assert.equal(setSquadOrder(s, side, squadId, 'attack').ok, true);
    let climbing = 0;
    advance(s, 18, () => {
      for (const u of convoy) {
        climbing += Number(u.climbing > 0 || u.motion !== 'ground');
        assert(Math.abs(u.y - ground(s, u.x)) < 0.01);
      }
    });
    const passed = convoy.filter((u) => (u.x - x(1000)) * dir > 0).length;
    assert.equal(climbing, 0);
    assert.equal(
      passed,
      convoy.length,
      `${passed}/${convoy.length} soldiers cleared the full obstruction`,
    );
    assert(front.every((u) => u.x === x(950)));
    assert(obstacleBoxes(s).some((b) => b.wreck));
    assert(obstacleBoxes(s).some((b) => b.prop?.kind === 'house'));
    assert.deepEqual(traversalBoxes(s), []);
    assert(
      terrainIntercept(s, x(780), 340, x(1030), 340),
      'walking corridor preserves hard projectile cover',
    );
  });
for (const side of [0, 1])
  test(`真实小墙贴墙抬脚、墙顶支撑、落地且可反向再翻，方向 ${side}`, () => {
    const s = arena(),
      dir = side === 0 ? 1 : -1,
      x = (v) => (side === 0 ? v : W - v),
      u = one(s, side, 'infantry', x(650));
    s.walls = [
      { uid: 91, x: x(720), width: 24, height: 24, hp: 100, maxHp: 100 },
    ];
    let tops = 0,
      starts = 0,
      beforeClimb = 0;
    advance(s, 5, () => {
      if (u.climbing > 0) {
        starts += Number(!beforeClimb);
        if (Math.abs(u.x - x(720)) < 12) {
          tops++;
          assert(Math.abs(u.y - 349) < 0.01, 'feet stay on the wall top');
        }
        assert(Math.abs(u.x - x(720)) <= 27, 'raised only beside actual wall');
      }
      beforeClimb = u.climbing;
    });
    assert.equal(starts, 1);
    assert(tops > 5);
    assert((u.x - x(750)) * dir > 0);
    assert.equal(u.y, 374);
    u.squadOrder = 'retreat';
    u.squadOrderX = x(650);
    advance(s, 16, () => {
      if (u.climbing > 0 && Math.abs(u.x - x(720)) < 12) assert.equal(u.y, 349);
    });
    assert(Math.abs(u.x - x(650)) <= 12);
    assert.equal(u.squadOrder, 'watch');
    assert.equal(u.moving, false);
    assert.equal(u.y, ground(s, u.x));
    assert(u.passedWalls.filter((id) => id === 91).length >= 2);
  });
test('接敌第一帧压低姿态并先开火，密集成员装填时展开', () => {
  const s = arena(),
    own = squad(s, 0, 'infantry', 1000),
    foes = squad(s, 1, 'infantry', 1310);
  own.forEach((u, i) =>
    Object.assign(u, {
      x: 1000 - i * 9,
      lane: 0,
      decisionIn: 1.5,
      tactic: 'advance',
    }),
  );
  foes.forEach((u, i) =>
    Object.assign(u, {
      x: 1310 + i * 25,
      pace: 0,
      cooldown: 100,
      squadOrder: 'watch',
    }),
  );
  refreshVision(s);
  const starts = own.map((u) => u.x);
  tick(s, dt);
  assert(own.every((u, i) => u.x === starts[i] && u.shots === 1));
  assert(own.every((u) => ['prone', 'crouch'].includes(u.pose)));
  let spread = 0;
  advance(s, 1.8, () => {
    spread = Math.max(spread, ...own.map((u) => Math.abs(u.lane)));
    assert(own.every((u) => u.climbing === 0 && u.motion === 'ground'));
  });
  assert(spread > 3);
  assert(own.some((u, i) => u.x < starts[i] - 3));
  assert(own.reduce((n, u) => n + u.shots, 0) >= 12);
});
test('火炮只在临近落地被附近成员分别察觉，不全队精准同步', () => {
  let reacted = 0,
    eligible = 0;
  const delays = new Set();
  for (let seed = 1; seed <= 16; seed++) {
    const s = arena(seed),
      near = squad(s, 0, 'infantry', 1500),
      far = squad(s, 0, 'infantry', 1840);
    near.forEach((u, i) =>
      Object.assign(u, {
        x: 1480 + i * 8,
        lane: (i - 2.5) * 5,
        squadOrder: 'watch',
      }),
    );
    far.forEach((u, i) =>
      Object.assign(u, { x: 1800 + i * 12, squadOrder: 'watch' }),
    );
    s.uid += seed * 23;
    const p = shell(s),
      starts = near.map((u) => u.x);
    advance(s, 2);
    assert(near.every((u, i) => u.x === starts[i] && !u.evadeUntil));
    advance(s, 0.72, () => {
      for (const u of far)
        assert(!u.evadeUntil, 'distant members do not get the alert');
    });
    reacted += near.filter((u) => u.evadeMarker === p.uid).length;
    eligible += near.length;
    for (const u of near) {
      if (u.evadeMarker === p.uid)
        delays.add(Math.round(u.artilleryReactAt * 100));
      assert(Math.abs(u.x - starts[near.indexOf(u)]) <= 22);
    }
    advance(s, 0.12);
    assert(
      near
        .filter((u) => u.evadeMarker === p.uid)
        .every((u) => u.pose === 'prone' && !u.moving),
    );
  }
  assert(
    reacted > eligible * 0.3 && reacted < eligible * 0.9,
    `${reacted}/${eligible} local perceptions`,
  );
  assert(delays.size > 5);
  console.log(
    `v17 perception: ${reacted}/${eligible} local soldiers noticed; all distant soldiers unaffected`,
  );
});
for (const side of [0, 1])
  test(`优势敌军下交替掩护后撤，显式 watch 禁止追击，方向 ${side}`, () => {
    const s = arena(),
      dir = side === 0 ? 1 : -1,
      x = (v) => (side === 0 ? v : W - v),
      own = squad(s, side, 'infantry', x(1000));
    own.forEach((u, i) =>
      Object.assign(u, {
        x: x(1000 - i * 25),
        personalMorale: 85,
        decisionIn: 0,
        lane: (i % 3) * 6,
      }),
    );
    for (let g = 0; g < 3; g++)
      squad(s, 1 - side, 'infantry', x(1230 + g * 10)).forEach((u, i) =>
        Object.assign(u, {
          x: x(1230 + g * 10 + i * 8),
          squadOrder: 'watch',
          cooldown: 1000,
          pace: 0,
        }),
      );
    refreshVision(s);
    const starts = own.map((u) => u.x),
      moved = new Set();
    let previous = new Map(own.map((u) => [u.uid, u.x]));
    let coverFrames = 0;
    advance(s, 4.8, () => {
      const going = own.filter(
        (u) => u.moving && (u.x - previous.get(u.uid)) * dir < -0.001,
      );
      previous = new Map(own.map((u) => [u.uid, u.x]));
      if (!going.length) return;
      assert(
        going.length < own.filter(isCombatant).length,
        'withdrawal and local spacing never move every surviving member together',
      );
      assert(
        own.some(
          (u) => !u.moving && s.time - (u.lastCombatShotAt ?? -100) < 1.4,
        ),
      );
      coverFrames++;
      for (const u of going) {
        moved.add(u.uid);
        assert.notEqual(u.tactic, 'retreat');
        assert.notEqual(u.pose, 'run');
        assert.equal(u.fire, 0);
        assert.equal(u.facing, u.backpedaling ? dir : -dir);
      }
    });
    assert(coverFrames > 40);
    assert.equal(moved.size, 6);
    assert(
      own.slice(0, 3).some((u, i) => (starts[i] - u.x) * dir > 20),
      'exposed front members actually give ground',
    );
    assert(
      own.reduce((sum, u, i) => sum + (starts[i] - u.x) * dir, 0) / own.length >
        20,
    );
    own.forEach((u) => {
      u.squadOrder = 'watch';
      u.squadOrderX = u.x;
    });
    const held = own.map((u) => u.x);
    advance(s, 1.5);
    assert(own.every((u, i) => u.x === held[i]));
  });
for (const side of [0, 1])
  test(`小队撤退目标优先于全局驻守且不触发溃逃，方向 ${side}`, () => {
    const s = arena(),
      x = (v) => (side === 0 ? v : W - v),
      own = squad(s, side, 'infantry', x(1000));
    s.players[side].order = 'hold';
    own.forEach((u, i) =>
      Object.assign(u, {
        x: x(1000 - i * 25),
        squadOrder: 'retreat',
        squadOrderX: x(750),
        personalMorale: 30,
      }),
    );
    advance(s, 20);
    assert(own.every((u) => Math.abs(u.x - x(750)) <= 12));
    assert(
      own.every(
        (u) => u.squadOrder === 'watch' && !u.moving && u.y === ground(s, u.x),
      ),
    );
    assert(
      own.every(
        (u) => u.tactic !== 'retreat' && !u.conflictChecked && !u.surrendered,
      ),
    );
  });
test('不可见远处敌军不触发散开或优势后撤', () => {
  const s = arena(),
    own = squad(s, 0, 'infantry', 700);
  for (let g = 0; g < 5; g++)
    squad(s, 1, 'infantry', 2500 + g * 20).forEach((u) =>
      Object.assign(u, { pace: 0, cooldown: 1000 }),
    );
  const starts = own.map((u) => u.x);
  advance(s, 1.5);
  assert(own.every((u, i) => u.x > starts[i] + 20));
  assert(
    own.every(
      (u) => !u.withdrawUntil && !u.dispersionUntil && u.tactic === 'advance',
    ),
  );
});
test('间接弹上升穿过房屋，下降仍与掩体相撞', () => {
  const s = arena();
  s.scenery = createScenery(s.terrain, [{ kind: 'house', x: 900, seed: 4 }]);
  const p = shell(s, { x: 800, tx: 1200, total: 3, life: 2.9 });
  assert.equal(projectileIntercept(s, p, 800, 345, 920, 275), null);
  p.life = 0.2;
  assert(projectileIntercept(s, p, 800, 275, 920, 345));
});

for (const side of [0, 1])
  test(`RPG 绕出近身房屋后打坦克，不因卡费误判逃跑，方向 ${side}`, () => {
    const s = arena(),
      x = (v) => (side === 0 ? v : W - v),
      u = one(s, side, 'antiarmor', x(820)),
      enemy = one(s, 1 - side, 'tank', x(1250));
    Object.assign(enemy, { pace: 0, cooldown: 1e4, secondaryCooldown: 1e4 });
    s.scenery = createScenery(s.terrain, [
      { kind: 'house', x: x(950), seed: 4 },
    ]);
    refreshVision(s);
    advance(s, 18, () => {
      assert.equal(u.climbing, 0);
      assert.equal(u.motion, 'ground');
      assert(Math.abs(u.x - enemy.x) >= 140);
    });
    assert(u.shots > 0);
    assert(enemy.hp < enemy.maxHp);
    assert.equal(u.hp, u.maxHp);
    assert(u.tactic !== 'retreat');
  });
