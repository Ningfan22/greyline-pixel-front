import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createGame,
  startGame,
  spawnUnit,
  tick,
  ground,
  muzzlePoint,
  explode,
  terrainIntercept,
  W,
} from '../game/engine.ts';
import { setSquadOrder } from '../game/squad-orders.ts';
import { CARDS } from '../game/cards.ts';
import { infantryGeometry } from '../game/infantry-geometry.ts';
import { FLIGHT } from '../game/ballistics.ts';

const DT = 1 / 60;
const POSES = ['idle', 'crouch', 'prone'];

// This is a controlled weapon/earth experiment: construction and damage run the
// real engine. Fix only the requested posture; no HP, cover, terrain profile,
// weapon damage or injury probability is changed by the fixture. The range
// experiment aims at the target's depth center; tactical tests cover real aim spread.
function fixture(seed, side, dug, pose) {
  const s = createGame(seed);
  startGame(s);
  s.units = [];
  s.scenery = [];
  s.walls = [];
  s.wrecks = [];
  s.terrain.fill(374);
  s.original.fill(374);
  s.aiIn = 1e9;
  s.players.forEach((p) => (p.order = 'hold'));
  const dir = side === 0 ? 1 : -1;
  const center = side === 0 ? 1500 : W - 1500;
  spawnUnit(s, side, 'infantry', center);
  const members = [...s.units];
  members.forEach((u, i) =>
    Object.assign(u, {
      x: center + (i - 2.5) * 38,
      y: 374,
      cooldown: 1e9,
      secondaryCooldown: 1e9,
    }),
  );
  const initialHP = members.map((u) => u.hp);
  assert(setSquadOrder(s, side, members[0].squad, dug ? 'hold' : 'watch').ok);
  for (let frame = 0; frame < 840; frame++) tick(s, DT);
  assert.deepEqual(
    members.map((u) => u.hp),
    initialHP,
  );
  const trench = s.entrenchments?.[0];
  if (dug) {
    assert(trench?.built, 'the squad must actually complete construction');
    assert.equal(ground(s, center), 410);
  } else assert.equal(ground(s, center), 374);

  const u = members[2];
  s.units = [u];
  Object.assign(u, {
    x: center,
    y: ground(s, center),
    pose,
    moving: false,
    motion: 'ground',
    climbing: 0,
    squadOrder: 'watch',
    squadOrderX: center,
    cooldown: 1e9,
    secondaryCooldown: 1e9,
  });
  spawnUnit(s, 1 - side, 'infantry', center + dir * 300, { member: 0 });
  const shooter = s.units.at(-1);
  Object.assign(shooter, { x: center + dir * 300, y: 374, pose: 'idle' });
  // The range source remains an ordinary spawned rifleman. Remove only its AI
  // turn so the target cannot change posture to shoot back during this trial.
  s.units = [u];
  return { s, u, shooter, pose, side, dir, center, trench };
}

function rifleRound(f) {
  const { s, u, shooter } = f;
  const point = muzzlePoint(shooter, u.x);
  const total = Math.max(
    FLIGHT.rifle.minimum,
    Math.abs(u.x - point.x) / FLIGHT.rifle.speed,
  );
  const before = u.hp;
  const blocked = terrainIntercept(
    s,
    point.x,
    point.y,
    u.x,
    u.y - infantryGeometry(u).bodyHeight,
    true,
    true,
  );
  s.projectiles.push({
    uid: ++s.uid,
    sourceUid: shooter.uid,
    startX: point.x,
    startY: point.y,
    x: point.x,
    y: point.y,
    tx: u.x,
    ty: u.y - infantryGeometry(u).bodyHeight,
    side: shooter.side,
    targetUid: u.uid,
    base: null,
    startLane: shooter.lane,
    targetLane: u.lane,
    damage: CARDS.infantry.damage / CARDS.infantry.members,
    ammunition: 'rifle',
    arc: 0,
    radius: 0,
    total,
    life: total,
  });
  for (let frame = 0; frame < 60; frame++) {
    if (!u.wounded && u.hp > 0)
      Object.assign(u, {
        pose: f.pose,
        tactic: f.pose === 'idle' ? 'advance' : f.pose,
        decisionIn: 1e9,
        contactScanAt: 1e9,
      });
    tick(s, DT);
  }
  return { damage: before - u.hp, blocked: !!blocked };
}

function detonate(f, x, y) {
  const before = f.u.hp;
  explode(
    f.s,
    x,
    y,
    CARDS.barrage.radius,
    CARDS.barrage.damage,
    1 - f.side,
    1,
    1,
    'artillery',
  );
  return before - f.u.hp;
}

function outcome(f) {
  return {
    hp: f.u.hp,
    morale: f.u.personalMorale,
    suppression: f.u.suppression,
    alive: f.u.hp > 0,
    combatReady: f.u.hp > 0 && !f.u.wounded,
  };
}

for (const side of [0, 1]) {
  for (const pose of POSES) {
    test(`real constructed trench reduces rifle damage without extra HP: side ${side}, ${pose}`, () => {
      const open = fixture(13, side, false, pose);
      const dug = fixture(13, side, true, pose);
      const openRound = rifleRound(open);
      const dugRound = rifleRound(dug);
      assert(openRound.damage > 0);
      assert(dugRound.damage < openRound.damage);
      assert.equal(dug.u.maxHp, open.u.maxHp);
      assert(dug.u.personalMorale >= open.u.personalMorale);
      assert(dug.u.suppression <= open.u.suppression);
      if (dugRound.blocked)
        assert.equal(
          dugRound.damage,
          0,
          'actual soil interception prevents a hit',
        );
    });

    test(`soil protects against an outside ground burst but never grants blast immunity: side ${side}, ${pose}`, () => {
      const dug = fixture(13, side, true, pose);
      const open = fixture(13, side, false, pose);
      // Same x and shell position. The entrenchment is produced by the order,
      // and the soldier takes a real station inside its enemy-facing floor.
      const station =
        dug.center + dug.dir * Math.max(0, dug.trench.innerRadius - 2);
      for (const f of [dug, open])
        Object.assign(f.u, { x: station, y: ground(f.s, station) });
      const x = dug.center + dug.dir * (dug.trench.radius + 2);
      const openDamage = detonate(open, x, ground(open.s, x));
      const dugDamage = detonate(dug, x, ground(dug.s, x));
      assert(
        openDamage > 0,
        'outside burst must actually reach the test station',
      );
      assert(dugDamage > 0, 'an earth bank does not make artillery harmless');
      assert(
        dugDamage < openDamage,
        'real foreground earth must reduce damage',
      );
      assert(dug.u.personalMorale > open.u.personalMorale);
      assert(dug.u.suppression < open.u.suppression);
      console.log(
        'TRENCH_OUTSIDE_BLAST',
        JSON.stringify({
          side,
          pose,
          openDamage,
          dugDamage,
          open: outcome(open),
          dug: outcome(dug),
        }),
      );
    });

    test(`a shell landing inside the shared floor and an unobstructed airburst retain damage: side ${side}, ${pose}`, () => {
      for (const airburst of [false, true]) {
        const open = fixture(7, side, false, pose);
        const dug = fixture(7, side, true, pose);
        const impacts = [open, dug].map((f) => {
          const x = f.u.x + f.dir * (airburst ? 0 : 8);
          return detonate(f, x, ground(f.s, x) - (airburst ? 50 : 0));
        });
        assert(impacts[0] > 0);
        assert(
          Math.abs(impacts[0] - impacts[1]) < 1e-9,
          'a trench badge alone must not grant blast protection',
        );
        console.log(
          'TRENCH_INSIDE_BLAST',
          JSON.stringify({
            side,
            pose,
            airburst,
            impacts,
            open: outcome(open),
            dug: outcome(dug),
          }),
        );
      }
    });
  }

  test(`six-shot posture matrix preserves more HP and morale across injury seeds: side ${side}`, () => {
    const rows = [];
    for (const pose of POSES)
      for (const dug of [false, true]) {
        const sum = { hits: 0, hp: 0, morale: 0, alive: 0, combatReady: 0 };
        for (const seed of [1, 7, 13, 29, 61, 97]) {
          const f = fixture(seed, side, dug, pose);
          for (let round = 0; round < 6 && f.u.hp > 0 && !f.u.wounded; round++)
            sum.hits += Number(rifleRound(f).damage > 0);
          const result = outcome(f);
          for (const key of ['hp', 'morale', 'alive', 'combatReady'])
            sum[key] += Number(result[key]);
        }
        rows.push({ pose, dug, ...sum });
      }
    for (const pose of POSES) {
      const [open, dug] = rows.filter((row) => row.pose === pose);
      assert(dug.hp > open.hp);
      assert(dug.morale > open.morale);
      assert(dug.alive >= open.alive);
      assert(dug.combatReady >= open.combatReady);
    }
    console.log(
      'TRENCH_RIFLE_MATRIX',
      JSON.stringify({ side, seeds: 6, rounds: 6, rows }),
    );
  });
}
