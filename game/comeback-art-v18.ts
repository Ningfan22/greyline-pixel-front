import { assetUrl } from './asset-url';

export interface ComebackArtV18 {
  toxicCloud8: HTMLCanvasElement[];
}
export const TOXIC_CLOUD_CELL_V18 = [256, 128] as const;
export const TOXIC_CLOUD_ANCHOR_V18 = [128, 112] as const;
export const TOXIC_CLOUD_FRAME_SECONDS_V18 = 0.3;
export const TOXIC_CLOUD_CYCLE_SECONDS_V18 = 2.4;

export function comebackFramesV18(image: HTMLImageElement): ComebackArtV18 {
  return {
    toxicCloud8: Array.from({ length: 8 }, (_, index) => {
      const frame = document.createElement('canvas');
      [frame.width, frame.height] = TOXIC_CLOUD_CELL_V18;
      const ctx = frame.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        image,
        (index % 4) * 256,
        Math.floor(index / 4) * 128,
        256,
        128,
        0,
        0,
        256,
        128,
      );
      return frame;
    }),
  };
}

export function toxicCloudFrameV18(
  art: ComebackArtV18,
  elapsedSeconds: number,
) {
  const phase = Math.max(0, elapsedSeconds) % TOXIC_CLOUD_CYCLE_SECONDS_V18;
  return art.toxicCloud8[
    Math.min(7, Math.floor(phase / TOXIC_CLOUD_FRAME_SECONDS_V18))
  ];
}

/** width is the whole padded cell width; painted cloud occupies about 88%.
 * Large areas can use several offset authored clouds to retain a low silhouette. */
export function drawToxicCloudV18(
  ctx: CanvasRenderingContext2D,
  art: ComebackArtV18,
  elapsedSeconds: number,
  x: number,
  groundY: number,
  width = 256,
  opacity = 1,
  flip = false,
) {
  if (width <= 0 || opacity <= 0) return;
  const scale = width / TOXIC_CLOUD_CELL_V18[0];
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha *= Math.min(1, opacity);
  ctx.translate(Math.round(x), Math.round(groundY));
  ctx.scale((flip ? -1 : 1) * scale, scale);
  ctx.drawImage(toxicCloudFrameV18(art, elapsedSeconds), -128, -112);
  ctx.restore();
}

let pending: Promise<ComebackArtV18> | undefined;
export function loadComebackArtV18(): Promise<ComebackArtV18> {
  return (pending ??= new Promise<ComebackArtV18>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(comebackFramesV18(image));
    image.onerror = () => reject(new Error('Unable to load toxic cloud art'));
    image.src = assetUrl('/art/v18-comeback/toxic-cloud.png');
  }).catch((error) => {
    pending = undefined;
    throw error;
  }));
}
