/** v203 realistic tank sheets, keeping the established articulation API.
 * Measured attachment points in the image-generated two-part sheets.
 * All body and barrel pixels use the same single world/source scale. */
export const TANK_IDS_V202 = ['light_tank', 'tank', 'heavy_tank'] as const;
export type TankIdV202 = (typeof TANK_IDS_V202)[number];
export const TANK_ASSET_ROOT = '/art/v203-tanks';
export const TANK_LAYOUT_V202 = {
  light_tank: { body: [85, 92, 1366, 606], barrel: [405, 795, 872, 113],
    width: 175, height: 94, socket: [1070, 350], breech: [497, 849], muzzle: [1271, 849], coax: [1131, 352], half: 80 },
  tank: { body: [48, 28, 1683, 618], barrel: [461, 716, 982, 119],
    width: 220, height: 100, socket: [1214, 272], breech: [552, 769], muzzle: [1438, 769], coax: [1270, 266], half: 104 },
  heavy_tank: { body: [29, 10, 1718, 672], barrel: [350, 741, 1100, 120],
    width: 250, height: 100, socket: [1200, 319], breech: [430, 803], muzzle: [1445, 803], coax: [1144, 331], half: 120 },
} as const;
export function tankLayoutV202(id: TankIdV202) {
  const a = TANK_LAYOUT_V202[id], scale = a.width / a.body[2];
  return { ...a, scale,
    pivotX: (a.socket[0] - a.body[0]) * scale - a.width / 2,
    pivotHeight: (a.body[1] + a.body[3] - a.socket[1]) * scale,
    barrelLength: (a.muzzle[0] - a.breech[0]) * scale,
    coaxX: (a.coax[0] - a.body[0]) * scale - a.width / 2,
    coaxY: (a.body[1] + a.body[3] - a.coax[1]) * scale,
    barrelPivot: [(a.breech[0] - a.barrel[0]) * scale, (a.breech[1] - a.barrel[1]) * scale] as [number, number],
  };
}
