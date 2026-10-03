import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceBattleFrame } from '../game/battle-clock.ts';
import { createGame, startGame, spawnUnit, tick, refreshVision, W } from '../game/engine.ts';

function game(flat = false) {
  const s = createGame(119, undefined, undefined, undefined,
    { weather: false, difficulty: 'standard', mapSeed: 119 });
  startGame(s); s.units = []; s.aiIn = 1e9;
  for (const p of s.players)
    Object.assign(p, { order: 'advance', hand: [], deck: [], discard: [], energy: 0 });
  if (flat) {
    s.scenery = []; s.walls = []; s.wrecks = [];
    s.terrain.fill(374); s.original.fill(374); s.terrainVersion++;
  }
  return s;
}

for (const fps of [120, 60, 30, 20]) {
  test(`${fps} fps: elapsed time, command points and card lockout retain real duration`, () => {
    const s = game(true);
    s.players[0].drawIn = 1;
    s.players[0].jam = 15;
    let remainder = 0;
    for (let i = 0; i < fps * 11; i++)
      remainder = advanceBattleFrame(s, 1 / fps, remainder);
    assert(Math.abs(s.time - 11) < 1e-8, 'slow frames must not slow the battle clock');
    assert(Math.abs(s.players[0].energy - 2) < 1e-8, '5.5-second command point regeneration');
    assert.equal(s.players[0].drawIn, 0);
    assert(Math.abs(s.players[0].jam - 4) < 1e-8, '15-second lockout counts simulation time');
    assert(remainder >= 0 && remainder < 1 / 60);
  });
}

test('uneven frames keep the existing catch-up ceiling and fractional time', () => {
  const s = game(true), control = game(true);
  let remainder = 0, oldRemainder = 0;
  for (const dt of [.004, .013, .020, .042, .002, .025, .8, -.01, .011, .018]) {
    remainder = advanceBattleFrame(s, dt, remainder);
    oldRemainder = Math.min(oldRemainder + Math.max(0, dt), 3 / 60);
    for (let n = 0; oldRemainder >= 1 / 60 && n < 3; n++) {
      tick(control, 1 / 60); oldRemainder -= 1 / 60;
    }
    assert(Math.abs(s.time - control.time) < 1e-10);
    assert.equal(remainder, oldRemainder);
    assert(Math.abs(s.players[0].energy - control.players[0].energy) < 1e-10);
  }
});

for (const fps of [30, 20]) {
  test(`${fps} fps: a fast round still collides with a thin hill between frames`, () => {
    const s = game(true);
    spawnUnit(s, 1, 'tank', 900);
    const target = s.units[0], hp = target.hp;
    for (let x = 790; x < 810; x++) s.terrain[x] = 300;
    s.projectiles.push({ uid: ++s.uid, sourceUid: -1, x: 700, y: 340,
      startX: 700, startY: 340, tx: 900, ty: 340, side: 0,
      targetUid: target.uid, base: null, damage: 200, radius: 0,
      life: .025, total: .025, arc: 0, ammunition: 'ap', tracer: false });
    advanceBattleFrame(s, 1 / fps);
    assert.equal(target.hp, hp);
    assert.equal(s.projectiles.length, 0);
    // AP impacts use sparks, including an intercepted soil hit. Check the
    // actual impact position, not a dust-only effect reserved for rifle hits.
    assert(s.particles.some(p => p.kind === 'spark' && p.x > 780 && p.x < 815),
      'the real impact occurs at the intervening hill, not the target');
  });

  for (const side of [0, 1]) test(`${fps} fps side ${side}: normal village RPGs and tanks keep fighting`, () => {
    const s = game(), x = side ? W - 1500 : 1500, direction = side ? -1 : 1;
    spawnUnit(s, side, 'antiarmor', x);
    spawnUnit(s, 1 - side, 'tank', x + direction * 650);
    refreshVision(s);
    const operator = s.units.find(u => u.side === side && u.member === 0);
    const tank = s.units.find(u => u.side !== side);
    const initialCover = s.scenery.reduce((sum, p) => sum + p.parts.reduce((n, part) => n + part.hp, 0), 0);
    let remainder = 0, rocket = false;
    for (let i = 0; i < fps * 30; i++) {
      remainder = advanceBattleFrame(s, 1 / fps, remainder);
      rocket ||= s.projectiles.some(p => p.sourceUid === operator.uid && p.ammunition === 'rocket');
    }
    assert(operator.shots > 0 && rocket, 'normal anti-tank operators actually launch rockets');
    assert(tank.shots > 0, 'opposing tank returns fire');
    const cover = s.scenery.reduce((sum, p) => sum + p.parts.reduce((n, part) => n + part.hp, 0), 0);
    assert(cover < initialCover, 'projectiles damage real obstructions instead of bypassing cover');
    assert(Math.abs(s.time - 30) < 1e-8);
  });
}
