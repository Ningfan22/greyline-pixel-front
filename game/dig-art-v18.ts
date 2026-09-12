import { assetUrl } from './asset-url';
import type { AdultIdentity } from './adult-animation';

export interface DigSpritesV18 {
  dig8: HTMLCanvasElement[];
}
export type DigArtV18 = Record<AdultIdentity, DigSpritesV18>;
export const DIG_CELL_V18 = 96;
export const DIG_ANCHOR_V18 = [48, 96] as const;
export const DIG_FRAME_SECONDS_V18 = 0.2;
export const DIG_CYCLE_SECONDS_V18 = 1.6;
export const DIG_PHASES_V18 = [
  'ready',
  'reach',
  'drive',
  'lever',
  'lift',
  'throw',
  'return',
  'settle',
] as const;

/** Generated poses are uniformly scaled and aligned at the rear planted boot.
 * The blade entering the ground may continue beneath the cell's ground boundary. */
export function digFramesV18(image: HTMLImageElement): DigSpritesV18 {
  return {
    dig8: Array.from({ length: 8 }, (_, index) => {
      const frame = document.createElement('canvas');
      frame.width = frame.height = DIG_CELL_V18;
      const ctx = frame.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        image,
        (index % 4) * 96,
        Math.floor(index / 4) * 96,
        96,
        96,
        0,
        0,
        96,
        96,
      );
      return frame;
    }),
  };
}

/** Call only while the member is actually digging at its work position.
 * elapsedSeconds is continuous work time; phaseOffset is also in seconds. */
export function digFrameV18(
  art: DigArtV18,
  identity: AdultIdentity,
  elapsedSeconds: number,
  phaseOffset = 0,
) {
  const phase =
    (((Math.max(0, elapsedSeconds) + phaseOffset) % DIG_CYCLE_SECONDS_V18) +
      DIG_CYCLE_SECONDS_V18) %
    DIG_CYCLE_SECONDS_V18;
  return art[identity].dig8[
    Math.min(7, Math.floor(phase / DIG_FRAME_SECONDS_V18))
  ];
}

export function drawDigV18(
  ctx: CanvasRenderingContext2D,
  art: DigArtV18,
  identity: AdultIdentity,
  elapsedSeconds: number,
  x: number,
  groundY: number,
  flip = false,
  phaseOffset = 0,
  scale = 1,
) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(x), Math.round(groundY));
  ctx.scale((flip ? -1 : 1) * scale, scale);
  ctx.drawImage(
    digFrameV18(art, identity, elapsedSeconds, phaseOffset),
    -48,
    -96,
  );
  ctx.restore();
}

let pending: Promise<DigArtV18> | undefined;
export function loadDigArtV18(): Promise<DigArtV18> {
  const identities: AdultIdentity[] = [
    'infantry',
    'marines',
    'police',
    'militia',
  ];
  return (pending ??= Promise.all(
    identities.map(
      (identity) =>
        new Promise<[AdultIdentity, DigSpritesV18]>((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve([identity, digFramesV18(image)]);
          image.onerror = () =>
            reject(new Error(`Unable to load digging art: ${identity}`));
          image.src = assetUrl(`/art/v18-dig/${identity}.png`);
        }),
    ),
  )
    .then((entries) => Object.fromEntries(entries) as DigArtV18)
    .catch((error) => {
      pending = undefined;
      throw error;
    }));
}
