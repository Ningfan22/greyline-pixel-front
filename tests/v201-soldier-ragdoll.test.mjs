import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { soldierPose } from '../game/soldier-pose.ts';
import { soldierArt, paintSoldier, drawSoldierRagdoll } from '../game/soldier-art.ts';
import { createSoldierRagdoll, stepSoldierRagdoll, soldierRagdollBounds,
  soldierRagdollGroundPenetration } from '../game/soldier-ragdoll.ts';
import { createGame, startGame, spawnUnit, explode, tick, ground, W } from '../game/engine.ts';

const { createCanvas, loadImage } = createRequire(import.meta.url)('@napi-rs/canvas');
let allocations = 0;
globalThis.document = { createElement() { allocations++; return createCanvas(1, 1); } };
const art = soldierArt(...await Promise.all(['soldier-parts-v178.png', 'soldier-equipment-v178.png']
  .map(name => loadImage(fileURLToPath(new URL(`../public/art/${name}`, import.meta.url))))));
const poseOf = (patch = {}) => soldierPose({ id: 'infantry', uid: 13, hp: 100, pose: 'walk', motion: 'ground',
  moving: true, gaitWeight: 1, gaitRun: 0, gaitPhase: 2.3, walk: 2.3, ...patch }, 3);
const launch = (patch = {}) => ({ id: 29, x: 400, y: 374, vx: 120, vy: -160, spin: 3, facing: 1, ...patch });
const rgba = canvas => Buffer.from(canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data);

for (const facing of [-1, 1]) {
  test(`facing ${facing}: the first blast frame is pixel-identical to the current live pose`, () => {
    for (const patch of [{}, { pose: 'prone', moving: false, gaitWeight: 0 }, { id: 'machinegun' }, { id: 'medic' }]) {
      const pose = poseOf(patch), rag = createSoldierRagdoll(pose, launch({ x: 110, y: 110, facing }));
      const before = createCanvas(240, 180), after = createCanvas(240, 180), ctx = before.getContext('2d');
      ctx.translate(110, 110); ctx.scale(facing, 1); paintSoldier(ctx, art, pose);
      drawSoldierRagdoll(after.getContext('2d'), art, pose, rag);
      assert(rgba(before).equals(rgba(after)), 'death must keep the exact weapon, pose and original uniform pixels');
    }
  });
}

test('head, torso, both arms, both legs and equipment have distinct deterministic motion', () => {
  const pose = poseOf(), rag = createSoldierRagdoll(pose, launch());
  assert.deepEqual(rag, createSoldierRagdoll(pose, launch()), 'visual breakup must not depend on random frame timing');
  for (const name of ['head', 'torso', 'nearUpperArm', 'farUpperArm', 'nearForearm', 'farForearm',
    'nearThigh', 'farThigh', 'nearShin', 'farShin', 'nearBoot', 'farBoot', 'weapon', 'backpack'])
    assert(rag.parts.some(part => part.name === name), name);
  assert.equal(new Set(rag.parts.map(p => p.vx)).size, rag.parts.length);
  assert.equal(new Set(rag.parts.map(p => p.spin)).size, rag.parts.length);
  const before = structuredClone(rag.parts);
  stepSoldierRagdoll(rag, .1, () => 600, 1200);
  const changes = rag.parts.map((p, i) => [p.x - before[i].x, p.angle - before[i].angle]);
  assert(new Set(changes.map(([dx]) => dx.toFixed(2))).size > 10);
  assert(new Set(changes.map(([, angle]) => angle.toFixed(2))).size > 10);
});

for (const [name, ground] of [
  ['flat terrain', () => 374],
  ['a sloped crater with a narrow crest', x => 354 + Math.sin(x / 37) * 14 - (x > 510 && x < 515 ? 20 : 0)],
]) test(`rotated pieces never penetrate ${name}, all settle and later ticks do no collision work`, () => {
  const rag = createSoldierRagdoll(poseOf(), launch());
  for (let i = 0; i < 12 * 60 && !rag.settled; i++) {
    stepSoldierRagdoll(rag, 1 / 60, ground, 1200);
    for (const part of rag.parts) {
      assert(soldierRagdollGroundPenetration(part, ground) <= 1e-7,
        `${part.name} penetrated the ground after rotation`);
      assert(Number.isFinite(part.x + part.y + part.angle));
    }
  }
  assert(rag.settled, 'all independent pieces must eventually sleep');
  assert(rag.parts.every(p => p.settled && p.vx === 0 && p.vy === 0 && p.spin === 0));
  const settled = structuredClone(rag);
  assert.equal(stepSoldierRagdoll(rag, 1 / 30, () => { throw new Error('sleeping bodies must not sample terrain'); }, 1200), false);
  assert.deepEqual(rag, settled);
});

test('a weapon perimeter catches a small ridge between its corners', () => {
  const rag = createSoldierRagdoll(poseOf(), launch()), rifle = rag.parts.find(p => p.name === 'weapon');
  Object.assign(rifle, { x: 500, y: 300, angle: 0 });
  const ground = x => Math.abs(x - 500) < 4 ? 300 : 320;
  assert(soldierRagdollGroundPenetration(rifle, ground) > 0);
  assert(300 + rifle.height / 2 < ground(rifle.x - rifle.width / 2), 'corner-only collision would miss this crest');
});

test('bounded substeps keep a strong blast inside the map and stop even after a long frame', () => {
  const rag = createSoldierRagdoll(poseOf(), launch({ x: 50, vx: -480, vy: -260, spin: 15, facing: -1 }));
  for (let i = 0; i < 120 && !rag.settled; i++) stepSoldierRagdoll(rag, .25, () => 374, 800);
  const bounds = soldierRagdollBounds(rag);
  assert(bounds.left >= -1e-7); assert(bounds.right <= 800 + 1e-7); assert(bounds.bottom <= 374 + 1e-7);
  assert(rag.settled);
});

test('moving and sleeping debris reuse original costume images without allocating per-frame canvases', () => {
  const pose = poseOf(), rag = createSoldierRagdoll(pose, launch()), canvas = createCanvas(900, 430), ctx = canvas.getContext('2d');
  drawSoldierRagdoll(ctx, art, pose, rag);
  const before = allocations;
  for (let i = 0; i < 360; i++) {
    stepSoldierRagdoll(rag, 1 / 60, () => 374, 900);
    ctx.clearRect(0, 0, 900, 430); drawSoldierRagdoll(ctx, art, pose, rag);
  }
  assert.equal(allocations, before);
  assert(rgba(canvas).some((value, i) => i % 4 === 3 && value > 0), 'the settled pieces remain visible');
});

for (const side of [0, 1]) test(`side ${side}: a real lethal blast creates independent wreck pieces and the live tick settles all of them`, () => {
  const s = createGame(23013); startGame(s);
  Object.assign(s, { units: [], scenery: [], walls: [], wrecks: [], aiIn: 1e9 });
  s.terrain.fill(374); s.original.fill(374); s.weather.disabled = true;
  for (const player of s.players) Object.assign(player, { hand: [], deck: [], discard: [], order: 'hold' });
  const x = side === 0 ? 1200 : W - 1200;
  spawnUnit(s, side, 'infantry', x);
  explode(s, x, ground(s, x) - 10, 60, 400, 1 - side, 1, 1, 'he', 1.5);
  const wrecks = s.wrecks.filter(w => w.cardId === 'infantry' && w.soldierRagdoll);
  assert(wrecks.length > 0); assert(wrecks.every(w => w.falling && w.soldierFall));
  assert(wrecks.every(w => w.soldierRagdoll.parts.length >= 14));
  const before = structuredClone(wrecks[0].soldierRagdoll.parts);
  tick(s, 1 / 30);
  const moves = wrecks[0].soldierRagdoll.parts.map((part, i) => (part.x - before[i].x).toFixed(3));
  assert(new Set(moves).size > 10, 'the live simulation moves the parts independently');
  for (let i = 0; i < 12 * 60 && wrecks.some(w => w.falling); i++) tick(s, 1 / 60);
  for (const wreck of wrecks) {
    assert.equal(wreck.falling, false); assert(wreck.soldierRagdoll.settled);
    assert.equal(wreck.vx, 0); assert.equal(wreck.vy, 0); assert.equal(wreck.spin, 0); assert.equal(wreck.angle, 0);
    assert.equal(wreck.soldierSettle, undefined);
    for (const part of wreck.soldierRagdoll.parts)
      assert(soldierRagdollGroundPenetration(part, px => ground(s, px)) <= 1e-7);
  }
});
