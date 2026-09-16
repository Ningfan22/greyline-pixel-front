import { modelOf, type CardId } from './cards';

/** World-space geometry measured from each atlas row, with the track centre as origin. */
export interface TankGeometry {
  size: [number, number];
  spriteOffset: number;
  spriteGroundInset?: number;
  half: number;
  hullHeight: number;
  muzzleX: number;
  muzzleY: number;
  coaxX: number;
  coaxY: number;
  /**
   * Bounding box [x0, y0, x1, y1] of the thin muzzle section of the barrel,
   * in final draw space (origin at bottom-centre, y up). Used to slide the
   * barrel back into the mantlet on recoil while the hull stays planted.
   * Only the three real tanks have this; other vehicles kick the whole hull.
  */
  barrelBand?: [number, number, number, number];
}
const TANKS: Record<string, TankGeometry> = {
  pickup: {
    size: [190, 105],
    spriteOffset: -7.48,
    spriteGroundInset: 0,
    half: 74,
    hullHeight: 75,
    muzzleX: 20.5,
    muzzleY: 90.85,
    coaxX: 20.5,
    coaxY: 90.85,
  },
  tow_ifv: {
    size: [240, 138],
    spriteOffset: -0.66,
    spriteGroundInset: 0,
    half: 108,
    hullHeight: 94,
    muzzleX: 2.65,
    muzzleY: 127.29,
    coaxX: 53.7,
    coaxY: 106.74,
    barrelBand: [-30, -135, 45, -100],
  },
  mortar_carrier: {
    size: [210, 127],
    spriteOffset: 6.05,
    spriteGroundInset: 0,
    half: 77,
    hullHeight: 91,
    muzzleX: -19.93,
    muzzleY: 122.44,
    coaxX: 88.98,
    coaxY: 76.88,
  },
  recovery_vehicle: {
    size: [220, 119],
    spriteOffset: 2.56,
    spriteGroundInset: 0,
    half: 103,
    hullHeight: 75,
    muzzleX: 85.7,
    muzzleY: 69.71,
    coaxX: 85.7,
    coaxY: 69.71,
  },
  command_vehicle: {
    size: [210, 160],
    spriteOffset: -2.44,
    spriteGroundInset: 0,
    half: 76,
    hullHeight: 96,
    muzzleX: 48.14,
    muzzleY: 108.84,
    coaxX: 48.14,
    coaxY: 108.84,
  },
  mine_clearer: {
    size: [245, 114],
    spriteOffset: 43.11,
    spriteGroundInset: 7.53,
    half: 77,
    hullHeight: 79,
    muzzleX: 46.54,
    muzzleY: 88.28,
    coaxX: 46.54,
    coaxY: 88.28,
  },
  light_tank: {
    size: [220, 110],
    spriteOffset: 18,
    half: 82,
    hullHeight: 68,
    muzzleX: 120,
    muzzleY: 57,
    coaxX: 54,
    coaxY: 57,
    barrelBand: [62.2, -62.2, 102.0, -54.0],
  },
  tank: {
    size: [270, 135],
    spriteOffset: 21,
    half: 110,
    hullHeight: 70,
    muzzleX: 151,
    muzzleY: 56,
    coaxX: 60,
    coaxY: 56,
    barrelBand: [89.0, -61.7, 131.3, -52.5],
  },
  heavy_tank: {
    size: [305, 152.5],
    spriteOffset: 10,
    half: 137,
    hullHeight: 100,
    muzzleX: 157,
    muzzleY: 82,
    coaxX: 66,
    coaxY: 82,
    barrelBand: [126.2, -90.0, 148.3, -75.7],
  },
};
export const VEHICLE_SCALE: Partial<Record<CardId, number>> = {
  mortar_carrier: 0.68,
  command_vehicle: 0.72,
  recovery_vehicle: 0.86,
  tow_ifv: 0.82,
  pickup: 0.84,
};
for (const [id, scale] of Object.entries(VEHICLE_SCALE)) {
  const g = TANKS[id];
  g.size = [Math.round(g.size[0] * scale), Math.round(g.size[1] * scale)];
  for (const key of [
    'spriteOffset',
    'spriteGroundInset',
    'half',
    'hullHeight',
    'muzzleX',
    'muzzleY',
    'coaxX',
    'coaxY',
  ] as const)
    if (g[key] !== undefined) g[key] = g[key]! * scale;
  if (g.barrelBand) g.barrelBand = g.barrelBand.map((v) => v * scale) as [
    number,
    number,
    number,
    number,
  ];
}
export function tankGeometry(id: CardId): TankGeometry | null {
  return TANKS[id] ?? (modelOf(id) === 'tank' ? TANKS.tank : null);
}
export function armorHalf(id: CardId) {
  return tankGeometry(id)?.half ?? 48;
}
export function armorHeight(id: CardId) {
  return tankGeometry(id)?.hullHeight ?? 48;
}
export function armoredWreckSize(id: CardId): [number, number] {
  const g = tankGeometry(id);
  return g ? [g.half * 2 * 0.88, g.hullHeight * 0.48] : [126, 34];
}
