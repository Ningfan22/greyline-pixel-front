import { CARDS, modelOf, type CardId } from './cards';
import { FPV_WRECK_PROFILE } from './art-v16';
import { VEHICLE_SCALE } from './vehicle-geometry';

type Rect = [number, number, number, number];
export type WreckKind =
  | 'light_tank'
  | 'tank'
  | 'heavy_tank'
  | 'ifv'
  | 'sam_vehicle'
  | 'howitzer'
  | 'at_gun'
  | 'aa_gun'
  | 'scout_drone'
  | 'fpv_drone'
  | 'helicopter'
  | 'rocket_heli'
  | 'medevac'
  | 'attack_drone'
  | 'loiter_drone'
  | 'interceptor'
  | 'strike_jet'
  | 'bomber'
  | 'pickup'
  | 'tow_ifv'
  | 'mortar_carrier'
  | 'recovery_vehicle'
  | 'command_vehicle'
  | 'mine_clearer';
export interface WreckGeometry {
  atlas: 'ground' | 'air' | 'mobile' | 'support' | 'fpv';
  source: Rect;
  width: number;
  height: number;
  parts: Rect[];
  support: [number, number, number];
  spriteOffset: number;
}
function shape(
  atlas: WreckGeometry['atlas'],
  source: Rect,
  width: number,
  parts: Rect[],
  support: WreckGeometry['support'],
  spriteOffset = 0,
): WreckGeometry {
  return {
    atlas,
    source,
    width,
    height: Math.round((width * source[3]) / source[2]),
    parts,
    support,
    spriteOffset,
  };
}
/** Authored silhouettes measured from the generated atlases; no live-sprite scaling ratios. */
export const WRECKS: Record<WreckKind, WreckGeometry> = {
  fpv_drone: { atlas: 'fpv', ...FPV_WRECK_PROFILE },
  pickup: shape(
    'mobile',
    [1597, 215, 350, 143],
    190,
    [
      [0.034, 0.364, 0.331, 0.238],
      [0.509, 0.308, 0.131, 0.378],
      [0.097, 0.643, 0.577, 0.126],
      [0.151, 0.713, 0.111, 0.168],
      [0.694, 0.51, 0.177, 0.182],
      [0.837, 0.825, 0.126, 0.105],
    ],
    [0.131, 0.769, 0.909],
    9.5,
  ),
  tow_ifv: shape(
    'mobile',
    [1599, 473, 351, 195],
    240,
    [
      [0.063, 0.538, 0.809, 0.231],
      [0.131, 0.8, 0.678, 0.128],
      [0.088, 0.385, 0.199, 0.138],
      [0.578, 0.364, 0.205, 0.159],
      [0.604, 0.215, 0.202, 0.062],
      [0.926, 0.795, 0.043, 0.072],
    ],
    [0.14, 0.823, 0.954],
    4.44,
  ),
  mortar_carrier: shape(
    'support',
    [1185, 102, 307, 153],
    210,
    [
      [0.046, 0.464, 0.329, 0.209],
      [0.567, 0.405, 0.225, 0.268],
      [0.837, 0.556, 0.111, 0.176],
      [0.111, 0.712, 0.681, 0.098],
      [0.166, 0.752, 0.101, 0.17],
      [0.423, 0.771, 0.107, 0.157],
      [0.694, 0.895, 0.127, 0.072],
      [0.332, 0.301, 0.192, 0.111],
    ],
    [0.173, 0.782, 0.961],
    4.79,
  ),
  recovery_vehicle: shape(
    'support',
    [1167, 330, 343, 175],
    220,
    [
      [0.087, 0.646, 0.746, 0.183],
      [0.093, 0.326, 0.411, 0.28],
      [0.513, 0.474, 0.245, 0.16],
      [0.364, 0.177, 0.047, 0.109],
      [0.519, 0.286, 0.149, 0.057],
    ],
    [0.114, 0.837, 0.886],
    5.45,
  ),
  command_vehicle: shape(
    'support',
    [1184, 532, 328, 219],
    210,
    [
      [0.082, 0.461, 0.527, 0.297],
      [0.646, 0.53, 0.107, 0.205],
      [0.793, 0.667, 0.119, 0.11],
      [0.195, 0.799, 0.107, 0.114],
      [0.652, 0.9, 0.107, 0.05],
    ],
    [0.171, 0.72, 0.945],
    11.52,
  ),
  mine_clearer: shape(
    'support',
    [1164, 800, 360, 172],
    245,
    [
      [0.092, 0.465, 0.469, 0.192],
      [0.142, 0.302, 0.217, 0.134],
      [0.086, 0.709, 0.456, 0.14],
      [0.656, 0.564, 0.069, 0.145],
      [0.856, 0.698, 0.089, 0.18],
      [0.689, 0.814, 0.153, 0.047],
    ],
    [0.075, 0.558, 0.89],
    44.92,
  ),
  light_tank: shape(
    'ground',
    [17, 159, 413, 193],
    220,
    [
      [0.056, 0.699, 0.6, 0.223],
      [0.063, 0.482, 0.194, 0.207],
      [0.252, 0.549, 0.225, 0.187],
      [0.477, 0.554, 0.186, 0.171],
      [0.264, 0.192, 0.281, 0.192],
      [0.731, 0.855, 0.109, 0.073],
    ],
    [0.056, 0.656, 0.959],
  ),
  tank: shape(
    'ground',
    [452, 160, 421, 191],
    270,
    [
      [0.062, 0.733, 0.713, 0.199],
      [0.031, 0.513, 0.758, 0.215],
      [0.107, 0.293, 0.147, 0.157],
      [0.352, 0.183, 0.283, 0.225],
      [0.641, 0.356, 0.086, 0.126],
    ],
    [0.081, 0.774, 0.948],
  ),
  heavy_tank: shape(
    'ground',
    [900, 153, 420, 198],
    305,
    [
      [0.105, 0.753, 0.598, 0.187],
      [0.055, 0.566, 0.619, 0.182],
      [0.679, 0.641, 0.143, 0.152],
      [0.236, 0.101, 0.129, 0.217],
      [0.352, 0.212, 0.11, 0.217],
      [0.436, 0.086, 0.1, 0.152],
      [0.902, 0.798, 0.074, 0.146],
    ],
    [0.105, 0.705, 0.949],
  ),
  ifv: shape(
    'ground',
    [1347, 198, 419, 151],
    180,
    [
      [0.093, 0.715, 0.475, 0.212],
      [0.041, 0.338, 0.179, 0.298],
      [0.43, 0.358, 0.181, 0.258],
      [0.055, 0.225, 0.518, 0.086],
      [0.613, 0.371, 0.064, 0.159],
      [0.726, 0.689, 0.124, 0.192],
    ],
    [0.093, 0.568, 0.94],
  ),
  sam_vehicle: shape(
    'ground',
    [15, 501, 413, 288],
    180,
    [
      [0.058, 0.844, 0.816, 0.125],
      [0.027, 0.715, 0.852, 0.125],
      [0.128, 0.5, 0.366, 0.135],
      [0.383, 0.587, 0.179, 0.104],
      [0.605, 0.49, 0.148, 0.087],
      [0.315, 0.299, 0.053, 0.132],
      [0.271, 0.076, 0.087, 0.087],
    ],
    [0.077, 0.869, 0.976],
  ),
  howitzer: shape(
    'ground',
    [454, 567, 417, 220],
    170,
    [
      [0.624, 0.718, 0.096, 0.214],
      [0.46, 0.518, 0.125, 0.164],
      [0.42, 0.709, 0.192, 0.095],
      [0.173, 0.823, 0.23, 0.064],
      [0.554, 0.386, 0.077, 0.091],
      [0.633, 0.314, 0.074, 0.073],
      [0.71, 0.236, 0.062, 0.059],
    ],
    [0.077, 0.715, 0.982],
  ),
  at_gun: shape(
    'ground',
    [902, 663, 418, 125],
    160,
    [
      [0.373, 0.488, 0.117, 0.384],
      [0.459, 0.184, 0.112, 0.424],
      [0.579, 0.304, 0.148, 0.128],
      [0.136, 0.712, 0.232, 0.104],
    ],
    [0.086, 0.5, 0.952],
  ),
  aa_gun: shape(
    'ground',
    [1346, 557, 413, 231],
    120,
    [
      [0.247, 0.805, 0.339, 0.13],
      [0.722, 0.784, 0.099, 0.147],
      [0.274, 0.554, 0.254, 0.156],
      [0.262, 0.377, 0.206, 0.152],
      [0.099, 0.853, 0.14, 0.061],
      [0.838, 0.848, 0.077, 0.069],
    ],
    [0.09, 0.913, 0.97],
  ),
  scout_drone: shape(
    'air',
    [52, 205, 363, 125],
    50,
    [
      [0.364, 0.472, 0.215, 0.288],
      [0.416, 0.768, 0.129, 0.152],
    ],
    [0.358, 0.592, 0.952],
  ),
  helicopter: shape(
    'air',
    [517, 162, 508, 166],
    230,
    [
      [0.472, 0.464, 0.297, 0.386],
      [0.772, 0.657, 0.114, 0.193],
      [0.478, 0.325, 0.256, 0.12],
      [0.459, 0.867, 0.394, 0.06],
      [0.089, 0.699, 0.215, 0.127],
      [0.043, 0.44, 0.039, 0.229],
    ],
    [0.461, 0.87, 0.934],
  ),
  rocket_heli: shape(
    'air',
    [1075, 123, 405, 206],
    220,
    [
      [0.289, 0.675, 0.38, 0.218],
      [0.677, 0.728, 0.163, 0.165],
      [0.284, 0.539, 0.185, 0.121],
      [0.346, 0.451, 0.252, 0.15],
      [0.704, 0.578, 0.094, 0.136],
      [0.057, 0.767, 0.079, 0.097],
    ],
    [0.296, 0.83, 0.947],
  ),
  medevac: shape(
    'air',
    [18, 457, 484, 164],
    230,
    [
      [0.399, 0.524, 0.417, 0.311],
      [0.837, 0.64, 0.093, 0.177],
      [0.438, 0.335, 0.32, 0.128],
      [0.064, 0.701, 0.176, 0.122],
      [0.052, 0.335, 0.029, 0.183],
    ],
    [0.399, 0.783, 0.939],
  ),
  attack_drone: shape(
    'air',
    [543, 458, 514, 166],
    140,
    [
      [0.339, 0.62, 0.549, 0.175],
      [0.854, 0.693, 0.082, 0.108],
      [0.325, 0.542, 0.121, 0.078],
      [0.193, 0.524, 0.029, 0.235],
      [0.218, 0.729, 0.074, 0.102],
      [0.265, 0.163, 0.08, 0.066],
      [0.354, 0.277, 0.072, 0.066],
      [0.446, 0.398, 0.07, 0.072],
    ],
    [0.412, 0.825, 0.94],
  ),
  loiter_drone: shape(
    'air',
    [1095, 520, 404, 119],
    64,
    [
      [0.21, 0.529, 0.344, 0.16],
      [0.646, 0.555, 0.136, 0.185],
      [0.921, 0.622, 0.05, 0.126],
    ],
    [0.21, 0.916, 0.832],
  ),
  interceptor: shape(
    'air',
    [23, 741, 473, 209],
    210,
    [
      [0.307, 0.598, 0.474, 0.129],
      [0.812, 0.761, 0.116, 0.096],
      [0.044, 0.598, 0.192, 0.134],
      [0.089, 0.172, 0.055, 0.239],
      [0.118, 0.431, 0.087, 0.081],
      [0.664, 0.589, 0.097, 0.072],
      [0.383, 0.775, 0.402, 0.096],
      [0.326, 0.77, 0.146, 0.077],
      [0.144, 0.861, 0.178, 0.048],
    ],
    [0.171, 0.837, 0.938],
  ),
  strike_jet: shape(
    'air',
    [525, 781, 462, 172],
    230,
    [
      [0.303, 0.465, 0.446, 0.227],
      [0.784, 0.715, 0.152, 0.14],
      [0.18, 0.395, 0.16, 0.174],
      [0.42, 0.32, 0.128, 0.134],
      [0.039, 0.192, 0.041, 0.285],
      [0.258, 0.157, 0.028, 0.14],
      [0.734, 0.517, 0.076, 0.128],
      [0.55, 0.698, 0.227, 0.157],
      [0.227, 0.785, 0.264, 0.081],
    ],
    [0.221, 0.881, 0.913],
  ),
  bomber: shape(
    'air',
    [1000, 757, 515, 198],
    260,
    [
      [0.047, 0.561, 0.169, 0.157],
      [0.351, 0.54, 0.332, 0.172],
      [0.278, 0.722, 0.072, 0.061],
      [0.693, 0.636, 0.12, 0.167],
      [0.882, 0.768, 0.076, 0.076],
      [0.843, 0.707, 0.05, 0.091],
      [0.08, 0.192, 0.074, 0.237],
      [0.111, 0.394, 0.12, 0.101],
      [0.289, 0.833, 0.169, 0.056],
      [0.456, 0.727, 0.078, 0.061],
    ],
    [0.233, 0.932, 0.944],
  ),
};
for (const [id, scale] of Object.entries(VEHICLE_SCALE)) {
  const g = WRECKS[id as WreckKind];
  g.width = Math.round(g.width * scale);
  g.height = Math.round(g.height * scale);
  g.spriteOffset *= scale;
}
export function wreckKind(id: CardId): WreckKind {
  const c = CARDS[id];
  if (c.airlift) return 'medevac';
  if (c.emplacement) return c.emplacement;
  if (Object.hasOwn(WRECKS, id)) return id as WreckKind;
  return modelOf(id) === 'tank' ? 'tank' : c.air ? 'helicopter' : 'ifv';
}
export function wreckGeometry(id: CardId) {
  return WRECKS[wreckKind(id)];
}
type Placement = {
  cardId: CardId;
  x: number;
  y: number;
  angle: number;
  side: number;
  facing?: number;
};
function facing(w: Pick<Placement, 'side' | 'facing'>) {
  return w.facing ?? (w.side === 0 ? 1 : -1);
}
/** Solid pieces only: holes between fuselage sections and empty rotor space remain passable. */
export function wreckObstacles(w: Placement) {
  const g = wreckGeometry(w.cardId),
    dir = facing(w),
    cos = Math.cos(w.angle),
    sin = Math.sin(w.angle);
  return g.parts.map(([x, y, width, height]) => {
    const points = [
      [x, y],
      [x + width, y],
      [x, y + height],
      [x + width, y + height],
    ].map(([px, py]) => {
      const dx = ((px - 0.5) * g.width + g.spriteOffset) * dir,
        dy = (py - g.support[2]) * g.height;
      return { x: w.x + dx * cos - dy * sin, y: w.y + dx * sin + dy * cos };
    });
    const left = Math.min(...points.map((p) => p.x)),
      top = Math.min(...points.map((p) => p.y));
    return {
      x: left,
      y: top,
      w: Math.max(...points.map((p) => p.x)) - left,
      h: Math.max(...points.map((p) => p.y)) - top,
    };
  });
}
/** Sample the main tracks/fuselage support span so a wide wreck can bridge a crater. */
export function wreckContact(
  groundAt: (x: number) => number,
  w: Pick<Placement, 'cardId' | 'side' | 'facing' | 'x'>,
) {
  const g = wreckGeometry(w.cardId),
    dir = facing(w);
  const ends = g.support
    .slice(0, 2)
    .map((p) => ((p - 0.5) * g.width + g.spriteOffset) * dir)
    .sort((a, b) => a - b);
  const [left, right] = ends;
  const slope = Math.max(
    -0.14,
    Math.min(
      0.14,
      (groundAt(w.x + right) - groundAt(w.x + left)) /
        Math.max(1, right - left),
    ),
  );
  const angle = Math.atan(slope),
    cos = Math.cos(angle),
    sin = Math.sin(angle);
  let y = Infinity;
  for (let offset = left; offset <= right; offset += 1)
    y = Math.min(y, groundAt(w.x + offset * cos) - offset * sin);
  y = Math.min(y, groundAt(w.x + right * cos) - right * sin);
  return { y, angle };
}
