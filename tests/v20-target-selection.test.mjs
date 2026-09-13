import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as engine from '../game/engine.ts';
import { targetExchange } from './helpers/target-exchange.mjs';

for (const side of [0, 1]) {
  for (const weapon of ['infantry', 'militia', 'machinegun', 'armed_police']) {
    test(`side ${side}: ${weapon} fires at and damages exposed infantry instead of the nearer tank`, () => {
      const row = targetExchange(engine, side, weapon);
      assert.equal(row.softVisible, true);
      assert(row.shots.length > 0);
      assert.equal(row.shots[0].target, 'soft');
      assert(row.shots.every((p) => !p.softAlive || p.target === 'soft'));
      assert(
        row.softDamage > 0,
        'actual projectile hits, not only a target-state change',
      );
    });
  }
  test(`side ${side}: an unarmored pickup also outranks a nearer tank for ordinary rifles`, () => {
    const row = targetExchange(engine, side, 'infantry', { softId: 'pickup' });
    assert.equal(row.shots[0].target, 'soft');
    assert(row.softDamage > 0);
  });
  for (const obstruction of ['terrain', 'smoke']) {
    test(`side ${side}: ${obstruction} prevents selecting an illegal soft target and does not stop valid fire`, () => {
      const row = targetExchange(engine, side, 'infantry', { obstruction });
      assert.equal(row.softVisible, obstruction === 'terrain');
      assert(row.shots.length > 0);
      assert(row.shots.every((p) => p.target === 'armor'));
      assert.equal(
        row.softDamage,
        0,
        'the preference cannot shoot through hard cover or acquire unseen infantry',
      );
      assert(
        row.armorDamage > 0,
        'legal fallback target still receives real hits',
      );
    });
  }
  for (const weapon of ['antiarmor', 'javelin']) {
    test(`side ${side}: ${weapon} keeps firing its primary weapon at armor with closer infantry present`, () => {
      const row = targetExchange(engine, side, weapon, { specialist: 'armor' });
      assert(
        row.shots.length > 0 && row.shots.every((p) => p.target === 'armor'),
      );
      assert(row.armorDamage > 0);
    });
  }
  test(`side ${side}: MANPADS still selects and hits aircraft ahead of closer ground infantry`, () => {
    const row = targetExchange(engine, side, 'manpads', { specialist: 'air' });
    assert(
      row.shots.length > 0 && row.shots.every((p) => p.target === 'armor'),
    );
    assert(row.armorDamage > 0);
  });
}
