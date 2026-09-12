import type { Scenery } from './world';
import { TREE_PROFILES_V17, TREE_FALL_DURATION_V17 } from './tree-art-v17';

export function treeStateV17(p: Scenery, time: number) {
  const trunk = p.parts.find((a) => a.kind === 'trunk')!;
  const crown = p.parts.find((a) => a.kind === 'crown')!;
  const kind = p.seed % 2 === 0 ? 'pine' : 'broadleaf';
  const health =
    p.parts.reduce((n, a) => n + Math.max(0, a.hp), 0) /
    Math.max(
      1,
      p.parts.reduce((n, a) => n + a.maxHp, 0),
    );
  const fallAge = trunk.hp <= 0 ? Math.max(0, time - trunk.brokenAt) : null;
  // A crown killed together with its trunk remains on the fallen silhouette.
  const bare = crown.hp <= 0 && crown.brokenAt < trunk.brokenAt;
  return {
    kind,
    health,
    fallAge,
    bare,
    flip: (p.seed & 4) !== 0,
    settled:
      fallAge === null ? 0 : Math.min(1, fallAge / TREE_FALL_DURATION_V17),
  } as const;
}

/** Each visible solid/foliage piece still stops bullets, but never becomes a traversal wall. */
export function treeBoxesV17(p: Scenery, time: number, groundY: number) {
  const state = treeStateV17(p, time),
    profile = TREE_PROFILES_V17[state.kind];
  const fallen = state.fallAge !== null;
  const base = p.y + (groundY - p.y) * state.settled;
  const trunk = p.parts.find((a) => a.kind === 'trunk')!,
    crown = p.parts.find((a) => a.kind === 'crown')!;
  type Rect = [number, number, number, number];
  let trunkRects = fallen ? profile.fallenTrunk : profile.trunk;
  let crownRects = fallen
    ? state.bare
      ? []
      : profile.fallenCrown
    : crown.hp <= 0
      ? []
      : state.health < 0.68
        ? profile.damagedCrown
        : profile.crown;
  if (state.fallAge !== null && state.fallAge < TREE_FALL_DURATION_V17) {
    // These positions follow the eight authored poses, including their late impact
    // frames. Match the sprite's discrete frame rather than an interpolated angle.
    const frame = Math.min(
      7,
      Math.floor((state.fallAge / TREE_FALL_DURATION_V17) * 8),
    );
    const tips: [number, number][] =
      state.kind === 'pine'
        ? [
            [0, -98],
            [24, -94],
            [43, -79],
            [61, -72],
            [77, -61],
            [89, -35],
            [95, -17],
            [97, -15],
          ]
        : [
            [19, -78],
            [36, -72],
            [51, -62],
            [58, -54],
            [63, -40],
            [69, -18],
            [75, -16],
            [75, -15],
          ];
    const crowns: Rect[][] =
      state.kind === 'pine'
        ? [
            [
              [-30, -133, 57, 71],
              [-35, -89, 73, 54],
            ],
            [
              [9, -133, 36, 57],
              [-8, -98, 58, 74],
            ],
            [
              [46, -119, 31, 46],
              [17, -92, 61, 38],
              [29, -60, 40, 43],
            ],
            [
              [60, -109, 37, 43],
              [26, -89, 66, 40],
              [39, -52, 34, 39],
            ],
            [
              [79, -96, 33, 36],
              [47, -75, 61, 39],
              [39, -43, 40, 29],
            ],
            [
              [89, -61, 50, 30],
              [46, -57, 69, 38],
              [49, -31, 73, 29],
            ],
            [[56, -39, 88, 38]],
            [[67, -43, 86, 42]],
          ]
        : [
            [
              [-34, -136, 54, 62],
              [0, -108, 44, 59],
              [30, -86, 33, 56],
            ],
            [
              [8, -117, 53, 46],
              [-1, -82, 78, 42],
              [35, -57, 43, 33],
            ],
            [
              [30, -120, 64, 39],
              [13, -90, 85, 42],
              [46, -56, 39, 35],
            ],
            [
              [36, -111, 59, 35],
              [17, -87, 83, 36],
              [42, -53, 44, 30],
            ],
            [
              [41, -94, 61, 32],
              [30, -71, 78, 29],
              [48, -45, 35, 32],
            ],
            [
              [48, -63, 54, 34],
              [34, -40, 80, 39],
            ],
            [
              [53, -57, 48, 28],
              [35, -31, 87, 33],
            ],
            [
              [58, -51, 34, 24],
              [45, -32, 76, 33],
            ],
          ];
    const [tipX, tipY] = tips[frame];
    // A few short trunk sections avoid the large empty corners of a single
    // diagonal bounding box. The stump remains at the same authored root.
    trunkRects = [
      [-6, -24, 12, 15],
      [-10, -9, 20, 9],
    ];
    for (let i = 0; i < 5; i++) {
      const t0 = i / 5,
        t1 = (i + 1) / 5;
      const x0 = tipX * t0,
        x1 = tipX * t1;
      const y0 = -19 + (tipY + 19) * t0,
        y1 = -19 + (tipY + 19) * t1;
      const radius = state.kind === 'pine' ? 4 - i * 0.25 : 5 - i * 0.3;
      trunkRects.push([
        Math.min(x0, x1) - radius,
        Math.min(y0, y1) - radius,
        Math.abs(x1 - x0) + radius * 2,
        Math.abs(y1 - y0) + radius * 2,
      ]);
    }
    crownRects = state.bare ? [] : crowns[frame];
  }
  const pieces = [
    ...trunkRects.map((rect) => ({ rect, part: trunk, foliage: false })),
    ...crownRects.map((rect) => ({ rect, part: crown, foliage: true })),
  ];
  return pieces.map(({ rect: [x, y, w, h], part, foliage }) => ({
    x: p.x + (state.flip ? -x - w : x),
    y: base + y,
    w,
    h,
    prop: p,
    part,
    foliage,
    rubble: fallen,
  }));
}
