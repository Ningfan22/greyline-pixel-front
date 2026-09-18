import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  createGame,
  startGame,
  tick,
  spawnUnit,
  pointVisible,
  snapshot,
} from '../game/engine.ts';

const DT = 1 / 60;
const out = path.resolve('output/v62-weather-qa');
const results = [],
  failures = [];
fs.mkdirSync(out, { recursive: true });

function check(name, fn) {
  try {
    const details = fn();
    results.push({ name, ...details });
    console.log('PASS', name);
  } catch (e) {
    failures.push({ name, error: e.stack });
    console.error('FAIL', name, e.stack);
  }
}

function arena(mapId) {
  const s = createGame(62031, undefined, undefined, mapId);
  startGame(s);
  s.terrain.fill(374);
  s.original.fill(374);
  s.walls = [];
  s.scenery = [];
  s.players[1].deck = [];
  s.players[1].discard = [];
  s.players[1].hand = [];
  s.players[1].energy = 0;
  s.aiIn = 1e9;
  return s;
}

function run(s, seconds) {
  for (let i = 0; i < Math.round(seconds / DT); i++) tick(s, DT);
}

// ── 1. Weather cycles clear ↔ rain on the greyline ──────────
check('天气在晴天与雨之间循环', () => {
  const s = arena();
  const seen = [];
  for (let t = 0; t < 200; t += 2) {
    run(s, 2);
    seen.push(s.weather.kind);
  }
  assert.ok(seen.includes('rain'), '200 秒内应出现雨天');
  const firstRain = seen.indexOf('rain');
  assert.ok(
    seen.slice(firstRain + 1).includes('clear'),
    '雨天之后应回到晴天',
  );
  return { samples: seen.length, firstRainAt: firstRain * 2 };
});

// ── 2. Fog cuts what a scout drone can see ─────────────────
check('雾天削减侦察视野，晴天恢复', () => {
  const s = arena('jungle');
  const at = s.units.length;
  spawnUnit(s, 0, 'scout_drone', 500);
  const drone = s.units[at];
  spawnUnit(s, 1, 'infantry', 1100);
  // 619px slant distance: inside the drone's 820px sight, outside 820*0.6.
  s.weather.kind = 'clear';
  s.weather.intensity = 0;
  assert.equal(
    pointVisible(s, 0, 1100, 374),
    true,
    '晴天应看见 600px 外的目标',
  );
  s.weather.kind = 'fog';
  s.weather.intensity = 1;
  assert.equal(
    pointVisible(s, 0, 1100, 374),
    false,
    '满强度雾天应看不见 600px 外的目标',
  );
  // Rain is milder (0.85): 820*0.85 = 697 > 619, still visible.
  s.weather.kind = 'rain';
  assert.equal(
    pointVisible(s, 0, 1100, 374),
    true,
    '雨天（0.85）应仍能看见目标',
  );
  return { droneUid: drone.uid };
});

// ── 3. Rain washes smoke away faster ───────────────────────
check('雨天加速烟雾消散', () => {
  const wet = arena();
  wet.weather.kind = 'rain';
  wet.weather.intensity = 1;
  wet.smokes.push({ x: 1500, life: 10, side: 0 });
  run(wet, 1);
  const wetLife = wet.smokes[0]?.life ?? 0;

  const dry = arena();
  dry.weather.kind = 'clear';
  dry.weather.intensity = 0;
  dry.smokes.push({ x: 1500, life: 10, side: 0 });
  run(dry, 1);
  const dryLife = dry.smokes[0]?.life ?? 0;

  assert.ok(wetLife < 8.5, `雨天 1 秒后烟雾生命 ${wetLife.toFixed(2)} 应明显低于 9`);
  assert.ok(Math.abs(dryLife - 9) < 0.1, `晴天 1 秒后烟雾生命 ${dryLife.toFixed(2)} 应≈9`);
  return { wetLife: +wetLife.toFixed(2), dryLife: +dryLife.toFixed(2) };
});

// ── 4. Each map flips to its signature weather ─────────────
check('四张地图各自触发专属天气', () => {
  const expected = {
    greyline: 'rain',
    jungle: 'fog',
    mountains: 'snow',
    desert: 'sandstorm',
  };
  const got = {};
  for (const [mapId, kind] of Object.entries(expected)) {
    const s = arena(mapId);
    s.weather.in = 0;
    tick(s, DT);
    assert.equal(s.weather.kind, kind, `${mapId} 应触发 ${kind}`);
    got[mapId] = s.weather.kind;
  }
  return got;
});

// ── 5. Snapshot carries weather for the renderer/UI ────────
check('快照包含天气状态', () => {
  const s = arena('mountains');
  s.weather.kind = 'snow';
  s.weather.intensity = 0.5;
  const snap = snapshot(s);
  assert.deepEqual(snap.weather, { kind: 'snow', intensity: 0.5 });
  return snap.weather;
});

fs.writeFileSync(
  path.join(out, 'checks.json'),
  JSON.stringify({ results, failures }, null, 2),
);
console.log(`\n${results.length} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
