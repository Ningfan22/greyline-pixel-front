import { modelOf, type CardId } from './cards';

/** World-space geometry measured from each atlas row, with the track centre as origin. */
export interface TankGeometry {
  size: [number, number];
  spriteOffset: number;
  half: number;
  hullHeight: number;
  muzzleX: number;
  muzzleY: number;
  coaxX: number;
  coaxY: number;
}
const TANKS: Record<string, TankGeometry> = {
  light_tank: {
    size: [220, 110],
    spriteOffset: 18,
    half: 82,
    hullHeight: 68,
    muzzleX: 120,
    muzzleY: 57,
    coaxX: 54,
    coaxY: 57,
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
  },
};
export function tankGeometry(id: CardId): TankGeometry | null {
  return modelOf(id) === 'tank' ? (TANKS[id] ?? TANKS.tank) : null;
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
