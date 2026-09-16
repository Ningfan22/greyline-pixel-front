import { weaponScenario } from './v18-tactical-scenarios.test.mjs';
import { createGame, startGame, spawnUnit, tick, refreshVision, W, isCombatant } from '../game/engine.ts';
import { CARDS } from '../game/cards.ts';

const dt = 1 / 60;
function arena(seed, side = 0) {
  const s = createGame(seed);
  startGame(s);
  s.units = [];
  s.scenery = [];
  s.walls = [];
  s.wrecks = [];
  s.terrain.fill(374);
  s.original.fill(374);
  s.aiIn = 1e9;
  s.players[side].order = 'advance';
  s.players[1 - side].order = 'hold';
  return s;
}
function add(s, side, id, x) {
  const n = s.units.length;
  spawnUnit(s, side, id, x);
  return s.units.slice(n);
}

// Replicate the tank scenario but track foe positions over time.
for (const side of [1]) {
  for (const seed of [1, 7, 13, 29]) {
    const s = arena(seed, side),
      dir = side === 0 ? 1 : -1,
      x = (v) => (side === 0 ? v : W - v);
    const own = [];
    for (let g = 0; g < 3; g++)
      own.push(...add(s, side, 'infantry', x(1080 - g * 110)));
    own.forEach((u, i) =>
      Object.assign(u, {
        x: x(1080 - Math.floor(i / 6) * 110 - (i % 6) * 12),
        y: 374,
      }),
    );
    for (const point of [1040, 940])
      add(s, side, 'javelin', x(point));
    const foes = [];
    for (let g = 0; g < 2; g++)
      foes.push(...add(s, 1 - side, 'tank', x(1370 + g * 28)));
    const startX = foes.map((u) => u.x);
    refreshVision(s);
    const trace = [];
    for (let frame = 0; frame < Math.round(12 / dt); frame++) {
      tick(s, dt);
      if (frame % 120 === 0 || frame === Math.round(12 / dt) - 1) {
        trace.push({
          t: +(frame * dt).toFixed(1),
          foes: foes.map((u) => ({
            hp: Math.round(u.hp),
            x: Math.round(u.x),
            reversing: !!(u.vehicleReverseUntil > s.time),
            revGoal: u.vehicleReverseGoal ? Math.round(u.vehicleReverseGoal) : null,
            alive: u.hp > 0,
          })),
        });
      }
    }
    console.log(JSON.stringify({ seed, side, startX, trace }));
  }
}
