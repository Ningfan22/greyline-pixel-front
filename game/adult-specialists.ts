import { weaponModel } from './cards';
import type { Unit } from './engine';
import type { AdultFrameChoice } from './adult-animation';
import { SPECIALIST_LANDMARKS } from './specialist-landmarks';
export type SpecialistRole =
  | 'machinegun'
  | 'rocket'
  | 'sniper'
  | 'medic'
  | 'mortar';
export interface SpecialistFrame {
  image: HTMLCanvasElement;
  waist: readonly number[];
  muzzle: readonly number[] | null;
}
export interface AdultSpecialistArt {
  standing: SpecialistFrame;
  crouch: SpecialistFrame;
  prone: SpecialistFrame;
}
export type AdultSpecialists = Partial<
  Record<SpecialistRole, AdultSpecialistArt>
>;
export interface SpecialistSprite {
  image: HTMLCanvasElement;
  muzzle: { x: number; height: number } | null;
}
const roles: SpecialistRole[] = [
  'machinegun',
  'rocket',
  'sniper',
  'medic',
  'mortar',
];
function canvas() {
  const out = document.createElement('canvas');
  out.width = 128;
  out.height = 96;
  return out;
}
/** The prepared sheet preserves adult anatomy; no per-pose fitting or weapon drawing. */
export function specialistAtlas(source: HTMLImageElement): AdultSpecialists {
  const sets: AdultSpecialists = {};
  for (let col = 0; col < 5; col++) {
    const rows = [0, 1, 2].map((row) => {
      const image = canvas(),
        ctx = image.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        source,
        (col * source.width) / 5,
        (row * source.height) / 3,
        source.width / 5,
        source.height / 3,
        0,
        0,
        128,
        96,
      );
      return { image, ...SPECIALIST_LANDMARKS[row * 5 + col] };
    });
    sets[roles[col]] = { standing: rows[0], crouch: rows[1], prone: rows[2] };
  }
  return sets;
}
const cache = new WeakMap<
  HTMLCanvasElement,
  Map<SpecialistFrame, SpecialistSprite>
>();
/** Replace the baked rifle torso, retaining only the generated moving legs. */
export function specialistSprite(
  base: HTMLCanvasElement,
  choice: AdultFrameChoice,
  u: Unit,
  sets?: AdultSpecialists,
): SpecialistSprite | null {
  const model = weaponModel(u) as SpecialistRole,
    set = sets?.[model];
  if (
    !set ||
    u.hp <= 0 ||
    u.wounded ||
    u.surrendered ||
    choice.group === 'reactions8'
  )
    return null;
  const prone = choice.group === 'actions20' && [2, 12].includes(choice.index);
  const low =
    choice.group === 'crouch8' ||
    (choice.group === 'actions20' && choice.index === 1);
  const running =
    choice.group === 'actions20' && choice.index >= 16 && choice.index <= 19;
  if (
    !prone &&
    !low &&
    !running &&
    choice.group !== 'walk8' &&
    !(choice.group === 'actions20' && choice.index === 0)
  )
    return null;
  const part = prone
    ? set.prone
    : low && !(model === 'mortar' && choice.group === 'crouch8')
      ? set.crouch
      : set.standing;
  if (!u.moving && !prone && choice.group !== 'crouch8')
    return {
      image: part.image,
      muzzle: part.muzzle
        ? { x: part.muzzle[0] - 64, height: 96 - part.muzzle[1] }
        : null,
    };
  let variants = cache.get(base);
  if (!variants) {
    variants = new Map();
    cache.set(base, variants);
  }
  const found = variants.get(part);
  if (found) return found;
  const waist = prone
    ? choice.index === 12
      ? [43, 92]
      : [40, 92]
    : low
      ? [45, 68]
      : running
        ? [
            [45, 60],
            [44, 58],
            [45, 59],
            [44, 58],
          ][choice.index - 16]
        : [48, 63];
  const image = canvas(),
    ctx = image.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const dx = Math.round(16 + waist[0] - part.waist[0]),
    dy = Math.round(waist[1] - part.waist[1]);
  const targetX = 16 + waist[0],
    targetY = waist[1];
  ctx.save();
  ctx.beginPath();
  if (prone) ctx.rect(0, 0, targetX + 1, 96);
  else ctx.rect(0, targetY, 128, 96 - targetY);
  ctx.clip();
  ctx.drawImage(base, 16, 0);
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  if (prone) {
    // Retain the complete generic legs and the specialist's rearward launcher/pack.
    // Only the truncated source pants stub is excluded.
    ctx.rect(Math.round(part.waist[0]) - 1 + dx, 0, 128, 96);
    ctx.rect(
      0,
      0,
      Math.round(part.waist[0]) + dx,
      Math.round(part.waist[1]) - 3 + dy,
    );
  } else ctx.rect(0, 0, 128, Math.round(part.waist[1]) + 1 + dy);
  ctx.clip();
  ctx.drawImage(part.image, dx, dy);
  ctx.restore();
  const result = {
    image,
    muzzle: part.muzzle
      ? { x: part.muzzle[0] + dx - 64, height: 96 - part.muzzle[1] - dy }
      : null,
  };
  variants.set(part, result);
  return result;
}
