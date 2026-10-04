/** Measured sockets in image-generated components. No weapon pixels are painted here. */
export const WEAPON_ART_ROOT = '/art/v204-weapons';
export const MLRS_TUBES = 16;
export const WEAPON_LAYOUT = {
  mlrs: {
    body: [62, 24, 1445, 508],
    bodyWidth: 168,
    bodyHeight: 60,
    barrel: [252, 565, 786, 278],
    barrelWidth: 91.4,
    socket: [598, 132],
    breech: [447, 799],
    muzzle: [1020, 669],
    sourceElevation: 0,
  },
  field_gun: {
    body: [92, 81, 1135, 456],
    bodyWidth: 156,
    bodyHeight: 64,
    barrel: [271, 563, 1375, 280],
    barrelWidth: 121,
    socket: [838, 251],
    breech: [551, 792],
    muzzle: [1643, 669],
    sourceElevation: 0,
  },
  siege_gun: {
    body: [78, 30, 1400, 452],
    bodyWidth: 264,
    bodyHeight: 86,
    barrel: [132, 503, 1835, 237],
    barrelWidth: 245,
    socket: [1096, 230],
    breech: [538, 628],
    muzzle: [1958, 625],
    sourceElevation: 0,
  },
} as const;
export type ModularGunId = keyof typeof WEAPON_LAYOUT;
export function weaponLayout(id: ModularGunId) {
  const a = WEAPON_LAYOUT[id],
    bodyScale = a.bodyWidth / a.body[2],
    gunScale = a.barrelWidth / a.barrel[2];
  return {
    ...a,
    bodyScale,
    gunScale,
    pivotX: (a.socket[0] - a.body[0]) * bodyScale - a.bodyWidth / 2,
    pivotHeight: (a.body[1] + a.body[3] - a.socket[1]) * bodyScale,
    muzzleOffset: [
      (a.muzzle[0] - a.breech[0]) * gunScale,
      (a.muzzle[1] - a.breech[1]) * gunScale,
    ] as [number, number],
    barrelLength:
      Math.hypot(a.muzzle[0] - a.breech[0], a.muzzle[1] - a.breech[1]) *
      gunScale,
    barrelPivot: [
      (a.breech[0] - a.barrel[0]) * gunScale,
      (a.breech[1] - a.barrel[1]) * gunScale,
    ] as [number, number],
  };
}
export const HELI_LAYOUT = {
  body: [28, 64, 1520, 476],
  width: 212,
  height: 67,
  rotor: [28, 592, 1717, 103],
  rotorWidth: 238,
  rotorPivot: [886, 690],
  socket: [995, 128],
  pod: [505, 700, 300, 127],
  podWidth: 40,
  podPivot: [551, 766],
  podMuzzle: [797, 773],
  podSocket: [940, 389],
  gun: [1090, 732, 563, 92],
  gunWidth: 43,
  gunPivot: [1106, 773],
  gunMuzzle: [1646, 773],
  gunSocket: [1377, 475],
} as const;
export function helicopterMount(rocket = false) {
  const a = HELI_LAYOUT,
    scale = a.width / a.body[2],
    point = rocket ? a.podSocket : a.gunSocket;
  const p = rocket ? a.podPivot : a.gunPivot,
    m = rocket ? a.podMuzzle : a.gunMuzzle;
  const partScale = rocket ? a.podWidth / a.pod[2] : a.gunWidth / a.gun[2];
  return {
    pivotX: (point[0] - a.body[0]) * scale - a.width / 2,
    pivotHeight: (a.body[1] + a.body[3] - point[1]) * scale,
    muzzleOffset: [(m[0] - p[0]) * partScale, (m[1] - p[1]) * partScale] as [
      number,
      number,
    ],
    barrelLength: Math.hypot(m[0] - p[0], m[1] - p[1]) * partScale,
  };
}

export const MLRS_WRECK = {
  crop: [5, 205, 1528, 640],
  width: 168,
  height: 71,
} as const;
