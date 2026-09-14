import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  createGame,
  startGame,
  spawnUnit,
  tick,
  refreshVision,
  ground,
  W,
} from '../game/engine.ts';
import { pointVisible } from '../game/world.ts';
import { blastVisible } from '../game/impact-fx.ts';

const DT = 1 / 60,
  results = [],
  failures = [];
const out = path.resolve('output/v21-impact-qa');
fs.mkdirSync(out, { recursive: true });
function check(name, fn) {
  try {
    const details = fn();
    results.push({ name, ...details });
    console.log('PASS', name);
  } catch (e) {
    failures.push({ name, error: e.stack });
    console.error('FAIL', name, e.stack);
  }
}
function arena(side, id, enemy = 'infantry') {
  const s = createGame(2137);
  startGame(s);
  s.aiIn = 1e6;
  s.terrain.fill(374);
  s.original.fill(374);
  s.scenery = [];
  s.walls = [];
  const x = (n) => (side === 0 ? n : W - n);
  spawnUnit(s, side, id, x(1000));
  const source = s.units[0];
  spawnUnit(s, 1 - side, enemy, x(1430));
  for (const u of s.units)
    if (u.side !== side) {
      u.cooldown = 1e6;
      u.secondaryCooldown = 1e6;
    }
  refreshVision(s);
  return { s, source, x };
}
function until(s, fn, seconds = 10) {
  for (let t = 0; t < seconds && !fn(); t += DT) tick(s, DT);
  assert.ok(fn(), `condition absent at ${s.time}`);
}
function fire(f, predicate = (p) => p.radius > 0) {
  until(f.s, () =>
    f.s.projectiles.some((p) => p.sourceUid === f.source.uid && predicate(p)),
  );
  const p = f.s.projectiles.find(
    (p) => p.sourceUid === f.source.uid && predicate(p),
  );
  const launch = structuredClone(p);
  for (const u of f.s.units) {
    u.cooldown = 1e6;
    u.secondaryCooldown = 1e6;
  }
  return { p, launch };
}
function evidence(name, s, launch, blast) {
  fs.writeFileSync(path.join(out, `${name}-state.json`), JSON.stringify(s));
  return { launch, blast: structuredClone(blast), time: s.time };
}
for (const side of [0, 1])
  for (const id of ['tank', 'mortar']) {
    check(
      `${id} side${side}: real moving-target endpoint retains ground fire/smoke above a hidden crater floor`,
      () => {
        const f = arena(side, id),
          { s } = f,
          { launch } = fire(f);
        const target = s.units.find((u) => u.uid === launch.targetUid),
          start = target.x;
        until(s, () => s.blasts.length > 0);
        const b = s.blasts[0];
        assert.equal(b.kind, id === 'mortar' ? 'artillery' : 'he');
        assert.equal(b.soil, true);
        assert.equal(b.y, ground(s, b.x));
        assert.equal(
          pointVisible(s, side, b.x, b.y),
          false,
          'fixture must reproduce anchor-only visibility failure',
        );
        assert.equal(blastVisible(s, side, b), true);
        assert.notEqual(
          target.x,
          start,
          'target must really move while the projectile flies',
        );
        const result = evidence(`${id}-side${side}-endpoint`, s, launch, b);
        for (let i = 0; i < 60; i++) tick(s, DT);
        assert.ok(
          s.blasts.includes(b),
          'smoke must remain after first fire frame',
        );
        assert.equal(b.y, ground(s, b.x));
        assert.equal(blastVisible(s, side, b), true);
        return result;
      },
    );
    for (const obstacle of ['earth', 'hard-cover'])
      check(
        `${id} side${side}: real flight ${id === 'mortar' && obstacle === 'hard-cover' ? 'passes destroyed cover' : `terminates on ${obstacle}`} with one blast`,
        () => {
          const f = arena(side, id),
            { s } = f,
            { p, launch } = fire(f);
          const dir = Math.sign(p.tx - p.x),
            cx = p.tx - dir * 24;
          if (obstacle === 'earth') {
            // A raised berm on the final descending segment; no projectile or impact is injected.
            for (let x = Math.floor(cx - 10); x <= Math.ceil(cx + 10); x++)
              s.terrain[x] = s.original[x] = 324;
          } else
            s.wrecks.push({
              id: ++s.uid,
              cardId: 'tank',
              side: 1 - side,
              x: cx,
              y: 374,
              angle: 0,
              age: 10,
              falling: false,
              vx: 0,
              vy: 0,
            });
          until(s, () => s.blasts.length > 0);
          const b = s.blasts[0];
          assert.equal(s.projectiles.includes(p), false);
          assert.equal(s.blasts.length, 1);
          if (id === 'mortar' && obstacle === 'hard-cover')
            assert.equal(b.x, launch.tx, 'mortar must pass the wreck and detonate at the original endpoint');
          else
            assert.ok(
              Math.abs(b.x - p.tx) > 1,
              'must hit obstruction before the aim endpoint',
            );
          if (b.kind === 'air') {
            assert.equal(b.soil, false);
            assert.ok(b.y < ground(s, b.x) - 80);
          } else {
            assert.equal(b.soil, true);
            assert.equal(b.y, ground(s, b.x));
          }
          assert.equal(blastVisible(s, side, b), true);
          return evidence(`${id}-side${side}-${obstacle}`, s, launch, b);
        },
      );
  }
check(
  'real AP hit keeps a small penetration flash while the target tank survives',
  () => {
    const f = arena(0, 'tank', 'tank'),
      { s } = f;
    const { launch } = fire(f, (p) => p.ammunition === 'ap');
    until(s, () => s.blasts.length > 0);
    assert.ok(s.units.find((u) => u.uid === launch.targetUid).hp > 0);
    assert.ok(
      s.blasts.every(
        (b) => b.kind === 'penetration' && b.radius === 4 && !b.soil,
      ),
    );
    return evidence('ap-surviving-tank', s, launch, s.blasts[0]);
  },
);
check(
  'real guided missile TTL expires visibly at its current air position without remote damage or excavation',
  () => {
    const f = arena(0, 'javelin', 'tank'),
      { s } = f;
    const { p, launch } = fire(f);
    until(s, () => p.y < ground(s, p.x) - 100, 2);
    const hp = s.units.map((u) => [u.uid, u.hp]),
      terrain = [...s.terrain];
    const at = { x: p.x, y: p.y };
    p.life = DT / 2;
    tick(s, DT);
    assert.equal(s.projectiles.includes(p), false);
    assert.deepEqual(
      s.units.map((u) => [u.uid, u.hp]),
      hp,
    );
    assert.deepEqual(s.terrain, terrain);
    const b = s.blasts[0];
    assert.ok(b);
    assert.equal(b.kind, 'air');
    assert.equal(b.soil, false);
    assert.equal(b.x, at.x);
    assert.equal(b.y, at.y);
    return evidence('guided-ttl-air', s, launch, b);
  },
);
check(
  'real anti-air missile hits a moving helicopter using the air sequence',
  () => {
    const f = arena(0, 'manpads', 'helicopter'),
      { s } = f;
    const { launch } = fire(f);
    until(s, () => s.blasts.length > 0);
    const b = s.blasts[0];
    assert.equal(b.kind, 'air');
    assert.equal(b.soil, false);
    assert.ok(b.y < ground(s, b.x) - 80);
    return evidence('moving-helicopter-air', s, launch, b);
  },
);
check(
  'a visible plume does not reveal effects beyond observation range',
  () => {
    const f = arena(0, 'mortar'),
      { s } = f,
      { launch } = fire(f);
    until(s, () => s.blasts.length > 0);
    const b = s.blasts[0];
    assert.equal(blastVisible(s, 0, b), true);
    for (const u of s.units) if (u.side === 0) u.x = 400;
    refreshVision(s);
    assert.equal(blastVisible(s, 0, b), false);
    return evidence('unobserved-impact', s, launch, b);
  },
);
fs.writeFileSync(
  path.join(out, 'checks.json'),
  JSON.stringify({ results, failures }, null, 2),
);
console.log(`${results.length} passed, ${failures.length} failed`);
if (failures.length) process.exitCode = 1;
