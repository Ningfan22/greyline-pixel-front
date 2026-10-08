import {FORT_IDS_V227,GUN_IDS_V227,GUN_SIZES_V227} from './expansion-v227';
import {expansionGunParts,groundedFortSprite} from './expansion-art-v227';
import {fortificationSize} from './fortification-ground';
import {PARACHUTE_TRANSPORT_ART,PARACHUTE_TRANSPORT_WRECK,transportFrameV224} from './parachute-art-v224';
import {VEHICLE_SOURCES_V223,vehicleFrameV223,apcPartsV223,pickupPartsV223,towRackParts,type TowRackParts} from './vehicle-art-v223';
import {IFV_ART_V220,ifvPartsV220,ifvPreviewV220} from './ifv-art-v220';
import {splitVehicleGun} from './vehicle-gun-art';
import {VEHICLE_GUNS,type VehicleGunId} from './vehicle-gun-layout';
import { CARDS, modelOf, type CardId } from './cards';
import {VEHICLE_IDS_V209,vehicleSourceV209,vehicleFrameV209,MISSILE_LAYOUT_V209,VEHICLE_MISSILE_ROOT} from './vehicle-missile-art-v209';
import {soldierArt,soldierFrame,type SoldierArt} from './soldier-art';
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
import { loadArtImage } from './battle-art-loader';
import { loadBakedBattleArt } from './battle-art-baked';
import { tankGeometry } from './vehicle-geometry';
import { buildingFrames, type BuildingArt } from './building-art';
import { wreckFrames } from './wreck-art';
import { wreckVariants } from './wreck-variants';
import { paintedTankWrecks } from './tank-wreck-art';
import { packedProneWatch } from './prone-watch-art';
import { mobileVehicleFrames } from './mobile-vehicle-art';
import { V197_VEHICLE_IDS, vehicleAssetV197, vehicleFrameV197 } from './vehicle-art-v197';
import { TANK_IDS_V202, TANK_ASSET_ROOT } from './tank-layout-v202';
import { tankPartsV202, tankPreviewV202 } from './tank-art-v202';
import { buildEmplacementParts } from './emplacement-art-v202';
import { emplacementSize, EMPLACEMENT_SCALE, type EmplacementName } from './emplacement-layout';
import {drawArticulatedGun, type PaintedGunParts} from './gun-art';
import {modularGunParts,helicopterParts,weaponEffects,type HelicopterParts,type WeaponEffects} from './weapon-art-v204';
import {WEAPON_ART_ROOT,WEAPON_LAYOUT,HELI_LAYOUT} from './weapon-layout-v204';
import { loadFPVArt, loadMapBackground, loadV16Art } from './art-v16';
import { loadTreeArtV17, treeFramesV17, type TreeArtV17 } from './tree-art-v17';
import { loadPatrolArtV17, type PatrolArtV17 } from './patrol-art-v17';
import { loadDigArtV18, type DigArtV18 } from './dig-art-v18';
import { loadMineArtV18, mineFramesV18, type MineArtV18 } from './mine-art-v18';
import { loadComebackArtV18, comebackFramesV18, type ComebackArtV18 } from './comeback-art-v18';
import type { MapId } from './maps';
import type { WreckKind } from './wreck-geometry';
export interface Art {
  towRack?:TowRackParts;
  weaponEffects?: WeaponEffects;
  helicopterParts?: HelicopterParts;
  gunParts?: Record<string, PaintedGunParts>;
  ammoCrate?: HTMLImageElement;
  ammoCrateFrame?: HTMLCanvasElement;
  generatedSprites: Partial<Record<CardId, HTMLImageElement | HTMLCanvasElement>>;
  soldiers?: SoldierArt;
  comeback: ComebackArtV18;
  digging?: DigArtV18;
  mines: MineArtV18;
  trees: TreeArtV17;
  patrol?: PatrolArtV17;
  adults?: Record<AdultIdentity, AdultSprites>;
  adultSpecialists?: AdultSpecialists;
  weaponStances?: AdultSpecialists;
  heavyMG?: SpecialistSprite[];
  grenadeLauncher?: SpecialistSprite[];
  glider: HTMLCanvasElement[];
  parachuteTransport: HTMLCanvasElement;
  background: HTMLCanvasElement;
  mapBackgrounds: Partial<Record<MapId, HTMLCanvasElement>>;
  terrain: HTMLImageElement | HTMLCanvasElement;
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
/** Full-body sheets are retained only for legacy QA and integrations. */
export interface LegacyArt extends Art {
  digging: DigArtV18;
  patrol: PatrolArtV17;
  adults: Record<AdultIdentity, AdultSprites>;
}
let cached: Promise<LegacyArt> | null = null;
function loadImage(src: string) {
  return loadArtImage(src);
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

/** Aircraft liveries. Ground vehicles always use their own authored model. */
const VEHICLE_TINTS: Record<string, [number, number, number]> = {
  // Helicopter-family variants (share aircraft atlases)
  rocket_heli: [0.82, 0.78, 0.62], // desert attack
  scout_drone: [0.8, 0.84, 0.88], // pale recon grey
  attack_drone: [0.74, 0.76, 0.7], // gunmetal
  loiter_drone: [0.88, 0.8, 0.6], // sand loitering munition
  interceptor: [0.7, 0.76, 0.86], // air-superiority grey-blue
  fpv_drone: [0.9, 0.72, 0.6], // burnt-orange FPV
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
export function buildEmplacements(img: HTMLImageElement) {
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
      // Sample the original painted gun directly at its final world size.
      // The former 80x48 intermediary erased detail before a second enlargement.
      const name = (['howitzer', 'at_gun', 'aa_gun'] as const)[index];
      const [worldWidth, worldHeight] = emplacementSize(name);
      const base = surface(worldWidth, worldHeight), bc = base.getContext('2d')!;
      bc.imageSmoothingEnabled = false;
      const scale = Math.min((worldWidth - 2 * EMPLACEMENT_SCALE) / isolated.width, (worldHeight - 2 * EMPLACEMENT_SCALE) / isolated.height);
      const drawWidth = isolated.width * scale, drawHeight = isolated.height * scale;
      bc.drawImage(isolated, 0, 0, isolated.width, isolated.height,
        (worldWidth - drawWidth) / 2, worldHeight - drawHeight, drawWidth, drawHeight);
      const frames = [0, 1, 2, 3].map((frame) => {
        const out = surface(worldWidth, worldHeight),
          c = out.getContext('2d')!;
        c.imageSmoothingEnabled = false;
        c.drawImage(base, 0, 0);
        // Recoil moves the barrel layer; wheels and stabilizers keep their anchor.
        const shift = (frame === 1 ? 4 : frame === 2 ? 2 : 0) * EMPLACEMENT_SCALE;
        if (shift) {
          const [x, y, w, h] = [[98, 37, 92, 28], [112, 54, 78, 15], [70, 0, 65, 73]][index].map(n => n * EMPLACEMENT_SCALE);
          c.clearRect(x, y, w, h);
          c.drawImage(base, x, y, w, h, x - shift, y, w, h);
        }
        return out;
      });
      return [name, frames];
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
export type SharedBattleArt = Omit<Art, 'background' | 'mapBackgrounds'>;
let sharedPending: Promise<SharedBattleArt> | undefined;
function loadSharedBattleArt(compact = false): Promise<SharedBattleArt> {
  return (sharedPending ??= (compact && !globalThis.__ART_CDN_BASE__
    ? loadBakedBattleArt() : compileSharedBattleArt(compact)).catch(error => {
    sharedPending = undefined;
    throw error;
  }));
}
/** Build-time source compiler; live battles use the baked output below. */
export function compileSharedBattleArt(compact = false): Promise<SharedBattleArt> {
  const loadImage = (source: string) => loadArtImage(source, compact);
  const generatedSpriteIds = [
    'fort_bunker', 'fort_machinegun', 'fort_aa', 'fort_spawn', 'fort_wire',...FORT_IDS_V227,
  ] as const;
  return Promise.all([
    Promise.all([
      loadImage('/art/vehicles-v3.png'),
      loadImage('/art/terrain-texture.png'),
      loadImage('/art/reinforcements-v5.png'),
      loadImage('/art/destructible-scenery-v9.png'),
      loadImage('/art/artillery-v9.png'),
      loadImage('/art/explosions-v9.png'),
      loadImage('/art/impacts-v12.png'),
      loadImage('/art/fixed-wing-v12.png'),
      loadImage('/art/rotorcraft-v12.png'),
      loadImage('/art/blast-he-frames-v165.png'),
      loadImage('/art/blast-grenade-frames-v165.png'),
      loadImage('/art/buildings-v13.png'),
      loadImage('/art/building-collapse-v13.png'),
      loadImage('/art/ground-wrecks-v14.png'),
      loadImage('/art/air-wrecks-v14.png'),
      loadImage('/art/mobile-vehicles-v14.png'),
      loadImage('/art/support-vehicles-v14.png'),
      loadImage('/art/parachute-v1.png'),
      loadImage('/art/glider-v141.png'),
      loadImage(PARACHUTE_TRANSPORT_ART),
      loadImage(PARACHUTE_TRANSPORT_WRECK),
      loadImage('/art/blast-fuel-frames-v165.png'),
      loadImage('/art/blast-earth-frames-v165.png'),
      loadImage('/art/building-footings-v145.png'),
      loadImage('/art/powder-smoke-frames-v161.png'),
      loadImage('/art/tank-wreck-frames-v162.png'),
      loadImage('/art/blast-air-frames-v165.png'),
      loadImage('/art/soldier-parts-v178.png'),
      loadImage('/art/soldier-equipment-v178.png'),
    ]),
    loadFPVArt(compact),
    compact ? Promise.all((['pine', 'broadleaf'] as const).map(async kind =>
      [kind, treeFramesV17(await loadImage(`/art/v19-trees/${kind}.png`))] as const))
      .then(entries => Object.fromEntries(entries) as TreeArtV17) : loadTreeArtV17(),
    compact ? loadImage('/art/v18-mines/mines.png').then(mineFramesV18) : loadMineArtV18(),
    compact ? loadImage('/art/v18-comeback/toxic-cloud.png').then(comebackFramesV18) : loadComebackArtV18(),
    Promise.all(generatedSpriteIds.map((id) => loadImage((FORT_IDS_V227 as readonly string[]).includes(id)?`/art/v227-installations/${id}.png`:`/art/v190/sprites/${id}.webp`))),
    loadImage('/art/v195-logistics/ammo-crate.png'),
    Promise.all(V197_VEHICLE_IDS.map(async id => {
      const [sprite, wreck] = await Promise.all([
        id === 'light_tank' || id === 'mlrs' ? Promise.resolve(null) : loadImage(vehicleAssetV197(id, 'sprite')),
        loadImage(id==='mlrs'?`${WEAPON_ART_ROOT}/mlrs-wreck.webp`:vehicleAssetV197(id, 'wreck')),
      ]);
      return {id, sprite, wreck};
    })),
    Promise.all(TANK_IDS_V202.map(async id =>
      [id, tankPartsV202(id, await loadImage(`${TANK_ASSET_ROOT}/${id}.webp`))] as const)),
    Promise.all(['mlrs','field-gun','siege-gun','helicopter'].map(id=>loadImage(`${WEAPON_ART_ROOT}/${id}.webp`))),
    Promise.all(VEHICLE_IDS_V209.map(async id=>({id,sprite:await loadImage(vehicleSourceV209(id)),wreck:await loadImage(vehicleSourceV209(id,true))}))),
    Promise.all(Object.values(MISSILE_LAYOUT_V209).map(a=>loadImage(`${VEHICLE_MISSILE_ROOT}/${a.stem}.png`))),
    loadImage(IFV_ART_V220.source).then(ifvPartsV220),
    Promise.all(Object.entries(VEHICLE_SOURCES_V223).map(async ([id,path])=>({id:id as keyof typeof VEHICLE_SOURCES_V223,image:await loadImage(path),wreck:await loadImage(path.replace('.png','-wreck.png'))}))),
    Promise.all(GUN_IDS_V227.map(async id=>({id,body:await loadImage(`/art/v230-guns/${id}-body.png`),barrel:await loadImage(`/art/v230-guns/${id}-barrel.png`)}))),
    loadImage('/art/v233/stealth-bomber-sprite.png'),
  ]).then(
    ([
      [
        vehicles,
        terrain,
        reinforcement,
        scenery,
        emplacements,
        explosions,
        impacts,
        fixedWing,
        rotorcraft,
        heBlastSheet,
        grenadeBlastSheet,
        buildings,
        collapse,
        groundWrecks,
        airWrecks,
        mobileVehicles,
        supportVehicles,
        parachuteSheet,
        gliderSheet,
        parachuteTransportSheet,parachuteTransportWreckSheet,
        fuelBlastSheet,
        earthBlastSheet,
        footingSheet,
        smokeSheet,
        tankWreckSheet,
        airBlastSheet,
        soldierPartsSheet,
        soldierEquipmentSheet,
      ],
      extra,
      trees,
      mines,
      comeback,
      generatedSpriteImages,
      ammoCrate,
      v197Vehicles,
      v202Tanks,
      weaponSheets,
      v209Vehicles,
      missileSheets,
      ifvParts,v223Vehicles,expansionGuns,stealthBomber,
    ]) => {
      const vehicleArt = frames(vehicles, 4, 3, 64, 32);
      vehicleArt[1] = stableHelicopters(vehicles);
      vehicleArt[0] = stableTracks(vehicleArt[0], 5);
      const reinforcementArt = reinforcementFrames(reinforcement);
      reinforcementArt[0] = [ifvPreviewV220(ifvParts)];
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
      const emplacementFrames = buildEmplacements(emplacements);
      const mobileFrames={...mobileVehicleFrames(mobileVehicles,supportVehicles),...Object.fromEntries(v209Vehicles.map(({id,sprite})=>[id,[vehicleFrameV209(id,sprite)]]))};
      const vehicleParts=Object.fromEntries((Object.keys(VEHICLE_GUNS) as VehicleGunId[]).map(id=>{
        if(id==='ifv')return [id,ifvParts];
        if(id==='apc_transport')return [id,apcPartsV223(v223Vehicles.find(v=>v.id==='apc_transport')!.image,v223Vehicles.find(v=>v.id==='pickup')!.image)];
        if(id==='pickup')return [id,pickupPartsV223(v223Vehicles.find(v=>v.id==='pickup')!.image)];
        const phases=mobileFrames[id].map(frame=>splitVehicleGun(id,frame));
        return [id,{...phases[0],bodyFrames:phases.map(parts=>parts.body)}];
      }));
      const gunParts:Record<string,PaintedGunParts> = {...Object.fromEntries(expansionGuns.map(a=>[a.id,expansionGunParts(a.id,a.body,a.barrel)])),...vehicleParts,...Object.fromEntries(v202Tanks), ...buildEmplacementParts(emplacementFrames), ...Object.fromEntries((['mlrs','field_gun','siege_gun'] as const).map((id,i)=>[id,modularGunParts(id,weaponSheets[i])]))};
      const gunPreviews=Object.fromEntries((['mlrs','field_gun','siege_gun'] as const).map(id=>{const a=WEAPON_LAYOUT[id], frame=surface(a.bodyWidth+80,a.bodyHeight+80);drawArticulatedGun(frame.getContext('2d')!,gunParts[id],{id,x:frame.width/2,y:frame.height,facing:1});return [id,[frame]];}));
      const heFrames = packedBlastFrames(heBlastSheet),
        grenadeFrames = packedBlastFrames(grenadeBlastSheet),
        airFrames = packedBlastFrames(airBlastSheet),
        fuelFrames = packedBlastFrames(fuelBlastSheet),
        earthFrames = packedBlastFrames(earthBlastSheet);
      const parachute = atlasFrames(transparentSheet(parachuteSheet), 5, 1, 96)[0];
      const glider=gliderAtlas(gliderSheet);
      const wreckFramesMap = wreckFrames(
        groundWrecks,
        airWrecks,
        mobileVehicles,
        supportVehicles,
        extra.fpvSheet,
        glider[6],
        Object.fromEntries(v197Vehicles.map(({ id, wreck }) => [id, wreck])) as
          Record<(typeof V197_VEHICLE_IDS)[number], HTMLImageElement>,
        Object.fromEntries(v209Vehicles.map(({id,wreck})=>[id,wreck])) as Record<(typeof VEHICLE_IDS_V209)[number],HTMLImageElement>,
        Object.fromEntries(v223Vehicles.map(({id,wreck})=>[id,wreck])) as Record<keyof typeof VEHICLE_SOURCES_V223,HTMLImageElement>,
        parachuteTransportWreckSheet,
      );
      return {
        towRack:towRackParts(vehicleFrameV197('tow_ifv',v197Vehicles.find(v=>v.id==='tow_ifv')!.sprite!)),
        gunParts,
        helicopterParts:helicopterParts(weaponSheets[3]),
        weaponEffects:weaponEffects(weaponSheets[0], missileSheets),
        ammoCrate,
        generatedSprites: Object.fromEntries(generatedSpriteIds.map((id, index) => [id, groundedFortSprite(generatedSpriteImages[index],...fortificationSize(id))])),
        soldiers:soldierArt(soldierPartsSheet,soldierEquipmentSheet),
        comeback,
        mines,
        trees,
        parachute,
        glider,
        parachuteTransport:transportFrameV224(parachuteTransportSheet),
        wrecks: wreckFramesMap,
        wreckVariants: {...wreckVariants(wreckFramesMap,{
          ...paintedTankWrecks(tankWreckSheet),
          ...Object.fromEntries(V197_VEHICLE_IDS.map(id => [id, {
            bullet: [wreckFramesMap[id]], blast: [wreckFramesMap[id]], burn: [wreckFramesMap[id]],
          }])),
        }),
          parachute_transport:{bullet:[transportFrameV224(parachuteTransportWreckSheet)],blast:[transportFrameV224(parachuteTransportWreckSheet)],burn:[transportFrameV224(parachuteTransportWreckSheet)]},
          glider_transport:{bullet:[glider[6]],blast:[glider[7]],burn:[glider[7]]}},
        mobileVehicles: {
          ...mobileVehicleFrames(mobileVehicles, supportVehicles),
          ...gunPreviews,
          ...Object.fromEntries(v209Vehicles.map(({id,sprite})=>[id,[vehicleFrameV209(id,sprite)]])),
          ...Object.fromEntries(v197Vehicles.filter(v => v.sprite).map(({ id, sprite }) => [id, [vehicleFrameV197(id, sprite!)]])),
          ...Object.fromEntries(v223Vehicles.map(({id,image})=>[id,[vehicleFrameV223(id,image)]])),
        },
        terrain,
        vehicles: vehicleArt,
        reinforcements: reinforcementArt,
        aircraft: {
          stealth_bomber: [(()=>{const out=surface(280,114);out.getContext('2d')!.drawImage(stealthBomber,0,0,280,114);return out;})()],
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
        emplacements: emplacementFrames,
        scenery: sceneryFrames(scenery),
        buildings: {...buildingFrames(buildings, collapse),footings:paintedFootings(footingSheet)},
        paintedBlasts: {fuel:fuelFrames,earth:earthFrames,he:heFrames,grenade:grenadeFrames,air:airFrames},
        explosions: explosionFrames(explosions),
        impacts: atlasFrames(impacts, 8, 2, 48),
        smoke: packedSmokeFrames(smokeSheet),
        armor: Object.fromEntries(v202Tanks.map(([id, parts]) => {
          const preview = tankPreviewV202(id, parts);
          return [id, [preview, preview, preview, preview]];
        })),
        // Legacy API aliases share the new cels; do not download/key/cut the
        // old touching-plume sheets just to populate compatibility fields.
        combatExplosions: [heFrames, fuelFrames, airFrames],
        combatExplosionsV13: [fuelFrames, earthFrames, grenadeFrames],
      };
    },
  );
}

type LegacyInfantryArt = Pick<LegacyArt,
  'adults' | 'patrol' | 'digging' | 'adultSpecialists' | 'weaponStances' | 'heavyMG' | 'grenadeLauncher'>;
let legacyPending: Promise<LegacyInfantryArt> | undefined;
function loadLegacyInfantryArt(): Promise<LegacyInfantryArt> {
  return (legacyPending ??= Promise.all([
    Promise.all([
      loadImage('/art/adult-infantry-v13.png'),
      loadImage('/art/adult-marines-v13.png'),
      loadImage('/art/adult-police-v13.png'),
      loadImage('/art/adult-militia-v13.png'),
      loadImage('/art/adult-specialists-v13.png'),
      loadImage('/art/standing-reload-v135.png'),
      loadImage('/art/standing-grenade-v136.png'),
      loadImage('/art/heavy-mg-v140.png'),
      loadImage('/art/infantry-reload-v143.png'),
      loadImage('/art/weapon-stance-frames-v147.png'),
      loadImage('/art/medical-work-frames-v148.png'),
      loadImage('/art/low-grenade-frames-v149.png'),
      loadImage('/art/repair-work-frames-v150.png'),
      loadImage('/art/grenade-launcher-frames-v159.png'),
      loadImage('/art/prone-watch-frames-v163.png'),
    ]),
    loadPatrolArtV17(),
    loadDigArtV18(),
  ]).then(([[
    adultInfantry,
    adultMarines,
    adultPolice,
    adultMilitia,
    specialists,
    standingReload,
    standingGrenade,
    heavyMG,
    lowReloadSheet,
    packedWeaponSheet,
    medicalSheet,
    lowGrenadeSheet,
    repairSheet,
    grenadeLauncherSheet,
    proneWatchSheet,
  ], patrol, digging]) => {
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
      // Match the last raising pose to the established firing anatomy at the handoff.
      for (const id of Object.keys(adults) as AdultIdentity[])
        patrol[id].raise3[2] = adults[id].actions20[0];
      const grenadeLauncher = packedGrenadeLauncher(grenadeLauncherSheet);
      return {
        adults, patrol, digging,
        adultSpecialists: specialistAtlas(specialists),
        weaponStances: {...packedWeaponStances(packedWeaponSheet), grenade: grenadeLauncher.stances},
        heavyMG: heavyMGAtlas(heavyMG),
        grenadeLauncher: grenadeLauncher.cycle,
      };
  }).catch(error => {
    legacyPending = undefined;
    throw error;
  }));
}

/** Legacy entry point: all maps and full-body atlases remain available to QA. */
export function loadArt(): Promise<LegacyArt> {
  return (cached ??= Promise.all([
    loadSharedBattleArt(), loadLegacyInfantryArt(), loadV16Art(), loadMapBackground('greyline'),
  ]).then(([shared, legacy, extra, background]) => ({
    ...shared, ...legacy, background, mapBackgrounds: extra.mapBackgrounds,
  })).catch(error => {
    cached = null;
    throw error;
  }));
}

const battlePending = new Map<MapId, Promise<Art>>();
/** Live battles use the existing soldier rig and just the selected map's backdrop. */
export function loadBattleArt(mapId: MapId): Promise<Art> {
  let pending = battlePending.get(mapId);
  if (!pending) {
    pending = Promise.all([loadSharedBattleArt(true), loadMapBackground(mapId, true)])
      .then(([shared, background]) => ({
        ...shared, background, mapBackgrounds: {[mapId]: background},
      })).catch(error => {
        battlePending.delete(mapId);
        throw error;
      });
    battlePending.set(mapId, pending);
  }
  return pending;
}
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  frame: HTMLCanvasElement | HTMLImageElement | undefined,
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
  frame: HTMLCanvasElement | HTMLImageElement | undefined,
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
  const gunRecoil = Math.max(0, Math.round(recoil));
  // An idle gun is the complete authored frame. Splitting it into fractional
  // clips would add seams even when the barrel has not moved.
  if (gunRecoil === 0) {
    drawSprite(ctx, frame, x, y, w, h, flip, alpha, rotation);
    return;
  }
  const hw = Math.round(w / 2);
  const bx = Math.floor(Math.min(band[0], band[2]));
  const by = Math.floor(Math.min(band[1], band[3]));
  const bw = Math.ceil(Math.max(band[0], band[2])) - bx;
  const bh = Math.ceil(Math.max(band[1], band[3])) - by;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = alpha;
  ctx.translate(Math.round(x), Math.round(y));
  if (rotation) ctx.rotate(rotation);
  if (flip) ctx.scale(-1, 1);
  // Pass 1: hull with the muzzle band cut out.
  ctx.save();
  ctx.beginPath();
  ctx.rect(-hw, -h, w, h);
  ctx.rect(bx, by, bw, bh);
  ctx.clip('evenodd');
  ctx.drawImage(frame, -hw, -h, w, h);
  ctx.restore();
  // Pass 2: the muzzle band alone, pulled back toward the hull.
  // This clip must start from the parent context: intersecting it with the
  // first pass's barrel-shaped hole erases the entire moving gun section.
  ctx.beginPath();
  ctx.rect(bx, by, bw, bh);
  ctx.clip();
  ctx.drawImage(frame, -hw - gunRecoil, -h, w, h);
  ctx.restore();
}
function infantryFrame(art: Art, id: CardId) {
  const adult = art.adults?.[adultIdentity(id)];
  if (adult) return uniformFrame(adult.actions20[0], CARDS[id].uniform);
  if (art.soldiers) return soldierFrame(art.soldiers, {id, pose: 'idle', hp: 1, member: 0}, 0).image;
  throw new Error(`Missing infantry art: ${id}`);
}
export function cardFrame(art: Art, index: number) {
  if (index < 3 || (index >= 10 && index <= 12))
    return infantryFrame(art, 'infantry');
  if (index === 13) return art.reinforcements[0][0];
  if (index === 3) return art.vehicles[0][0];
  if (index === 4) return art.vehicles[1][0];
  return art.vehicles[2][0];
}
export function unitFrame(art: Art, id: CardId, frame = 0) {
  const c = CARDS[id];
  if (art.generatedSprites[id]) return art.generatedSprites[id];
  if(id==='parachute_transport')return art.parachuteTransport;
  if(id==='glider_transport')return art.glider[frame%art.glider.length];
  if (c.members) return infantryFrame(art, id);
  const mobile = art.mobileVehicles?.[id];
  if (mobile) return mobile[frame % mobile.length];
  if(art.gunParts?.[id])return art.gunParts[id].body;
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
  if (id === 'ifv') return art.reinforcements[0][frame % art.reinforcements[0].length];
  if (modelOf(id) === 'ifv') throw new Error(`Missing dedicated vehicle sprite: ${id}`);
  return cardFrame(art, c.atlas);
}
export function unitSize(id: CardId): [number, number] {
  const c = CARDS[id];
  if(id==='mlrs')return [168,100];
  if(id==='field_gun')return [156,80];
  if(id==='siege_gun')return [264,110];
  if(id==='helicopter'||id==='rocket_heli'||id==='escort_gunship')return [HELI_LAYOUT.width,HELI_LAYOUT.height+14];
  if(GUN_SIZES_V227[id])return [...GUN_SIZES_V227[id]];
  if(c.fortification)return fortificationSize(id);
  if(id==='parachute_transport')return [320,110];
  if(id==='glider_transport')return [256,100];
  if (id === 'stealth_bomber') return [280,114];
  if (id === 'bomber') return [260, 108];
  if (id === 'strike_jet') return [210, 90];
  if (id === 'fpv_drone') return [54, 28];
  if (id === 'air_assault') return [240, 112];
  const tank = tankGeometry(id);
  if (tank) return tank.size;
  if (c.emplacement) return emplacementSize(c.emplacement as EmplacementName);
  if (c.airframe === 'scout_drone') return [88, 48];
  if (c.airframe === 'attack_drone') return [176, 78];
  if (c.airframe === 'loiter_drone') return [104, 52];
  if (c.airframe === 'interceptor') return [198, 84];
  if (c.airframe === 'rocket_heli') return [220, 110];
  return modelOf(id) === 'tank'
    ? [205, 108]
    : modelOf(id) === 'ifv'
      ? [IFV_ART_V220.width, IFV_ART_V220.height]
      : c.air
        ? [235, 118]
        : [96, 72];
}
