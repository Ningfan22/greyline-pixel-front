/** Spend one army update and paint per displayed frame, including on 120 Hz
 * phones. The 20 Hz floor matches the simulation's existing 50 ms step limit. */
export class BattleFrameBudget {
  private nextAt = -Infinity;
  private lastAt: number | undefined;
  private cost = 0;
  private slowUntil = 0;
  private lastMobile = false;
  fps = 60;
  take(now: number, mobile: boolean, adaptive = true): number | null {
    const nominal = mobile ? 30 : 60;
    this.fps = adaptive && now < this.slowUntil ? 20 : nominal;
    if(mobile !== this.lastMobile){this.nextAt = now; this.lastMobile = mobile;}
    if (now + .5 < this.nextAt) return null;
    const elapsed = this.lastAt === undefined ? 0 : Math.max(0, (now - this.lastAt) / 1000);
    this.lastAt = now;
    // Keep fractional cadence; after a late frame do no catch-up render loop.
    const interval = 1000 / this.fps;
    this.nextAt = Number.isFinite(this.nextAt) && now - this.nextAt < interval
      ? this.nextAt + interval : now + interval;
    return elapsed;
  }
  record(now: number, workMs: number, adaptive = true) {
    this.cost = this.cost ? this.cost * .85 + workMs * .15 : workMs;
    if (adaptive && this.cost > 28) this.slowUntil = now + 2000;
  }
  reset(now: number) {this.lastAt = undefined; this.nextAt = now;}
}
