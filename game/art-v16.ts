import { assetUrl } from './asset-url';
import type { MapId } from './maps';

type Rect = [number, number, number, number];

export const FPV_SPRITE_SIZE: [number, number] = [54, 28];
export const FPV_WRECK_SIZE: [number, number] = [54, 19];
export const FPV_SHEET_URL = '/art/v16-air/fpv-frames.png';

/** Bounds measured on the original 1774 x 887 generated sprite sheet. */
export const FPV_SOURCE = {
  flightCells: [0, 444, 887, 1331],
  flightWindow: [28, 180, 393, 180] as Rect,
  rotorBottom: 228,
  wrecks: [
    [49, 595, 367, 145],
    [493, 543, 344, 193],
    [920, 604, 382, 134],
    [1359, 599, 388, 141],
  ] as Rect[],
};

/** Settled broken frame, with low body/arm blocks instead of a solid cell. */
export const FPV_WRECK_PROFILE = {
  source: [920, 604, 382, 134] as Rect,
  width: 54,
  height: 19,
  parts: [
    [0.15, 0.5, 0.69, 0.28],
    [0.12, 0.23, 0.12, 0.31],
    [0.39, 0.08, 0.1, 0.34],
    [0.75, 0.57, 0.13, 0.3],
  ] as Rect[],
  support: [0.14, 0.87, 0.9] as [number, number, number],
  spriteOffset: 0,
};

export const V16_CARD_ART = {
  fpv_drone: '/art/v16-air/cards/fpv_drone.webp',
  air_assault: '/art/v16-air/cards/air_assault.webp',
};

function canvas(width: number, height: number) {
  const frame = document.createElement('canvas');
  frame.width = width;
  frame.height = height;
  frame.getContext('2d')!.imageSmoothingEnabled = false;
  return frame;
}

/** Only the authored propeller band changes. The camera, battery and frame stay fixed.
 * Diving uses rotation of these same sprites, not a per-frame body shape change. */
export function fpvFlightFrames(image: HTMLImageElement) {
  const [x, y, width, height] = FPV_SOURCE.flightWindow;
  const scale = FPV_SPRITE_SIZE[0] / width;
  const destHeight = height * scale;
  const top = (FPV_SPRITE_SIZE[1] - destHeight) / 2;
  const rotorHeight = (FPV_SOURCE.rotorBottom - y) * scale;
  return FPV_SOURCE.flightCells.map((left) => {
    const frame = canvas(...FPV_SPRITE_SIZE);
    const ctx = frame.getContext('2d')!;
    ctx.drawImage(image, x, y, width, height, 0, top, 54, destHeight);
    ctx.clearRect(0, top, 54, rotorHeight);
    ctx.drawImage(
      image,
      left + x,
      y,
      width,
      FPV_SOURCE.rotorBottom - y,
      0,
      top,
      54,
      rotorHeight,
    );
    return frame;
  });
}

export function fpvWreckFrames(image: HTMLImageElement) {
  // Constant art scale for all crash stages; never squash height to fit a pose.
  const scale = FPV_WRECK_SIZE[0] / FPV_WRECK_PROFILE.source[2];
  return FPV_SOURCE.wrecks.map((source) => {
    const frame = canvas(54, 28);
    const ctx = frame.getContext('2d')!;
    ctx.drawImage(
      image,
      ...source,
      (54 - source[2] * scale) / 2,
      28 - source[3] * scale,
      source[2] * scale,
      source[3] * scale,
    );
    return frame;
  });
}

export function fpvSettledWreck(image: HTMLImageElement) {
  const frame = canvas(...FPV_WRECK_SIZE);
  const source = FPV_WRECK_PROFILE.source;
  const height = (54 * source[3]) / source[2];
  frame
    .getContext('2d')!
    .drawImage(image, ...source, 0, 19 - height, 54, height);
  return frame;
}

function loadImage(path: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load ${path}`));
    image.src = assetUrl(path);
  });
}

export interface V16Art {
  fpvFrames: HTMLCanvasElement[];
  fpvWreckFrames: HTMLCanvasElement[];
  fpvWreck: HTMLCanvasElement;
  fpvSheet: HTMLImageElement;
  mapBackgrounds: Partial<Record<MapId, HTMLCanvasElement>>;
}

let pending: Promise<V16Art> | undefined;
export function loadV16Art(): Promise<V16Art> {
  return (pending ??= Promise.all([
    loadImage(FPV_SHEET_URL),
    loadImage('/art/v16-maps/jungle.png'),
    loadImage('/art/v16-maps/mountains.png'),
    loadImage('/art/v16-maps/desert.png'),
  ])
    .then(([fpv, ...backgrounds]) => {
      const ids: MapId[] = ['jungle', 'mountains', 'desert'];
      const mapBackgrounds = Object.fromEntries(
        backgrounds.map((image, index) => {
          const background = canvas(720, 240);
          background.getContext('2d')!.drawImage(image, 0, 0, 720, 240);
          return [ids[index], background];
        }),
      );
      return {
        fpvFrames: fpvFlightFrames(fpv),
        fpvWreckFrames: fpvWreckFrames(fpv),
        fpvWreck: fpvSettledWreck(fpv),
        fpvSheet: fpv,
        mapBackgrounds,
      };
    })
    .catch((error) => {
      pending = undefined;
      throw error;
    }));
}
