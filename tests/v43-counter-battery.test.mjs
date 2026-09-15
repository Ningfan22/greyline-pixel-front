import assert from 'node:assert/strict';
import {
  createGame,
  startGame,
  tick,
  spawnUnit,
  refreshVision,
  playCard,
  snapshot,
  detectBattery,
  setOrder,
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

function hand0(s, ids, energy) {
  s.players[0].hand = ids.map((id, i) => ({ id, uid: 20000 + i, readyAt: 0 }));
  s.players[0].energy = energy;
}

function report(s, side, x, life = 15, hits = 1) {
  s.batteryReports.push({
    uid: 900 + s.batteryReports.length,
    x,
    side,
    life,
    maxLife: 20,
    scatter: 60,
    hits,
  });
}

// --- A gun that fires gives away its approximate bearing ---

test('mortar firing produces a sound-ranging fix for the enemy', () => {
  const s = arena();
  const gunners = squad(s, 1, 'mortar', 2800);
  squad(s, 0, 'infantry', 2400);
  setOrder(s, 0, 'hold');
  setOrder(s, 1, 'hold');
  for (const g of gunners) {
    g.cooldown = 0;
    g.decisionIn = 1e6;
  }
  for (const u of s.units) if (u.side === 0) u.cooldown = 1e6;
  refreshVision(s);
  let fired = false;
  for (let i = 0; i < 120 && !fired; i++) {
    tick(s, 0.05);
    fired = s.batteryReports.length > 0;
  }
  assert.ok(fired, 'a mortar shell should generate a battery report');
  const r = s.batteryReports[0];
  assert.equal(r.side, 0, 'the report belongs to the side being shelled');
  assert.ok(r.scatter >= 26 && r.scatter <= 100, `scatter in range: ${r.scatter}`);
  assert.ok(r.hits >= 1, 'at least one hit counted');
  return { reports: s.batteryReports.length, scatter: r.scatter };
});

// --- Repeated shots from the same area refine the fix ---

test('repeated fire converges the fix and tightens the error ellipse', () => {
  const s = arena();
  const [shooter] = squad(s, 1, 'infantry', 2000);
  detectBattery(s, shooter, 2000, 300);
  const first = s.batteryReports[0];
  const scatter1 = first.scatter;
  detectBattery(s, shooter, 2000, 300);
  assert.equal(s.batteryReports.length, 1, 'same battery, one report');
  assert.equal(first.hits, 2, 'second shot increments hits');
  assert.ok(first.scatter < scatter1, `scatter tightened: ${first.scatter} < ${scatter1}`);
  assert.equal(first.life, first.maxLife, 'report refreshed to full life');
  return { hits: first.hits, scatter: first.scatter };
});

// --- A fix goes stale as the battery displaces ---

test('battery report decays and vanishes after twenty seconds', () => {
  const s = arena();
  const [shooter] = squad(s, 1, 'infantry', 2000);
  detectBattery(s, shooter, 2000, 300);
  assert.equal(s.batteryReports.length, 1);
  for (let i = 0; i < 420; i++) tick(s, 0.05);
  assert.equal(s.batteryReports.length, 0, 'stale report is purged');
  return { remaining: s.batteryReports.length };
});

// --- Counter-battery fire on a fresh fix lands tight and burns the report ---

test('howitzer counter-battery fire tightens the sheaf and burns the fix', () => {
  const s = arena();
  const guns = [200, 340, 480].map((x) => squad(s, 0, 'artillery', x));
  report(s, 0, 1400, 15, 2);
  setOrder(s, 0, 'hold');
  for (const g of guns.flat()) {
    g.cooldown = 0;
    g.decisionIn = 1e6;
  }
  refreshVision(s);
  for (let i = 0; i < 240 && s.projectiles.length < 3; i++) tick(s, 0.05);
  assert.ok(s.projectiles.length >= 3, `shells fired: ${s.projectiles.length}`);
  const r = s.batteryReports[0];
  assert.ok(r.life <= 4, `report burned down to ${r.life}s`);
  for (const p of s.projectiles) {
    assert.ok(
      Math.abs(p.tx - 1400) <= 20,
      `tightened sheaf: tx=${p.tx} vs fix 1400`,
    );
  }
  return { life: r.life, deviations: s.projectiles.map((p) => Math.abs(p.tx - 1400)) };
});

// --- Fire nowhere near the fix gains nothing ---

test('howitzer out of range of the fix does not burn it', () => {
  const s = arena();
  squad(s, 0, 'artillery', 200);
  report(s, 0, 2000, 15, 2);
  setOrder(s, 0, 'hold');
  for (const u of s.units) {
    u.cooldown = 0;
    u.decisionIn = 1e6;
  }
  refreshVision(s);
  for (let i = 0; i < 60; i++) tick(s, 0.05);
  assert.equal(s.projectiles.length, 0, 'no shells fired without a target in range');
  const r = s.batteryReports[0];
  assert.ok(r.life > 4, `report only decayed naturally: ${r.life}s`);
  return { life: r.life };
});

// --- The AI shoots its own artillery at a fresh sound-ranging fix ---

test('AI deploys a howitzer that fires at the reported enemy battery', () => {
  const s = arena();
  hand(s, ['artillery'], 4);
  report(s, 1, 2800, 10, 1);
  s.aiIn = 0;
  refreshVision(s);
  tick(s, 0.05);
  assert.equal(s.players[1].played, 1, 'AI should deploy the howitzer');
  const gun = s.units.find((u) => u.side === 1 && u.id === 'artillery');
  assert.ok(gun, 'howitzer spawned');
  for (let i = 0; i < 300 && s.projectiles.length === 0; i++) tick(s, 0.05);
  assert.ok(s.projectiles.length > 0, 'howitzer fired a counter-battery shell');
  const p = s.projectiles[0];
  assert.ok(Math.abs(p.tx - 2800) <= 25, `shell aimed at fix: tx=${p.tx}`);
  return { played: s.players[1].played, tx: p.tx };
});

// --- Each side only sees its own sound-ranging picture ---

test('snapshot exposes only the viewers own battery reports', () => {
  const s = arena();
  report(s, 0, 1500, 10, 1);
  report(s, 1, 2500, 10, 1);
  const snap0 = snapshot(s, 0);
  const snap1 = snapshot(s, 1);
  assert.equal(snap0.batteryReports.length, 1);
  assert.equal(snap0.batteryReports[0].side, 0);
  assert.equal(snap1.batteryReports.length, 1);
  assert.equal(snap1.batteryReports[0].side, 1);
  return { side0: snap0.batteryReports.length, side1: snap1.batteryReports.length };
});

console.log(JSON.stringify(results, null, 2));
if (results.some((r) => !r.ok)) process.exitCode = 1;
