import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { createGame, startGame, spawnUnit } from '../game/engine.ts';
import { adultFrameChoice } from '../game/adult-animation.ts';
import { specialistSprite } from '../game/adult-specialists.ts';
import {
  weaponStanceAtlas,
  LOWER_WEAPON_CELS,
  packedWeaponStances,
} from '../game/weapon-stance-art.ts';
const { createCanvas, loadImage } = createRequire(import.meta.url)(
  '@napi-rs/canvas',
);
globalThis.document = { createElement: () => createCanvas(1, 1) };
const base = createCanvas(96, 96);
function bank() {
  const stance16 = Array.from({ length: 16 }, () => ({
    image: createCanvas(128, 96),
    waist: [64, 80],
    muzzle: [96, 68],
  }));
  stance16[8] = stance16[7];
  return {
    standing: stance16[0],
    crouch: stance16[7],
    prone: stance16[15],
    stance16,
  };
}
const stances = { machinegun: bank(), rocket: bank(), sniper: bank() };
const legacy = { machinegun: bank(), rocket: bank(), sniper: bank() };
for (const set of Object.values(legacy)) delete set.stance16;
function one(id, member = 0) {
  const s = createGame(147);
  startGame(s);
  spawnUnit(s, 0, id, 900);
  const u = s.units.find((u) => u.id === id && u.member === member);
  assert(u);
  Object.assign(u, {
    pose: 'idle',
    motion: 'ground',
    moving: false,
    climbing: 0,
    flash: 0,
    fire: 0,
    secondaryFire: 0,
    wounded: false,
    surrendered: false,
    rappelling: false,
    parachuting: false,
    fragThrow: 0,
    poseAnimAt: undefined,
    poseAnimFrom: undefined,
    poseAnimSeen: 'stand',
  });
  return u;
}
const roles = [
  ['machinegun', 'machinegun'],
  ['lmg_team', 'machinegun'],
  ['rocket', 'rocket'],
  ['javelin', 'rocket'],
  ['antiarmor', 'rocket'],
  ['airborne_at', 'rocket'],
  ['sniper', 'sniper'],
  ['sniper_team', 'sniper'],
];

test('weapon roles retain their own complete bodies through every posture cel', () => {
  for (const [id, role] of roles) {
    const u = one(id);
    for (let i = 0; i < 16; i++)
      assert.equal(
        specialistSprite(
          base,
          { group: 'stance16', index: i },
          u,
          legacy,
          stances,
        )?.image,
        stances[role].stance16[i].image,
        `${id} frame ${i}`,
      );
  }
});

test('settled standing, kneeling and prone endpoints are the identical painted transition body', () => {
  for (const [id, role] of roles) {
    const u = one(id);
    for (const [pose, index, cel] of [
      ['idle', 0, 0],
      ['crouch', 1, 7],
      ['prone', 2, 15],
    ]) {
      u.pose = pose;
      const body = specialistSprite(
        base,
        { group: 'actions20', index },
        u,
        legacy,
        stances,
      );
      assert.equal(body.image, stances[role].stance16[cel].image);
      assert.deepEqual(body.muzzle, { x: 32, height: 28 });
    }
  }
});

test('guards and precision observers are not promoted to a second specialist weapon', () => {
  for (const [id, member] of [
    ['machinegun', 1],
    ['lmg_team', 1],
    ['antiarmor', 1],
    ['airborne_at', 2],
    ['sniper_team', 1],
  ]) {
    const u = one(id, member);
    for (const choice of [
      { group: 'stance16', index: 5 },
      { group: 'actions20', index: 0 },
    ])
      assert.equal(
        specialistSprite(base, choice, u, legacy, stances),
        null,
        `${id}/${member}`,
      );
  }
});

test('portable weapon art cannot replace heavy tripod setup, casualties or authored work', () => {
  const u = one('heavy_mg');
  assert.equal(
    specialistSprite(base, { group: 'stance16', index: 5 }, u, legacy, stances),
    null,
  );
  assert.equal(
    specialistSprite(base, { group: 'actions20', index: 0 }, u, legacy, stances)
      .image,
    legacy.machinegun.standing.image,
  );
  for (const patch of [{ hp: 0 }, { wounded: true }, { surrendered: true }]) {
    const v = one('rocket');
    Object.assign(v, patch);
    assert.equal(
      specialistSprite(
        base,
        { group: 'stance16', index: 5 },
        v,
        legacy,
        stances,
      ),
      null,
    );
  }
  for (const group of ['reload8', 'lowReload16', 'grenade8', 'reactions8'])
    assert.equal(
      specialistSprite(
        base,
        { group, index: 0 },
        one('sniper'),
        legacy,
        stances,
      ),
      null,
    );
});

test('both directions of the real posture clock select their matching weapon cels without mutation', () => {
  for (const [id, role] of roles)
    for (const [from, to] of [
      ['stand', 'prone'],
      ['prone', 'stand'],
      ['crouch', 'prone'],
      ['prone', 'crouch'],
    ]) {
      const u = one(id);
      Object.assign(u, {
        pose: to === 'stand' ? 'idle' : to,
        poseAnimFrom: from,
        poseAnimSeen: to,
        poseAnimAt: 10,
      });
      const snapshot = structuredClone(u);
      for (let i = 0; i < 60; i++) {
        const f = adultFrameChoice(u, 10 + i / 60);
        assert.equal(f.group, 'stance16');
        assert.equal(
          specialistSprite(base, f, u, legacy, stances).image,
          stances[role].stance16[f.index].image,
        );
      }
      assert.deepEqual(u, snapshot);
    }
});

test('stopping a crouch step retains the same cached moving specialist body', () => {
  for (const [id] of roles) {
    const u = one(id);
    Object.assign(u, {
      pose: 'crouch',
      moving: true,
      crouchTravel: 1,
      walk: 3.5,
    });
    const f = adultFrameChoice(u, 20),
      a = specialistSprite(base, f, u, legacy, stances);
    u.moving = false;
    assert.deepEqual(adultFrameChoice(u, 20), f);
    assert.equal(specialistSprite(base, f, u, legacy, stances), a);
  }
});

test('actual authored weapon atlases preserve ground contact, body scale and complete muzzle endpoints', async () => {
  const lower = await loadImage(
    new URL('../public/art/weapon-lowering-v147.png', import.meta.url).pathname,
  );
  for (const role of ['machinegun', 'rocket', 'sniper']) {
    const upper = await loadImage(
      new URL(`../public/art/${role}-stance-v147.png`, import.meta.url)
        .pathname,
    );
    const set = weaponStanceAtlas(upper, lower, role, LOWER_WEAPON_CELS[role]);
    let previousHeight = Infinity;
    for (const [i, f] of set.stance16.entries()) {
      const d = f.image.getContext('2d').getImageData(0, 0, 128, 96).data;
      let top = 96,
        bottom = -1,
        left = 128,
        right = -1;
      for (let p = 0; p < d.length; p += 4)
        if (d[p + 3] >= 128) {
          const x = (p / 4) % 128,
            y = Math.floor(p / 4 / 128);
          left = Math.min(left, x);
          right = Math.max(right, x);
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
        }
      assert.equal(bottom, 95, `${role}/${i} floats or sinks`);
      assert(left > 1 && right < 126);
      const height = 96 - top;
      assert(height <= previousHeight);
      if (i) assert(previousHeight - height <= 7, `${role}/${i} snaps lower`);
      previousHeight = height;
      if (f.muzzle) {
        const [x, y] = f.muzzle;
        let near = 0;
        for (let dx = -3; dx <= 3; dx++)
          for (let dy = -3; dy <= 3; dy++)
            near = Math.max(
              near,
              d[(Math.round(y + dy) * 128 + Math.round(x + dx)) * 4 + 3] ?? 0,
            );
        assert(
          near > 64,
          `${role}/${i} muzzle landmark misses the actual painted weapon`,
        );
      }
    }
    assert.equal(set.stance16[8], set.crouch);
    assert.equal(set.standing, set.stance16[0]);
    assert.equal(set.prone, set.stance16[15]);
  }
});

test('the small runtime atlas reproduces every calibrated pixel and endpoint landmark', async () => {
  const lower = await loadImage(
    new URL('../public/art/weapon-lowering-v147.png', import.meta.url).pathname,
  );
  const packed = packedWeaponStances(
    await loadImage(
      new URL('../public/art/weapon-stance-frames-v147.png', import.meta.url)
        .pathname,
    ),
  );
  for (const role of ['machinegun', 'rocket', 'sniper']) {
    const original = await loadImage(
      new URL(`../public/art/${role}-stance-v147.png`, import.meta.url)
        .pathname,
    );
    const expected = weaponStanceAtlas(
      original,
      lower,
      role,
      LOWER_WEAPON_CELS[role],
    );
    for (let i = 0; i < 16; i++) {
      const a = expected.stance16[i],
        b = packed[role].stance16[i];
      assert.deepEqual(
        b.image.getContext('2d').getImageData(0, 0, 128, 96).data,
        a.image.getContext('2d').getImageData(0, 0, 128, 96).data,
        `${role}/${i} packing changed pixels`,
      );
    }
    for (const key of ['standing', 'crouch', 'prone']) {
      assert.deepEqual(packed[role][key].waist, expected[key].waist);
      assert.deepEqual(packed[role][key].muzzle, expected[key].muzzle);
    }
  }
});
