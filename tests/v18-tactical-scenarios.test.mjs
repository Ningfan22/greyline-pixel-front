import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createGame,
  startGame,
  spawnUnit,
  tick,
  refreshVision,
  W,
  isCombatant,
  unitRange,
  visibleToSide,
} from '../game/engine.ts';
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
export function weaponScenario(
  seed,
  side,
  kind,
  support = false,
  seconds = 12,
) {
  const s = arena(seed, side),
    dir = side === 0 ? 1 : -1,
    x = (v) => (side === 0 ? v : W - v),
    own = [];
  for (let g = 0; g < 3; g++)
    own.push(...add(s, side, 'infantry', x(1080 - g * 110)));
  own.forEach((u, i) =>
    Object.assign(u, {
      x: x(1080 - Math.floor(i / 6) * 110 - (i % 6) * 12),
      y: 374,
    }),
  );
  const original = new Map(own.map((u) => [u.uid, { x: u.x, lane: u.lane }]));
  const supportUnits = [];
  if (support)
    for (const point of [1040, 940])
      supportUnits.push(
        ...add(s, side, kind === 'tank' ? 'javelin' : 'manpads', x(point)),
      );
  const foes = [];
  for (let g = 0; g < (kind === 'machinegun' ? 5 : 2); g++)
    foes.push(...add(s, 1 - side, kind, x(1370 + g * 28)));
  foes.forEach((u, i) => {
    if (CARDS[u.id].members) {
      u.x = x(1370 + Math.floor(i / 5) * 28 + (i % 5) * 5);
      u.squadOrder = 'watch';
      u.squadOrderX = u.x;
    }
  });
  const foeStart = new Map(foes.map((u) => [u.uid, u.x]));
  refreshVision(s);
  const initialShots = foes.reduce((n, u) => n + u.shots + u.secondaryShots, 0);
  const initialEnemyHP = foes.reduce((n, u) => n + u.hp, 0);
  const low = new Set(),
    dispersed = new Set(),
    separatedPairs = new Set(),
    fallback = new Set(),
    routed = new Set();
  let activeFrames = 0,
    lowFrames = 0,
    coveredFrames = 0,
    uncoveredFrames = 0,
    allFleeFrames = 0,
    exposedAllFleeFrames = 0,
    minDistance = Infinity;
  for (let frame = 0; frame < Math.round(seconds / dt); frame++) {
    const previous = new Map(own.map((u) => [u.uid, u.x]));
    tick(s, dt);
    const live = own.filter(isCombatant);
    for (const u of live) {
      activeFrames++;
      if (['prone', 'crouch'].includes(u.pose)) {
        low.add(u.uid);
        lowFrames++;
      }
      if (Math.abs(u.lane - original.get(u.uid).lane) > 2) dispersed.add(u.uid);
      if (u.tactic === 'retreat') routed.add(u.uid);
    }
    // Count living pairs that actually leave each other's crowded footprint;
    // a phased bound can separate them along X without changing depth lanes.
    for (let a = 0; a < live.length; a++) {
      for (let b = a + 1; b < live.length; b++) {
        const u = live[a],
          v = live[b],
          firstU = original.get(u.uid),
          firstV = original.get(v.uid),
          initialGap = Math.hypot(
            firstU.x - firstV.x,
            firstU.lane - firstV.lane,
          ),
          gap = Math.hypot(u.x - v.x, u.lane - v.lane);
        if (initialGap < 28 && gap > Math.max(32, initialGap + 12))
          separatedPairs.add(`${u.uid}:${v.uid}`);
      }
    }
    const back = live.filter(
      (u) =>
        u.moving &&
        (u.x - previous.get(u.uid)) * dir < -0.001 &&
        u.tactic !== 'retreat' &&
        (u.withdrawUntil ?? 0) > s.time,
    );
    if (back.length) {
      for (const u of back) fallback.add(u.uid);
      const cover = live.some(
        (u) => !u.moving && s.time - (u.lastCombatShotAt ?? -100) < 1.4,
      );
      if (cover) coveredFrames++;
      else uncoveredFrames++;
    }
    if (
      live.length > 3 &&
      live.every((u) => u.moving && (u.x - previous.get(u.uid)) * dir < -0.001)
    ) {
      allFleeFrames++;
      if (
        live.some((u) =>
          foes.some(
            (v) =>
              isCombatant(v) &&
              visibleToSide(s, u.side, v) &&
              Math.abs(v.x - u.x) <= Math.min(640, unitRange(s, v) + 36),
          ),
        )
      )
        exposedAllFleeFrames++;
    }
    for (const u of live)
      for (const v of foes.filter(isCombatant))
        minDistance = Math.min(minDistance, Math.abs(u.x - v.x));
  }
  return {
    seed,
    side,
    kind,
    support,
    own: own.length,
    enemyShots:
      foes.reduce((n, u) => n + u.shots + u.secondaryShots, 0) - initialShots,
    ownShots: own.reduce((n, u) => n + u.shots - u.member, 0),
    supportShots: supportUnits.reduce((n, u) => n + u.shots - u.member, 0),
    enemyAlive: foes.filter(isCombatant).length,
    enemyRetreated: foes.filter(
      (u) =>
        isCombatant(u) &&
        u.hp < CARDS[u.id].hp * 0.5 &&
        (u.x - (foeStart.get(u.uid) ?? u.x)) * dir > 120,
    ).length,
    enemyDamage:
      initialEnemyHP - foes.reduce((n, u) => n + Math.max(0, u.hp), 0),
    alive: own.filter((u) => u.hp > 0).length,
    wounded: own.filter((u) => u.wounded).length,
    hp: own.reduce((n, u) => n + u.hp, 0),
    low: low.size,
    lowFrameRatio: lowFrames / Math.max(1, activeFrames),
    dispersed: dispersed.size,
    separatedPairs: separatedPairs.size,
    fallback: fallback.size,
    routed: routed.size,
    coveredFrames,
    uncoveredFrames,
    allFleeFrames,
    exposedAllFleeFrames,
    minDistance,
    meanAdvance:
      own.reduce((n, u) => n + (u.x - original.get(u.uid).x) * dir, 0) /
      own.length,
  };
}
export function artilleryScenario(seed, side) {
  const s = arena(seed, side),
    x = (v) => (side === 0 ? v : W - v),
    own = [];
  s.players[side].order = 'hold';
  for (const center of [1110, 1000, 650]) {
    const members = add(s, side, 'infantry', x(center));
    members.forEach((u, i) =>
      Object.assign(u, {
        x: x(center - (i - 2.5) * 9),
        y: 374,
        squadOrder: 'watch',
        squadOrderX: x(center - (i - 2.5) * 9),
      }),
    );
    own.push(...members);
  }
  const gun = add(s, 1 - side, 'barrage', x(1770))[0];
  const scout = add(s, 1 - side, 'scouts', x(1420));
  scout.forEach((u) => {
    u.cooldown = 1e9;
    u.squadOrder = 'watch';
  });
  refreshVision(s);
  let firstId = null,
    shellShots = 0;
  const decisions = new Map(),
    reacted = new Map();
  let impactProne = 0,
    firstGoneAt = null;
  for (let frame = 0; frame < 720; frame++) {
    const before = s.projectiles.map((p) => ({
      uid: p.uid,
      life: p.life,
      x: p.x,
      y: p.y,
      tx: p.tx,
      ty: p.ty,
    }));
    tick(s, dt);
    for (const p of s.projectiles)
      if (p.shell && p.sourceUid === gun.uid && firstId === null) {
        firstId = p.uid;
        shellShots++;
      }
    const p =
      s.projectiles.find((p) => p.uid === firstId) ??
      before.find((p) => p.uid === firstId);
    for (const u of own) {
      if (
        firstId !== null &&
        (u.artilleryChecks ?? []).includes(firstId) &&
        !decisions.has(u.uid)
      )
        decisions.set(u.uid, {
          uid: u.uid,
          far: Math.abs(u.x - x(650)) < 70,
          life: p?.life,
          distance: p ? Math.hypot(p.x - u.x, p.y - (u.y - 30)) : null,
        });
      if (firstId !== null && u.evadeMarker === firstId && !reacted.has(u.uid))
        reacted.set(u.uid, {
          uid: u.uid,
          at: u.artilleryReactAt,
          far: Math.abs(u.x - x(650)) < 70,
        });
    }
    if (
      firstId !== null &&
      !s.projectiles.some((p) => p.uid === firstId) &&
      firstGoneAt === null
    ) {
      firstGoneAt = s.time;
      impactProne = own.filter(
        (u) => u.evadeMarker === firstId && u.pose === 'prone',
      ).length;
    }
    if (firstGoneAt !== null && s.time - firstGoneAt > 0.2) break;
  }
  return {
    seed,
    side,
    firstId,
    shots: gun.shots,
    decisions: [...decisions.values()],
    reacted: [...reacted.values()],
    impactProne,
    alive: own.filter((u) => u.hp > 0).length,
    hp: own.reduce((n, u) => n + u.hp, 0),
  };
}

for (const side of [0, 1]) {
  for (const kind of ['machinegun', 'tank'])
    test(`three squads use low stances and covered bounds against ${kind}, side ${side}`, () => {
      const rows = [1, 7, 13, 29].map((seed) =>
        weaponScenario(seed, side, kind),
      );
      for (const row of rows) {
        assert(row.enemyShots > 20, 'the opposing weapon really fires');
        assert(row.ownShots > 0, 'some members provide actual return fire');
        assert(row.low >= 12 && row.lowFrameRatio > 0.5);
        assert(
          row.dispersed > 0 || row.separatedPairs > 0,
          'crowded living members must separate along depth or X, not only change animation',
        );
        assert(row.fallback >= 6 && row.coveredFrames > 40);
        assert.equal(
          row.exposedAllFleeFrames,
          0,
          'visible firing threats require phased cover; troops already out of contact may travel together',
        );
        assert(
          row.minDistance > 140,
          'infantry must not deliberately close to melee range',
        );
      }
      console.log('TACTICAL_GROUND', JSON.stringify({ side, kind, rows }));
    });
  test(`unprotected infantry recognises gunship danger while giving limited rifle cover fire, side ${side}`, () => {
    const rows = [1, 7, 13, 29].map((seed) =>
      weaponScenario(seed, side, 'helicopter'),
    );
    for (const row of rows) {
      assert(row.enemyShots > 20);
      assert(
        row.ownShots > 0 && row.enemyDamage < 26,
        'sporadic rifle hits cannot replace the separate anti-air counter',
      );
      assert(row.low >= 12 && row.lowFrameRatio > 0.6);
      assert(row.fallback >= 6);
      assert.equal(row.allFleeFrames, 0);
      assert(
        row.minDistance > 140 && row.meanAdvance < 0,
        'withdraw rather than marching underneath the gunship',
      );
    }
    console.log('TACTICAL_GUNSHIP', JSON.stringify({ side, rows }));
  });
  for (const kind of ['tank', 'helicopter'])
    test(`real ${kind === 'tank' ? 'anti-tank' : 'anti-air'} support keeps more infantry fighting, side ${side}`, () => {
      const pairs = [1, 7, 13, 29].map((seed) => [
        weaponScenario(seed, side, kind),
        weaponScenario(seed, side, kind, true),
      ]);
      for (const [bare, supported] of pairs) {
        assert(
          supported.supportShots > 0,
          'the counter must actually fire, not just add card-price confidence',
        );
        assert(
          supported.enemyDamage > bare.enemyDamage,
          'the specialist must actually damage its matching threat',
        );
        assert(supported.fallback < bare.fallback);
        assert.equal(supported.allFleeFrames, 0);
      }
      assert(
        pairs.reduce(
          (n, [bare, supported]) =>
            n + supported.meanAdvance - bare.meanAdvance,
          0,
        ) > 0,
        'real counter fire lets the force retain more ground across the fixed seeds',
      );
      if (kind === 'tank')
        assert(
          pairs.every(
            ([, supported]) =>
              supported.enemyAlive - supported.enemyRetreated === 0 &&
              supported.alive >= 4,
          ),
          'anti-tank support must destroy or drive off both tanks and retain a living advancing force',
        );
      else
        assert(
          pairs.reduce(
            (n, [bare, supported]) => n + supported.hp - bare.hp,
            0,
          ) > 0,
          'anti-air support improves aggregate survival across these fixed exchanges',
        );
      console.log('TACTICAL_COUNTER', JSON.stringify({ side, kind, pairs }));
    });
  test(`recon drones and interceptors do not frighten infantry into stopping, side ${side}`, () => {
    for (const kind of ['scout_drone', 'interceptor']) {
      const row = weaponScenario(13, side, kind, false, 2);
      assert.equal(row.enemyShots, 0);
      assert.equal(row.fallback, 0);
      assert.equal(row.routed, 0);
      assert(row.meanAdvance > 100);
      assert.equal(row.hp, CARDS.infantry.hp * 3);
    }
  });
  test(`actual howitzer shells trigger local late perception across three squads, side ${side}`, () => {
    const rows = [1, 7, 13, 29, 61, 97].map((seed) =>
      artilleryScenario(seed, side),
    );
    let checks = 0,
      reactions = 0,
      prone = 0;
    const times = new Set();
    for (const row of rows) {
      assert(
        row.firstId !== null && row.shots > 0,
        'the real howitzer must launch its own projectile',
      );
      assert(
        row.hp < CARDS.infantry.hp * 3,
        'the barrage must remain dangerous',
      );
      assert(row.decisions.length > 0);
      assert(
        row.decisions.every(
          (u) => !u.far && u.life <= 0.58 + dt && u.distance <= 145 + 2,
        ),
      );
      assert(
        row.reacted.every((u) => !u.far),
        'the distant squad cannot hear an omniscient impact marker',
      );
      checks += row.decisions.length;
      reactions += row.reacted.length;
      prone += row.impactProne;
      row.reacted.forEach((u) => times.add(Math.round(u.at * 100)));
    }
    assert(reactions > checks * 0.2 && reactions < checks * 0.9);
    assert(prone > 0 && times.size > 5);
    console.log(
      'TACTICAL_ARTILLERY',
      JSON.stringify({ side, checks, reactions, prone, rows }),
    );
  });
}
