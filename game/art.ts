export interface Art {
  background: HTMLCanvasElement;
  terrain: HTMLImageElement;
  soldiers: HTMLCanvasElement[][];
  vehicles: HTMLCanvasElement[][];
}
let cached: Promise<Art> | null = null;
function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`无法加载 ${src}`));
    img.src = src;
  });
}
function surface(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}
function frames(
  img: HTMLImageElement,
  cols: number,
  rows: number,
  lw: number,
  lh: number,
  soldier = false,
) {
  const src = surface(img.width, img.height),
    ctx = src.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, img.width, img.height).data,
    cw = img.width / cols,
    ch = img.height / rows;
  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) => {
      const left = Math.round(col * cw),
        right = Math.round((col + 1) * cw),
        top = Math.round(row * ch),
        bottom = Math.round((row + 1) * ch);
      let minX = right,
        minY = bottom,
        maxX = left,
        maxY = top;
      for (let y = top; y < bottom; y++)
        for (let x = left; x < right; x++) {
          if (data[(y * img.width + x) * 4 + 3] > 110) {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }
        }
      if (maxX < minX || maxY < minY) {
        minX = left;
        minY = top;
        maxX = right - 1;
        maxY = bottom - 1;
      }
      const out = surface(lw, lh),
        oc = out.getContext('2d')!;
      oc.imageSmoothingEnabled = false;
      const sw = maxX - minX + 1,
        sh = maxY - minY + 1;
      const targetHeights = [42, 42, 40, 44, 29, 14, 42, 42];
      const maxH = soldier
        ? row === 7
          ? [42, 29, 24, 12][col]
          : targetHeights[row]
        : lh - 2;
      const maxW = soldier
        ? row === 5 || (row === 7 && col >= 2)
          ? 62
          : 30
        : lw - 2;
      const scale = Math.min(maxW / sw, maxH / sh);
      const w = Math.max(1, Math.round(sw * scale)),
        h = Math.max(1, Math.round(sh * scale));
      oc.drawImage(
        img,
        minX,
        minY,
        sw,
        sh,
        Math.floor((lw - w) / 2),
        lh - h,
        w,
        h,
      );
      const px = oc.getImageData(0, 0, lw, lh);
      for (let i = 0; i < px.data.length; i += 4) {
        px.data[i + 3] = px.data[i + 3] > 150 ? 255 : 0;
      }
      oc.putImageData(px, 0, 0);
      return out;
    }),
  );
}
export function loadArt() {
  cached ??= Promise.all([
    loadImage('/art/battlefield-v3.png'),
    loadImage('/art/soldiers-v3.png'),
    loadImage('/art/vehicles-v3.png'),
    loadImage('/art/terrain-texture.png'),
  ]).then(([bg, soldiers, vehicles, terrain]) => {
    const background = surface(640, 214),
      ctx = background.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bg, 0, 0, 640, 214);
    return {
      background,
      terrain,
      soldiers: frames(soldiers, 4, 8, 64, 48, true),
      vehicles: frames(vehicles, 4, 3, 64, 32),
    };
  });
  return cached.catch((error) => {
    cached = null;
    throw error;
  });
}
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  frame: HTMLCanvasElement | undefined,
  x: number,
  y: number,
  w: number,
  h: number,
  flip = false,
  alpha = 1,
) {
  if (!frame) return;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = alpha;
  ctx.translate(Math.round(x), Math.round(y));
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(frame, -Math.round(w / 2), -h, w, h);
  ctx.restore();
}
export function cardFrame(art: Art, index: number) {
  if (index < 3) return art.soldiers[0][0];
  if (index === 3) return art.vehicles[0][0];
  if (index === 4) return art.vehicles[1][0];
  return art.vehicles[2][0];
}
