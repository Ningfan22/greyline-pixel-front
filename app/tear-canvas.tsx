'use client';
/* 卡包撕开动画：纯 Canvas 像素风，透明背景，无手部出镜。点击可跳过。 */
import { useEffect, useRef } from 'react';

const W = 160;
const H = 224;
// The fan rises above the bag and the torn strip swings past its sides.
// The canvas itself must include that space; CSS overflow cannot restore it.
const PAD_X = 32;
const PAD_TOP = 48;
const CANVAS_W = W + PAD_X * 2;
const CANVAS_H = H + PAD_TOP + 16;
const TEAR_BASE = 44;
const PIVOT_X = W - 4;
const CARD_W = 30;
const CARD_H = 44;

const DURATION = { enter: 0.45, tear: 1.15, cards: 0.95, hold: 0.3 };

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeOutCubic = (p: number) => 1 - Math.pow(1 - p, 3);
const easeInOutCubic = (p: number) =>
  p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 确定性锯齿撕裂线高度。 */
function tearY(x: number) {
  const block = Math.floor(x / 5);
  const h = Math.sin(block * 12.9898) * 43758.5453;
  const jitter = (h - Math.floor(h)) * 2 - 1;
  return TEAR_BASE + jitter * 4 + (x / W) * 5;
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** 军绿做旧箔袋（沿用原画语言：锯齿压边、铜星、模板字、污渍）。 */
function paintBag(ctx: CanvasRenderingContext2D) {
  const rnd = mulberry32(20260918);
  ctx.fillStyle = '#5b6447';
  ctx.fillRect(0, 0, W, H);
  // 边缘暗角
  ctx.fillStyle = 'rgba(20,26,16,0.35)';
  ctx.fillRect(0, 0, 6, H);
  ctx.fillRect(W - 6, 0, 6, H);
  ctx.fillStyle = 'rgba(214,220,186,0.10)';
  ctx.fillRect(8, 0, 3, H);
  // 顶部锯齿压边
  ctx.fillStyle = '#454d36';
  for (let x = 0; x < W; x += 8) {
    ctx.fillRect(x, 0, 8, 4);
    ctx.fillRect(x + 4, 4, 4, 3);
  }
  // 底部压边
  ctx.fillStyle = '#454d36';
  ctx.fillRect(0, H - 12, W, 12);
  ctx.fillStyle = '#39402c';
  for (let x = 0; x < W; x += 8) ctx.fillRect(x, H - 12, 8, 3);
  // 做旧污渍
  for (let i = 0; i < 26; i += 1) {
    const x = Math.floor(rnd() * (W - 16)) + 8;
    const y = Math.floor(rnd() * (H - 40)) + 18;
    const r = 2 + Math.floor(rnd() * 5);
    ctx.fillStyle = `rgba(30,34,22,${0.08 + rnd() * 0.12})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // 磨损亮斑
  for (let i = 0; i < 14; i += 1) {
    const x = Math.floor(rnd() * (W - 14)) + 7;
    const y = Math.floor(rnd() * (H - 30)) + 16;
    ctx.fillStyle = `rgba(210,214,180,${0.05 + rnd() * 0.08})`;
    ctx.fillRect(x, y, 2 + Math.floor(rnd() * 4), 1 + Math.floor(rnd() * 3));
  }
  // GREYLINE 模板字
  ctx.fillStyle = '#d8cfae';
  ctx.font = 'bold 15px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('GREYLINE', W / 2, 66);
  // 铜星徽章
  ctx.strokeStyle = '#8a7a4a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(W / 2, 112, 21, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#b08d4f';
  drawStar(ctx, W / 2, 112, 15, 6.5);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,240,200,0.30)';
  drawStar(ctx, W / 2 - 2, 110, 12, 5);
  ctx.fill();
  // FIELD PACK
  ctx.fillStyle = '#c8c09a';
  ctx.font = 'bold 9px monospace';
  ctx.fillText('FIELD PACK', W / 2, 152);
  // 编号
  ctx.fillStyle = '#9aa07c';
  ctx.font = '7px monospace';
  ctx.textAlign = 'right';
  ctx.fillText('Nº 718104-7', W - 10, H - 20);
  ctx.textAlign = 'left';
  ctx.fillText('SUPPLY', 10, H - 20);
}

/** 像素卡背（军绿 + 星 + 双V）。 */
function paintCardBack(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#4a5238';
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.strokeStyle = '#8a7a4a';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, CARD_W - 2, CARD_H - 2);
  ctx.fillStyle = '#b08d4f';
  drawStar(ctx, CARD_W / 2, 15, 8, 3.5);
  ctx.fill();
  ctx.strokeStyle = '#b08d4f';
  ctx.lineWidth = 2.5;
  for (const cy of [26, 32]) {
    ctx.beginPath();
    ctx.moveTo(CARD_W / 2 - 7, cy);
    ctx.lineTo(CARD_W / 2, cy + 4);
    ctx.lineTo(CARD_W / 2 + 7, cy);
    ctx.stroke();
  }
}

export default function TearCanvas({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  const rafRef = useRef(0);
  onDoneRef.current = onDone;
  const finish = () => {
    if (!doneRef.current) {
      doneRef.current = true;
      cancelAnimationFrame(rafRef.current);
      onDoneRef.current();
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) { finish(); return; }
    const ctx = canvas.getContext('2d');
    if (!ctx) { finish(); return; }
    ctx.imageSmoothingEnabled = false;

    const reduced =
      typeof window !== 'undefined' &&
      Boolean(
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
      );
    if (reduced) { finish(); return; }

    // 预渲染袋身与卡背
    const bag = document.createElement('canvas');
    bag.width = W;
    bag.height = H;
    paintBag(bag.getContext('2d')!);
    const cardBack = document.createElement('canvas');
    cardBack.width = CARD_W;
    cardBack.height = CARD_H;
    paintCardBack(cardBack.getContext('2d')!);

    // 扇形落位：x 偏移、角度、弧高（中间最高）
    const fan = [
      { x: -34, r: -30, d: 0 },
      { x: -17, r: -15, d: 1 },
      { x: 0, r: 0, d: 2 },
      { x: 17, r: 15, d: 1 },
      { x: 34, r: 30, d: 0 },
    ];

    const start = performance.now();

    const frame = (now: number) => {
      if (doneRef.current) return;
      const t = (now - start) / 1000;
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

      // 入场：弹入 + 轻微浮动
      const enterP = clamp01(t / DURATION.enter);
      const pop = Math.sin(Math.PI * enterP);
      const scale = 0.7 + 0.3 * easeOutCubic(enterP) * (1 + 0.06 * pop);
      const bobY = Math.sin(t * 2.2) * 1.2;

      ctx.save();
      ctx.translate(PAD_X, PAD_TOP);
      ctx.translate(W / 2, H / 2 + bobY);
      ctx.scale(scale, scale);
      ctx.translate(-W / 2, -H / 2);

      // 撕裂进度（带轻微顿挫）
      const tearRaw = clamp01((t - DURATION.enter) / DURATION.tear);
      const tearE = easeInOutCubic(tearRaw);
      const stickSlip =
        tearRaw > 0 && tearRaw < 1 ? 0.02 * Math.sin(tearRaw * 46) : 0;
      const tearTip = Math.min(W, tearE * W + stickSlip * W * 0.15);
      const flapRot = -1.35 * easeOutCubic(tearRaw);
      const flapLift = -10 * easeOutCubic(tearRaw);

      // 卡片滑出（中间先出）
      const cardStart = DURATION.enter + DURATION.tear;
      const cardP = clamp01((t - cardStart) / DURATION.cards);
      for (let i = 0; i < 5; i += 1) {
        const local = clamp01((cardP - Math.abs(i - 2) * 0.08) / 0.55);
        if (local <= 0) continue;
        const e = easeOutCubic(local);
        const f = fan[i];
        const cx = W / 2 + f.x;
        const cy = TEAR_BASE + 46 - e * (78 - f.d * 6);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((f.r * e * Math.PI) / 180);
        ctx.drawImage(cardBack, -CARD_W / 2, -CARD_H / 2);
        ctx.restore();
      }

      // 袋身：撕裂线以下保留
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(Math.max(tearTip, 0), 0);
      ctx.lineTo(W, 0);
      ctx.lineTo(W, H);
      ctx.lineTo(0, H);
      ctx.lineTo(0, tearY(0));
      for (let x = 0; x <= tearTip; x += 2) ctx.lineTo(x, tearY(x));
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(bag, 0, 0);
      ctx.restore();

      // 撕裂口：袋内阴影 + 银色箔边
      if (tearTip > 1) {
        ctx.fillStyle = '#1d2118';
        ctx.beginPath();
        ctx.moveTo(0, tearY(0));
        for (let x = 0; x <= tearTip; x += 2) ctx.lineTo(x, tearY(x));
        for (let x = tearTip; x >= 0; x -= 2) ctx.lineTo(x, tearY(x) + 4);
        ctx.closePath();
        ctx.fill();
        for (let x = 0; x <= tearTip; x += 1) {
          const y = Math.round(tearY(x));
          const block = Math.floor(x / 3);
          const sparkle = Math.sin(block * 7.13) * 43758.5453;
          ctx.fillStyle = sparkle - Math.floor(sparkle) > 0.7 ? '#eef0e6' : '#c6cabe';
          ctx.fillRect(x, y, 1, 2);
        }
      }

      // 撕下的顶条：绕右缘向后翻转
      if (tearTip > 1) {
        ctx.save();
        ctx.translate(PIVOT_X, TEAR_BASE + flapLift);
        ctx.rotate(flapRot);
        ctx.translate(-PIVOT_X, -TEAR_BASE);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(tearTip, 0);
        ctx.lineTo(tearTip, tearY(tearTip));
        for (let x = tearTip; x >= 0; x -= 2) ctx.lineTo(x, tearY(x) + 1);
        ctx.lineTo(0, tearY(0) + 1);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(bag, 0, 0);
        ctx.restore();
      }

      // 撕裂尖端碎屑
      if (tearRaw > 0 && tearRaw < 1) {
        const px = tearTip;
        const py = tearY(tearTip);
        for (let i = 0; i < 6; i += 1) {
          const seed = i * 13.7;
          const life = (tearRaw * 97 + seed) % 1;
          const spread = Math.sin(seed) * 43758.5453;
          const dx = (spread - Math.floor(spread)) * 14 * life;
          const dy = -6 * life - 4 * life * life;
          ctx.fillStyle = i % 2 ? '#c6cabe' : '#8a8f7e';
          ctx.fillRect(Math.round(px + dx), Math.round(py + dy), 2, 2);
        }
      }

      ctx.restore();

      const total =
        DURATION.enter + DURATION.tear + DURATION.cards + DURATION.hold;
      if (t >= total) {
        finish();
        return;
      }
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <button type="button" className="tear-player" onClick={finish} aria-label="跳过开包动画">
    <canvas
      ref={canvasRef}
      width={CANVAS_W}
      height={CANVAS_H}
      className="tear-canvas"
      aria-hidden="true"
    />
    </button>
  );
}
