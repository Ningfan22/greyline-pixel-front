import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, startGame, spawnUnit, tick, W } from '../game/engine.ts';

for (const side of [0, 1]) for (const id of ['mlrs', 'light_tank', 'tank', 'heavy_tank']) {
  test(`${id} side ${side}: full logistics reaches an enemy HQ firing line before returning for fuel`, () => {
    // Keep the seeded village hills/obstacles and the normal weapon/movement
    // decisions. No watch orders, free fuel, forced cooldowns or teleports.
    const s = createGame(198, undefined, undefined, undefined, { weather: false, difficulty: 'standard', mapSeed: 198 });
    startGame(s); s.units = []; s.aiIn = 1e9;
    for (const p of s.players) Object.assign(p, { order: 'advance', hand: [], deck: [], discard: [], energy: 0 });
    spawnUnit(s, side, id, side ? W - 110 : 110);
    const u = s.units[0], enemy = s.players[1 - side], initialHp = enemy.hp, initialShots = u.shots;
    let firstReturn, hit = false;
    for (let i = 0; i < 60 * 200; i++) {
      tick(s, 1 / 60);
      if (u.resupplyState === 'withdrawing' && firstReturn === undefined) firstReturn = s.time;
      if (enemy.hp < initialHp) { hit = true; break; }
    }
    assert(hit, `${id} must actually damage the HQ: ${JSON.stringify({ x: u.x, fuel: u.fuel, shots: u.shots, firstReturn, hp: enemy.hp })}`);
    assert.equal(firstReturn, undefined, 'a full deployment must not make an empty round trip before first contact');
    assert(u.shots > initialShots && u.ammo < (id === 'light_tank' ? 14 : id === 'heavy_tank' ? 10 : 12));
    assert(u.fuel < 70 && u.fuel > 30, 'cross-map travel still visibly consumes finite fuel');
  });
}
