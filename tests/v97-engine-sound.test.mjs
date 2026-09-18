import assert from 'node:assert/strict';
import {
  observeEngineSpeed,
  isEngineVehicle,
  engineRpm,
  enginePitch,
  engineLevel,
  enginePan,
  engineEdgeDistance,
  desiredEngineVoice,
  ENGINE_IDLE_RPM,
  ENGINE_AUDIBLE_MARGIN,
} from '../game/engine-sound.ts';

const results = [],
  failures = [];

function check(name, fn) {
  try {
    const details = fn();
    results.push({ name, ...details });
    console.log('PASS', name);
  } catch (e) {
    failures.push({ name, error: e.stack });
    results.push({ name, ok: false, error: e.message });
    console.log('FAIL', name, e.message);
  }
}

const tank = (over = {}) => ({
  uid: 1,
  id: 'tank',
  member: 0,
  x: 400,
  hp: 650,
  moving: true,
  motion: 'ground',
  ...over,
});
const ifv = (over = {}) => ({
  uid: 2,
  id: 'ifv',
  member: 0,
  x: 600,
  hp: 420,
  moving: true,
  motion: 'ground',
  ...over,
});
const inf = (over = {}) => ({
  uid: 3,
  id: 'infantry',
  member: 0,
  x: 500,
  hp: 100,
  moving: true,
  motion: 'ground',
  ...over,
});

// ── isEngineVehicle ──────────────────────────────────────────────
check('坦克是引擎车辆', () => {
  assert.equal(isEngineVehicle(tank()), true);
  return { ok: true };
});
check('步战车是引擎车辆', () => {
  assert.equal(isEngineVehicle(ifv()), true);
  return { ok: true };
});
check('步兵不是引擎车辆', () => {
  assert.equal(isEngineVehicle(inf()), false);
  return { ok: true };
});
check('残骸不是引擎车辆', () => {
  assert.equal(isEngineVehicle(tank({ hp: 0 })), false);
  return { ok: true };
});
check('空中载具不是引擎车辆', () => {
  assert.equal(isEngineVehicle(tank({ motion: 'air' })), false);
  return { ok: true };
});
check('未指定 motion 的地面坦克是引擎车辆', () => {
  const t = tank();
  delete t.motion;
  assert.equal(isEngineVehicle(t), true);
  return { ok: true };
});

// ── observeEngineSpeed ────────────────────────────────────────────
check('首次观测速度为零', () => {
  const obs = observeEngineSpeed(undefined, 100, 0, true);
  assert.equal(obs.speed, 0);
  assert.equal(obs.x, 100);
  return { ok: true };
});
check('移动车辆累积观测速度', () => {
  let obs = observeEngineSpeed(undefined, 0, 0, true);
  for (let i = 1; i <= 30; i++)
    obs = observeEngineSpeed(obs, i * 10, i / 60, true);
  assert.ok(obs.speed > 400, `speed ${obs.speed} should approach 600`);
  return { ok: true, speed: Math.round(obs.speed) };
});
check('静止标记的车辆速度归零', () => {
  let obs = observeEngineSpeed(undefined, 0, 0, true);
  obs = observeEngineSpeed(obs, 600, 1, true);
  assert.ok(obs.speed > 400);
  obs = observeEngineSpeed(obs, 600.5, 2, false);
  assert.equal(obs.speed, 0);
  return { ok: true };
});

// ── engineRpm ────────────────────────────────────────────────────
check('rpm 有怠速下限', () => {
  assert.ok(engineRpm(0, 100) >= ENGINE_IDLE_RPM);
  return { ok: true, rpm: engineRpm(0, 100) };
});
check('rpm 随速度单调不减', () => {
  const top = 100;
  let prev = 0;
  for (const v of [0, 10, 25, 50, 75, 100, 200]) {
    const r = engineRpm(v, top);
    assert.ok(r >= prev, `rpm ${r} < prev ${prev} at v=${v}`);
    prev = r;
  }
  return { ok: true };
});
check('rpm 钳制在 1', () => {
  assert.equal(engineRpm(9999, 100), 1);
  return { ok: true };
});

// ── enginePitch ──────────────────────────────────────────────────
check('坦克怠速音调低于步战车', () => {
  const tankPitch = enginePitch(ENGINE_IDLE_RPM, 'tank');
  const ifvPitch = enginePitch(ENGINE_IDLE_RPM, 'ifv');
  assert.ok(tankPitch < ifvPitch, `${tankPitch} vs ${ifvPitch}`);
  return { ok: true, tank: tankPitch, ifv: ifvPitch };
});
check('音调随 rpm 上升', () => {
  const lo = enginePitch(ENGINE_IDLE_RPM, 'tank');
  const hi = enginePitch(1, 'tank');
  assert.ok(hi > lo);
  return { ok: true };
});

// ── engineLevel ──────────────────────────────────────────────────
check('屏幕内引擎满电平', () => {
  const l = engineLevel(0.8, 0);
  assert.ok(l > 0.8, `level ${l}`);
  return { ok: true, level: l };
});
check('怠速引擎仍有过半响度', () => {
  const l = engineLevel(ENGINE_IDLE_RPM, 0);
  assert.ok(l > 0.4, `idle level ${l}`);
  return { ok: true, level: l };
});
check('可听边界处电平为零', () => {
  assert.equal(engineLevel(1, ENGINE_AUDIBLE_MARGIN), 0);
  return { ok: true };
});
check('电平随距离单调递减', () => {
  let prev = Infinity;
  for (const d of [0, 100, 300, 600, 900]) {
    const l = engineLevel(0.8, d);
    assert.ok(l <= prev, `level ${l} > prev ${prev} at d=${d}`);
    prev = l;
  }
  return { ok: true };
});

// ── enginePan ────────────────────────────────────────────────────
check('屏幕中心声像居中', () => {
  const pan = enginePan(500, 0, 1000);
  assert.ok(Math.abs(pan) < 0.01, `pan ${pan}`);
  return { ok: true, pan };
});
check('左侧声像偏左', () => {
  assert.ok(enginePan(100, 0, 1000) < 0);
  return { ok: true };
});
check('右侧声像偏右', () => {
  assert.ok(enginePan(900, 0, 1000) > 0);
  return { ok: true };
});

// ── engineEdgeDistance ───────────────────────────────────────────
check('屏幕内距离为零', () => {
  assert.equal(engineEdgeDistance(500, 0, 1000), 0);
  assert.equal(engineEdgeDistance(0, 0, 1000), 0);
  assert.equal(engineEdgeDistance(1000, 0, 1000), 0);
  return { ok: true };
});
check('屏幕外距离正确', () => {
  assert.equal(engineEdgeDistance(-200, 0, 1000), 200);
  assert.equal(engineEdgeDistance(1300, 0, 1000), 300);
  return { ok: true };
});

// ── desiredEngineVoice ───────────────────────────────────────────
check('坦克产出完整语音规格', () => {
  const spec = desiredEngineVoice(tank({ x: 500 }), undefined, 0, 1000, 100);
  assert.ok(spec);
  assert.equal(spec.model, 'tank');
  assert.ok(spec.rpm >= ENGINE_IDLE_RPM);
  assert.ok(spec.level > 0);
  assert.ok(Math.abs(spec.pan) < 0.01);
  return { ok: true, rpm: spec.rpm.toFixed(2), pitch: spec.pitch.toFixed(2) };
});
check('步战车产出 ifv 模型', () => {
  const spec = desiredEngineVoice(ifv(), undefined, 0, 1000, 100);
  assert.equal(spec.model, 'ifv');
  return { ok: true };
});
check('步兵返回 null', () => {
  assert.equal(desiredEngineVoice(inf(), undefined, 0, 1000, 100), null);
  return { ok: true };
});
check('可听边界外返回 null', () => {
  const far = tank({ x: 5000 });
  assert.equal(desiredEngineVoice(far, undefined, 0, 1000, 100), null);
  return { ok: true };
});
check('残骸返回 null', () => {
  assert.equal(
    desiredEngineVoice(tank({ hp: 0 }), undefined, 0, 1000, 100),
    null,
  );
  return { ok: true };
});
check('观测速度影响 rpm', () => {
  const idle = desiredEngineVoice(tank(), { x: 400, t: 0, speed: 0 }, 0, 1000, 100);
  const fast = desiredEngineVoice(
    tank(),
    { x: 400, t: 0, speed: 90 },
    0,
    1000,
    100,
  );
  assert.ok(fast.rpm > idle.rpm, `${fast.rpm} vs ${idle.rpm}`);
  return { ok: true, idle: idle.rpm.toFixed(2), fast: fast.rpm.toFixed(2) };
});
check('双方对称：敌方坦克同样有语音', () => {
  const enemy = tank({ uid: 99, x: 400 });
  const spec = desiredEngineVoice(enemy, undefined, 0, 1000, 100);
  assert.ok(spec);
  assert.equal(spec.model, 'tank');
  return { ok: true };
});

// ── summary ──────────────────────────────────────────────────────
console.log(
  `\n${results.length} checks, ${failures.length} failed`,
);
if (failures.length) {
  for (const f of failures) console.log('FAIL', f.name, f.error);
  process.exitCode = 1;
}
