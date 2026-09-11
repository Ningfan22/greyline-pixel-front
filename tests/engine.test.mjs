import {
  damageScenery,
  obstacleBoxes,
  sceneryIntercept,
  observationPenalty,
  pointVisible,
} from '../game/world.ts';
import { ammunition, FLIGHT, isTracer } from '../game/ballistics.ts';
import { weaponCard, weaponModel, copyLimit } from '../game/cards.ts';
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
  projectileIntercept,
  DURATION,
  W,
  MAX_HAND,
  DECK,
  AIR_ALTITUDE,
  smokeBlocks,
  unitRange,
  needsTarget,
  requestDraw,
  refreshVision,
  snapshot,
  cardCost,
  cardReadyIn,
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
  s.scenery = [];
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
  const s = fresh();
  s.units = s.units.filter((u) => u.side === 1);
  const before = s.units.length,
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
  assert.equal(playCard(s, 0, c.uid, W + 1).ok, false);
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
  assert(ground(s, 720) <= 374 + MAX_CRATER_DEPTH);
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
  p.discard = ['tank', 'jam'].map((id) => ({ id, uid: ++s.uid }));
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
  s.time = DURATION - 0.001;
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
  assert(changed >= 45 && changed <= 72);
  assert(ground(s, 900) >= 384 && ground(s, 900) <= 388);
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
check('士兵主动进入弹坑并在稳定姿态下持续射击', () => {
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
    fired ||=
      u.cover > 0.2 && u.fire > 0 && (u.pose === 'idle' || u.pose === 'crouch');
  }
  assert(crouched);
  assert(fired);
  assert(craterCover(s, u.x, 990) > 0.2);
  const x = u.x;
  s.units = [u];
  advance(s, 5);
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
  spawnUnit(s, 0, 'supply_team', target.x - 100);
  const eyes = s.units[2];
  s.units = [u, target, eyes];
  eyes.cooldown = 1e6;
  eyes.pace = 0;
  eyes.decisionIn = 1e6;
  refreshVision(s);
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
  advance(d.s, 2.6);
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
check('部队默认从两侧入场，仅烟幕和地雷需要目标位置', () => {
  const s = fresh();
  s.players[0].energy = 10;
  const h = hand(s, 'precision');
  assert(playCard(s, 0, h.uid).ok);
  const gun = s.units.find((u) => u.id === 'precision');
  assert.equal(gun.x, 112);
  assert.equal(s.markers.length, 0);
  s.players[0].energy = 10;
  assert(playCard(s, 0, hand(s, 'artillery').uid, 964).ok);
  assert.equal(s.units.find((u) => u.id === 'artillery').x, 112);
  const enemyGun = { uid: ++s.uid, id: 'precision' };
  s.players[1].hand.push(enemyGun);
  s.players[1].energy = 10;
  assert(playCard(s, 1, enemyGun.uid).ok);
  assert.equal(s.units.at(-1).x, W - 112);
  for (const id of ['smoke', 'antitank_mine']) assert(needsTarget(id));
  for (const id of [
    'precision',
    'artillery',
    'sniper',
    'medic',
    'mortar',
    'ifv',
    'recon',
    'repair',
    'supply',
  ])
    assert(!needsTarget(id));
});
check('十分钟时限才触发按基地生命结算', () => {
  assert.equal(DURATION, 600);
  const s = fresh();
  s.units = [];
  s.time = 240;
  tick(s, 0.02);
  assert.equal(s.status, 'playing');
  s.time = 599.99;
  s.status = 'paused';
  tick(s, 0.02);
  assert.equal(s.time, 599.99);
  s.status = 'playing';
  s.players[0].hp = 800;
  s.players[1].hp = 600;
  tick(s, 0.02);
  assert.equal(s.time, 600);
  assert.equal(s.status, 'finished');
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
  spawnUnit(s, 0, 'scout_drone', 1200);
  refreshVision(s);
  tick(s, 1 / 60);
  assert(u.fire > 0);
  assert.equal(u.pose, 'idle');
});
check('54种资源、合法20张自选卡组、双方真实随机起手且无免费单位', () => {
  assert.equal(Object.keys(CARDS).length, 54);
  assert(validDeck(DECK));
  assert(validDeck([...DECK.slice(0, 19), DECK[0]]));
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
        [...p.hand.map((h) => h.id), ...p.deck.map((h) => h.id)].sort(),
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
    p.discard = [...p.deck, ...p.hand];
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
  s.scenery = [];
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
check('战术指令分别作用，重炮部署为静止单位', () => {
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
  p.energy = 10;
  p.hand = [];
  assert(playCard(s, 0, hand(s, 'barrage').uid, 320).ok);
  advance(s, 8);
  assert.equal(s.units[0].id, 'barrage');
  assert.equal(s.units[0].x, 112);
  assert.equal(s.explosions, 0);
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
      const h = p.hand.find((h) => cardReadyIn(s, h) <= 0);
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
        [
          ...p.hand,
          ...p.deck,
          ...p.discard,
          ...s.units
            .filter((u) => u.side === side && u.sortieCard)
            .map((u) => u.sortieCard),
        ]
          .map((h) => h.id)
          .sort(),
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
    [true, false, true, false, true, false, true, false],
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
    p.deck = ['infantry', 'marines'].map((id) => ({ id, uid: ++s.uid }));
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
check('三种火炮固定发射真实抛物线炮弹，落点有散布并周期装填', () => {
  for (const id of ['artillery', 'barrage', 'precision']) {
    const s = arena();
    spawnUnit(s, 0, id, 600);
    const gun = s.units[0];
    gun.cooldown = 0;
    spawnUnit(s, 1, 'tank', 1100);
    const target = s.units[1];
    target.pace = 0;
    target.cooldown = target.secondaryCooldown = 100;
    target.hp = target.maxHp = 10000;
    spawnUnit(s, 0, 'scout_drone', 1000);
    tick(s, 1 / 60);
    const p = s.projectiles.find((p) => p.sourceUid === gun.uid);
    assert(p?.shell);
    assert(p.total >= 2);
    assert(Math.abs(p.tx - target.x) < 45);
    assert.equal(s.explosions, 0);
    advance(s, 1);
    assert.equal(s.explosions, 0);
    advance(s, 1.3);
    assert.equal(s.explosions, 1);
    assert.equal(gun.x, 600);
    assert.equal(gun.shots, 1);
    advance(s, CARDS[id].rate);
    assert(gun.shots >= 2);
    assert.equal(s.markers.length, 0);
  }
});
check('普通火炮不能一轮清空满编队伍，边缘伤害衰减且移动可躲开精确打击', () => {
  const s = arena();
  spawnUnit(s, 1, 'infantry', 1800);
  s.players[0].energy = 10;
  explode(s, 1705, 366, 36, 44, 0);
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
  moving.projectiles.push({
    uid: ++moving.uid,
    shell: true,
    side: 0,
    x: 1000,
    y: 300,
    startX: 1000,
    startY: 300,
    tx: 1800,
    ty: 366,
    total: 2.6,
    life: 2.6,
    arc: 170,
    ammunition: 'mortar',
    targetUid: tank.uid,
    base: null,
    radius: 22,
    damage: 75,
  });
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
check('爆炸火光与烟雾独立持续播放，不受粒子上限或暂停影响', () => {
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
  advance(s, 5);
  assert.equal(s.blasts.length, 0);
});
check('机枪班与重机枪组各仅一名机枪手，护卫使用步枪且减员不改武器', () => {
  for (const id of ['machinegun', 'heavy_mg']) {
    const s = arena();
    spawnUnit(s, 0, id, 1100);
    const squad = [...s.units];
    assert.equal(
      squad.filter((u) => weaponModel(u) === 'machinegun').length,
      1,
    );
    for (const u of squad) {
      const c = weaponCard(u);
      assert.equal(c.members, 1);
      assert.equal(
        ammunition(u.id, u.member),
        u.member === 0 ? 'machinegun' : 'rifle',
      );
      assert.equal(c.antiAir, u.member === 0);
      assert.equal(c.range, u.member === 0 ? CARDS[id].range : 380);
      if (u.member > 0) {
        assert.equal(c.damage, 4);
        assert.equal(c.rate, 1);
      }
    }
    spawnUnit(s, 1, 'helicopter', 1200);
    const target = s.units.at(-1);
    target.cooldown = 100;
    target.pace = 0;
    squad.forEach((u) => {
      u.cooldown = 0;
      u.decisionIn = 100;
    });
    setOrder(s, 0, 'hold');
    tick(s, 1 / 60);
    const shots = s.projectiles.filter((p) => p.side === 0);
    assert.equal(shots.length, 1);
    assert.equal(shots[0].sourceUid, squad[0].uid);
    squad[0].hp = 0;
    squad[0].deadFor = 0;
    s.projectiles = [];
    advance(s, 0.5);
    assert(!s.projectiles.some((p) => p.side === 0));
    assert(squad.slice(1).every((u) => weaponModel(u) === 'infantry'));
  }
});
check('炮弹临近才触发短距离分散并保持卧倒，不提前跑向范围边缘', () => {
  for (const side of [0, 1]) {
    const s = arena();
    spawnUnit(s, side, 'infantry', side ? 810 : 1000);
    s.units.forEach((u) => {
      u.hp = u.maxHp = 10000;
      u.cooldown = u.decisionIn = 100;
    });
    setOrder(s, side, 'hold');
    const original = s.units.map((u) => u.x);
    s.projectiles.push({
      uid: ++s.uid,
      shell: true,
      side: side ? 0 : 1,
      x: 400,
      y: 300,
      startX: 400,
      startY: 300,
      tx: 905,
      ty: 366,
      total: 2.8,
      life: 2.8,
      arc: 170,
      ammunition: 'mortar',
      targetUid: null,
      base: null,
      radius: 36,
      damage: 20,
    });
    advance(s, 1.9);
    assert(s.units.every((u, i) => u.x === original[i]));
    advance(s, 0.55);
    assert(s.units.some((u) => u.evadeUntil > s.time));
    advance(s, 0.5);
    assert(s.units.every((u) => u.pose === 'prone' && !u.moving));
    assert(s.units.every((u, i) => Math.abs(u.x - original[i]) <= 40));
  }
});
check('友军炮弹、伤员、装甲和空军不会触发步兵分散动作', () => {
  const s = arena();
  spawnUnit(s, 0, 'infantry', 1000);
  s.units[0].wounded = true;
  s.units[0].bleedOut = 25;
  spawnUnit(s, 0, 'tank', 950);
  spawnUnit(s, 0, 'scout_drone', 950);
  const shell = {
    uid: ++s.uid,
    shell: true,
    side: 0,
    x: 800,
    y: 300,
    startX: 800,
    startY: 300,
    tx: 905,
    ty: 366,
    total: 0.4,
    life: 0.4,
    arc: 0,
    ammunition: 'mortar',
    targetUid: null,
    base: null,
    radius: 36,
    damage: 0,
  };
  s.projectiles.push(shell);
  tick(s, 1 / 60);
  assert(s.units.every((u) => !u.evadeUntil));
  shell.side = 1;
  tick(s, 1 / 60);
  assert(
    s.units
      .filter((u) => u.wounded || !CARDS[u.id].members)
      .every((u) => !u.evadeUntil),
  );
});
check('航空单位可部署且高度固定，AI编队保留反甲、防空和空中支援', () => {
  for (const id of [
    'rocket_heli',
    'scout_drone',
    'attack_drone',
    'loiter_drone',
    'interceptor',
  ]) {
    const s = arena();
    s.players[0].energy = 10;
    assert(playCard(s, 0, hand(s, id).uid, 320).ok);
    const u = s.units[0];
    assert.equal(u.y, CARDS[id].altitude);
    advance(s, 1);
    assert.equal(u.y, CARDS[id].altitude);
    assert.equal(u.motion, 'ground');
    assert.equal(u.climbing, 0);
  }
  const choices = new Set();
  for (let seed = 0; seed < 50; seed++) {
    const deck = chooseAiDeck(seed);
    assert(validDeck(deck));
    deck.forEach((id) => choices.add(id));
  }
  for (const id of [
    'javelin',
    'antitank_mine',
    'manpads',
    'sam_vehicle',
    'attack_drone',
    'strike_jet',
    'helicopter',
  ])
    assert(choices.has(id));
});
check('全军增益覆盖巡航、无人机移动及同轴机枪侦察射程', () => {
  for (const id of ['interceptor', 'scout_drone']) {
    const stages = [];
    for (const morale of [0, 8]) {
      const s = arena();
      spawnUnit(s, 0, id, 300);
      s.players[0].morale = morale;
      advance(s, 1);
      stages.push(s.units[0].x - 300);
    }
    assert(Math.abs(stages[1] - stages[0] * 1.2) < 0.001);
  }
  const s = arena();
  spawnUnit(s, 0, 'tank', 1100);
  const tank = s.units[0];
  tank.cooldown = 100;
  tank.pace = 0;
  spawnUnit(s, 1, 'infantry', 1540);
  s.units = [tank, s.units[1]];
  s.units[1].cooldown = 100;
  spawnUnit(s, 0, 'scout_drone', 1250);
  tank.secondaryCooldown = 0;
  tick(s, 1 / 60);
  assert(s.projectiles.some((p) => p.weapon === 'coax'));
});
check('侦察无人机不射击，提供局部穿烟与射程，受干扰或被击落后失效', () => {
  const s = arena();
  spawnUnit(s, 0, 'infantry', 1100);
  const u = s.units[0];
  s.units = [u];
  setOrder(s, 0, 'hold');
  spawnUnit(s, 0, 'scout_drone', 1300);
  const drone = s.units[1];
  s.smokes.push({ x: 1250, life: 8, side: 1 });
  assert.equal(unitRange(s, u), 380 * 1.1);
  assert.equal(smokeBlocks(s, 0, 1100, 1500), false);
  assert.equal(smokeBlocks(s, 0, 350, 900), false); // Outside smoke.
  s.players[0].jam = 5;
  assert.equal(unitRange(s, u), 380);
  assert(smokeBlocks(s, 0, 1100, 1500));
  s.players[0].jam = 0;
  drone.x = 2200;
  assert.equal(unitRange(s, u), 380);
  drone.x = 1300;
  advance(s, 2);
  assert.equal(drone.fire, 0);
  assert.equal(drone.shots, 0);
  drone.hp = 0;
  assert.equal(unitRange(s, u), 380);
  assert(smokeBlocks(s, 0, 1100, 1500));
});
check('截击机持续飞行且只对前方空中目标开火，边界可返航', () => {
  const s = arena();
  spawnUnit(s, 0, 'interceptor', 800);
  const jet = s.units[0];
  jet.cooldown = 0;
  spawnUnit(s, 1, 'tank', 1000);
  tick(s, 1 / 60);
  assert.equal(jet.fire, 0);
  assert(jet.x > 800);
  spawnUnit(s, 1, 'helicopter', 1100);
  refreshVision(s);
  const heli = s.units.at(-1);
  heli.pace = 0;
  heli.cooldown = 100;
  const x = jet.x;
  tick(s, 1 / 60);
  assert(jet.fire > 0);
  assert(jet.x > x);
  assert(jet.moving);
  assert(
    s.projectiles.some(
      (p) => p.sourceUid === jet.uid && p.targetUid === heli.uid,
    ),
  );
  jet.x = W + 155;
  tick(s, 1 / 60);
  assert(!s.units.includes(jet));
  assert.equal(jet.y, CARDS.interceptor.altitude);
});
check('察打与反甲直升机发射导弹，巡飞弹只俯冲一次且自身消耗不计阵亡', () => {
  for (const id of ['rocket_heli', 'attack_drone', 'loiter_drone']) {
    const s = arena();
    spawnUnit(s, 0, id, 800);
    const u = s.units[0];
    u.cooldown = 0;
    spawnUnit(s, 1, 'tank', 1100);
    const tank = s.units[1];
    tank.pace = 0;
    tank.cooldown = tank.secondaryCooldown = 100;
    tick(s, 1 / 60);
    const p = s.projectiles.find((p) => p.sourceUid === u.uid);
    assert(p);
    assert(p.radius > 0);
    assert.equal(p.ammunition, id === 'loiter_drone' ? 'drone' : 'rocket');
    assert(p.armorMultiplier > 1);
    if (id === 'loiter_drone') {
      assert(!s.units.includes(u));
      assert.equal(s.players[1].kills, 0);
      advance(s, 2);
      assert.equal(s.explosions, 1);
      assert(tank.hp < tank.maxHp);
    }
  }
});
check(
  '撤退穿过真实友军射线会受伤，未经过射线不会随机扣血且误伤不计战果',
  () => {
    for (const retreat of [false, true]) {
      const s = arena();
      spawnUnit(s, 0, 'infantry', 800);
      const shooter = s.units[0],
        u = s.units[1];
      s.units = [shooter, u];
      shooter.x = 600;
      u.x = 700;
      u.lane = 0;
      u.tactic = retreat ? 'retreat' : 'advance';
      u.retreatUntil = 100;
      s.units.forEach((v) => {
        v.cooldown = 100;
        v.decisionIn = 100;
      });
      setOrder(s, 0, 'hold');
      const shot = (damage) =>
        s.projectiles.push({
          sourceUid: shooter.uid,
          x: 620,
          y: 337,
          startX: 620,
          startY: 337,
          tx: 900,
          ty: 337,
          side: 0,
          targetUid: null,
          base: null,
          damage,
          radius: 0,
          life: 0.05,
          total: 0.05,
          ammunition: 'rifle',
        });
      const before = u.hp;
      s.injurySeed = 0;
      shot(20);
      tick(s, 0.05);
      if (retreat) {
        assert(u.hp < before);
        assert(u.wounded);
        shot(999);
        s.projectiles.at(-1).y =
          s.projectiles.at(-1).startY =
          s.projectiles.at(-1).ty =
            365;
        tick(s, 0.05);
        assert.equal(u.hp, 0);
        assert.equal(s.players[0].kills, 0);
        assert.equal(s.players[1].kills, 0);
      } else assert.equal(u.hp, before);
    }
  },
);
check('三局完整模拟均可结算，资源与地形始终有效', () => {
  for (const seed of [13, 71, 102]) {
    const s = createGame(seed);
    startGame(s);
    let decision = 0;
    for (
      let frame = 0;
      frame < DURATION * 60 + 2 && s.status === 'playing';
      frame++
    ) {
      if (frame >= decision) {
        const p = s.players[0];
        if (p.hand.length < 3) requestDraw(s, 0);
        const h = p.hand.find(
          (h) => cardCost(h) <= p.energy && cardReadyIn(s, h) <= 0,
        );
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
check('重复卡按每种上限校验，总编队固定20张', () => {
  const base = DECK.filter((id) => id !== 'militia' && id !== 'tank');
  assert.equal(copyLimit('militia'), 6);
  assert.equal(copyLimit('tank'), 2);
  assert(validDeck([...base.slice(0, 14), ...Array(6).fill('militia')]));
  assert(!validDeck([...base.slice(0, 13), ...Array(7).fill('militia')]));
  assert(validDeck([...base.slice(0, 18), 'tank', 'tank']));
  assert(!validDeck([...base.slice(0, 17), 'tank', 'tank', 'tank']));
});
check('主战坦克穿甲两发击毁，非致命命中仅有火星，残骸永久保留', () => {
  const s = arena();
  spawnUnit(s, 0, 'tank', 800);
  spawnUnit(s, 1, 'tank', 1300);
  const [a, b] = s.units;
  a.cooldown = 0;
  b.cooldown = b.secondaryCooldown = 100;
  b.pace = 0;
  tick(s, 1 / 60);
  const p = s.projectiles.find((p) => p.sourceUid === a.uid);
  assert.equal(p.ammunition, 'ap');
  assert.equal(p.radius, 0);
  assert.equal(p.damage, 390);
  advance(s, 0.4);
  assert.equal(b.hp, 260);
  assert.equal(s.explosions, 0);
  assert.equal(s.wrecks.length, 0);
  a.cooldown = 0;
  advance(s, 0.5);
  assert.equal(b.hp, 0);
  assert.equal(s.wrecks.filter((w) => w.id === b.uid).length, 1);
  assert.equal(s.explosions, 1);
  s.units = [];
  advance(s, 35);
  assert.equal(s.wrecks.length, 1);
  assert.equal(s.wrecks[0].falling, false);
  assert(craterCover(s, b.x - 75, b.x + 200) > 0.3);
});
check('标枪与反坦克炮的直击破甲倍率生效，原坦克与直升机强度保留', () => {
  assert.equal(CARDS.tank.hp, 650);
  assert.equal(CARDS.tank.damage, 80);
  assert.equal(CARDS.helicopter.hp, 260);
  assert.equal(CARDS.helicopter.damage, 30);
  for (const id of ['javelin', 'anti_tank_gun']) {
    const s = arena();
    spawnUnit(s, 0, id, 800);
    const a = s.units[0];
    s.units = [a];
    spawnUnit(s, 1, 'tank', 1200);
    const b = s.units[1];
    b.pace = 0;
    b.cooldown = b.secondaryCooldown = 100;
    a.cooldown = 0;
    a.decisionIn = 100;
    setOrder(s, 0, 'hold');
    advance(s, 1);
    assert(b.hp < 540, `${id}: ${b.hp}`);
  }
});
check('地雷预先布设、延迟起爆，仅由装甲触发一次并迟滞目标', () => {
  const s = arena();
  s.players[0].hand = [];
  assert(playCard(s, 0, hand(s, 'antitank_mine').uid, 1000).ok);
  spawnUnit(s, 1, 'infantry', 1000);
  s.units.forEach((u) => {
    u.pace = 0;
    u.cooldown = 100;
  });
  advance(s, 2.1);
  assert.equal(s.mines.length, 1);
  spawnUnit(s, 1, 'tank', 1000);
  const tank = s.units.at(-1);
  tank.pace = 0;
  tick(s, 1 / 60);
  assert.equal(s.mines.length, 0);
  assert.equal(tank.hp, 390);
  assert(tank.slowedUntil > s.time);
  const hp = tank.hp;
  advance(s, 0.2);
  assert.equal(tank.hp, hp);
});
check('制导防空追踪高速通场飞机并造成实际伤害', () => {
  const s = arena();
  spawnUnit(s, 0, 'sam_vehicle', 900);
  const sam = s.units[0];
  sam.cooldown = 0;
  spawnUnit(s, 1, 'strike_jet', 1750);
  s.players[1].morale = 8;
  const jet = s.units[1];
  jet.cooldown = 100;
  jet.hp = jet.maxHp = 1000;
  tick(s, 1 / 60);
  const missile = s.projectiles.find((p) => p.sourceUid === sam.uid);
  assert(missile?.guided);
  const tx = missile.tx;
  advance(s, 0.4);
  assert(missile.tx < tx - 150);
  advance(s, 1);
  assert(jet.hp < 1000);
});
const tokenList = (s, side) => [
  ...s.players[side].hand,
  ...s.players[side].deck,
  ...s.players[side].discard,
  ...s.units
    .filter((u) => u.side === side && u.sortieCard)
    .map((u) => u.sortieCard),
];
check('两张同名飞机分别返航优惠与整备，整副牌UID守恒', () => {
  const deck = [...DECK];
  deck[0] = 'strike_jet';
  const s = createGame(9, deck);
  startGame(s);
  s.aiIn = 1e6;
  const p = s.players[0],
    original = tokenList(s, 0)
      .map((h) => h.uid)
      .sort((a, b) => a - b),
    planes = tokenList(s, 0).filter((h) => h.id === 'strike_jet');
  assert.equal(planes.length, 2);
  p.hand = p.hand.filter((h) => !planes.includes(h));
  p.deck = p.deck.filter((h) => !planes.includes(h));
  p.discard = p.discard.filter((h) => !planes.includes(h));
  p.discard.push(...p.hand);
  p.hand = [...planes];
  for (const h of planes) {
    p.energy = 10;
    assert(playCard(s, 0, h.uid, 300).ok);
  }
  const airborne = s.units.filter((u) => u.sortieCard);
  airborne[0].x = W + 159;
  tick(s, 1 / 60);
  assert.equal(p.hand[0].uid, planes[0].uid);
  assert.equal(cardCost(p.hand[0]), 2);
  assert(cardReadyIn(s, p.hand[0]) > 0);
  assert(!planes[1].returnedOnce);
  const before = p.energy;
  assert(!playCard(s, 0, planes[0].uid, 300).ok);
  assert.equal(p.energy, before);
  assert.deepEqual(
    tokenList(s, 0)
      .map((h) => h.uid)
      .sort((a, b) => a - b),
    original,
  );
  assert.equal(new Set(tokenList(s, 0).map((h) => h.uid)).size, 20);
  const ready = cardReadyIn(s, planes[0]);
  s.status = 'paused';
  advance(s, 3);
  assert.equal(cardReadyIn(s, planes[0]), ready);
  s.status = 'playing';
  airborne[1].x = W + 159;
  tick(s, 1 / 60);
  advance(s, 25);
  p.energy = 2;
  assert(playCard(s, 0, planes[0].uid, 300).ok);
  assert.equal(p.energy, 0);
});
check('满手返航转弃牌保留优惠，优惠飞机被击落恢复全价且只结算一次', () => {
  const s = arena(),
    p = s.players[0];
  p.hand = [];
  p.energy = 10;
  const h = hand(s, 'strike_jet');
  assert(playCard(s, 0, h.uid, 300).ok);
  const jet = s.units[0];
  draw(s, 0, 6);
  jet.x = W + 159;
  tick(s, 1 / 60);
  assert.equal(p.hand.length, 6);
  assert(p.discard.includes(h));
  assert(h.returnedOnce);
  p.discard = p.discard.filter((v) => v !== h);
  p.hand = [h];
  h.readyAt = 0;
  p.energy = 10;
  assert(playCard(s, 0, h.uid, 300).ok);
  const returned = s.units.find((u) => u.sortieCard === h);
  explode(s, returned.x, returned.y - 20, 50, 1000, 1);
  assert(p.discard.includes(h));
  assert.equal(cardCost(h), CARDS.strike_jet.cost);
  assert(!h.returnedOnce);
  explode(s, returned.x, returned.y - 20, 50, 1000, 1);
  assert.equal(p.discard.filter((v) => v === h).length, 1);
});
check('飞机坠落后只爆炸一次，落地残骸才提供真实掩体', () => {
  const s = arena();
  spawnUnit(s, 1, 'helicopter', 1000);
  explode(s, 1000, CARDS.helicopter.altitude ?? 232, 80, 1000, 0);
  const w = s.wrecks[0];
  assert(w.falling);
  assert.equal(obstacleBoxes(s).filter((b) => b.wreck).length, 0);
  const count = s.explosions;
  advance(s, 2);
  assert(!w.falling);
  assert.equal(s.explosions, count + 1);
  assert(obstacleBoxes(s).some((b) => b.wreck === w));
  advance(s, 30);
  assert.equal(s.explosions, count + 1);
  assert(s.wrecks.includes(w));
});
check('房屋分部受损，倒树与废墙永久形成低掩体并拦截弹道', () => {
  const s = createGame();
  startGame(s);
  s.aiIn = 1e6;
  const house = s.scenery.find((p) => p.kind === 'house'),
    tree = s.scenery.find((p) => p.kind === 'tree');
  const wall = house.parts[0];
  damageScenery(s, wall.x + 4, wall.y + 20, 2, 1000);
  assert.equal(wall.hp, 0);
  assert(house.parts.some((p) => p.kind === 'wall' && p.hp > 0));
  assert(obstacleBoxes(s).some((b) => b.part === wall && b.rubble));
  damageScenery(s, tree.x, tree.y - 45, 12, 1000);
  assert(tree.parts.every((p) => p.hp === 0));
  const fallen = obstacleBoxes(s).find((b) => b.prop === tree && b.rubble);
  assert(fallen);
  assert(
    sceneryIntercept(s, tree.x - 40, tree.y - 10, tree.x + 120, tree.y - 10),
  );
  assert(craterCover(s, tree.x - 25, tree.x + 200) > 0.2);
});
check('树冠缩短观察距离，中距离仍可发现敌人并交火', () => {
  const s = arena();
  spawnUnit(s, 0, 'tank', 1000);
  spawnUnit(s, 1, 'infantry', 1350);
  const tank = s.units[0];
  tank.cooldown = tank.secondaryCooldown = 0;
  s.scenery = [
    {
      id: 99,
      kind: 'tree',
      x: 1170,
      y: 374,
      seed: 1,
      parts: [
        {
          id: 0,
          kind: 'crown',
          x: 1160,
          y: 240,
          w: 40,
          h: 130,
          hp: 100,
          maxHp: 100,
          brokenAt: -1,
        },
      ],
    },
  ];
  refreshVision(s);
  assert(snapshot(s).units.some((u) => u.side === 1));
  assert.equal(snapshot(s).players[1].hand.length, 0);
  assert.equal(snapshot(s, 1).players[0].hand.length, 0);
  tick(s, 1 / 60);
  assert(tank.shots > 0);
  assert(tank.secondaryShots > 0);
  assert.equal(sceneryIntercept(s, 1080, 320, 1350, 347), null);
  s.scenery = [];
  refreshVision(s);
  tick(s, 1 / 60);
  assert(tank.shots > 0);
  assert(tank.secondaryShots > 0);
});
check('观察员提供炮兵共享目标，撤离后不再向未知目标开火', () => {
  const s = arena();
  spawnUnit(s, 0, 'artillery', 500);
  spawnUnit(s, 1, 'tank', 1500);
  const [gun, target] = s.units;
  target.pace = 0;
  target.cooldown = target.secondaryCooldown = 100;
  gun.cooldown = 0;
  tick(s, 1 / 60);
  assert.equal(gun.shots, 0);
  spawnUnit(s, 0, 'scout_drone', 1350);
  refreshVision(s);
  tick(s, 1 / 60);
  assert.equal(gun.shots, 1);
  s.units = s.units.filter((u) => u.id !== 'scout_drone');
  refreshVision(s);
  gun.cooldown = 0;
  tick(s, 1 / 60);
  assert.equal(gun.shots, 1);
});
check('蹲伏士兵主动寻找残骸，低掩体可探身射击并吸收爆炸冲击', () => {
  const s = arena();
  s.wrecks.push({
    id: 1,
    cardId: 'tank',
    side: 0,
    x: 1000,
    y: 374,
    angle: 0,
    age: 10,
    falling: false,
    vx: 0,
    vy: 0,
  });
  spawnUnit(s, 0, 'infantry', 880);
  const u = s.units[0];
  s.units = [u];
  u.tactic = 'cover';
  u.decisionIn = 100;
  u.hp = u.maxHp = 1000;
  spawnUnit(s, 1, 'infantry', 1300);
  const target = s.units[1];
  s.units = [u, target];
  target.cooldown = 100;
  target.pace = 0;
  u.x = 910;
  refreshVision(s);
  advance(s, 2);
  assert(u.cover > 0.2);
  assert(u.x < 938);
  assert(u.shots > 0);
  const blocked = arena();
  blocked.wrecks = [{ ...s.wrecks[0], x: 1000 }];
  spawnUnit(blocked, 0, 'infantry', 930);
  const soldier = blocked.units[0];
  blocked.units = [soldier];
  soldier.hp = soldier.maxHp = 1000;
  const open = arena();
  spawnUnit(open, 0, 'infantry', 930);
  const naked = open.units[0];
  open.units = [naked];
  naked.hp = naked.maxHp = 1000;
  explode(blocked, 1070, 354, 180, 100, 1);
  explode(open, 1070, 354, 180, 100, 1);
  assert(soldier.hp > naked.hp);
});
check('顽强部队不会投降，补给班部署仅抽一张且不突破手牌上限', () => {
  const s = arena();
  spawnUnit(s, 0, 'steadfast', 1000);
  const u = s.units[0];
  s.units = [u];
  u.hp = 1;
  u.personalMorale = 1;
  u.cooldown = 100;
  spawnUnit(s, 1, 'infantry', 1200);
  s.units.slice(1).forEach((v) => (v.cooldown = 100));
  tick(s, 1 / 60);
  assert(!u.surrendered);
  const t = arena(),
    p = t.players[0];
  p.hand = [];
  p.energy = 10;
  const h = hand(t, 'supply_team'),
    n = p.deck.length;
  assert(playCard(t, 0, h.uid, 300).ok);
  assert.equal(p.hand.length, 1);
  assert.equal(p.deck.length, n - 1);
  assert.equal(t.units.length, 3);
});

check('未观察到的墙体破坏保持旧记忆，再次观察时才更新', () => {
  const s = createGame();
  startGame(s);
  s.aiIn = 1e6;
  s.scenery = [];
  const w = s.walls.at(-1);
  spawnUnit(s, 1, 'tank', w.x);
  tick(s, 1 / 60);
  assert.equal(w.hp, 0);
  assert.equal(snapshot(s).units.length, 0);
  assert.equal(snapshot(s).walls.find((v) => v.uid === w.uid).hp, 140);
  spawnUnit(s, 0, 'scout_drone', w.x - 80);
  refreshVision(s);
  assert.equal(snapshot(s).walls.find((v) => v.uid === w.uid).hp, 0);
});
const coverProp = (id, x, kind = 'house', split = false) => ({
  id,
  kind,
  x,
  y: 374,
  seed: 1,
  parts: Array.from({ length: split ? 3 : 1 }, (_, i) => ({
    id: i,
    kind: kind === 'tree' ? 'crown' : 'wall',
    x: x + i * 20,
    y: 240,
    w: split ? 20 : 60,
    h: 134,
    hp: 10000,
    maxHp: 10000,
    brokenAt: -1,
  })),
});
check('房树只扣观察距离，同物体不叠算，密集遮挡最多扣四分之一', () => {
  const s = arena();
  spawnUnit(s, 0, 'tank', 1000);
  s.scenery = [coverProp(1, 1200, 'house', true)];
  assert.equal(observationPenalty(s, 1000, 320, 1560, 346, 570), 60);
  assert(pointVisible(s, 0, 1350, 346));
  assert(!pointVisible(s, 0, 1530, 346));
  s.scenery = [];
  assert(pointVisible(s, 0, 1530, 346));
  s.scenery = [coverProp(1, 1200, 'tree')];
  assert.equal(observationPenalty(s, 1000, 320, 1560, 346, 570), 25);
  assert(!pointVisible(s, 0, 1550, 346));
  s.scenery = Array.from({ length: 10 }, (_, i) => coverProp(i, 1050 + i * 20));
  assert.equal(observationPenalty(s, 1000, 320, 1560, 346, 570), 570 * 0.25);
  assert(pointVisible(s, 0, 1350, 346));
  s.units[0].wounded = true;
  assert(!pointVisible(s, 0, 1350, 346));
  spawnUnit(s, 1, 'tank', 2500);
  refreshVision(s);
  assert(!snapshot(s).units.some((u) => u.side === 1));
});
check('树房普通子弹约半数通过，每栋房屋多部件和多帧只判一次', () => {
  const s = arena();
  s.scenery = [coverProp(7, 1200, 'house', true)];
  const initialSeed = s.seed;
  const results = [];
  let survivor;
  for (let i = 0; i < 1000; i++) {
    const p = { ammunition: 'rifle' };
    const hit = projectileIntercept(s, p, 1100, 320, 1300, 320);
    results.push(!!hit);
    if (!hit) survivor = p;
  }
  const intercepted = results.filter(Boolean).length;
  assert(intercepted > 450 && intercepted < 550, `intercepted ${intercepted}`);
  assert.deepEqual(survivor.passedCover, [7]);
  const after = s.seed;
  for (let x = 1200; x < 1260; x += 2)
    assert.equal(projectileIntercept(s, survivor, x, 320, x + 2, 320), null);
  assert.equal(s.seed, after, '同一栋房屋不得每帧重新掷骰');
  s.scenery = [coverProp(7, 1200)];
  s.seed = initialSeed;
  s.fxSeed += 999;
  const joined = Array.from(
    { length: 1000 },
    () =>
      !!projectileIntercept(s, { ammunition: 'rifle' }, 1100, 320, 1300, 320),
  );
  assert.deepEqual(joined, results, '拆分房屋和特效随机数均不得改变拦截结果');
  s.scenery = [coverProp(7, 1200, 'tree')];
  s.seed = initialSeed;
  const foliage = Array.from(
    { length: 1000 },
    () =>
      !!projectileIntercept(
        s,
        { ammunition: 'machinegun' },
        1100,
        320,
        1300,
        320,
      ),
  );
  assert.deepEqual(foliage, results, '树冠与机枪同样有一半概率掩护');
});
check('穿过第一个掩体仍检查第二个，炮弹与地表保持实体碰撞', () => {
  const s = arena();
  s.scenery = [coverProp(1, 1160), coverProp(2, 1260)];
  let stoppedAtSecond = false;
  for (let i = 0; i < 100; i++) {
    const p = { ammunition: 'autocannon' };
    const hit = projectileIntercept(s, p, 1100, 320, 1360, 320);
    if (hit?.x >= 1260 && p.passedCover?.length === 2) stoppedAtSecond = true;
  }
  assert(stoppedAtSecond);
  const seed = s.seed;
  for (const ammunition of ['ap', 'cannon', 'rocket', 'grenade', 'mortar'])
    assert(projectileIntercept(s, { ammunition }, 1100, 320, 1360, 320));
  assert.equal(s.seed, seed, '重弹的硬碰撞不得消费掩体概率');
  const p = { ammunition: 'rifle', passedCover: [1, 2] };
  assert(projectileIntercept(s, p, 1100, 320, 1360, 390));
});
check('房屋后中距离步兵会开火，坦克同轴也不会被许可检查卡住', () => {
  for (const id of ['infantry', 'tank']) {
    const s = arena();
    spawnUnit(s, 0, id, 1000);
    const u = s.units[0];
    s.units = [u];
    spawnUnit(s, 1, 'infantry', 1350);
    const enemy = s.units[1];
    s.units = [u, enemy];
    s.scenery = [coverProp(7, 1200)];
    u.cooldown = u.secondaryCooldown = 0;
    u.decisionIn = 100;
    u.tactic = 'crouch';
    u.pose = 'idle';
    enemy.pace = 0;
    enemy.cooldown = 100;
    s.players[0].order = 'hold';
    refreshVision(s);
    tick(s, 1 / 60);
    assert(id === 'tank' ? u.secondaryShots > 0 : u.shots > 0, id);
  }
});
check('手榴弹保持杀伤但挖土更浅，烟尘在1.25秒内散去', () => {
  const states = ['grenade', 'he'].map((kind) => {
    const s = arena();
    spawnUnit(s, 1, 'infantry', 1300);
    for (const u of s.units) {
      u.hp = u.maxHp = 1000;
      u.cooldown = 100;
    }
    explode(s, 1280, 366, 48, 16, 0, 1, 1, kind);
    return s;
  });
  assert.deepEqual(
    states[0].units.map((u) => u.hp),
    states[1].units.map((u) => u.hp),
  );
  assert(states[0].units[0].hp < 1000);
  assert(
    ground(states[0], 1280) < ground(states[1], 1280),
    '手榴弹挖土应少于同半径高爆弹',
  );
  states[0].status = 'paused';
  advance(states[0], 1.4);
  assert.equal(states[0].blasts[0].age, 0);
  states[0].status = 'playing';
  for (const s of states) advance(s, 1.4);
  assert.equal(states[0].blasts.length, 0);
  assert(states[1].blasts.some((b) => b.kind === 'he'));
  const s = arena();
  spawnUnit(s, 0, 'grenadiers', 1000);
  const u = s.units[0];
  s.units = [u];
  spawnUnit(s, 1, 'infantry', 1320);
  u.cooldown = 0;
  u.decisionIn = 100;
  u.tactic = 'crouch';
  s.players[0].order = 'hold';
  refreshVision(s);
  tick(s, 1 / 60);
  const round = s.projectiles.find((p) => p.sourceUid === u.uid);
  assert.equal(round?.effect, 'grenade');
  assert.equal(round?.radius, CARDS.grenadiers.radius);
});
const v12Arena = () => {
  const s = createGame(37);
  startGame(s);
  s.units = [];
  s.scenery = [];
  s.walls = [];
  s.terrain.fill(374);
  s.original.fill(374);
  s.aiIn = 1e6;
  s.players.forEach((p) => {
    p.order = 'hold';
  });
  return s;
};
const v12AIHand = (s, ids, energy) => {
  const p = s.players[1];
  p.hand = ids.map((id) => ({ id, uid: ++s.uid }));
  p.energy = energy;
  p.drawIn = 0;
};
check('AI 为已知装甲保留标枪费用，买牌之前不会把费用花在抽牌上', () => {
  const s = v12Arena();
  spawnUnit(s, 1, 'infantry', 2300);
  spawnUnit(s, 0, 'tank', 2000);
  refreshVision(s);
  v12AIHand(s, ['javelin', 'infantry'], 3);
  const hand = s.players[1].hand.map((h) => h.uid);
  s.aiIn = 0;
  tick(s, 0.01);
  assert.deepEqual(
    s.players[1].hand.map((h) => h.uid),
    hand,
  );
  assert(s.players[1].energy >= 3 && s.players[1].energy < 3.01);
  s.players[1].energy = 4;
  s.aiIn = 0;
  tick(s, 0.01);
  assert(s.units.some((u) => u.side === 1 && u.id === 'javelin'));
});
check('无可见空情时 AI 不优先部署只能防空的单位', () => {
  const s = v12Arena();
  v12AIHand(s, ['manpads', 'infantry'], 4);
  s.aiIn = 0;
  tick(s, 0.01);
  assert(s.units.some((u) => u.side === 1 && u.id === 'infantry'));
  assert(!s.units.some((u) => u.side === 1 && u.id === 'manpads'));
});
check('AI 反坦克地雷提前放在合法位置并实际消耗卡牌', () => {
  const s = v12Arena();
  spawnUnit(s, 1, 'infantry', 2300);
  spawnUnit(s, 0, 'tank', 2000);
  refreshVision(s);
  v12AIHand(s, ['antitank_mine'], 2);
  s.aiIn = 0;
  tick(s, 0.01);
  assert.equal(s.mines.length, 1);
  assert(Math.abs(s.mines[0].x - 2000) >= 80);
  assert.equal(s.players[1].hand.length, 0);
});
check('只改变视野外敌军兵种不会改变 AI 选牌、资源和命令', () => {
  const s = v12Arena();
  spawnUnit(s, 1, 'infantry', 2300);
  spawnUnit(s, 0, 'tank', 2000);
  spawnUnit(s, 0, 'infantry', 200);
  refreshVision(s);
  v12AIHand(s, ['javelin', 'infantry', 'manpads'], 4);
  const twin = structuredClone(s);
  for (const u of twin.units.filter((u) => u.side === 0 && u.x < 500)) {
    assert(!s.visible[1].includes(u.uid));
    u.id = 'helicopter';
    u.y = 232;
  }
  s.aiIn = twin.aiIn = 0;
  tick(s, 0.01);
  tick(twin, 0.01);
  assert.deepEqual(s.players[1], twin.players[1]);
});
check('AI 满手无收益技能能腾出卡位并重新部署', () => {
  const s = v12Arena();
  v12AIHand(
    s,
    ['repair', 'morale', 'smoke', 'recon', 'precision', 'artillery'],
    10,
  );
  s.players[1].deck = ['infantry', 'marines'].map((id) => ({
    id,
    uid: ++s.uid,
  }));
  s.players[1].discard = [];
  s.aiIn = 0;
  advance(s, 12);
  assert(s.units.some((u) => u.side === 1 && CARDS[u.id].members));
  assert(s.players[1].played > 0);
});
check('AI 满手情境型单位且暂无目标时也能腾格抽步兵', () => {
  const s = v12Arena();
  v12AIHand(
    s,
    ['anti_tank_gun', 'aa_gun', 'artillery', 'precision', 'barrage', 'manpads'],
    10,
  );
  s.players[1].deck = ['infantry', 'marines'].map((id) => ({
    id,
    uid: ++s.uid,
  }));
  s.players[1].discard = [];
  s.aiIn = 0;
  advance(s, 12);
  assert(s.players[1].played > 0, '满手真实可部署单位不能永久卡住抽牌');
  assert(
    s.units.some(
      (u) => u.side === 1 && (u.id === 'infantry' || u.id === 'marines'),
    ),
  );
});
check('撤退士兵加入大部队时保留生命、武器成员编号和身份，两侧一致', () => {
  for (const side of [0, 1]) {
    const s = v12Arena();
    spawnUnit(s, side, 'machinegun', 1900);
    const u = s.units[0];
    s.units = [u];
    u.x = 2000;
    u.tactic = 'retreat';
    u.retreatUntil = 100;
    u.decisionIn = 100;
    u.personalMorale = 25;
    u.hp = 17;
    const before = {
      id: u.id,
      member: u.member,
      hp: u.hp,
      uid: u.uid,
      squad: u.squad,
    };
    spawnUnit(s, side, 'infantry', side === 0 ? 2095 : 1905);
    s.units.forEach((v) => {
      v.cooldown = 100;
      v.decisionIn = 100;
    });
    const host = s.units.at(-1).squad;
    advance(s, 1.3);
    assert.equal(u.squad, host);
    assert.notEqual(u.squad, before.squad);
    assert.equal(u.tactic, 'advance');
    assert.equal(u.originalSquad, before.squad);
    for (const key of ['id', 'member', 'hp', 'uid'])
      assert.equal(u[key], before[key]);
    assert.equal(s.units.length, 7);
    assert(u.personalMorale >= 52);
  }
});
check('伤员组成的大部队不能让撤退士兵归队', () => {
  const s = v12Arena();
  spawnUnit(s, 0, 'infantry', 2000);
  const u = s.units[0];
  u.tactic = 'retreat';
  u.personalMorale = 20;
  u.retreatUntil = 100;
  u.decisionIn = 100;
  for (const v of s.units.slice(1)) {
    v.wounded = true;
    v.bleedOut = 25;
    v.personalMorale = 90;
  }
  advance(s, 1.5);
  assert.equal(u.tactic, 'retreat');
  assert(!u.regroupedAt);
  assert.equal(u.regroupProgress, 0);
});
const v12Conflict = (wall) => {
  const s = v12Arena();
  spawnUnit(s, 0, 'rocket', 2000);
  s.units = s.units.slice(0, 2);
  const [u, friend] = s.units;
  u.tactic = 'retreat';
  u.retreatUntil = 100;
  u.personalMorale = 0;
  friend.personalMorale = 0;
  for (const v of s.units) {
    v.decisionIn = 100;
    v.cooldown = 100;
    v.injuryCooldown = 100;
  }
  if (wall)
    s.wrecks.push({
      id: ++s.uid,
      cardId: 'tank',
      side: 0,
      x: 1970,
      y: 374,
      angle: 0,
      age: 0,
      falling: false,
      vx: 0,
      vy: 0,
    });
  // The first LCG draw is 0.236..., below this encounter's capped 0.4 chance.
  s.seed = 0;
  tick(s, 0.001);
  return { s, u, friend };
};
check('反甲士兵的低士气冲突发射短距步枪弹，保留友军来源且不产生爆炸', () => {
  const { s, u, friend } = v12Conflict(false);
  assert.equal(s.projectiles.length, 1);
  const p = s.projectiles[0];
  assert.equal(p.sourceUid, u.uid);
  assert.equal(p.targetUid, friend.uid);
  assert.equal(p.side, u.side);
  assert.equal(p.damage, 3);
  assert.equal(p.ammunition, 'rifle');
  assert.equal(p.radius, 0);
  assert(!p.guided);
  assert(!p.shell);
  const hp = friend.hp,
    seed = s.seed;
  advance(s, 0.2);
  assert(friend.hp < hp && hp - friend.hp <= 3 + 1e-8);
  assert.equal(s.explosions, 0);
  assert.equal(s.players[0].kills, 0);
  assert.equal(s.players[1].kills, 0);
  // Holding contact across frames cannot resample the low-morale chance.
  advance(s, 0.35);
  assert.equal(s.seed, seed);
});
check('低士气冲突的友军弹丸仍被硬掩体阻挡', () => {
  const { s, friend } = v12Conflict(true),
    hp = friend.hp;
  advance(s, 0.2);
  assert.equal(friend.hp, hp);
  assert.equal(s.explosions, 0);
});
check('双方牵引火炮逐帧移动而非瞬移，架设后即使目标消失也固定', () => {
  for (const side of [0, 1]) {
    const s = v12Arena(),
      dir = side === 0 ? 1 : -1;
    const base = side === 0 ? 112 : W - 112;
    spawnUnit(s, side, 'infantry', side === 0 ? 1800 : W - 1800);
    spawnUnit(s, side, 'anti_tank_gun', base);
    const gun = s.units.at(-1);
    for (let i = 0; i < 20; i++) {
      const x = gun.x;
      tick(s, 0.05);
      assert((gun.x - x) * dir > 0);
      assert(Math.abs(gun.x - x) <= 28 * 0.05 + 1e-8);
      assert.equal(gun.fire, 0);
    }
    spawnUnit(s, side === 0 ? 1 : 0, 'infantry', gun.x + dir * 420);
    s.units.forEach((u) => {
      u.cooldown = 100;
      u.decisionIn = 100;
    });
    refreshVision(s);
    tick(s, 0.05);
    assert.equal(gun.emplaced, true);
    const x = gun.x;
    s.units = s.units.filter((u) => u.side === side);
    advance(s, 0.5);
    assert.equal(gun.x, x);
  }
});

check('镜头或松手位置不能把任何一方的部队传送到前线', () => {
  for (const side of [0, 1])
    for (const position of [300, 2000, 3300]) {
      const s = v12Arena(),
        p = s.players[side];
      p.hand = [{ uid: ++s.uid, id: 'infantry' }];
      p.energy = 10;
      assert(playCard(s, side, p.hand[0].uid, position).ok);
      assert.deepEqual(
        s.units.map((u) => u.x),
        formationPositions(side, 'infantry', side ? W - 112 : 112),
      );
    }
});
check('曲射炮弹越过炮口附近房屋，上升不受阻、下降仍会撞击', () => {
  const s = v12Arena();
  s.scenery = [
    {
      id: 400,
      kind: 'house',
      x: 610,
      y: 374,
      seed: 1,
      parts: [
        {
          id: 0,
          kind: 'wall',
          x: 600,
          y: 250,
          w: 30,
          h: 124,
          hp: 100,
          maxHp: 100,
          brokenAt: -1,
        },
      ],
    },
  ];
  const p = {
    shell: true,
    ammunition: 'mortar',
    startX: 550,
    startY: 340,
    tx: 1200,
    ty: 374,
    total: 2,
    life: 1.8,
    arc: 170,
    radius: 36,
  };
  assert.equal(projectileIntercept(s, p, 590, 300, 625, 270), null);
  p.life = 0.3;
  assert(projectileIntercept(s, p, 590, 270, 625, 300));
  p.life = 1.8;
  assert(
    projectileIntercept(s, p, 590, 370, 625, 380),
    '上升豁免不能穿过实际地面',
  );
});
check('地爆始终贴合变化后的地面，空爆使用独立类型且不挖土', () => {
  const s = v12Arena();
  explode(s, 1000, 180, 36, 0, 0);
  assert.equal(s.blasts[0].kind, 'air');
  assert.equal(s.blasts[0].soil, false);
  assert.equal(ground(s, 1000), 374);
  explode(s, 1200, 354, 36, 0, 0);
  tick(s, 0.02);
  assert.equal(s.blasts[1].soil, true);
  assert.equal(s.blasts[1].y, ground(s, 1200));
  explode(s, 1200, ground(s, 1200) - 8, 36, 0, 0);
  tick(s, 0.02);
  assert(s.blasts.filter((b) => b.soil).every((b) => b.y === ground(s, b.x)));
});
check('坠机先在空中受击，再发生小型接地燃爆并永久留下残骸', () => {
  const s = v12Arena();
  spawnUnit(s, 0, 'helicopter', 1000);
  const u = s.units[0];
  explode(s, u.x, u.y - 20, 45, 10000, 1);
  assert(s.blasts.some((b) => b.kind === 'air'));
  advance(s, 1.6);
  const crash = s.blasts.find((b) => b.kind === 'crash');
  assert(crash);
  assert(crash.radius <= 30);
  assert.equal(crash.y, ground(s, crash.x));
  assert(s.wrecks.some((w) => w.id === u.uid && !w.falling));
  advance(s, 8);
  assert(s.wrecks.some((w) => w.id === u.uid));
});
check('标枪越过近处遮挡升空，随后俯冲命中可见坦克', () => {
  const s = v12Arena();
  spawnUnit(s, 0, 'javelin', 800);
  s.units = s.units.slice(0, 1);
  spawnUnit(s, 1, 'tank', 1240);
  const [a, b] = s.units;
  for (const u of s.units) {
    u.pace = 0;
    u.decisionIn = 100;
    u.cooldown = u.secondaryCooldown = 100;
  }
  a.cooldown = 0;
  s.players[0].recon = 10;
  s.scenery = [
    {
      id: 400,
      kind: 'house',
      x: 870,
      y: 374,
      seed: 1,
      parts: [
        {
          id: 0,
          kind: 'wall',
          x: 840,
          y: 240,
          w: 40,
          h: 134,
          hp: 100,
          maxHp: 100,
          brokenAt: -1,
        },
      ],
    },
  ];
  refreshVision(s);
  assert(s.visible[0].includes(b.uid));
  tick(s, 0.01);
  const missile = s.projectiles.find((p) => p.sourceUid === a.uid);
  assert(missile?.guided && missile.topAttack);
  const startY = missile.y;
  advance(s, 0.25);
  assert(missile.y < startY - 90);
  assert(b.hp === b.maxHp);
  advance(s, 1.2);
  assert(b.hp < b.maxHp - 100);
  const descending = { ...missile, life: 2, topAttack: true };
  assert(projectileIntercept(s, descending, 830, 250, 885, 330));
});
check('未命中的可视弹尾不伤害或压制途中的友方士兵', () => {
  const s = v12Arena();
  spawnUnit(s, 0, 'infantry', 1000);
  s.units = s.units.slice(0, 1);
  const u = s.units[0];
  u.decisionIn = 100;
  u.tactic = 'retreat';
  u.retreatUntil = 100;
  u.pace = 0;
  u.personalMorale = 50;
  u.suppression = 0;
  s.projectiles.push({
    sourceUid: 999,
    side: 0,
    targetUid: null,
    base: null,
    x: 950,
    y: 344,
    startX: 950,
    startY: 344,
    tx: 1050,
    ty: 344,
    life: 0.1,
    total: 0.1,
    damage: 0,
    radius: 0,
    ammunition: 'rifle',
    tracer: true,
    missed: true,
  });
  const hp = u.hp;
  advance(s, 0.15);
  assert.equal(u.hp, hp);
  assert.equal(u.suppression, 0);
});
check('AI 缺反甲时付费搜牌，抽牌冷却期间保留费用', () => {
  const s = v12Arena();
  spawnUnit(s, 1, 'infantry', 2300);
  spawnUnit(s, 0, 'tank', 2000);
  refreshVision(s);
  v12AIHand(s, ['helicopter', 'infantry'], 6);
  s.players[1].deck = [{ id: 'javelin', uid: ++s.uid }];
  s.players[1].discard = [];
  s.aiIn = 0;
  tick(s, 0.01);
  assert(s.players[1].hand.some((h) => h.id === 'javelin'));
  assert(s.players[1].energy >= 4 && s.players[1].energy < 4.01);
  assert(!s.units.some((u) => u.side === 1 && u.id === 'helicopter'));
  v12AIHand(s, ['helicopter', 'infantry'], 3);
  s.players[1].deck = [{ id: 'javelin', uid: ++s.uid }];
  s.players[1].drawIn = 5;
  s.aiIn = 0;
  tick(s, 0.01);
  assert(s.players[1].energy >= 3 && s.players[1].energy < 3.01);
  assert.equal(s.players[1].hand.length, 2);
});
console.log(`${count} gameplay checks passed`);
if (failures.length)
  throw new Error(`${failures.length} failures: ${failures.join('; ')}`);
