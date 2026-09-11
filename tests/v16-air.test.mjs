import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  createGame,
  startGame,
  playCard,
  spawnUnit,
  tick,
  setOrder,
  refreshVision,
  visibleToSide,
  isCombatant,
  ground,
  CARDS,
  W,
} from '../game/engine.ts';
import { createScenery, traversalBoxes } from '../game/world.ts';

const DT = 1 / 60;
const metrics = [],
  failures = [];
function check(name, fn) {
  try {
    const result = fn();
    metrics.push({ name, ...result });
    console.log('PASS', name, JSON.stringify(result));
  } catch (error) {
    failures.push({ name, error: error.stack });
    console.error('FAIL', name, error.stack);
  }
}
function arena() {
  const s = createGame(1637);
  startGame(s);
  s.aiIn = 1e6;
  s.terrain.fill(374);
  s.original.fill(374);
  s.scenery = [];
  s.walls = [];
  setOrder(s, 0, 'hold');
  setOrder(s, 1, 'hold');
  return s;
}
function advance(s, seconds, sample = () => {}) {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    tick(s, DT);
    sample();
  }
}
function until(s, predicate, seconds, sample = () => {}) {
  for (let i = 0; i < Math.round(seconds / DT) && !predicate(); i++) {
    tick(s, DT);
    sample();
  }
  assert.ok(predicate(), `condition not reached by ${s.time.toFixed(2)}s`);
}
function deploy(s, side, id, x) {
  const p = s.players[side];
  // Explicit test hand; public playCard still enforces the card's actual fee and deployment path.
  const token = { id, uid: ++s.uid };
  p.hand = [token];
  const before = p.energy;
  const result = playCard(s, side, token.uid, x);
  assert.equal(result.ok, true, result.message);
  assert.equal(before - p.energy, CARDS[id].cost);
  return { u: s.units.at(-1), token };
}
function spawn(s, side, id, x) {
  const before = s.units.length;
  spawnUnit(s, side, id, x);
  return s.units.slice(before);
}
function passive(units) {
  for (const u of units) {
    u.cooldown = 1e6;
    u.secondaryCooldown = 1e6;
  }
}
function samBattery(s, side, x, count = 4) {
  const guns = Array.from(
    { length: count },
    (_, i) => spawn(s, side, 'sam_vehicle', x + i * 3)[0],
  );
  refreshVision(s);
  return guns;
}
const troopers = (s, side) =>
  s.units.filter((u) => u.side === side && u.id === 'paratroopers');

for (const side of [0, 1]) {
  const enemy = 1 - side,
    dir = side === 0 ? 1 : -1,
    x = (value) => (side === 0 ? value : W - value);
  check(
    `side${side}: FPV pays2 at HQ, approaches without teleport, never attacks an HQ`,
    () => {
      const s = arena(),
        { u, token } = deploy(s, side, 'fpv_drone', x(2000));
      assert.equal(CARDS.fpv_drone.cost, 2);
      assert.equal(u.x, x(112));
      let maxStep = 0,
        previous = u.x;
      advance(s, 25, () => {
        maxStep = Math.max(maxStep, Math.abs(u.x - previous));
        previous = u.x;
      });
      assert.ok(maxStep <= CARDS.fpv_drone.speed * DT + 1e-6);
      assert.ok(u.hp > 0);
      assert.equal(u.fpvLock, undefined);
      assert.equal(u.shots, 0);
      assert.deepEqual(
        s.players.map((p) => p.hp),
        [1000, 1000],
      );
      assert.equal(s.wrecks.length, 0);
      assert.equal(s.blasts.length, 0);
      assert.ok(s.players[side].discard.includes(token));
      return { position: u.x, maxStep, baseHp: s.players.map((p) => p.hp) };
    },
  );
  check(
    `side${side}: FPV prefers farther armor, physically dives, impacts once with small blast and persistent wreck`,
    () => {
      const s = arena(),
        u = spawn(s, side, 'fpv_drone', x(1000))[0];
      const foot = spawn(s, enemy, 'infantry', x(1330)),
        tank = spawn(s, enemy, 'ifv', x(1460))[0];
      passive([...foot, tank]);
      refreshVision(s);
      until(s, () => !!u.fpvLock, 1);
      assert.equal(u.fpvLock.uid, tank.uid);
      const atLock = { x: u.x, y: u.y },
        hp = tank.hp;
      assert.equal(u.destroyed, false);
      assert.equal(tank.hp, hp);
      let maxStep = 0,
        previous = { x: u.x, y: u.y },
        maxRadius = 0;
      until(
        s,
        () => u.destroyed,
        5,
        () => {
          maxStep = Math.max(
            maxStep,
            Math.hypot(u.x - previous.x, u.y - previous.y),
          );
          previous = { x: u.x, y: u.y };
          maxRadius = Math.max(maxRadius, ...s.blasts.map((b) => b.radius), 0);
        },
      );
      assert.ok(maxStep <= 260 * DT + 1e-6);
      assert.ok(tank.hp < hp - 100);
      assert.equal(
        s.units.some((v) => v.uid === u.uid),
        false,
      );
      assert.equal(
        s.projectiles.some((p) => p.sourceUid === u.uid),
        false,
      );
      assert.equal(u.shots, 0);
      const wreck = s.wrecks.find((w) => w.id === u.uid);
      assert.ok(wreck);
      assert.equal(wreck.cardId, 'fpv_drone');
      assert.ok(maxRadius <= 18, `FPV blast unexpectedly large: ${maxRadius}`);
      const remainingHp = tank.hp;
      advance(s, 5);
      assert.equal(tank.hp, remainingHp);
      assert.equal(s.wrecks.filter((w) => w.id === u.uid).length, 1);
      return {
        atLock,
        impactAt: { x: wreck.x, y: wreck.y },
        damage: hp - tank.hp,
        maxStep,
        maxRadius,
      };
    },
  );
  check(
    `side${side}: FPV impact beside the enemy HQ does not damage the HQ`,
    () => {
      const s = arena(),
        u = spawn(s, side, 'fpv_drone', x(W - 450))[0],
        target = spawn(s, enemy, 'ifv', x(W - 112))[0];
      passive([target]);
      refreshVision(s);
      until(s, () => u.destroyed, 5);
      assert.ok(target.hp < target.maxHp);
      assert.deepEqual(
        s.players.map((p) => p.hp),
        [1000, 1000],
      );
      return {
        targetDamage: target.maxHp - target.hp,
        baseHp: s.players.map((p) => p.hp),
      };
    },
  );
  check(
    `side${side}: FPV cannot acquire a hidden target or follow hidden position updates`,
    () => {
      const s = arena(),
        u = spawn(s, side, 'fpv_drone', x(1000))[0],
        target = spawn(s, enemy, 'ifv', x(1440))[0];
      passive([target]);
      s.smokes = [{ side: enemy, x: x(1240), life: 10 }];
      refreshVision(s);
      assert.equal(visibleToSide(s, side, target), false);
      advance(s, 0.4);
      assert.equal(u.fpvLock, undefined);
      s.smokes = [];
      refreshVision(s);
      tick(s, DT);
      assert.equal(u.fpvLock.uid, target.uid);
      const last = { ...u.fpvLock };
      target.x = x(1840);
      target.y = ground(s, target.x);
      s.smokes = [{ side: enemy, x: x(1460), life: 10 }];
      refreshVision(s);
      assert.equal(visibleToSide(s, side, target), false);
      advance(s, 0.35);
      assert.deepEqual(u.fpvLock, last);
      until(s, () => u.destroyed, 5);
      assert.equal(target.hp, target.maxHp);
      return { rememberedX: last.x, hiddenX: target.x, targetHp: target.hp };
    },
  );
  check(
    `side${side}: a house physically intercepts FPV before its locked target`,
    () => {
      const s = arena(),
        u = spawn(s, side, 'fpv_drone', x(1000))[0],
        target = spawn(s, enemy, 'ifv', x(1450))[0];
      passive([target]);
      refreshVision(s);
      until(s, () => !!u.fpvLock, 1);
      s.scenery = createScenery(s.terrain, [
        { x: x(1230), kind: 'house', building: 1, seed: 37 },
      ]);
      refreshVision(s);
      until(s, () => u.destroyed, 5);
      assert.equal(target.hp, target.maxHp);
      const w = s.wrecks.find((w) => w.id === u.uid);
      assert.ok(w);
      assert.ok((w.x - x(1400)) * dir < 0);
      return { impactX: w.x, targetHp: target.hp };
    },
  );
  check(`side${side}: a standing wall intercepts the final FPV dive`, () => {
    const s = arena(),
      u = spawn(s, side, 'fpv_drone', x(1000))[0],
      target = spawn(s, enemy, 'ifv', x(1460))[0];
    passive([target]);
    refreshVision(s);
    until(s, () => !!u.fpvLock, 1);
    s.walls = [{ uid: ++s.uid, x: x(1390), width: 20, height: 65, hp: 100 }];
    until(s, () => u.destroyed, 5);
    const w = s.wrecks.find((w) => w.id === u.uid);
    assert.ok(w);
    assert.ok(
      Math.abs(w.x - x(1390)) <= 14,
      `impact x=${w.x}, wall x=${x(1390)}`,
    );
    assert.equal(target.hp, target.maxHp);
    return { impactX: w.x, targetHp: target.hp };
  });
  check(
    `side${side}: real SAM projectile can destroy FPV before impact`,
    () => {
      const s = arena(),
        u = spawn(s, side, 'fpv_drone', x(1000))[0];
      const gun = spawn(s, enemy, 'sam_vehicle', x(1730))[0];
      refreshVision(s);
      let missileSeen = false;
      until(
        s,
        () => u.destroyed,
        8,
        () => {
          missileSeen ||= s.projectiles.some(
            (p) => p.sourceUid === gun.uid && p.guided,
          );
        },
      );
      assert.ok(missileSeen);
      assert.equal(gun.hp, gun.maxHp);
      assert.equal(s.players[enemy].kills, 1);
      assert.ok(s.wrecks.some((w) => w.id === u.uid));
      return { destroyedAt: s.time, gunShots: gun.shots, gunHp: gun.hp };
    },
  );
  check(
    `side${side}: transport flies from HQ, drops five separate people in order, then exits without burst or return card`,
    () => {
      const s = arena(),
        { u, token } = deploy(s, side, 'air_assault', x(1350));
      assert.equal(CARDS.air_assault.cost, 5);
      assert.equal(u.x, x(112));
      assert.equal(troopers(s, side).length, 0);
      assert.equal(u.airlift.x, x(1350));
      advance(s, 2);
      assert.equal(troopers(s, side).length, 0);
      assert.ok((u.x - x(112)) * dir > 200);
      assert.ok((u.x - x(112)) * dir <= 440 + 1e-6);
      const drops = [],
        seen = new Set();
      let maxStep = 0,
        previous = { x: u.x, y: u.y };
      until(
        s,
        () => u.airlift.phase === 'exit',
        16,
        () => {
          maxStep = Math.max(
            maxStep,
            Math.hypot(u.x - previous.x, u.y - previous.y),
          );
          previous = { x: u.x, y: u.y };
          for (const member of troopers(s, side))
            if (!seen.has(member.uid)) {
              seen.add(member.uid);
              drops.push({
                uid: member.uid,
                member: member.member,
                squad: member.squad,
                time: s.time,
                x: member.x,
                y: member.y,
                ground: ground(s, member.x),
                facing: member.facing,
                hp: member.hp,
              });
              assert.ok(member.rappelling);
              assert.ok(member.y < ground(s, member.x) - 30);
              assert.equal(member.facing, dir);
              assert.equal(member.fire, 0);
              assert.equal(member.rapidUntil, 0);
            }
          assert.equal(u.shots, 0);
          if (u.airlift.phase === 'exit')
            assert(
              troopers(s, side).every((v) => !v.rappelling),
              'transport waits for the final rope to clear',
            );
          assert.equal(u.secondaryShots, 0);
          assert.equal(
            s.projectiles.some((p) => p.sourceUid === u.uid),
            false,
          );
        },
      );
      assert.equal(drops.length, 5);
      assert.deepEqual(
        drops.map((d) => d.member),
        [0, 1, 2, 3, 4],
      );
      assert.equal(new Set(drops.map((d) => d.squad)).size, 1);
      assert.equal(new Set(drops.map((d) => d.x)).size, 5);
      assert.equal(
        drops.reduce((n, d) => n + d.hp, 0),
        220,
      );
      for (let i = 1; i < 5; i++) {
        assert.ok(drops[i].time - drops[i - 1].time >= 0.84);
        assert.ok((drops[i].x - drops[i - 1].x) * dir > 0);
      }
      assert.ok(maxStep <= 220 * DT + 1e-6);
      const explosions = s.explosions;
      until(s, () => !s.units.includes(u), 16);
      assert.equal(s.explosions, explosions);
      assert.equal(
        s.wrecks.some((w) => w.id === u.uid),
        false,
      );
      assert.equal(
        s.players[side].hand.some((h) => h.uid === token.uid),
        false,
      );
      assert.equal(
        s.players[side].discard.filter((h) => h.uid === token.uid).length,
        1,
      );
      assert.equal(token.returnedOnce, undefined);
      assert.equal(troopers(s, side).length, 5);
      assert.ok(
        troopers(s, side).every((v) => !v.rappelling && v.y === ground(s, v.x)),
      );
      return { drops, exitAt: s.time, maxStep, explosions };
    },
  );
  check(
    `side${side}: transport never fires even with a visible nearby enemy`,
    () => {
      const s = arena(),
        { u } = deploy(s, side, 'air_assault', x(1000));
      const target = spawn(s, enemy, 'ifv', x(600))[0];
      passive([target]);
      refreshVision(s);
      advance(s, 3);
      assert.equal(u.shots, 0);
      assert.equal(u.secondaryShots, 0);
      assert.equal(target.hp, target.maxHp);
      assert.equal(
        s.projectiles.some((p) => p.sourceUid === u.uid),
        false,
      );
      return { targetHp: target.hp, shots: u.shots, x: u.x };
    },
  );
  check(
    `side${side}: shooting transport before unloading loses all cargo`,
    () => {
      const s = arena(),
        { u } = deploy(s, side, 'air_assault', x(1550));
      const guns = samBattery(s, enemy, x(700));
      until(s, () => u.destroyed, 6);
      assert.equal(u.airlift.dropped, 0);
      assert.equal(troopers(s, side).length, 0);
      const deadAt = s.time;
      advance(s, 12);
      assert.equal(troopers(s, side).length, 0);
      assert.ok(s.wrecks.some((w) => w.id === u.uid));
      return {
        deadAt,
        shots: guns.reduce((n, g) => n + g.shots, 0),
        dropped: u.airlift.dropped,
      };
    },
  );
  check(
    `side${side}: shooting transport mid-unload loses only people still aboard`,
    () => {
      const s = arena(),
        { u } = deploy(s, side, 'air_assault', x(1350));
      until(s, () => u.airlift.dropped === 2, 15);
      const initialIds = troopers(s, side).map((v) => v.uid);
      samBattery(s, enemy, u.x + dir * 300, 8);
      until(s, () => u.destroyed, 5);
      const dropped = u.airlift.dropped,
        ids = troopers(s, side).map((v) => v.uid);
      assert.ok(dropped >= 2 && dropped < 5);
      assert.ok(initialIds.every((id) => ids.includes(id)));
      advance(s, 8);
      assert.equal(troopers(s, side).length, dropped);
      assert.ok(troopers(s, side).every((v) => v.hp > 0 && !v.rappelling));
      return {
        dropped,
        survivors: troopers(s, side).map((v) => v.uid),
        destroyedAt: s.time - 8,
      };
    },
  );
  check(
    `side${side}: landing bounds and invalid targets preserve legal costs`,
    () => {
      const landings = [];
      for (const request of [0, W]) {
        const s = arena(),
          { u } = deploy(s, side, 'air_assault', request);
        landings.push(u.airlift.x);
        assert.ok(u.airlift.x >= 480 && u.airlift.x <= W - 480);
      }
      for (const request of [-1, W + 1, NaN, Infinity]) {
        const s = arena(),
          p = s.players[side],
          token = { id: 'air_assault', uid: ++s.uid };
        p.hand = [token];
        const energy = p.energy;
        assert.equal(playCard(s, side, token.uid, request).ok, false);
        assert.equal(p.energy, energy);
        assert.ok(p.hand.includes(token));
        assert.equal(s.units.length, 0);
      }
      return { landings };
    },
  );
  check(
    `side${side}: landing clears a full house and a standing wall before any rope is lowered`,
    () => {
      const s = arena();
      s.scenery = createScenery(s.terrain, [
        { x: x(1350), kind: 'house', building: 1, seed: 37 },
      ]);
      s.walls = [{ uid: ++s.uid, x: x(1580), width: 32, height: 45, hp: 100 }];
      const { u } = deploy(s, side, 'air_assault', x(1350));
      const landing = u.airlift.x;
      const blocked = (at) =>
        traversalBoxes(s).some(
          (b) =>
            b.x < at + 12 &&
            b.x + b.w > at - 12 &&
            ground(s, b.x + b.w / 2) - b.y > 26,
        ) ||
        s.walls.some((w) => w.hp > 0 && Math.abs(w.x - at) < w.width / 2 + 12);
      assert.notEqual(landing, x(1350));
      const drops = [];
      until(
        s,
        () => u.airlift.dropped === 5,
        22,
        () => {
          for (const v of troopers(s, side))
            if (!drops.includes(v.uid)) {
              assert.equal(blocked(v.x), false, `rope at obstructed x=${v.x}`);
              drops.push(v.uid);
            }
        },
      );
      return { requested: x(1350), landing, drops: drops.length };
    },
  );
}
const out = path.resolve('output/v16-qa');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(
  path.join(out, 'air-results.json'),
  JSON.stringify({ passed: metrics.length, failures, metrics }, null, 2),
);
console.log(`V16 AIR ${metrics.length} passed, ${failures.length} failed`);
if (failures.length) process.exitCode = 1;
