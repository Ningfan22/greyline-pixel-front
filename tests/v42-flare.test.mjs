import assert from 'node:assert/strict';
import {
  createGame,
  startGame,
  tick,
  spawnUnit,
  refreshVision,
  visibleToSide,
} from '../game/engine.ts';

const results = [];
function test(name, fn) {
  try {
    const value = fn();
    results.push({ name, ok: true, ...value });
  } catch (error) {
    results.push({ name, ok: false, error: error.message });
  }
}

function arena() {
  const s = createGame(1);
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

function squad(s, side, id, x) {
  const at = s.units.length;
  spawnUnit(s, side, id, x);
  return s.units.slice(at);
}

function hand(s, ids, energy) {
  s.players[1].hand = ids.map((id, i) => ({ id, uid: 10000 + i, readyAt: 0 }));
  s.players[1].energy = energy;
}

function flareAt(s, x, life = 10) {
  s.flares.push({
    x,
    y: 374 - 200,
    life,
    maxLife: 10,
    side: 0,
    seed: 42,
  });
}

// --- Illumination reveals what smoke hides, for whoever holds the light ---

test('flare reveals a smoke-screened enemy to the observer', () => {
  const s = arena();
  const [observer] = squad(s, 0, 'infantry', 650);
  const [hidden] = squad(s, 1, 'infantry', 950);
  s.smokes.push({ x: 800, life: 10, side: 1 });
  refreshVision(s);
  assert.equal(
    visibleToSide(s, 0, hidden),
    false,
    'smoke should hide the enemy before the flare',
  );
  flareAt(s, 800);
  refreshVision(s);
  assert.equal(
    visibleToSide(s, 0, hidden),
    true,
    'flare should reveal the enemy through smoke',
  );
  assert.equal(
    visibleToSide(s, 1, observer),
    true,
    'flare light is impartial — the enemy sees the observer too',
  );
  return { revealed: visibleToSide(s, 0, hidden) };
});

test('concealment returns when the flare burns out', () => {
  const s = arena();
  const [hidden] = squad(s, 1, 'infantry', 950);
  squad(s, 0, 'infantry', 650);
  s.smokes.push({ x: 800, life: 10, side: 1 });
  flareAt(s, 800);
  refreshVision(s);
  assert.equal(visibleToSide(s, 0, hidden), true);
  s.flares.forEach((f) => (f.life = 0));
  refreshVision(s);
  assert.equal(
    visibleToSide(s, 0, hidden),
    false,
    'expired flare should leave the enemy hidden again',
  );
  return { hiddenAgain: !visibleToSide(s, 0, hidden) };
});

// --- The candle drifts down under its parachute while it burns ---

test('flare descends and burns out over its lifetime', () => {
  const s = arena();
  flareAt(s, 1200, 10);
  const f = s.flares[0];
  const y0 = f.y;
  tick(s, 0.5);
  assert.ok(f.y > y0, `flare should descend: ${f.y} > ${y0}`);
  assert.ok(f.life < 10, 'flare life should tick down');
  const x0 = f.x;
  assert.notEqual(x0, 1200, 'flare should sway laterally');
  for (let i = 0; i < 220; i++) tick(s, 0.05);
  assert.equal(s.flares.length, 0, 'burned-out flares are removed');
  return { descended: f.y - y0 };
});

// --- The AI spends a flare when enemy smoke blinds its fire ---

test('AI illuminates enemy smoke screening its front', () => {
  const s = arena();
  squad(s, 1, 'assault', 2800);
  squad(s, 1, 'assault', 2860);
  squad(s, 0, 'infantry', 2500);
  s.smokes.push({ x: 2600, life: 10, side: 0 });
  hand(s, ['flare'], 2);
  s.aiIn = 0;
  refreshVision(s);
  tick(s, 0.05);
  assert.equal(s.players[1].played, 1, 'AI should play the flare');
  assert.equal(s.flares.length, 1, 'one flare in the sky');
  const f = s.flares[0];
  assert.ok(Math.abs(f.x - 2600) < 2, `flare over the smoke: x=${f.x}`);
  assert.ok(s.players[1].energy < 2, 'flare was paid for');
  return { flareX: f.x };
});

console.log(JSON.stringify(results, null, 2));
if (results.some((r) => !r.ok)) process.exitCode = 1;
