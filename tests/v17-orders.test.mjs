import assert from 'node:assert/strict';
import {
  createGame,
  startGame,
  spawnUnit,
  tick,
  crater,
} from '../game/engine.ts';
import {
  setSquadOrder,
  updateSquadOrders,
  pickSquad,
  trenchProtection,
  terrainDepthLimit,
} from '../game/squad-orders.ts';
import { sightRange } from '../game/world.ts';
import { foregroundObject, infantryDepth } from '../game/render-depth.ts';
import { tankGeometry } from '../game/vehicle-geometry.ts';
import { wreckGeometry } from '../game/wreck-geometry.ts';
import { buildingAnimation } from '../game/building-art.ts';
let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log('PASS', name);
}
function arena() {
  const s = createGame(17);
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
function work(s, sec) {
  for (let n = 0; n < sec * 60; n++) {
    tick(s, 1 / 60);
  }
}
check(
  'selection identifies living own infantry and vehicles and ignores enemy/wounded',
  () => {
    const s = arena(),
      u = spawn(s, 0, 'infantry', 900)[0],
      e = spawn(s, 1, 'infantry', 1800)[0],
      v = spawn(s, 0, 'tank', 2300)[0];
    assert.equal(
      pickSquad(s, 0, u.x, u.y + infantryDepth(u.lane) - 40),
      u.squad,
    );
    assert.equal(
      pickSquad(s, 0, u.x, u.y + infantryDepth(u.lane) - 40 + 40),
      u.squad,
    );
    assert.equal(
      pickSquad(s, 0, u.x, u.y + infantryDepth(u.lane) - 40 + 40, true),
      u.squad,
    );
    assert.equal(pickSquad(s, 0, e.x, e.y + infantryDepth(e.lane) - 40), null);
    assert.equal(pickSquad(s, 0, v.x, v.y - 40), v.squad);
    s.units = s.units.filter((q) => q === u);
    u.wounded = true;
    assert.equal(pickSquad(s, 0, u.x, u.y + infantryDepth(u.lane) - 40), null);
  },
);
check('orders apply to one squad and reject wrong side or pause', () => {
  const s = arena(),
    us = spawn(s, 0, 'infantry', 900),
    others = spawn(s, 0, 'infantry', 1200),
    enemy = spawn(s, 1, 'infantry', 2100);
  assert.ok(setSquadOrder(s, 0, us[0].squad, 'watch').ok);
  assert.ok(us.every((u) => u.squadOrder === 'watch'));
  assert.ok(others.every((u) => !u.squadOrder));
  assert.equal(setSquadOrder(s, 0, enemy[0].squad, 'hold').ok, false);
  s.status = 'paused';
  assert.equal(setSquadOrder(s, 0, us[0].squad, 'attack').ok, false);
});
check(
  'whole squad digs one continuous deep chamber with rounded banks and two mines, without raising HP',
  () => {
    const s = arena(),
      us = spawn(s, 0, 'infantry', 900),
      hp = us.map((u) => u.hp);
    setSquadOrder(s, 0, us[0].squad, 'hold');
    work(s, 3);
    assert.ok(
      s.entrenchments[0].progress > 0 && s.entrenchments[0].progress < 0.5,
    );
    assert.equal(s.mines.length, 0);
    work(s, 5);
    assert.ok(s.entrenchments[0].built);
    assert.equal(s.mines.length, 2);
    assert.ok(
      s.mines.every((m) => m.kind === 'antipersonnel' && m.armAt > s.time),
    );
    assert.deepEqual(
      us.map((u) => u.hp),
      hp,
    );
    assert.ok(trenchProtection(s, s.entrenchments[0].x) >= 0.49);
    assert.equal(Math.max(...s.terrain) - 374, 36);
    for (let x = 1; x < s.terrain.length; x++)
      assert.ok(Math.abs(s.terrain[x] - s.terrain[x - 1]) <= 2.2);
    assert.ok(
      us.every((u) => s.terrain[Math.round(u.x)] === 410),
      'all members share the same floor',
    );
    assert.equal(s.entrenchments.length, 1);
    assert.equal(trenchProtection(s, 1400), 0);
  },
);
check(
  'artillery does not refill the deep trench and nearby squads cannot stack its depth',
  () => {
    const s = arena(),
      us = spawn(s, 0, 'infantry', 900);
    setSquadOrder(s, 0, us[0].squad, 'hold');
    work(s, 7);
    const center = s.entrenchments[0].x,
      other = spawn(s, 0, 'infantry', 900);
    setSquadOrder(s, 0, other[0].squad, 'hold');
    work(s, 7);
    assert.equal(Math.max(...s.terrain) - 374, 36);
    const before = s.terrain[Math.round(center)];
    crater(s, center, 36, 10);
    assert.equal(s.terrain[Math.round(center)], before);
    assert.equal(terrainDepthLimit(s, center), 36);
    assert.equal(terrainDepthLimit(s, 1700), 28);
  },
);
check(
  'dug-in infantry can fire out and later leave over smooth banks without climbing',
  () => {
    const s = arena(),
      us = spawn(s, 0, 'infantry', 1100);
    setSquadOrder(s, 0, us[0].squad, 'hold');
    for (let i = 0; i < 450; i++) tick(s, 1 / 60);
    const enemies = spawn(s, 1, 'infantry', 1380);
    enemies.forEach((u) => {
      u.cooldown = 1e6;
      u.secondaryCooldown = 1e6;
    });
    s.players[1].order = 'hold';
    const before = us.reduce((n, u) => n + u.shots, 0);
    for (let i = 0; i < 240; i++) tick(s, 1 / 60);
    assert.ok(us.reduce((n, u) => n + u.shots, 0) > before);
    s.units = us;
    setSquadOrder(s, 0, us[0].squad, 'attack');
    let climbs = 0;
    for (let i = 0; i < 1200; i++) {
      tick(s, 1 / 60);
      climbs += us.filter((u) => u.climbing > 0 || u.motion === 'bank').length;
    }
    assert.equal(climbs, 0);
    assert.ok(us.every((u) => u.x > 1100));
  },
);
check(
  'moving/suppressed troops cannot instantly dig and repeating hold never farms mines',
  () => {
    const s = arena(),
      us = spawn(s, 0, 'infantry', 900);
    setSquadOrder(s, 0, us[0].squad, 'hold');
    tick(s, 1 / 60);
    assert.equal(s.entrenchments[0].progress, 0);
    assert.ok(us.some((u) => u.moving));
    for (let i = 0; i < 600; i++) {
      us.forEach((u) => (u.suppression = 80));
      tick(s, 1 / 60);
      assert.ok(us.every((u) => !u.digging));
    }
    assert.equal(s.entrenchments[0].progress, 0);
    us.forEach((u) => (u.suppression = 0));
    work(s, 8);
    assert.equal(s.mines.length, 2);
    for (let i = 0; i < 10; i++) {
      setSquadOrder(s, 0, us[0].squad, 'attack');
      setSquadOrder(s, 0, us[0].squad, 'hold');
      work(s, 1);
    }
    assert.equal(s.entrenchments.length, 1);
    assert.equal(s.mines.length, 2);
  },
);
check('retreat is a local waypoint and transitions to watch on arrival', () => {
  for (const side of [0, 1]) {
    const s = arena(),
      us = spawn(s, side, 'infantry', side ? 2100 : 900);
    setSquadOrder(s, side, us[0].squad, 'retreat');
    assert.equal(us[0].squadOrderX - us[0].x, side ? 240 : -240);
    assert.equal(us[0].retreatUntil, 0);
    us.forEach((u) => (u.x = u.squadOrderX));
    updateSquadOrders(s, 0.01);
    assert.ok(us.every((u) => u.squadOrder === 'watch'));
  }
});
check('watch improves stationary observation only', () => {
  const s = arena(),
    u = spawn(s, 0, 'infantry', 900)[0],
    base = sightRange(u);
  u.squadOrder = 'watch';
  assert.equal(sightRange(u), base * 1.15);
  u.moving = true;
  assert.equal(sightRange(u), base);
});
check('antipersonnel mines hit one enemy on contact with a small flash', () => {
  const s = arena(),
    us = spawn(s, 1, 'infantry', 1400);
  us.forEach((u) => (u.x = 1400));
  const hp = us.reduce((n, u) => n + u.hp, 0);
  s.mines = [
    { uid: ++s.uid, side: 0, x: 1400, armAt: 0, kind: 'antipersonnel' },
  ];
  tick(s, 0.01);
  assert.equal(s.mines.length, 0);
  assert.equal(hp - us.reduce((n, u) => n + u.hp, 0), 22);
  assert.ok(s.units.every((u) => u.hp > 0));
});
check(
  'depth choices are deterministic, one third foreground and wreck keeps UID',
  () => {
    const a = Array.from({ length: 6000 }, (_, i) => foregroundObject(i));
    const ratio = a.filter(Boolean).length / a.length;
    assert.ok(ratio > 0.31 && ratio < 0.36);
    a.forEach((v, i) => assert.equal(foregroundObject(i), v));
  },
);
check('all passing lanes keep boots inside the same ground strip', () => {
  for (let lane = -48; lane <= 48; lane++)
    assert.ok(3 + infantryDepth(lane) >= 0 && 3 + infantryDepth(lane) <= 6);
  assert.deepEqual([-24, 0, 24].map(infantryDepth), [-3, 0, 3]);
});
check('support vehicles and their wrecks share a reduced footprint', () => {
  assert.equal(tankGeometry('tank').size[0], 270);
  assert.ok(tankGeometry('mortar_carrier').size[0] < 150);
  assert.ok(wreckGeometry('mortar_carrier').width < 200);
  assert.ok(tankGeometry('tow_ifv').size[0] < 210);
});
check(
  'partial building damage cannot flash back to an intact collapse frame',
  () => {
    const p = {
      kind: 'house',
      parts: [{ kind: 'wall', hp: 75, maxHp: 100 }],
      damageAt: 1,
      fromStage: 0,
    };
    for (const hp of [75, 35]) {
      p.parts[0].hp = hp;
      for (const time of [1, 1.05, 1.2, 1.5])
        assert.equal(buildingAnimation(p, time), null);
    }
  },
);
console.log(`${passed} squad/depth checks passed`);
