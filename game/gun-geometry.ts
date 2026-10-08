import {expansionGunMount} from './expansion-art-v227';
import {vehicleGunMount} from './vehicle-gun-layout';
import { CARDS, type CardId } from './cards';
import { TANK_IDS_V202, tankLayoutV202 } from './tank-layout-v202';
import { EMPLACEMENT_CUTS } from './emplacement-art-v202';
import { emplacementSize } from './emplacement-layout';
import {
  WEAPON_LAYOUT,
  weaponLayout,
  helicopterMount,
  MLRS_TUBES,
} from './weapon-layout-v204';

const rad = (degrees: number) => (degrees * Math.PI) / 180;
export interface GunMount {
  /** Coordinates relative to the track / wheel ground anchor; x faces forward. */
  pivotX: number;
  pivotHeight: number;
  barrelLength: number;
  muzzleOffset?: [number, number];
  minElevation: number;
  maxElevation: number;
  restElevation: number;
}
const MOUNTS: Record<string, GunMount> = {
  mortar:{pivotX:0,pivotHeight:15,barrelLength:45,minElevation:rad(45),maxElevation:rad(82),restElevation:rad(65)},
  light_tank: {
    pivotX: 36,
    pivotHeight: 57,
    barrelLength: 59,
    minElevation: rad(-10),
    maxElevation: rad(25),
    restElevation: 0,
  },
  tank: {
    pivotX: 61,
    pivotHeight: 56,
    barrelLength: 90,
    minElevation: rad(-9),
    maxElevation: rad(22),
    restElevation: 0,
  },
  heavy_tank: {
    pivotX: 67,
    pivotHeight: 82,
    barrelLength: 90,
    minElevation: rad(-8),
    maxElevation: rad(20),
    restElevation: 0,
  },
  howitzer: {
    pivotX: 9,
    pivotHeight: 43,
    barrelLength: 85,
    minElevation: rad(-5),
    maxElevation: rad(65),
    restElevation: rad(10),
  },
  at_gun: {
    pivotX: 18,
    pivotHeight: 28,
    barrelLength: 75,
    minElevation: rad(-8),
    maxElevation: rad(25),
    restElevation: 0,
  },
};
for (const id of TANK_IDS_V202) {
  const { pivotX, pivotHeight, barrelLength } = tankLayoutV202(id);
  Object.assign(MOUNTS[id], { pivotX, pivotHeight, barrelLength });
}
for (const id of ['howitzer', 'at_gun'] as const) {
  const { pivot, muzzle } = EMPLACEMENT_CUTS[id];
  const [width, height] = emplacementSize(id);
  Object.assign(MOUNTS[id], {
    pivotX: pivot[0] - width / 2,
    pivotHeight: height - pivot[1],
    barrelLength: Math.hypot(muzzle[0] - pivot[0], muzzle[1] - pivot[1]),
    restElevation: Math.atan2(pivot[1] - muzzle[1], muzzle[0] - pivot[0]),
  });
}
for (const id of ['mlrs', 'field_gun', 'siege_gun'] as const) {
  const a = weaponLayout(id);
  MOUNTS[id] = {
    pivotX: a.pivotX,
    pivotHeight: a.pivotHeight,
    barrelLength: a.barrelLength,
    muzzleOffset: a.muzzleOffset,
    minElevation: id === 'mlrs' ? a.sourceElevation + rad(5) : rad(-5),
    maxElevation: id === 'mlrs' ? a.sourceElevation + rad(55) : rad(65),
    restElevation: a.sourceElevation + rad(id === 'mlrs' ? 8 : 10),
  };
}
for (const id of ['helicopter', 'rocket_heli', 'escort_gunship'] as const)
  MOUNTS[id] = {
    ...helicopterMount(id === 'rocket_heli'),
    minElevation: rad(id === 'rocket_heli' ? -10 : -32),
    // Chin gun clears the nose; a wing-mounted rocket pod has only a small sweep.
    maxElevation: rad(id === 'rocket_heli' ? 5 : 0),
    restElevation: 0,
  };
export function gunMount(id: CardId): GunMount | null {
  return (
    expansionGunMount(id) ?? vehicleGunMount(id) ?? MOUNTS[id] ??
    (CARDS[id].emplacement ? MOUNTS[CARDS[id].emplacement!] : null) ??
    null
  );
}
export interface GunBody {
  id: CardId;
  x: number;
  y: number;
  hullAngle?: number;
  facing?: number;
  side?: number;
  gunFacing?: number;
  gunElevation?: number;
  shots?: number;
}
const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));
/** Both renderer and projectiles consume this transform. Recoil is deliberately
 * visual-only: a shell is released at the forward muzzle before recoil begins. */
export function gunPose(
  body: GunBody,
  elevation = body.gunElevation,
  facing = body.gunFacing ?? body.facing ?? (body.side === 1 ? -1 : 1),
) {
  const mount = gunMount(body.id);
  if (!mount) return null;
  const dir = facing < 0 ? -1 : 1;
  const hull = (body.hullAngle ?? 0);
  const e = clamp(
    elevation ?? mount.restElevation,
    mount.minElevation,
    mount.maxElevation,
  );
  const dx = dir * mount.pivotX,
    dy = -mount.pivotHeight;
  const pivot = {
    x: body.x + dx * Math.cos(hull) - dy * Math.sin(hull),
    y: body.y + dx * Math.sin(hull) + dy * Math.cos(hull),
  };
  const angle = hull + (dir < 0 ? Math.PI : 0) - dir * e;
  const [mx, my] = mount.muzzleOffset ?? [mount.barrelLength, 0],
    localY = my * dir;
  return {
    pivot,
    muzzle: {
      x: pivot.x + Math.cos(angle) * mx - Math.sin(angle) * localY,
      y: pivot.y + Math.sin(angle) * mx + Math.cos(angle) * localY,
    },
    angle,
    elevation: e,
    facing: dir,
    mount,
  };
}

/** Each visible tube has its own launch port; all rounds follow the rack tangent. */
export function mlrsTubePose(
  body: GunBody,
  tube = (body.shots ?? 0) % MLRS_TUBES,
) {
  const pose = gunPose(body)!;
  const a = weaponLayout('mlrs');
  const row = Math.floor((((tube % MLRS_TUBES) + MLRS_TUBES) % MLRS_TUBES) / 4),
    column = tube % 4;
  const x = ([954, 976, 997, 1019][column] - a.breech[0]) * a.gunScale,
    y = ([597, 646, 695, 744][row] - a.breech[1]) * a.gunScale;
  const rotation = pose.angle + pose.facing * a.sourceElevation;
  const localY = y * pose.facing;
  return {
    ...pose,
    tube,
    muzzle: {
      x: pose.pivot.x + x * Math.cos(rotation) - localY * Math.sin(rotation),
      y: pose.pivot.y + x * Math.sin(rotation) + localY * Math.cos(rotation),
    },
    angle: pose.angle,
  };
}

/** A direct round follows the pivot-to-target line, which also contains the
 * muzzle. For indirect fire the chosen elevation fixes the muzzle first;
 * derive the parabola from that exact muzzle and barrel tangent. */
export function aimedGunSolution(body: GunBody, tx: number, ty: number) {
  const mount = gunMount(body.id);
  if (!mount) return null;
  const facing = tx < body.x ? -1 : 1;
  const rest = gunPose(body, mount.restElevation, facing)!;
  const hull = (body.hullAngle ?? 0);
  const dx = Math.abs(tx - rest.pivot.x),
    dy = ty - rest.pivot.y;
  const boreOffset = mount.muzzleOffset?.[1] ?? 0;
  const sightElevation =
    Math.atan2(-dy, dx) +
    facing * hull +
    Math.asin(clamp(boreOffset / Math.hypot(dx, dy), -1, 1));
  const indirect = !!CARDS[body.id].indirect;
  // Low-angle howitzer fire at short ranges; longer shots visibly elevate.
  const preferred = CARDS[body.id].emplacement==='mortar'
    ? rad(62+clamp((dx-200)/1000,0,1)*12)
    : body.id === 'mlrs'
      ? WEAPON_LAYOUT.mlrs.sourceElevation +
        rad(16 + clamp((dx - 350) / 700, 0, 1) * 24)
      : rad(12 + clamp((dx - 200) / 1000, 0, 1) * 20);
  // Unguided pod rockets leave a nearly level fixed rack, then fall along
  // a muzzle-tangent path. Do not hinge the entire pod toward the ground.
  const rocketPod = body.id === 'rocket_heli';
  const requested = rocketPod ? clamp(sightElevation, mount.minElevation, mount.maxElevation) : indirect
    ? Math.max(preferred, sightElevation + rad(5))
    : sightElevation;
  const basePose = gunPose(body, requested, facing)!;
  const pose =
    body.id === 'mlrs'
      ? mlrsTubePose({
          ...body,
          gunElevation: basePose.elevation,
          gunFacing: facing,
        })
      : basePose;
  const canFire =
    dx > mount.barrelLength + 12 &&
    requested >= mount.minElevation - 1e-6 &&
    requested <= mount.maxElevation + 1e-6;
  const arc = indirect || rocketPod
    ? Math.max(
        0,
        (ty - pose.muzzle.y - (tx - pose.muzzle.x) * Math.tan(pose.angle)) / 4,
      )
    : 0;
  return { ...pose, arc, canFire };
}

/** Rocket racks use their painted launch angle. Mortars keep the existing
 * high-angle profile and flight pacing; this change concerns field guns. */
export function rocketRackArc(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  hullAngle = 0,
) {
  // The authored rack is fixed at 12 degrees; inherit the chassis slope.
  // Negative sag would need a shell to curve upwards after leaving the tube.
  const dir = tx < sx ? -1 : 1;
  const angle = hullAngle + (dir < 0 ? Math.PI : 0) - dir * rad(12);
  return (ty - sy - (tx - sx) * Math.tan(angle)) / 4;
}
export function indirectArc(
  id: CardId,
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  hullAngle = 0,
) {
  if (id === 'mlrs')
    return Math.max(0, rocketRackArc(sx, sy, tx, ty, hullAngle));
  return 170;
}
