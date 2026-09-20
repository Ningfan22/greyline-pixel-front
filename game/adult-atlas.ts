import { transparentSheet } from './sprite-atlas';
import type { AdultSprites } from './adult-animation';
/** The packed reference already uses a 384px cell, 252px adult and a shared foot anchor. */
export function adultAtlas(image: HTMLImageElement): Omit<AdultSprites, 'signals4' | 'reload8' | 'grenade8' | 'stance16' | 'lowReload16' | 'medical24' | 'lowGrenade32' | 'repair34' | 'proneIdle8'> {
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
    // Save the authored pair BEFORE loadArt replaces actions20[2] with the
    // new, lower settled stance. Mixing that 17px body into this 23–25px
    // crawl made every step visibly flatten and spring up again.
    crawl2: [frames[18], frames[28]],
    reactions8: frames.slice(36, 44),
  };
}

/** Generated eight-cel standing reload, measured rather than square-grid fitted.
 * Common scale retains the 63px adult and a fixed 95px boot anchor. */
export function standingReloadFrames(image: HTMLImageElement): HTMLCanvasElement[] {
  const source = transparentSheet(image);
  const cellW = source.width / 4, cellH = source.height / 2;
  const scale = 63 / 454;
  return Array.from({ length: 8 }, (_, i) => {
    const row = Math.floor(i / 4), out = document.createElement('canvas');
    out.width = out.height = 96;
    const ctx = out.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    const baseline = row === 0 ? 578 : 565;
    ctx.drawImage(source, (i % 4) * cellW, row * cellH, cellW, cellH,
      48 - 130 * scale, 95 - baseline * scale, cellW * scale, cellH * scale);
    return out;
  });
}

/** Measured gutters, NOT equal cells: the release hand extends past x=314.
 * Registration still uses the original common pelvis/boot anchors, not each
 * silhouette's bounding box, so an outstretched arm cannot shrink the body. */
export function standingGrenadeFrames(image: HTMLImageElement): HTMLCanvasElement[] {
  const source = transparentSheet(image), scale = 63 / 504;
  const cuts = [[40, 315, 640, 970, 1240], [40, 355, 640, 970, 1240]];
  return Array.from({ length: 8 }, (_, i) => {
    const row = Math.floor(i / 4), col = i % 4;
    const left = cuts[row][col], right = cuts[row][col + 1];
    const out = document.createElement('canvas');
    out.width = out.height = 96;
    const ctx = out.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(source, left, row * 627 + 70, right - left, 528,
      48 + (left - col * 313.5 - 171) * scale,
      95 + (70 - 587) * scale, (right - left) * scale, 528 * scale);
    return out;
  });
}

/**
 * v121: dedicated hand-signal sheets (2x2 grid, point-forward / wave-overhead /
 * point-back / fist). The old signal branch reused climbing frames, which read
 * as the leader hauling himself up a rope instead of directing the squad.
 * These sheets are painted at high resolution with real anti-aliased alpha, so
 * unlike adultAtlas they keep smoothing on and skip the alpha binarisation.
 */
export function signalFrames(image: HTMLImageElement): HTMLCanvasElement[] {
  const source = transparentSheet(image);
  const cellW = source.width / 2,
    cellH = source.height / 2;
  return Array.from({ length: 4 }, (_, index) => {
    const out = document.createElement('canvas');
    out.width = out.height = 96;
    const ctx = out.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(
      source,
      (index % 2) * cellW,
      Math.floor(index / 2) * cellH,
      cellW,
      cellH,
      0,
      0,
      96,
      96,
    );
    return out;
  });
}
