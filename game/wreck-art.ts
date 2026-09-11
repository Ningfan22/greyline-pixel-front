import { transparentSheet } from './sprite-atlas';
import { WRECKS, type WreckKind } from './wreck-geometry';

/** Extract authored wrecks; no live sprite, tint or vertical compression is used. */
export function wreckFrames(ground: HTMLImageElement, air: HTMLImageElement) {
  const sheets = {
    ground: transparentSheet(ground),
    air: transparentSheet(air),
  };
  return Object.fromEntries(
    Object.entries(WRECKS).map(([id, shape]) => {
      const frame = document.createElement('canvas');
      frame.width = shape.width;
      frame.height = shape.height;
      const ctx = frame.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        sheets[shape.atlas],
        ...shape.source,
        0,
        0,
        frame.width,
        frame.height,
      );
      return [id, frame];
    }),
  ) as Record<WreckKind, HTMLCanvasElement>;
}
