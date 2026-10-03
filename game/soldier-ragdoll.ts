import { SOLDIER_WEAPON_SIZE, type Point, type SoldierPose } from './soldier-pose';

export type SoldierRagdollKind = 'head' | 'torso' | 'upperArm' | 'forearm' | 'thigh' | 'shin' | 'boot' | 'pelvis' | 'backpack' | 'weapon' | 'medical' | 'shovel' | 'wrench';
export interface SoldierRagdollPart {
  name: string;
  kind: SoldierRagdollKind;
  layer: 'near' | 'far';
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  spin: number;
  width: number;
  height: number;
  settled: boolean;
  restTime: number;
}
export interface SoldierRagdoll {
  id: number;
  age: number;
  originX: number;
  originY: number;
  facing: number;
  settled: boolean;
  parts: SoldierRagdollPart[];
}
export interface SoldierRagdollLaunch {
  x: number; y: number; facing: number; vx: number; vy: number; spin: number; id: number;
}
const sizes = {
  head: [14, 14], torso: [15, 24], upperArm: [7, 14], forearm: [6, 15],
  thigh: [8, 19], shin: [7, 19], boot: [11, 5], pelvis: [13, 8],
  backpack: [10, 18], medical: [11, 10], shovel: [8, 27], wrench: [4, 14],
} as const;
const unitNoise = (id: number, index: number) => {
  let n = Math.imul(id + 17, 374761393) ^ Math.imul(index + 31, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
};

/** Resolve the existing pixel rig into independent rigid pieces at its exact
 * current pose. No random draw is taken from combat simulation. */
export function createSoldierRagdoll(pose: SoldierPose, launch: SoldierRagdollLaunch): SoldierRagdoll {
  const facing = launch.facing < 0 ? -1 : 1;
  const rag: SoldierRagdoll = { id: launch.id, age: 0, originX: launch.x, originY: launch.y,
    facing, settled: false, parts: [] };
  const add = (name: string, kind: SoldierRagdollKind, layer: 'near' | 'far',
    anchor: Point, dx: number, dy: number, angle = 0, size: Point = sizes[kind as keyof typeof sizes]) => {
    const width = size[0], height = size[1], cx = dx + width / 2, cy = dy + height / 2;
    const c = Math.cos(angle), sn = Math.sin(angle), index = rag.parts.length;
    const x = Math.round(anchor[0]) + cx * c - cy * sn;
    const y = Math.round(anchor[1]) + cx * sn + cy * c;
    const light = kind === 'head' || kind === 'boot' || kind === 'weapon' || kind === 'shovel' || kind === 'wrench';
    const spread = light ? 66 : 42;
    rag.parts.push({ name, kind, layer, x: launch.x + facing * x, y: launch.y + y,
      vx: launch.vx + (unitNoise(launch.id, index * 3) - .5) * spread + facing * x * .32,
      vy: launch.vy + (unitNoise(launch.id, index * 3 + 1) - .65) * spread,
      angle: facing * angle,
      spin: launch.spin * (light ? 1 : .65) + (unitNoise(launch.id, index * 3 + 2) - .5) * 8,
      width, height, settled: false, restTime: 0 });
  };
  const segment = (name: string, kind: 'upperArm' | 'forearm' | 'thigh' | 'shin' | 'torso',
    layer: 'near' | 'far', from: Point, to: Point) =>
    add(name, kind, layer, from, -Math.floor(sizes[kind][0] / 2), -1,
      Math.atan2(to[1] - from[1], to[0] - from[0]) - Math.PI / 2);
  const leg = (layer: 'near' | 'far', knee: Point, foot: Point, hip: Point) => {
    segment(`${layer}Thigh`, 'thigh', layer, hip, knee);
    segment(`${layer}Shin`, 'shin', layer, knee, foot);
    const cycle = (((pose.phase + (layer === 'far' ? Math.PI : 0)) / (2 * Math.PI)) % 1 + 1) % 1;
    const ankle = cycle > .5 && pose.low < 1.5 ? Math.sin((cycle - .5) * Math.PI * 4) * .22 * pose.travel : 0;
    add(`${layer}Boot`, 'boot', layer, foot, -4, -2,
      (layer === 'far' ? pose.farFootAngle : pose.nearFootAngle) ?? ankle);
  };
  const arm = (layer: 'near' | 'far', shoulder: Point, elbow: Point, hand: Point) => {
    segment(`${layer}UpperArm`, 'upperArm', layer, shoulder, elbow);
    segment(`${layer}Forearm`, 'forearm', layer, elbow, hand);
  };
  leg('far', pose.farKnee, pose.farFoot, [pose.hip[0] - 1, pose.hip[1]]);
  if (!pose.hideFarArm) arm('far', [pose.shoulder[0] + 1, pose.shoulder[1] - 1], pose.farElbow, pose.farHand);
  const spine = Math.atan2(pose.hip[1] - pose.neck[1], pose.hip[0] - pose.neck[0]) - Math.PI / 2;
  add('backpack', 'backpack', 'near', pose.neck, -14, 2, spine, pose.weapon === 'flame' ? [12, 22] : sizes.backpack);
  if (pose.slung && pose.weaponVisible) {
    const a = spine + 1.12;
    // The slung weapon has a second translation after its neck rotation.
    add('weapon', 'weapon', 'near', pose.neck, -7, 3, a, SOLDIER_WEAPON_SIZE[pose.weapon]);
  }
  segment('torso', 'torso', 'near', pose.neck, pose.hip);
  add('pelvis', 'pelvis', 'near', pose.hip, -6, -4, spine);
  add('head', 'head', 'near', pose.head, -6, -13, pose.headAngle);
  leg('near', pose.nearKnee, pose.nearFoot, pose.hip);
  if (pose.weaponVisible && !pose.slung)
    add('weapon', 'weapon', 'near', pose.weaponOrigin, 0, 0, pose.weaponAngle, SOLDIER_WEAPON_SIZE[pose.weapon]);
  if (pose.appearance.uniform === 'medic') add('medical', 'medical', 'near', pose.hip, -10, -1);
  arm('near', pose.shoulder, pose.nearElbow, pose.nearHand);
  if (pose.prop === 'shovel' || pose.prop === 'wrench') {
    const hand = pose.propHand === 'far' ? pose.farHand : pose.nearHand;
    if (pose.prop === 'shovel' && pose.toolOrigin)
      add('tool', 'shovel', 'near', pose.toolOrigin, 0, 0, pose.toolAngle);
    else add('tool', pose.prop, 'near', hand, -2, -5, pose.prop === 'shovel' ? -.28 : .25);
  }
  return rag;
}

/** Rotated perimeter samples include every corner and gaps no larger than 4px,
 * so a long rifle cannot bridge through a small terrain crest. */
export function soldierRagdollGroundPenetration(part: SoldierRagdollPart, ground: (x: number) => number) {
  const c = Math.cos(part.angle), sn = Math.sin(part.angle), hw = part.width / 2, hh = part.height / 2;
  let penetration = -Infinity;
  const sample = (lx: number, ly: number) => {
    const x = part.x + lx * c - ly * sn, y = part.y + lx * sn + ly * c;
    penetration = Math.max(penetration, y - ground(x));
  };
  const wide = Math.ceil(part.width / 4), high = Math.ceil(part.height / 4);
  for (let i = 0; i <= wide; i++) { const x = -hw + part.width * i / wide; sample(x, -hh); sample(x, hh); }
  for (let i = 1; i < high; i++) { const y = -hh + part.height * i / high; sample(-hw, y); sample(hw, y); }
  return penetration;
}

/** Bounded physics work; each settled part becomes inert, and a fully sleeping
 * ragdoll performs no collision queries on subsequent frames. */
export function stepSoldierRagdoll(rag: SoldierRagdoll, dt: number, ground: (x: number) => number, width: number): boolean {
  if (rag.settled || !(dt > 0)) return !rag.settled;
  const elapsed = Math.min(dt, .12);
  let speed = 0;
  for (const part of rag.parts) if (!part.settled) speed = Math.max(speed, Math.abs(part.vx), Math.abs(part.vy));
  const steps = Math.min(12, Math.max(1, Math.ceil(elapsed * 120), Math.ceil(speed * elapsed / 3)));
  const h = elapsed / steps;
  for (let step = 0; step < steps; step++) for (const part of rag.parts) {
    if (part.settled) continue;
    part.vy += 420 * h;
    part.x += part.vx * h; part.y += part.vy * h; part.angle += part.spin * h;
    const extent = (Math.abs(Math.cos(part.angle)) * part.width + Math.abs(Math.sin(part.angle)) * part.height) / 2;
    if (part.x < extent) { part.x = extent; part.vx = Math.abs(part.vx) * .2; }
    if (part.x > width - extent) { part.x = width - extent; part.vx = -Math.abs(part.vx) * .2; }
    const penetration = soldierRagdollGroundPenetration(part, ground);
    if (penetration >= 0) {
      part.y -= penetration;
      if (part.vy > 65) {
        part.vy = -part.vy * .18; part.vx *= .72; part.spin *= .62;
      } else {
        part.vy = 0; part.vx *= Math.exp(-14 * h); part.spin *= Math.exp(-12 * h);
      }
      if (Math.abs(part.vx) < 2 && Math.abs(part.vy) < 2 && Math.abs(part.spin) < .12) {
        part.restTime += h;
        if (part.restTime >= .24) {
          part.settled = true; part.vx = 0; part.vy = 0; part.spin = 0;
        }
      } else part.restTime = 0;
    } else part.restTime = 0;
  }
  rag.age += elapsed;
  rag.settled = rag.parts.every(part => part.settled);
  return !rag.settled;
}

export function soldierRagdollBounds(rag: SoldierRagdoll) {
  let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
  for (const part of rag.parts) {
    const c = Math.abs(Math.cos(part.angle)), s = Math.abs(Math.sin(part.angle));
    const hx = (part.width * c + part.height * s) / 2, hy = (part.width * s + part.height * c) / 2;
    left = Math.min(left, part.x - hx); right = Math.max(right, part.x + hx);
    top = Math.min(top, part.y - hy); bottom = Math.max(bottom, part.y + hy);
  }
  return { left, right, top, bottom };
}
