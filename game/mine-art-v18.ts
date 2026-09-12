import { assetUrl } from './asset-url';

export type MineKindV18 = 'antipersonnel' | 'antitank';
export interface MineSpritesV18 {
  unarmed: HTMLCanvasElement;
  armed: HTMLCanvasElement;
  dustyUnarmed: HTMLCanvasElement;
  dustyArmed: HTMLCanvasElement;
}
export type MineArtV18 = Record<MineKindV18, MineSpritesV18>;
export const MINE_CELL_V18 = [40, 20] as const;
export const MINE_ANCHOR_V18 = [20, 20] as const;
/** Subject dimensions, excluding transparent cell padding. */
export const MINE_SIZE_V18 = {
  antipersonnel: [20, 9],
  antitank: [28, 12],
} as const;

export function mineFramesV18(image: HTMLImageElement): MineArtV18 {
  const kinds: MineKindV18[] = ['antipersonnel', 'antitank'];
  return Object.fromEntries(
    kinds.map((kind, row) => {
      const frames = Array.from({ length: 4 }, (_, col) => {
        const frame = document.createElement('canvas');
        [frame.width, frame.height] = MINE_CELL_V18;
        const ctx = frame.getContext('2d')!;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(image, col * 40, row * 20, 40, 20, 0, 0, 40, 20);
        return frame;
      });
      return [
        kind,
        {
          unarmed: frames[0],
          armed: frames[1],
          dustyUnarmed: frames[2],
          dustyArmed: frames[3],
        },
      ];
    }),
  ) as MineArtV18;
}

export function mineFrameV18(
  art: MineArtV18,
  kind: MineKindV18,
  armed: boolean,
  dusty = false,
) {
  const sprites = art[kind];
  return dusty
    ? armed
      ? sprites.dustyArmed
      : sprites.dustyUnarmed
    : armed
      ? sprites.armed
      : sprites.unarmed;
}

/** Draw the authored mine as a small world object, centered on its ground contact. */
export function drawMineV18(
  ctx: CanvasRenderingContext2D,
  art: MineArtV18,
  kind: MineKindV18,
  x: number,
  groundY: number,
  armed: boolean,
  dusty = false,
  flip = false,
  scale = 1,
) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(x), Math.round(groundY));
  ctx.scale((flip ? -1 : 1) * scale, scale);
  ctx.drawImage(mineFrameV18(art, kind, armed, dusty), -20, -20);
  ctx.restore();
}

let pending: Promise<MineArtV18> | undefined;
export function loadMineArtV18(): Promise<MineArtV18> {
  return (pending ??= new Promise<MineArtV18>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(mineFramesV18(image));
    image.onerror = () => reject(new Error('Unable to load mine art'));
    image.src = assetUrl('/art/v18-mines/mines.png');
  }).catch((error) => {
    pending = undefined;
    throw error;
  }));
}
