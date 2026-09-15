import assert from 'node:assert/strict';
import {
  createGame,
  startGame,
  tick,
  spawnUnit,
  refreshVision,
  setOrder,
} from '../game/engine.ts';
import { unitSynergy, synergyProviderUid } from '../game/synergy.ts';

const DT = 1 / 60;
const results = [],
  failures = [];

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
  const s = createGame(75001);
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

function spawn(s, side, id, x) {
  const at = s.units.length;
  spawnUnit(s, side, id, x);
  return s.units.slice(at);
}

// Flat arena with an indirect-fire receiver at rx and a spotter at sx.
// Every unit is silenced and frozen so the scenario measures recon_spot
// and nothing else.
function scene({
  receiverId = 'artillery',
  receiverSide = 0,
  spotterId = 'rangers',
  spotterSide = 0,
  rx = 2000,
  sx = 2200,
  withSpotter = true,
} = {}) {
  const s = arena();
  const receiver = spawn(s, receiverSide, receiverId, rx);
  let spotter = [];
  if (withSpotter) spotter = spawn(s, spotterSide, spotterId, sx);
  setOrder(s, 0, 'hold');
  setOrder(s, 1, 'hold');
  for (const v of [...receiver, ...spotter]) {
    v.cooldown = 1e6;
    v.decisionIn = 1e6;
    v.hp = 99999;
    v.maxHp = 99999;
  }
  refreshVision(s);
  return { s, receiver, spotter };
}

function run(s, seconds) {
  for (let i = 0; i < Math.round(seconds / DT); i++) tick(s, DT);
}

// --- Provider types ---

check('rangers (trait scout) spot for nearby artillery', () => {
  const { s, receiver } = scene({ spotterId: 'rangers' });
  run(s, 1.5);
  const syn = unitSynergy(s, receiver[0], s.time);
  assert.equal(syn.recon_spot, true, 'rangers should spot for artillery');
  return { recon_spot: syn.recon_spot };
});

check('scout marksmen (trait scout) spot for nearby artillery', () => {
  const { s, receiver } = scene({ spotterId: 'scouts' });
  run(s, 1.5);
  const syn = unitSynergy(s, receiver[0], s.time);
  assert.equal(syn.recon_spot, true, 'scouts should spot for artillery');
  return { recon_spot: syn.recon_spot };
});

check('a recon quadcopter (observer) spots for nearby artillery', () => {
  const { s, receiver } = scene({ spotterId: 'scout_drone' });
  run(s, 1.5);
  const syn = unitSynergy(s, receiver[0], s.time);
  assert.equal(syn.recon_spot, true, 'scout drone should spot for artillery');
  return { recon_spot: syn.recon_spot };
});

// --- Receiver types ---

check('a mortar team receives recon_spot', () => {
  const { s, receiver } = scene({ receiverId: 'mortar' });
  run(s, 1.5);
  const syn = unitSynergy(s, receiver[0], s.time);
  assert.equal(syn.recon_spot, true, 'mortar should be spotted');
  return { recon_spot: syn.recon_spot };
});

check('a mortar carrier receives recon_spot', () => {
  const { s, receiver } = scene({ receiverId: 'mortar_carrier' });
  run(s, 1.5);
  const syn = unitSynergy(s, receiver[0], s.time);
  assert.equal(syn.recon_spot, true, 'mortar carrier should be spotted');
  return { recon_spot: syn.recon_spot };
});

check('a precision howitzer receives recon_spot', () => {
  const { s, receiver } = scene({ receiverId: 'precision' });
  run(s, 1.5);
  const syn = unitSynergy(s, receiver[0], s.time);
  assert.equal(syn.recon_spot, true, 'precision howitzer should be spotted');
  return { recon_spot: syn.recon_spot };
});

// --- Provider linkage ---

check('the provider uid links back to the spotter', () => {
  const { s, receiver, spotter } = scene({ spotterId: 'rangers' });
  run(s, 1.5);
  const uid = synergyProviderUid(s, receiver[0], 'recon_spot', s.time);
  assert.ok(
    spotter.some((m) => m.uid === uid),
    `provider uid ${uid} should be one of the spotter members`,
  );
  return { providerUid: uid };
});

// --- Negative: wrong provider ---

check('mountain troops (trait mountain) do not spot', () => {
  const { s, receiver } = scene({ spotterId: 'mountain' });
  run(s, 1.5);
  const syn = unitSynergy(s, receiver[0], s.time);
  assert.equal(syn.recon_spot, false, 'mountain is not a scout trait');
  return { recon_spot: syn.recon_spot };
});

// --- Negative: range / side ---

check('a spotter beyond 500px does not provide recon_spot', () => {
  const { s, receiver } = scene({ sx: 2800 });
  run(s, 1.5);
  const syn = unitSynergy(s, receiver[0], s.time);
  assert.equal(syn.recon_spot, false, 'an 800px-distant spotter is out of range');
  return { recon_spot: syn.recon_spot };
});

check('an enemy spotter does not provide recon_spot', () => {
  const { s, receiver } = scene({ spotterSide: 1 });
  run(s, 1.5);
  const syn = unitSynergy(s, receiver[0], s.time);
  assert.equal(syn.recon_spot, false, 'enemy scouts must not spot for our guns');
  return { recon_spot: syn.recon_spot };
});

// --- Negative: wrong receiver ---

check('infantry do not receive recon_spot', () => {
  const { s, receiver } = scene({ receiverId: 'infantry' });
  run(s, 1.5);
  const syn = unitSynergy(s, receiver[0], s.time);
  assert.equal(syn.recon_spot, false, 'infantry are not indirect fire');
  return { recon_spot: syn.recon_spot };
});

check('a bomber (air, indirect) does not receive recon_spot', () => {
  const { s, receiver } = scene({ receiverId: 'bomber' });
  run(s, 1.5);
  const syn = unitSynergy(s, receiver[0], s.time);
  assert.equal(syn.recon_spot, false, 'aircraft are not ground fire missions');
  return { recon_spot: syn.recon_spot };
});

check('a barrage (pre-planned salvo) does not receive recon_spot', () => {
  const { s, receiver } = scene({ receiverId: 'barrage' });
  run(s, 1.5);
  const syn = unitSynergy(s, receiver[0], s.time);
  assert.equal(
    syn.recon_spot,
    false,
    'barrage fires a pre-planned five-round salvo; observers tighten its spread but cannot speed its cycle',
  );
  return { recon_spot: syn.recon_spot };
});

// --- Negative: spotter casualties ---

check('a dead spotter does not provide recon_spot', () => {
  const { s, receiver, spotter } = scene({ spotterId: 'scout_drone' });
  run(s, 1.0);
  for (const m of spotter) m.hp = 0;
  run(s, 1.0);
  const syn = unitSynergy(s, receiver[0], s.time);
  assert.equal(syn.recon_spot, false, 'a dead drone cannot spot');
  return { recon_spot: syn.recon_spot };
});

check('a wounded spotter does not provide recon_spot', () => {
  const { s, receiver, spotter } = scene({ spotterId: 'rangers' });
  run(s, 1.0);
  for (const m of spotter) m.wounded = true;
  run(s, 1.0);
  const syn = unitSynergy(s, receiver[0], s.time);
  assert.equal(syn.recon_spot, false, 'a wounded scout cannot spot');
  return { recon_spot: syn.recon_spot };
});

check('a surrendered spotter does not provide recon_spot', () => {
  const { s, receiver, spotter } = scene({ spotterId: 'rangers' });
  run(s, 1.0);
  for (const m of spotter) m.surrendered = true;
  run(s, 1.0);
  const syn = unitSynergy(s, receiver[0], s.time);
  assert.equal(syn.recon_spot, false, 'a surrendered scout cannot spot');
  return { recon_spot: syn.recon_spot };
});

// --- Effect: cooldown recovery 1.3x ---

check('recon_spot speeds cooldown recovery 1.3x', () => {
  const spotted = scene();
  run(spotted.s, 1.5);
  const gun = spotted.receiver[0];
  gun.cooldown = 1000;
  run(spotted.s, 10);
  const spottedDelta = 1000 - gun.cooldown;

  const unspotted = scene({ withSpotter: false });
  run(unspotted.s, 1.5);
  const gun2 = unspotted.receiver[0];
  gun2.cooldown = 1000;
  run(unspotted.s, 10);
  const unspottedDelta = 1000 - gun2.cooldown;

  // 10s * 1.3 = 13 (spotted) vs 10s * 1.0 = 10 (unspotted)
  assert.ok(
    spottedDelta >= 12.5,
    `spotted gun should recover ~13s of cooldown, got ${spottedDelta.toFixed(2)}`,
  );
  assert.ok(
    unspottedDelta <= 10.5,
    `unspotted gun should recover ~10s of cooldown, got ${unspottedDelta.toFixed(2)}`,
  );
  assert.ok(
    spottedDelta > unspottedDelta * 1.25,
    `spotted recovery ${spottedDelta.toFixed(2)} should be 1.3x unspotted ${unspottedDelta.toFixed(2)}`,
  );
  return {
    spotted: +spottedDelta.toFixed(2),
    unspotted: +unspottedDelta.toFixed(2),
  };
});

// --- Symmetry ---

check('both sides can use recon_spot', () => {
  const s = arena();
  const redGun = spawn(s, 1, 'artillery', 1000);
  const redScout = spawn(s, 1, 'rangers', 1200);
  for (const v of [...redGun, ...redScout]) {
    v.cooldown = 1e6;
    v.decisionIn = 1e6;
    v.hp = 99999;
    v.maxHp = 99999;
  }
  setOrder(s, 1, 'hold');
  refreshVision(s);
  run(s, 1.5);
  const syn = unitSynergy(s, redGun[0], s.time);
  assert.equal(syn.recon_spot, true, 'side 1 artillery should be spotted by side 1 rangers');
  return { recon_spot: syn.recon_spot };
});

// --- Report ---

console.log(`\n${results.length} checks, ${failures.length} failures`);
if (failures.length) {
  for (const f of failures) console.error('FAIL:', f.name, f.error);
  process.exit(1);
}
