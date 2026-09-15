import { createGame, startGame, tick, spawnUnit } from './game/engine.ts';
const s = createGame(47001);
startGame(s);
Object.assign(s, { scenery: [], walls: [], wrecks: [] });
s.players.forEach((p) => (p.order = 'hold'));
// Spawn a dense battlefield: ~60 units per side across the field
const ids = ['infantry','infantry','infantry','medic','machinegun','sniper','rocket','mortar','recon','sniper'];
for (let i = 0; i < 60; i++) {
  const id = ids[i % ids.length];
  spawnUnit(s, 0, id, 400 + (i % 30) * 90);
  spawnUnit(s, 1, id, 3440 - (i % 30) * 90);
}
console.log('units:', s.units.length);
// Warm up
for (let i = 0; i < 120; i++) tick(s, 1/60);
// Measure
const N = 600;
const t0 = process.hrtime.bigint();
for (let i = 0; i < N; i++) tick(s, 1/60);
const t1 = process.hrtime.bigint();
const ms = Number(t1 - t0) / 1e6;
console.log(`total ${ms.toFixed(1)}ms for ${N} ticks = ${(ms/N).toFixed(3)} ms/tick`);
