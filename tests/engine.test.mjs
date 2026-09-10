import assert from 'node:assert/strict';
import {
  createGame,
  startGame,
  playCard,
  tick,
  setOrder,
  explode,
  crater,
  ground,
  draw,
  spawnUnit,
  CARDS,
  craterCover,
  terrainIntercept,
  W,
  MAX_HAND,
  DECK,
  AIR_ALTITUDE,
  smokeBlocks,
  unitRange,
  needsTarget,
  validDeck,
  chooseAiDeck,
  modelOf,
  isCombatant,
} from '../game/engine.ts';
const advance = (s, seconds) => {
  for (let t = 0; t < seconds - 1e-9; t += 1 / 60) tick(s, 1 / 60);
};
const hand = (s, id) => {
  const c = { uid: ++s.uid, id };
  s.players[0].hand.push(c);
  return c;
};
const fresh = () => {
  const s = createGame(37);
  startGame(s);
  // Legacy battlefield scenarios explicitly stage their own initial units.
  spawnUnit(s, 0, 'infantry', 175);
  spawnUnit(s, 1, 'infantry', W - 175);
  s.aiIn = 1e6;
  return s;
};
let count = 0;
function check(name, fn) {
  fn();
  count++;
  console.log('✓ ' + name);
}
check('六名士兵拥有独立生命、位置和动作计时', () => {
  const s = fresh(),
    before = s.units.length,
    c = hand(s, 'infantry');
  assert.equal(playCard(s, 0, c.uid, 320).ok, true);
  const group = s.units.slice(before);
  assert.equal(group.length, 6);
  assert.equal(new Set(group.map((x) => x.uid)).size, 6);
  assert.equal(new Set(group.map((x) => x.x)).size, 6);
  assert.equal(new Set(group.map((x) => x.squad)).size, 1);
  assert.equal(
    group.reduce((a, u) => a + u.hp, 0),
    210,
  );
  advance(s, 1);
  assert(group.every((u) => u.moving));
  assert(new Set(group.map((u) => u.walk)).size > 1);
});
check('无效部署与指挥点不足不消耗卡牌或资源', () => {
  const s = fresh(),
    p = s.players[0],
    c = hand(s, 'infantry'),
    energy = p.energy,
    n = p.hand.length;
  assert.equal(playCard(s, 0, c.uid, 900).ok, false);
  assert.equal(playCard(s, 0, c.uid, NaN).ok, false);
  assert.equal(p.energy, energy);
  assert.equal(p.hand.length, n);
  p.energy = 0;
  assert.equal(playCard(s, 0, c.uid, 220).ok, false);
  assert.equal(p.hand.length, n);
});
check('重复炮击形成对称、限深且可通行的弹坑', () => {
  const s = fresh();
  s.original.fill(374);
  s.terrain.fill(374);
  crater(s, 720, 75, 36);
  for (let i = 1; i < 74; i++)
    assert(Math.abs(s.terrain[720 - i] - s.terrain[720 + i]) < 0.001);
  for (let i = 0; i < 30; i++) crater(s, 720, 75, 36);
  assert(ground(s, 720) <= 406);
  for (let i = 126; i < W - 125; i++)
    assert(Math.abs(s.terrain[i] - s.terrain[i - 1]) <= 1.251);
  assert.equal(s.terrain[70], 374);
});
check('补给先消耗自身卡位，满手牌最多补进一张', () => {
  const s = fresh(),
    p = s.players[0];
  p.hand = [];
  const supply = hand(s, 'supply');
  for (let i = 0; i < 5; i++) hand(s, 'infantry');
  assert(playCard(s, 0, supply.uid).ok);
  assert.equal(p.hand.length, MAX_HAND);
});
check('干扰暂停自动抽牌，补给仍可使用', () => {
  const s = fresh(),
    p = s.players[0];
  p.hand = [];
  p.drawIn = 2;
  p.jam = 3;
  advance(s, 1);
  assert.equal(p.drawIn, 2);
  const supply = hand(s, 'supply');
  assert(playCard(s, 0, supply.uid).ok);
  assert.equal(p.hand.length, 2);
  advance(s, 2.2);
  assert(p.drawIn < 2 && p.drawIn > 1.7);
});
check('弃牌在牌库抽空后重新洗入', () => {
  const s = fresh(),
    p = s.players[0];
  p.hand = [];
  p.deck = [];
  p.discard = ['tank', 'jam'];
  assert.equal(draw(s, 0, 2), 2);
  assert.equal(p.hand.length, 2);
  assert.equal(p.discard.length, 0);
});
check('每名士兵独立寻找目标、开火和受击', () => {
  const s = fresh();
  s.units = [];
  spawnUnit(s, 0, 'infantry', 620);
  spawnUnit(s, 1, 'infantry', 740);
  const target = s.units[6];
  const firing = new Set();
  for (let i = 0; i < 72; i++) {
    tick(s, 1 / 60);
    s.units.filter((u) => u.fire > 0).forEach((u) => firing.add(u.uid));
  }
  assert(s.units.some((u) => u.hp < u.maxHp));
  assert(firing.size > 1);
  assert(s.units.every((u) => Number.isFinite(u.hp)));
  assert(target.hp < target.maxHp);
});
check('机枪能对空，普通步兵不能对空', () => {
  const s = fresh();
  s.units = [];
  spawnUnit(s, 0, 'infantry', 500);
  spawnUnit(s, 1, 'helicopter', 590);
  advance(s, 1);
  assert.equal(
    s.units.find((u) => u.id === 'helicopter').hp,
    CARDS.helicopter.hp,
  );
  spawnUnit(s, 0, 'machinegun', 540);
  advance(s, 1);
  assert(s.units.find((u) => u.id === 'helicopter').hp < CARDS.helicopter.hp);
});
check('暂停和结算后不会继续消耗时间', () => {
  const s = fresh();
  s.status = 'paused';
  tick(s, 1);
  assert.equal(s.time, 0);
  s.status = 'playing';
  s.players[1].hp = 0;
  tick(s, 1 / 60);
  assert.equal(s.result, 0);
  const t = s.time;
  advance(s, 1);
  assert.equal(s.time, t);
});
check('超时平局及同帧双方归零都正确结算', () => {
  const s = fresh();
  s.time = 239.999;
  tick(s, 0.01);
  assert.equal(s.result, 'draw');
  const z = fresh();
  z.players[0].hp = 0;
  z.players[1].hp = 0;
  tick(z, 0.01);
  assert.equal(z.result, 'draw');
});
check('重新整备清除弹坑、弹丸、死亡与技能状态', () => {
  const s = createGame();
  assert.equal(s.explosions, 0);
  assert.equal(s.markers.length, 0);
  assert.equal(s.projectiles.length, 0);
  assert(s.units.every((u) => u.deadFor === 0));
  assert(s.terrain.every((y, x) => y === s.original[x]));
});
check('驻守、推进、奔跑、蹲行、卧倒分别驱动独立姿态', () => {
  const walk = fresh(),
    run = fresh(),
    hold = fresh(),
    crouch = fresh(),
    prone = fresh();
  setOrder(run, 0, 'rush');
  setOrder(hold, 0, 'hold');
  setOrder(crouch, 0, 'crouch');
  setOrder(prone, 0, 'prone');
  for (const s of [walk, run, hold, crouch, prone]) advance(s, 1);
  assert.equal(hold.units[0].x, 175);
  assert.equal(hold.units[0].pose, 'idle');
  assert.equal(walk.units[0].pose, 'walk');
  assert.equal(run.units[0].pose, 'run');
  assert.equal(crouch.units[0].pose, 'crouch');
  assert.equal(prone.units[0].pose, 'prone');
  assert(run.units[0].x > walk.units[0].x);
  assert(walk.units[0].x > crouch.units[0].x);
  assert(crouch.units[0].x > prone.units[0].x);
});
check('士兵逐个攀越矮墙，结束后正确回到地面', () => {
  const s = fresh();
  s.units = [];
  spawnUnit(s, 0, 'infantry', 477);
  const first = s.units[0];
  let climbing = false,
    raised = false;
  for (let i = 0; i < 240; i++) {
    tick(s, 1 / 60);
    climbing ||= first.pose === 'climb';
    raised ||= first.y < ground(s, first.x) - 8;
  }
  assert(climbing);
  assert(raised);
  assert(first.passedWalls.includes(1));
  assert(first.x > 530);
  assert(Math.abs(first.y - ground(s, first.x)) < 0.01);
});
check('被炸毁的墙不再触发攀越', () => {
  const s = fresh();
  explode(s, 510, ground(s, 510) - 10, 80, 200, 0);
  assert.equal(s.walls[0].hp, 0);
  s.units = [];
  spawnUnit(s, 0, 'infantry', 477);
  for (let i = 0; i < 120; i++) {
    tick(s, 1 / 60);
    assert.equal(s.units[0].climbing, 0);
  }
});
check('炮击伤害半径独立于小弹坑，连续命中保持限深', () => {
  const s = fresh();
  s.terrain.fill(374);
  s.original.fill(374);
  s.units = [];
  explode(s, 900, 366, 68, 55, 0);
  const changed = s.terrain.filter((y) => y > 374).length;
  assert(changed >= 35 && changed <= 50);
  assert(ground(s, 900) > 387 && ground(s, 900) <= 392);
  for (let i = 0; i < 20; i++) explode(s, 900, ground(s, 900) - 8, 68, 55, 0);
  assert(ground(s, 900) <= 406);
});
check('双方各移动指令均能跳入、落地并攀出弹坑', () => {
  for (const side of [0, 1])
    for (const order of ['advance', 'rush', 'crouch', 'prone']) {
      const s = fresh();
      s.units = [];
      s.walls = [];
      s.terrain.fill(374);
      s.original.fill(374);
      crater(s, 900, 28, 30);
      setOrder(s, side, order);
      spawnUnit(s, side, 'infantry', side === 0 ? 856 : 944);
      s.units = [s.units[0]];
      const u = s.units[0],
        seen = new Set();
      for (let i = 0; i < 14 * 60; i++) {
        tick(s, 1 / 60);
        seen.add(u.motion);
        assert(Number.isFinite(u.y));
        assert(u.y <= ground(s, u.x) + 0.01);
      }
      for (const state of ['jump', 'land', 'bank', 'ground'])
        assert(
          seen.has(state),
          `${side} ${order} missed ${state}: ${[...seen]}`,
        );
      assert(side === 0 ? u.x > 945 : u.x < 855);
    }
});
check('脚下爆炸触发下落，空中驻守仍先安全落地', () => {
  const s = fresh();
  s.units = [];
  s.walls = [];
  s.terrain.fill(374);
  s.original.fill(374);
  spawnUnit(s, 0, 'infantry', 900);
  s.units = [s.units[0]];
  explode(s, 900, 366, 68, 0, 0);
  explode(s, 900, ground(s, 900) - 8, 68, 0, 0);
  setOrder(s, 0, 'hold');
  tick(s, 1 / 60);
  const u = s.units[0];
  assert.equal(u.motion, 'jump');
  advance(s, 2);
  assert.equal(u.motion, 'ground');
  assert.equal(u.y, ground(s, u.x));
  assert.equal(u.x, 900);
});
check('士兵主动进入弹坑，蹲伏掩护与探身开火交替', () => {
  const s = fresh();
  s.units = [];
  s.walls = [];
  s.terrain.fill(374);
  s.original.fill(374);
  crater(s, 900, 25, 18);
  spawnUnit(s, 0, 'infantry', 860);
  const u = s.units[0];
  u.member = 1; // One of the squad's cover-seeking members.
  s.units = [u];
  spawnUnit(s, 1, 'infantry', 990);
  s.units = [u, s.units[1]];
  for (const v of s.units) v.hp = v.maxHp = 10000;
  setOrder(s, 1, 'hold');
  let crouched = false,
    fired = false;
  for (let i = 0; i < 8 * 60; i++) {
    tick(s, 1 / 60);
    crouched ||= u.cover > 0.2 && u.pose === 'crouch';
    fired ||= u.cover > 0.2 && u.fire > 0 && u.pose === 'idle';
  }
  assert(crouched);
  assert(fired);
  assert(craterCover(s, u.x, 990) > 0.2);
  const x = u.x;
  s.units = [u];
  advance(s, 3);
  assert(u.x > x + 30);
  assert.equal(u.cover, 0);
});
check('坑沿阻挡射线，掩体减轻直射而不削弱落入坑内的炮击', () => {
  const shot = (dug) => {
    const s = fresh();
    s.units = [];
    s.walls = [];
    s.terrain.fill(374);
    s.original.fill(374);
    if (dug) crater(s, 900, 25, 18);
    spawnUnit(s, 0, 'infantry', 900);
    s.units = [s.units[0]];
    const u = s.units[0];
    setOrder(s, 0, 'crouch');
    u.cooldown = 100;
    const y = u.y - 18;
    s.projectiles.push({
      x: 1010,
      y: 327,
      startX: 1010,
      startY: 327,
      tx: 900,
      ty: y,
      side: 1,
      targetUid: u.uid,
      base: null,
      damage: 10,
      radius: 0,
      life: 1 / 60,
      total: 1 / 60,
    });
    tick(s, 1 / 60);
    return u.maxHp - u.hp;
  };
  assert(shot(true) < shot(false) * 0.7);
  const s = fresh();
  s.terrain.fill(374);
  s.original.fill(374);
  crater(s, 900, 25, 18);
  assert(terrainIntercept(s, 900, 384, 990, 380));
  assert.equal(terrainIntercept(s, 900, 340, 990, 340), null);
  s.units = [];
  spawnUnit(s, 0, 'infantry', 900);
  s.units = [s.units[0]];
  const u = s.units[0];
  const hp = u.hp;
  u.cover = 1;
  explode(s, 900, u.y - 20, 20, 10, 1);
  assert(u.hp < hp - 9);
});
check('直升机跨多个旋翼周期保持固定飞行高度', () => {
  const s = fresh();
  s.units = [];
  spawnUnit(s, 0, 'helicopter', 600);
  const u = s.units[0];
  assert.equal(u.y, AIR_ALTITUDE);
  for (let i = 0; i < 600; i++) {
    tick(s, 1 / 60);
    assert.equal(u.y, AIR_ALTITUDE);
  }
});
check('双向小起伏和普通浅坑不触发跳落或攀爬', () => {
  for (const side of [0, 1]) {
    const s = fresh();
    s.units = [];
    s.walls = [];
    s.terrain.fill(374);
    s.original.fill(374);
    crater(s, 900, 25, 10);
    crater(s, 1030, 25, 18);
    spawnUnit(s, side, 'infantry', side === 0 ? 840 : 1090);
    s.units = [s.units[0]];
    for (let i = 0; i < 5 * 60; i++) {
      tick(s, 1 / 60);
      assert.equal(s.units[0].motion, 'ground');
      assert.equal(s.units[0].y, ground(s, s.units[0].x));
    }
  }
});
const duel = (id, distance) => {
  const s = fresh();
  s.units = [];
  s.walls = [];
  s.terrain.fill(374);
  s.original.fill(374);
  spawnUnit(s, 0, id, 1100);
  const u = s.units[0];
  s.units = [u];
  spawnUnit(s, 1, 'tank', 1100 + distance);
  const target = s.units[1];
  target.cooldown = 1e6;
  target.hp = target.maxHp = 10000;
  u.cooldown = 0;
  setOrder(s, 0, 'hold');
  return { s, u, target };
};
check('所有战斗兵种在远距离开火，射程外不会误射', () => {
  for (const id of [
    'infantry',
    'machinegun',
    'rocket',
    'tank',
    'helicopter',
    'sniper',
    'mortar',
    'ifv',
  ]) {
    const inside = duel(id, CARDS[id].range - 1);
    tick(inside.s, 1 / 60);
    assert(inside.u.fire > 0, id);
    const outside = duel(id, CARDS[id].range + 1);
    tick(outside.s, 1 / 60);
    assert.equal(outside.u.fire, 0, id);
  }
  const d = duel('infantry', 420);
  assert.equal(unitRange(d.s, d.u), 380);
  d.s.players[0].recon = 10;
  tick(d.s, 1 / 60);
  assert(d.u.fire > 0);
  assert.equal(unitRange(d.s, d.u), 456);
});
check('烟幕双向遮挡直射，侦察穿烟且到期恢复', () => {
  const d = duel('infantry', 350);
  d.s.smokes.push({ x: 1280, life: 8, side: 0 });
  assert(smokeBlocks(d.s, 0, 1100, 1450));
  assert(smokeBlocks(d.s, 1, 1450, 1100));
  assert.equal(smokeBlocks(d.s, 0, 1250, 1300), false);
  tick(d.s, 1 / 60);
  assert.equal(d.u.fire, 0);
  d.s.players[0].recon = 1;
  tick(d.s, 1 / 60);
  assert(d.u.fire > 0);
  advance(d.s, 8);
  assert.equal(d.s.smokes.length, 0);
  assert.equal(d.s.players[0].recon, 0);
});
check('迫击炮穿烟曲射，最小射程内后撤', () => {
  const d = duel('mortar', 600);
  d.s.smokes.push({ x: 1300, life: 8, side: 1 });
  for (let x = 1300; x < 1380; x++) d.s.terrain[x] = 305;
  tick(d.s, 1 / 60);
  assert(d.u.fire > 0);
  assert.equal(d.s.projectiles[0].arc, 170);
  advance(d.s, 1.5);
  assert(d.target.hp < d.target.maxHp);
  const near = duel('mortar', 179),
    x = near.u.x;
  tick(near.s, 1 / 60);
  assert.equal(near.u.fire, 0);
  assert(near.u.x < x);
  const boundary = duel('mortar', 180);
  tick(boundary.s, 1 / 60);
  assert(boundary.u.fire > 0);
});
check('军医只治疗存活友军步兵，抢修只作用于已有装甲', () => {
  const s = fresh();
  s.units = [];
  s.walls = [];
  spawnUnit(s, 0, 'medic', 600);
  const medic = s.units[0];
  s.units = [medic];
  spawnUnit(s, 0, 'infantry', 640);
  const patient = s.units[1];
  s.units = [medic, patient];
  patient.hp -= 12;
  spawnUnit(s, 0, 'tank', 620);
  const tank = s.units[2];
  tank.hp -= 200;
  spawnUnit(s, 0, 'helicopter', 620);
  const heli = s.units[3];
  heli.hp -= 100;
  const hp = patient.hp;
  tick(s, 1 / 60);
  assert.equal(patient.hp, hp + 4);
  assert.equal(tank.hp, tank.maxHp - 200);
  assert.equal(heli.hp, heli.maxHp - 100);
  s.players[0].energy = 10;
  const card = hand(s, 'repair');
  assert(playCard(s, 0, card.uid).ok);
  spawnUnit(s, 0, 'ifv', 700);
  const late = s.units.at(-1);
  late.hp -= 100;
  advance(s, 2);
  assert(tank.hp > tank.maxHp - 162 && tank.hp < tank.maxHp - 159);
  assert.equal(late.hp, late.maxHp - 100);
  assert.equal(heli.hp, heli.maxHp - 100);
  assert(patient.hp <= patient.maxHp);
});
check('精确打击只命中一次，新增指令统一校验落点', () => {
  const s = fresh();
  s.units = [];
  s.walls = [];
  s.original.fill(374);
  s.terrain.fill(374);
  spawnUnit(s, 1, 'tank', 900);
  const u = s.units[0];
  u.cooldown = 1000;
  s.players[0].energy = 10;
  const p = hand(s, 'precision');
  const before = s.explosions;
  assert.equal(playCard(s, 0, p.uid).ok, false);
  assert.equal(s.players[0].energy, 10);
  assert(playCard(s, 0, p.uid, 850).ok);
  advance(s, 2);
  assert.equal(s.explosions, before + 1);
  assert(u.hp < u.maxHp);
  assert.equal(s.markers.length, 0);
  for (const id of [
    'smoke',
    'precision',
    'artillery',
    'sniper',
    'medic',
    'mortar',
    'ifv',
  ])
    assert(needsTarget(id));
  for (const id of ['recon', 'repair', 'supply'])
    assert.equal(needsTarget(id), false);
});
check('卧姿狙击手按真实枪口检查视线，必要时起身开火', () => {
  const s = fresh();
  s.units = [];
  s.walls = [];
  spawnUnit(s, 0, 'sniper', 590);
  const u = s.units[0];
  s.units = [u];
  spawnUnit(s, 1, 'infantry', 1360);
  s.units = [u, s.units[1]];
  s.units[1].cooldown = 1000;
  setOrder(s, 0, 'prone');
  setOrder(s, 1, 'hold');
  u.cooldown = 0;
  tick(s, 1 / 60);
  assert(u.fire > 0);
  assert.equal(u.pose, 'idle');
});
check('40种资源、合法20张自选卡组、双方真实随机起手且无免费单位', () => {
  assert.equal(Object.keys(CARDS).length, 40);
  assert(validDeck(DECK));
  assert(!validDeck([...DECK.slice(0, 19), DECK[0]]));
  assert(!validDeck([...DECK.slice(0, 19), 'unknown']));
  assert(!validDeck(DECK.slice(1)));
  for (let seed = 0; seed < 20; seed++) {
    const ai = chooseAiDeck(seed);
    assert(validDeck(ai));
    const s = createGame(seed, DECK, ai);
    assert.equal(s.units.length, 0);
    s.players.forEach((p, i) => {
      assert.equal(p.hand.length, 6);
      assert.equal(p.deck.length, 14);
      assert.deepEqual(
        [...p.hand.map((h) => h.id), ...p.deck].sort(),
        [...(i ? ai : DECK)].sort(),
      );
    });
  }
  assert.notDeepEqual(
    createGame(1).players[0].hand.map((h) => h.id),
    createGame(2).players[0].hand.map((h) => h.id),
  );
  assert.throws(() => createGame(1, DECK.slice(1)));
});
check('双方洗牌随机流隔离，原始卡组不可被战斗改写', () => {
  const deck = [...DECK],
    a = createGame(9, deck),
    b = createGame(9, deck);
  deck.reverse();
  assert.deepEqual(a.players[0].loadout, DECK);
  for (const s of [a, b]) {
    const p = s.players[0];
    p.discard = [...p.deck, ...p.hand.map((h) => h.id)];
    p.deck = [];
    p.hand = [];
  }
  a.seed = 12991;
  draw(a, 1);
  spawnUnit(a, 1, 'tank', 3200);
  explode(a, 2000, 370, 25, 2, 1);
  draw(a, 0, 6);
  draw(b, 0, 6);
  assert.deepEqual(
    a.players[0].hand.map((h) => h.id),
    b.players[0].hand.map((h) => h.id),
  );
  assert.notEqual(a.players[0].loadout, a.players[1].loadout);
});
const arena = () => {
  const s = createGame(67);
  startGame(s);
  s.aiIn = 1e6;
  s.walls = [];
  s.terrain.fill(374);
  s.original.fill(374);
  return s;
};
check('同一班组遭遇敌军时独立卧倒、下蹲、掩护和交替推进', () => {
  const s = arena();
  spawnUnit(s, 0, 'infantry', 700);
  spawnUnit(s, 1, 'infantry', 940);
  for (const u of s.units) {
    u.cooldown = 100;
    u.hp = u.maxHp = 10000;
    u.decisionIn = 0;
  }
  tick(s, 1 / 60);
  const own = s.units.filter((u) => u.side === 0);
  assert(own.some((u) => u.pose === 'prone'));
  assert(own.some((u) => u.pose === 'crouch'));
  assert(own.some((u) => u.moving));
  assert(new Set(own.map((u) => u.tactic)).size >= 4);
  const before = own.map((u) => u.tactic);
  advance(s, 0.2);
  assert.deepEqual(
    own.map((u) => u.tactic),
    before,
  );
});
check('低士气幸存者撤退，重伤崩溃者投降且停止所有战斗行为', () => {
  const s = arena();
  spawnUnit(s, 0, 'militia', 700);
  const u = s.units[0];
  s.units = [u];
  spawnUnit(s, 1, 'infantry', 900);
  u.personalMorale = 25;
  u.decisionIn = 0;
  tick(s, 1 / 60);
  assert.equal(u.tactic, 'retreat');
  assert(u.x < 700);
  u.hp = u.maxHp * 0.2;
  u.personalMorale = 10;
  u.decisionIn = 0;
  tick(s, 1 / 60);
  assert(u.surrendered);
  assert(!isCombatant(u));
  assert.equal(s.players[1].captures, 1);
  const hp = u.hp,
    x = u.x;
  s.projectiles.push({
    x: 850,
    y: 340,
    startX: 850,
    startY: 340,
    tx: u.x,
    ty: 347,
    side: 1,
    targetUid: u.uid,
    base: null,
    damage: 999,
    radius: 0,
    life: 0.1,
    total: 0.1,
  });
  explode(s, u.x, u.y - 20, 35, 999, 1);
  for (const id of ['rally', 'medevac', 'fortify', 'morale']) {
    s.players[0].energy = 10;
    const h = hand(s, id);
    assert(playCard(s, 0, h.uid).ok);
  }
  advance(s, 1);
  assert.equal(u.hp, hp);
  assert.equal(u.x, x);
  assert.equal(u.fire, 0);
  assert(u.surrendered);
  advance(s, 6);
  assert(!s.units.includes(u));
  assert.equal(s.players[1].kills, 0);
});
check('所有坦克主炮装填时同轴机枪仍独立开火，主副武器可同帧射击', () => {
  for (const id of ['tank', 'light_tank', 'heavy_tank']) {
    const s = arena();
    spawnUnit(s, 0, id, 700);
    const u = s.units[0];
    spawnUnit(s, 1, 'infantry', 1000);
    u.cooldown = 20;
    u.secondaryCooldown = 0;
    tick(s, 1 / 60);
    assert(s.projectiles.some((p) => p.weapon === 'coax'));
    assert(!s.projectiles.some((p) => p.side === 0 && p.radius > 0));
    s.projectiles = [];
    u.cooldown = 0;
    u.secondaryCooldown = 0;
    tick(s, 1 / 60);
    assert(s.projectiles.some((p) => p.weapon === 'coax'));
    assert(s.projectiles.some((p) => p.side === 0 && p.radius > 0));
    const vehicle = arena();
    spawnUnit(vehicle, 0, id, 700);
    spawnUnit(vehicle, 1, 'tank', 900);
    spawnUnit(vehicle, 1, 'helicopter', 1000);
    vehicle.units[0].secondaryCooldown = 0;
    tick(vehicle, 1 / 60);
    assert(!vehicle.projectiles.some((p) => p.weapon === 'coax'));
  }
});
check('防空组只瞄准空中目标，反坦克爆炸只给装甲额外伤害', () => {
  const s = arena();
  spawnUnit(s, 0, 'manpads', 700);
  spawnUnit(s, 1, 'infantry', 900);
  for (const u of s.units) u.cooldown = 0;
  tick(s, 1 / 60);
  assert(!s.projectiles.some((p) => p.side === 0));
  spawnUnit(s, 1, 'helicopter', 1100);
  advance(s, 0.2);
  assert(s.projectiles.some((p) => p.side === 0));
  const a = arena();
  spawnUnit(a, 1, 'infantry', 800);
  spawnUnit(a, 1, 'tank', 800);
  a.units = [a.units[0], a.units.at(-1)];
  a.units.forEach((u) => {
    u.hp = u.maxHp = 1000;
    u.pose = 'idle';
  });
  explode(a, 800, 354, 30, 10, 0, 1, 1.6);
  assert.equal(1000 - a.units[0].hp, 10);
  assert.equal(1000 - a.units[1].hp, 16);
});
check('新增七种指令分别作用，炮幕恰好五轮且循环牌数守恒', () => {
  const s = arena();
  spawnUnit(s, 0, 'infantry', 600);
  spawnUnit(s, 1, 'tank', 1500);
  const u = s.units[0],
    v = s.units.at(-1),
    p = s.players[0];
  u.personalMorale = 20;
  u.suppression = 50;
  u.hp -= 15;
  const use = (id) => {
    p.hand = [];
    p.energy = 10;
    const h = hand(s, id);
    assert(playCard(s, 0, h.uid, 1800).ok);
  };
  use('rally');
  assert.equal(u.personalMorale, 60);
  assert.equal(u.suppression, 10);
  use('medevac');
  assert.equal(u.hp, u.maxHp - 5);
  assert.equal(u.personalMorale, 68);
  use('fortify');
  assert.equal(p.fortify, 10);
  assert.equal(u.personalMorale, 78);
  use('emp');
  assert.equal(s.players[1].jam, 14);
  assert.equal(s.players[1].recon, 0);
  v.cooldown = 1;
  v.secondaryCooldown = 0.2;
  use('sabotage');
  assert.equal(v.cooldown, 2.8);
  assert.equal(v.secondaryCooldown, 2);
  use('ammo');
  assert.equal(p.hand.length, 3);
  s.units = [];
  use('barrage');
  advance(s, 3);
  assert.equal(s.explosions, 5);
  assert.equal(s.markers.length, 0);
});
check('山地兵加快攀墙，工兵破墙而非原地卡住', () => {
  for (const id of ['mountain', 'engineers']) {
    const s = arena();
    s.walls = [{ uid: 1, x: 510, width: 34, height: 32, hp: 140 }];
    spawnUnit(s, 0, id, 480);
    s.units = [s.units[0]];
    tick(s, 1 / 60);
    if (id === 'mountain') {
      assert.equal(s.units[0].climbDuration, 0.65);
      advance(s, 1);
      assert(s.units[0].x > 530);
    } else {
      advance(s, 2.5);
      assert.equal(s.walls[0].hp, 0);
      assert(s.units[0].x > 530);
    }
  }
});
check('全军增益影响机枪，士气技能不被自然恢复削掉，干扰不缩短封锁', () => {
  const s = arena();
  spawnUnit(s, 0, 'tank', 700);
  spawnUnit(s, 1, 'infantry', 1180);
  s.players[0].morale = 8;
  s.players[0].recon = 10;
  s.units[0].secondaryCooldown = 0;
  tick(s, 1 / 60);
  const shot = s.projectiles.find((p) => p.weapon === 'coax');
  assert(shot);
  assert.equal(shot.damage, 3 * 1.35);
  const t = arena();
  spawnUnit(t, 0, 'infantry', 500);
  t.units[0].personalMorale = 100;
  t.units[0].decisionIn = 0;
  tick(t, 1 / 60);
  assert.equal(t.units[0].personalMorale, 100);
  t.players[1].jam = 13;
  const h = hand(t, 'jam');
  assert(playCard(t, 0, h.uid).ok);
  assert.equal(t.players[1].jam, 13);
});
check('受压制后自动低姿态前进，姿态与实际速度一致', () => {
  const s = arena();
  spawnUnit(s, 0, 'infantry', 700);
  const u = s.units[0];
  s.units = [u];
  spawnUnit(s, 1, 'infantry', 1200);
  s.units = s.units.slice(0, 2);
  u.suppression = 90;
  u.decisionIn = 0;
  const x = u.x;
  tick(s, 1 / 60);
  assert.equal(u.pose, 'prone');
  assert(u.x - x <= (CARDS.infantry.speed * u.pace * 0.25) / 60 + 0.001);
});
check('出牌、补给和循环重洗均保持双方20张卡牌守恒', () => {
  const s = createGame(710),
    originals = s.players.map((p) => [...p.loadout].sort());
  startGame(s);
  s.aiIn = 1e6;
  for (let n = 0; n < 100; n++)
    for (const side of [0, 1]) {
      const p = s.players[side];
      p.energy = 10;
      const h = p.hand[0];
      if (h)
        assert(
          playCard(
            s,
            side,
            h.uid,
            CARDS[h.id].type === 'unit' ? (side ? 3500 : 300) : 1800,
          ).ok,
        );
      draw(s, side, 1);
      assert.deepEqual(
        [...p.hand.map((h) => h.id), ...p.deck, ...p.discard].sort(),
        originals[side],
      );
    }
});
check('三局完整模拟均可结算，资源与地形始终有效', () => {
  for (const seed of [13, 71, 102]) {
    const s = createGame(seed);
    startGame(s);
    let decision = 0;
    for (
      let frame = 0;
      frame < 240 * 60 + 1 && s.status === 'playing';
      frame++
    ) {
      if (frame >= decision) {
        const p = s.players[0];
        const h = p.hand.find((h) => CARDS[h.id].cost <= p.energy);
        if (h) {
          const c = CARDS[h.id],
            foes = s.units.filter((u) => u.side === 1 && u.hp > 0);
          playCard(
            s,
            0,
            h.uid,
            c.type === 'unit'
              ? 330
              : c.targetGround
                ? (foes[0]?.x ?? 1100)
                : undefined,
          );
        }
        decision = frame + 120;
      }
      tick(s, 1 / 60);
    }
    assert.equal(s.status, 'finished');
    for (const p of s.players) {
      assert(p.energy >= 0 && p.energy <= 10);
      assert(p.hp >= 0 && p.hp <= 1000);
      assert(p.hand.length <= 6);
    }
    assert(s.units.every((u) => Number.isFinite(u.x) && Number.isFinite(u.y)));
    assert(
      s.terrain.every((y, x) => y >= s.original[x] && y <= s.original[x] + 32),
    );
    console.log(
      `  seed ${seed}: ${s.result}, ${s.time.toFixed(1)}s, ${Math.round(s.players[0].hp)}:${Math.round(s.players[1].hp)}`,
    );
  }
});
console.log(`${count} gameplay checks passed`);
