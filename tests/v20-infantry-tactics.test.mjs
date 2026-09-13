import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as engine from '../game/engine.ts';
import { CARDS } from '../game/cards.ts';
import { tacticalObservation } from './helpers/tactical-observations.mjs';

const seeds = [7, 29, 61];
const rows = (side, kind, seconds = 12) =>
  seeds.map((seed) =>
    tacticalObservation(engine, CARDS, seed, side, kind, seconds),
  );
const mean = (values, key) =>
  values.reduce((n, row) => n + row[key], 0) / values.length;

for (const side of [0, 1]) {
  test(`side ${side}: no enemy means steady advance with no backward movement or fallback plan`, () => {
    for (const row of rows(side, 'none')) {
      assert.equal(row.backwards, 0);
      assert.equal(row.plans, 0);
      assert(row.advance > 500);
      assert.equal(row.alive, 18);
    }
  });
  test(`side ${side}: recruitment price alone cannot rout a full rifle squad; first volleys actually fire`, () => {
    const result = rows(side, 'price');
    assert(result.every((row) => row.plans === 0));
    assert(
      mean(result, 'shots') > 10,
      'the saved price-based AI only fired five shots in this fixture',
    );
  });
  test(`side ${side}: equal infantry forces keep fighting without squad fallback orders`, () => {
    for (const row of rows(side, 'parity')) {
      assert.equal(row.plans, 0);
      assert.equal(row.allBackFrames, 0);
      assert(row.shots > 75);
      assert(row.averageCluster < 10);
    }
  });
  test(`side ${side}: superior machineguns cause bounded fallback with actual covering shots`, () => {
    for (const row of rows(side, 'strong')) {
      assert(
        row.plans >= 1 && row.plans <= 6,
        'three squads cannot continuously restart their intentions',
      );
      assert(row.covered > 40);
      assert(row.shots > 15);
      assert.equal(row.allBackFrames, 0);
      assert(row.averageCluster < 10);
    }
  });
  test(`side ${side}: threat removal ends automatic backward movement instead of completing an obsolete retreat`, () => {
    const result = rows(side, 'gone');
    assert(
      mean(result, 'backAfterGone') < 15,
      'the old engine accumulated over fifty pixels of additional retreat per trial after danger left',
    );
    assert(result.every((row) => row.plans === 1));
  });
  test(`side ${side}: available AT and AA actually shoot and reduce the need to concede ground`, () => {
    for (const kind of ['tank', 'heli']) {
      const bare = rows(side, kind === 'heli' ? 'helicopter' : kind);
      const supported = rows(side, `${kind}_support`);
      assert(supported.every((row) => row.supportShots > 0));
      assert(mean(supported, 'plans') < mean(bare, 'plans'));
      assert(mean(supported, 'hp') > mean(bare, 'hp'));
      if (kind === 'heli')
        assert(
          supported.every((row) => row.shots === 0),
          'rifles do not gain anti-air capability',
        );
    }
  });
  test(`side ${side}: several squads disperse out of a crowded natural depression and keep firing`, () => {
    const result = rows(side, 'crowded');
    assert(
      mean(result, 'averageCluster') < 12,
      'saved baseline stays above fifteen members inside 26px',
    );
    assert(mean(result, 'finalCluster') < 10);
    assert(mean(result, 'shots') > 100);
    assert(result.every((row) => row.covered > 20 && row.allBackFrames === 0));
  });
  test(`side ${side}: repeated real howitzer shells punish crowds but do not annihilate every dispersed squad`, () => {
    const result = rows(side, 'barrage', 22);
    assert(result.every((row) => row.shells >= 6 && row.reactions > 0));
    assert(mean(result, 'averageCluster') < 9);
    assert(
      mean(result, 'alive') >= 3,
      'the saved baseline loses every combatant across these seeds',
    );
    assert(mean(result, 'shots') > 55);
    assert(
      mean(result, 'hp') < CARDS.infantry.hp * 3,
      'dispersion never grants immunity to shelling',
    );
  });
}
