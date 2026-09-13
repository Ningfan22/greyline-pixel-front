import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createGame,
  startGame,
  spawnUnit,
  tick,
  CARDS,
  DECK,
} from '../game/engine.ts';
import { createCampaignGame } from '../game/campaign-game.ts';
import {
  MISSIONS,
  isMissionId,
  advanceCampaign,
  campaignResult,
} from '../game/campaign.ts';

const out = 'output/v22-story-qa';
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
function bare(m) {
  const s = createGame(22022);
  startGame(s);
  s.aiIn = 1e9;
  s.scenery = [];
  s.walls = [];
  s.terrain.fill(374);
  s.original.fill(374);
  s.campaign = {
    id: m.id,
    objective: m.objective,
    objectiveX: m.objectiveX,
    duration: m.duration,
    captureProgress: 0,
    waveIndex: m.waves.length,
    hintIndex: m.phaseHints.length,
    initialCamera: m.camera,
  };
  return s;
}
check(
  'six sequential chapters preserve saved IDs and all original three deployments, deadlines and wave timings',
  () => {
    assert.equal(MISSIONS.length, 6);
    assert.deepEqual(
      MISSIONS.slice(0, 3).map((m) => m.id),
      ['salt-road', 'ridge-relay', 'river-counterattack'],
    );
    assert.deepEqual(
      MISSIONS.slice(0, 3).map((m) => m.duration),
      [180, 300, 360],
    );
    assert.deepEqual(
      MISSIONS.slice(0, 3).map((m) =>
        m.opening.map((d) => [d.side, d.id, d.x, !!d.dugIn, !!d.guard]),
      ),
      [
        [
          [0, 'infantry', 1400, true, false],
          [0, 'infantry', 1190, true, false],
          [0, 'machinegun', 1610, true, false],
        ],
        [
          [0, 'tank', 950, false, false],
          [0, 'infantry', 830, false, false],
          [0, 'infantry', 660, false, false],
          [1, 'infantry', 2590, true, false],
          [1, 'machinegun', 2820, true, false],
          [1, 'antiarmor', 2970, true, false],
          [1, 'armed_police', 2590, false, true],
        ],
        [
          [0, 'infantry', 1320, true, false],
          [0, 'infantry', 1120, true, false],
          [0, 'tank', 980, false, false],
          [1, 'machinegun', 2560, true, false],
          [1, 'antiarmor', 2780, true, false],
          [1, 'ifv', 3000, false, false],
        ],
      ],
    );
    assert.deepEqual(
      MISSIONS.slice(0, 3).map((m) => m.waves.map((w) => w.at)),
      [
        [8, 60, 118],
        [90, 180],
        [85, 175],
      ],
    );
    assert.ok(MISSIONS[2].victory.includes('雨林'));
    const completed = MISSIONS.slice(0, 3)
      .map((m) => m.id)
      .filter(isMissionId);
    assert.deepEqual(completed, [
      'salt-road',
      'ridge-relay',
      'river-counterattack',
    ]);
    assert.equal(
      MISSIONS.find((m) => !completed.includes(m.id)).id,
      'canopy-signal',
    );
    assert.equal(isMissionId('unknown'), false);
    return { ids: MISSIONS.map((m) => m.id), nextAfterOldSave: MISSIONS[3].id };
  },
);
for (const m of MISSIONS)
  check(
    `${m.id}: deterministic initialization and 20 real seconds with normal AI, economy and finite terrain`,
    () => {
      const s = createCampaignGame(22022, DECK, m.id, 'veteran');
      assert.deepEqual(s, createCampaignGame(22022, DECK, m.id, 'veteran'));
      assert.equal(s.status, 'ready');
      assert.equal(s.mapId, m.mapId);
      assert.deepEqual(
        s.players.map((p) => p.energy),
        [2, 2],
      );
      const expected = m.opening.reduce(
        (n, d) => n + (CARDS[d.id].members ?? 1),
        0,
      );
      assert.equal(s.units.length, expected);
      const trenches = m.opening.filter((d) => d.dugIn).length;
      assert.equal((s.entrenchments ?? []).length, trenches);
      assert.equal(s.mines.length, trenches * 2);
      assert.ok(
        (s.entrenchments ?? []).every((t) => t.built && t.progress === 1),
      );
      assert.ok(
        m.openingDialogue.length >= 3 &&
          m.openingDialogue.every(
            (line) =>
              line.speaker && line.text.length > 15 && line.text.length <= 90,
          ),
      );
      assert.ok(
        m.phaseHints.length >= 2 &&
          m.phaseHints.every(
            (h, i) =>
              h.at > 0 &&
              h.at < m.duration &&
              (!i || h.at > m.phaseHints[i - 1].at),
          ),
      );
      if (m.objective === 'capture')
        assert.ok(
          s.units.some(
            (u) =>
              u.side === 1 &&
              CARDS[u.id].members &&
              Math.abs(u.x - m.objectiveX) <= 210,
          ),
        );
      startGame(s);
      for (let i = 0; i < 600; i++) tick(s, DT);
      assert.equal(s.status, 'playing');
      assert.ok(Math.abs(s.time - 20) < 1e-8);
      assert.ok(s.players[1].played > 0);
      assert.equal(s.players[0].played, 0);
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
      return {
        map: m.mapId,
        initial: expected,
        units: s.units.length,
        hq: s.players.map((p) => p.hp),
        aiPlayed: s.players[1].played,
        trenches,
        waves: s.campaign.waveIndex,
      };
    },
  );
for (const m of MISSIONS)
  check(
    `${m.id}: radio hints wait while paused, emit once and keep resource state unchanged`,
    () => {
      const s = createCampaignGame(22022, DECK, m.id, 'veteran');
      startGame(s);
      s.aiIn = 1e9;
      s.campaign.waveIndex = m.waves.length;
      s.time = m.phaseHints[0].at - DT / 2;
      s.status = 'paused';
      const energy = s.players.map((p) => p.energy),
        pausedNotices = structuredClone(s.notices);
      tick(s, DT);
      assert.equal(s.campaign.hintIndex, 0);
      assert.deepEqual(s.notices, pausedNotices);
      assert.deepEqual(
        s.players.map((p) => p.energy),
        energy,
      );
      s.status = 'playing';
      tick(s, DT);
      const first = m.phaseHints[0].text;
      assert.equal(s.notices.filter((n) => n.text === first).length, 1);
      assert.equal(s.campaign.hintIndex, 1);
      tick(s, DT);
      assert.equal(s.notices.filter((n) => n.text === first).length, 1);
      const before = s.players.map((p) => ({
        energy: p.energy,
        played: p.played,
        hand: p.hand.map((c) => c.uid),
      }));
      s.time = m.phaseHints.at(-1).at;
      advanceCampaign(s, 0, () => {
        throw new Error('all waves already marked delivered');
      });
      assert.equal(s.campaign.hintIndex, m.phaseHints.length);
      assert.deepEqual(
        s.players.map((p) => ({
          energy: p.energy,
          played: p.played,
          hand: p.hand.map((c) => c.uid),
        })),
        before,
      );
      for (const h of m.phaseHints)
        assert.equal(s.notices.filter((n) => n.text === h.text).length, 1);
      const notices = structuredClone(s.notices);
      advanceCampaign(s, 0, () => {});
      assert.deepEqual(s.notices, notices);
      return { hints: m.phaseHints.length };
    },
  );
for (const m of MISSIONS.slice(3))
  check(
    `${m.id}: new chapter victory, defeat and announced reinforcement rules use the real campaign APIs`,
    () => {
      const s = bare(m);
      assert.equal(campaignResult(s), null);
      if (m.objective === 'capture') {
        spawnUnit(s, 0, 'infantry', m.objectiveX, { member: 0 });
        advanceCampaign(s, 14.9, spawnUnit);
        assert.equal(campaignResult(s), null);
        spawnUnit(s, 1, 'infantry', m.objectiveX + 160, { member: 0 });
        advanceCampaign(s, 1, spawnUnit);
        assert.equal(s.campaign.captureProgress, 12.9);
        s.units[1].hp = 0;
        advanceCampaign(s, 2.1, spawnUnit);
        assert.equal(campaignResult(s), 0);
        s.campaign.captureProgress = 0;
      }
      s.time = m.duration - DT / 2;
      assert.equal(campaignResult(s), null);
      tick(s, DT);
      assert.equal(s.status, 'finished');
      assert.equal(s.result, m.objective === 'defend' ? 0 : 1);
      s.players[1].hp = 0;
      assert.equal(campaignResult(s), 0);
      s.players[0].hp = 0;
      assert.equal(campaignResult(s), 1);
      const w = bare(m),
        calls = [];
      w.campaign.waveIndex = 0;
      w.time = m.waves.at(-1).at;
      const energy = w.players.map((p) => p.energy),
        cards = w.players.map((p) => p.hand.map((c) => c.uid));
      advanceCampaign(w, 0, (_s, side, id, x) => calls.push({ side, id, x }));
      assert.equal(
        calls.length,
        m.waves.reduce((n, w) => n + w.cards.length, 0),
      );
      assert.equal(w.campaign.waveIndex, m.waves.length);
      assert.ok(
        calls.every((c) => c.side === 1 && c.x >= w.terrain.length - 400),
      );
      assert.deepEqual(
        w.players.map((p) => p.energy),
        energy,
      );
      assert.deepEqual(
        w.players.map((p) => p.hand.map((c) => c.uid)),
        cards,
      );
      const count = calls.length;
      advanceCampaign(w, 0, () => calls.push(null));
      assert.equal(calls.length, count);
      return {
        objective: m.objective,
        duration: m.duration,
        waves: m.waves.map((w) => w.at),
        reinforcementCards: count,
      };
    },
  );
fs.writeFileSync(
  `${out}/checks.json`,
  JSON.stringify({ results, failures }, null, 2),
);
console.log(`${results.length} passed, ${failures.length} failed`);
if (failures.length) process.exitCode = 1;
