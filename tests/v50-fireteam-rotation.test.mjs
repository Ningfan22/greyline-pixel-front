import assert from 'node:assert/strict';
import {
  createGame,
  startGame,
  tick,
  spawnUnit,
  squadRoleOffset,
  isCombatant,
} from '../game/engine.ts';

const DT = 1 / 60;
const results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, error: error.message });
  }
}

// --- pure-function harness ---------------------------------------------------

function stubState() {
  return { time: 0, squadManeuver: {} };
}
function stubSquad(squad, n = 6) {
  const members = [];
  for (let i = 0; i < n; i++) {
    members.push({
      squad,
      hp: 100,
      surrendered: false,
      wounded: false,
      suppression: 0,
    });
  }
  return members;
}
// Steps the contact clock in <=1.5s increments: a gap over 3s between calls
// counts as a fresh engagement and re-clocks the squad, so large jumps would
// hide the cadence the tests are measuring.
function advance(s, u, survivors, seconds) {
  let remaining = seconds;
  while (remaining > 1e-9) {
    const step = Math.min(1.5, remaining);
    s.time += step;
    remaining -= step;
    squadRoleOffset(s, u, survivors);
  }
}

// --- pure-function tests -----------------------------------------------------

test('rotation: first contact records squad state with offset 0', () => {
  const s = stubState();
  const squad = stubSquad(3);
  assert.equal(squadRoleOffset(s, squad[0], squad), 0);
  assert.deepEqual(s.squadManeuver[3], {
    offset: 0,
    lastRotate: 0,
    lastContact: 0,
  });
});

test('rotation: squad%3===0 rotates on the 5.2s cadence', () => {
  const s = stubState();
  const squad = stubSquad(3); // 3 % 3 === 0 -> cadence 5.2s
  squadRoleOffset(s, squad[0], squad); // establish contact at t=0
  advance(s, squad[0], squad, 5.1);
  assert.equal(squadRoleOffset(s, squad[0], squad), 0);
  advance(s, squad[0], squad, 0.2); // t=5.3, past the 5.2s cadence
  assert.equal(squadRoleOffset(s, squad[0], squad), 1);
  advance(s, squad[0], squad, 5.2); // t=10.5, second rotation
  assert.equal(squadRoleOffset(s, squad[0], squad), 2);
});

test('rotation: freezes under 3 combatants, rotates on recovery', () => {
  const s = stubState();
  const squad = stubSquad(3);
  squadRoleOffset(s, squad[0], squad);
  squad[2].wounded = true;
  squad[3].wounded = true;
  squad[4].wounded = true;
  squad[5].wounded = true; // 2 combatants left
  assert.equal(isCombatant(squad[2]), false);
  advance(s, squad[0], squad, 10);
  assert.equal(squadRoleOffset(s, squad[0], squad), 0);
  // The clock kept running while frozen, so recovery rotates immediately.
  squad[2].wounded = false; // 3 combatants again
  assert.equal(squadRoleOffset(s, squad[0], squad), 1);
});

test('rotation: freezes at avg suppression >= 50, rotates below', () => {
  const s = stubState();
  const squad = stubSquad(3);
  squadRoleOffset(s, squad[0], squad);
  for (const m of squad) m.suppression = 50;
  advance(s, squad[0], squad, 10);
  assert.equal(squadRoleOffset(s, squad[0], squad), 0);
  for (const m of squad) m.suppression = 49;
  advance(s, squad[0], squad, 5.2);
  assert.equal(squadRoleOffset(s, squad[0], squad), 1);
});

test('rotation: suppression freeze uses the squad average', () => {
  const s = stubState();
  const squad = stubSquad(3, 3);
  squadRoleOffset(s, squad[0], squad);
  squad[0].suppression = 80;
  squad[1].suppression = 80;
  squad[2].suppression = 20; // avg 60 -> frozen despite one fresh member
  advance(s, squad[0], squad, 10);
  assert.equal(squadRoleOffset(s, squad[0], squad), 0);
});

test('rotation: a contact gap over 3s re-clocks a fresh engagement', () => {
  const s = stubState();
  const squad = stubSquad(3);
  squadRoleOffset(s, squad[0], squad);
  advance(s, squad[0], squad, 5.2); // first rotation
  assert.equal(s.squadManeuver[3].offset, 1);
  s.time += 4; // contact lost for 4s (no rotation calls)
  squadRoleOffset(s, squad[0], squad); // re-establish: no instant rotate
  assert.equal(s.squadManeuver[3].offset, 1);
  advance(s, squad[0], squad, 5.1);
  assert.equal(squadRoleOffset(s, squad[0], squad), 1); // still fresh
  advance(s, squad[0], squad, 0.2); // 5.3s after re-contact
  assert.equal(squadRoleOffset(s, squad[0], squad), 2);
});

test('rotation: cadence tiers by squad%3 (5.2 / 5.9 / 6.6)', () => {
  for (const [squadId, cadence] of [
    [3, 5.2],
    [4, 5.9],
    [5, 6.6],
  ]) {
    const s = stubState();
    const squad = stubSquad(squadId);
    squadRoleOffset(s, squad[0], squad);
    advance(s, squad[0], squad, cadence - 0.1);
    assert.equal(
      squadRoleOffset(s, squad[0], squad),
      0,
      `squad ${squadId} should not rotate at ${cadence - 0.1}s`,
    );
    advance(s, squad[0], squad, 0.2); // past the cadence
    assert.equal(
      squadRoleOffset(s, squad[0], squad),
      1,
      `squad ${squadId} should rotate at ${cadence}s`,
    );
  }
});

test('rotation: 20s engagement rotates >=3 times, monotonically', () => {
  const s = stubState();
  const squad = stubSquad(3);
  squadRoleOffset(s, squad[0], squad);
  let prev = 0;
  for (let t = 1.5; t <= 20; t += 1.5) {
    s.time = t;
    const off = squadRoleOffset(s, squad[0], squad);
    assert.ok(off >= prev, `offset decreased at t=${t}`);
    prev = off;
  }
  assert.ok(prev >= 3, `expected >=3 rotations in 20s, got ${prev}`);
});

// --- integration test --------------------------------------------------------

function battle(seed = 50001) {
  const s = createGame(seed);
  startGame(s);
  Object.assign(s, { scenery: [], walls: [], wrecks: [] });
  s.players.forEach((p) => (p.order = 'hold'));
  return s;
}
function spawnOne(s, side, id, x) {
  const before = s.units.length;
  spawnUnit(s, side, id, x);
  const u = s.units.slice(before).find((v) => v.id === id);
  u.x = x;
  return u;
}

test('integration: opposing infantries rotate fire teams under contact', () => {
  const s = battle();
  const a = spawnOne(s, 0, 'infantry', 800);
  const b = spawnOne(s, 1, 'infantry', 1210); // 410px gap < 420px contact
  const squadA = a.squad;
  // Silence both sides so nobody fires: no suppression, no casualties.
  for (const u of s.units) u.cooldown = 1e6;
  // Pin the AI squads: updateAI overrides the player order, but squadOrder
  // wins in infantryOrder and commandAiSquads never clears a manual hold.
  for (const u of s.units) {
    if (u.side === 1) {
      u.squadOrder = 'hold';
      u.squadOrderUntil = 1e9;
    }
  }
  // Stop the AI from playing cards (reinforcements / artillery would break
  // the isolation): an empty deck+discard makes requestDraw fail.
  const ai = s.players[1];
  ai.deck = [];
  ai.discard = [];
  ai.hand = [];

  for (let i = 0; i < 60 * 14; i++) tick(s, DT);

  const rec = s.squadManeuver?.[squadA];
  assert.ok(rec, 'squad maneuver record should exist');
  assert.ok(rec.offset >= 1, `expected at least one rotation, offset=${rec.offset}`);
  const tactics = new Set(
    s.units
      .filter((u) => u.side === 0 && u.squad === squadA && isCombatant(u))
      .map((u) => u.tactic),
  );
  assert.ok(
    tactics.size >= 2,
    `expected >=2 distinct tactics in the squad, got ${[...tactics]}`,
  );
});

// --- report -------------------------------------------------------------------

let failed = 0;
for (const r of results) {
  if (r.ok) console.log(`ok - ${r.name}`);
  else {
    failed++;
    console.error(`FAIL - ${r.name}: ${r.error}`);
  }
}
console.log(`${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
