/** A reveal belongs to one purchase only, even if a cleared callback was already queued. */
export function createRevealTimers(driver = {
  set: (fn: () => void, ms: number) => setTimeout(fn, ms),
  clear: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
}) {
  let generation = 0;
  let timers: ReturnType<typeof setTimeout>[] = [];
  const cancel = () => {
    generation += 1;
    for (const timer of timers) driver.clear(timer);
    timers = [];
  };
  return {
    cancel,
    reveal(indices: number[], interval: number, flip: (index: number) => void) {
      cancel();
      const current = generation;
      timers = indices.map((index, i) => driver.set(() => {
        if (current === generation) flip(index);
      }, i * interval));
    },
  };
}
