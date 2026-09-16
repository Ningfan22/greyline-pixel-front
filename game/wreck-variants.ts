import { WRECKS, type WreckKind } from './wreck-geometry';

type Rect = [number, number, number, number];

interface DetachSpec {
  /** Normalized region of the frame to tear off (x, y, w, h). */
  rect: Rect;
  /** Normalized landing position of the detached part on the ground. */
  land: [number, number];
  /** Rotation range in radians applied to the detached part. */
  spin: [number, number];
}

interface KindSpec {
  detach?: DetachSpec;
  breaches?: [number, number][];
  collapse?: Rect;
}

/**
 * Authored structural damage regions, measured from the wreck atlases.
 * Kinds without an entry fall back to generic breach/collapse positions.
 */
const SPECS: Partial<Record<WreckKind, KindSpec>> = {
  light_tank: {
    detach: { rect: [0.04, 0.1, 0.3, 0.34], land: [0.68, 0.8], spin: [1.2, 2.4] },
    breaches: [[0.12, 0.58], [0.45, 0.62]],
    collapse: [0.05, 0.08, 0.3, 0.3],
  },
  tank: {
    detach: { rect: [0.28, 0.08, 0.32, 0.36], land: [0.7, 0.8], spin: [1.0, 2.2] },
    breaches: [[0.15, 0.6], [0.5, 0.64]],
    collapse: [0.26, 0.06, 0.34, 0.32],
  },
  heavy_tank: {
    detach: { rect: [0.22, 0.04, 0.34, 0.42], land: [0.66, 0.82], spin: [0.9, 2.0] },
    breaches: [[0.12, 0.62], [0.55, 0.66]],
    collapse: [0.2, 0.04, 0.38, 0.38],
  },
  ifv: {
    detach: { rect: [0.4, 0.26, 0.24, 0.34], land: [0.76, 0.78], spin: [1.4, 2.6] },
    breaches: [[0.18, 0.55], [0.55, 0.58]],
    collapse: [0.38, 0.24, 0.26, 0.3],
  },
  sam_vehicle: {
    detach: { rect: [0.03, 0.06, 0.24, 0.4], land: [0.62, 0.84], spin: [1.6, 2.8] },
    breaches: [[0.3, 0.7], [0.55, 0.72]],
    collapse: [0.02, 0.05, 0.26, 0.36],
  },
  howitzer: {
    detach: { rect: [0.44, 0.04, 0.5, 0.44], land: [0.3, 0.9], spin: [0.5, 1.4] },
    breaches: [[0.4, 0.65], [0.6, 0.7]],
    collapse: [0.4, 0.3, 0.25, 0.3],
  },
  at_gun: {
    detach: { rect: [0.36, 0.08, 0.32, 0.52], land: [0.74, 0.8], spin: [1.2, 2.4] },
    breaches: [[0.3, 0.6], [0.55, 0.62]],
    collapse: [0.34, 0.3, 0.2, 0.26],
  },
  aa_gun: {
    detach: { rect: [0.22, 0.04, 0.44, 0.42], land: [0.7, 0.86], spin: [0.8, 2.0] },
    breaches: [[0.3, 0.6], [0.55, 0.64]],
    collapse: [0.22, 0.3, 0.24, 0.26],
  },
  pickup: {
    detach: { rect: [0.5, 0.26, 0.28, 0.44], land: [0.28, 0.82], spin: [1.8, 3.0] },
    breaches: [[0.2, 0.6], [0.65, 0.62]],
    collapse: [0.48, 0.24, 0.3, 0.4],
  },
  tow_ifv: {
    detach: { rect: [0.52, 0.14, 0.3, 0.36], land: [0.28, 0.82], spin: [1.2, 2.4] },
    breaches: [[0.2, 0.62], [0.6, 0.64]],
    collapse: [0.5, 0.12, 0.32, 0.32],
  },
  mortar_carrier: {
    detach: { rect: [0.28, 0.26, 0.24, 0.22], land: [0.7, 0.86], spin: [1.4, 2.6] },
    breaches: [[0.2, 0.62], [0.55, 0.66]],
    collapse: [0.26, 0.24, 0.26, 0.2],
  },
  recovery_vehicle: {
    detach: { rect: [0.32, 0.12, 0.32, 0.32], land: [0.72, 0.84], spin: [1.0, 2.2] },
    breaches: [[0.2, 0.62], [0.55, 0.66]],
    collapse: [0.3, 0.1, 0.34, 0.3],
  },
  command_vehicle: {
    detach: { rect: [0.28, 0.06, 0.24, 0.32], land: [0.7, 0.86], spin: [1.4, 2.6] },
    breaches: [[0.2, 0.62], [0.55, 0.66]],
    collapse: [0.26, 0.04, 0.26, 0.28],
  },
  mine_clearer: {
    detach: { rect: [0.58, 0.42, 0.28, 0.36], land: [0.28, 0.86], spin: [1.6, 2.8] },
    breaches: [[0.2, 0.62], [0.5, 0.66]],
    collapse: [0.1, 0.28, 0.24, 0.24],
  },
  helicopter: {
    detach: { rect: [0.02, 0.52, 0.26, 0.32], land: [0.72, 0.86], spin: [1.8, 3.0] },
    breaches: [[0.45, 0.55], [0.65, 0.58]],
    collapse: [0.4, 0.3, 0.3, 0.3],
  },
  rocket_heli: {
    detach: { rect: [0.02, 0.58, 0.18, 0.28], land: [0.74, 0.88], spin: [1.8, 3.0] },
    breaches: [[0.4, 0.6], [0.62, 0.62]],
    collapse: [0.35, 0.35, 0.3, 0.3],
  },
  medevac: {
    detach: { rect: [0.02, 0.52, 0.24, 0.32], land: [0.74, 0.88], spin: [1.8, 3.0] },
    breaches: [[0.45, 0.55], [0.65, 0.58]],
    collapse: [0.4, 0.3, 0.3, 0.3],
  },
  scout_drone: {
    detach: { rect: [0.0, 0.5, 0.28, 0.34], land: [0.64, 0.74], spin: [2.0, 3.2] },
    breaches: [[0.4, 0.5], [0.6, 0.52]],
    collapse: [0.3, 0.35, 0.3, 0.3],
  },
  attack_drone: {
    detach: { rect: [0.28, 0.28, 0.38, 0.32], land: [0.72, 0.86], spin: [1.4, 2.6] },
    breaches: [[0.45, 0.55], [0.65, 0.58]],
    collapse: [0.4, 0.4, 0.3, 0.26],
  },
  loiter_drone: {
    detach: { rect: [0.52, 0.28, 0.32, 0.32], land: [0.22, 0.86], spin: [1.6, 2.8] },
    breaches: [[0.35, 0.55], [0.6, 0.58]],
    collapse: [0.3, 0.4, 0.3, 0.26],
  },
  interceptor: {
    detach: { rect: [0.0, 0.52, 0.32, 0.28], land: [0.64, 0.9], spin: [1.8, 3.0] },
    breaches: [[0.4, 0.6], [0.62, 0.62]],
    collapse: [0.35, 0.4, 0.3, 0.26],
  },
  strike_jet: {
    detach: { rect: [0.28, 0.18, 0.28, 0.32], land: [0.7, 0.9], spin: [1.2, 2.4] },
    breaches: [[0.45, 0.6], [0.65, 0.62]],
    collapse: [0.4, 0.4, 0.3, 0.26],
  },
  bomber: {
    detach: { rect: [0.72, 0.42, 0.28, 0.38], land: [0.28, 0.9], spin: [1.6, 2.8] },
    breaches: [[0.35, 0.6], [0.58, 0.62]],
    collapse: [0.3, 0.4, 0.34, 0.26],
  },
};

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function clone(frame: HTMLCanvasElement) {
  const c = document.createElement('canvas');
  c.width = frame.width;
  c.height = frame.height;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(frame, 0, 0);
  return { c, ctx };
}

function jaggedBlob(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  rand: () => number,
  points = 11,
) {
  ctx.beginPath();
  for (let i = 0; i <= points; i++) {
    const a = (i / points) * Math.PI * 2;
    const rr = r * (0.62 + rand() * 0.66);
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function punchHole(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  rand: () => number,
) {
  // soot halo
  ctx.fillStyle = 'rgba(8,7,6,0.55)';
  jaggedBlob(ctx, cx, cy, r * 1.5, rand, 12);
  ctx.fill();
  // black hole
  ctx.fillStyle = '#050404';
  jaggedBlob(ctx, cx, cy, r, rand, 10);
  ctx.fill();
  // torn-metal rim light on the upper-left edge
  ctx.strokeStyle = 'rgba(96,88,74,0.85)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= 5; i++) {
    const a = Math.PI * 0.9 + (i / 5) * Math.PI * 0.7;
    const rr = r * (0.85 + rand() * 0.3);
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  // debris specks
  for (let i = 0; i < 9; i++) {
    const a = rand() * Math.PI * 2;
    const d = r * (1.4 + rand() * 1.6);
    ctx.fillStyle = rand() < 0.5 ? '#241f1a' : '#3a332a';
    const s = rand() < 0.3 ? 2 : 1;
    ctx.fillRect(cx + Math.cos(a) * d, cy + Math.sin(a) * d, s, s);
  }
}

/** V1: a major assembly (turret, barrel, tail, wing) is torn off and thrown beside the hull. */
function blownApart(
  frame: HTMLCanvasElement,
  spec: KindSpec,
  rand: () => number,
): HTMLCanvasElement {
  const { c, ctx } = clone(frame);
  const W = frame.width;
  const H = frame.height;
  if (!spec.detach) {
    punchHole(ctx, 0.3 * W, 0.5 * H, W * 0.07, rand);
    punchHole(ctx, 0.55 * W, 0.45 * H, W * 0.06, rand);
    punchHole(ctx, 0.72 * W, 0.55 * H, W * 0.05, rand);
    return c;
  }
  const [rx, ry, rw, rh] = spec.detach.rect;
  const sx = Math.round(rx * W);
  const sy = Math.round(ry * H);
  const sw = Math.max(4, Math.round(rw * W));
  const sh = Math.max(4, Math.round(rh * H));
  // extract the part
  const part = document.createElement('canvas');
  part.width = sw;
  part.height = sh;
  const pctx = part.getContext('2d')!;
  pctx.imageSmoothingEnabled = false;
  pctx.drawImage(frame, sx, sy, sw, sh, 0, 0, sw, sh);
  // jagged black gap where the part was torn out
  jaggedBlob(ctx, sx + sw / 2, sy + sh / 2, Math.max(sw, sh) * 0.62, rand, 13);
  ctx.fillStyle = '#0a0908';
  ctx.fill();
  // torn-metal chunks around the gap rim
  ctx.fillStyle = '#2a2620';
  for (let i = 0; i < 10; i++) {
    const a = rand() * Math.PI * 2;
    const r0 = Math.max(sw, sh) * 0.55;
    ctx.beginPath();
    ctx.arc(
      sx + sw / 2 + Math.cos(a) * r0,
      sy + sh / 2 + Math.sin(a) * r0,
      1 + rand() * 2.5,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  // scorch under the landing spot
  const [lx, ly] = spec.detach.land;
  const scale = 0.82 + rand() * 0.16;
  ctx.fillStyle = 'rgba(10,8,6,0.5)';
  ctx.beginPath();
  ctx.ellipse(
    lx * W,
    ly * H + sh * 0.32,
    sw * 0.55 * scale,
    Math.max(3, sh * 0.12),
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  // drop the part on the ground, rotated
  const angle =
    spec.detach.spin[0] + rand() * (spec.detach.spin[1] - spec.detach.spin[0]);
  ctx.save();
  ctx.translate(lx * W, ly * H);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  ctx.drawImage(part, -sw / 2, -sh / 2);
  ctx.restore();
  return c;
}

/** V2: the hull is punctured by several direct hits, with soot and spalled debris. */
function breached(
  frame: HTMLCanvasElement,
  spec: KindSpec,
  rand: () => number,
): HTMLCanvasElement {
  const { c, ctx } = clone(frame);
  const W = frame.width;
  const H = frame.height;
  const points = spec.breaches ?? [
    [0.3, 0.5],
    [0.55, 0.45],
    [0.72, 0.55],
  ];
  for (const [px, py] of points) {
    punchHole(ctx, px * W, py * H, W * (0.045 + rand() * 0.035), rand);
  }
  return c;
}

/** V3: the upper structure is crushed downward and the hulk is heavily charred. */
function gutted(
  frame: HTMLCanvasElement,
  spec: KindSpec,
  rand: () => number,
): HTMLCanvasElement {
  const { c, ctx } = clone(frame);
  const W = frame.width;
  const H = frame.height;
  const region = spec.collapse ?? [0.1, 0.05, 0.8, 0.35];
  const [rx, ry, rw, rh] = region;
  const sx = Math.round(rx * W);
  const sy = Math.round(ry * H);
  const sw = Math.max(4, Math.round(rw * W));
  const sh = Math.max(4, Math.round(rh * H));
  // extract the upper structure
  const part = document.createElement('canvas');
  part.width = sw;
  part.height = sh;
  const pctx = part.getContext('2d')!;
  pctx.imageSmoothingEnabled = false;
  pctx.drawImage(frame, sx, sy, sw, sh, 0, 0, sw, sh);
  // black out the region
  ctx.fillStyle = '#070605';
  ctx.fillRect(sx, sy, sw, sh);
  // redraw it crushed downward
  const crush = 0.38 + rand() * 0.14;
  const crushedH = Math.max(2, Math.round(sh * crush));
  ctx.drawImage(part, sx, sy + sh - crushedH, sw, crushedH);
  // black gaps through the crushed layer
  ctx.fillStyle = '#050404';
  for (let i = 0; i < 3; i++) {
    const gx = sx + rand() * sw * 0.8;
    const gw = 2 + Math.round(rand() * 4);
    ctx.fillRect(gx, sy + sh - crushedH, gw, crushedH);
  }
  // heavy char wash over the upper hull
  const washH = Math.round(H * 0.55);
  const grad = ctx.createLinearGradient(0, 0, 0, washH);
  grad.addColorStop(0, 'rgba(0,0,0,0.55)');
  grad.addColorStop(1, 'rgba(0,0,0,0.12)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, washH);
  // soot streaks
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  for (let i = 0; i < 6; i++) {
    const x = rand() * W;
    const w = 2 + Math.round(rand() * 5);
    ctx.fillRect(x, rand() * washH * 0.4, w, washH * (0.3 + rand() * 0.5));
  }
  return c;
}

/**
 * Four structural damage states per wreck kind, baked once at load:
 * [0] as-is, [1] major assembly torn off, [2] hull breached, [3] crushed & gutted.
 * Renderers pick a stable variant per wreck id, so same-card wrecks no
 * longer look identical — and the difference is structural, not a filter.
 */
export function wreckVariants(
  frames: Record<WreckKind, HTMLCanvasElement>,
): Record<WreckKind, HTMLCanvasElement[]> {
  return Object.fromEntries(
    (Object.keys(WRECKS) as WreckKind[]).map((kind) => {
      const frame = frames[kind];
      const spec = SPECS[kind] ?? {};
      const seed = hash(kind);
      return [
        kind,
        [
          frame,
          blownApart(frame, spec, rng(seed ^ 0x9e3779b9)),
          breached(frame, spec, rng(seed ^ 0x85ebca6b)),
          gutted(frame, spec, rng(seed ^ 0xc2b2ae35)),
        ],
      ];
    }),
  ) as Record<WreckKind, HTMLCanvasElement[]>;
}
