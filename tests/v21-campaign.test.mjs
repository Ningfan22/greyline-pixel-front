import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  createGame,
  startGame,
  spawnUnit,
  tick,
  playCard,
  ground,
  terrainIntercept,
  CARDS,
  DECK,
  W,
  DURATION,
  formationPositions,
} from '../game/engine.ts';
import { createCampaignGame } from '../game/campaign-game.ts';
import { MISSIONS, advanceCampaign, campaignResult } from '../game/campaign.ts';
import {
  trenchCutDepth,
  trenchProtection,
  MAX_TRENCH_DEPTH,
} from '../game/squad-orders.ts';

const out = path.resolve('output/v21-campaign-qa');
fs.mkdirSync(out, { recursive: true });
const results = [],
  failures = [],
  DT = 1 / 30;
function check(name, fn) {
  if (
    process.env.TEST_FILTER &&
    !new RegExp(process.env.TEST_FILTER).test(name)
  )
    return;
  try {
    const details = fn();
    results.push({ name, ...details });
    console.log('PASS', name, JSON.stringify(details));
  } catch (error) {
    failures.push({ name, error: error.stack });
    console.error('FAIL', name, error.stack);
  }
}
const fresh = (id, seed = 2111) =>
  createCampaignGame(seed, DECK, id, 'veteran');
function goalState(id) {
  const s = createGame(2111);
  startGame(s);
  s.aiIn = 1e9;
  s.scenery = [];
  s.walls = [];
  s.terrain.fill(374);
  s.original.fill(374);
  const m = MISSIONS.find((m) => m.id === id);
  s.campaign = {
    id,
    objective: m.objective,
    objectiveX: m.objectiveX,
    duration: m.duration,
    captureProgress: 0,
    waveIndex: m.waves.length,
    initialCamera: m.camera,
  };
  return s;
}
function advance(s, seconds) {
  for (let i = 0; i < Math.round(seconds / DT); i++) tick(s, DT);
}
for (const m of MISSIONS) {
  check(
    `${m.id}: creates repeatably with authored map, real completed earth and armed mines`,
    () => {
      const s = fresh(m.id),
        again = fresh(m.id),
        otherSeed = fresh(m.id, 2177);
      assert.equal(s.status, 'ready');
      assert.equal(s.mapId, m.mapId);
      assert.equal(s.time, 0);
      assert.deepEqual(s, again);
      assert.equal(otherSeed.mapId, m.mapId);
      assert.equal(
        s.units.length,
        m.opening.reduce((n, d) => n + (CARDS[d.id].members ?? 1), 0),
      );
      const dug = m.opening.filter((d) => d.dugIn).length;
      assert.equal(s.entrenchments.length, dug);
      assert.equal(s.mines.length, dug * 2);
      assert.ok(
        s.mines.every(
          (mine) => mine.kind === 'antipersonnel' && mine.armAt === 0,
        ),
      );
      const trenches = s.entrenchments.map((t) => {
        assert.equal(t.built, true);
        assert.equal(t.progress, 1);
        assert.equal(t.minesLaid, true);
        let maxDepth = 0,
          maxStep = 0,
          maxOriginalStep = 0;
        for (
          let x = Math.ceil(t.x - t.radius);
          x <= Math.floor(t.x + t.radius);
          x++
        ) {
          const expected = trenchCutDepth(s, t, x);
          assert.ok(s.terrain[x] + 1e-6 >= s.original[x] + expected);
          maxDepth = Math.max(maxDepth, s.terrain[x] - s.original[x]);
          maxStep = Math.max(
            maxStep,
            Math.abs(s.terrain[x] - s.terrain[x - 1]),
          );
          maxOriginalStep = Math.max(
            maxOriginalStep,
            Math.abs(s.original[x] - s.original[x - 1]),
          );
        }
        assert.ok(maxDepth >= 25);
        // The 25px bank eases with smoothstep (maximum derivative 1.5). Include
        // the original terrain grade instead of imposing a flat-map slope cap.
        assert.ok(
          maxStep <= maxOriginalStep + (MAX_TRENCH_DEPTH * 1.5) / 25 + 1e-6,
          'earth must have smooth authored banks, not a vertical cut',
        );
        const occupants = s.units.filter(
            (u) => u.squad === t.squad && u.side === t.side,
          ),
          u = occupants[0];
        for (const member of occupants) {
          assert.ok(Math.abs(member.x - member.squadOrderX) < 1e-8);
          assert.equal(member.y, ground(s, member.x));
        }
        assert.ok(trenchProtection(s, u.x) > 0.2);
        const sx = t.x + (t.side === 0 ? 1 : -1) * (t.radius + 60);
        assert.ok(
          terrainIntercept(s, sx, ground(s, sx) - 12, u.x, u.y - 8, true, true),
          'earth must physically intercept a low incoming ray',
        );
        return {
          x: t.x,
          radius: t.radius,
          maxDepth,
          maxStep,
          protection: trenchProtection(s, u.x),
        };
      });
      for (let i = 0; i < s.entrenchments.length; i++)
        for (let j = i + 1; j < s.entrenchments.length; j++) {
          const a = s.entrenchments[i],
            b = s.entrenchments[j];
          assert.ok(
            Math.abs(a.x - b.x) >= a.radius + b.radius + 28,
            'prepared chambers must not overlap',
          );
        }
      fs.writeFileSync(
        path.join(out, `${m.id}-initial-state.json`),
        JSON.stringify(s),
      );
      const guards = s.units.filter(
        (u) =>
          u.side === 1 &&
          CARDS[u.id].members &&
          Math.abs(u.x - m.objectiveX) <= 210,
      );
      if (m.objective === 'capture')
        assert.ok(
          guards.length > 0,
          'the relay must start with defenders inside its actual contest radius',
        );
      return {
        map: s.mapId,
        units: s.units.length,
        mines: s.mines.length,
        trenches,
        objectiveGuards: guards.map((u) => ({ id: u.id, x: u.x })),
      };
    },
  );
}
check(
  'ordinary match has no chapter troops, terrain edits, waves or chapter deadline',
  () => {
    const s = createGame(2111);
    assert.equal(s.campaign, undefined);
    assert.equal(s.units.length, 0);
    assert.equal(s.mines.length, 0);
    assert.deepEqual(s.terrain, s.original);
    startGame(s);
    s.aiIn = 1e9;
    s.time = 179.99;
    tick(s, DT);
    assert.equal(s.status, 'playing');
    assert.equal(s.units.length, 0);
    assert.equal(campaignResult(s), null);
    s.time = DURATION - DT / 2;
    tick(s, DT);
    assert.equal(s.status, 'finished');
    assert.equal(s.result, 'draw');
    return { duration: DURATION };
  },
);
check(
  'preplaced antipersonnel mines trigger through the actual engine against an enemy infantryman',
  () => {
    const s = fresh('salt-road');
    startGame(s);
    s.aiIn = 1e9;
    const mine = s.mines[0];
    spawnUnit(s, 1 - mine.side, 'infantry', mine.x, { member: 0 });
    const victim = s.units.at(-1),
      hp = victim.hp;
    for (const u of s.units) {
      u.cooldown = 1e9;
      u.secondaryCooldown = 1e9;
    }
    tick(s, DT);
    assert.ok(!s.mines.includes(mine));
    assert.ok(victim.hp < hp || victim.wounded);
    assert.ok(s.blasts.some((b) => b.kind === 'grenade'));
    return {
      x: mine.x,
      hpBefore: hp,
      hpAfter: victim.hp,
      wounded: victim.wounded,
    };
  },
);
for (const m of MISSIONS)
  check(
    `${m.id}: timed waves spawn once and pause/ready never advances them`,
    () => {
      const s = fresh(m.id);
      s.aiIn = 1e9;
      s.time = m.waves[0].at - DT / 2;
      const count = s.units.length;
      tick(s, DT);
      assert.equal(s.units.length, count);
      assert.equal(s.campaign.waveIndex, 0);
      startGame(s);
      s.status = 'paused';
      tick(s, DT);
      assert.equal(s.campaign.waveIndex, 0);
      s.status = 'playing';
      tick(s, DT);
      const firstCount = m.waves[0].cards.reduce(
        (n, id) => n + (CARDS[id].members ?? 1),
        0,
      );
      assert.equal(s.campaign.waveIndex, 1);
      assert.equal(s.units.length, count + firstCount);
      const firstIds = s.units.map((u) => u.uid);
      tick(s, DT);
      assert.deepEqual(
        s.units.map((u) => u.uid),
        firstIds,
      );
      const calls = [];
      s.time = m.waves.at(-1).at;
      advanceCampaign(s, 0, (state, side, id, x) =>
        calls.push({ side, id, x }),
      );
      assert.equal(
        calls.length,
        m.waves.slice(1).reduce((n, w) => n + w.cards.length, 0),
      );
      assert.ok(calls.every((c) => c.side === 1 && c.x >= W - 400));
      const after = calls.length;
      advanceCampaign(s, 0, (...args) => calls.push(args));
      assert.equal(calls.length, after);
      return {
        firstCount,
        totalWaves: s.campaign.waveIndex,
        laterCalls: calls,
      };
    },
  );
for (const m of MISSIONS)
  check(
    `${m.id}: reinforcements played by either side start at their actual HQ`,
    () => {
      const s = fresh(m.id);
      startGame(s);
      for (const side of [0, 1]) {
        const card = { uid: ++s.uid, id: 'militia' };
        s.players[side].hand = [card];
        const before = s.units.length;
        const result = playCard(s, side, card.uid, side === 0 ? 3000 : 700);
        assert.equal(result.ok, true, result.message);
        assert.deepEqual(
          s.units.slice(before).map((u) => u.x),
          formationPositions(side, 'militia', side === 0 ? 112 : W - 112),
        );
      }
      return {};
    },
  );
check(
  'defend wins at its exact deadline, can win early by destroying the enemy, and simultaneous base loss cannot win',
  () => {
    const s = goalState('salt-road');
    s.time = 179.99;
    assert.equal(campaignResult(s), null);
    s.time = 180;
    assert.equal(campaignResult(s), 0);
    s.time = 20;
    s.players[1].hp = 0;
    assert.equal(campaignResult(s), 0);
    s.players[0].hp = 0;
    assert.equal(campaignResult(s), 1);
    tick(s, DT);
    assert.equal(s.status, 'finished');
    assert.equal(s.result, 1);
    return {};
  },
);
check(
  'capture needs 15 seconds of uncontested infantry, and contest/absence drains progress',
  () => {
    const s = goalState('ridge-relay'),
      x = s.campaign.objectiveX;
    spawnUnit(s, 0, 'infantry', x, { member: 0 });
    advanceCampaign(s, 14.9, spawnUnit);
    assert.equal(s.campaign.captureProgress, 14.9);
    assert.equal(campaignResult(s), null);
    spawnUnit(s, 1, 'infantry', x + 150, { member: 0 });
    advanceCampaign(s, 1, spawnUnit);
    assert.equal(s.campaign.captureProgress, 12.9);
    s.units[1].hp = 0;
    advanceCampaign(s, 2.1, spawnUnit);
    assert.equal(s.campaign.captureProgress, 15);
    assert.equal(campaignResult(s), 0);
    s.campaign.captureProgress = 5;
    s.units[0].x = x - 131;
    advanceCampaign(s, 1, spawnUnit);
    assert.equal(s.campaign.captureProgress, 3);
    return {};
  },
);
for (const excluded of [
  'wounded',
  'dead',
  'surrendered',
  'rappelling',
  'tank',
  'helicopter',
])
  check(`capture excludes ${excluded} as an occupying infantryman`, () => {
    const s = goalState('ridge-relay'),
      id = ['tank', 'helicopter'].includes(excluded) ? excluded : 'infantry';
    spawnUnit(
      s,
      0,
      id,
      s.campaign.objectiveX,
      id === 'infantry' ? { member: 0 } : undefined,
    );
    const u = s.units[0];
    if (excluded === 'dead') u.hp = 0;
    else if (id === 'infantry') u[excluded] = true;
    advanceCampaign(s, 15, spawnUnit);
    assert.equal(s.campaign.captureProgress, 0);
    assert.equal(campaignResult(s), null);
    return {};
  });
check(
  'capture deadline loses before completion, enemy destruction wins, own destruction always loses',
  () => {
    const s = goalState('ridge-relay');
    s.time = 300;
    s.campaign.captureProgress = 14.9;
    assert.equal(campaignResult(s), 1);
    s.players[1].hp = 0;
    assert.equal(campaignResult(s), 0);
    s.players[0].hp = 0;
    assert.equal(campaignResult(s), 1);
    return {};
  },
);
check(
  'assault requires enemy base destruction within 360 seconds and simultaneous loss cannot win',
  () => {
    const s = goalState('river-counterattack');
    s.time = 359.9;
    assert.equal(campaignResult(s), null);
    s.time = 360;
    assert.equal(campaignResult(s), 1);
    s.players[1].hp = 0;
    assert.equal(campaignResult(s), 0);
    s.players[0].hp = 0;
    assert.equal(campaignResult(s), 1);
    tick(s, DT);
    assert.equal(s.result, 1);
    return {};
  },
);
check(
  'an infantryman killed during the final capture frame cannot complete the objective',
  () => {
    const s = goalState('ridge-relay'),
      x = s.campaign.objectiveX;
    spawnUnit(s, 0, 'infantry', x, { member: 0 });
    const u = s.units[0];
    u.hp = 1;
    u.cooldown = 1e9;
    s.campaign.captureProgress = 15 - DT / 2;
    s.projectiles.push({
      uid: ++s.uid,
      x,
      y: u.y - 12,
      startX: x,
      startY: u.y - 12,
      tx: x,
      ty: u.y - 12,
      side: 1,
      targetUid: u.uid,
      base: null,
      damage: 10000,
      radius: 30,
      total: DT / 2,
      life: DT / 2,
      ammunition: 'mortar',
      effect: 'artillery',
    });
    tick(s, DT);
    assert.ok(u.hp <= 0 || u.wounded);
    assert.notEqual(
      s.result,
      0,
      'capture resolved before the occupying soldier was killed in the same frame',
    );
    return {
      status: s.status,
      result: s.result,
      progress: s.campaign.captureProgress,
    };
  },
);
for (const m of MISSIONS)
  check(
    `${m.id}: official chapter parameters operate for 30 seconds with real economy/AI`,
    () => {
      const s = fresh(m.id);
      startGame(s);
      const initialCount = s.units.length;
      advance(s, 30);
      assert.equal(s.status, 'playing');
      assert.ok(Math.abs(s.time - 30) < 1e-7);
      assert.ok(s.players[1].played > 0, 'real AI must actually play a card');
      assert.ok(
        s.units.every(
          (u) =>
            Number.isFinite(u.x) &&
            Number.isFinite(u.y) &&
            Number.isFinite(u.hp),
        ),
      );
      assert.ok(s.terrain.every(Number.isFinite));
      assert.ok(
        s.players.every((p) => p.energy >= 0 && p.energy <= p.energyCap),
      );
      fs.writeFileSync(
        path.join(out, `${m.id}-30s-state.json`),
        JSON.stringify(s),
      );
      return {
        time: s.time,
        units: [initialCount, s.units.length],
        hp: s.players.map((p) => p.hp),
        energy: s.players.map((p) => p.energy),
        played: s.players.map((p) => p.played),
        kills: s.players.map((p) => p.kills),
        waves: s.campaign.waveIndex,
        projectiles: s.projectiles.length,
        explosions: s.explosions,
      };
    },
  );
fs.writeFileSync(
  path.join(out, 'checks.json'),
  JSON.stringify({ results, failures }, null, 2),
);
console.log(`${results.length} passed, ${failures.length} failed`);
if (failures.length) process.exitCode = 1;
