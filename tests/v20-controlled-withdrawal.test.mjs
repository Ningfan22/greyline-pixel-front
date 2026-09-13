import assert from 'node:assert/strict';
import fs from 'node:fs';
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

function scenario(side, heavy, support = false, far = false) {
  const s = createGame(473);
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
  s.knownTerrain = [s.terrain.slice(), s.terrain.slice()];
  s.knownScenery = [{}, {}];
  s.knownWalls = [{}, {}];
  s.players[side].order = 'advance';
  s.players[1 - side].order = 'hold';
  const x = (n) => (side ? W - n : n),
    dir = side ? -1 : 1;
  const add = (team, id, at) => {
    const n = s.units.length;
    spawnUnit(s, team, id, x(at));
    return s.units.slice(n);
  };
  const own = [];
  for (let g = 0; g < 4; g++) {
    const group = add(side, 'infantry', 1200 - g * 50);
    group.forEach((u, i) => {
      u.x = x(1200 - g * 50 - i * 18);
      u.y = 374;
    });
    own.push(...group);
  }
  const supportUnits = support
    ? add(side, heavy === 'tank' ? 'javelin' : 'manpads', 1150)
    : [];
  const enemy = add(1 - side, heavy, far ? 2350 : 1490)[0];
  // Initial reload leaves a window to observe decisions before blast casualties can lower morale.
  enemy.cooldown = enemy.secondaryCooldown = 3;
  refreshVision(s);
  const initial = new Map(own.map((u) => [u.uid, u.x]));
  let backFrames = 0,
    distance = 0,
    snapshots = 0,
    largestMovingGroup = 0,
    saved = null;
  for (let i = 0; i < 5 * 60; i++) {
    const before = new Map(own.map((u) => [u.uid, u.x]));
    tick(s, 1 / 60);
    const live = own.filter(isCombatant),
      back = live.filter((u) => u.backpedaling);
    if (back.length) {
      backFrames++;
      largestMovingGroup = Math.max(largestMovingGroup, back.length);
      for (const u of back) {
        assert(u.moving && u.motion === 'ground' && !u.climbing);
        assert.equal(u.facing, Math.sign(enemy.x - u.x));
        assert((u.x - before.get(u.uid)) * dir < 0);
        assert.equal(u.pose, 'crouch');
        assert.equal(
          u.fire,
          0,
          'backpedaling never invents a shot while moving',
        );
        distance += Math.abs(u.x - before.get(u.uid));
      }
      assert(
        back.length < live.length,
        'some surviving members remain stationary or observing',
      );
      saved ??= structuredClone(s);
      snapshots++;
    }
  }
  return {
    s,
    own,
    supportUnits,
    enemy,
    initial,
    backFrames,
    distance,
    snapshots,
    largestMovingGroup,
    saved,
  };
}

for (const side of [0, 1]) {
  for (const heavy of ['tank', 'helicopter']) {
    test(`side ${side}: unsupported rifles really backpedal from a visible ${heavy}, despite their large headcount`, () => {
      const r = scenario(side, heavy);
      assert(r.backFrames > 20 && r.distance > 50);
      assert(
        r.own.some((u) => (u.withdrawStartedAt ?? 100) < 3),
        'heavy mismatch is recognised before losses reduce rifle numbers',
      );
      if (heavy === 'helicopter')
        assert.equal(
          r.own.reduce((n, u) => n + u.shots - u.member, 0),
          0,
          'ordinary rifles cannot suppress an aircraft',
        );
      if (side === 0 && heavy === 'tank' && process.env.V20_BACKPEDAL_SNAPSHOT)
        fs.writeFileSync(
          process.env.V20_BACKPEDAL_SNAPSHOT,
          JSON.stringify(r.saved),
        );
    });
    test(`side ${side}: real matching support fires and reduces ${heavy} fallback`, () => {
      const bare = scenario(side, heavy),
        supported = scenario(side, heavy, true);
      assert(supported.supportUnits.some((u) => u.shots > u.member));
      assert(supported.distance < bare.distance);
    });
    test(`side ${side}: a distant ${heavy} cannot trigger face-forward retreat`, () => {
      const r = scenario(side, heavy, false, true);
      assert.equal(r.backFrames, 0);
      assert(r.own.every((u) => (u.withdrawUntil ?? 0) <= r.s.time));
    });
  }
  test(`side ${side}: an actual low-morale rout still turns and runs`, () => {
    const s = createGame(474);
    startGame(s);
    s.units = [];
    s.scenery = [];
    s.walls = [];
    s.aiIn = 1e9;
    s.terrain.fill(374);
    s.original.fill(374);
    s.players.forEach((p) => (p.order = 'advance'));
    const x = (n) => (side ? W - n : n),
      dir = side ? -1 : 1;
    spawnUnit(s, side, 'infantry', x(1300), { member: 0 });
    const u = s.units[0];
    spawnUnit(s, 1 - side, 'tank', x(1550));
    const enemy = s.units.at(-1);
    enemy.cooldown = 999;
    u.personalMorale = 25;
    u.decisionIn = 0;
    refreshVision(s);
    const before = u.x;
    tick(s, 1 / 60);
    assert.equal(u.tactic, 'retreat');
    assert.equal(u.pose, 'run');
    assert.equal(u.facing, -dir);
    assert.equal(u.backpedaling, false);
    assert((u.x - before) * dir < 0);
  });
}
