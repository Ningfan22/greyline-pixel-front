/**
 * Canvas UI framework: a lightweight widget system for the mini-game.
 * Handles touch routing, rendering, and layout without any DOM.
 */

import { COLORS, LAYOUT, drawPanel, drawTextCentered, drawTextLeft, font, roundRect } from './theme';

// ── Touch event ──────────────────────────────────────────────────────────────

export interface TouchPoint {
  id: number;
  x: number;
  y: number;
}

export interface TouchEvent {
  type: 'down' | 'move' | 'up';
  points: TouchPoint[];
  changed: TouchPoint[];
}

// ── Base Widget ──────────────────────────────────────────────────────────────

export abstract class Widget {
  x = 0;
  y = 0;
  w = 0;
  h = 0;
  visible = true;
  enabled = true;
  parent: Widget | null = null;
  children: Widget[] = [];
  tag: string = '';

  addChild<T extends Widget>(child: T): T {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  removeChild(child: Widget): void {
    const i = this.children.indexOf(child);
    if (i >= 0) {
      this.children.splice(i, 1);
      child.parent = null;
    }
  }

  clearChildren(): void {
    for (const c of this.children) c.parent = null;
    this.children.length = 0;
  }

  /** Absolute X on screen. */
  get absX(): number {
    return this.parent ? this.parent.absX + this.x : this.x;
  }

  /** Absolute Y on screen. */
  get absY(): number {
    return this.parent ? this.parent.absY + this.y : this.y;
  }

  contains(px: number, py: number): boolean {
    const ax = this.absX;
    const ay = this.absY;
    return px >= ax && px <= ax + this.w && py >= ay && py <= ay + this.h;
  }

 /** Find the topmost widget at a point (visible + enabled). */
  hitTest(px: number, py: number): Widget | null {
    if (!this.visible || !this.enabled) return null;
    // Check children in reverse order (topmost first)
    for (let i = this.children.length - 1; i >= 0; i--) {
      const hit = this.children[i].hitTest(px, py);
      if (hit) return hit;
    }
    return this.contains(px, py) ? this : null;
  }

  /** Draw this widget and all children. */
  draw(ctx: CanvasRenderingContext2D): void {
    if (!this.visible) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    this.drawSelf(ctx);
    for (const c of this.children) c.draw(ctx);
    ctx.restore();
  }

  /** Subclass draws itself here (coordinates are local). */
  protected abstract drawSelf(ctx: CanvasRenderingContext2D): void;

  /** Called when a touch down lands on this widget. Return true to claim the touch. */
  onTouchDown(_x: number, _y: number): boolean {
    return false;
  }

  /** Called when a claimed touch moves. */
  onTouchMove(_x: number, _y: number): void {}

  /** Called when a claimed touch is released. */
  onTouchUp(_x: number, _y: number): void {}

  /** Called when a claimed touch is cancelled. */
  onTouchCancel(): void {}
}

// ── Button ───────────────────────────────────────────────────────────────────

/** A concrete transparent container for grouping child widgets (e.g. dialog bodies). */
export class Container extends Widget {
  protected drawSelf(_ctx: CanvasRenderingContext2D): void {}
}

export interface ButtonStyle {
  bg: string;
  bgHover: string;
  bgPressed: string;
  border: string;
  textColor: string;
  fontSize: number;
  bold: boolean;
  radius: number;
}

export const DEFAULT_BUTTON_STYLE: ButtonStyle = {
  bg: COLORS.bgPanelLight,
  bgHover: '#3a4a3a',
  bgPressed: '#1a2a1a',
  border: COLORS.border,
  textColor: COLORS.text,
  fontSize: 13,
  bold: false,
  radius: LAYOUT.radius,
};

export class Button extends Widget {
  label: string;
  onTap: (() => void) | null = null;
  style: ButtonStyle;
  pressed = false;
  disabled = false;
  icon: ((ctx: CanvasRenderingContext2D, w: number, h: number) => void) | null = null;

  constructor(
    label: string,
    w: number,
    h: number,
    style?: Partial<ButtonStyle>,
  ) {
    super();
    this.label = label;
    this.w = w;
    this.h = h;
    this.style = { ...DEFAULT_BUTTON_STYLE, ...style };
  }

  protected drawSelf(ctx: CanvasRenderingContext2D): void {
    const s = this.style;
    const bg = this.disabled ? COLORS.bgPanel : (this.pressed ? s.bgPressed : s.bg);
    roundRect(ctx, 0, 0, this.w, this.h, s.radius);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.strokeStyle = s.border;
    ctx.lineWidth = 1;
    ctx.stroke();

    if (this.disabled) {
      ctx.globalAlpha = 0.45;
    }
    if (this.icon) {
      this.icon(ctx, this.w, this.h);
    }
    if (this.label) {
      drawTextCentered(ctx, this.label, this.w / 2, this.h / 2, s.fontSize, s.textColor, s.bold ? 'bold' : 'normal');
    }
    ctx.globalAlpha = 1;
  }

  onTouchDown(): boolean {
    if (this.disabled) return false;
    this.pressed = true;
    return true;
  }

  onTouchUp(): void {
    if (this.disabled) return;
    if (this.pressed) {
      this.pressed = false;
      this.onTap?.();
    }
  }

  onTouchCancel(): void {
    this.pressed = false;
  }
}

// ── Label ────────────────────────────────────────────────────────────────────

export class Label extends Widget {
  text: string;
  fontSize: number;
  color: string;
  bold: boolean;
  align: 'left' | 'center' | 'right';

  constructor(
    text: string,
    fontSize: number = 12,
    color: string = COLORS.text,
    align: 'left' | 'center' | 'right' = 'left',
    bold: boolean = false,
  ) {
    super();
    this.text = text;
    this.fontSize = fontSize;
    this.color = color;
    this.align = align;
    this.bold = bold;
    this.h = fontSize + 4;
  }

  protected drawSelf(ctx: CanvasRenderingContext2D): void {
    ctx.font = font(this.fontSize, this.bold ? 'bold' : 'normal');
    ctx.fillStyle = this.color;
    ctx.textBaseline = 'middle';
    if (this.align === 'center') {
      ctx.textAlign = 'center';
      ctx.fillText(this.text, this.w / 2, this.h / 2);
    } else if (this.align === 'right') {
      ctx.textAlign = 'right';
      ctx.fillText(this.text, this.w, this.h / 2);
    } else {
      ctx.textAlign = 'left';
      ctx.fillText(this.text, 0, this.h / 2);
    }
  }
}

// ── Panel ────────────────────────────────────────────────────────────────────

export class Panel extends Widget {
  fill: string;
  border: string;
  radius: number;

  constructor(
    w: number,
    h: number,
    fill: string = COLORS.bgPanel,
    border: string = COLORS.border,
    radius: number = LAYOUT.radius,
  ) {
    super();
    this.w = w;
    this.h = h;
    this.fill = fill;
    this.border = border;
    this.radius = radius;
  }

  protected drawSelf(ctx: CanvasRenderingContext2D): void {
    drawPanel(ctx, 0, 0, this.w, this.h, this.fill, this.border, this.radius);
  }
}

// ── Image Widget ─────────────────────────────────────────────────────────────

export class ImageWidget extends Widget {
  image: HTMLImageElement | HTMLCanvasElement | null = null;
  stretch = true;

  constructor(w: number, h: number) {
    super();
    this.w = w;
    this.h = h;
  }

  protected drawSelf(ctx: CanvasRenderingContext2D): void {
    if (!this.image) return;
    if (this.stretch) {
      ctx.drawImage(this.image, 0, 0, this.w, this.h);
    } else {
      ctx.drawImage(this.image, 0, 0);
    }
  }
}

// ── Slider ───────────────────────────────────────────────────────────────────

export class Slider extends Widget {
  value: number; // 0..1
  onChange: ((v: number) => void) | null = null;
  barColor: string;
  knobColor: string;
  private dragging = false;

  constructor(w: number, h: number, value: number = 0.5) {
    super();
    this.w = w;
    this.h = h;
    this.value = value;
    this.barColor = COLORS.accent;
    this.knobColor = COLORS.text;
  }

  protected drawSelf(ctx: CanvasRenderingContext2D): void {
    const cy = this.h / 2;
    const barH = 4;
    // Track
    ctx.fillStyle = COLORS.bgPanelLight;
    ctx.fillRect(0, cy - barH / 2, this.w, barH);
    // Fill
    ctx.fillStyle = this.barColor;
    ctx.fillRect(0, cy - barH / 2, this.w * this.value, barH);
    // Knob
    const kx = this.w * this.value;
    ctx.fillStyle = this.knobColor;
    ctx.beginPath();
    ctx.arc(kx, cy, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  onTouchDown(x: number): boolean {
    this.dragging = true;
    this.value = Math.max(0, Math.min(1, x / this.w));
    this.onChange?.(this.value);
    return true;
  }

  onTouchMove(x: number): void {
    if (this.dragging) {
      this.value = Math.max(0, Math.min(1, x / this.w));
      this.onChange?.(this.value);
    }
  }

  onTouchUp(): void {
    this.dragging = false;
  }

  onTouchCancel(): void {
    this.dragging = false;
  }
}

// ── Toggle ───────────────────────────────────────────────────────────────────

export class Toggle extends Widget {
  on: boolean;
  onChange: ((v: boolean) => void) | null = null;

  constructor(w: number = 44, h: number = 22, on: boolean = false) {
    super();
    this.w = w;
    this.h = h;
    this.on = on;
  }

  protected drawSelf(ctx: CanvasRenderingContext2D): void {
    const r = this.h / 2;
    roundRect(ctx, 0, 0, this.w, this.h, r);
    ctx.fillStyle = this.on ? COLORS.green : COLORS.bgPanelLight;
    ctx.fill();
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 1;
    ctx.stroke();
    // Knob
    const kx = this.on ? this.w - r : r;
    ctx.fillStyle = COLORS.text;
    ctx.beginPath();
    ctx.arc(kx, r, r - 3, 0, Math.PI * 2);
    ctx.fill();
  }

  onTouchDown(): boolean {
    this.on = !this.on;
    this.onChange?.(this.on);
    return true;
  }
}

// ── Scroll List ──────────────────────────────────────────────────────────────

export class ScrollList extends Widget {
  items: Widget[] = [];
  itemHeight: number;
  scrollY = 0;
  /** Fired when an item is tapped (not dragged). */
  onItemTap: ((index: number) => void) | null = null;
  /** Fired when an item is long-pressed (450ms without moving). */
  onItemLongPress: ((index: number) => void) | null = null;
  private maxScroll = 0;
  private dragStartY = 0;
  private dragStartScroll = 0;
  private dragging = false;
  private moved = false;
  private downX = 0;
  private downY = 0;
  private lastTouchY = 0;
  private lastTouchTime = 0;
  private velocity = 0;
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private longPressFired = false;

  constructor(w: number, h: number, itemHeight: number) {
    super();
    this.w = w;
    this.h = h;
    this.itemHeight = itemHeight;
  }

  setItems(items: Widget[]): void {
    this.items = items;
    for (const item of items) {
      item.parent = this;
    }
    this.maxScroll = Math.max(0, items.length * this.itemHeight - this.h);
    this.scrollY = Math.min(this.scrollY, this.maxScroll);
    this.layoutItems();
  }

  /** Items are drawn inside drawSelf with clipping, so skip the children loop. */
  draw(ctx: CanvasRenderingContext2D): void {
    if (!this.visible) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    this.drawSelf(ctx);
    ctx.restore();
  }

  /** The list claims all touches inside its bounds; items are not hit-tested. */
  hitTest(px: number, py: number): Widget | null {
    if (!this.visible || !this.enabled) return null;
    return this.contains(px, py) ? this : null;
  }

  private layoutItems(): void {
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      item.x = 0;
      item.y = i * this.itemHeight - this.scrollY;
      item.w = this.w;
      item.h = this.itemHeight;
    }
  }

  scrollTo(y: number): void {
    this.scrollY = Math.max(0, Math.min(this.maxScroll, y));
    this.layoutItems();
  }

  protected drawSelf(ctx: CanvasRenderingContext2D): void {
    // Clip to list bounds
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, this.w, this.h);
    ctx.clip();
    for (const item of this.items) {
      if (item.y + item.h < 0 || item.y > this.h) continue;
      item.draw(ctx);
    }
    ctx.restore();

    // Scrollbar
    if (this.maxScroll > 0) {
      const barH = Math.max(20, (this.h / (this.maxScroll + this.h)) * this.h);
      const barY = (this.scrollY / this.maxScroll) * (this.h - barH);
      ctx.fillStyle = COLORS.border;
      ctx.fillRect(this.w - 3, barY, 2, barH);
    }
  }

  private itemAt(localY: number): number {
    const y = localY + this.scrollY;
    const idx = Math.floor(y / this.itemHeight);
    if (idx < 0 || idx >= this.items.length) return -1;
    const itemTop = idx * this.itemHeight - this.scrollY;
    if (itemTop + this.itemHeight < 0 || itemTop > this.h) return -1;
    return idx;
  }

  private clearLongPress(): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  onTouchDown(_x: number, y: number): boolean {
    this.dragging = true;
    this.moved = false;
    this.longPressFired = false;
    this.downX = _x;
    this.downY = y;
    this.dragStartY = y;
    this.dragStartScroll = this.scrollY;
    this.lastTouchY = y;
    this.lastTouchTime = Date.now();
    this.velocity = 0;
    this.clearLongPress();
    if (this.onItemLongPress) {
      this.longPressTimer = setTimeout(() => {
        if (this.dragging && !this.moved) {
          this.longPressFired = true;
          const idx = this.itemAt(this.downY);
          if (idx >= 0) this.onItemLongPress?.(idx);
        }
      }, 450);
    }
    return true;
  }

  onTouchMove(_x: number, y: number): void {
    if (!this.dragging) return;
    const dy = y - this.dragStartY;
    if (Math.abs(_x - this.downX) > 8 || Math.abs(dy) > 8) {
      this.moved = true;
      this.clearLongPress();
    }
    this.scrollTo(this.dragStartScroll - dy);
    const now = Date.now();
    const dt = now - this.lastTouchTime;
    if (dt > 0) {
      this.velocity = (y - this.lastTouchY) / dt;
    }
    this.lastTouchY = y;
    this.lastTouchTime = now;
  }

  onTouchUp(): void {
    this.dragging = false;
    this.clearLongPress();
    if (!this.moved && !this.longPressFired) {
      const idx = this.itemAt(this.downY);
      if (idx >= 0) this.onItemTap?.(idx);
    }
    // Inertia
    if (Math.abs(this.velocity) > 0.1) {
      const inertia = this.velocity * 15;
      this.scrollTo(this.scrollY - inertia);
    }
  }

  onTouchCancel(): void {
    this.dragging = false;
    this.moved = false;
    this.clearLongPress();
  }
}

// ── Dialog / Modal ───────────────────────────────────────────────────────────

export class Dialog extends Widget {
  content: Widget;
  onClose: (() => void) | null = null;
  private scrimColor: string;

  constructor(
    screenW: number,
    screenH: number,
    content: Widget,
    scrimColor: string = COLORS.overlay,
  ) {
    super();
    this.w = screenW;
    this.h = screenH;
    this.content = content;
    this.scrimColor = scrimColor;
    // Center content
    content.x = (screenW - content.w) / 2;
    content.y = (screenH - content.h) / 2;
    this.addChild(content);
  }

  protected drawSelf(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = this.scrimColor;
    ctx.fillRect(0, 0, this.w, this.h);
  }

  onTouchDown(x: number, y: number): boolean {
    // Tap outside content closes
    if (!this.content.contains(x - this.x, y - this.y)) {
      this.onClose?.();
    }
    return true;
  }
}

// ── Screen (root widget) ─────────────────────────────────────────────────────

export abstract class Screen extends Widget {
  screenW: number;
  screenH: number;
  protected dialog: Dialog | null = null;

  constructor(screenW: number, screenH: number) {
    super();
    this.w = screenW;
    this.h = screenH;
    this.screenW = screenW;
    this.screenH = screenH;
  }

  showDialog(content: Widget, scrimColor?: string): void {
    this.dialog = new Dialog(this.screenW, this.screenH, content, scrimColor);
    this.dialog.onClose = () => {
      this.dialog = null;
    };
  }

  closeDialog(): void {
    this.dialog = null;
  }

  get hasDialog(): boolean {
    return this.dialog !== null;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (!this.visible) return;
    ctx.save();
    this.drawSelf(ctx);
    for (const c of this.children) c.draw(ctx);
    if (this.dialog) this.dialog.draw(ctx);
    ctx.restore();
  }

  /** Route a touch event. Returns true if handled. */
  handleTouch(ev: TouchEvent): boolean {
    if (!this.visible) return false;
    if (ev.type === 'down') {
      for (const p of ev.changed) {
        // Dialog gets priority
        if (this.dialog) {
          const hit = this.dialog.hitTest(p.x, p.y);
          if (hit) {
            hit.onTouchDown(p.x - hit.absX, p.y - hit.absY);
            this.touchClaim = new Map([[p.id, hit]]);
            return true;
          }
          continue;
        }
        const hit = this.hitTest(p.x, p.y);
        if (hit && hit !== this) {
          hit.onTouchDown(p.x - hit.absX, p.y - hit.absY);
          if (!this.touchClaim) this.touchClaim = new Map();
          this.touchClaim.set(p.id, hit);
          return true;
        }
      }
    } else if (ev.type === 'move') {
      if (this.touchClaim) {
        for (const p of ev.changed) {
          const widget = this.touchClaim.get(p.id);
          if (widget) {
            widget.onTouchMove(p.x - widget.absX, p.y - widget.absY);
          }
        }
      }
    } else if (ev.type === 'up') {
      if (this.touchClaim) {
        for (const p of ev.changed) {
          const widget = this.touchClaim.get(p.id);
          if (widget) {
            widget.onTouchUp(p.x - widget.absX, p.y - widget.absY);
            this.touchClaim.delete(p.id);
          }
        }
      }
    }
    return false;
  }

  private touchClaim: Map<number, Widget> | null = null;

  /** Per-frame update. Override for animation. */
  update(_dt: number): void {}

  /** Called when this screen becomes active. */
  onEnter(): void {}

  /** Called when this screen is exited. */
  onExit(): void {}
}

// ── Screen Router ────────────────────────────────────────────────────────────

export class Router {
  private screens = new Map<string, Screen>();
  private current: Screen | null = null;
  private currentName = '';

  register(name: string, screen: Screen): void {
    this.screens.set(name, screen);
  }

  navigate(name: string): void {
    const next = this.screens.get(name);
    if (!next) return;
    if (this.current) this.current.onExit();
    this.current = next;
    this.currentName = name;
    this.current.onEnter();
  }

  get active(): Screen | null {
    return this.current;
  }

  get activeName(): string {
    return this.currentName;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    this.current?.draw(ctx);
  }

  update(dt: number): void {
    this.current?.update(dt);
  }

  handleTouch(ev: TouchEvent): boolean {
    return this.current?.handleTouch(ev) ?? false;
  }
}
