import assert from 'node:assert/strict';
import * as E from '../game/engine.ts';
import { AI_DECKS, DECK_PRESETS } from '../game/deck-presets.ts';
const results = [];
function test(name, fn) {
  try {
    results.push({ name, ok: true, ...fn() });
  } catch (e) {
    results.push({ name, ok: false, error: e.stack });
  }
}
function arena() {
  const s = E.createGame(71);
  E.startGame(s);
  s.aiIn = 0;
  s.walls = [];
  s.scenery = [];
  s.terrain.fill(374);
  s.original.fill(374);
  s.players[0].order = s.players[1].order = 'hold';
  const p = s.players[1];
  p.hand = [];
  p.deck = [];
  p.discard = [];
  p.drawIn = 0;
  p.energy = 4;
  return s;
}
function squad(s, side, id, x) {
  const n = s.units.length;
  E.spawnUnit(s, side, id, x);
  const g = s.units.slice(n);
  for (const u of g) {
    u.cooldown = u.secondaryCooldown = 1e6;
    u.pace = 0;
  }
  return g;
}
function cards(s, ids, energy = 4) {
  s.players[1].hand = ids.map((id) => ({ id, uid: ++s.uid }));
  s.players[1].energy = energy;
}
function decide(s) {
  E.refreshVision(s);
  const before = s.players[1].hand.map((h) => ({ ...h }));
  E.tick(s, 0.05);
  return before
    .filter((h) => !s.players[1].hand.some((v) => v.uid === h.uid))
    .map((h) => h.id);
}
function contact(id) {
  const s = arena();
  squad(s, 1, 'scouts', 2650);
  squad(s, 0, id, 2400);
  return s;
}

test('后方二十秒外的RPG不能算成前线已经得到反坦克掩护', () => {
  const s = arena();
  squad(s, 1, 'scouts', 2650);
  squad(s, 0, 'tank', 2200);
  squad(s, 1, 'antiarmor', 3400);
  cards(s, ['infantry', 'javelin']);
  assert.deepEqual(decide(s), ['javelin']);
  assert.ok(s.players[1].energy < 0.05);
});
test('机枪不是完整空防，已见武直优先购买便携防空', () => {
  const s = contact('helicopter');
  squad(s, 1, 'machinegun', 2850);
  cards(s, ['infantry', 'manpads']);
  assert.deepEqual(decide(s), ['manpads']);
});
test('已有普通RPG仍保存费用购买手中的制导标枪', () => {
  const s = contact('tank');
  squad(s, 1, 'antiarmor', 2800);
  cards(s, ['infantry', 'antiarmor', 'javelin'], 2);
  assert.deepEqual(decide(s), []);
  assert.ok(s.players[1].energy >= 2);
});
test('坦克在场时有效制导反甲优先于便宜的另一支RPG', () => {
  const s = contact('tank');
  cards(s, ['antiarmor', 'javelin']);
  assert.deepEqual(decide(s), ['javelin']);
});
test('武直在场时SAM优先于便宜的机枪', () => {
  const s = contact('helicopter');
  cards(s, ['machinegun', 'sam_vehicle'], 5);
  assert.deepEqual(decide(s), ['sam_vehicle']);
});
test('反制搜牌冷却期间同时保留真实抽牌费与部署费', () => {
  const s = contact('helicopter'),
    p = s.players[1];
  cards(s, ['infantry', 'recon', 'repair'], 5);
  p.deck = ['manpads', 'infantry'].map((id) => ({ id, uid: ++s.uid }));
  p.drawIn = 5;
  assert.deepEqual(decide(s), []);
  assert.ok(p.energy >= 5);
  assert.equal(p.deck.length, 2);
  assert.ok(p.drawIn > 4.9);
});
test('满手缺反制先用低费实战单位腾位，保留付费搜牌预算', () => {
  const s = contact('tank'),
    p = s.players[1];
  cards(s, ['supply_team', 'infantry', 'infantry', 'medic', 'scouts', 'recon']);
  p.deck = ['javelin', 'infantry'].map((id) => ({ id, uid: ++s.uid }));
  assert.deepEqual(decide(s), ['infantry']);
  assert.ok(p.energy >= 2 && p.energy < 2.05);
  assert.equal(p.hand.length, 5);
  assert.equal(p.deck.length, 2);
});
test('重复弱防空不会挤掉从自己的牌库付费寻找强反制', () => {
  const s = contact('helicopter'),
    p = s.players[1];
  squad(s, 1, 'machinegun', 2850);
  cards(s, ['machinegun', 'infantry'], 5);
  p.deck = [{ id: 'manpads', uid: ++s.uid }];
  assert.deepEqual(decide(s), []);
  assert.ok(p.hand.some((h) => h.id === 'manpads'));
  assert.ok(p.energy >= 3 && p.energy < 3.05);
  assert.ok(p.drawIn > 8.9);
});
test('远射程武器有基本步兵掩护后补出真正的侦察兵', () => {
  const s = arena();
  squad(s, 1, 'infantry', 3000);
  squad(s, 1, 'infantry', 3100);
  squad(s, 1, 'javelin', 3200);
  cards(s, ['infantry', 'scouts']);
  assert.deepEqual(decide(s), ['scouts']);
});
test('已建立步兵屏障时能在敌机出现前部署真防空', () => {
  const s = arena();
  squad(s, 1, 'infantry', 3000);
  squad(s, 1, 'infantry', 3100);
  cards(s, ['manpads', 'medic']);
  assert.deepEqual(decide(s), ['manpads']);
});
test('正常士气接敌不被战略卡费估值强制整队后撤或据守', () => {
  const s = arena();
  const line = squad(s, 1, 'infantry', 2700);
  for (const u of line) u.personalMorale = 45;
  squad(s, 1, 'infantry', 3000);
  squad(s, 0, 'tank', 2400);
  squad(s, 0, 'heavy_tank', 2410);
  cards(s, [], 0);
  decide(s);
  assert.ok(
    line.every((u) => u.squadOrder !== 'retreat' && u.squadOrder !== 'hold'),
  );
});
test('隐藏的敌方装甲与空军不改变出牌、保费或行军命令', () => {
  const sample = (enemy) => {
    const s = arena();
    squad(s, 1, 'infantry', 3000);
    cards(s, ['infantry', 'javelin', 'manpads']);
    if (enemy) squad(s, 0, enemy, 400);
    E.refreshVision(s);
    assert.ok(
      s.units
        .filter((u) => u.side === 0)
        .every((u) => !E.visibleToSide(s, 1, u)),
    );
    s.seed = 99;
    decide(s);
    const p = s.players[1];
    return {
      hand: p.hand.map((h) => h.id),
      order: p.order,
      energy: p.energy,
      played: p.played,
    };
  };
  const clear = sample(null);
  assert.deepEqual(sample('heavy_tank'), clear);
  assert.deepEqual(sample('helicopter'), clear);
});
test('五套独立AI编队合法且各有真实反甲防空、低费屏障、观察与进攻手段', () => {
  assert.equal(AI_DECKS.length, 5);
  assert.equal(DECK_PRESETS.length, 5);
  assert.equal(new Set(AI_DECKS.map((d) => d.join(','))).size, 5);
  const realArmor = (id) => {
    const c = E.CARDS[id];
    return (
      !!c.penetration ||
      !!(c.guided && c.armorOnly && (c.armorMultiplier ?? 1) >= 2)
    );
  };
  const realAir = (id) => {
    const c = E.CARDS[id];
    return !!(c.antiAir && c.airOnly && c.guided);
  };
  const cheapScreen = (id) => {
    const c = E.CARDS[id];
    return (
      c.type === 'unit' &&
      c.cost <= 2 &&
      c.members &&
      !c.heal &&
      !c.observer &&
      !c.airOnly &&
      !c.armorOnly &&
      !['scouts', 'engineers', 'supply_team'].includes(id)
    );
  };
  for (const d of AI_DECKS) {
    assert.ok(E.validDeck(d));
    assert.ok(
      d.some(realArmor),
      'real heavy armor response, not rifle or weak AA',
    );
    assert.ok(
      d.filter(realAir).length >= 2,
      'two real anti-air commitments, not machineguns',
    );
    assert.ok(d.filter(cheapScreen).length >= 4, 'affordable front line');
    assert.ok(
      d.some((id) => id === 'scouts' || E.CARDS[id].observer),
      'real observation unit',
    );
    assert.ok(
      d.some((id) => id === 'machinegun' || id === 'heavy_mg' || id === 'ifv'),
      'sustained ground suppression',
    );
    assert.ok(
      d.some((id) => {
        const c = E.CARDS[id];
        return (
          (c.armored && !c.airOnly) ||
          c.airlift ||
          c.attackRun ||
          c.indirect ||
          c.oneWay ||
          id === 'marines'
        );
      }),
      'a proactive attack or fire-support core',
    );
    assert.ok(d.includes('supply'));
  }
  const union = new Set(AI_DECKS.flat());
  for (const id of [
    'fpv_drone',
    'air_assault',
    'strike_jet',
    'interceptor',
    'artillery',
    'mortar_carrier',
    'tank',
    'supply_team',
  ])
    assert.ok(union.has(id), `AI still uses ${id}`);
  const selected = new Set();
  for (let seed = 0; seed < 100; seed++) {
    const chosen = E.chooseAiDeck(seed);
    assert.ok(
      AI_DECKS.some((d) => JSON.stringify(d) === JSON.stringify(chosen)),
    );
    selected.add(chosen.join(','));
  }
  assert.equal(selected.size, 5);
});

test('已有真反制在途先补可负担的步兵屏障，不能接连裸送发射手', () => {
  const s = contact('tank');
  squad(s, 1, 'javelin', 3500);
  cards(s, ['infantry', 'javelin']);
  assert.deepEqual(decide(s), ['infantry']);
});
test('手里没有可用屏障时仍部署真反制，不因协同条件无限等待', () => {
  const s = contact('tank');
  squad(s, 1, 'javelin', 3500);
  cards(s, ['javelin']);
  assert.deepEqual(decide(s), ['javelin']);
});
test('已有远程反甲与屏障时优先提供前方观察而非重复反甲', () => {
  const s = arena();
  squad(s, 1, 'javelin', 3000);
  squad(s, 1, 'infantry', 2800);
  squad(s, 1, 'infantry', 2900);
  squad(s, 0, 'tank', 2400);
  cards(s, ['scouts', 'javelin']);
  assert.deepEqual(decide(s), ['scouts']);
});
test('开局满手无目标指令时先建立真实反制阵位而非空放鼓舞', () => {
  const s = arena();
  squad(s, 1, 'militia', 3400);
  cards(
    s,
    ['manpads', 'morale', 'sam_vehicle', 'javelin', 'smoke', 'manpads'],
    5,
  );
  s.players[1].drawIn = 5;
  assert.deepEqual(decide(s), ['manpads']);
  assert.equal(s.players[1].morale, 0);
});
test('军医不是第二支战斗小队，不能触发全军冲刺', () => {
  const s = arena();
  s.time = 20;
  s.aiWaveUntil = 0;
  squad(s, 1, 'infantry', 3000);
  squad(s, 1, 'medic', 3050);
  cards(s, [], 0);
  decide(s);
  assert.equal(s.players[1].order, 'advance');
});
test('付费搜牌后九秒内出防空，二十秒资源和抽牌间隔严格守恒', () => {
  const s = contact('helicopter'),
    p = s.players[1];
  cards(s, ['infantry', 'recon', 'repair'], 5);
  p.deck = ['manpads', 'infantry'].map((id) => ({ id, uid: ++s.uid }));
  p.drawIn = 5;
  let spent = 0,
    firstAA = null;
  const draws = [];
  E.refreshVision(s);
  for (let i = 0; i < 400; i++) {
    const oldHand = p.hand.map((h) => ({ ...h })),
      oldDraw = p.drawIn,
      oldPlayed = p.played;
    E.tick(s, 0.05);
    if (p.drawIn > oldDraw + 1) {
      spent += E.DRAW_COST;
      draws.push(s.time);
    }
    if (p.played > oldPlayed)
      for (const h of oldHand.filter(
        (h) => !p.hand.some((v) => v.uid === h.uid),
      )) {
        spent += E.cardCost(h);
        if (h.id === 'manpads' && firstAA === null) firstAA = s.time;
      }
  }
  assert.ok(firstAA !== null && firstAA < 9);
  assert.ok(
    draws.every((at, i) => i === 0 || at - draws[i - 1] >= E.DRAW_TIME - 0.05),
  );
  assert.ok(Math.abs(p.energy - (5 + s.time / E.ENERGY_TIME - spent)) < 1e-8);
  return { firstAA, draws, spent, endEnergy: p.energy };
});

test('五张手牌的补给可完整抽两张，缺反制时先付一费补给而非等待两费单抽', () => {
  const s = contact('tank'),
    p = s.players[1];
  cards(
    s,
    ['sam_vehicle', 'manpads', 'medic', 'smoke_withdrawal', 'supply'],
    1.5,
  );
  p.deck = ['infantry', 'javelin'].map((id) => ({ id, uid: ++s.uid }));
  assert.deepEqual(decide(s), ['supply']);
  assert.equal(p.hand.length, E.MAX_HAND);
  assert.ok(
    p.hand.some((h) => h.id === 'infantry') &&
      p.hand.some((h) => h.id === 'javelin'),
  );
  assert.equal(p.deck.length, 0);
  assert.equal(p.drawIn, 0);
  assert.ok(Math.abs(p.energy - (0.5 + 0.05 / E.ENERGY_TIME)) < 1e-8);
});
test('手中已经有强反制时仍先部署，不为补给改花已攒够的费用', () => {
  const s = contact('tank'),
    p = s.players[1];
  cards(s, ['javelin', 'supply'], 4);
  p.deck = ['infantry', 'scouts'].map((id) => ({ id, uid: ++s.uid }));
  assert.deepEqual(decide(s), ['javelin']);
  assert.equal(p.deck.length, 2);
  assert.ok(p.hand.some((h) => h.id === 'supply'));
});

for (const urgent of [false, true])
  test(`${urgent ? '急缺反制' : '无接敌'}满手3.97费不空放鼓舞，正常下一次决策能部署4费实体`, () => {
    const s = urgent ? contact('tank') : arena(),
      p = s.players[1];
    if (!urgent) squad(s, 1, 'militia', 3400);
    cards(
      s,
      ['manpads', 'morale', 'sam_vehicle', 'jam', 'repair', 'manpads'],
      3.97,
    );
    p.deck = [{ id: 'javelin', uid: ++s.uid }];
    p.drawIn = 5;
    assert.deepEqual(decide(s), []);
    assert.equal(p.morale, 0);
    assert.ok(p.hand.some((h) => h.id === 'morale'));
    const before = p.played;
    while (s.time < 1.5 && p.played === before) E.tick(s, 0.05);
    assert.equal(p.played, before + 1);
    assert.ok(s.units.some((u) => u.side === 1 && u.id === 'manpads'));
    assert.equal(p.morale, 0);
    assert.ok(p.hand.some((h) => h.id === 'morale'));
    assert.ok(p.energy >= 0 && p.energy < 0.5);
    return { urgent, deployedAt: s.time, energy: p.energy };
  });

console.log(JSON.stringify(results, null, 2));
if (results.some((r) => !r.ok)) process.exitCode = 1;
