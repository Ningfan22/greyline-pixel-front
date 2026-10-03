// A deterministic real-village workload: normal HP, ammunition, return fire,
// original terrain/cover and ordinary advancing orders. Optional CPU sampling.
import { performance } from 'node:perf_hooks';
import inspector from 'node:inspector';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const { createGame, startGame, tick, spawnUnit, refreshVision, W } =
  await import(process.env.GREYLINE_PROFILE_ENGINE ?? '../game/engine.ts');

const density = process.argv[2] ?? 'medium';
const count = density === 'dense' ? 24 : 8;
const ticks = Number(process.argv[3] ?? 1200);
const profilePath = process.argv[4];
const s = createGame(198, undefined, undefined, undefined,
  { weather: false, difficulty: 'standard', mapSeed: 119 });
startGame(s);
Object.assign(s, { units: [], wrecks: [], aiIn: 1e9, night: false });
for (const p of s.players) {
  p.order = 'advance';
  if (density !== 'busy') Object.assign(p, { hand: [], deck: [], discard: [], energy: 0 });
}
if (density === 'busy') {
  // Exact qa-v199-perf-local busy reset, including side-major spawn order.
  for (const side of [0, 1]) {
    const sign = side ? -1 : 1, origin = side ? 2150 : 1500;
    for (let i = 0; i < 5; i++) spawnUnit(s, side, 'infantry', origin - sign * i * 54);
    for (const [id, offset] of [['antiarmor', -70], ['tank', -130], ['mortar', -260]])
      spawnUnit(s, side, id, origin + sign * offset);
  }
} else {
  const cards = ['infantry', 'antiarmor', 'lmg_team', 'tank', 'light_mortar', 'javelin', 'marines', 'mlrs'];
  for (let i = 0; i < count; i++) for (const side of [0, 1]) {
    const x = 1450 + (i % 8) * 25 - Math.floor(i / 8) * 120;
    spawnUnit(s, side, cards[i % cards.length], side ? W - x : x);
  }
}
if (density !== 'busy') refreshVision(s);
for (let i = 0; i < (density === 'busy' ? 1440 : 120); i++) tick(s, 1 / 60);
const startUnits = s.units.length;
let session;
if (profilePath) {
  session = new inspector.Session(); session.connect();
  await new Promise(resolve => session.post('Profiler.enable', resolve));
  await new Promise(resolve => session.post('Profiler.start', resolve));
}
const times = [];
for (let i = 0; i < ticks; i++) {
  const start = performance.now(); tick(s, 1 / 60); times.push(performance.now() - start);
}
let profile;
if (session) {
  ({ profile } = await new Promise(resolve => session.post('Profiler.stop', (err, result) => resolve(result))));
  session.disconnect(); fs.writeFileSync(profilePath, JSON.stringify(profile));
}
times.sort((a, b) => a - b);
console.log(JSON.stringify({ density, ticks, startUnits, endUnits: s.units.length,
  averageMs: times.reduce((sum, t) => sum + t, 0) / ticks,
  p95Ms: times[Math.floor(ticks * .95)], p99Ms: times[Math.floor(ticks * .99)], maxMs: times.at(-1),
  time: s.time, shots: s.units.reduce((sum, u) => sum + u.shots + u.secondaryShots, 0),
  hp: s.units.reduce((sum, u) => sum + u.hp, 0),
  stateHash: createHash('sha256').update(JSON.stringify(s)).digest('hex'),
  sceneryHP: s.scenery.reduce((sum, p) => sum + p.parts.reduce((n, part) => n + part.hp, 0), 0),
  units: s.units.map(u => ({ uid: u.uid, x: u.x, hp: u.hp, shots: u.shots, secondaryShots: u.secondaryShots })) }));
if (profile) {
  const nodes = new Map(profile.nodes.map(n => [n.id, n]));
  const counts = new Map();
  for (const id of profile.samples ?? []) {
    const { callFrame: frame } = nodes.get(id);
    const label = `${frame.functionName || '(anonymous)'} ${frame.url.split('/').at(-1)}:${frame.lineNumber + 1}`;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  for (const [label, count] of [...counts].sort((a,b) => b[1] - a[1]).slice(0, 25))
    console.log(`${(100 * count / profile.samples.length).toFixed(1)}% ${label}`);
}
