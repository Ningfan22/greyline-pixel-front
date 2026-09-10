import { ammunition, FLIGHT, isTracer } from '../game/ballistics.ts';
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
  requestDraw,
  ARTILLERY,
  DRAW_COST,
  MAX_CRATER_DEPTH,
  formationPositions,
  vehicleContact,
  muzzlePoint,
  canTakeDamage,
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
const failures = [];
function check(name, fn) {
  try {
    fn();
    count++;
    console.log('✓ ' + name);
  } catch (error) {
    failures.push(name);
    console.error('FAIL ' + name + '\n' + error.stack);
  }
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
check('干扰封锁主动抽牌，补给仍可使用', () => {
  const s = fresh(),
    p = s.players[0];
  p.hand = [];
  p.drawIn = 2;
  p.jam = 3;
  advance(s, 1);
  assert(!requestDraw(s, 0).ok);
  assert(Math.abs(p.drawIn - 1) < 0.001);
  const supply = hand(s, 'supply');
  assert(playCard(s, 0, supply.uid).ok);
  assert.equal(p.hand.length, 2);
  advance(s, 2.2);
  assert.equal(p.drawIn, 0);
  assert(requestDraw(s, 0).ok);
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
  assert.equal(hold.units[0].x, formationPositions(0, 'infantry', 175)[0]);
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
  assert(changed >= 25 && changed <= 36);
  assert(ground(s, 900) > 374 && ground(s, 900) <= 379);
  for (let i = 0; i < 20; i++) explode(s, 900, ground(s, 900) - 8, 68, 55, 0);
  assert(ground(s, 900) <= 374 + MAX_CRATER_DEPTH);
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
  assert.equal(u.motion, 'ground');
  u.y = 374;
  for (let i = 0; i < 6; i++) explode(s, 900, ground(s, 900) - 8, 68, 0, 0);
  tick(s, 1 / 60);
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
  target.secondaryCooldown = 1e6;
  target.pace = 0;
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
  u.secondaryCooldown = 1000;
  u.pace = 0;
  s.players[0].energy = 10;
  const p = hand(s, 'precision');
  const before = s.explosions;
  assert.equal(playCard(s, 0, p.uid).ok, false);
  assert.equal(s.players[0].energy, 10);
  assert(playCard(s, 0, p.uid, 900).ok);
  advance(s, 2);
  assert.equal(s.explosions, before);
  advance(s, 1);
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
  advance(s, 8);
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
check('枪弹、炮弹和火箭使用各自速度与弹道，曳光按射击次数间隔显示', () => {
  assert.equal(ammunition('heavy_tank'), 'cannon');
  assert.equal(ammunition('manpads'), 'rocket');
  assert.equal(ammunition('grenadiers'), 'grenade');
  assert.equal(ammunition('mortar'), 'mortar');
  assert(FLIGHT.rifle.minimum < 0.05);
  assert(FLIGHT.cannon.arc < 6);
  assert(FLIGHT.mortar.arc > 100);
  assert.deepEqual(
    Array.from({ length: 8 }, (_, i) => isTracer('machinegun', i + 1)),
    [true, false, false, false, true, false, false, false],
  );
  const s = arena();
  spawnUnit(s, 0, 'infantry', 700);
  spawnUnit(s, 1, 'infantry', 850);
  s.units = [s.units[0], s.units[6]];
  s.units[0].cooldown = 0;
  s.units[1].cooldown = 100;
  tick(s, 1 / 60);
  const p = s.projectiles.find((p) => p.side === 0);
  assert(p);
  assert(p.total < 0.05);
  assert.equal(p.arc, 0);
  assert.equal(p.ammunition, 'rifle');
  assert.equal(s.units[0].muzzleX, p.startX);
  assert.equal(s.units[0].muzzleY, p.startY);
});
check('高速弹丸仍检查完整飞行段，不穿透土坡', () => {
  const s = arena();
  spawnUnit(s, 1, 'tank', 900);
  const u = s.units[0],
    hp = u.hp;
  for (let x = 790; x < 810; x++) s.terrain[x] = 300;
  s.projectiles.push({
    x: 700,
    y: 340,
    startX: 700,
    startY: 340,
    tx: 900,
    ty: 340,
    side: 0,
    targetUid: u.uid,
    base: null,
    damage: 50,
    radius: 0,
    life: 0.035,
    total: 0.035,
    arc: 0,
    ammunition: 'rifle',
    tracer: false,
  });
  tick(s, 0.05);
  assert.equal(u.hp, hp);
  assert.equal(s.projectiles.length, 0);
  assert(s.particles.some((p) => p.kind === 'dust'));
});
check('射击与命中视觉粒子不消耗战斗或洗牌随机流', () => {
  const s = arena();
  spawnUnit(s, 0, 'infantry', 700);
  spawnUnit(s, 1, 'infantry', 850);
  s.units = [s.units[0], s.units[6]];
  s.units[0].cooldown = 0;
  s.units[1].cooldown = 100;
  const seed = s.seed,
    drawSeeds = s.players.map((p) => p.drawSeed);
  tick(s, 1 / 60);
  assert.equal(s.seed, seed);
  assert.deepEqual(
    s.players.map((p) => p.drawSeed),
    drawSeeds,
  );
  const before = s.seed;
  explode(s, 1800, ground(s, 1800) - 8, 30, 10, 0);
  assert.equal(s.seed, before);
});
check('主动抽牌严格扣除 2 点，冷却、满手、干扰及暂停均无额外消耗', () => {
  const s = arena(),
    p = s.players[0];
  p.hand = p.hand.slice(0, 3);
  const starting = p.hand.length;
  advance(s, 12);
  assert.equal(p.hand.length, starting, '时间经过不能自动抽牌');
  p.energy = 6;
  assert(requestDraw(s, 0).ok);
  assert.equal(p.energy, 6 - DRAW_COST);
  assert.equal(p.hand.length, 4);
  assert.equal(requestDraw(s, 0).ok, false);
  assert.equal(p.energy, 4);
  advance(s, 9.1);
  p.energy = 1.99;
  assert.equal(requestDraw(s, 0).ok, false);
  assert.equal(p.energy, 1.99);
  p.energy = 4;
  p.jam = 2;
  assert.equal(requestDraw(s, 0).ok, false);
  p.jam = 0;
  s.status = 'paused';
  assert.equal(requestDraw(s, 0).ok, false);
  s.status = 'playing';
  draw(s, 0, 2);
  assert.equal(p.hand.length, 6);
  assert.equal(requestDraw(s, 0).ok, false);
  assert.equal(p.energy, 4);
});
check('AI 空手及低价值技能手牌都能付费补牌并重新部署', () => {
  for (const skills of [
    [],
    ['repair', 'morale', 'smoke'],
    ['repair', 'morale', 'smoke', 'recon', 'precision', 'artillery'],
  ]) {
    const s = arena(),
      p = s.players[1];
    p.hand = skills.map((id) => ({ id, uid: ++s.uid }));
    p.deck = ['infantry', 'marines'];
    p.discard = [];
    p.energy = 10;
    p.drawIn = 0;
    s.aiIn = 0;
    advance(s, 12);
    assert(
      s.units.some((u) => u.side === 1),
      skills.join(','),
    );
    assert(p.energy < 10);
    assert(p.drawIn > 0 || p.played > 0);
  }
});
check('部署在两侧边界的班组仍保持 38 像素间距，预览和实体一致', () => {
  for (const side of [0, 1])
    for (const id of ['infantry', 'militia', 'sniper']) {
      const s = arena(),
        x = side === 0 ? 110 : W - 110;
      spawnUnit(s, side, id, x);
      assert.deepEqual(
        s.units.map((u) => u.x),
        formationPositions(side, id, x),
      );
      for (let i = 1; i < s.units.length; i++)
        assert.equal(Math.abs(s.units[i].x - s.units[i - 1].x), 38);
      assert(s.units.every((u) => u.x >= 112 && u.x <= W - 112));
    }
});
check('撤退转身并持续跑离，士气小幅恢复不反复切换姿态', () => {
  for (const side of [0, 1]) {
    const s = arena();
    spawnUnit(s, side, 'infantry', 1800);
    const u = s.units[0];
    s.units = [u];
    spawnUnit(s, side === 0 ? 1 : 0, 'infantry', side === 0 ? 2100 : 1500);
    s.units = [u, s.units[1]];
    for (const v of s.units) {
      v.cooldown = 100;
      v.decisionIn = 100;
    }
    u.personalMorale = 30;
    u.decisionIn = 0;
    const x = u.x,
      dir = side === 0 ? -1 : 1;
    for (let i = 0; i < 180; i++) {
      tick(s, 1 / 60);
      if (i === 30) u.personalMorale = 45;
      assert.equal(u.tactic, 'retreat');
      assert.equal(u.facing, dir);
      assert.equal(u.pose, 'run');
      assert.equal(u.fire, 0);
    }
    assert((u.x - x) * dir > 90);
    u.x = side === 0 ? 55 : W - 55;
    const gait = u.walk;
    tick(s, 1 / 60);
    assert.equal(u.moving, false);
    assert.equal(u.pose, 'idle');
    assert.equal(u.walk, gait);
    u.personalMorale = 95;
    u.decisionIn = 0;
    u.retreatUntil = 100;
    tick(s, 1 / 60);
    assert.equal(u.personalMorale, 95);
  }
});
check('撤退士兵可以与迎面推进的友军错身通过', () => {
  const s = arena();
  spawnUnit(s, 0, 'infantry', 700);
  const u = s.units[0],
    friend = s.units[1];
  s.units = [u, friend];
  u.x = 700;
  friend.x = 695;
  u.lane = friend.lane = 0;
  friend.facing = 1;
  u.tactic = 'retreat';
  u.retreatUntil = 100;
  u.personalMorale = 30;
  u.decisionIn = 100;
  friend.decisionIn = 100;
  advance(s, 0.3);
  assert(u.x < 695);
  assert(friend.x > 700);
});
check('坦克履带跨浅坑保持支撑，宽坡倾斜且炮口跟随车身', () => {
  for (const id of ['tank', 'light_tank', 'heavy_tank', 'ifv']) {
    const s = arena();
    crater(s, 900, 18, 5);
    const contact = vehicleContact(s, 900, id);
    assert.equal(contact.y, 374);
    assert.equal(contact.angle, 0);
    spawnUnit(s, 0, id, 900);
    const u = s.units[0];
    u.pace = 0;
    advance(s, 0.5);
    assert.equal(u.y, 374);
    for (let x = 650; x < 1150; x++) s.terrain[x] = 374 + (x - 650) * 0.1;
    const tilted = vehicleContact(s, 900, id);
    assert(tilted.angle > 0.09 && tilted.angle < 0.11);
    const before = u.y;
    tick(s, 1 / 60);
    assert(u.y > before && u.y < tilted.y);
    advance(s, 1);
    assert(Math.abs(u.hullAngle - tilted.angle) < 0.001);
    const center = { ...u, hullAngle: 0 },
      flat = muzzlePoint(center, 1100),
      tip = muzzlePoint(u, 1100);
    const dx = flat.x - u.x,
      dy = flat.y - u.y;
    assert(
      Math.abs(
        tip.y - (u.y + dx * Math.sin(u.hullAngle) + dy * Math.cos(u.hullAngle)),
      ) < 1e-6,
    );
    assert(tip.y > flat.y);
    assert(muzzlePoint(u, 700).y < muzzlePoint(center, 700).y);
    for (let x = 650; x < 1150; x++)
      s.terrain[x] = Math.min(386, 374 + Math.abs(x - 908) * 1.25);
    assert(
      vehicleContact(s, 900, id).y <= 375,
      '两坑之间的窄土脊也必须支撑履带',
    );
  }
});
check('火炮按预警延时分批落弹，散布在范围内且落点预先锁定', () => {
  for (const kind of ['artillery', 'barrage', 'precision']) {
    const s = arena(),
      cfg = ARTILLERY[kind];
    s.players[0].energy = 10;
    assert(playCard(s, 0, hand(s, kind).uid, 1800).ok);
    const marker = s.markers[0],
      impacts = [...marker.impacts];
    assert.equal(impacts.length, cfg.count);
    impacts.forEach((x, i) =>
      assert(
        Math.abs(x - (1800 + (i - (cfg.count - 1) / 2) * cfg.spacing)) <=
          cfg.scatter,
      ),
    );
    advance(s, cfg.delay - 0.1);
    assert.equal(s.explosions, 0);
    s.seed = 8372;
    advance(s, 0.2);
    assert.equal(s.explosions, 1);
    assert.equal(s.blasts[0].x, impacts[0]);
    assert.deepEqual(marker.impacts, impacts);
    if (cfg.count > 1) {
      advance(s, cfg.interval - 0.25);
      assert.equal(s.explosions, 1);
      advance(s, 0.3);
      assert.equal(s.explosions, 2);
    }
  }
});
check('普通火炮不能一轮清空满编队伍，边缘伤害衰减且移动可躲开精确打击', () => {
  const s = arena();
  spawnUnit(s, 1, 'infantry', 1800);
  s.players[0].energy = 10;
  assert(playCard(s, 0, hand(s, 'artillery').uid, 1705).ok);
  s.units.forEach((u) => {
    u.pace = 0;
    u.decisionIn = 100;
    u.cooldown = 100;
  });
  advance(s, 5);
  assert(s.units.filter((u) => u.hp > 0).length >= 4);
  const a = arena();
  spawnUnit(a, 1, 'infantry', 1600);
  a.units = a.units.slice(0, 2);
  a.units[0].x = 1600;
  a.units[1].x = 1640;
  a.units.forEach((u) => (u.pose = 'idle'));
  explode(a, 1600, 354, 42, 26, 0);
  assert(
    a.units[0].maxHp - a.units[0].hp > 4 * (a.units[1].maxHp - a.units[1].hp),
  );
  const moving = arena();
  spawnUnit(moving, 1, 'tank', 1800);
  const tank = moving.units[0];
  moving.players[0].energy = 10;
  assert(playCard(moving, 0, hand(moving, 'precision').uid, 1800).ok);
  advance(moving, 3);
  assert.equal(tank.hp, tank.maxHp);
  assert(tank.x < 1740);
  const bridge = arena();
  crater(bridge, 1800, 25, 24);
  spawnUnit(bridge, 1, 'tank', 1800);
  const armored = bridge.units[0];
  explode(bridge, 1800, ground(bridge, 1800) - 8, 26, 150, 0);
  assert(armored.maxHp - armored.hp > 50, '桥接坦克仍受到坑底爆炸冲击');
});
const bulletAt = (s, u, damage = 20) => {
  s.projectiles.push({
    x: u.x - 100,
    y: 347,
    startX: u.x - 100,
    startY: 347,
    tx: u.x,
    ty: 347,
    side: u.side === 0 ? 1 : 0,
    targetUid: u.uid,
    base: null,
    damage,
    radius: 0,
    life: 0.01,
    total: 0.01,
    arc: 0,
    ammunition: 'rifle',
    tracer: false,
  });
  tick(s, 1 / 60);
};
const woundedCase = (side = 0) => {
  const s = arena();
  spawnUnit(s, side, 'infantry', 1400);
  const u = s.units[0];
  s.units = [u];
  setOrder(s, side, 'hold');
  s.injurySeed = 0;
  bulletAt(s, u);
  assert(u.wounded);
  return { s, u };
};
check('非致命中弹可倒地成伤员，暂停冻结失血，倒地不计击杀也不再作战', () => {
  const { s, u } = woundedCase();
  assert(u.hp > 0);
  assert(!isCombatant(u));
  assert(canTakeDamage(u));
  assert.equal(s.players[1].kills, 0);
  const x = u.x;
  advance(s, 2);
  assert.equal(u.x, x);
  assert.equal(u.fire, 0);
  assert.equal(u.moving, false);
  assert.equal(u.pose, 'prone');
  const life = u.bleedOut;
  s.status = 'paused';
  advance(s, 10);
  assert.equal(u.bleedOut, life);
  s.status = 'playing';
  advance(s, 24);
  assert.equal(u.hp, 0);
  assert.equal(s.players[1].kills, 1);
  advance(s, 3);
  assert.equal(s.players[1].kills, 1);
  assert(!s.units.includes(u));
});
check('军医可救起伤员，急救也可救起，死亡与投降保持终态', () => {
  for (const treatment of ['medic', 'medevac']) {
    const { s, u } = woundedCase();
    if (treatment === 'medic') {
      spawnUnit(s, 0, 'medic', 1430);
      s.units = [u, s.units[1]];
      s.units[1].supportCooldown = 0;
    } else {
      s.players[0].energy = 10;
      assert(playCard(s, 0, hand(s, 'medevac').uid).ok);
    }
    advance(s, 1.6);
    assert(!u.wounded);
    assert(u.hp >= u.maxHp * 0.4);
    assert(u.injuryCooldown > 0);
    assert.equal(s.players[1].kills, 0);
  }
  const { s, u } = woundedCase();
  bulletAt(s, u, 999);
  assert.equal(u.hp, 0);
  assert.equal(s.players[1].kills, 1);
  s.players[0].energy = 10;
  assert(playCard(s, 0, hand(s, 'medevac').uid).ok);
  assert.equal(u.hp, 0);
});
check('未倒地中弹、致命中弹和炮击与伤员分支区分，倒地仍会承受已有炮弹', () => {
  const s = arena();
  spawnUnit(s, 0, 'infantry', 1400);
  s.units = [s.units[0]];
  const u = s.units[0];
  setOrder(s, 0, 'hold');
  s.injurySeed = 0;
  bulletAt(s, u, 3);
  assert(!u.wounded);
  assert(u.hp > 0);
  bulletAt(s, u, 999);
  assert.equal(u.hp, 0);
  assert(!u.wounded);
  const { s: b, u: v } = woundedCase();
  explode(b, v.x, v.y - 20, 30, 999, 1);
  assert.equal(v.hp, 0);
  assert.equal(b.players[1].kills, 1);
});
check('爆炸火光和烟雾独立存在四秒，不受粒子上限或暂停影响', () => {
  const s = arena();
  explode(s, 1800, 366, 42, 0, 0);
  assert.equal(s.blasts.length, 1);
  advance(s, 0.3);
  assert(s.blasts[0].age >= 0.3);
  s.particles = [];
  advance(s, 2);
  assert.equal(s.blasts.length, 1);
  assert(s.blasts[0].age > 2);
  s.status = 'paused';
  const age = s.blasts[0].age;
  advance(s, 5);
  assert.equal(s.blasts[0].age, age);
  s.status = 'playing';
  advance(s, 2);
  assert.equal(s.blasts.length, 0);
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
        if (p.hand.length < 3) requestDraw(s, 0);
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
      s.terrain.every(
        (y, x) => y >= s.original[x] && y <= s.original[x] + MAX_CRATER_DEPTH,
      ),
    );
    console.log(
      `  seed ${seed}: ${s.result}, ${s.time.toFixed(1)}s, ${Math.round(s.players[0].hp)}:${Math.round(s.players[1].hp)}`,
    );
  }
});
console.log(`${count} gameplay checks passed`);
if (failures.length)
  throw new Error(`${failures.length} failures: ${failures.join('; ')}`);
