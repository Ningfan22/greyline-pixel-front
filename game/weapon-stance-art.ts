import type { AdultSpecialistArt, SpecialistFrame } from './adult-specialists';
import { WEAPON_POSES } from './weapon-pose-data';

/** Bounds and body anchors are measured in original pixels. A single scale
 * preserves anatomy through the complete drill; weapon length never fits or
 * recentres a frame. The original RGBA image is not keyed or repainted. */
export interface WeaponStanceCalibration {
  scale: number;
  cels: readonly (readonly [
    left: number,
    top: number,
    right: number,
    bottom: number,
    anchor: number,
  ])[];
  /** Landmarks at stand/knee/prone endpoints, in the prepared 128×96 frame. */
  endpoints: readonly {
    waist: readonly number[];
    muzzle: readonly number[];
  }[];
}

// Only the six independent, complete upper cels are selected. The generated
// fourth column and crowded prone row are not production-safe source crops.
// A separate authored lowering sheet supplies the missing ground progression.
export const UPPER_WEAPON_CELS = {
  machinegun: [
    [76, 65, 295, 367, 142],
    [385, 82, 609, 367, 447],
    [692, 105, 925, 368, 750],
    [41, 443, 308, 675, 125],
    [362, 454, 619, 675, 441],
    [676, 466, 936, 677, 752],
  ],
  rocket: [
    [62, 62, 297, 366, 142],
    [387, 79, 616, 365, 447],
    [694, 104, 933, 365, 750],
    [43, 442, 308, 675, 125],
    [361, 453, 624, 675, 441],
    [675, 463, 942, 676, 752],
  ],
  sniper: [
    [77, 68, 333, 367, 142],
    [388, 84, 643, 366, 447],
    [692, 109, 961, 367, 750],
    [42, 455, 339, 679, 125],
    [360, 465, 646, 679, 441],
    [676, 476, 964, 682, 752],
  ],
} as const;

export const UPPER_WEAPON_ENDPOINTS = {
  machinegun: [
    WEAPON_POSES.machinegun.stand, WEAPON_POSES.machinegun.crouch,
  ],
  rocket: [
    WEAPON_POSES.rocket.stand, WEAPON_POSES.rocket.crouch,
  ],
  sniper: [
    WEAPON_POSES.sniper.stand, WEAPON_POSES.sniper.crouch,
  ],
} as const;

/** Independent lower figures cross nominal cells but never overlap anatomy.
 * Component isolation below removes only neighbors inside a rectangular crop. */
export const LOWER_WEAPON_CELS: Record<
  keyof typeof UPPER_WEAPON_CELS,
  WeaponStanceCalibration
> = {
  machinegun: {
    scale: 0.32,
    cels: [
      [43, 101, 230, 238, 108],
      [290, 109, 492, 238, 361],
      [543, 125, 757, 238, 615],
      [771, 146, 1019, 238, 873],
      [28, 387, 275, 469, 130],
      [277, 397, 524, 470, 374],
      [524, 409, 768, 475, 619],
      [779, 409, 1017, 475, 869],
    ],
    endpoints: [WEAPON_POSES.machinegun.prone],
  },
  rocket: {
    scale: 0.32,
    cels: [
      [44, 579, 228, 718, 108],
      [290, 587, 491, 719, 361],
      [537, 609, 755, 719, 615],
      [775, 629, 1020, 718, 873],
      [23, 878, 272, 951, 130],
      [278, 883, 520, 952, 374],
      [527, 889, 766, 955, 619],
      [773, 890, 1022, 955, 869],
    ],
    endpoints: [WEAPON_POSES.rocket.prone],
  },
  sniper: {
    scale: 0.32,
    cels: [
      [40, 1059, 258, 1197, 108],
      [288, 1073, 511, 1198, 361],
      [543, 1083, 766, 1200, 615],
      [763, 1114, 1020, 1197, 873],
      [29, 1350, 278, 1425, 130],
      [277, 1356, 533, 1430, 374],
      [525, 1364, 770, 1432, 619],
      [777, 1376, 1019, 1437, 869],
    ],
    endpoints: [WEAPON_POSES.sniper.prone],
  },
};

export function isolateFigure(
  source: HTMLImageElement,
  left: number,
  top: number,
  w: number,
  h: number,
) {
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d')!;
  ctx.drawImage(source, left, top, w, h, 0, 0, w, h);
  const pixels = ctx.getImageData(0, 0, w, h),
    labels = new Int32Array(w * h),
    queue = new Int32Array(w * h);
  let serial = 0,
    best = 0,
    bestSize = 0;
  for (let start = 0; start < w * h; start++) {
    if (labels[start] || pixels.data[start * 4 + 3] < 16) continue;
    const label = ++serial;
    let head = 0,
      tail = 1;
    queue[0] = start;
    labels[start] = label;
    while (head < tail) {
      const at = queue[head++],
        x = at % w;
      for (const next of [
        x ? at - 1 : -1,
        x < w - 1 ? at + 1 : -1,
        at - w,
        at + w,
      ])
        if (
          next >= 0 &&
          next < w * h &&
          !labels[next] &&
          pixels.data[next * 4 + 3] >= 16
        ) {
          labels[next] = label;
          queue[tail++] = next;
        }
    }
    if (tail > bestSize) {
      best = label;
      bestSize = tail;
    }
  }
  for (let at = 0; at < w * h; at++) {
    if (labels[at] === best) continue;
    // Retain the original soft alpha immediately bordering this body, but
    // never a differently labelled fragment of the adjacent soldier.
    const x = at % w,
      near = [x ? at - 1 : -1, x < w - 1 ? at + 1 : -1, at - w, at + w].some(
        (p) => p >= 0 && p < w * h && labels[p] === best,
      );
    if (labels[at] !== 0 || !near) pixels.data[at * 4 + 3] = 0;
  }
  ctx.putImageData(pixels, 0, 0);
  return out;
}

function paintCels(
  source: HTMLImageElement,
  scale: number,
  cels: WeaponStanceCalibration['cels'],
  isolate = true,
): SpecialistFrame[] {
  return cels.map(([left, top, right, bottom, anchor]) => {
    const image = document.createElement('canvas');
    image.width = 128;
    image.height = 96;
    const ctx = image.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    // The padding retains antialiased edges without sampling a neighboring cel.
    const pad = 2,
      w = right - left + 2 * pad,
      h = bottom - top + 2 * pad;
    let cel: CanvasImageSource = source;
    let sx = left - pad,
      sy = top - pad;
    if (isolate) {
      cel = isolateFigure(source, sx, sy, w, h);
      sx = sy = 0;
    }
    ctx.drawImage(
      cel,
      sx,
      sy,
      w,
      h,
      64 + (left - pad - anchor) * scale,
      96 - (h - pad) * scale,
      w * scale,
      h * scale,
    );
    return { image, waist: [64, 80], muzzle: null };
  });
}

export function weaponStanceAtlas(
  upperSource: HTMLImageElement,
  lowerSource: HTMLImageElement,
  role: keyof typeof UPPER_WEAPON_CELS,
  lower: WeaponStanceCalibration,
): AdultSpecialistArt {
  const upper = paintCels(upperSource, 0.21, UPPER_WEAPON_CELS[role], false);
  // Preserve the established eight-beat timing without using cropped fourth
  // column weapons. The two extra knee beats deliberately hold a full cel.
  const stance16 = [
    upper[0],
    upper[1],
    upper[2],
    upper[3],
    upper[3],
    upper[4],
    upper[5],
    upper[5],
    ...paintCels(lowerSource, lower.scale, lower.cels),
  ];
  // Both segments meet at one identical knee; a repeated generated drawing
  // is not guaranteed to have exactly the same hand, barrel or silhouette.
  stance16[8] = stance16[7];
  if (role === 'sniper') {
    // The intact planted-hand drawing bridges the supplemental sheet's
    // 37→26px drop; keep the original anatomy rather than stretch a cel.
    const bridge = paintCels(upperSource, 0.21, [[626, 828, 997, 971, 769]])[0];
    stance16.splice(11, 4, bridge, stance16[11], stance16[12], stance16[14]);
  }
  const endpoints = [...UPPER_WEAPON_ENDPOINTS[role], lower.endpoints[0]];
  for (const [i, index] of [0, 7, 15].entries()) {
    stance16[index].waist = endpoints[i].waist;
    stance16[index].muzzle = endpoints[i].muzzle;
  }
  return {
    standing: stance16[0],
    crouch: stance16[7],
    prone: stance16[15],
    stance16,
  };
}

/** Lossless prepared cels avoid decoding five megabytes of mostly unused
 * originals and running connected-component extraction on every page load. */
export function packedWeaponStances(source: HTMLImageElement) {
  const result: Partial<
    Record<keyof typeof UPPER_WEAPON_CELS, AdultSpecialistArt>
  > = {};
  for (const [row, role] of (
    ['machinegun', 'rocket', 'sniper'] as const
  ).entries()) {
    const stance16: SpecialistFrame[] = Array.from({ length: 16 }, (_, col) => {
      const image = document.createElement('canvas');
      image.width = 128;
      image.height = 96;
      const ctx = image.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(source, col * 128, row * 96, 128, 96, 0, 0, 128, 96);
      return { image, waist: [64, 80], muzzle: null };
    });
    stance16[8] = stance16[7];
    const endpoints = [
      ...UPPER_WEAPON_ENDPOINTS[role],
      LOWER_WEAPON_CELS[role].endpoints[0],
    ];
    for (const [i, index] of [0, 7, 15].entries())
      Object.assign(stance16[index], endpoints[i]);
    result[role] = {
      standing: stance16[0],
      crouch: stance16[7],
      prone: stance16[15],
      stance16,
    };
  }
  return result;
}
