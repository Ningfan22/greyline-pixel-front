import type { TouchEvent, TouchPoint } from './framework';

function points(list: any): TouchPoint[] {
  return Array.from(list ?? [], (t: any) => ({ id: t.identifier ?? 0, x: t.clientX, y: t.clientY }));
}

/** Keep current positions and distinguish interruption from deliberate release. */
export class TouchRouting {
  private active = new Map<number, TouchPoint>();
  private deliver: (event: TouchEvent) => void;
  constructor(deliver: (event: TouchEvent) => void) { this.deliver = deliver; }

  dispatch(type: TouchEvent['type'], raw: any): void {
    const changed = points(raw.changedTouches ?? raw.touches);
    for (const p of changed) {
      if (type === 'down' || this.active.has(p.id)) this.active.set(p.id, p);
    }
    this.deliver({ type, changed, points: [...this.active.values()] });
    if (type === 'up' || type === 'cancel')
      for (const p of changed) this.active.delete(p.id);
  }

  cancelAll(): void {
    const changed = [...this.active.values()];
    this.active.clear();
    this.deliver({ type: 'cancel', changed, points: [] });
  }
}
