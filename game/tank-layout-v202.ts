/** Measured attachment points in the image-generated two-part sheets.
 * All body and barrel pixels use the same single world/source scale. */
export const TANK_IDS_V202 = ['light_tank', 'tank', 'heavy_tank'] as const;
export type TankIdV202 = (typeof TANK_IDS_V202)[number];
export const TANK_LAYOUT_V202 = {
  light_tank: { body: [295, 65, 1187, 630], barrel: [560, 734, 656, 131],
    width: 175, height: 94, socket: [1058, 318], breech: [628, 801], muzzle: [1211, 801], half: 80 },
  tank: { body: [112, 20, 1552, 689], barrel: [549, 747, 676, 123],
    width: 220, height: 100, socket: [1101, 309], breech: [612, 808], muzzle: [1221, 808], half: 104 },
  heavy_tank: { body: [25, 25, 1601, 637], barrel: [283, 719, 1110, 179],
    width: 250, height: 100, socket: [1070, 191], breech: [365, 807], muzzle: [1387, 807], half: 120 },
} as const;
export function tankLayoutV202(id: TankIdV202) {
  const a = TANK_LAYOUT_V202[id], scale = a.width / a.body[2];
  return { ...a, scale,
    pivotX: (a.socket[0] - a.body[0]) * scale - a.width / 2,
    pivotHeight: (a.body[1] + a.body[3] - a.socket[1]) * scale,
    barrelLength: (a.muzzle[0] - a.breech[0]) * scale,
    barrelPivot: [(a.breech[0] - a.barrel[0]) * scale, (a.breech[1] - a.barrel[1]) * scale] as [number, number],
  };
}
