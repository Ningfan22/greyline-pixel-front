import assert from 'node:assert/strict';
import * as E from '../game/engine.ts';
import {
  DIFFICULTY_RATE,
  DEFAULT_DIFFICULTY,
  energyInterval,
  energyLimit,
} from '../game/economy.ts';
import { CARDS, validDeck, copyLimit } from '../game/cards.ts';
import { CARD_COPY } from '../game/card-copy.ts';
import { AI_DECKS, DECK_PRESETS } from '../game/deck-presets.ts';
const results = [];
function test(name, fn) {
  try {
    results.push({ name, ok: true, ...fn() });
  } catch (e) {
    results.push({ name, ok: false, error: e.stack });
  }
}
function arena(difficulty = 'standard') {
  const s = E.createGame(71, undefined, undefined, undefined, { difficulty });
  E.startGame(s);
  s.aiIn = 1e9;
  s.walls = [];
  s.scenery = [];
  s.terrain.fill(374);
  s.original.fill(374);
  for (const p of s.players) {
    p.hand = [];
    p.deck = [];
    p.discard = [];
    p.order = 'hold';
  }
  return s;
}
function token(s, side, id) {
  const h = { id, uid: ++s.uid };
  s.players[side].hand.push(h);
  return h;
}
function use(s, side, id) {
  return E.playCard(s, side, token(s, side, id).uid);
}
function advance(s, seconds) {
  const until = s.time + seconds;
  while (s.time < until - 1e-8) E.tick(s, Math.min(0.05, until - s.time));
}
function unchanged(p) {
  return JSON.stringify({
    energy: p.energy,
    hand: p.hand,
    discard: p.discard,
    played: p.played,
    logistics: p.logisticsLevel,
    cap: p.energyCap,
    uses: p.bondUses,
    due: p.bondDueAt,
  });
}
function squad(s, side, id, x) {
  const n = s.units.length;
  E.spawnUnit(s, side, id, x);
  for (const u of s.units.slice(n)) {
    u.cooldown = u.secondaryCooldown = 1e6;
    u.pace = 0;
  }
  return s.units.slice(n);
}

test('双方起始两点、上限十点，默认老练优势显式保存在可序列化状态', () => {
  const s = E.createGame(1);
  assert.equal(DEFAULT_DIFFICULTY, 'veteran');
  assert.deepEqual(
    s.players.map((p) => p.energy),
    [2, 2],
  );
  assert.deepEqual(s.players.map(energyLimit), [10, 10]);
  assert.deepEqual(
    s.players.map((p) => p.economyRate),
    [1, 1.15],
  );
  assert.ok(s.players.every((p) => p.difficulty === 'veteran'));
  assert.ok(Math.abs(energyInterval(s, 1) - 3.6 / 1.15) < 1e-10);
  const saved = JSON.parse(JSON.stringify(s));
  assert.equal(energyInterval(saved, 1), energyInterval(s, 1));
  E.startGame(s);
  assert.deepEqual(
    s.players.map((p) => p.energy),
    [2, 2],
  );
});
for (const difficulty of ['standard', 'veteran', 'elite'])
  test(`${difficulty}仅AI自然回点按公开倍率增加，双方基准规则一致`, () => {
    const s = arena(difficulty);
    advance(s, 7.2);
    assert.ok(Math.abs(s.players[0].energy - 4) < 1e-8);
    assert.ok(
      Math.abs(s.players[1].energy - (2 + 2 * DIFFICULTY_RATE[difficulty])) <
        1e-8,
    );
    assert.equal(s.players[0].economyRate, 1);
    assert.equal(s.players[1].difficulty, difficulty);
    return {
      energy: s.players.map((p) => p.energy),
      intervals: [energyInterval(s, 0), energyInterval(s, 1)],
    };
  });
test('两点慢开局不能立即购买六费坦克，双方失败均不扣费不消耗卡', () => {
  const s = arena();
  for (const side of [0, 1]) {
    const h = token(s, side, 'tank'),
      p = s.players[side],
      before = unchanged(p);
    assert.equal(E.playCard(s, side, h.uid).ok, false);
    assert.equal(unchanged(p), before);
  }
  assert.equal(s.units.length, 0);
});
for (const side of [0, 1]) {
  test(`后勤${side}真实付三费、提高自然收入，两级封顶并拒绝重复收费`, () => {
    const s = arena(),
      p = s.players[side];
    p.energy = 10;
    assert.ok(use(s, side, 'field_logistics').ok);
    assert.equal(p.energy, 7);
    assert.equal(p.logisticsLevel, 1);
    assert.ok(Math.abs(energyInterval(s, side) - 3.3) < 1e-10);
    advance(s, 3.3);
    assert.ok(Math.abs(p.energy - 8) < 1e-8);
    assert.ok(use(s, side, 'field_logistics').ok);
    assert.equal(p.logisticsLevel, 2);
    assert.equal(energyInterval(s, side), 3);
    const h = token(s, side, 'field_logistics'),
      before = unchanged(p);
    assert.equal(E.playCard(s, side, h.uid).ok, false);
    assert.equal(unchanged(p), before);
  });
  test(`扩编${side}只增加容量不赠点，十二再十四且满级失败不付费`, () => {
    const s = arena(),
      p = s.players[side];
    p.energy = 10;
    assert.ok(use(s, side, 'command_expansion').ok);
    assert.equal(p.energy, 8);
    assert.equal(energyLimit(p), 12);
    assert.ok(use(s, side, 'command_expansion').ok);
    assert.equal(p.energy, 6);
    assert.equal(energyLimit(p), 14);
    const h = token(s, side, 'command_expansion'),
      before = unchanged(p);
    assert.equal(E.playCard(s, side, h.uid).ok, false);
    assert.equal(unchanged(p), before);
    advance(s, 40);
    assert.equal(p.energy, 14);
  });
  test(`公债${side}即时付一、十八秒才返三，同期和整局上限均真实生效`, () => {
    const s = arena(),
      p = s.players[side];
    assert.ok(use(s, side, 'war_bonds').ok);
    assert.equal(p.energy, 1);
    assert.equal(p.bondUses, 1);
    assert.equal(p.bondDueAt, 18);
    const duplicate = token(s, side, 'war_bonds'),
      before = unchanged(p);
    assert.equal(E.playCard(s, side, duplicate.uid).ok, false);
    assert.equal(unchanged(p), before);
    advance(s, 17.95);
    assert.ok(Math.abs(p.energy - (1 + 17.95 / 3.6)) < 1e-8);
    advance(s, 0.05);
    assert.ok(Math.abs(p.energy - 9) < 1e-8);
    assert.equal(p.bondDueAt, null);
    assert.ok(E.playCard(s, side, duplicate.uid).ok);
    assert.ok(Math.abs(p.energy - 8) < 1e-8);
    assert.equal(p.bondUses, 2);
    advance(s, 18);
    assert.equal(p.energy, 10);
    assert.equal(p.bondDueAt, null);
    const third = token(s, side, 'war_bonds'),
      beforeThird = unchanged(p);
    assert.equal(E.playCard(s, side, third.uid).ok, false);
    assert.equal(unchanged(p), beforeThird);
  });
}
test('精锐和两级后勤叠加有明确总下限，不产生隐藏或无限倍率', () => {
  const s = arena('elite'),
    p = s.players[1];
  p.energy = 10;
  assert.ok(use(s, 1, 'field_logistics').ok);
  assert.ok(use(s, 1, 'field_logistics').ok);
  assert.equal(energyInterval(s, 1), 3 / 1.3);
  const h = token(s, 1, 'field_logistics');
  for (let i = 0; i < 10; i++) assert.equal(E.playCard(s, 1, h.uid).ok, false);
  assert.equal(p.logisticsLevel, 2);
});
test('暂停不会推进自然收入或公债结算，结束后也不会继续到账', () => {
  const s = arena();
  assert.ok(use(s, 0, 'war_bonds').ok);
  s.status = 'paused';
  const time = s.time,
    value = unchanged(s.players[0]);
  for (let i = 0; i < 500; i++) E.tick(s, 0.05);
  assert.equal(s.time, time);
  assert.equal(unchanged(s.players[0]), value);
  s.status = 'playing';
  advance(s, 18);
  assert.equal(s.players[0].bondDueAt, null);
  s.status = 'finished';
  const end = unchanged(s.players[0]);
  E.tick(s, 0.05);
  assert.equal(unchanged(s.players[0]), end);
});
test('公债超过容量部分不进入暗账，之后花点也不会补发', () => {
  const s = arena(),
    p = s.players[0];
  p.energy = 10;
  assert.ok(use(s, 0, 'war_bonds').ok);
  advance(s, 18);
  assert.equal(p.energy, 10);
  assert.equal(p.bondDueAt, null);
  assert.ok(use(s, 0, 'infantry').ok);
  assert.equal(p.energy, 8);
  advance(s, 0.05);
  assert.ok(Math.abs(p.energy - (8 + 0.05 / 3.6)) < 1e-8);
});
test('AI安稳且已有屏障时正常付费投资后勤，前线可见敌军时不贪发展', () => {
  const sample = (enemy) => {
    const s = arena(),
      p = s.players[1];
    for (const x of [2700, 2800, 2900]) squad(s, 1, 'infantry', x);
    if (enemy) squad(s, 0, 'infantry', 2500);
    p.energy = 6;
    token(s, 1, 'field_logistics');
    token(s, 1, 'infantry');
    E.refreshVision(s);
    s.aiIn = 0;
    E.tick(s, 0.05);
    return s;
  };
  const peaceful = sample(false),
    contact = sample(true);
  assert.equal(peaceful.players[1].logisticsLevel, 1);
  assert.ok(peaceful.players[1].energy < 3.1);
  assert.equal(contact.players[1].logisticsLevel, 0);
  assert.ok(contact.players[1].hand.some((h) => h.id === 'field_logistics'));
});
test('AI不能因隐藏敌情改发展选择，也不会在经济上限已满时浪费发展卡', () => {
  const sample = (hidden) => {
    const s = arena(),
      p = s.players[1];
    for (const x of [3000, 3050, 3100]) squad(s, 1, 'infantry', x);
    if (hidden) squad(s, 0, 'tank', 300);
    p.energy = 6;
    token(s, 1, 'field_logistics');
    E.refreshVision(s);
    assert.ok(
      s.units
        .filter((u) => u.side === 0)
        .every((u) => !E.visibleToSide(s, 1, u)),
    );
    s.seed = 91;
    s.aiIn = 0;
    E.tick(s, 0.05);
    return {
      energy: p.energy,
      level: p.logisticsLevel,
      hand: p.hand.map((h) => h.id),
    };
  };
  assert.deepEqual(sample(false), sample(true));
  const s = arena(),
    p = s.players[1];
  p.energy = 10;
  p.logisticsLevel = 2;
  token(s, 1, 'field_logistics');
  s.aiIn = 0;
  E.tick(s, 0.05);
  assert.equal(p.played, 0);
  assert.equal(p.logisticsLevel, 2);
});
test('AI缺强反制时优先购买反制，不能被便宜公债抢费', () => {
  const s = arena(),
    p = s.players[1];
  squad(s, 1, 'scouts', 2650);
  squad(s, 0, 'tank', 2400);
  p.energy = 4;
  token(s, 1, 'javelin');
  token(s, 1, 'war_bonds');
  E.refreshVision(s);
  s.aiIn = 0;
  E.tick(s, 0.05);
  assert.ok(s.units.some((u) => u.side === 1 && u.id === 'javelin'));
  assert.equal(p.bondUses, 0);
});
test('三张新卡有合法数量限制和短文案，五套预设各20且保留反甲防空', () => {
  for (const id of ['field_logistics', 'command_expansion', 'war_bonds']) {
    assert.equal(CARDS[id].type, 'skill');
    assert.equal(copyLimit(id), 2);
    assert.ok([...CARD_COPY[id].rule].length <= 15);
    assert.ok([...CARD_COPY[id].flavor].length <= 15);
  }
  for (const d of [...AI_DECKS, ...DECK_PRESETS.map((d) => d.cards)]) {
    assert.ok(validDeck(d));
    assert.equal(d.filter((id) => CARDS[id].economy).length, 1);
    assert.ok(d.some((id) => CARDS[id].antiAir));
    assert.ok(
      d.some(
        (id) =>
          (CARDS[id].armorMultiplier ?? 1) >= 1.5 || CARDS[id].penetration,
      ),
    );
  }
  const old = [
    'infantry',
    'infantry',
    'infantry',
    'infantry',
    'militia',
    'antiarmor',
    'machinegun',
    'javelin',
    'manpads',
    'sam_vehicle',
    'supply',
    'supply',
    'supply_team',
    'scouts',
    'medic',
    'tank',
    'pickup',
    'tow_ifv',
    'smoke_withdrawal',
    'recon',
  ];
  assert.ok(validDeck(old));
});

for (const [id, energy, field, expected] of [
  ['war_bonds', 3, 'bondUses', 1],
  ['command_expansion', 9, 'energyCap', 12],
])
  test(`AI安稳时实际使用${id}，近敌出现则保留资源作战`, () => {
    const sample = (enemy) => {
      const s = arena(),
        p = s.players[1];
      for (const x of [2700, 2800, 2900]) squad(s, 1, 'infantry', x);
      if (enemy) squad(s, 0, 'infantry', 2500);
      p.energy = energy;
      token(s, 1, id);
      token(s, 1, 'infantry');
      E.refreshVision(s);
      s.aiIn = 0;
      E.tick(s, 0.05);
      return s;
    };
    const safe = sample(false),
      danger = sample(true);
    assert.equal(safe.players[1][field], expected);
    assert.ok(
      Math.abs(
        safe.players[1].energy - (energy + 0.05 / 3.6 - CARDS[id].cost),
      ) < 1e-8,
    );
    assert.equal(danger.players[1][field], field === 'bondUses' ? 0 : 10);
    assert.ok(danger.players[1].hand.some((h) => h.id === id));
  });
test('结算中的公债序列化恢复后仍在原时间只到账一次', () => {
  const s = arena();
  assert.ok(use(s, 0, 'war_bonds').ok);
  advance(s, 8);
  const restored = JSON.parse(JSON.stringify(s));
  advance(s, 10);
  advance(restored, 10);
  assert.ok(Math.abs(s.players[0].energy - restored.players[0].energy) < 1e-8);
  assert.equal(restored.players[0].bondDueAt, null);
  assert.equal(restored.players[0].bondUses, 1);
  advance(restored, 0.1);
  assert.ok(Math.abs(restored.players[0].energy - (9 + 0.1 / 3.6)) < 1e-8);
});

console.log(JSON.stringify(results, null, 2));
if (results.some((r) => !r.ok)) process.exitCode = 1;
