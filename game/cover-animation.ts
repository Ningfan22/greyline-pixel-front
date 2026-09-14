import type { Unit } from './engine';

export type Pose = Unit['pose'];

/** Deterministic 32-bit hash so cover props never flicker between frames. */
function hash(uid: number, salt = 0): number {
  let h = (uid * 2654435761 + salt * 40503) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

export type CoverPropKind = 'sandbags' | 'rubble' | null;

/** Heavy cover (deep craters, trench lips) reads as sandbags; light cover as rubble. */
export function coverPropKind(cover: number): CoverPropKind {
  if (cover < 0.2) return null;
  return cover >= 0.55 ? 'sandbags' : 'rubble';
}

export interface CoverBlock {
  /** Horizontal offset from the unit anchor, px. */
  dx: number;
  /** Height above the ground anchor, px (0 = resting on ground). */
  dy: number;
  w: number;
  h: number;
  color: string;
}

const SANDBAG_COLORS = ['#8a7a55', '#7d6e4c', '#96865e', '#6f6144'];
const RUBBLE_COLORS = ['#6b6659', '#5d584d', '#7a7466', '#54503f'];

/**
 * Deterministic per-unit cover prop. Sandbags: two staggered courses.
 * Rubble: an irregular low pile. Blocks are drawn over the sprite's lower
 * body, anchoring the soldier to the ground they are hiding behind.
 */
export function coverProp(uid: number, cover: number): CoverBlock[] {
  const kind = coverPropKind(cover);
  if (!kind) return [];
  const blocks: CoverBlock[] = [];
  if (kind === 'sandbags') {
    for (let layer = 0; layer < 2; layer++) {
      const n = 4 - layer; // 4 on the bottom course, 3 staggered on top
      for (let i = 0; i < n; i++) {
        const seed = hash(uid, layer * 7 + i * 13);
        blocks.push({
          dx:
            (i - (n - 1) / 2) * 9 +
            (layer === 1 ? 4.5 : 0) +
            ((seed % 5) - 2),
          dy: layer * 5,
          w: 9,
          h: 5,
          color: SANDBAG_COLORS[seed % SANDBAG_COLORS.length],
        });
      }
    }
  } else {
    const n = 5 + (hash(uid, 1) % 3);
    for (let i = 0; i < n; i++) {
      const seed = hash(uid, 17 + i * 29);
      blocks.push({
        dx: (i - (n - 1) / 2) * 7 + ((seed % 5) - 2),
        dy: seed % 4,
        w: 5 + (seed % 4),
        h: 3 + ((seed >> 2) % 3),
        color: RUBBLE_COLORS[seed % RUBBLE_COLORS.length],
      });
    }
  }
  return blocks;
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInCubic = (t: number) => t * t * t;

const isLow = (p: Pose) => p === 'crouch' || p === 'prone';
const isHigh = (p: Pose) => p === 'idle' || p === 'walk' || p === 'run';

/**
 * Vertical peek offset in px (positive = sprite shifted DOWN, sinking behind
 * the prop). Rising from crouch/prone eases the soldier up over 0.16s;
 * dropping back eases them down over 0.14s. Same-pose or lateral transitions
 * return 0 (instant, like a flinch).
 */
export function peekRise(prev: Pose, next: Pose, sinceChange: number): number {
  if (isLow(prev) && isHigh(next)) {
    const amp = prev === 'prone' ? 6 : 4;
    const t = Math.min(1, sinceChange / 0.16);
    return Math.round(amp * (1 - easeOutCubic(t)));
  }
  if (isHigh(prev) && isLow(next)) {
    const amp = next === 'prone' ? 6 : 4;
    const t = Math.min(1, sinceChange / 0.14);
    return Math.round(amp * easeInCubic(t));
  }
  return 0;
}

/** Troops still aboard the transport, capped at what the door window shows. */
export function transportCrewCount(cargoSize: number, dropped: number): number {
  return Math.max(0, Math.min(3, cargoSize - dropped));
}

export interface CrewHead {
  dx: number;
  dy: number;
}

/**
 * Helmet slots inside the open side door, relative to the helicopter's
 * bottom-center anchor (facing right). The visible heads are centered in the
 * door and bob gently with the airframe.
 */
export function transportCrewSlot(
  index: number,
  count: number,
  time: number,
  uid: number,
): CrewHead {
  const slots = [
    { dx: -11, dy: -26 },
    { dx: 2, dy: -28 },
    { dx: 13, dy: -26 },
  ];
  const start = Math.floor((3 - count) / 2);
  const slot = slots[start + index] ?? slots[0];
  const bob = Math.round(
    Math.sin(time * 3 + uid * 1.3 + index * 2.1) * 1.5,
  );
  return { dx: slot.dx, dy: slot.dy + bob };
}
