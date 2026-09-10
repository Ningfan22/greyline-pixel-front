export interface Art {
  background: HTMLCanvasElement;
  terrain: HTMLImageElement;
  soldiers: HTMLCanvasElement[][];
  vehicles: HTMLCanvasElement[][];
  locomotion: HTMLCanvasElement[][];
  reinforcements: HTMLCanvasElement[][];
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
function locomotionFrames(img: HTMLImageElement) {
  const source = surface(img.width, img.height),
    ctx = source.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const pixels = ctx.getImageData(0, 0, img.width, img.height);
  // The delivered sheet has a neutral pale matte. Key it during texture import.
  for (let i = 0; i < pixels.data.length; i += 4) {
    const r = pixels.data[i],
      g = pixels.data[i + 1],
      b = pixels.data[i + 2];
    if (Math.min(r, g, b) > 155 && Math.max(r, g, b) - Math.min(r, g, b) < 28)
      pixels.data[i + 3] = 0;
  }
  ctx.putImageData(pixels, 0, 0);
  const cw = img.width / 8,
    ch = img.height / 3;
  return Array.from({ length: 3 }, (_, row) =>
    Array.from({ length: 8 }, (_, col) => {
      let left = (col + 1) * cw,
        right = col * cw,
        top = (row + 1) * ch,
        bottom = row * ch;
      for (let y = Math.ceil(row * ch); y < Math.floor((row + 1) * ch); y++) {
        for (let x = Math.ceil(col * cw); x < Math.floor((col + 1) * cw); x++) {
          if (pixels.data[(y * img.width + x) * 4 + 3] > 0) {
            left = Math.min(left, x);
            right = Math.max(right, x);
            top = Math.min(top, y);
            bottom = Math.max(bottom, y);
          }
        }
      }
      const out = surface(64, 48),
        oc = out.getContext('2d')!;
      oc.imageSmoothingEnabled = false;
      // One scale for the entire cycle preserves body proportions during crouch and jump.
      const scale = 42 / (ch * 0.74),
        w = Math.round((right - left + 1) * scale),
        h = Math.round((bottom - top + 1) * scale);
      oc.drawImage(
        source,
        left,
        top,
        right - left + 1,
        bottom - top + 1,
        Math.round(32 - w / 2),
        48 - h,
        w,
        h,
      );
      return out;
    }),
  );
}
function croppedFrame(img: HTMLImageElement, rect: number[], lw = 64, lh = 40) {
  const out = surface(lw, lh),
    ctx = out.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const [x, y, w, h] = rect,
    scale = Math.min((lw - 2) / w, (lh - 2) / h);
  const dw = Math.round(w * scale),
    dh = Math.round(h * scale);
  ctx.drawImage(img, x, y, w, h, Math.floor((lw - dw) / 2), lh - dh, dw, dh);
  const px = ctx.getImageData(0, 0, lw, lh);
  for (let i = 3; i < px.data.length; i += 4)
    px.data[i] = px.data[i] > 150 ? 255 : 0;
  ctx.putImageData(px, 0, 0);
  return out;
}
function stableHelicopters(img: HTMLImageElement) {
  const raw = [0, 1, 2, 3].map((i) =>
    croppedFrame(img, [i * 512, 256, 512, 210], 64, 32),
  );
  return raw.map((rotor) => {
    const out = surface(64, 32),
      ctx = out.getContext('2d')!;
    // Keep the same fuselage pixels and anchor. Only the rotor band changes.
    ctx.drawImage(raw[1], 0, 0);
    ctx.clearRect(12, 6, 52, 11);
    ctx.drawImage(rotor, 12, 6, 52, 11, 12, 6, 52, 11);
    return out;
  });
}
function reinforcementFrames(img: HTMLImageElement) {
  return [
    [20, 464, 907, 1350].map((x) => croppedFrame(img, [x, 86, 416, 274])),
    [
      [16, 584, 456, 140],
      [548, 544, 238, 222],
      [930, 480, 332, 320],
      [1424, 508, 279, 297],
    ].map((rect) => croppedFrame(img, rect)),
  ];
}
export function soldierEquipment(art: Art, id: string) {
  if (id === 'machinegun') return art.vehicles[2][2];
  if (id === 'rocket') return art.vehicles[2][3];
  if (id === 'sniper') return art.reinforcements[1][0];
  if (id === 'medic') return art.reinforcements[1][1];
  if (id === 'mortar') return art.reinforcements[1][2];
  return undefined;
}
export function loadArt() {
  cached ??= Promise.all([
    loadImage('/art/battlefield-v3.png'),
    loadImage('/art/soldiers-v3.png'),
    loadImage('/art/vehicles-v3.png'),
    loadImage('/art/terrain-texture.png'),
    loadImage('/art/locomotion-v4.png'),
    loadImage('/art/reinforcements-v5.png'),
  ]).then(([bg, soldiers, vehicles, terrain, locomotion, reinforcement]) => {
    const background = surface(640, 214),
      ctx = background.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bg, 0, 0, 640, 214);
    const vehicleArt = frames(vehicles, 4, 3, 64, 32);
    vehicleArt[1] = stableHelicopters(vehicles);
    return {
      background,
      terrain,
      locomotion: locomotionFrames(locomotion),
      soldiers: frames(soldiers, 4, 8, 64, 48, true),
      vehicles: vehicleArt,
      reinforcements: reinforcementFrames(reinforcement),
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
  if (index < 3 || (index >= 10 && index <= 12)) return art.soldiers[0][0];
  if (index === 13) return art.reinforcements[0][0];
  if (index === 3) return art.vehicles[0][0];
  if (index === 4) return art.vehicles[1][0];
  return art.vehicles[2][0];
}
