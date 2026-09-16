import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  createGame,
  startGame,
  tick,
  spawnUnit,
  explode,
  ground,
  veteranTier,
  veteranSuppression,
  veteranScatter,
  veteranReadiness,
} from '../game/engine.ts';
import { drawVeterancyPips } from '../game/ambience.ts';

const DT = 1 / 60;
const out = path.resolve('output/v92-veterancy-qa');
const results = [],
  failures = [];
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

// Flat open arena, AI director disabled (mirrors v91 harness).
function arena() {
  const s = createGame(92014);
  startGame(s);
  s.terrain.fill(374);
  s.original.fill(374);
  s.walls = [];
  s.scenery = [];
  s.players[1].deck = [];
  s.players[1].discard = [];
  s.players[1].hand = [];
  s.players[1].energy = 0;
  s.players[1].played = 0;
  s.aiIn = 1e9;
  return s;
}

let squadCounter = 920;

// A lone rifleman: 210hp / 6 members = 35hp each.
function rifleman(s, side, x) {
  const before = s.units.length;
  spawnUnit(s, side, 'infantry', x, { member: 0, squad: ++squadCounter });
  return s.units[before];
}

// A shell burst that reliably kills every infantryman near x.
function barrage(s, side, x, sourceUid) {
  explode(
    s,
    x,
    ground(s, x) - 8,
    60,
    260,
    side,
    1,
    1,
    'he',
    1,
    sourceUid,
  );
}

function run(s, seconds) {
  for (let i = 0; i < Math.round(seconds / DT); i++) tick(s, DT);
}

// --- A. Promotion thresholds ---------------------------------------------

check('A. 3/7/12 kills promote through 老兵/精锐/王牌', () => {
  const cases = [
    [0, 0],
    [2, 0],
    [3, 1],
    [6, 1],
    [7, 2],
    [11, 2],
    [12, 3],
    [99, 3],
  ];
  for (const [kills, want] of cases)
    assert.equal(
      veteranTier({ kills }),
      want,
      `${kills} kills should be tier ${want}`,
    );
  assert.equal(veteranTier({}), 0, 'units without a kill count are rookies');
  return { thresholds: '3/7/12' };
});

// --- B. The three combat tables ------------------------------------------

check('B. 老练度压制/散布/据枪衰减表', () => {
  const suppression = [0, 1, 2, 3].map((t) =>
    veteranSuppression({ kills: [0, 3, 7, 12][t] }),
  );
  const scatter = [0, 1, 2, 3].map((t) =>
    veteranScatter({ kills: [0, 3, 7, 12][t] }),
  );
  const readiness = [0, 1, 2, 3].map((t) =>
    veteranReadiness({ kills: [0, 3, 7, 12][t] }),
  );
  assert.deepEqual(suppression, [1, 0.85, 0.72, 0.6]);
  assert.deepEqual(scatter, [1, 0.9, 0.8, 0.7]);
  assert.deepEqual(readiness, [1, 0.85, 0.7, 0.55]);
  return { suppression, scatter, readiness };
});

// --- C. Real kills earn veterancy, symmetric on both sides ---------------

for (const side of [0, 1]) {
  check(`C${side}. 三次击杀晋升老兵（side ${side}）`, () => {
    const s = arena();
    const shooter = rifleman(s, side, 300);
    for (let i = 0; i < 3; i++) rifleman(s, 1 - side, 1500 + i * 14);
    run(s, 0.5); // advance the clock so the promotion stamp is non-zero
    barrage(s, side, 1514, shooter.uid);
    assert.equal(
      shooter.kills ?? 0,
      3,
      'the shooter is credited for all three enemy deaths',
    );
    assert.equal(veteranTier(shooter), 1, 'three kills make a 老兵');
    assert.ok(
      (shooter.veteranAt ?? 0) > 0,
      'the promotion moment is stamped on the unit',
    );
    assert.ok(
      shooter.veteranAt <= s.time,
      'the stamp is not dated in the future',
    );
    const notice = s.notices.find((n) => n.text.includes('老兵'));
    assert.ok(notice, `a promotion notice is broadcast, got: ${JSON.stringify(s.notices[0])}`);
    assert.ok(
      notice.text.includes(side === 0 ? '我方' : '敌方'),
      'the notice names the side that earned it',
    );
    return { kills: shooter.kills, tier: 1, veteranAt: +shooter.veteranAt.toFixed(2) };
  });
}

// --- D. Higher thresholds -------------------------------------------------

check('D. 7 杀精锐、12 杀王牌', () => {
  const s = arena();
  const shooter = rifleman(s, 0, 300);
  for (let i = 0; i < 7; i++) rifleman(s, 1, 1500 + i * 9);
  barrage(s, 0, 1527, shooter.uid);
  assert.equal(shooter.kills, 7);
  assert.equal(veteranTier(shooter), 2);
  assert.ok(s.notices.find((n) => n.text.includes('精锐')), '精锐 notice fired');

  const s2 = arena();
  const ace = rifleman(s2, 0, 300);
  for (let i = 0; i < 12; i++) rifleman(s2, 1, 1500 + i * 5);
  barrage(s2, 0, 1528, ace.uid);
  assert.equal(ace.kills, 12);
  assert.equal(veteranTier(ace), 3);
  assert.ok(s2.notices.find((n) => n.text.includes('王牌')), '王牌 notice fired');
  return { elite: 7, ace: 12 };
});

// --- E. Veterans hold their nerve under the same shell --------------------

check('E. 同等炮击下老兵压制累积更低', () => {
  const s = arena();
  const vet = rifleman(s, 1, 1500);
  vet.kills = 3; // 老兵
  const rookie = rifleman(s, 1, 1500); // same spot, same blast
  // A distant burst: ~26 damage at 58px — hurts, never kills (35hp).
  explode(s, 1558, ground(s, 1558) - 8, 60, 260, 0, 1, 1, 'he', 1);
  assert.ok(vet.hp > 0 && rookie.hp > 0, 'both survive the near miss');
  assert.equal(
    vet.hp,
    rookie.hp,
    'both took identical damage, so the suppression gap is pure veterancy',
  );
  const ratio = vet.suppression / rookie.suppression;
  assert.ok(
    Math.abs(ratio - 0.85) < 0.02,
    `veteran suppression is 85% of rookie, got ${ratio.toFixed(3)}`,
  );
  return {
    vetSuppression: +vet.suppression.toFixed(1),
    rookieSuppression: +rookie.suppression.toFixed(1),
    ratio: +ratio.toFixed(3),
  };
});

// --- F. Friendly fire never earns veterancy -------------------------------

check('F. 友军误伤不计入老练度', () => {
  const s = arena();
  const shooter = rifleman(s, 0, 300);
  for (let i = 0; i < 3; i++) rifleman(s, 0, 1500 + i * 14);
  // An enemy shell (side 1) lands on friendly positions; the blast is
  // attributed to the friendly shooter, mirroring a misdirected fire mission.
  barrage(s, 1, 1514, shooter.uid);
  assert.equal(
    shooter.kills ?? 0,
    0,
    'kills against your own side do not count',
  );
  assert.equal(veteranTier(shooter), 0);
  assert.ok(
    !s.notices.some((n) => n.text.includes('老兵')),
    'no promotion is broadcast for friendly fire',
  );
  return { kills: 0 };
});

// --- G. Render QA: gold chevrons, one pip per tier ------------------------

function recordingCtx() {
  const calls = [];
  const ctx = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'calls') return calls;
        return (...args) => calls.push({ op: String(prop), args });
      },
      set() {
        return true;
      },
    },
  );
  return ctx;
}

check('G. 臂章按军衔绘制且居中排列', () => {
  const lineup = [];
  for (const [kills, want] of [
    [0, 0],
    [3, 1],
    [7, 2],
    [12, 3],
  ]) {
    const ctx = recordingCtx();
    const u = { x: 200, y: 374, kills };
    drawVeterancyPips(ctx, u);
    const fills = ctx.calls.filter((c) => c.op === 'fill').length;
    assert.equal(fills, want, `${kills} kills render ${want} chevron(s)`);
    if (want > 0) {
      const moveTos = ctx.calls
        .filter((c) => c.op === 'moveTo')
        .map((c) => c.args[0]);
      const center =
        moveTos.reduce((a, b) => a + b, 0) / moveTos.length + 2.5;
      assert.ok(
        Math.abs(center - 200) < 0.01,
        `chevrons center on the unit, center=${center.toFixed(1)}`,
      );
    }
    lineup.push({ kills, pips: want });
  }
  return { lineup };
});

fs.writeFileSync(
  path.join(out, 'checks.json'),
  JSON.stringify({ results, failures }, null, 2),
);
console.log(`\n${results.length} checks, ${failures.length} failures`);
if (failures.length) process.exit(1);
