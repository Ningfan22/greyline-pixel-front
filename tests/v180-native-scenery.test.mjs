import test from 'node:test';
import assert from 'node:assert/strict';
import { cloneScenery, refreshVision } from '../game/world.ts';
import { createGame } from '../game/engine.ts';

test('scenery memory copies every field and independently owns damage parts', () => {
  const prop = {id: 9, kind: 'house', x: 320, y: 374, seed: 12,
    building: 2, damageAt: 4, fromStage: 1,
    parts: [{id: 0, x: 300, y: 330, w: 40, h: 44, hp: 80, maxHp: 100,
      kind: 'wall', brokenAt: -Infinity}]};
  const copy = cloneScenery(prop);
  assert.deepEqual(copy, prop);
  assert.notEqual(copy, prop);
  assert.notEqual(copy.parts, prop.parts);
  assert.notEqual(copy.parts[0], prop.parts[0]);
  prop.parts[0].hp = 0;
  prop.parts.push({...prop.parts[0], id: 1});
  assert.equal(copy.parts[0].hp, 80);
  assert.equal(copy.parts.length, 1);
  assert.equal(copy.parts[0].brokenAt, -Infinity);
});

test('battle creation and vision updates work without the browser structuredClone API', () => {
  const original = globalThis.structuredClone;
  try {
    globalThis.structuredClone = undefined;
    const state = createGame();
    assert(state.scenery.length > 0);
    refreshVision(state);
    for (const side of [0, 1]) {
      for (const prop of state.scenery) {
        const remembered = state.knownScenery[side][prop.id];
        assert(remembered);
        assert.notEqual(remembered, prop);
        assert.notEqual(remembered.parts[0], prop.parts[0]);
      }
    }
  } finally {
    globalThis.structuredClone = original;
  }
});
