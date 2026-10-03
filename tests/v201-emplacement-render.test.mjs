import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const { createCanvas, Image } = createRequire(import.meta.url)('@napi-rs/canvas');
globalThis.document = { createElement: () => createCanvas(1, 1) };
globalThis.Image = class extends Image {
  set src(value) {
    super.src = value.startsWith('/') ? fileURLToPath(new URL('../public' + value, import.meta.url)) : value;
  }
  get src() { return super.src; }
};
const { createGame, startGame, spawnUnit, refreshVision, H } = await import('../game/engine.ts');
const { loadBattleArt, unitFrame, unitSize } = await import('../game/art.ts');
const { render } = await import('../game/render.ts');
const { gunMount } = await import('../game/gun-geometry.ts');

test('production selectors use all three current layered tanks instead of archived whole-body sprites', async () => {
  const art = await loadBattleArt('greyline');
  for (const id of ['light_tank', 'tank', 'heavy_tank']) {
    const parts = art.gunParts[id];
    assert.deepEqual([parts.body.width, parts.body.height], unitSize(id));
    assert.notEqual(parts.barrel, parts.body);
    assert.equal(art.mobileVehicles[id], undefined, 'a legacy vehicle painting must not override the new tank selector');
    for (const phase of [0, 1, 2, 3]) assert.equal(unitFrame(art, id, phase), art.armor[id][phase]);
    const preview = unitFrame(art, id, 0);
    assert(preview.width >= parts.body.width, 'the compatibility portrait must include the protruding separate barrel');
  }
});

// Exercise only two gun actors with the current atlas loader, keeping
// native canvas allocations bounded instead of loading a full actor matrix.
test('a towed gun keeps the full barrel through every travel phase and recoils only while stopped', async () => {
  const art = await loadBattleArt('greyline');
  const parts = art.gunParts.howitzer;
  assert.notEqual(parts.body, parts.barrel, 'the gun and carriage must be independent original-art layers');
  const ctx = createCanvas(960, H).getContext('2d');
  const drawn = [];
  const draw = ctx.drawImage.bind(ctx);
  ctx.drawImage = (...args) => {
    if ([parts.body, parts.barrel].includes(args[0])) {
      const m = ctx.getTransform();
      drawn.push({ image: args[0], transform: [m.a, m.b, m.c, m.d, m.e, m.f] });
    }
    return draw(...args);
  };
  for (const side of [0, 1]) {
    const s = createGame(201901 + side); startGame(s);
    Object.assign(s, { units: [], scenery: [], walls: [], wrecks: [], aiIn: 1e9, night: false });
    s.terrain.fill(374); s.original.fill(374); s.weather.disabled = true;
    spawnUnit(s, side, 'field_gun', 420);
    const gun = s.units[0];
    Object.assign(gun, { x: 420, y: 374, hullAngle: 0, facing: side ? -1 : 1,
      gunFacing: side ? -1 : 1, gunElevation: gunMount('field_gun').restElevation });
    // A nearby observer keeps the red gun inside real player vision.
    s.players[0].recon = 100;
    spawnUnit(s, 0, 'scout_drone', 460);
    Object.assign(s.units.at(-1), { x: 460, y: 160, squadOrder: 'watch', squadOrderX: 460 });
    refreshVision(s);
    let bodyTransform, restGunTransform;
    for (const [moving, fire, recoiling] of [[true, 0, false], [true, .3, false], [false, 0, false], [false, .3, true]]) {
      Object.assign(gun, { moving, fire });
      for (const time of [8, 8.13, 8.26, 8.39]) {
        s.time = time; drawn.length = 0;
        render(ctx, s, art, null, null, true, 0, 960);
        assert.equal(drawn.length, 2, `side ${side}, moving ${moving}, fire ${fire}, time ${time}`);
        const chassis = drawn.find(call => call.image === parts.body), barrel = drawn.find(call => call.image === parts.barrel);
        bodyTransform ??= chassis.transform;
        restGunTransform ??= barrel.transform;
        assert.deepEqual(chassis.transform, bodyTransform, 'firing and travelling leave the fixed carriage transform unchanged');
        if (recoiling) assert.notDeepEqual(barrel.transform, restGunTransform, 'stopped fire moves the complete gun layer');
        else assert.deepEqual(barrel.transform, restGunTransform, 'travel phases never cycle the gun in and out');
      }
    }
  }
});
