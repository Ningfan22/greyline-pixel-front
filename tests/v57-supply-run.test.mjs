import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  createGame,
  startGame,
  tick,
  spawnUnit,
  refreshVision,
  setOrder,
} from '../game/engine.ts';
import { unitSynergy } from '../game/synergy.ts';

const DT = 1 / 60;
const out = path.resolve('output/v57-supply-run-qa');
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

function arena() {
  const s = createGame(57014);
  startGame(s);
  s.terrain.fill(374);
  s.original.fill(374);
  s.walls = [];
  s.scenery = [];
  s.players[1].deck = [];
  s.players[1].discard = [];
  s.players[1].hand = [];
  s.players[1].energy = 0;
  // Keep the AI director from rewriting orders mid-scenario.
  s.aiIn = 1e9;
  return s;
}

function squad(s, side, id, x) {
  const at = s.units.length;
  spawnUnit(s, side, id, x);
  return s.units.slice(at);
}

// Flat arena: side 1 mortar at 2800, side 0 immortal/silenced rifle squad at
// 2400 (400px gap: inside mortar range 180-820, outside rifle range 380).
// Side 1 is on hold so v56 shoot-and-scoot displacement does not move the
// battery and break the 210px supply proximity. An optional side 1 supply
// team sits at supplyX (2750 = 50px from the mortar when fed).
function scene({ supply = true, supplyX = 2750, supplySide = 1 } = {}) {
  const s = arena();
  const mortars = squad(s, 1, 'mortar', 2800);
  const rifles = squad(s, 0, 'infantry', 2400);
  let supplies = [];
  if (supply) supplies = squad(s, supplySide, 'supply_team', supplyX);
  setOrder(s, 0, 'hold');
  setOrder(s, 1, 'hold');
  for (const m of mortars) {
    m.cooldown = 0;
    m.decisionIn = 1e6;
  }
  for (const r of rifles) {
    r.cooldown = 1e6;
    r.decisionIn = 1e6;
    r.hp = 99999;
    r.maxHp = 99999;
  }
  for (const v of supplies) {
    v.decisionIn = 1e6;
  }
  refreshVision(s);
  return { s, mortars, rifles, supplies };
}

function run(s, seconds) {
  for (let i = 0; i < Math.round(seconds / DT); i++) tick(s, DT);
}

function totalShots(units) {
  return units.reduce((a, u) => a + u.shots, 0);
}

// --- Reload speedup ---

check('a nearby supply team speeds the mortar battery reload (1.6x)', () => {
  const fed = scene();
  run(fed.s, 20);
  const fedShots = totalShots(fed.mortars);

  const dry = scene({ supply: false });
  run(dry.s, 20);
  const dryShots = totalShots(dry.mortars);

  // Theory: rate 4.4s -> ~5 shots in 20s dry; 4.4/1.6 = 2.75s -> ~8 fed.
  assert.ok(
    fedShots >= 6,
    `fed battery fired >= 6 shots in 20s, got ${fedShots}`,
  );
  assert.ok(
    fedShots >= dryShots + 2,
    `fed battery outshot the dry battery by >= 2 (${fedShots} vs ${dryShots})`,
  );
  return { fedShots, dryShots };
});

check('a supply team beyond 210px gives no reload bonus', () => {
  const far = scene({ supplyX: 2300 }); // 500px from the mortar
  run(far.s, 20);
  const farShots = totalShots(far.mortars);

  const dry = scene({ supply: false });
  run(dry.s, 20);
  const dryShots = totalShots(dry.mortars);

  assert.ok(
    Math.abs(farShots - dryShots) <= 1,
    `far supply team did not change the rate of fire (${farShots} vs dry ${dryShots})`,
  );
  return { farShots, dryShots };
});

check('a dead supply team gives no reload bonus', () => {
  const dead = scene();
  for (const v of dead.supplies) v.hp = 0;
  run(dead.s, 20);
  const deadShots = totalShots(dead.mortars);

  const dry = scene({ supply: false });
  run(dry.s, 20);
  const dryShots = totalShots(dry.mortars);

  assert.ok(
    Math.abs(deadShots - dryShots) <= 1,
    `dead supply team did not change the rate of fire (${deadShots} vs dry ${dryShots})`,
  );
  return { deadShots, dryShots };
});

// --- Side gating ---

check('an enemy supply team does not speed our own weapons', () => {
  const foe = scene({ supplySide: 0 });
  run(foe.s, 1);
  const syn = unitSynergy(foe.s, foe.mortars[0], foe.s.time);
  assert.equal(
    syn.supply_run,
    false,
    'side 1 mortar must not receive supply_run from a side 0 supply team',
  );
  return { supply_run: syn.supply_run };
});

// --- Receiver gating ---

check('a mortar carrier never receives supply_run', () => {
  const s = arena();
  const carrier = squad(s, 1, 'mortar_carrier', 2800);
  squad(s, 1, 'supply_team', 2750);
  setOrder(s, 1, 'hold');
  run(s, 1);
  const syn = unitSynergy(s, carrier[0], s.time);
  assert.equal(
    syn.supply_run,
    false,
    'a vehicle carrier is not a weapon team receiver',
  );
  return { supply_run: syn.supply_run };
});

// --- Cooldown decrement, measured directly ---

check('an MG team cooldown drops faster with a supply team nearby', () => {
  const s = arena();
  const mg = squad(s, 1, 'machinegun', 2800);
  squad(s, 1, 'supply_team', 2750);
  setOrder(s, 1, 'hold');
  for (const m of mg) {
    m.cooldown = 10;
    m.decisionIn = 1e6;
  }
  run(s, 1);
  // Worst case the staggered cache is stale for 0.6s: 10 - 0.6 - 0.4*1.6
  // ~= 8.76. Without the bonus it would be ~9.0.
  assert.ok(
    mg[0].cooldown < 9.0,
    `fed MG cooldown dropped below 9.0 in 1s, got ${mg[0].cooldown.toFixed(2)}`,
  );
  return { cooldown: +mg[0].cooldown.toFixed(2) };
});

check('an MG team cooldown drops at normal rate without a supply team', () => {
  const s = arena();
  const mg = squad(s, 1, 'machinegun', 2800);
  setOrder(s, 1, 'hold');
  for (const m of mg) {
    m.cooldown = 10;
    m.decisionIn = 1e6;
  }
  run(s, 1);
  assert.ok(
    mg[0].cooldown > 8.9 && mg[0].cooldown <= 9.0,
    `dry MG cooldown dropped to ~9.0 in 1s, got ${mg[0].cooldown.toFixed(2)}`,
  );
  return { cooldown: +mg[0].cooldown.toFixed(2) };
});

fs.writeFileSync(
  path.join(out, 'checks.json'),
  JSON.stringify({ results, failures }, null, 2),
);
console.log(`\n${results.length} checks, ${failures.length} failures`);
if (failures.length) process.exit(1);
