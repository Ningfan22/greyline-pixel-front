/** Prepared, lossless eight-column / three-posture medical cel bank. */
export function packedMedicalFrames(source: HTMLImageElement): HTMLCanvasElement[] {
  return Array.from({ length: 24 }, (_, i) => {
    const frame = document.createElement('canvas');
    frame.width = 128; frame.height = 96;
    const ctx = frame.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(source, (i % 8) * 128, Math.floor(i / 8) * 96,
      128, 96, 0, 0, 128, 96);
    return frame;
  });
}
