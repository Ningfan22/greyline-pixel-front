import { performance } from 'node:perf_hooks';
import { createGame, startGame, tick, ground, spawnUnit, W } from '../game/engine.ts';

const s = createGame(99, undefined, undefined, 'greyline', { difficulty: 'standard' });
startGame(s);
s.aiIn = 1e9;
s.terrain.fill(374); s.original.fill(374);

const cards = ['infantry','assault','marines','militia','scouts','rangers','commandos','paratroopers'];
// Place them close together so they immediately engage
for (let i = 0; i < 12; i++) {
  spawnUnit(s, 0, cards[i % cards.length], 1300 + i * 40);
  spawnUnit(s, 1, cards[(i+3) % cards.length], 1900 - i * 40);
}
console.log('units:', s.units.length);

for (let i = 0; i < 120; i++) tick(s, 1/60);

const N = 300;
const t0 = performance.now();
for (let i = 0; i < N; i++) tick(s, 1/60);
const elapsed = performance.now() - t0;
console.log(`avg tick: ${(elapsed/N).toFixed(2)}ms over ${N} ticks (${s.units.length} units)`);
console.log(`projectiles: ${s.projectiles.length}, blasts: ${s.blasts.length}, particles: ${s.particles.length}`);
