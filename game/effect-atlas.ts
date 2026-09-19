/** Measured bands in the authored 1448 × 1086 explosion sheet.
 * They are deliberately unequal: equal sixths included the preceding fire
 * baseline in the sky and cut the tall artillery column off halfway up.
 */
export const EXPLOSION_BANDS = [
  [0, 207, 196],
  [207, 371, 370],
  [371, 607, 604],
  [607, 786, 777],
  [786, 925, 917],
  [925, 1086, 1048],
] as const;
export interface PaintedBlasts {
  fuel: HTMLCanvasElement[];
  earth: HTMLCanvasElement[];
}
const COLUMN_CUTS = [
  [0, 180, 370, 559, 750, 943, 1132, 1320, 1448],
  [0, 187, 370, 565, 759, 946, 1132, 1310, 1448],
  [0, 180, 356, 550, 747, 937, 1125, 1314, 1448],
  [0, 187, 370, 559, 749, 947, 1131, 1310, 1448],
  [0, 181, 370, 558, 746, 944, 1130, 1310, 1448],
  [0, 181, 370, 558, 746, 944, 1130, 1310, 1448],
] as const;
const CENTRES = [96, 278, 467, 655, 845, 1030, 1216, 1390];

export function explosionAtlasV13(source: HTMLCanvasElement) {
  const scale = 96 / (source.width / 8);
  return EXPLOSION_BANDS.map(([top, bottom, baseline], row) =>
    Array.from({ length: 8 }, (_, column) => {
      const frame = document.createElement('canvas');
      frame.width = 112;
      frame.height = 144;
      const ctx = frame.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      const left = COLUMN_CUTS[row][column];
      const right = COLUMN_CUTS[row][column + 1];
      // Shared scale and ground anchor across all 48 frames. Keep detached
      // debris and soft alpha; connected-component filtering erased both.
      const dx = 56 + (left - CENTRES[column]) * scale;
      const dw = (right - left) * scale;
      ctx.drawImage(source, left, top, right - left, bottom - top,
        dx, 140 - (baseline - top) * scale, dw, (bottom - top) * scale);
      // Adjacent painted plumes touch in two rows. Feather only the narrow
      // shared cut edge so it cannot render as a hard vertical rectangle.
      const pixels = ctx.getImageData(0, 0, frame.width, frame.height);
      for (let y = 0; y < frame.height; y++) for (let x = 0; x < frame.width; x++) {
        const edge = Math.max(0, Math.min(1, (x - dx) / 3, (dx + dw - 1 - x) / 3));
        pixels.data[(y * frame.width + x) * 4 + 3] *= edge;
      }
      ctx.putImageData(pixels, 0, 0);
      return frame;
    }),
  );
}

/** Painted smoke-only frames, fitted together rather than per-frame, so the
 * shrinking tail does not inflate to a full-size cloud on every beat. */
export function smokeAtlasV13(source: HTMLCanvasElement) {
  return Array.from({ length: 8 }, (_, column) => {
    const frame = document.createElement('canvas');
    frame.width = frame.height = 80;
    const ctx = frame.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(source, CENTRES[column] - 85, 925, 170, 135, 0, 10, 80, 60);
    return frame;
  });
}

const smokeTints = new WeakMap<HTMLCanvasElement, Map<string, HTMLCanvasElement>>();
const effectBlends = new WeakMap<HTMLCanvasElement, WeakMap<HTMLCanvasElement, HTMLCanvasElement[]>>();
/** Cached premultiplied-alpha blend. Drawing two translucent sprites directly
 * with source-over punched a see-through dip into every halfway frame. */
export function blendEffectFrame(first: HTMLCanvasElement, next: HTMLCanvasElement, phase: number) {
  const step = Math.max(0,Math.min(4,Math.round(phase*4)));
  if (step === 0 || first === next) return first;
  if (step === 4) return next;
  let pairs = effectBlends.get(first);
  if (!pairs) effectBlends.set(first,pairs=new WeakMap());
  let frames = pairs.get(next);
  if (!frames) pairs.set(next,frames=[]);
  if (!frames[step]) {
    const out=document.createElement('canvas');out.width=first.width;out.height=first.height;
    const c=out.getContext('2d')!;c.globalAlpha=1-step/4;c.drawImage(first,0,0);
    c.globalCompositeOperation='lighter';c.globalAlpha=step/4;c.drawImage(next,0,0);
    frames[step]=out;
  }
  return frames[step];
}
export function drawSmokePuff(
  ctx: CanvasRenderingContext2D,
  frames: HTMLCanvasElement[],
  phase: number,
  x: number,
  y: number,
  size: number,
  color: string,
  alpha: number,
) {
  const position = Math.max(0,Math.min(frames.length-1,phase*(frames.length-1)));
  const index = Math.floor(position);
  const source = frames[index] && blendEffectFrame(frames[index],frames[Math.min(index+1,frames.length-1)],position-index);
  if (!source) return;
  let colors = smokeTints.get(source);
  if (!colors) smokeTints.set(source, colors = new Map());
  let frame = colors.get(color);
  if (!frame) {
    frame = document.createElement('canvas');
    frame.width = source.width;
    frame.height = source.height;
    const c = frame.getContext('2d')!;
    c.drawImage(source, 0, 0);
    c.globalCompositeOperation = 'source-atop';
    c.globalAlpha = 0.65;
    c.fillStyle = color;
    c.fillRect(0, 0, frame.width, frame.height);
    colors.set(color, frame);
  }
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(frame, Math.round(x - size / 2), Math.round(y - size / 2), size, size);
  ctx.restore();
}
