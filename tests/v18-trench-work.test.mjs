import assert from 'node:assert/strict';
import {
  createGame,
  startGame,
  spawnUnit,
  tick,
  crater,
  ground,
} from '../game/engine.ts';
import { setSquadOrder, terrainDepthLimit } from '../game/squad-orders.ts';
const DT = 1 / 60,
  metrics = [];
function check(name, fn) {
  const value = fn();
  metrics.push({ name, ...value });
  console.log('PASS', name, JSON.stringify(value));
}
function arena() {
  const s = createGame(18);
  startGame(s);
  s.aiIn = 1e6;
  s.terrain.fill(374);
  s.original.fill(374);
  s.scenery = [];
  s.walls = [];
  return s;
}
function spawn(s, side, id, x) {
  const n = s.units.length;
  spawnUnit(s, side, id, x);
  return s.units.slice(n);
}
function run(s, secs, sample = () => {}) {
  for (let i = 0; i < Math.round(secs / DT); i++) {
    tick(s, DT);
    sample();
  }
}
function dig(s, us, limit = 20) {
  assert.ok(setSquadOrder(s, us[0].side, us[0].squad, 'hold').ok);
  const t = s.entrenchments[0],
    worked = new Set();
  let previousProgress = t.progress,
    climbs = 0,
    maxStep = 0;
  const last = new Map(us.map((u) => [u.uid, u.x]));
  for (
    let i = 0;
    i < limit / DT &&
    (!t.built || us.some((u) => Math.abs(u.x - u.squadOrderX) > 1));
    i++
  ) {
    tick(s, DT);
    let active = 0;
    for (const u of us) {
      maxStep = Math.max(maxStep, Math.abs(u.x - last.get(u.uid)));
      last.set(u.uid, u.x);
      climbs += Number(u.climbing > 0 || u.motion !== 'ground');
      if (u.digging) {
        active++;
        worked.add(u.uid);
        assert.ok(!u.moving && u.fire === 0 && u.secondaryFire === 0);
        assert.ok(Math.abs(u.x - u.squadOrderX) <= 1);
        assert.ok(Math.abs(u.lane - u.holdLane) <= 0.5);
      }
    }
    if (us.length > 3) {
      assert.ok(
        active <= 3,
        'at most one row of three soldiers digs at a time',
      );
      assert.ok(
        new Set(us.filter((u) => u.digging).map((u) => u.holdLane)).size <= 1,
        'neighbouring rows take separate work shifts',
      );
    }
    const expected = Math.min(
      1,
      previousProgress + (DT / 6) * Math.min(1, active / 2),
    );
    assert.ok(
      Math.abs(t.progress - expected) < 1e-7,
      'only actual working animation advances construction',
    );
    previousProgress = t.progress;
  }
  assert.ok(
    t.built,
    'shared trench completes within movement + construction deadline',
  );
  assert.equal(climbs, 0);
  assert.ok(maxStep < 3);
  return { t, worked, maxStep };
}
for (const side of [0, 1]) {
  check(
    `side${side}: six members walk into one 103px trench, work in three columns and two depth lanes`,
    () => {
      const s = arena(),
        us = spawn(s, side, 'infantry', side ? 2350 : 1450),
        before = us.map((u) => u.x),
        hp = us.map((u) => u.hp);
      setSquadOrder(s, side, us[0].squad, 'hold');
      assert.deepEqual(
        us.map((u) => u.x),
        before,
        'order does not teleport',
      );
      assert.equal(s.entrenchments.length, 1);
      assert.equal(new Set(us.map((u) => u.squadOrderX)).size, 3);
      assert.deepEqual(
        [...new Set(us.map((u) => u.holdLane))].sort((a, b) => a - b),
        [-20, 20],
      );
      const columns = [...new Set(us.map((u) => u.squadOrderX))].sort(
        (a, b) => a - b,
      );
      assert.ok(
        columns
          .slice(1)
          .every((x, i) => x - columns[i] >= 20 && x - columns[i] <= 22),
      );
      const { t, worked, maxStep } = dig(s, us);
      assert.ok(t.radius * 2 >= 100 && t.radius * 2 <= 105);
      assert.ok(t.innerRadius * 2 >= 48 && t.innerRadius * 2 <= 54);
      assert.equal(worked.size, 6);
      assert.deepEqual(
        us.map((u) => u.hp),
        hp,
      );
      assert.ok(us.every((u) => Math.abs(ground(s, u.x) - t.floorY) < 1e-6));
      assert.equal(s.mines.length, 2);
      return {
        width: t.radius * 2,
        floor: t.innerRadius * 2,
        seconds: s.time,
        maxStep,
        worked: worked.size,
      };
    },
  );
  check(
    `side${side}: compact trench fires at enemies 300px away and all troops leave over banks without climbing`,
    () => {
      const s = arena(),
        us = spawn(s, side, 'infantry', side ? 2350 : 1450),
        dir = side ? -1 : 1;
      const { t } = dig(s, us);
      const at = us.map((u) => u.x),
        before = us.map((u) => u.shots),
        enemies = spawn(s, 1 - side, 'infantry', t.x + dir * 300);
      for (const u of enemies) {
        u.cooldown = u.secondaryCooldown = 1e6;
        u.pace = 0;
      }
      s.players[1 - side].order = 'hold';
      let climbs = 0;
      run(s, 5, () => {
        climbs += us.filter(
          (u) => u.climbing > 0 || u.motion === 'bank',
        ).length;
        assert.ok(us.every((u) => !u.digging));
      });
      assert.ok(
        us.every((u, i) => u.shots > before[i]),
        'every completed defender actually fires out',
      );
      assert.ok(
        us.every((u, i) => Math.abs(u.x - at[i]) < 1),
        'defenders do not climb out to obtain a firing ray',
      );
      s.units = us;
      setSquadOrder(s, side, us[0].squad, 'attack');
      run(
        s,
        20,
        () =>
          (climbs += us.filter(
            (u) => u.climbing > 0 || u.motion !== 'ground',
          ).length),
      );
      assert.equal(climbs, 0);
      assert.ok(us.every((u) => (u.x - t.x) * dir > t.radius + 20));
      return { shots: us.map((u, i) => u.shots - before[i]), climbs };
    },
  );
  check(
    `side${side}: combat interrupts real construction and digging resumes only after contact clears`,
    () => {
      const s = arena(),
        us = spawn(s, side, 'infantry', side ? 2350 : 1450),
        dir = side ? -1 : 1;
      setSquadOrder(s, side, us[0].squad, 'hold');
      const t = s.entrenchments[0];
      for (let i = 0; i < 600 && t.progress < 0.25; i++) tick(s, DT);
      assert.ok(t.progress >= 0.25 && t.progress < 0.5);
      const enemies = spawn(s, 1 - side, 'infantry', t.x + dir * 300);
      for (const u of enemies) {
        u.cooldown = u.secondaryCooldown = 1e6;
        u.pace = 0;
      }
      s.players[1 - side].order = 'hold';
      s.visionIn = 0;
      const progress = t.progress,
        elapsed = us.map((u) => u.digElapsed),
        shots = us.map((u) => u.shots);
      run(s, 3, () => assert.ok(us.every((u) => !u.digging)));
      assert.equal(t.progress, progress);
      assert.deepEqual(
        us.map((u) => u.digElapsed),
        elapsed,
      );
      assert.ok(us.some((u, i) => u.shots > shots[i]));
      s.units = us;
      run(s, 12);
      assert.ok(t.built);
      return { pausedAt: progress, resumed: true };
    },
  );
}
check(
  'prepared narrow earth banks survive crater smoothing while ordinary craters keep the shallow cap',
  () => {
    const s = arena(),
      us = spawn(s, 0, 'infantry', 1450);
    const { t } = dig(s, us),
      before = s.terrain.slice();
    crater(s, t.x, 36, 10);
    for (let x = Math.ceil(t.x - t.radius); x <= t.x + t.radius; x++)
      assert.ok(
        s.terrain[x] >= before[x] - 1e-6,
        `prepared bank refilled at ${x}`,
      );
    assert.equal(ground(s, t.x), 410);
    assert.equal(terrainDepthLimit(s, t.x), 36);
    crater(s, 2500, 65, 65);
    assert.ok(ground(s, 2500) - s.original[2500] <= 28);
    return { depth: ground(s, t.x) - 374 };
  },
);
check(
  'two-member teams share a smaller slot and repeated hold never adds another pit or mines',
  () => {
    const s = arena(),
      us = spawn(s, 0, 'medic', 1450);
    const { t } = dig(s, us);
    const n = s.mines.length;
    for (let i = 0; i < 3; i++) {
      setSquadOrder(s, 0, us[0].squad, 'watch');
      setSquadOrder(s, 0, us[0].squad, 'hold');
      run(s, 1);
    }
    assert.equal(s.entrenchments.length, 1);
    assert.equal(s.mines.length, n);
    assert.ok(t.radius * 2 < 103);
    return {
      width: t.radius * 2,
      slots: us.map((u) => [u.squadOrderX, u.holdLane]),
    };
  },
);
check(
  'a noticed descending shell interrupts digging before movement or prone reaction',
  () => {
    const s = arena(),
      us = spawn(s, 0, 'infantry', 1450);
    setSquadOrder(s, 0, us[0].squad, 'hold');
    const t = s.entrenchments[0];
    for (let i = 0; i < 600 && t.progress < 0.25; i++) tick(s, DT);
    assert.ok(us.some((u) => u.digging));
    s.projectiles.push({
      uid: 70001,
      x: t.x - 20,
      y: ground(s, t.x) - 70,
      tx: t.x,
      ty: ground(s, t.x),
      side: 1,
      targetUid: null,
      base: null,
      damage: 0,
      radius: 0,
      shell: true,
      ammunition: 'mortar',
      arc: 170,
      life: 0.4,
      total: 2,
      startX: t.x - 100,
      startY: 100,
      missed: true,
    });
    const reacted = new Set();
    run(s, 1, () => {
      for (const u of us)
        if (
          u.evadeUntil > s.time &&
          (u.artilleryReactAt ?? Infinity) <= s.time
        ) {
          reacted.add(u.uid);
          assert.equal(u.digging, false);
        }
    });
    assert.ok(
      reacted.size > 0,
      'real local shell observation must trigger at least one reaction',
    );
    return { reacted: reacted.size };
  },
);
console.log(JSON.stringify({ passed: metrics.length, metrics }));
