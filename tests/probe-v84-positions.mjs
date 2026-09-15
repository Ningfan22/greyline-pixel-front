import * as engine from '../game/engine.ts';
import { CARDS } from '../game/cards.ts';
import { tacticalObservation } from './helpers/tactical-observations.mjs';

const { isCombatant } = engine;

function run(side, seed) {
  let finalState = null;
  const observed = {
    ...engine,
    tick(s, dt) {
      engine.tick(s, dt);
      finalState = s;
    },
  };
  const r = tacticalObservation(observed, CARDS, seed, side, 'crowded', 12);
  const alive = finalState.units
    .filter((u) => u.side === side && isCombatant(u))
    .sort((a, b) => a.x - b.x);
  const xs = alive.map((u) => Math.round(u.x));
  const spread = xs.length ? xs[xs.length - 1] - xs[0] : 0;
  console.log(
    `side=${side} seed=${seed} alive=${alive.length} finalCluster=${r.finalCluster} spread=${spread} xs=[${xs}]`,
  );
  // biggest cluster
  let big = 0;
  for (const u of alive) {
    const n = alive.filter((v) => Math.abs(v.x - u.x) < 26).length;
    if (n > big) big = n;
  }
  console.log(`  recomputedCluster=${big}`);
}

for (const side of [1, 0]) for (const seed of [7, 29, 61]) run(side, seed);
