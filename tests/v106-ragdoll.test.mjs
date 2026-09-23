import assert from 'node:assert/strict';
import {
  createGame,
  startGame,
  spawnUnit,
  tick,
  explode,
  ground,
} from '../game/engine.ts';

const DT = 1 / 60;
function arena() {
  const s = createGame(23013);
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
  return s;
}
function until(s, predicate, seconds = 12) {
  for (let t = 0; t < seconds && !predicate(); t += DT) tick(s, DT);
  assert.ok(predicate(), `condition not reached at ${s.time.toFixed(3)}s`);
}

// 步兵被炮弹直接命中：尸体必须被抛向空中（水平速度 + 上抛 + 自旋），
// 而不是像中弹一样原地倒下。
{
  const s = arena();
  spawnUnit(s, 1, 'infantry', 1200);
  explode(
    s,
    1200,
    ground(s, 1200) - 10,
    60,
    400,
    0,
    1,
    1,
    'he',
    1.5,
  );
  const thrown = s.wrecks.filter(
    (w) => w.cardId === 'infantry' && w.falling && w.spin !== undefined,
  );
  assert.ok(thrown.length > 0, 'blast-killed infantry must be thrown with spin');
  for (const w of thrown) {
    assert.ok(Math.abs(w.vx) > 30, 'thrown body must carry horizontal velocity');
    assert.ok(w.vy < 0, 'thrown body must be launched upward');
    assert.ok(Math.abs(w.spin) > 1, 'thrown body must tumble');
  }
  console.log('PASS ragdoll launch');
}

// 抛飞的尸体必须落回地面并停下，最终姿态是自然的伏地角而不是继续翻滚。
{
  const s = arena();
  spawnUnit(s, 1, 'infantry', 1200);
  explode(
    s,
    1200,
    ground(s, 1200) - 10,
    60,
    400,
    0,
    1,
    1,
    'he',
    1.5,
  );
  const thrown = s.wrecks.filter((w) => w.cardId === 'infantry' && w.falling);
  assert.ok(thrown.length > 0, 'fixture needs at least one airborne body');
  const firstId = thrown[0].id;
  until(s, () => !s.wrecks.some((w) => w.id === firstId && w.falling), 6);
  const landed = s.wrecks.find((w) => w.id === firstId);
  assert.ok(landed, 'wreck must persist after landing');
  // Impact stops translation; rotation now settles continuously rather than
  // snapping to a prone angle on the very first contact frame.
  until(s, () => !landed.soldierSettle, 2);
  assert.ok(
    Math.abs(landed.angle) <= 0.36,
    'landed body must settle into a sprawled angle',
  );
  assert.ok(
    Math.abs(landed.y - ground(s, landed.x)) < 2,
    'landed body must rest on the ground',
  );
  console.log('PASS ragdoll landing');
}

// 子弹击杀不触发布娃娃：只有爆炸才有抛飞。
{
  const s = arena();
  spawnUnit(s, 1, 'infantry', 1200);
  spawnUnit(s, 0, 'infantry', 1280);
  const victim = s.units.find((u) => u.side === 1);
  victim.hp = 1;
  for (const u of s.units) if (u.side === 0) u.cooldown = 0;
  until(s, () => s.wrecks.some((w) => w.cardId === 'infantry'), 10);
  const wreck = s.wrecks.find((w) => w.cardId === 'infantry');
  assert.ok(
    wreck,
    'bullet casualty must leave a wreck',
  );
  assert.ok(
    wreck.spin === undefined,
    'bullet kill must not tumble the body',
  );
  assert.ok(
    !wreck.falling,
    'bullet kill must not launch the body airborne',
  );
  console.log('PASS no ragdoll without blast kill');
}
