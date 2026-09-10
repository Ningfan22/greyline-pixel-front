import { CARDS, modelOf, weaponModel, type CardId } from './cards';
import { buildAircraft } from './aircraft';
export interface Art {
  reactions: HTMLCanvasElement[][];
  background: HTMLCanvasElement;
  terrain: HTMLImageElement;
  soldiers: HTMLCanvasElement[][];
  vehicles: HTMLCanvasElement[][];
  locomotion: HTMLCanvasElement[][];
  reinforcements: HTMLCanvasElement[][];
  aircraft: ReturnType<typeof buildAircraft>;
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
function croppedFrame(
  img: HTMLImageElement | HTMLCanvasElement,
  rect: number[],
  lw = 64,
  lh = 40,
) {
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
function reactionFrames(img: HTMLImageElement) {
  const source = surface(img.width, img.height),
    ctx = source.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const px = ctx.getImageData(0, 0, img.width, img.height);
  for (let i = 0; i < px.data.length; i += 4) {
    const r = px.data[i],
      g = px.data[i + 1],
      b = px.data[i + 2];
    if (Math.min(r, g, b) > 155 && Math.max(r, g, b) - Math.min(r, g, b) < 28)
      px.data[i + 3] = 0;
  }
  ctx.putImageData(px, 0, 0);
  return [0, 1].map((row) =>
    [0, 1, 2, 3].map((col) => {
      let left = img.width,
        right = 0,
        top = img.height,
        bottom = 0;
      for (
        let y = Math.round((row * img.height) / 2);
        y < Math.round(((row + 1) * img.height) / 2);
        y++
      )
        for (
          let x = Math.round((col * img.width) / 4);
          x < Math.round(((col + 1) * img.width) / 4);
          x++
        )
          if (px.data[(y * img.width + x) * 4 + 3] > 0) {
            left = Math.min(left, x);
            right = Math.max(right, x);
            top = Math.min(top, y);
            bottom = Math.max(bottom, y);
          }
      const out = surface(64, 48),
        oc = out.getContext('2d')!;
      oc.imageSmoothingEnabled = false;
      const w = Math.round((right - left + 1) * 0.112),
        h = Math.round((bottom - top + 1) * 0.112);
      oc.drawImage(
        source,
        left,
        top,
        right - left + 1,
        bottom - top + 1,
        32 - Math.round(w / 2),
        48 - h,
        w,
        h,
      );
      return out;
    }),
  );
}
const uniformCache = new WeakMap<
  HTMLCanvasElement,
  Map<string, HTMLCanvasElement>
>();
export function uniformFrame(frame: HTMLCanvasElement, uniform?: string) {
  if (!uniform) return frame;
  let variants = uniformCache.get(frame);
  if (!variants) {
    variants = new Map();
    uniformCache.set(frame, variants);
  }
  if (variants.has(uniform)) return variants.get(uniform)!;
  const out = surface(frame.width, frame.height),
    ctx = out.getContext('2d')!;
  ctx.drawImage(frame, 0, 0);
  const px = ctx.getImageData(0, 0, out.width, out.height);
  for (let i = 0; i < px.data.length; i += 4) {
    const r = px.data[i],
      g = px.data[i + 1],
      b = px.data[i + 2];
    // Apply a uniform palette only to olive fabric, preserving skin and weapons.
    if (g >= r * 0.92 && g > b * 1.12 && g > 35 && r < 165) {
      const v = (r + g + b) / 3;
      const palette =
        uniform === 'police'
          ? [0.72, 0.82, 1.03]
          : uniform === 'recon'
            ? [0.84, 1.04, 0.61]
            : uniform === 'assault'
              ? [0.73, 0.78, 0.7]
              : [1.08, 1.02, 0.71];
      for (let j = 0; j < 3; j++)
        px.data[i + j] = Math.min(255, Math.round(v * palette[j]));
    }
  }
  ctx.putImageData(px, 0, 0);
  variants.set(uniform, out);
  return out;
}
export function soldierEquipment(art: Art, cardId: CardId, member = 0) {
  const id = weaponModel({ id: cardId, member });
  if (id === 'machinegun') return art.vehicles[2][2];
  if (id === 'rocket') return art.vehicles[2][3];
  if (id === 'sniper') return art.reinforcements[1][0];
  if (id === 'medic') return art.reinforcements[1][1];
  if (id === 'mortar') return art.reinforcements[1][2];
  return undefined;
}
function stableTracks(list: HTMLCanvasElement[], height: number) {
  return list.map((frame) => {
    const out = surface(frame.width, frame.height),
      ctx = out.getContext('2d')!;
    ctx.drawImage(list[0], 0, 0);
    ctx.clearRect(0, frame.height - height, frame.width, height);
    ctx.drawImage(
      frame,
      0,
      frame.height - height,
      frame.width,
      height,
      0,
      frame.height - height,
      frame.width,
      height,
    );
    return out;
  });
}
export function loadArt() {
  cached ??= Promise.all([
    loadImage('/art/battlefield-v3.png'),
    loadImage('/art/soldiers-v3.png'),
    loadImage('/art/vehicles-v3.png'),
    loadImage('/art/terrain-texture.png'),
    loadImage('/art/locomotion-v4.png'),
    loadImage('/art/reinforcements-v5.png'),
    loadImage('/art/reactions-v6.png'),
  ]).then(
    ([
      bg,
      soldiers,
      vehicles,
      terrain,
      locomotion,
      reinforcement,
      reactions,
    ]) => {
      const background = surface(640, 214),
        ctx = background.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(bg, 0, 0, 640, 214);
      const vehicleArt = frames(vehicles, 4, 3, 64, 32);
      vehicleArt[1] = stableHelicopters(vehicles);
      vehicleArt[0] = stableTracks(vehicleArt[0], 5);
      const reinforcementArt = reinforcementFrames(reinforcement);
      reinforcementArt[0] = stableTracks(reinforcementArt[0], 6);
      return {
        background,
        reactions: reactionFrames(reactions),
        terrain,
        locomotion: locomotionFrames(locomotion),
        soldiers: frames(soldiers, 4, 8, 64, 48, true),
        vehicles: vehicleArt,
        reinforcements: reinforcementArt,
        aircraft: buildAircraft(vehicleArt[1]),
      };
    },
  );
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
  rotation = 0,
) {
  if (!frame) return;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = alpha;
  ctx.translate(Math.round(x), Math.round(y));
  if (rotation) ctx.rotate(rotation);
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
export function unitFrame(art: Art, id: CardId, frame = 0) {
  const c = CARDS[id];
  if (c.airframe) return art.aircraft[c.airframe][frame];
  if (c.air) return art.vehicles[1][frame];
  if (modelOf(id) === 'tank') return art.vehicles[0][frame];
  if (modelOf(id) === 'ifv') return art.reinforcements[0][frame];
  return cardFrame(art, c.atlas);
}
export function unitSize(id: CardId): [number, number] {
  const c = CARDS[id];
  if (c.airframe === 'scout_drone') return [88, 48];
  if (c.airframe === 'attack_drone') return [176, 78];
  if (c.airframe === 'loiter_drone') return [104, 52];
  if (c.airframe === 'interceptor') return [198, 84];
  if (c.airframe === 'rocket_heli') return [220, 110];
  return modelOf(id) === 'tank'
    ? [205, 108]
    : modelOf(id) === 'ifv'
      ? [165, 105]
      : c.air
        ? [235, 118]
        : [96, 72];
}
