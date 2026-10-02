import assert from 'node:assert/strict';
import test from 'node:test';
import { CARDS, W, MAX_HP, startGame, spawnUnit, tick, ground } from '../game/engine.ts';
import { createCampaignGame } from '../game/campaign-game.ts';
import {
  MISSIONS,
  isMissionId,
  missionById,
  missionDeck,
  missionUnlocked,
  campaignProgress,
  campaignResult,
  advanceCampaign,
} from '../game/campaign.ts';
import { AI_DECKS, DECK_PRESETS } from '../game/deck-presets.ts';
import { setSquadOrder } from '../game/squad-orders.ts';

const DT = 1 / 30;
const OLD_IDS = [
  'salt-road', 'ridge-relay', 'river-counterattack',
  'canopy-signal', 'last-convoy', 'silent-terminal',
];
const fresh = (m, seed = 19420) =>
  createCampaignGame(seed, missionDeck(m.id), m.id, 'veteran');
function advance(s, seconds) {
  for (let i = 0; i < Math.round(seconds / DT); i++) tick(s, DT);
}
function isolatedObjective(m) {
  const s = fresh(m);
  startGame(s);
  s.aiIn = 1e9;
  s.units = [];
  s.scenery = [];
  s.walls = [];
  s.mines = [];
  s.projectiles = [];
  s.entrenchments = [];
  s.terrain.fill(374);
  s.original.fill(374);
  s.weather.disabled = true;
  s.campaign.waveIndex = m.waves.length;
  s.campaign.hintIndex = m.phaseHints.length;
  s.campaign.reinforcementIndex = m.reinforcements?.length ?? 0;
  return s;
}
function occupant(s, side, x, id = 'infantry') {
  spawnUnit(s, side, id, x, CARDS[id].members ? { member: 0 } : undefined);
  const u = s.units.at(-1);
  u.cooldown = 1e9;
  u.secondaryCooldown = 1e9;
  if (CARDS[id].members) {
    assert.equal(setSquadOrder(s, side, u.squad, 'watch').ok, true);
    u.x = x;
    u.y = ground(s, x);
    u.squadOrderX = x;
  }
  return u;
}

test('the campaign has twenty distinct missions, four five-mission acts and a complete authored scenario for every mission', () => {
  assert.equal(MISSIONS.length, 20);
  assert.equal(new Set(MISSIONS.map((m) => m.id)).size, 20);
  assert.deepEqual(MISSIONS.slice(0, 6).map((m) => m.id), OLD_IDS);
  assert.deepEqual([1, 2, 3, 4].map((act) => MISSIONS.filter((m) => m.act === act).length), [5, 5, 5, 5]);
  assert.deepEqual(MISSIONS.map((m) => m.act), Array.from({ length: 20 }, (_, i) => Math.floor(i / 5) + 1));
  assert.ok(MISSIONS.some((m) => m.night));
  assert.ok(MISSIONS.some((m) => (m.capturePoints?.length ?? 0) > 1));
  assert.ok(MISSIONS.some((m) => m.reinforcements?.length));
  for (const m of MISSIONS) {
    assert.equal(isMissionId(m.id), true);
    assert.equal(missionById(m.id).id, m.id);
    assert.ok(m.title && m.chapter && m.actTitle && m.region);
    for (const text of [m.briefing, m.goal, m.preparation, m.victory, m.defeat]) assert.ok(text?.length > 10, `${m.id}: incomplete narrative`);
    assert.ok(m.openingDialogue.length >= 3);
    assert.ok(m.phaseHints.length >= 2);
    assert.ok(m.duration > 30 && m.objectiveX > 120 && m.objectiveX < W - 120);
    assert.ok(AI_DECKS[m.aiDeck], `${m.id}: invalid enemy plan`);
    assert.ok(DECK_PRESETS[m.playerDeck], `${m.id}: invalid recommended plan`);
    const deck = missionDeck(m.id);
    assert.equal(deck.length, 20);
    assert.ok(deck.every((id) => CARDS[id] && !CARDS[id].internal));
    assert.deepEqual(deck, DECK_PRESETS[m.playerDeck].cards);
    assert.notEqual(deck, DECK_PRESETS[m.playerDeck].cards, 'recommended deck edits must not mutate the shared template');
    assert.ok(AI_DECKS[m.aiDeck].every((id) => CARDS[id] && !CARDS[id].internal));
    assert.ok(m.opening.some((d) => d.side === 0), `${m.id}: no initial friendly force`);
    for (const d of m.opening) {
      assert.equal(CARDS[d.id]?.type, 'unit', `${m.id}: opening ${d.id} cannot be spawned`);
      assert.ok(d.x > 120 && d.x < W - 120);
      assert.ok(d.side === 0 || d.side === 1);
      if (d.dugIn) assert.ok(CARDS[d.id].members, `${m.id}: only infantry can prepare a trench`);
    }
    for (const group of [m.waves, m.phaseHints, m.reinforcements ?? []])
      group.forEach((event, i) => {
        assert.ok(event.at > 0 && event.at < m.duration, `${m.id}: event outside the battle window`);
        assert.ok(!i || event.at > group[i - 1].at, `${m.id}: events must have unique increasing times`);
        if (event.cards) {
          assert.ok(event.cards.length > 0);
          assert.ok(event.message);
          for (const id of event.cards) assert.equal(CARDS[id]?.type, 'unit', `${m.id}: reinforcement ${id} is not a unit`);
        }
      });
    for (const point of m.capturePoints ?? []) {
      assert.ok(point.x > 120 && point.x < W - 120);
      assert.ok(point.label && point.seconds > 0 && point.seconds < m.duration);
    }
  }
  assert.equal(isMissionId('missing-mission'), false);
});

test('saved six-mission campaigns unlock mission seven and all twenty chapters connect to a finished, replayable campaign', () => {
  const migrated = [...OLD_IDS, OLD_IDS[0], 'unknown-save-id'];
  assert.equal(missionUnlocked(MISSIONS[6].id, migrated), true);
  assert.equal(missionUnlocked(MISSIONS[7].id, migrated), false);
  assert.deepEqual(campaignProgress(migrated), { completed: 6, total: 20, next: MISSIONS[6].id, finished: false });
  const completed = [];
  for (let i = 0; i < MISSIONS.length; i++) {
    const m = MISSIONS[i];
    assert.equal(missionUnlocked(m.id, completed), true);
    if (i + 1 < MISSIONS.length) assert.equal(missionUnlocked(MISSIONS[i + 1].id, completed), false);
    assert.deepEqual(campaignProgress(completed), { completed: i, total: 20, next: m.id, finished: false });
    completed.push(m.id);
    assert.equal(missionUnlocked(m.id, completed), true, 'completed chapters remain replayable');
  }
  assert.deepEqual(campaignProgress(completed), { completed: 20, total: 20, next: null, finished: true });
  assert.equal(missionUnlocked('missing-mission', completed), false);
});

for (const m of MISSIONS) {
  test(`${m.id}: recommended and enemy decks, night, mission resources, authored troops and real AI operate for twenty seconds`, (t) => {
    const s = fresh(m);
    assert.equal(s.status, 'ready');
    assert.equal(s.time, 0);
    assert.equal(s.mapId, m.mapId);
    assert.equal(s.night, !!m.night);
    assert.deepEqual(s.players[0].loadout, missionDeck(m.id));
    assert.deepEqual(s.players[1].loadout, AI_DECKS[m.aiDeck]);
    assert.equal(s.players[0].energy, m.startingEnergy ?? 2);
    assert.equal(s.players[1].energy, 0);
    assert.equal(s.players[0].hp, m.playerBaseHp ?? MAX_HP);
    assert.equal(s.players[1].hp, m.enemyBaseHp ?? MAX_HP);
    assert.equal(s.units.length, m.opening.reduce((n, d) => n + (CARDS[d.id].members ?? 1), 0));
    if (m.objective === 'capture') {
      assert.equal(s.campaign.objectiveX, m.capturePoints?.[0].x ?? m.objectiveX);
      assert.equal(s.campaign.captureRequired, m.capturePoints?.[0].seconds ?? 15);
      assert.equal(s.campaign.objectiveIndex, 0);
    }
    startGame(s);
    advance(s, 20);
    assert.equal(s.status, 'playing', `${m.id}: the mission ends before its opening develops`);
    assert.ok(Math.abs(s.time - 20) < 1e-8);
    assert.ok(s.players[1].played > 0, `${m.id}: AI never played a card`);
    assert.equal(s.players[0].played, 0);
    assert.ok(s.units.every((u) => Number.isFinite(u.x) && Number.isFinite(u.y) && Number.isFinite(u.hp)));
    assert.ok(s.terrain.every(Number.isFinite));
    assert.ok(s.campaign.waveIndex >= 0 && s.campaign.waveIndex <= m.waves.length);
    assert.ok(s.players.every((p) => p.energy >= 0 && Number.isFinite(p.energy)));
    t.diagnostic(JSON.stringify({ aiPlayed: s.players[1].played, bases: s.players.map((p) => p.hp), units: s.units.length }));
  });
}

for (const m of MISSIONS.filter((mission) => (mission.capturePoints?.length ?? 0) > 1))
  test(`${m.id}: capture advances in order, contests stop capture, and only the final completed objective wins`, () => {
    const s = isolatedObjective(m);
    const points = m.capturePoints;
    const soldier = occupant(s, 0, points[0].x);
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      assert.equal(s.campaign.objectiveIndex, i);
      assert.equal(s.campaign.objectiveX, point.x);
      assert.equal(s.campaign.objectiveLabel, point.label);
      assert.equal(s.campaign.captureRequired, point.seconds);
      soldier.x = point.x;
      soldier.y = ground(s, point.x);
      soldier.squadOrderX = point.x;
      advance(s, 1);
      assert.ok(s.campaign.captureProgress > 0 && s.campaign.captureProgress < point.seconds);
      const enemy = occupant(s, 1, point.x + 160);
      const progress = s.campaign.captureProgress;
      advance(s, 0.25);
      assert.ok(s.campaign.captureProgress < progress, 'nearby enemy defenders contest and drain progress');
      s.units = s.units.filter((u) => u.uid !== enemy.uid);
      s.campaign.captureProgress = point.seconds - DT / 2;
      tick(s, DT);
      if (i < points.length - 1) {
        assert.equal(s.status, 'playing');
        assert.equal(campaignResult(s), null);
        assert.equal(s.campaign.objectiveIndex, i + 1);
        assert.equal(s.campaign.captureProgress, 0);
      } else {
        assert.equal(s.status, 'finished');
        assert.equal(s.result, 0);
        assert.equal(campaignResult(s), 0);
      }
    }
  });

for (const m of MISSIONS.filter((mission) => mission.reinforcements?.length))
  test(`${m.id}: scheduled friendly relief arrives at the authored place once, without charging cards or command points`, () => {
    const s = isolatedObjective(m);
    s.campaign.reinforcementIndex = 0;
    for (const [i, wave] of m.reinforcements.entries()) {
      s.time = wave.at - DT / 2;
      const before = new Set(s.units.map((u) => u.uid));
      const played = s.players[0].played;
      const energy = s.players[0].energy;
      const hand = s.players[0].hand.map((h) => h.uid);
      tick(s, DT);
      const relief = s.units.filter((u) => !before.has(u.uid));
      assert.equal(s.campaign.reinforcementIndex, i + 1);
      assert.equal(relief.length, wave.cards.reduce((n, id) => n + (CARDS[id].members ?? 1), 0));
      assert.ok(relief.every((u) => u.side === 0 && wave.cards.includes(u.id)));
      assert.ok(Math.abs(Math.max(...relief.map((u) => u.x)) - wave.x) < 1, 'the lead unit must arrive at the authored reinforcement point');
      assert.ok(relief.every((u) => u.x >= 112 && u.x < W / 2), 'friendly relief must enter from its own rear');
      assert.equal(s.players[0].played, played);
      assert.ok(s.players[0].energy >= energy, 'scheduled relief must not charge deployment points');
      assert.deepEqual(s.players[0].hand.map((h) => h.uid), hand);
      assert.equal(s.notices.filter((n) => n.text === wave.message).length, 1);
      const ids = s.units.map((u) => u.uid);
      tick(s, DT);
      assert.deepEqual(s.units.map((u) => u.uid), ids, 'relief must not duplicate on the next frame');
    }
  });

test('paused and ready missions never advance radio, reinforcement or capture clocks, including direct campaign calls', () => {
  const m = MISSIONS.find((mission) => mission.reinforcements?.length && mission.objective === 'capture')
    ?? MISSIONS.find((mission) => mission.reinforcements?.length);
  const s = fresh(m);
  s.time = Math.max(m.waves[0].at, m.phaseHints[0].at, m.reinforcements[0].at) + 1;
  for (const status of ['ready', 'paused']) {
    s.status = status;
    const before = structuredClone(s);
    tick(s, DT);
    advanceCampaign(s, 1, spawnUnit);
    assert.deepEqual(s, before, `${status} mission advanced a battle clock`);
  }
  s.status = 'playing';
  tick(s, DT);
  assert.ok(s.campaign.waveIndex > 0 && s.campaign.hintIndex > 0 && s.campaign.reinforcementIndex > 0);
});

for (const m of MISSIONS)
  test(`${m.id}: deadlines resolve objectives, base losses take precedence, and finished missions stop all clocks`, () => {
    const s = isolatedObjective(m);
    s.time = m.duration - DT / 2;
    assert.equal(campaignResult(s), null);
    tick(s, DT);
    assert.equal(s.status, 'finished');
    assert.equal(s.result, m.objective === 'defend' ? 0 : 1);
    assert.ok(s.time < m.duration + DT);
    const finished = structuredClone(s);
    tick(s, 1);
    advanceCampaign(s, 1, spawnUnit);
    assert.deepEqual(s, finished, 'completed battles must not spawn more waves or accrue objectives');
    const base = isolatedObjective(m);
    base.players[1].hp = 0;
    assert.equal(campaignResult(base), 0);
    base.players[0].hp = 0;
    assert.equal(campaignResult(base), 1, 'losing both bases cannot award a victory');
    tick(base, DT);
    assert.equal(base.result, 1);
  });
