/** The original gun paintings, gun sockets and crew contacts share one scale. */
export type EmplacementName = 'howitzer' | 'at_gun' | 'aa_gun' | 'mortar';
export const EMPLACEMENT_SCALE = 1.2;
export const EMPLACEMENT_BASE_SIZE = {
  mortar:[80,65], howitzer: [190, 100], at_gun: [190, 95], aa_gun: [150, 105],
} as const;
export function emplacementSize(name: EmplacementName): [number, number] {
  const [w, h] = EMPLACEMENT_BASE_SIZE[name];
  return [Math.round(w * EMPLACEMENT_SCALE), Math.round(h * EMPLACEMENT_SCALE)];
}
/** Painted carriage contact points, before scaling; the far operator goes first. */
const PUSH_GRIPS = {
  mortar:[[20,50],[10,53]], howitzer: [[70, 76], [40, 84]],
  at_gun: [[76, 73], [43, 80]],
  aa_gun: [[66, 81], [35, 86]],
} as const;
export function emplacementCrewGrip(name: EmplacementName, member: number): readonly [number, number] {
  const [w, h] = EMPLACEMENT_BASE_SIZE[name];
  const [x, y] = PUSH_GRIPS[name][member % 2];
  return [(x - w / 2) * EMPLACEMENT_SCALE, (y - h) * EMPLACEMENT_SCALE];
}
