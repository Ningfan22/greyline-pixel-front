import { CARDS, modelOf, type CardId } from './cards';
import {soldierArt,type SoldierArt} from './soldier-art';
import { figureFrames, transparentSheet } from './sprite-atlas';
import { adultAtlas, standingReloadFrames, standingGrenadeFrames, ownStance16 } from './adult-atlas';
import { packedWeaponStances } from './weapon-stance-art';
import { packedMedicalFrames } from './medical-art';
import { packedLowGrenades } from './low-grenade-art';
import { lowReloadAtlas } from './low-reload-art';
import { packedRepairFrames } from './repair-art';
import { paintedFootings } from './battlefield-effects-art';
import { packedBlastFrames, type PaintedBlasts } from './effect-atlas';
import { packedSmokeFrames } from './smoke-art';
import { specialistAtlas, type AdultSpecialists } from './adult-specialists';
import type { SpecialistSprite } from './adult-specialists';
import { heavyMGAtlas } from './heavy-mg-art';
import { packedGrenadeLauncher } from './grenade-launcher-art';
import { gliderAtlas } from './glider-art';
import {
  adultIdentity,
  type AdultIdentity,
  type AdultSprites,
} from './adult-animation';
import { assetUrl } from './asset-url';
import { tankGeometry } from './vehicle-geometry';
import { buildingFrames, type BuildingArt } from './building-art';
import { wreckFrames } from './wreck-art';
import { wreckVariants } from './wreck-variants';
import { paintedTankWrecks } from './tank-wreck-art';
import { packedProneWatch } from './prone-watch-art';
import { mobileVehicleFrames } from './mobile-vehicle-art';
import { loadV16Art } from './art-v16';
import { loadTreeArtV17, type TreeArtV17 } from './tree-art-v17';
import { loadPatrolArtV17, type PatrolArtV17 } from './patrol-art-v17';
import { loadDigArtV18, type DigArtV18 } from './dig-art-v18';
import { loadMineArtV18, type MineArtV18 } from './mine-art-v18';
import { loadComebackArtV18, type ComebackArtV18 } from './comeback-art-v18';
import type { MapId } from './maps';
import type { WreckKind } from './wreck-geometry';
export interface Art {
  soldiers?: SoldierArt;
  comeback: ComebackArtV18;
  digging: DigArtV18;
  mines: MineArtV18;
  trees: TreeArtV17;
  patrol: PatrolArtV17;
  adults: Record<AdultIdentity, AdultSprites>;
  adultSpecialists?: AdultSpecialists;
  weaponStances?: AdultSpecialists;
  heavyMG?: SpecialistSprite[];
  grenadeLauncher?: SpecialistSprite[];
  glider: HTMLCanvasElement[];
  background: HTMLCanvasElement;
  mapBackgrounds: Partial<Record<MapId, HTMLCanvasElement>>;
  terrain: HTMLImageElement;
  vehicles: HTMLCanvasElement[][];
  reinforcements: HTMLCanvasElement[][];
  aircraft: Record<string, HTMLCanvasElement[]>;
  scenery: HTMLCanvasElement[];
  buildings: BuildingArt;
  explosions: HTMLCanvasElement[][];
  emplacements: Record<string, HTMLCanvasElement[]>;
  impacts: HTMLCanvasElement[][];
  smoke: HTMLCanvasElement[];
  armor: Record<string, HTMLCanvasElement[]>;
  mobileVehicles: Record<string, HTMLCanvasElement[]>;
  combatExplosions: HTMLCanvasElement[][];
  combatExplosionsV13: HTMLCanvasElement[][];
  paintedBlasts?: PaintedBlasts;
  wrecks: Record<WreckKind, HTMLCanvasElement>;
  wreckVariants: Record<
    WreckKind,
    Record<'blast' | 'bullet' | 'burn', HTMLCanvasElement[]>
  >;
  parachute: HTMLCanvasElement[];
}
let cached: Promise<Art> | null = null;
function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`无法加载 ${src}`));
    img.src = assetUrl(src);
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
      const scale = Math.min((lw - 2) / sw, (lh - 2) / sh);
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
function generatedRotors(image: HTMLImageElement) {
  const source = transparentSheet(image),
    cuts = [0, 444, 887, 1331, 1774];
  // Native coordinates keep the complete rotor phase and fixed body on one grid.
  const rows = [
    {
      top: 0,
      bottom: 209,
      crop: [89, 84, 288, 95],
      band: [84, 121],
      cap: [100, 109, 210, 12],
    },
    {
      top: 209,
      bottom: 430,
      crop: [7, 237, 430, 170],
      band: [237, 314],
      cap: [140, 304, 304, 10],
    },
    {
      top: 430,
      bottom: 654,
      crop: [40, 451, 387, 182],
      band: [451, 535],
      cap: [155, 524, 150, 11],
    },
    {
      top: 654,
      bottom: 887,
      crop: [13, 673, 427, 154],
      band: [688, 729],
      cap: [140, 724, 304, 5],
    },
  ];
  return rows.map((row) => {
    const raw = cuts.slice(0, 4).map((x, col) => {
      const frame = surface(444, row.bottom - row.top);
      frame
        .getContext('2d')!
        .drawImage(
          source,
          x,
          row.top,
          cuts[col + 1] - x,
          frame.height,
          0,
          0,
          cuts[col + 1] - x,
          frame.height,
        );
      return frame;
    });
    return raw.map((phase) => {
      const frame = surface(444, row.bottom - row.top),
        c = frame.getContext('2d')!;
      const top = row.band[0] - row.top,
        height = row.band[1] - row.band[0];
      c.drawImage(raw[0], 0, 0);
      c.clearRect(0, top, 444, height);
      c.drawImage(phase, 0, top, 444, height, 0, top, 444, height);
      const [x, y, w, h] = row.cap;
      c.clearRect(x, y - row.top, w, h);
      c.drawImage(raw[0], x, y - row.top, w, h, x, y - row.top, w, h);
      const [cx, cy, cw, ch] = row.crop;
      return croppedFrame(frame, [cx, cy - row.top, cw, ch], 128, 64);
    });
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
              : uniform === 'elite'
                ? [0.58, 0.62, 0.58]
                : uniform === 'militia'
                  ? [1.22, 1.08, 0.82]
                  : uniform === 'crew'
                    ? [0.6, 0.66, 0.8]
                    : uniform === 'medic'
                      ? [1.07, 1.05, 0.97]
                      : uniform === 'engineer'
                        ? [1.02, 0.92, 0.68]
                        : uniform === 'heavy'
                          ? [0.82, 0.86, 0.62]
                          : [1.08, 1.02, 0.71];
      for (let j = 0; j < 3; j++)
        px.data[i + j] = Math.min(255, Math.round(v * palette[j]));
    }
  }
  ctx.putImageData(px, 0, 0);
  variants.set(uniform, out);
  return out;
}

/**
 * v134: vehicle livery tints. The IFV and helicopter atlases are shared by
 * many cards, so on the battlefield a mortar carrier, a command vehicle and
 * a recovery vehicle all looked like the same truck. Each variant gets a
 * cheap multiply tint on its paint so silhouettes read as distinct vehicles.
 */
const VEHICLE_TINTS: Record<string, [number, number, number]> = {
  // IFV-family variants (share reinforcements[0])
  pickup: [1.06, 0.86, 0.62], // rusty sand-primered technical
  tow_ifv: [0.86, 0.9, 0.72], // lighter drab, missile carrier
  mortar_carrier: [0.72, 0.74, 0.66], // dark grey-green
  recovery_vehicle: [0.9, 0.82, 0.6], // tan engineering
  command_vehicle: [0.78, 0.84, 0.92], // blue-grey comms
  mine_clearer: [0.95, 0.88, 0.66], // desert mine-plough
  aa_gun: [0.7, 0.74, 0.68], // dark air-defence
  sam_vehicle: [0.66, 0.7, 0.78], // slate blue
  mlrs: [0.74, 0.7, 0.58], // olive-drab rocket launcher
  scout_car: [0.82, 0.86, 0.8], // pale recon grey-green
  // Helicopter-family variants (share aircraft atlases)
  rocket_heli: [0.82, 0.78, 0.62], // desert attack
  scout_drone: [0.8, 0.84, 0.88], // pale recon grey
  attack_drone: [0.74, 0.76, 0.7], // gunmetal
  loiter_drone: [0.88, 0.8, 0.6], // sand loitering munition
  interceptor: [0.7, 0.76, 0.86], // air-superiority grey-blue
  fpv_drone: [0.9, 0.72, 0.6], // burnt-orange FPV
  strike_jet: [0.76, 0.78, 0.82], // strike grey
  bomber: [0.68, 0.7, 0.66], // dark night bomber
  air_assault: [0.84, 0.86, 0.74], // drab assault
};
const vehicleTintCache = new WeakMap<
  HTMLCanvasElement,
  Map<string, HTMLCanvasElement>
>();
export function vehicleTint(frame: HTMLCanvasElement, id: string) {
  const palette = VEHICLE_TINTS[id];
  if (!palette) return frame;
  let variants = vehicleTintCache.get(frame);
  if (!variants) {
    variants = new Map();
    vehicleTintCache.set(frame, variants);
  }
  if (variants.has(id)) return variants.get(id)!;
  const out = surface(frame.width, frame.height),
    ctx = out.getContext('2d')!;
  ctx.drawImage(frame, 0, 0);
  const px = ctx.getImageData(0, 0, out.width, out.height);
  for (let i = 0; i < px.data.length; i += 4) {
    if (px.data[i + 3] < 8) continue;
    // Tint only the mid-tone vehicle paint; leave dark tracks, glass and
    // bright markings alone so the livery shift reads as paint, not a wash.
    const r = px.data[i],
      g = px.data[i + 1],
      b = px.data[i + 2];
    const v = (r + g + b) / 3;
    if (v < 30 || v > 225) continue;
    for (let j = 0; j < 3; j++)
      px.data[i + j] = Math.min(255, Math.round(v * palette[j]));
  }
  ctx.putImageData(px, 0, 0);
  variants.set(id, out);
  return out;
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
function buildEmplacements(img: HTMLImageElement) {
  const source = surface(img.width, img.height),
    ctx = source.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const pixels = ctx.getImageData(0, 0, img.width, img.height),
    w = img.width,
    h = img.height,
    labels = new Uint16Array(w * h),
    queue = new Int32Array(w * h);
  const groups: {
    id: number;
    left: number;
    right: number;
    top: number;
    bottom: number;
    count: number;
  }[] = [];
  let id = 0;
  for (let at = 0; at < w * h; at++) {
    if (labels[at] || pixels.data[at * 4 + 3] < 128) continue;
    id++;
    let head = 0,
      tail = 1;
    queue[0] = at;
    labels[at] = id;
    let left = w,
      right = 0,
      top = h,
      bottom = 0;
    while (head < tail) {
      const index = queue[head++],
        x = index % w,
        y = Math.floor(index / w);
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
      for (const next of [
        x > 0 ? index - 1 : -1,
        x < w - 1 ? index + 1 : -1,
        y > 0 ? index - w : -1,
        y < h - 1 ? index + w : -1,
      ])
        if (next >= 0 && !labels[next] && pixels.data[next * 4 + 3] >= 128) {
          labels[next] = id;
          queue[tail++] = next;
        }
    }
    groups.push({ id, left, right, top, bottom, count: tail });
  }
  const guns = groups
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .sort((a, b) => a.left - b.left);
  return Object.fromEntries(
    guns.map((g, index) => {
      const isolated = surface(g.right - g.left + 1, g.bottom - g.top + 1),
        ic = isolated.getContext('2d')!,
        data = ic.createImageData(isolated.width, isolated.height);
      for (let y = g.top; y <= g.bottom; y++)
        for (let x = g.left; x <= g.right; x++)
          if (labels[y * w + x] === g.id) {
            const from = (y * w + x) * 4,
              to = ((y - g.top) * isolated.width + x - g.left) * 4;
            for (let ch = 0; ch < 3; ch++)
              data.data[to + ch] = pixels.data[from + ch];
            data.data[to + 3] = 255;
          }
      ic.putImageData(data, 0, 0);
      const base = croppedFrame(
        isolated,
        [0, 0, isolated.width, isolated.height],
        80,
        48,
      );
      const frames = [0, 1, 2, 3].map((frame) => {
        const out = surface(80, 48),
          c = out.getContext('2d')!;
        c.imageSmoothingEnabled = false;
        c.drawImage(base, 0, 0);
        // Recoil moves the barrel layer; wheels and stabilizers keep their anchor.
        const shift = frame === 1 ? 2 : frame === 2 ? 1 : 0;
        if (shift) {
          c.clearRect(40, 0, 40, 35);
          c.drawImage(base, 40, 0, 40, 35, 40 - shift, 0, 40, 35);
        }
        return out;
      });
      return [['howitzer', 'at_gun', 'aa_gun'][index], frames];
    }),
  );
}
function sceneryFrames(img: HTMLImageElement) {
  const source = surface(img.width, img.height),
    ctx = source.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const pixels = ctx.getImageData(0, 0, img.width, img.height);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const r = pixels.data[i],
      g = pixels.data[i + 1],
      b = pixels.data[i + 2];
    if (r > 40 && b > 40 && g < Math.min(r, b) * 0.85) pixels.data[i + 3] = 0;
  }
  ctx.putImageData(pixels, 0, 0);
  return [
    croppedFrame(source, [38, 146, 444, 565], 64, 80),
    croppedFrame(source, [525, 120, 500, 592], 56, 76),
    croppedFrame(source, [1100, 32, 362, 680], 44, 80),
    croppedFrame(source, [1546, 516, 479, 196], 64, 28),
  ];
}
function explosionFrames(img: HTMLImageElement) {
  const cw = img.width / 8,
    ch = img.height / 3;
  return Array.from({ length: 3 }, (_, row) =>
    Array.from({ length: 8 }, (_, col) => {
      const out = surface(96, Math.round((ch / cw) * 96)),
        ctx = out.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      const x = Math.round(col * cw),
        y = Math.round(row * ch),
        right = Math.round((col + 1) * cw),
        bottom = Math.round((row + 1) * ch);
      // Keep the entire cell, preserving the common explosion origin through all frames.
      ctx.drawImage(
        img,
        x,
        y,
        right - x,
        bottom - y,
        0,
        0,
        out.width,
        out.height,
      );
      return out;
    }),
  );
}
function atlasFrames(
  img: HTMLImageElement | HTMLCanvasElement,
  columns: number,
  rows: number,
  width = 96,
) {
  const cw = img.width / columns,
    ch = img.height / rows;
  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: columns }, (_, column) => {
      const frame = surface(width, Math.round((width * ch) / cw));
      const ctx = frame.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      const x = Math.round(column * cw),
        y = Math.round(row * ch);
      ctx.drawImage(
        img,
        x,
        y,
        Math.round((column + 1) * cw) - x,
        Math.round((row + 1) * ch) - y,
        0,
        0,
        frame.width,
        frame.height,
      );
      return frame;
    }),
  );
}
export function loadArt() {
  cached ??= Promise.all([
    Promise.all([
      loadImage('/art/battlefield-v3.png'),
      loadImage('/art/vehicles-v3.png'),
      loadImage('/art/terrain-texture.png'),
      loadImage('/art/reinforcements-v5.png'),
      loadImage('/art/destructible-scenery-v9.png'),
      loadImage('/art/artillery-v9.png'),
      loadImage('/art/explosions-v9.png'),
      loadImage('/art/impacts-v12.png'),
      loadImage('/art/fixed-wing-v12.png'),
      loadImage('/art/rotorcraft-v12.png'),
      loadImage('/art/tanks-v12.png'),
      loadImage('/art/blast-he-frames-v165.png'),
      loadImage('/art/blast-grenade-frames-v165.png'),
      loadImage('/art/buildings-v13.png'),
      loadImage('/art/building-collapse-v13.png'),
      loadImage('/art/adult-infantry-v13.png'),
      loadImage('/art/adult-marines-v13.png'),
      loadImage('/art/adult-police-v13.png'),
      loadImage('/art/adult-militia-v13.png'),
      loadImage('/art/adult-specialists-v13.png'),
      loadImage('/art/ground-wrecks-v14.png'),
      loadImage('/art/air-wrecks-v14.png'),
      loadImage('/art/mobile-vehicles-v14.png'),
      loadImage('/art/support-vehicles-v14.png'),
      loadImage('/art/parachute-v1.png'),
      loadImage('/art/standing-reload-v135.png'),
      loadImage('/art/standing-grenade-v136.png'),
      loadImage('/art/heavy-mg-v140.png'),
      loadImage('/art/glider-v141.png'),
      loadImage('/art/infantry-reload-v143.png'),
      loadImage('/art/blast-fuel-frames-v165.png'),
      loadImage('/art/blast-earth-frames-v165.png'),
      loadImage('/art/building-footings-v145.png'),
      loadImage('/art/weapon-stance-frames-v147.png'),
      loadImage('/art/medical-work-frames-v148.png'),
      loadImage('/art/low-grenade-frames-v149.png'),
      loadImage('/art/repair-work-frames-v150.png'),
      loadImage('/art/grenade-launcher-frames-v159.png'),
      loadImage('/art/powder-smoke-frames-v161.png'),
      loadImage('/art/tank-wreck-frames-v162.png'),
      loadImage('/art/prone-watch-frames-v163.png'),
      loadImage('/art/blast-air-frames-v165.png'),
      loadImage('/art/soldier-parts-v178.png'),
      loadImage('/art/soldier-equipment-v178.png'),
    ]),
    loadV16Art(),
    loadTreeArtV17(),
    loadPatrolArtV17(),
    loadDigArtV18(),
    loadMineArtV18(),
    loadComebackArtV18(),
  ]).then(
    ([
      [
        bg,
        vehicles,
        terrain,
        reinforcement,
        scenery,
        emplacements,
        explosions,
        impacts,
        fixedWing,
        rotorcraft,
        tanks,
        heBlastSheet,
        grenadeBlastSheet,
        buildings,
        collapse,
        adultInfantry,
        adultMarines,
        adultPolice,
        adultMilitia,
        specialists,
        groundWrecks,
        airWrecks,
        mobileVehicles,
        supportVehicles,
        parachuteSheet,
        standingReload,
        standingGrenade,
        heavyMG,
        gliderSheet,
        lowReloadSheet,
        fuelBlastSheet,
        earthBlastSheet,
        footingSheet,
        packedWeaponSheet,
        medicalSheet,
        lowGrenadeSheet,
        repairSheet,
        grenadeLauncherSheet,
        smokeSheet,
        tankWreckSheet,
        proneWatchSheet,
        airBlastSheet,
        soldierPartsSheet,
        soldierEquipmentSheet,
      ],
      extra,
      trees,
      patrol,
      digging,
      mines,
      comeback,
    ]) => {
      const background = surface(640, 214),
        ctx = background.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(bg, 0, 0, 640, 214);
      const vehicleArt = frames(vehicles, 4, 3, 64, 32);
      vehicleArt[1] = stableHelicopters(vehicles);
      vehicleArt[0] = stableTracks(vehicleArt[0], 5);
      const reinforcementArt = reinforcementFrames(reinforcement);
      const wingArt = figureFrames(
        fixedWing,
        4,
        5,
        128,
        64,
        false,
        5,
        [0, 239, 392, 593, 767, 992],
      );
      const rotors = generatedRotors(rotorcraft);
      const tankArt = figureFrames(
        tanks,
        4,
        3,
        128,
        64,
        false,
        1,
        [0, 249, 475, 768],
        true,
      );
      const heFrames = packedBlastFrames(heBlastSheet),
        grenadeFrames = packedBlastFrames(grenadeBlastSheet),
        airFrames = packedBlastFrames(airBlastSheet),
        fuelFrames = packedBlastFrames(fuelBlastSheet),
        earthFrames = packedBlastFrames(earthBlastSheet);
      reinforcementArt[0] = stableTracks(reinforcementArt[0], 6);
      const reload8 = standingReloadFrames(standingReload);
      const grenade8 = standingGrenadeFrames(standingGrenade);
      const lowReload16 = lowReloadAtlas(lowReloadSheet);
      const medical24 = packedMedicalFrames(medicalSheet);
      const lowGrenade32 = packedLowGrenades(lowGrenadeSheet);
      const repair34 = packedRepairFrames(repairSheet);
      const proneIdle8 = packedProneWatch(proneWatchSheet);
      // Command gestures were removed from all live selectors. Keep the
      // legacy field empty; do not fetch/decode four unused 1254px sheets.
      const signals4: HTMLCanvasElement[] = [];
      // v174: each identity builds its pose chain from its OWN pixel atlas,
      // so aiming or dropping to a knee never swaps a yellow marine onto the
      // shared green realistic stance body.
      const mkAdult = (img: HTMLImageElement) => {
        const a = adultAtlas(img);
        return { ...a, signals4, reload8, grenade8, stance16: ownStance16(a), lowReload16, medical24, lowGrenade32, repair34, proneIdle8 };
      };
      const adults = {
        infantry: mkAdult(adultInfantry),
        marines: mkAdult(adultMarines),
        police: mkAdult(adultPolice),
        militia: mkAdult(adultMilitia),
      };
      const parachute = atlasFrames(transparentSheet(parachuteSheet), 5, 1, 96)[0];
      // Match the last raising pose to the established firing anatomy at the handoff.
      for (const id of Object.keys(adults) as AdultIdentity[])
        patrol[id].raise3[2] = adults[id].actions20[0];
      const glider=gliderAtlas(gliderSheet);
      const grenadeLauncher=packedGrenadeLauncher(grenadeLauncherSheet);
      const wreckFramesMap = wreckFrames(
        groundWrecks,
        airWrecks,
        mobileVehicles,
        supportVehicles,
        extra.fpvSheet,
        glider[6],
      );
      return {
        soldiers:soldierArt(soldierPartsSheet,soldierEquipmentSheet),
        comeback,
        digging,
        mines,
        trees,
        patrol,
        parachute,
        adults,
        adultSpecialists: specialistAtlas(specialists),
        weaponStances: {...packedWeaponStances(packedWeaponSheet),grenade:grenadeLauncher.stances},
        heavyMG: heavyMGAtlas(heavyMG),
        grenadeLauncher: grenadeLauncher.cycle,
        glider,
        wrecks: wreckFramesMap,
        wreckVariants: {...wreckVariants(wreckFramesMap,paintedTankWrecks(tankWreckSheet)),
          glider_transport:{bullet:[glider[6]],blast:[glider[7]],burn:[glider[7]]}},
        mobileVehicles: mobileVehicleFrames(mobileVehicles, supportVehicles),
        background,
        mapBackgrounds: extra.mapBackgrounds,
        terrain,
        vehicles: vehicleArt,
        reinforcements: reinforcementArt,
        aircraft: {
          fpv_drone: extra.fpvFrames,
          ...Object.fromEntries(
            ['scout_drone', 'helicopter', 'rocket_heli', 'medevac'].map(
              (id, row) => [id, rotors[row]],
            ),
          ),
          ...Object.fromEntries(
            [
              'attack_drone',
              'loiter_drone',
              'interceptor',
              'strike_jet',
              'bomber',
            ].map((id, row) => [id, wingArt[row]]),
          ),
        },
        emplacements: buildEmplacements(emplacements),
        scenery: sceneryFrames(scenery),
        buildings: {...buildingFrames(buildings, collapse),footings:paintedFootings(footingSheet)},
        paintedBlasts: {fuel:fuelFrames,earth:earthFrames,he:heFrames,grenade:grenadeFrames,air:airFrames},
        explosions: explosionFrames(explosions),
        impacts: atlasFrames(impacts, 8, 2, 48),
        smoke: packedSmokeFrames(smokeSheet),
        armor: Object.fromEntries(
          ['light_tank', 'tank', 'heavy_tank'].map((id, row) => [
            id,
            stableTracks(tankArt[row], 10),
          ]),
        ),
        // Legacy API aliases share the new cels; do not download/key/cut the
        // old touching-plume sheets just to populate compatibility fields.
        combatExplosions: [heFrames, fuelFrames, airFrames],
        combatExplosionsV13: [fuelFrames, earthFrames, grenadeFrames],
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
/**
 * Draw a tank whose barrel recoils independently of the hull. The sprite is
 * painted in two passes through evenodd clips: first the hull with the thin
 * muzzle band cut out, then just the muzzle band shifted back by `recoil`
 * pixels. The thick barrel root stays with the hull, so the muzzle reads as
 * sliding back into the mantlet instead of the whole vehicle rocking.
 *
 * `band` is [x0, y0, x1, y1] in frame-local space (origin at bottom-centre,
 * y up), the same space drawSprite draws into.
 */
export function drawTankSprite(
  ctx: CanvasRenderingContext2D,
  frame: HTMLCanvasElement | undefined,
  x: number,
  y: number,
  w: number,
  h: number,
  flip: boolean,
  alpha: number,
  rotation: number,
  band: [number, number, number, number],
  recoil: number,
) {
  if (!frame) return;
  const hw = Math.round(w / 2);
  const bx = Math.min(band[0], band[2]);
  const by = Math.min(band[1], band[3]);
  const bw = Math.abs(band[2] - band[0]);
  const bh = Math.abs(band[3] - band[1]);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = alpha;
  ctx.translate(Math.round(x), Math.round(y));
  if (rotation) ctx.rotate(rotation);
  if (flip) ctx.scale(-1, 1);
  // Pass 1: hull with the muzzle band cut out.
  ctx.beginPath();
  ctx.rect(-hw, -h, w, h);
  ctx.rect(bx, by, bw, bh);
  ctx.clip('evenodd');
  ctx.drawImage(frame, -hw, -h, w, h);
  // Pass 2: the muzzle band alone, pulled back toward the hull.
  ctx.beginPath();
  ctx.rect(bx, by, bw, bh);
  ctx.clip();
  ctx.drawImage(frame, -hw - recoil, -h, w, h);
  ctx.restore();
}
export function cardFrame(art: Art, index: number) {
  if (index < 3 || (index >= 10 && index <= 12))
    return art.adults.infantry.actions20[0];
  if (index === 13) return art.reinforcements[0][0];
  if (index === 3) return art.vehicles[0][0];
  if (index === 4) return art.vehicles[1][0];
  return art.vehicles[2][0];
}
export function unitFrame(art: Art, id: CardId, frame = 0) {
  const c = CARDS[id];
  if(id==='glider_transport')return art.glider[frame%art.glider.length];
  if (c.members)
    return uniformFrame(art.adults[adultIdentity(id)].actions20[0], c.uniform);
  const mobile = art.mobileVehicles?.[id];
  if (mobile) return mobile[frame % mobile.length];
  if (c.emplacement) return art.emplacements[c.emplacement][frame];
  if (c.airlift) return art.aircraft.medevac[frame % 4];
  if (art.aircraft[id])
    return vehicleTint(art.aircraft[id][
      c.airframe === 'scout_drone' ||
      c.airframe === 'fpv_drone' ||
      c.airframe === 'rocket_heli' ||
      id === 'helicopter'
        ? frame
        : 0
    ], id);
  if (c.airframe) return vehicleTint(art.aircraft[c.airframe][frame], id);
  if (c.air) return art.vehicles[1][frame];
  if (modelOf(id) === 'tank') return (art.armor[id] ?? art.armor.tank)[frame];
  if (modelOf(id) === 'ifv') return vehicleTint(art.reinforcements[0][frame], id);
  return cardFrame(art, c.atlas);
}
export function unitSize(id: CardId): [number, number] {
  const c = CARDS[id];
  if(id==='glider_transport')return [256,100];
  if (id === 'bomber') return [260, 108];
  if (id === 'strike_jet') return [210, 90];
  if (id === 'fpv_drone') return [54, 28];
  if (id === 'air_assault') return [240, 112];
  const tank = tankGeometry(id);
  if (tank) return tank.size;
  if (c.emplacement)
    return c.emplacement === 'howitzer'
      ? [190, 100]
      : c.emplacement === 'at_gun'
        ? [190, 95]
        : [150, 105];
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
