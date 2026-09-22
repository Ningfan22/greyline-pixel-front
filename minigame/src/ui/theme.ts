/** Theme constants shared by all Canvas UI pages. */

export const COLORS = {
  bg: '#1a1f1a',
  bgPanel: '#232b23',
  bgPanelLight: '#2d3a2d',
  bgCard: '#2a332a',
  border: '#4a5a4a',
  borderLight: '#6a7a6a',
  text: '#e8e0d0',
  textDim: '#9a9a8a',
  textMuted: '#6a6a5a',
  accent: '#d4a843',
  accentDark: '#8a6a20',
  green: '#5a8a4a',
  greenLight: '#7aaa5a',
  red: '#b5453a',
  redLight: '#d4655a',
  blue: '#4a7ab5',
  blueLight: '#6a9ad4',
  gold: '#d4a843',
  hp: '#c44a3a',
  hpBg: '#3a2020',
  energy: '#d4a843',
  energyBg: '#3a3020',
  overlay: 'rgba(10, 12, 10, 0.85)',
  scrim: 'rgba(10, 12, 10, 0.6)',
} as const;

export const FONT = {
  pixel: 'fusion-pixel',
  fallback: 'monospace',
} as const;

export const LAYOUT = {
  /** Standard margin from screen edge. */
  margin: 8,
  /** Standard widget gap. */
  gap: 6,
  /** Button height. */
  btnH: 36,
  /** Small button height. */
  btnSmH: 28,
  /** Panel corner radius. */
  radius: 4,
  /** Top bar height. */
  topBarH: 40,
  /** Bottom bar height. */
  bottomBarH: 120,
} as const;

export function font(size: number, weight: 'normal' | 'bold' = 'normal'): string {
  return `${weight === 'bold' ? 'bold ' : ''}${size}px "${FONT.pixel}", ${FONT.fallback}`;
}

/** Measure text width using the pixel font. */
export function measureText(
  ctx: CanvasRenderingContext2D,
  text: string,
  size: number,
  weight: 'normal' | 'bold' = 'normal',
): number {
  ctx.font = font(size, weight);
  return ctx.measureText(text).width;
}

/** Draw text centered horizontally at (cx, y). */
export function drawTextCentered(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  size: number,
  color: string = COLORS.text,
  weight: 'normal' | 'bold' = 'normal',
): void {
  ctx.font = font(size, weight);
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, y);
}

/** Draw text left-aligned at (x, y). */
export function drawTextLeft(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string = COLORS.text,
  weight: 'normal' | 'bold' = 'normal',
): void {
  ctx.font = font(size, weight);
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

/** Draw text right-aligned at (x, y). */
export function drawTextRight(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string = COLORS.text,
  weight: 'normal' | 'bold' = 'normal',
): void {
  ctx.font = font(size, weight);
  ctx.fillStyle = color;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

/** Draw a rounded rectangle path. */
export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

/** Draw a filled panel with border. */
export function drawPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string = COLORS.bgPanel,
  border: string = COLORS.border,
  radius: number = LAYOUT.radius,
): void {
  roundRect(ctx, x, y, w, h, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  ctx.stroke();
}

/** Draw a progress bar. */
export function drawBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  pct: number,
  fillColor: string,
  bgColor: string = COLORS.hpBg,
): void {
  ctx.fillStyle = bgColor;
  ctx.fillRect(x, y, w, h);
  const fw = Math.max(0, Math.min(1, pct)) * w;
  if (fw > 0) {
    ctx.fillStyle = fillColor;
    ctx.fillRect(x, y, fw, h);
  }
  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

/** Clamp a value. */
export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Linear interpolate. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Wrap text to fit a width. Returns lines. Handles CJK character-by-character
 * and Latin word-by-word wrapping.
 */
export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  size: number,
  weight: 'normal' | 'bold' = 'normal',
): string[] {
  ctx.font = font(size, weight);
  const lines: string[] = [];
  const paragraphs = text.split('\n');
  for (const para of paragraphs) {
    let line = '';
    let i = 0;
    while (i < para.length) {
      const ch = para[i];
      // Latin word: grab until whitespace
      if (/[ -~]/.test(ch) && ch !== ' ') {
        let j = i;
        while (j < para.length && /[^\s一-鿿　-〿＀-￯]/.test(para[j])) j++;
        const word = para.slice(i, j);
        const test = line ? line + word : word;
        if (ctx.measureText(test).width > maxWidth && line) {
          lines.push(line);
          line = word;
        } else {
          line = test;
        }
        i = j;
      } else {
        const test = line + ch;
        if (ctx.measureText(test).width > maxWidth && line) {
          lines.push(line);
          line = ch === ' ' ? '' : ch;
        } else {
          line = test;
        }
        i++;
      }
    }
    lines.push(line);
  }
  return lines;
}

/**
 * Draw wrapped text starting at (x, y). Returns the y position after the
 * last line.
 */
export function drawWrapped(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  size: number,
  color: string = COLORS.text,
  weight: 'normal' | 'bold' = 'normal',
  lineHeight: number = size * 1.5,
): number {
  const lines = wrapText(ctx, text, maxWidth, size, weight);
  ctx.font = font(size, weight);
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  let cy = y;
  for (const line of lines) {
    ctx.fillText(line, x, cy);
    cy += lineHeight;
  }
  return cy;
}
