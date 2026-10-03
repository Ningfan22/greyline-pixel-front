import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { artilleryCrewPose } from '../game/artillery-crew-pose.ts';
import { emplacementCrewGrip, emplacementSize } from '../game/emplacement-layout.ts';
import { soldierArt, actorSoldierPoseFrame } from '../game/soldier-art.ts';
import { buildEmplacements, unitSize, drawSprite } from '../game/art.ts';
import { buildEmplacementParts } from '../game/emplacement-art-v202.ts';
import { drawArticulatedGun } from '../game/gun-art.ts';
import { gunPose } from '../game/gun-geometry.ts';

const { createCanvas, loadImage } = createRequire(import.meta.url)('@napi-rs/canvas');
let created = 0;
globalThis.document = { createElement: () => { created++; return createCanvas(1, 1); } };
const { drawArtilleryCrew } = await import('../game/render.ts');
const soldiers = soldierArt(await loadImage('public/art/soldier-parts-v178.png'), await loadImage('public/art/soldier-equipment-v178.png'));
const frames = buildEmplacements(await loadImage('public/art/artillery-v9.png'));
const parts = buildEmplacementParts(frames), art = { soldiers };
const kinds = [['artillery', 'howitzer'], ['anti_tank_gun', 'at_gun'], ['aa_gun', 'aa_gun']];
const close = (a, b, message) => assert(Math.abs(a - b) < 1e-8, `${message}: ${a} != ${b}`);
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const rgba = c => Buffer.from(c.getContext('2d').getImageData(0, 0, c.width, c.height).data);

test('every original emplacement grows 20 percent with matching native draw and selection dimensions', () => {
  for (const [id, name] of kinds) {
    assert.deepEqual(unitSize(id), emplacementSize(name));
    for (const frame of frames[name]) assert.deepEqual([frame.width, frame.height], unitSize(id));
  }
  assert.deepEqual(unitSize('artillery'), [228, 120]);
});

test('both crews walk with fixed length limbs and hands planted on the original carriage', () => {
  for (const [id, name] of kinds) for (const side of [0, 1]) for (const member of [0, 1]) {
    const owner = { id, uid: 71, side, x: 1000, moving: true };
    const poses = [];
    for (let dx = 0; dx < 100; dx += 2) {
      owner.x = 1000 + dx;
      const crew = artilleryCrewPose(owner, member, 10), p = crew.pose;
      const grip = emplacementCrewGrip(name, member);
      close(crew.x + p.nearHand[0], grip[0], 'the pushing glove stays on the painted carriage x');
      close(crew.y + p.nearHand[1], grip[1] + (name === 'aa_gun' ? 3 : 0), 'the pushing glove stays on the painted carriage y');
      close(distance(p.hip, p.neck), 22, 'torso length');
      close(distance(p.hip, p.nearKnee), 17, 'thigh length');
      close(distance(p.nearKnee, p.nearFoot), 17, 'shin length');
      close(distance(p.shoulder, p.nearElbow), 12, 'upper arm length');
      close(distance(p.nearElbow, p.nearHand), 13, 'forearm length');
      assert(p.hip[1] < -28 && p.neck[0] - p.hip[0] > 12, 'operator stands and leans into the carriage');
      assert.equal(p.weaponVisible, false);
      poses.push(p);
    }
    assert(Math.max(...poses.map(p => p.nearFoot[0])) - Math.min(...poses.map(p => p.nearFoot[0])) > 20, 'legs must actually stride');
    assert(Math.max(...poses.map(p => p.nearFoot[1])) - Math.min(...poses.map(p => p.nearFoot[1])) > 4, 'swing boot lifts off the ground');
    owner.moving = false;
    const stopped = artilleryCrewPose(owner, member, 10).pose;
    assert.equal(stopped.travel, 0);
    assert(stopped.hip[1] > -22 && stopped.low === 1, 'stopped operator returns to servicing the gun');
  }
});

test('production crew renderer uses independent walking pixels and bounded actor canvases', () => {
  const owner = { id: 'artillery', uid: 73, side: 0, x: 260, y: 140, moving: true, lane: 0 };
  const first = artilleryCrewPose(owner, 1, 2);
  const initial = actorSoldierPoseFrame(soldiers, owner, first.pose, 2), pixels = rgba(initial.image);
  const createdBefore = created;
  for (let i = 1; i < 30; i++) {
    owner.x = 260 + i * 2;
    const crew = artilleryCrewPose(owner, 1, 2 + i / 60);
    const next = actorSoldierPoseFrame(soldiers, owner, crew.pose, 2);
    assert.equal(next.image, initial.image, 'the same operator reuses one raster');
  }
  assert.equal(created, createdBefore, 'continuous walking allocates no extra canvases');
  assert(!pixels.equals(rgba(initial.image)), 'real soldier pixels animate rather than sliding one frozen pose');
  const canvas = createCanvas(480, 220), ctx = canvas.getContext('2d');
  const calls = [], draw = ctx.drawImage.bind(ctx);
  ctx.drawImage = (...args) => { calls.push(args[0]); return draw(...args); };
  drawArtilleryCrew(ctx, owner, 3, art, 'far');
  drawArticulatedGun(ctx, parts.howitzer, owner);
  drawArtilleryCrew(ctx, owner, 3, art, 'near');
  assert.equal(calls.length, 4, 'far operator, original carriage/barrel, near operator are independent draws');
  assert.notEqual(calls[0], calls.at(-1), 'operators do not overwrite one another');
  const muzzle = gunPose(owner).muzzle;
  const atMuzzle = ctx.getImageData(Math.floor(muzzle.x) - 3, Math.floor(muzzle.y) - 3, 7, 7).data;
  assert(atMuzzle.some((v, i) => i % 4 === 3 && v > 220), 'enlarged painted muzzle still meets projectile start');
});

test('a supporting boot stays on the same ground point while the gun rolls forward', () => {
  for (const [id] of kinds) for (const side of [0, 1]) {
    const dir = side ? -1 : 1, owner = { id, uid: 91, side, x: 1000, moving: true };
    const before = artilleryCrewPose(owner, 0, 2);
    owner.x += dir * 4;
    const after = artilleryCrewPose(owner, 0, 2.1);
    close(1000 + dir * (before.x + before.pose.nearFoot[0]),
      owner.x + dir * (after.x + after.pose.nearFoot[0]), 'planted boot does not slide with the carriage');
    close(before.pose.nearFoot[1], after.pose.nearFoot[1], 'support boot stays grounded');
  }
});

if (process.env.GREYLINE_CREW_PREVIEW) {
  const canvas = createCanvas(1000, 520), ctx = canvas.getContext('2d');
  ctx.fillStyle = '#777e6e'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let row = 0; row < kinds.length; row++) for (let col = 0; col < 3; col++) {
    const [id, name] = kinds[row], owner = { id, uid: row * 3 + col, side: col === 2 ? 1 : 0,
      x: 180 + col * 325, y: 140 + row * 165, lane: 0, moving: col !== 0 };
    ctx.fillStyle = '#4b5144'; ctx.fillRect(col * 325, owner.y + 2, 320, 3);
    drawArtilleryCrew(ctx, owner, 3, art, 'far');
    if (parts[name]) drawArticulatedGun(ctx, parts[name], owner);
    else drawSprite(ctx, frames[name][0], owner.x, owner.y + 3, ...unitSize(id), owner.side === 1);
    drawArtilleryCrew(ctx, owner, 3, art, 'near');
    ctx.fillStyle = '#eee8cd'; ctx.font = '12px monospace'; ctx.fillText(`${name} ${owner.moving ? 'PUSH' : 'STOP'}`, col * 325 + 16, owner.y + 24);
  }
  writeFileSync(process.env.GREYLINE_CREW_PREVIEW, canvas.toBuffer('image/png'));
}
