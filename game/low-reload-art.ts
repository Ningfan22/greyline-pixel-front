/** Measured figure rectangles from the unchanged v143 RGBA original.
 * The generated layout is NOT an equal 4x4 grid. Preserve padding/alpha,
 * use one anatomical scale per pose group, never fit each cel independently.
 * Rectangle endpoints are exclusive. Knees/elbows all register to y=96.
 */
export const LOW_RELOAD_CELS = [
  [34,88,305,345], [347,88,618,345], [660,88,931,345], [974,88,1245,345],
  [33,455,305,711], [346,455,618,711], [660,455,932,711], [974,455,1245,711],
  [7,852,310,947], [320,853,624,948], [634,853,937,948], [947,853,1251,946],
  [7,1087,310,1182], [321,1087,624,1182], [634,1089,937,1181], [948,1087,1251,1182],
] as const;

export function lowReloadAtlas(image: HTMLImageElement): HTMLCanvasElement[] {
  return LOW_RELOAD_CELS.map(([left, top, right, bottom], i) => {
    const out = document.createElement('canvas'); out.width = out.height = 96;
    const ctx = out.getContext('2d')!; ctx.imageSmoothingEnabled = true;
    const scale = i < 8 ? .166 : .18, anchor = i < 8 ? 105 : 148;
    // Include two pixels of the original antialiased fringe. These measured
    // rectangles cannot include the neighboring row or its weapon barrel.
    const w = right-left+4, h = bottom-top+4;
    ctx.drawImage(image, left-2, top-2, w, h,
      48-(anchor+2)*scale, 96-(h-2)*scale, w*scale, h*scale);
    return out;
  });
}
