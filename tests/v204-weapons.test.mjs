import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import {
  createGame,
  startGame,
  spawnUnit,
  refreshVision,
  tick,
} from '../game/engine.ts';
import {
  gunPose,
  gunMount,
  mlrsTubePose,
  aimedGunSolution,
} from '../game/gun-geometry.ts';
import { loadBakedBattleArt } from '../game/battle-art-baked.ts';
import { drawArticulatedGun } from '../game/gun-art.ts';
import { drawHelicopter, drawFlameStream } from '../game/weapon-art-v204.ts';

const { createCanvas, Image } = createRequire(import.meta.url)(
  '@napi-rs/canvas',
);
globalThis.document = { createElement: () => createCanvas(1, 1) };
globalThis.Image = class extends Image {
  set src(path) {
    super.src = fileURLToPath(new URL('../public' + path, import.meta.url));
  }
  get src() {
    return super.src;
  }
};
const shared = await loadBakedBattleArt();
const { render } = await import('../game/render.ts');
const awaitableArt = await import('../game/art.ts');
function field() {
  const s = createGame(204, undefined, undefined, undefined, {
    weather: false,
  });
  startGame(s);
  Object.assign(s, {
    units: [],
    scenery: [],
    walls: [],
    wrecks: [],
    aiIn: 1e9,
    night: false,
  });
  s.terrain.fill(374);
  s.original.fill(374);
  s.terrainVersion++;
  for (const p of s.players)
    Object.assign(p, { hand: [], deck: [], discard: [], energy: 0 });
  return s;
}
function spawn(s, side, id, x) {
  const n = s.units.length;
  spawnUnit(s, side, id, x);
  const u = s.units[n];
  Object.assign(u, {
    squadOrder: 'watch',
    squadOrderX: x,
    squadOrderUntil: Infinity,
    emplaced: true,
    emplacementSetupUntil: 0,
  });
  return u;
}
const near = (a, b) => assert(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
function alphaNear(canvas, p, r = 3) {
  return canvas
    .getContext('2d')
    .getImageData(
      Math.floor(p.x) - r,
      Math.floor(p.y) - r,
      r * 2 + 1,
      r * 2 + 1,
    )
    .data.some((v, i) => i % 4 === 3 && v > 200);
}
test('actual MLRS launches all 16 distinct ports, seats one reserve salvo in 14 seconds and stops when dry', () => {
  const s = field(),
    u = spawn(s, 0, 'mlrs', 750);
  spawn(s, 0, 'pathfinders', 1270);
  const v = spawn(s, 1, 'barrage', 1470);
  Object.assign(v, { hp: 1e6, maxHp: 1e6, cooldown: 1e9 });
  refreshVision(s);
  let previous = 0;
  const rounds = [];
  for (let i = 0; i < 48 * 60; i++) {
    tick(s, 1 / 60);
    if (u.shots !== previous) {
      const p = s.projectiles.findLast((p) => p.sourceUid === u.uid),
        pose = mlrsTubePose(u, p.launcherTube);
      assert(p);
      near(p.startX, pose.muzzle.x);
      near(p.startY, pose.muzzle.y);
      const tangent = Math.atan2(p.ty - p.startY - 4 * p.arc, p.tx - p.startX);
      near(Math.sin(tangent), Math.sin(pose.angle));
      rounds.push({ time: s.time, port: p.launcherTube });
      previous = u.shots;
    }
  }
  assert.equal(rounds.length, 32);
  assert.deepEqual(
    rounds.slice(0, 16).map((p) => p.port),
    Array.from({ length: 16 }, (_, i) => i),
  );
  assert.deepEqual(
    rounds.slice(16).map((p) => p.port),
    Array.from({ length: 16 }, (_, i) => i),
  );
  assert(rounds[16].time - rounds[15].time >= 14 - 1 / 60);
  assert.equal(u.ammo, 0);
  assert.equal(u.ammoReserve, 0);
  assert.equal(u.x, 750, 'salvo keeps its firing position');
});
test('new authored launcher and light/heavy cannons follow their measured visible mouths on either facing', () => {
  for (const id of ['mlrs', 'field_gun', 'siege_gun'])
    for (const facing of [-1, 1])
      for (const elevation of [gunMount(id).minElevation, 0.65]) {
        const c = createCanvas(600, 400),
          u = {
            id,
            x: 300,
            y: 340,
            hullAngle: 0,
            facing,
            gunFacing: facing,
            gunElevation: elevation,
          };
        drawArticulatedGun(c.getContext('2d'), shared.gunParts[id], u);
        if (id === 'mlrs')
          for (let tube = 0; tube < 16; tube++)
            assert(
              alphaNear(c, mlrsTubePose(u, tube).muzzle, 4),
              `tube ${tube}, facing ${facing}`,
            );
        else
          assert(alphaNear(c, gunPose(u).muzzle, 4), `${id}, facing ${facing}`);
      }
  assert.notDeepEqual(
    [
      shared.gunParts.field_gun.body.width,
      shared.gunParts.field_gun.barrel.width,
    ],
    [
      shared.gunParts.siege_gun.body.width,
      shared.gunParts.siege_gun.barrel.width,
    ],
  );
});
test('helicopter weapons elevate separately and share the rendered mouth with the straight shot', () => {
  for (const id of ['helicopter', 'rocket_heli', 'escort_gunship'])
    for (const facing of [-1, 1])
      for (const elevation of [-0.7, 0, 0.3]) {
        const c = createCanvas(600, 300),
          ctx = c.getContext('2d'),
          u = {
            id,
            x: 300,
            y: 140,
            facing,
            gunFacing: facing,
            gunElevation: elevation,
            hullAngle: 0,
          };
        ctx.translate(0, 10);
        const before = ctx.getTransform();
        drawHelicopter(ctx, shared.helicopterParts, u, 1);
        assert.deepEqual(
          ctx.getTransform(),
          before,
          'preserve caller transform',
        );
        const p = gunPose(u);
        assert(
          alphaNear(c, { x: p.muzzle.x, y: p.muzzle.y + 10 }, 4),
          id + ' muzzle',
        );
        const aim = aimedGunSolution(
          u,
          p.muzzle.x + Math.cos(p.angle) * 500,
          p.muzzle.y + Math.sin(p.angle) * 500,
        );
        assert(aim.canFire);
        near(aim.muzzle.x, p.muzzle.x);
        near(aim.muzzle.y, p.muzzle.y);
      }
});
test('all four generated flame frames remain connected from the nozzle through the stream', () => {
  for (let frame = 0; frame < 4; frame++) {
    const c = createCanvas(240, 120);
    drawFlameStream(
      c.getContext('2d'),
      shared.weaponEffects,
      10,
      60,
      202,
      60,
      frame / 13,
      0,
    );
    const data = c.getContext('2d').getImageData(0, 0, 240, 120).data;
    for (let x = 14; x < 197; x++) {
      let opaque = false;
      for (let y = 0; y < 120; y++)
        if (data[(y * 240 + x) * 4 + 3] > 80) {
          opaque = true;
          break;
        }
      assert(opaque, `flame cel ${frame}, disconnected at ${x}`);
    }
  }
});
test('a living aircraft retains its source colors above gray unexplored terrain; unseen enemies stay hidden', () => {
  const s = field(),
    plane = spawn(s, 0, 'strike_jet', 900);
  Object.assign(plane, { x: 900, y: 180, altitude: 194 });
  s.knownTerrain[0] = [...s.terrain];
  s.visible[0] = [plane.uid];
  const background = createCanvas(640, 214);
  const bc = background.getContext('2d');
  bc.fillStyle = '#737373';
  bc.fillRect(0, 0, 640, 214);
  const art = {
    ...shared,
    background,
    mapBackgrounds: { greyline: background },
  };
  const a = createCanvas(1000, 540),
    b = createCanvas(1000, 540);
  s.sight[0].fill(true);
  render(a.getContext('2d'), s, art, null, null, true, 500, 1000);
  s.sight[0].fill(false);
  render(b.getContext('2d'), s, art, null, null, true, 500, 1000);
  const { unitFrame, unitSize, drawSprite } = awaitableArt;
  assert.equal(
    unitFrame(art, 'strike_jet'),
    art.aircraft.strike_jet[0],
    'live strike aircraft keeps its authored olive paint',
  );
  const mask = createCanvas(1000, 540);
  drawSprite(
    mask.getContext('2d'),
    unitFrame(art, 'strike_jet'),
    plane.x - 500,
    plane.y + 3,
    ...unitSize('strike_jet'),
    false,
  );
  const ma = mask.getContext('2d').getImageData(0, 0, 1000, 540).data,
    pa = a.getContext('2d').getImageData(0, 0, 1000, 540).data,
    pb = b.getContext('2d').getImageData(0, 0, 1000, 540).data;
  let checked = 0;
  for (let i = 0; i < ma.length; i += 4)
    if (ma[i + 3] >= 252) {
      assert.deepEqual(
        [...pb.slice(i, i + 3)],
        [...pa.slice(i, i + 3)],
        'live plane paint must not be desaturated by ground fog',
      );
      checked++;
    }
  assert(
    checked > 500,
    `compare the whole opaque aircraft silhouette (${checked} pixels)`,
  );
  const enemy = spawn(s, 1, 'strike_jet', 1100);
  Object.assign(enemy, { x: 1100, y: 180 });
  const hidden = createCanvas(1000, 540);
  render(hidden.getContext('2d'), s, art, null, null, true, 500, 1000);
  assert.deepEqual(
    hidden.getContext('2d').getImageData(500, 90, 200, 110).data,
    b.getContext('2d').getImageData(500, 90, 200, 110).data,
    'unseen enemy must not appear above fog',
  );
  const ground = b.getContext('2d').getImageData(150, 250, 1, 1).data;
  assert(
    Math.max(...ground.slice(0, 3)) - Math.min(...ground.slice(0, 3)) < 3,
    'unexplored background still gray',
  );
});
test('actual flamethrower stream stays at the visible hand-held nozzle rather than using target Y as muzzle height', () => {
  const s = field(),
    u = spawn(s, 0, 'flame_team', 850);
  const v = spawn(s, 1, 'infantry', 965);
  for (const enemy of s.units.filter((u) => u.side === 1))
    Object.assign(enemy, { hp: 1e6, maxHp: 1e6, cooldown: 1e9 });
  refreshVision(s);
  s.knownTerrain[0] = [...s.terrain];
  for (let i = 0; i < 200 && (u.flameUntil ?? 0) <= s.time + 0.2; i++)
    tick(s, 1 / 60);
  assert((u.flameUntil ?? 0) > s.time);
  const background = createCanvas(640, 214),
    art = { ...shared, background, mapBackgrounds: { greyline: background } },
    a = createCanvas(1000, 540),
    b = createCanvas(1000, 540);
  render(a.getContext('2d'), s, art, null, null, true, 500, 1000);
  const end = u.flameUntil;
  u.flameUntil = 0;
  render(b.getContext('2d'), s, art, null, null, true, 500, 1000);
  u.flameUntil = end;
  const pa = a.getContext('2d').getImageData(0, 0, 1000, 540).data,
    pb = b.getContext('2d').getImageData(0, 0, 1000, 540).data;
  let changed = 0;
  for (let i = 0; i < pa.length; i += 4)
    if (pa[i] !== pb[i] || pa[i + 1] !== pb[i + 1] || pa[i + 2] !== pb[i + 2]) {
      const y = Math.floor(i / 4 / 1000);
      assert(y > u.y - 80, 'flames must never start in the sky');
      changed++;
    }
  assert(
    changed > 100,
    'the real shot must produce a visible continuous stream',
  );
});
test('each combat helicopter actually launches from its own articulated gun or pod', () => {
  for (const id of ['helicopter', 'rocket_heli', 'escort_gunship']) {
    const s = field(),
      u = spawn(s, 0, id, 850);
    const n = s.units.length;
    spawn(s, 1, id === 'rocket_heli' ? 'ifv' : 'infantry', 1200);
    for (const v of s.units.slice(n))
      Object.assign(v, {
        hp: 1e6,
        maxHp: 1e6,
        cooldown: 1e9,
        secondaryCooldown: 1e9,
      });
    spawn(s, 0, 'pathfinders', 1230);
    refreshVision(s);
    let p;
    for (let i = 0; i < 600 && !p; i++) {
      tick(s, 1 / 120);
      p = s.projectiles.find((p) => p.sourceUid === u.uid);
    }
    assert(p, `${id} should open fire on a valid ground contact`);
    const pose = gunPose(u);
    near(p.startX, pose.muzzle.x);
    near(p.startY, pose.muzzle.y);
    assert(
      Math.abs(p.startX - u.x) > 10,
      'round is not spawned from the fuselage center',
    );
    near(u.shotAngle, pose.angle);
    if (!p.guided) {
      const tangent = Math.atan2(p.ty - p.startY, p.tx - p.startX);
      near(Math.sin(tangent), Math.sin(pose.angle));
      near(Math.cos(tangent), Math.cos(pose.angle));
    }
  }
});
test('the six-wheel launcher keeps a matching compact wreck whose collision follows visible metal', async () => {
  const { wreckGeometry, wreckContact, wreckObstacles } =
    await import('../game/wreck-geometry.ts');
  const frame = shared.wrecks.mlrs,
    g = wreckGeometry('mlrs');
  assert.equal(g.atlas, 'v204');
  assert.deepEqual([frame.width, frame.height], [168, 71]);
  const pixels = frame
    .getContext('2d')
    .getImageData(0, 0, frame.width, frame.height).data;
  for (const part of g.parts) {
    const [x, y, w, h] = part.map((v, i) =>
      Math.round(v * (i % 2 ? frame.height : frame.width)),
    );
    let solid = 0;
    for (let yy = y; yy < y + h; yy++)
      for (let xx = x; xx < x + w; xx++)
        if (pixels[(yy * frame.width + xx) * 4 + 3] > 160) solid++;
    assert(solid / (w * h) >= 0.8, `wreck metal ${part}: ${solid / (w * h)}`);
  }
  for (const facing of [-1, 1]) {
    const u = { cardId: 'mlrs', side: 0, facing, x: 1400, y: 374, angle: 0 };
    assert.deepEqual(
      wreckContact(() => 374, u),
      { y: 374, angle: 0 },
    );
    assert(
      wreckObstacles(u).every(
        (b) => b.w > 0 && b.h > 0 && b.y + b.h <= 374.001,
      ),
    );
  }
});
