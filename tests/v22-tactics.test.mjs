import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as api from '../game/engine.ts';
import { selectUnitGroup } from '../game/squad-orders.ts';
import {
  arena,
  add,
  at,
  overlaps,
  withdrawal30,
  reverseEscort30,
} from './helpers/v22-observations.mjs';
const dt = 1 / 60;
function rotorScene(
  side,
  id = 'infantry',
  targetId = 'helicopter',
  hidden = false,
) {
  const s = arena(api, side, 733),
    own = add(api, s, side, id, 1200),
    foe = add(api, s, 1 - side, targetId, api.W - 1450)[0];
  own.forEach((u, i) => {
    u.x = at(api, side, 1200 - i * 15);
    u.y = 374;
  });
  selectUnitGroup(s, side, own[0].squad);
  selectUnitGroup(s, 1 - side, foe.squad);
  foe.cooldown = foe.secondaryCooldown = 1e9;
  if (hidden)
    s.smokes.push({ x: at(api, side, 1320), side: 1 - side, life: 40 });
  api.refreshVision(s);
  return { s, own, foe };
}
function volley(r, seconds) {
  const ids = new Set(r.own.map((u) => u.uid)),
    shots = new Map(),
    initial = r.foe.hp;
  let killedAt = null;
  for (let i = 0; i < seconds * 60; i++) {
    api.tick(r.s, dt);
    for (const p of r.s.projectiles)
      if (ids.has(p.sourceUid) && !shots.has(p.uid)) shots.set(p.uid, { ...p });
    if (r.foe.hp <= 0) {
      killedAt = r.s.time;
      break;
    }
  }
  return { shots: [...shots.values()], damage: initial - r.foe.hp, killedAt };
}
for (const side of [0, 1]) {
  test(`side ${side}: rifles fire upward at visible rotorcraft, with rare low-damage actual hits`, () => {
    const r = rotorScene(side),
      positions = r.own.map((u) => u.x);
    assert(api.visibleToSide(r.s, side, r.foe));
    const v = volley(r, 30);
    assert(
      v.shots.length >= 150,
      'the squad actually fires during the complete 30 seconds',
    );
    assert(
      v.shots.every(
        (p) => p.targetUid === r.foe.uid && p.smallArmsAir && p.ty < p.startY,
      ),
    );
    assert(
      v.shots.every(
        (p) =>
          p.damage <= 0.5 &&
          p.startLane !== undefined &&
          p.targetLane !== undefined,
      ),
    );
    assert(
      v.damage > 0 && v.damage < r.foe.maxHp * 0.08,
      'a rifle squad cannot replace a real anti-air weapon',
    );
    assert(
      v.damage < v.shots.reduce((n, p) => n + p.damage, 0) * 0.25,
      'most projectiles really miss in depth',
    );
    assert.deepEqual(
      r.own.map((u) => u.x),
      positions,
      'manual watch remains stationary while returning fire',
    );
    console.log(
      'V22_ROTOR',
      JSON.stringify({ side, shots: v.shots.length, damage: v.damage }),
    );
  });
  test(`side ${side}: real MANPADS retain their guided hit and damage against helicopters`, () => {
    const r = rotorScene(side, 'manpads'),
      v = volley(r, 8);
    assert(v.killedAt !== null && v.killedAt < 8);
    assert(v.shots.length > 0 && v.shots.every((p) => !p.smallArmsAir));
  });
  test(`side ${side}: smoke-concealed helicopters cannot be acquired by rifles`, () => {
    const r = rotorScene(side, 'infantry', 'helicopter', true);
    assert(!api.visibleToSide(r.s, side, r.foe));
    const v = volley(r, 4);
    assert.equal(v.shots.length, 0);
    assert.equal(v.damage, 0);
  });
  test(`side ${side}: rifles never acquire a fast fixed-wing aircraft crossing their range`, () => {
    const r = rotorScene(side, 'infantry', 'strike_jet');
    assert(api.visibleToSide(r.s, side, r.foe));
    const v = volley(r, 5);
    assert.equal(v.shots.length, 0);
    assert.equal(v.damage, 0);
  });
  for (const kind of ['tank', 'helicopter'])
    test(`side ${side}: four unsupported squads keep withdrawing during 30 seconds of real ${kind} fire`, () => {
      const r = withdrawal30(api, side, kind),
        m = r.metrics,
        live = r.own.filter(api.isCombatant);
      assert(
        r.foe.shots + r.foe.secondaryShots > 5,
        'the hostile weapon actually fires',
      );
      assert(
        m.forward < 1 && m.back > 1800 && m.meanRetreat > 300,
        'the old one-bound stop cannot return',
      );
      assert(
        m.exposedFrames > 1000 && m.idleThreat / m.exposedFrames < 0.68,
        'phased covering pauses cannot consume nearly the whole exposure period',
      );
      assert(
        m.backShots > 0,
        'stationary members actually fire while other members backpedal',
      );
      assert(
        live.length >= 4 &&
          Math.max(...live.map((u) => u.x)) -
            Math.min(...live.map((u) => u.x)) >
            120,
      );
      assert(
        m.peakOverlap <= 12 && overlaps(live) <= 8,
        'four squads must not collapse onto one retreat destination',
      );
      if (kind === 'tank')
        assert(
          m.nearAtEnd <= 3,
          'most surviving infantry actually exit the tank firing envelope',
        );
      console.log(
        'V22_WITHDRAWAL',
        JSON.stringify({ ...m, finalOverlap: overlaps(live) }),
      );
    });
  test(`side ${side}: three escort squads follow a reversing tank without entering its body or merging ranks`, () => {
    const r = reverseEscort30(api, side),
      m = r.metrics;
    assert.equal(
      m.bodyOverlapFrames,
      0,
      'a valid following column cannot brake itself under the tank',
    );
    assert.equal(m.peakOverlap, 0);
    assert.equal(m.finalPairs, 0);
    assert(m.shots > 0, 'following members still engage visible infantry');
    assert(m.meanGap > 150 && m.meanGap < 280);
    for (const u of r.own) assert((r.tank.x - u.x) * (side ? -1 : 1) > 85);
    console.log('V22_ESCORT', JSON.stringify(m));
  });
  test(`side ${side}: selected medic stays put, then treats a wounded soldier who is actually within reach`, () => {
    const s = arena(api, side),
      own = add(api, s, side, 'medic', 1200),
      patient = add(api, s, side, 'infantry', 1340)[0];
    own.forEach((u) => {
      u.x = at(api, side, 1200);
      u.y = 374;
    });
    patient.x = at(api, side, 1320);
    patient.y = 374;
    patient.wounded = true;
    patient.hp = 8;
    patient.bleed = 100;
    // No mobile companion should move this casualty into range during the test.
    s.units = [...own, patient];
    selectUnitGroup(s, side, own[0].squad);
    const positions = own.map((u) => u.x);
    for (let i = 0; i < 120; i++) api.tick(s, dt);
    assert.deepEqual(
      own.map((u) => u.x),
      positions,
    );
    assert.equal(patient.rescueProgress, 0);
    patient.x = at(api, side, 1240);
    const progress = patient.rescueProgress;
    for (let i = 0; i < 60; i++) api.tick(s, dt);
    assert.deepEqual(
      own.map((u) => u.x),
      positions,
    );
    assert(patient.rescueProgress > progress || !patient.wounded);
  });
}
