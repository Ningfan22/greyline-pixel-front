import { CARDS } from './cards';
import type { GameState, Unit } from './engine';

/** Rotorcraft: the transport heli (airlift) and the rocket heli airframe. */
export function isRotorcraft(u: Unit): boolean {
  const c = CARDS[u.id];
  if (c.airlift) return true;
  const af = c.airframe;
  return af === 'transport_heli' || af === 'rocket_heli';
}

/** Deterministic FX randomness, mirroring engine.fxRnd without a circular import. */
function fxRnd(s: GameState) {
  s.fxSeed = (Math.imul(1664525, s.fxSeed) + 1013904223) >>> 0;
  return s.fxSeed / 4294967296;
}

const WASH_INTERVAL = 0.05;
/** Max clearance (ground - y) at which downwash still disturbs the soil. */
const WASH_CEILING = 260;
/** Below-clearance guard so a crashing heli does not emit from underground. */
const WASH_FLOOR = -60;

/**
 * Helicopter downwash: a low-flying rotorcraft blows dust outward from the
 * ground beneath it. Strength scales with proximity — a hovering transport
 * unloading troops kicks up a storm, a high patrol barely stirs the air.
 */
export function rotorWash(s: GameState, u: Unit, dt: number) {
  if (!isRotorcraft(u)) return;
  const terrain = s.terrain;
  const gx = Math.max(
    0,
    Math.min(terrain.length - 1, Math.floor(u.x)),
  );
  const clearance = terrain[gx] - u.y;
  if (clearance > WASH_CEILING || clearance < WASH_FLOOR) return;

  u.rotorWashAt = Math.max(0, (u.rotorWashAt ?? 0) - dt);
  if (u.rotorWashAt > 0) return;
  u.rotorWashAt = WASH_INTERVAL;

  const proximity = 1 - clearance / WASH_CEILING;
  const count = 2 + (fxRnd(s) < 0.5 ? 1 : 0);
  const groundY = terrain[gx];
  for (let i = 0; i < count; i++) {
    const life = 0.45 + fxRnd(s) * 0.45;
    const roll = fxRnd(s);
    // Dust spawns on the ground below the fuselage and is flung outward
    // and upward, as if thrown by the rotor column hitting the soil.
    const spread = (fxRnd(s) - 0.5) * (28 + proximity * 40);
    s.particles.push({
      kind: 'dust',
      x: u.x + spread,
      y: groundY - 1,
      vx: spread * (0.12 + proximity * 0.2) + (fxRnd(s) - 0.5) * 14,
      vy: -8 - fxRnd(s) * (14 + proximity * 26),
      life,
      maxLife: life,
      color: roll < 0.4 ? '#94876b' : roll < 0.75 ? '#a79571' : '#857a5f',
      size: 5 + fxRnd(s) * (8 + proximity * 9),
    });
  }
}
