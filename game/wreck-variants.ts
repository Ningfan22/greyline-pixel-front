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

/** V4: the hulk burned for minutes after the kill — paint gone, glass blacked,
 *  soot streaks down the flanks, embers still glowing in the gut. */
function burnedOut(
  frame: HTMLCanvasElement,
  spec: KindSpec,
  rand: () => number,
): HTMLCanvasElement {
  const { c, ctx } = clone(frame);
  const W = frame.width;
  const H = frame.height;
  ctx.globalCompositeOperation = 'source-atop';
  // heavy char wash over the whole hulk
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, 'rgba(6,5,4,0.92)');
  grad.addColorStop(0.45, 'rgba(16,13,10,0.78)');
  grad.addColorStop(1, 'rgba(10,8,6,0.6)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  // soot streaks running down from the roofline
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  for (let i = 0; i < 16; i++) {
    const x = rand() * W;
    const w = 1 + Math.round(rand() * 4);
    const y0 = rand() * H * 0.2;
    const len = H * (0.3 + rand() * 0.6);
    ctx.fillRect(x, y0, w, len);
  }
  // burnt-paint chips where the underlayer shows through
  for (let i = 0; i < 22; i++) {
    const x = rand() * W;
    const y = H * 0.15 + rand() * H * 0.75;
    const s = 1 + rand() * 3;
    ctx.fillStyle = rand() < 0.5 ? '#4a3f30' : '#332a20';
    ctx.fillRect(x, y, s, s);
  }
  // ember glow in the gut
  for (let i = 0; i < 5; i++) {
    const x = W * (0.15 + rand() * 0.7);
    const y = H * (0.35 + rand() * 0.4);
    const r = 2 + rand() * 5;
    const g2 = ctx.createRadialGradient(x, y, 0, x, y, r);
    g2.addColorStop(0, 'rgba(255,130,40,0.6)');
    g2.addColorStop(1, 'rgba(255,60,10,0)');
    ctx.fillStyle = g2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  return c;
}

/** V5: a catastrophic kill splits the hull down the middle — the two halves
 *  are torn apart and lie separated with a scorched gap between them. */
function splitHull(
  frame: HTMLCanvasElement,
  spec: KindSpec,
  rand: () => number,
): HTMLCanvasElement {
  const { c, ctx } = clone(frame);
  const W = frame.width;
  const H = frame.height;
  const midX = W / 2;
  const gap = Math.round(W * 0.1);
  // extract left and right halves
  const left = document.createElement('canvas');
  left.width = Math.ceil(midX);
  left.height = H;
  const lctx = left.getContext('2d')!;
  lctx.imageSmoothingEnabled = false;
  lctx.drawImage(frame, 0, 0);
  const right = document.createElement('canvas');
  right.width = W - Math.floor(midX);
  right.height = H;
  const rctx = right.getContext('2d')!;
  rctx.imageSmoothingEnabled = false;
  rctx.drawImage(frame, -Math.floor(midX), 0);
  // clear the clone and redraw halves pulled apart
  ctx.clearRect(0, 0, W, H);
  const shift = Math.round(gap / 2);
  ctx.drawImage(left, -shift, 0);
  ctx.drawImage(right, midX + shift, 0);
  // jagged black tear along the gap
  ctx.fillStyle = '#080605';
  for (let i = 0; i < 8; i++) {
    const x = midX - shift + rand() * gap;
    const y = rand() * H;
    const r = 2 + rand() * 5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // debris chunks scattered in the gap
  ctx.fillStyle = '#2a241e';
  for (let i = 0; i < 10; i++) {
    const x = midX - shift + rand() * gap;
    const y = H * 0.5 + rand() * H * 0.45;
    const s = 1 + rand() * 3;
    ctx.fillRect(x, y, s, s);
  }
  return c;
}

/** V6: an ammunition-detonation kill blows the turret clean off the hull —
 *  it tumbles to rest several body-lengths away, leaving a ragged hole. */
function turretBlast(
  frame: HTMLCanvasElement,
  spec: KindSpec,
  rand: () => number,
): HTMLCanvasElement {
  const { c, ctx } = clone(frame);
  const W = frame.width;
  const H = frame.height;
  const region = spec.collapse ?? [0.15, 0.02, 0.7, 0.4];
  const [rx, ry, rw, rh] = region;
  const sx = Math.round(rx * W);
  const sy = Math.round(ry * H);
  const sw = Math.max(4, Math.round(rw * W));
  const sh = Math.max(4, Math.round(rh * H));
  // extract the turret / roof assembly
  const part = document.createElement('canvas');
  part.width = sw;
  part.height = sh;
  const pctx = part.getContext('2d')!;
  pctx.imageSmoothingEnabled = false;
  pctx.drawImage(frame, sx, sy, sw, sh, 0, 0, sw, sh);
  // ragged hole where the turret was
  jaggedBlob(ctx, sx + sw / 2, sy + sh / 2, Math.max(sw, sh) * 0.7, rand, 14);
  ctx.fillStyle = '#080605';
  ctx.fill();
  // torn-metal chunks around the rim
  ctx.fillStyle = '#2a241e';
  for (let i = 0; i < 14; i++) {
    const a = rand() * Math.PI * 2;
    const r0 = Math.max(sw, sh) * 0.6;
    ctx.beginPath();
    ctx.arc(
      sx + sw / 2 + Math.cos(a) * r0,
      sy + sh / 2 + Math.sin(a) * r0,
      1 + rand() * 3,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  // scorch crater at the landing site (beyond the hull)
  const landX = 0.88 + rand() * 0.1;
  const landY = 0.82 + rand() * 0.1;
  ctx.fillStyle = 'rgba(8,6,4,0.6)';
  ctx.beginPath();
  ctx.ellipse(
    landX * W,
    landY * H,
    sw * 0.5,
    Math.max(3, sh * 0.12),
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  // drop the turret tumbled upside-down, far away
  const angle = Math.PI + (rand() - 0.5) * 1.2;
  const scale = 0.78 + rand() * 0.14;
  ctx.save();
  ctx.translate(landX * W, landY * H - sh * 0.2);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  ctx.drawImage(part, -sw / 2, -sh / 2);
  ctx.restore();
  return c;
}

/** V7: an incendiary kill scorches the paint and blisters the surface,
 *  but the hulk stays structurally intact. */
function scorched(
  frame: HTMLCanvasElement,
  spec: KindSpec,
  rand: () => number,
): HTMLCanvasElement {
  const { c, ctx } = clone(frame);
  const W = frame.width;
  const H = frame.height;
  ctx.globalCompositeOperation = 'source-atop';
  // patchy burn discoloration
  for (let i = 0; i < 12; i++) {
    const cx = rand() * W;
    const cy = H * 0.15 + rand() * H * 0.7;
    const r = W * (0.04 + rand() * 0.1);
    const shade = rand() < 0.5 ? '20,16,12' : '35,28,20';
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgba(${shade},0.7)`);
    g.addColorStop(1, `rgba(${shade},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // soot streaks
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  for (let i = 0; i < 8; i++) {
    const x = rand() * W;
    const w = 1 + Math.round(rand() * 3);
    const y0 = rand() * H * 0.3;
    const len = H * (0.2 + rand() * 0.4);
    ctx.fillRect(x, y0, w, len);
  }
  // peeling paint chips
  for (let i = 0; i < 16; i++) {
    const x = rand() * W;
    const y = H * 0.2 + rand() * H * 0.65;
    const s = 1 + rand() * 2.5;
    ctx.fillStyle = rand() < 0.5 ? '#5a4d3a' : '#4a3f30';
    ctx.fillRect(x, y, s, s);
  }
  // blistered paint dots
  ctx.fillStyle = 'rgba(60,50,38,0.5)';
  for (let i = 0; i < 20; i++) {
    const x = rand() * W;
    const y = H * 0.2 + rand() * H * 0.6;
    ctx.beginPath();
    ctx.arc(x, y, 1 + rand() * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  return c;
}

/** V8: an ammunition cook-off blows the upper hull open from the inside —
 *  multiple blast holes through the roof structure and a heavy char wash. */
function ammoCookOff(
  frame: HTMLCanvasElement,
  spec: KindSpec,
  rand: () => number,
): HTMLCanvasElement {
  const { c, ctx } = clone(frame);
  const W = frame.width;
  const H = frame.height;
  const region = spec.collapse ?? [0.1, 0.05, 0.8, 0.35];
  const [rx, ry, rw, rh] = region;
  const cx = (rx + rw / 2) * W;
  const cy = (ry + rh / 2) * H;
  const holes = 4 + Math.floor(rand() * 3);
  for (let i = 0; i < holes; i++) {
    const px = cx + (rand() - 0.5) * rw * W * 0.8;
    const py = cy + (rand() - 0.5) * rh * H * 0.8;
    punchHole(ctx, px, py, W * (0.04 + rand() * 0.04), rand);
  }
  punchHole(ctx, cx, cy, W * 0.11, rand);
  ctx.globalCompositeOperation = 'source-atop';
  const washH = Math.round(H * 0.6);
  const grad = ctx.createLinearGradient(0, 0, 0, washH);
  grad.addColorStop(0, 'rgba(0,0,0,0.6)');
  grad.addColorStop(1, 'rgba(0,0,0,0.1)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, washH);
  ctx.globalCompositeOperation = 'source-over';
  return c;
}

/** V9: the vehicle was shot to pieces by autocannon and small-arms fire —
 *  dozens of small-calibre holes with soot halos, plus a few larger breaches. */
function riddled(
  frame: HTMLCanvasElement,
  spec: KindSpec,
  rand: () => number,
): HTMLCanvasElement {
  const { c, ctx } = clone(frame);
  const W = frame.width;
  const H = frame.height;
  const holes = 14 + Math.floor(rand() * 9);
  for (let i = 0; i < holes; i++) {
    const px = W * (0.08 + rand() * 0.84);
    const py = H * (0.2 + rand() * 0.6);
    const r = W * (0.012 + rand() * 0.015);
    ctx.fillStyle = 'rgba(8,7,6,0.4)';
    ctx.beginPath();
    ctx.arc(px, py, r * 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#050404';
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const big = 2 + Math.floor(rand() * 2);
  for (let i = 0; i < big; i++) {
    const px = W * (0.15 + rand() * 0.7);
    const py = H * (0.3 + rand() * 0.5);
    punchHole(ctx, px, py, W * (0.04 + rand() * 0.03), rand);
  }
  return c;
}

/** V10: a mobility kill — the tracks and running gear are destroyed, the
 *  hull sits intact but crippled on its belly with road wheels blown off. */
function mobilityKill(
  frame: HTMLCanvasElement,
  spec: KindSpec,
  rand: () => number,
): HTMLCanvasElement {
  const { c, ctx } = clone(frame);
  const W = frame.width;
  const H = frame.height;
  const bandY = Math.round(H * 0.78);
  ctx.fillStyle = '#070605';
  for (let x = 0; x < W; x += 4) {
    const h = 2 + Math.round(rand() * (H - bandY));
    ctx.fillRect(x, bandY + (H - bandY - h), 4, h);
  }
  for (let i = 0; i < 4; i++) {
    const wx = W * (0.12 + i * 0.25);
    const wy = H * 0.82;
    const wr = W * 0.045;
    ctx.fillStyle = '#1a1612';
    ctx.beginPath();
    ctx.arc(wx, wy, wr * 1.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#050404';
    ctx.beginPath();
    ctx.arc(wx, wy, wr, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 8; i++) {
    const dx = rand() * W;
    const dy = H * (0.88 + rand() * 0.1);
    const s = 2 + rand() * 4;
    ctx.save();
    ctx.translate(dx, dy);
    ctx.rotate(rand() * Math.PI * 2);
    ctx.fillStyle = rand() < 0.5 ? '#2a241e' : '#3a332a';
    ctx.fillRect(-s / 2, -s / 2, s, s * 0.6);
    ctx.restore();
  }
  return c;
}

/** V11: the vehicle is flipped onto its side or roof by a nearby detonation —
 *  the hulk lies capsized beside its original footprint with a scorch. */
function capsized(
  frame: HTMLCanvasElement,
  spec: KindSpec,
  rand: () => number,
): HTMLCanvasElement {
  const W = frame.width;
  const H = frame.height;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  // scorch where the vehicle originally sat
  ctx.fillStyle = 'rgba(10,8,6,0.5)';
  ctx.beginPath();
  ctx.ellipse(W * 0.5, H * 0.85, W * 0.4, H * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  // draw the vehicle flipped 75–105° onto its side
  const flip = rand() < 0.5 ? 1 : -1;
  const angle = flip * (Math.PI * (0.42 + rand() * 0.16));
  const scale = 0.82 + rand() * 0.1;
  ctx.save();
  ctx.translate(W * 0.5, H * 0.72);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  ctx.drawImage(frame, -W / 2, -H / 2);
  ctx.restore();
  // debris chunks scattered around the capsized hulk
  ctx.fillStyle = '#2a241e';
  for (let i = 0; i < 12; i++) {
    const x = W * (0.08 + rand() * 0.84);
    const y = H * (0.72 + rand() * 0.24);
    const s = 1 + rand() * 3;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rand() * Math.PI * 2);
    ctx.fillRect(-s / 2, -s / 2, s, s * 0.6);
    ctx.restore();
  }
  return c;
}

/** V12: an aircraft that crashed and broke apart — the fuselage and wings
 *  lie scattered along a crash line with a fuel-fire scorch trail. */
function aircraftCrashed(
  frame: HTMLCanvasElement,
  spec: KindSpec,
  rand: () => number,
): HTMLCanvasElement {
  const W = frame.width;
  const H = frame.height;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  // scorch trail along the crash path
  ctx.fillStyle = 'rgba(10,8,6,0.4)';
  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    ctx.beginPath();
    ctx.ellipse(
      W * (0.12 + t * 0.72),
      H * (0.88 - t * 0.35),
      W * (0.07 + rand() * 0.05),
      H * 0.08,
      -0.3,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  // break into 2–3 pieces and scatter them
  const pieces = 2 + Math.floor(rand() * 2);
  const regions: Rect[] =
    pieces === 2
      ? [
          [0, 0, 0.55, 1],
          [0.5, 0, 0.5, 1],
        ]
      : [
          [0, 0, 0.38, 1],
          [0.33, 0, 0.36, 1],
          [0.64, 0, 0.36, 1],
        ];
  for (const [rx, ry, rw, rh] of regions) {
    const sw = Math.max(4, Math.round(rw * W));
    const sh = Math.max(4, Math.round(rh * H));
    const sx = Math.round(rx * W);
    const sy = Math.round(ry * H);
    const part = document.createElement('canvas');
    part.width = sw;
    part.height = sh;
    const pctx = part.getContext('2d')!;
    pctx.imageSmoothingEnabled = false;
    pctx.drawImage(frame, sx, sy, sw, sh, 0, 0, sw, sh);
    const px = W * (0.12 + rand() * 0.68);
    const py = H * (0.45 + rand() * 0.42);
    const angle = (rand() - 0.5) * 2.4;
    const scale = 0.78 + rand() * 0.15;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angle);
    ctx.scale(scale, scale);
    ctx.drawImage(part, -sw / 2, -sh / 2);
    ctx.restore();
  }
  return c;
}

/** V13: a track or running-gear section is blown off — the hull lists toward
 *  the missing side and the track lies beside it in the dirt. */
function blownTrack(
  frame: HTMLCanvasElement,
  spec: KindSpec,
  rand: () => number,
): HTMLCanvasElement {
  const W = frame.width;
  const H = frame.height;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const bandY = Math.round(H * 0.7);
  const bandH = H - bandY;
  const left = rand() < 0.5;
  const trackW = Math.round(W * (0.28 + rand() * 0.18));
  const tx = left ? 0 : W - trackW;
  // extract the track section from the original frame
  const part = document.createElement('canvas');
  part.width = trackW;
  part.height = bandH;
  const pctx = part.getContext('2d')!;
  pctx.imageSmoothingEnabled = false;
  pctx.drawImage(frame, tx, bandY, trackW, bandH, 0, 0, trackW, bandH);
  // draw the hull tilted toward the missing side
  const tilt = (left ? -1 : 1) * (0.07 + rand() * 0.08);
  ctx.save();
  ctx.translate(W / 2, H * 0.88);
  ctx.rotate(tilt);
  ctx.drawImage(frame, -W / 2, -H * 0.88);
  ctx.restore();
  // dark gap where the track was torn from
  ctx.fillStyle = 'rgba(7,6,5,0.85)';
  ctx.beginPath();
  ctx.ellipse(
    W / 2 + (left ? -1 : 1) * W * 0.18,
    H * 0.9,
    trackW * 0.45,
    bandH * 0.35,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  // drop the track on the ground beside the hull
  const landX = left ? W * 0.86 : W * 0.14;
  const landY = H * 0.92;
  ctx.fillStyle = 'rgba(10,8,6,0.4)';
  ctx.beginPath();
  ctx.ellipse(landX, landY, trackW * 0.4, Math.max(2, bandH * 0.12), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(landX, landY);
  ctx.rotate((rand() - 0.5) * 1.4);
  ctx.drawImage(part, -trackW / 2, -bandH / 2);
  ctx.restore();
  return c;
}

/** V14: the turret is blown askew but still attached — rotated 30–75° off its
 *  normal axis, sitting crooked on the turret ring with scorch marks. */
function turretAskew(
  frame: HTMLCanvasElement,
  spec: KindSpec,
  rand: () => number,
): HTMLCanvasElement {
  const { c, ctx } = clone(frame);
  const W = frame.width;
  const H = frame.height;
  const region = spec.collapse ?? [0.15, 0.02, 0.7, 0.4];
  const [rx, ry, rw, rh] = region;
  const sx = Math.round(rx * W);
  const sy = Math.round(ry * H);
  const sw = Math.max(4, Math.round(rw * W));
  const sh = Math.max(4, Math.round(rh * H));
  // extract the turret / upper assembly
  const part = document.createElement('canvas');
  part.width = sw;
  part.height = sh;
  const pctx = part.getContext('2d')!;
  pctx.imageSmoothingEnabled = false;
  pctx.drawImage(frame, sx, sy, sw, sh, 0, 0, sw, sh);
  // black out the original turret position with jagged edges
  jaggedBlob(ctx, sx + sw / 2, sy + sh / 2, Math.max(sw, sh) * 0.55, rand, 12);
  ctx.fillStyle = '#0a0908';
  ctx.fill();
  // redraw the turret rotated off-axis, slightly offset
  const angle = (rand() < 0.5 ? 1 : -1) * (0.5 + rand() * 0.8);
  const ox = (rand() - 0.5) * sw * 0.3;
  const oy = sh * 0.12;
  ctx.save();
  ctx.translate(sx + sw / 2 + ox, sy + sh / 2 + oy);
  ctx.rotate(angle);
  ctx.drawImage(part, -sw / 2, -sh / 2);
  ctx.restore();
  // scorch at the turret ring
  ctx.fillStyle = 'rgba(8,6,4,0.45)';
  ctx.beginPath();
  ctx.ellipse(
    sx + sw / 2,
    sy + sh * 0.82,
    sw * 0.42,
    Math.max(2, sh * 0.1),
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  return c;
}

/** V15: breached hull that subsequently burned out — puncture holes through
 *  a charred, soot-streaked hulk. */
function hullBurnt(
  frame: HTMLCanvasElement,
  spec: KindSpec,
  rand: () => number,
): HTMLCanvasElement {
  return burnedOut(breached(frame, spec, rand), spec, rand);
}

/** V16: gutted and burned — the crushed upper structure is also charred
 *  with ember glow in the collapsed interior. */
function guttedBurn(
  frame: HTMLCanvasElement,
  spec: KindSpec,
  rand: () => number,
): HTMLCanvasElement {
  return burnedOut(gutted(frame, spec, rand), spec, rand);
}

/** V17: hull split by a catastrophic kill that also ignited the fuel —
 *  the torn halves are pulled apart and heavily charred. */
function splitBurnt(
  frame: HTMLCanvasElement,
  spec: KindSpec,
  rand: () => number,
): HTMLCanvasElement {
  return burnedOut(splitHull(frame, spec, rand), spec, rand);
}

/** V18: shot to pieces and then scorched by a secondary fire — dozens of
 *  small-calibre holes under a patchy burn wash. */
function riddledBurnt(
  frame: HTMLCanvasElement,
  spec: KindSpec,
  rand: () => number,
): HTMLCanvasElement {
  return scorched(riddled(frame, spec, rand), spec, rand);
}

/** Kinds that are aircraft — they use crash-site states instead of
 *  track/turret damage which only applies to ground vehicles. */
const AIRCRAFT: ReadonlySet<WreckKind> = new Set([
  'scout_drone',
  'fpv_drone',
  'helicopter',
  'rocket_heli',
  'medevac',
  'attack_drone',
  'loiter_drone',
  'interceptor',
  'strike_jet',
  'bomber',
]);

/** Kinds with a distinct turret / upper assembly that can be blown askew. */
const TURRETED: ReadonlySet<WreckKind> = new Set([
  'light_tank',
  'tank',
  'heavy_tank',
  'ifv',
  'tow_ifv',
  'sam_vehicle',
  'recovery_vehicle',
  'command_vehicle',
]);

/**
 * Structural damage states per wreck kind, baked once at load and grouped
 * by what killed the vehicle:
 *   blast  — as-is, assembly torn off, hull split, turret blown off, ammo
 *            cook-off, capsized, track blown off, turret askew, split & burnt
 *   bullet — as-is, hull breached, riddled with holes, mobility kill, surface
 *            scorched, track blown off, riddled & burnt
 *   burn   — as-is, burned out, crushed & gutted, hull burnt, gutted & burnt
 * Renderers pick a stable variant per wreck id within the cause family, so
 * same-card wrecks differ structurally and the damage matches the kill.
 */
export function wreckVariants(
  frames: Record<WreckKind, HTMLCanvasElement>,
): Record<
  WreckKind,
  Record<'blast' | 'bullet' | 'burn', HTMLCanvasElement[]>
> {
  return Object.fromEntries(
    (Object.keys(WRECKS) as WreckKind[]).map((kind) => {
      const frame = frames[kind];
      // The glider has individually painted destruction states in its own atlas.
      if(kind==='glider_transport')return [kind,{blast:[frame],bullet:[frame],burn:[frame]}];
      const spec = SPECS[kind] ?? {};
      const seed = hash(kind);
      const isAircraft = AIRCRAFT.has(kind);
      const isTurreted = TURRETED.has(kind);
      const blast: HTMLCanvasElement[] = [
        frame,
        blownApart(frame, spec, rng(seed ^ 0x9e3779b9)),
        splitHull(frame, spec, rng(seed ^ 0x165667b1)),
        ammoCookOff(frame, spec, rng(seed ^ 0xd1b54a32)),
        capsized(frame, spec, rng(seed ^ 0x27d4eb2f)),
        splitBurnt(frame, spec, rng(seed ^ 0x165667b2)),
      ];
      if (isAircraft) {
        blast.push(aircraftCrashed(frame, spec, rng(seed ^ 0x8a7cd194)));
      } else {
        blast.push(
          turretBlast(frame, spec, rng(seed ^ 0x8a7cd194)),
          blownTrack(frame, spec, rng(seed ^ 0x5851f42d)),
        );
        if (isTurreted) {
          blast.push(turretAskew(frame, spec, rng(seed ^ 0x41c6ce57)));
        }
      }
      const bullet: HTMLCanvasElement[] = [
        frame,
        breached(frame, spec, rng(seed ^ 0x85ebca6b)),
        riddled(frame, spec, rng(seed ^ 0x5851f42d)),
        scorched(frame, spec, rng(seed ^ 0x3e268931)),
        riddledBurnt(frame, spec, rng(seed ^ 0x27d4eb2e)),
      ];
      if (!isAircraft) {
        bullet.push(
          mobilityKill(frame, spec, rng(seed ^ 0x41c6ce57)),
          blownTrack(frame, spec, rng(seed ^ 0x85ebca6c)),
        );
      }
      return [
        kind,
        {
          blast,
          bullet,
          burn: [
            frame,
            burnedOut(frame, spec, rng(seed ^ 0x27d4eb2f)),
            gutted(frame, spec, rng(seed ^ 0xc2b2ae35)),
            hullBurnt(frame, spec, rng(seed ^ 0x9e3779ba)),
            guttedBurn(frame, spec, rng(seed ^ 0x165667b2)),
          ],
        },
      ];
    }),
  ) as Record<
    WreckKind,
    Record<'blast' | 'bullet' | 'burn', HTMLCanvasElement[]>
  >;
}
