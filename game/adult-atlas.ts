import { transparentSheet } from './sprite-atlas';
import type { AdultSprites } from './adult-animation';
/** The packed reference already uses a 384px cell, 252px adult and a shared foot anchor. */
export function adultAtlas(image: HTMLImageElement): AdultSprites {
  const source = transparentSheet(image),
    context = source.getContext('2d')!;
  const pixels = context.getImageData(0, 0, source.width, source.height);
  for (let at = 3; at < pixels.data.length; at += 4)
    pixels.data[at] = pixels.data[at] > 120 ? 255 : 0;
  context.putImageData(pixels, 0, 0);
  const cellW = source.width / 8,
    cellH = source.height / 6;
  const frames = Array.from({ length: 44 }, (_, index) => {
    const out = document.createElement('canvas');
    out.width = out.height = 96;
    const ctx = out.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    // Do not fit individual bounding boxes: crouching and prone bodies keep their scale.
    ctx.drawImage(
      source,
      (index % 8) * cellW,
      Math.floor(index / 8) * cellH,
      cellW,
      cellH,
      0,
      0,
      96,
      96,
    );
    return out;
  });
  return {
    walk8: frames.slice(0, 8),
    crouch8: frames.slice(8, 16),
    actions20: frames.slice(16, 36),
    reactions8: frames.slice(36, 44),
  };
}
