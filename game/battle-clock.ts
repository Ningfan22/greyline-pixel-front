import { tick, type GameState } from './engine';

// Retain the 60 Hz clock and its existing 50 ms catch-up ceiling. When a
// paint is late, advance the elapsed simulation time once instead of running
// the whole army two or three times before anything can be displayed.
export function advanceBattleFrame(s: GameState, elapsed: number, remainder = 0) {
  let available = Math.min(remainder + Math.max(0, elapsed), 3 / 60);
  let duration = 0;
  for (let steps = 0; available >= 1 / 60 && steps < 3; steps++) {
    duration += 1 / 60;
    available -= 1 / 60;
  }
  if (duration > 0) tick(s, duration);
  return available;
}
