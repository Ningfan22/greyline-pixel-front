import { assetUrl } from './asset-url';

export type TreeKindV17 = 'pine' | 'broadleaf';
type Rect = [number, number, number, number];
export interface TreeSpritesV17 {
  intact: HTMLCanvasElement;
  damaged: HTMLCanvasElement;
  fall8: HTMLCanvasElement[];
  fallen: HTMLCanvasElement;
  bare: HTMLCanvasElement;
}
export type TreeArtV17 = Record<TreeKindV17, TreeSpritesV17>;
export const TREE_CELL_V17 = [256, 160] as const;
export const TREE_ANCHOR_V17 = [70, 150] as const;
export const TREE_FALL_DURATION_V17 = 1.12;

/** Rectangles are world pixels relative to the stump on level ground.
 * Crown blocks remain probabilistic foliage; they must not become invisible solid walls. */
export const TREE_PROFILES_V17: Record<
  TreeKindV17,
  {
    trunk: Rect[];
    crown: Rect[];
    damagedCrown: Rect[];
    fallenTrunk: Rect[];
    fallenCrown: Rect[];
    support: [number, number];
  }
> = {
  pine: {
    trunk: [[-5, -99, 10, 99]],
    crown: [
      [-25, -138, 50, 60],
      [-39, -103, 78, 82],
    ],
    damagedCrown: [
      [-17, -138, 37, 55],
      [-30, -103, 64, 75],
    ],
    fallenTrunk: [
      [-6, -24, 12, 15],
      [-10, -9, 20, 9],
      [4, -20, 92, 11],
    ],
    fallenCrown: [[66, -40, 78, 39]],
    support: [-13, 144],
  },
  broadleaf: {
    trunk: [[-6, -82, 12, 82]],
    crown: [
      [-55, -128, 104, 47],
      [-60, -89, 122, 62],
    ],
    damagedCrown: [
      [-47, -128, 78, 44],
      [-53, -86, 108, 47],
    ],
    fallenTrunk: [
      [-5, -24, 10, 12],
      [-10, -12, 20, 12],
      [2, -17, 78, 12],
    ],
    fallenCrown: [[53, -42, 69, 41]],
    support: [-12, 123],
  },
};

export function treeFramesV17(image: HTMLImageElement): TreeSpritesV17 {
  const frames = Array.from({ length: 12 }, (_, index) => {
    const frame = document.createElement('canvas');
    [frame.width, frame.height] = TREE_CELL_V17;
    const ctx = frame.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      image,
      (index % 4) * 256,
      Math.floor(index / 4) * 160,
      256,
      160,
      0,
      0,
      256,
      160,
    );
    return frame;
  });
  return {
    intact: frames[0],
    damaged: frames[1],
    fall8: frames.slice(2, 10),
    fallen: frames[10],
    bare: frames[11],
  };
}

/** fallAge starts once, when trunk health reaches zero; never restart on later damage. */
export function treeFrameV17(
  art: TreeArtV17,
  kind: TreeKindV17,
  healthRatio: number,
  fallAge: number | null,
  defoliated = false,
) {
  const sprites = art[kind];
  if (fallAge === null)
    return healthRatio < 0.68 ? sprites.damaged : sprites.intact;
  if (fallAge >= TREE_FALL_DURATION_V17)
    return defoliated ? sprites.bare : sprites.fallen;
  return sprites.fall8[
    Math.min(7, Math.floor((Math.max(0, fallAge) / TREE_FALL_DURATION_V17) * 8))
  ];
}

/** All collapse poses are authored images. This draw path never rotates or compresses trees. */
export function drawTreeV17(
  ctx: CanvasRenderingContext2D,
  frame: HTMLCanvasElement,
  x: number,
  groundY: number,
  flip = false,
  scale = 1,
) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(x), Math.round(groundY));
  ctx.scale((flip ? -1 : 1) * scale, scale);
  ctx.drawImage(frame, -TREE_ANCHOR_V17[0], -TREE_ANCHOR_V17[1]);
  ctx.restore();
}

let pending: Promise<TreeArtV17> | undefined;
export function loadTreeArtV17(): Promise<TreeArtV17> {
  const kinds: TreeKindV17[] = ['pine', 'broadleaf'];
  return (pending ??= Promise.all(
    kinds.map(
      (kind) =>
        new Promise<[TreeKindV17, TreeSpritesV17]>((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve([kind, treeFramesV17(image)]);
          image.onerror = () =>
            reject(new Error(`Unable to load tree art: ${kind}`));
          // Authored V19 sprites use 128×80 logical cells, enlarged exactly 2×.
          // World size, the [70,150] root and all V17 collision profiles stay fixed.
          image.src = assetUrl(`/art/v19-trees/${kind}.png`);
        }),
    ),
  )
    .then((entries) => Object.fromEntries(entries) as TreeArtV17)
    .catch((error) => {
      pending = undefined;
      throw error;
    }));
}
