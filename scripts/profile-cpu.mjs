// CPU profiler for the battle simulation.
// Runs a large battle under the V8 inspector sampler and prints the hottest
// functions by self time, so optimization work targets measured bottlenecks
// instead of guesses. Usage:
//   node --experimental-strip-types --loader ./scripts/ts-loader.mjs \
//     scripts/profile-cpu.mjs [ticks] [cardsPerSide]
import { performance } from 'node:perf_hooks';
import inspector from 'node:inspector';
import { createGame, startGame, tick, spawnUnit } from '../game/engine.ts';

const TICKS = Number(process.argv[2] ?? 6000);
const CARDS = Number(process.argv[3] ?? 24);

const s = createGame(99, undefined, undefined, 'greyline', { difficulty: 'standard' });
startGame(s);
s.aiIn = 1e9;
s.terrain.fill(374);
s.original.fill(374);

const cards = [
  'infantry', 'assault', 'marines', 'militia', 'scouts', 'rangers',
  'commandos', 'paratroopers',
];
for (let i = 0; i < CARDS; i++) {
  // Spawn the two sides at opposite ends of the map so they spend the whole
  // run marching toward each other: this keeps the unit count (and therefore
  // the per-tick scaling cost) high for the whole sampling window.
  spawnUnit(s, 0, cards[i % cards.length], 220 + i * 26);
  spawnUnit(s, 1, cards[(i + 3) % cards.length], 3600 - i * 26);
}

for (let i = 0; i < 180; i++) tick(s, 1 / 60);
const peakUnits = s.units.length;

const session = new inspector.Session();
session.connect();
await new Promise((resolve) => session.post('Profiler.enable', resolve));
await new Promise((resolve) => session.post('Profiler.start', resolve));

const t0 = performance.now();
for (let i = 0; i < TICKS; i++) tick(s, 1 / 60);
const elapsed = performance.now() - t0;

const { profile } = await new Promise((resolve) =>
  session.post('Profiler.stop', (err, result) => resolve(result)),
);
session.disconnect();

// Aggregate self time per function from the sample stream (each sample names
// the function currently on-CPU, so sample counts approximate self time).
const nodeById = new Map(profile.nodes.map((n) => [n.id, n]));
const selfTime = new Map();
const nameOf = (node) => {
  const fn = node.callFrame.functionName || '(anonymous)';
  const url = node.callFrame.url ? node.callFrame.url.split('/').pop() : '';
  return `${fn} (${url}:${node.callFrame.lineNumber + 1})`;
};
for (const id of profile.samples ?? []) {
  const node = nodeById.get(id);
  if (!node) continue;
  const key = nameOf(node);
  selfTime.set(key, (selfTime.get(key) ?? 0) + 1);
}
const totalHits = profile.samples?.length ?? 1;
const ranked = [...selfTime.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);

console.log(
  `avg tick: ${(elapsed / TICKS).toFixed(2)}ms over ${TICKS} ticks ` +
    `(${peakUnits} units at peak, ${s.units.length} at end, ${totalHits} samples)`,
);
console.log('top self-time:');
for (const [name, hits] of ranked) {
  console.log(`  ${((100 * hits) / totalHits).toFixed(1)}%  ${name}`);
}
