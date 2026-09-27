import test from 'node:test';
import assert from 'node:assert/strict';
import { CARDS, createGame, playCard, startGame, tick, W } from '../game/engine.ts';

test('air assault costs four points while the helicopter still delivers infantry', () => {
  assert.equal(CARDS.air_assault.cost, 4);
  assert.equal(CARDS.air_assault.airlift, 'paratroopers');
  assert.equal(CARDS.air_assault.air, true);
  assert.equal(CARDS.air_assault.type, 'unit');
});

for (const side of [0, 1]) {
  test(`side ${side} airborne anti-tank rockets attack the enemy base`, () => {
    const s = createGame(188 + side);
    startGame(s);
    s.aiIn = 1e9;
    s.terrain.fill(374);
    s.original.fill(374);
    s.scenery = [];
    s.walls = [];
    const attacker = s.players[side];
    const enemySide = 1 - side;
    attacker.energy = 10;
    const token = { id: 'airborne_at', uid: ++s.uid };
    attacker.hand = [token];
    const landing = side === 0 ? W - 520 : 520;
    assert.equal(playCard(s, side, token.uid, landing).ok, true);
    const initialHp = s.players[enemySide].hp;
    for (let frame = 0; frame < 600; frame++) tick(s, 1 / 60);
    const rockets = s.units.filter((u) =>
      u.side === side && u.id === 'airborne_at' && u.member < 2);
    assert.equal(rockets.length, 2);
    assert(rockets.every((u) => u.shots > 0), 'both rocket operators should fire');
    assert(s.players[enemySide].hp < initialHp, 'the base should take damage');
  });
}
