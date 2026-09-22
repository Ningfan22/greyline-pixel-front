/**
 * Shared card detail dialog: shows a large card face plus name, tag,
 * description, stats, and flavor text. Used by the deck builder and shop.
 */

import { Widget, Button } from './framework';
import { COLORS, drawPanel } from './theme';
import { drawCardFace, cardStats } from './card-render';
import { CARDS, type CardId } from '@/game/engine';
import { CARD_COPY } from '@/game/card-copy';

export class CardDetailDialog extends Widget {
  private cardId: CardId;

  constructor(id: CardId, onClose: () => void) {
    super();
    this.cardId = id;
    this.w = 340;
    this.h = 210;

    const close = new Button('关闭', 80, 28);
    close.x = this.w - 80 - 10;
    close.y = this.h - 28 - 10;
    close.onTap = onClose;
    this.addChild(close);
  }

  protected drawSelf(ctx: CanvasRenderingContext2D): void {
    drawPanel(ctx, 0, 0, this.w, this.h, COLORS.bgPanel, COLORS.border, 6);
    const id = this.cardId;
    const c = CARDS[id];
    const faceW = 92;
    drawCardFace(ctx, id, 12, 12, faceW);

    let x = faceW + 26;
    let y = 14;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = `bold 14px -apple-system, "PingFang SC", sans-serif`;
    ctx.fillStyle = COLORS.text;
    ctx.fillText(c.name, x, y);
    y += 20;
    ctx.font = `11px -apple-system, "PingFang SC", sans-serif`;
    ctx.fillStyle = COLORS.accent;
    ctx.fillText(c.tag, x, y);
    y += 18;
    ctx.fillStyle = COLORS.textDim;
    const desc = c.description;
    this.wrap(ctx, desc, x, y, this.w - x - 12, 14);
    y += this.wrapHeight(desc, this.w - x - 12, 14) + 6;

    const stats = cardStats(id);
    ctx.font = `11px -apple-system, "PingFang SC", sans-serif`;
    for (const [k, v] of stats) {
      ctx.fillStyle = COLORS.textMuted;
      ctx.fillText(k, x, y);
      ctx.fillStyle = COLORS.text;
      ctx.fillText(v, x + 64, y);
      y += 15;
    }
    const flavor = CARD_COPY[id]?.flavor;
    if (flavor && y < this.h - 40) {
      ctx.fillStyle = COLORS.textMuted;
      this.wrap(ctx, flavor, x, y, this.w - x - 12, 13);
    }
  }

  private wrap(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxW: number,
    lh: number,
  ): void {
    let line = '';
    let cy = y;
    for (const ch of text) {
      if (ctx.measureText(line + ch).width > maxW && line) {
        ctx.fillText(line, x, cy);
        cy += lh;
        line = ch;
      } else {
        line += ch;
      }
    }
    if (line) ctx.fillText(line, x, cy);
  }

  private wrapHeight(text: string, maxW: number, lh: number): number {
    const cw = 11;
    const charsPerLine = Math.max(4, Math.floor(maxW / cw));
    return Math.ceil(text.length / charsPerLine) * lh;
  }
}
