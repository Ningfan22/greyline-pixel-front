/** Prepared integer-bounded cels: no original-sheet slicing in the runtime. */
export function packedLowGrenades(source: HTMLImageElement): HTMLCanvasElement[] {
  return Array.from({ length: 32 }, (_, i) => {
    const frame = document.createElement('canvas');
    frame.width = 128; frame.height = 96;
    const ctx = frame.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(source, i % 16 * 128, Math.floor(i / 16) * 96,
      128, 96, 0, 0, 128, 96);
    return frame;
  });
}
