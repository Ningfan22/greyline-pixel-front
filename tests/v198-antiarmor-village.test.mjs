import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, startGame, spawnUnit, tick, refreshVision, W } from '../game/engine.ts';

for (const side of [0, 1]) {
  test(`side ${side}: a normal RPG squad clears a village firing lane instead of waiting forever behind the standoff boundary`, () => {
    const s = createGame(119, undefined, undefined, undefined,
      { weather: false, difficulty: 'standard', mapSeed: 119 });
    startGame(s); s.units = []; s.aiIn = 1e9;
    for (const p of s.players) Object.assign(p, { order: 'advance', hand: [], deck: [], discard: [], energy: 0 });
    const x = side ? W - 1500 : 1500, d = side ? -1 : 1;
    spawnUnit(s, side, 'antiarmor', x);
    spawnUnit(s, 1 - side, 'tank', x + d * 650);
    refreshVision(s);
    const operator = s.units.find(u => u.side === side && u.member === 0), tank = s.units.find(u => u.side !== side);
    assert.equal(operator.hp, 50); assert.equal(tank.hp, 650);
    const initial = operator.shots, sceneryHealth = s.scenery.reduce((sum, prop) => sum + prop.parts.reduce((n, part) => n + part.hp, 0), 0);
    let firstFire = null, previous = initial, minimumShotDistance = Infinity, actualRocket = false;
    while (s.time < 30 - 1e-8) {
      tick(s, 1 / 60);
      if (operator.shots > previous) {
        firstFire ??= s.time;
        minimumShotDistance = Math.min(minimumShotDistance, Math.abs(operator.x - tank.x));
        actualRocket ||= s.projectiles.some(p => p.sourceUid === operator.uid && p.ammunition === 'rocket');
      }
      previous = operator.shots;
    }
    assert(firstFire !== null && firstFire < 30,
      `normal terrain must not strand a healthy loaded operator: ${JSON.stringify({ x: operator.x, pose: operator.pose, shots: operator.shots - initial, ammo: operator.ammo })}`);
    assert(actualRocket, 'a counter increment alone is not evidence of a real launched missile');
    assert(minimumShotDistance >= 250, 'finding the lane is a bounded standoff move, not a charge into the tank');
    const remaining = s.scenery.reduce((sum, prop) => sum + prop.parts.reduce((n, part) => n + part.hp, 0), 0);
    assert(remaining < sceneryHealth, 'real impacts clear destructible cover instead of shooting through it');
  });
}
