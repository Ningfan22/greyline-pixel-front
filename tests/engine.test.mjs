import { terrainDepthLimit } from '../game/squad-orders.ts';
import { comebackBlock } from '../game/comeback.ts';
import { AI_DECKS, DECK_PRESETS } from '../game/deck-presets.ts';
import { CARD_COPY } from '../game/card-copy.ts';
import { tankGeometry } from '../game/vehicle-geometry.ts';
import { wreckGeometry, wreckContact } from '../game/wreck-geometry.ts';
import {
  adultIdentity,
  adultFrameChoice,
  adultWreckChoice,
} from '../game/adult-animation.ts';
import { projectileForRender, infantryDepth } from '../game/render-depth.ts';
import {
  damageScenery,
  obstacleBoxes,
  sceneryIntercept,
  observationPenalty,
  pointVisible,
} from '../game/world.ts';
import {
  buildingStage,
  buildingType,
  buildingHull,
  HOUSE_PROFILES,
} from '../game/world.ts';
import { buildingAnimation } from '../game/building-art.ts';
import { ammunition, FLIGHT, isTracer } from '../game/ballistics.ts';
import { weaponCard, weaponModel, copyLimit } from '../game/cards.ts';
import assert from 'node:assert/strict';
import { economyBlock } from '../game/economy.ts';
import { GREYLINE_LAYOUT_SEED } from '../game/maps.ts';
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
  isCombatant,
  energyLimit,
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
  const s = createGame(37, undefined, undefined, undefined, {
    mapSeed: GREYLINE_LAYOUT_SEED,
  });
  startGame(s);
  // These staged physics scenarios retain their original test budget.
  s.players.forEach((p) => {
    p.energy = 6;
  });
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
  if (
    process.env.TEST_FILTER &&
    !new RegExp(process.env.TEST_FILTER).test(name)
  )
    return;
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
check('弃牌不会在牌库抽空后自动洗入', () => {
  const s = fresh(),
    p = s.players[0];
  p.hand = [];
  p.deck = [];
  p.discard = ['tank', 'jam'].map((id) => ({ id, uid: ++s.uid }));
  assert.equal(draw(s, 0, 2), 0);
  assert.equal(p.hand.length, 0);
  assert.equal(p.discard.length, 2);
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
check('机枪对空明显强于普通步兵的低效射击', () => {
  const s = fresh();
  s.units = [];
  spawnUnit(s, 0, 'infantry', 500);
  spawnUnit(s, 1, 'helicopter', 590);
  const helicopter = s.units.at(-1);
  advance(s, 1);
  const rifleDamage = helicopter.maxHp - helicopter.hp;
  assert(rifleDamage > 0 && rifleDamage < helicopter.maxHp * 0.02);
  const beforeAA = helicopter.hp;
  spawnUnit(s, 0, 'machinegun', 540);
  advance(s, 1);
  assert(
    beforeAA - helicopter.hp > rifleDamage * 8,
    'actual machinegun anti-air hits must overwhelmingly exceed sporadic rifle hits',
  );
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
  // Let the 1.2s planted-foot posture transition finish before comparing gait.
  for (const s of [walk, run, hold, crouch, prone]) advance(s, 3);
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
  // v99: maps no longer ship with walls; stage one explicitly so the
  // vault mechanic stays covered.
  s.walls = [{ uid: 1, x: 510, width: 34, height: 32, hp: 140 }];
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
  s.walls = [{ uid: 1, x: 510, width: 34, height: 32, hp: 140 }];
  explode(s, 510, ground(s, 510) - 10, 80, 200, 0);
  assert.equal(s.walls[0].hp, 0);
  s.units = [];
  spawnUnit(s, 0, 'infantry', 477);
  for (let i = 0; i < 120; i++) {
    tick(s, 1 / 60);
    assert.equal(s.units[0].climbing, 0);
  }
});
check('炮击生成宽浅弹坑，伤害半径独立且连续命中保持限深', () => {
  const s = fresh();
  s.terrain.fill(374);
  s.original.fill(374);
  s.units = [];
  explode(s, 900, 366, 68, 55, 0);
  const changed = s.terrain.filter((y) => y > 374).length;
  assert(changed >= 80 && changed <= 88);
  assert(ground(s, 900) >= 383 && ground(s, 900) <= 384);
  assert(
    craterCover(s, 900, 1250) > 0.25,
    'wide shallow pits still shelter infantry',
  );
  for (let i = 0; i < 20; i++) explode(s, 900, ground(s, 900) - 8, 68, 55, 0);
  assert(ground(s, 900) <= 374 + MAX_CRATER_DEPTH);
});
check('双方各移动指令仍能跳入、落地并攀出真正陡峭的深沟', () => {
  for (const side of [0, 1])
    for (const order of ['advance', 'rush', 'crouch', 'prone']) {
      const s = fresh();
      s.units = [];
      s.walls = [];
      s.terrain.fill(374);
      s.original.fill(374);
      // A genuinely high bank, unlike the broad, shallow pits made by weapons.
      for (let x = 860; x <= 940; x++)
        s.terrain[x] = 374 + Math.min(44, (x - 860) * 2.2, (940 - x) * 2.2);
      setOrder(s, side, order);
      spawnUnit(s, side, 'infantry', side === 0 ? 836 : 964);
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
          `${side} ${order} missed ${state}: ${[...seen].join(', ')}`,
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
  assert.equal(patient.hp, hp + 3);
  assert.equal(tank.hp, tank.maxHp - 200);
  assert.equal(heli.hp, heli.maxHp - 100);
  s.players[0].energy = 10;
  const card = hand(s, 'repair');
  assert(playCard(s, 0, card.uid).ok);
  spawnUnit(s, 0, 'ifv', 700);
  const late = s.units.at(-1);
  late.hp -= 100;
  advance(s, 2);
  assert(tank.hp > tank.maxHp - 132 && tank.hp < tank.maxHp - 129);
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
check('卧姿狙击手有真实射线时保持卧姿开火，不为每枪起立', () => {
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
  assert.equal(u.pose, 'prone');
  assert.equal(u.muzzleY, muzzlePoint(u, s.units[1].x).y);
});
check('116种资源、合法20张自选卡组、双方两点随机起手且无免费单位', () => {
  assert.equal(Object.keys(CARDS).length, 116);
  assert(validDeck(DECK));
  const prefix = DECK.slice(0, 19);
  const extraCopy = prefix.find(
    (id) => prefix.filter((v) => v === id).length < copyLimit(id),
  );
  assert(extraCopy, 'the fixture has a card with a spare allowed copy');
  assert(validDeck([...prefix, extraCopy]));
  assert(
    !validDeck([...prefix, DECK[0]]),
    'the default front-line card already reaches its copy limit',
  );
  assert(!validDeck([...DECK.slice(0, 19), 'unknown']));
  assert(!validDeck(DECK.slice(1)));
  for (let seed = 0; seed < 20; seed++) {
    const ai = chooseAiDeck(seed);
    assert(validDeck(ai));
    const s = createGame(seed, DECK, ai);
    assert.equal(s.units.length, 0);
    s.players.forEach((p, i) => {
      assert.equal(p.energy, 2);
      assert.equal(energyLimit(p), 10);
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
  // Combat fixtures buy the same units they could before the slower opening.
  s.players.forEach((p) => {
    p.energy = 6;
  });
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
  own.forEach((u, i) => {
    // Already engaged members retain their roles; a rear member may now enter contact.
    if (before[i] !== 'advance') assert.equal(u.tactic, before[i]);
    else
      assert(
        ['advance', 'prone', 'cover', 'crouch', 'bound'].includes(u.tactic),
      );
  });
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
  assert.equal(u.hp, u.maxHp);
  assert.equal(u.personalMorale, 68);
  use('fortify');
  assert.equal(p.fortify, 10);
  assert.equal(u.personalMorale, 78);
  use('emp');
  assert.equal(s.players[1].jam, 14);
  assert.equal(s.players[1].recon, 0);
  v.x = 900;
  refreshVision(s);
  v.cooldown = 1;
  v.secondaryCooldown = 0.2;
  use('sabotage');
  assert.equal(v.cooldown, 3);
  assert.equal(v.secondaryCooldown, 3);
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
      // The work stance is now retained after breaching, rather than an
      // instantaneous sprint. Still require crossing by an explicit deadline.
      advance(s, 2);
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
check('出牌、补给和耗尽牌库均保持双方20张卡牌守恒', () => {
  const s = createGame(710),
    originals = s.players.map((p) => [...p.loadout].sort());
  startGame(s);
  s.aiIn = 1e6;
  for (let n = 0; n < 100; n++)
    for (const side of [0, 1]) {
      const p = s.players[side];
      p.energy = 10;
      const h = p.hand.find(
        (h) =>
          cardReadyIn(s, h) <= 0 &&
          !comebackBlock(s, side, CARDS[h.id].comeback) &&
          (!CARDS[h.id].economy || !economyBlock(p, CARDS[h.id].economy)),
      );
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
      const __now = [
          ...p.hand,
          ...p.deck,
          ...p.discard,
          ...s.units
            .filter((u) => u.side === side && u.sortieCard)
            .map((u) => u.sortieCard),
        ].map((h) => h.id).sort();
      const __orig = originals[side];
      assert.deepEqual(__now, __orig);
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
check('AI 记住敌军空中倾向：直升机脱离视野后仍保留防空记忆', () => {
  const s = arena(),
    p = s.players[1];
  // 一个无敌观察兵提供视野，一架敌方直升机进入视野 6 秒
  spawnUnit(s, 1, 'infantry', 3300);
  for (const u of s.units.filter((u) => u.side === 1)) {
    u.hp = u.maxHp = 10000;
    u.squadOrder = 'hold';
  }
  spawnUnit(s, 0, 'helicopter', 2900);
  const heli = s.units.find((u) => u.side === 0);
  p.hand = [];
  p.deck = [];
  p.discard = [];
  p.energy = 0;
  s.aiIn = 0;
  advance(s, 6);
  assert(s.aiEnemyProfile, 'memory initialized');
  assert(s.aiEnemyProfile.air > 0.7, `memAir ${s.aiEnemyProfile.air}`);
  // 直升机被击落后，15 秒目击窗口过期，但记忆保留
  heli.hp = 0;
  advance(s, 18);
  assert(s.aiAirSeenUntil < s.time, 'seen window expired');
  assert(s.aiEnemyProfile.air > 0.5, `memAir after gap ${s.aiEnemyProfile.air}`);
  // 长期无空中目标，记忆缓慢消退
  advance(s, 90);
  assert(s.aiEnemyProfile.air < 0.3, `memAir faded ${s.aiEnemyProfile.air}`);
});
check('AI 凭敌军记忆提前部署防空，未见敌机时不浪费防空组', () => {
  // 记忆组：目击直升机 6 秒、击落、18 秒空窗后，AI 仍应提前部署便携防空
  const s = arena(),
    p = s.players[1];
  spawnUnit(s, 1, 'infantry', 3300);
  for (const u of s.units.filter((u) => u.side === 1)) {
    u.hp = u.maxHp = 10000;
    u.squadOrder = 'hold';
  }
  spawnUnit(s, 0, 'helicopter', 2900);
  const heli = s.units.find((u) => u.side === 0);
  p.hand = [];
  p.deck = [];
  p.discard = [];
  p.energy = 0;
  s.aiIn = 0;
  advance(s, 6);
  heli.hp = 0;
  advance(s, 18);
  p.hand = [
    { id: 'manpads', uid: ++s.uid },
    { id: 'supply', uid: ++s.uid },
  ];
  p.deck = [];
  p.energy = 5;
  advance(s, 8);
  assert(
    s.units.some((u) => u.side === 1 && u.id === 'manpads'),
    'MANPADS deployed from memory',
  );
  // 对照组：从未出现过空中目标，AI 不应在无掩护时浪费专职防空组
  const c = arena(),
    q = c.players[1];
  q.hand = [
    { id: 'manpads', uid: ++c.uid },
    { id: 'supply', uid: ++c.uid },
  ];
  q.deck = [];
  q.energy = 5;
  c.aiIn = 0;
  advance(c, 8);
  assert(
    !c.units.some((u) => u.side === 1 && u.id === 'manpads'),
    'MANPADS withheld without air memory',
  );
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
    advance(s, 1.25);
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
  // Clear the entire enlarged hull before the fixed shell arrives.
  tank.pace = 3;
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
    // This case checks mixed weapons, not tripod setup (covered in v140).
    if (id === 'heavy_mg') Object.assign(squad[0], {
      pose: 'crouch', poseAnimSeen: 'crouch', tactic: 'crouch',
      stillFor: 3, moving: false, stanceLockUntil: 10,
    });
    setOrder(s, 0, 'hold');
    tick(s, 1 / 60);
    const shots = s.projectiles.filter((p) => p.side === 0);
    assert.equal(shots.length, squad.length);
    const machinegun = shots.filter((p) => !p.smallArmsAir);
    assert.equal(machinegun.length, 1);
    assert.equal(machinegun[0].sourceUid, squad[0].uid);
    const rifles = shots.filter((p) => p.smallArmsAir);
    assert.equal(rifles.length, squad.length - 1);
    assert(rifles.every((p) => p.ammunition === 'rifle' && p.damage <= 0.5));
    assert(machinegun[0].damage > Math.max(...rifles.map((p) => p.damage)) * 8);
    squad[0].hp = 0;
    squad[0].deadFor = 0;
    s.projectiles = [];
    advance(s, 1.05);
    const survivorsShots = s.projectiles.filter((p) => p.side === 0);
    assert(survivorsShots.length > 0);
    assert(survivorsShots.every((p) => p.smallArmsAir && p.damage <= 0.5));
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
    assert(
      s.units
        .filter((u) => u.evadeUntil > s.time)
        .every((u) => u.pose === 'prone' && !u.moving),
    );
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
  const coveredRoles = [
    ['antiarmor', 'javelin', 'tow_ifv', 'anti_tank_gun'],
    ['manpads', 'sam_vehicle', 'aa_gun'],
    ['scouts', 'scout_drone', 'rangers'],
    ['fpv_drone'],
    ['air_assault'],
    ['strike_jet'],
    ['interceptor'],
  ];
  for (const alternatives of coveredRoles)
    assert(
      alternatives.some((id) => choices.has(id)),
      `AI has ${alternatives.join('/')} support`,
    );
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
check('截击机前向对空射击，巡逻24秒后从己方返航并1费回用', () => {
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
  const patrol = arena();
  patrol.players[0].hand = [];
  patrol.players[0].energy = 10;
  const token = hand(patrol, 'interceptor');
  assert(playCard(patrol, 0, token.uid).ok);
  const aircraft = patrol.units[0];
  assert.equal(aircraft.flightUntil, 24);
  const directions = new Set();
  for (let frame = 0; frame < 23 * 60; frame++) {
    tick(patrol, 1 / 60);
    assert(patrol.units.includes(aircraft), 'patrol is not a single crossing');
    assert.equal(aircraft.y, CARDS.interceptor.altitude);
    directions.add(aircraft.facing);
  }
  assert.deepEqual(
    [...directions].sort((a, b) => a - b),
    [-1, 1],
    'patrol turns at both ends',
  );
  assert(!patrol.players[0].hand.includes(token));
  advance(patrol, 8);
  assert(!patrol.units.includes(aircraft));
  assert(aircraft.x < -160, 'returns through its own boundary');
  assert(patrol.players[0].hand.includes(token), 'returns the original card');
  assert.equal(cardCost(token), 1);
  assert(cardReadyIn(patrol, token) > 0 && cardReadyIn(patrol, token) <= 18);
  advance(patrol, cardReadyIn(patrol, token) + 0.01);
  patrol.players[0].energy = 1;
  assert(playCard(patrol, 0, token.uid).ok);
  assert.equal(patrol.players[0].energy, 0);
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
  const seeds = (process.env.MATCH_SEEDS ?? '13,71,102').split(',').map(Number);
  assert(seeds.length > 0 && seeds.every(Number.isSafeInteger));
  for (const seed of seeds) {
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
          (h) =>
            cardCost(h) <= p.energy &&
            cardReadyIn(s, h) <= 0 &&
            !comebackBlock(s, 0, CARDS[h.id].comeback),
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
      if (frame > 0 && frame % 7200 === 0)
        console.log(
          `  progress seed ${seed}: ${Math.round(s.time)}s, ${s.units.length} units, ${s.entrenchments?.length ?? 0} trenches`,
        );
    }
    assert.equal(s.status, 'finished');
    for (const p of s.players) {
      assert(p.energy >= 0 && p.energy <= energyLimit(p));
      assert(p.hp >= 0 && p.hp <= 1000);
      assert(p.hand.length <= 6);
    }
    assert(s.units.every((u) => Number.isFinite(u.x) && Number.isFinite(u.y)));
    assert(
      s.terrain.every(
        (y, x) =>
          y >= s.original[x] &&
          y <= s.original[x] + terrainDepthLimit(s, x, MAX_CRATER_DEPTH),
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
  assert.equal(CARDS.helicopter.damage, 7);
  assert.equal(CARDS.helicopter.burstSize, 6);
  assert.equal(CARDS.helicopter.burstPause, 0.6);
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
  deck[0] = deck[1] = 'strike_jet';
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
  assert(obstacleBoxes(s).some((b) => b.prop === house && b.rubble));
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
  advance(s, 1.25);
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
  // v99: maps no longer ship with walls; stage one explicitly so the
  // fog-of-war wall-memory mechanic stays covered.
  s.walls = [{ uid: 1, x: 510, width: 34, height: 32, hp: 140 }];
  s.knownWalls = [
    { 1: { uid: 1, x: 510, width: 34, height: 32, hp: 140 } },
    { 1: { uid: 1, x: 510, width: 34, height: 32, hp: 140 } },
  ];
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
check('三类房屋使用独立占地，部件损毁驱动局部与整体坍塌', () => {
  const s = createGame(37);
  startGame(s);
  const houses = s.scenery.filter((p) => p.kind === 'house');
  assert.deepEqual(houses.slice(0, 3).map(buildingType), [0, 1, 2]);
  for (const p of houses) {
    assert.equal(
      p.parts.find((part) => part.kind === 'roof').w,
      HOUSE_PROFILES[buildingType(p)].width,
    );
  }
  const house = houses[0],
    walls = house.parts.filter((p) => p.kind === 'wall');
  const strike = (part, damage) =>
    damageScenery(s, part.x + part.w / 2, part.y + part.h / 2, 1, damage);
  assert.equal(buildingStage(house), 0);
  s.time = 1;
  strike(walls[0], 70);
  assert.equal(buildingStage(house), 1);
  assert.equal(house.damageAt, 1);
  assert.equal(house.fromStage, 0);
  assert.equal(
    buildingAnimation(house, 1.1),
    null,
    'partial damage retains its authored facade without flashing intact',
  );
  s.time = 1.1;
  strike(walls[0], 1);
  assert.equal(
    house.damageAt,
    1,
    'same-stage chip damage must not restart animation',
  );
  s.time = 2;
  strike(walls[0], 100);
  assert.equal(buildingStage(house), 2);
  const hull = buildingHull(house, (x) => ground(s, x));
  assert(hull.some((box) => !box.rubble && box.x < house.x));
  assert(
    !hull.some((box) => !box.rubble && box.x > house.x),
    'collapsed opening must not have an invisible wall',
  );
  assert.equal(
    buildingAnimation(house, 2.3),
    null,
    'partial collapse never borrows an intact early animation frame',
  );
  assert.equal(
    buildingAnimation(house, 2.8),
    null,
    'partial collapse stops at the painted structural state',
  );
  const before = house.parts.reduce((n, p) => n + p.hp, 0);
  damageScenery(s, house.x + 65, house.y - 90, 1, 100);
  assert.equal(
    house.parts.reduce((n, p) => n + p.hp, 0),
    before,
    'empty collapsed side does not absorb hits',
  );
  const surviving = hull.find((box) => !box.rubble);
  s.time = 3;
  damageScenery(
    s,
    surviving.x + surviving.w / 2,
    surviving.y + surviving.h / 2,
    1,
    1000,
  );
  assert.equal(buildingStage(house), 3);
  assert(house.parts.every((p) => p.hp === 0));
  assert.equal(house.fromStage, 2);
  assert.equal(
    buildingAnimation(house, 3),
    4,
    'destroyed floors never reappear at start of final collapse',
  );
  assert.equal(buildingAnimation(house, 10), null);
  assert(
    obstacleBoxes(s).some((p) => p.rubble && Math.abs(p.x - house.x) < 100),
  );
  const event = house.damageAt;
  s.time = 30;
  strike(walls[0], 500);
  assert.equal(
    house.damageAt,
    event,
    'settled ruins do not repeatedly collapse',
  );
});

const v13MovementSolo = (s, side, id, x, lane = 0) => {
  const index = s.units.length;
  spawnUnit(s, side, id, x);
  const u = s.units[index];
  s.units.splice(index + 1);
  u.lane = lane;
  u.pace = 1;
  u.tactic = 'advance';
  u.decisionIn = 100;
  return u;
};

check('三条友军队列同时停火时，后排两侧均可绕行进入射程', () => {
  for (const side of [0, 1]) {
    const s = arena(),
      x = (value) => (side === 0 ? value : W - value);
    setOrder(s, side, 'advance');
    setOrder(s, 1 - side, 'hold');
    for (const lane of [-3, 0, 3]) {
      const lead = v13MovementSolo(s, side, 'machinegun', x(1000), lane);
      lead.cooldown = 100;
    }
    const rifles = [-3, 0, 3].map((lane) =>
      v13MovementSolo(s, side, 'infantry', x(900), lane),
    );
    const target = v13MovementSolo(s, 1 - side, 'infantry', x(1450));
    target.cooldown = 100;
    target.hp = target.maxHp = 1000;
    // This is a pathing test, not a morale test: a lone 'advance' dummy 1v6
    // drains nerve and retreats off its marker. Hold order keeps it planted.
    target.tactic = 'hold';
    advance(s, 12);
    for (const u of rifles) {
      assert(u.shots >= 3, `side ${side}: blocked rifle did not engage`);
      assert(Math.abs(target.x - u.x) <= unitRange(s, u) + 0.1);
      assert(Math.abs(u.lane) <= 15.001);
    }
  }
});

check('三个完整班组重叠入场后，十八人均能持续向己方进攻方向行进', () => {
  for (const side of [0, 1]) {
    const s = arena(),
      dir = side === 0 ? 1 : -1;
    setOrder(s, side, 'advance');
    for (let i = 0; i < 3; i++)
      spawnUnit(s, side, 'infantry', side === 0 ? 400 : W - 400);
    const starts = new Map(s.units.map((u) => [u.uid, u.x]));
    const last = new Map(starts);
    for (let frame = 0; frame < 600; frame++) {
      tick(s, 1 / 60);
      for (const u of s.units) {
        assert(Math.abs(u.x - last.get(u.uid)) < 1.4, 'no forward teleport');
        assert(
          Math.abs(u.lane) <= 24.001,
          'four depth lanes stay within bounded passing space',
        );
        assert(
          Math.abs(infantryDepth(u.lane)) <= 3.001,
          'passing stays in the ground projection',
        );
        last.set(u.uid, u.x);
      }
    }
    assert.equal(s.units.length, 18);
    assert.equal(new Set(s.units.map((u) => u.squad)).size, 3);
    for (const u of s.units) {
      assert((u.x - starts.get(u.uid)) * dir > 450, 'no permanent queue');
      assert.equal(u.facing, dir);
    }
  }
});

check('友军已占掩体边缘时，后来者选可抵达位置并持续开火', () => {
  for (const side of [0, 1]) {
    const s = arena(),
      x = (value) => (side === 0 ? value : W - value);
    setOrder(s, side, 'advance');
    setOrder(s, 1 - side, 'hold');
    s.wrecks.push({
      id: 1,
      cardId: 'tank',
      side,
      x: x(1000),
      y: 374,
      angle: 0,
      age: 10,
      falling: false,
      vx: 0,
      vy: 0,
    });
    const u = v13MovementSolo(s, side, 'infantry', x(900));
    u.tactic = 'cover';
    const friend = v13MovementSolo(s, side, 'infantry', x(933));
    friend.cooldown = 100;
    const target = v13MovementSolo(s, 1 - side, 'infantry', x(1280));
    target.cooldown = 100;
    target.hp = target.maxHp = 1000;
    advance(s, 8);
    assert(u.cover > 0.2);
    assert(
      u.shots >= 4,
      `side ${side}: unreachable cover must not suppress fire`,
    );
    assert(u.coverGoal === null || Math.abs(u.coverGoal - u.x) <= 0.5);
  }
});

check('高载具残骸与三类房屋废墟直接通过且不会反复起落', () => {
  const houses = createGame(37)
    .scenery.filter((p) => p.kind === 'house')
    .slice(0, 3);
  for (const side of [0, 1])
    for (const kind of ['wreck', 0, 1, 2]) {
      const s = arena(),
        dir = side === 0 ? 1 : -1;
      setOrder(s, side, 'advance');
      if (kind === 'wreck') {
        s.wrecks.push({
          id: 1,
          cardId: 'tank',
          side,
          x: 1000,
          y: 374,
          angle: 0,
          age: 10,
          falling: false,
          vx: 0,
          vy: 0,
        });
      } else {
        const prop = structuredClone(houses[kind]);
        const dx = 1000 - prop.x,
          dy = 374 - prop.y;
        prop.x += dx;
        prop.y += dy;
        for (const part of prop.parts) {
          part.x += dx;
          part.y += dy;
        }
        s.scenery = [prop];
        damageScenery(s, 1000, 300, 400, 10000);
        assert(prop.parts.every((part) => part.hp === 0));
      }
      const u = v13MovementSolo(s, side, 'infantry', side === 0 ? 800 : 1200);
      let climbed = false;
      for (let frame = 0; frame < 600; frame++) {
        tick(s, 1 / 60);
        climbed ||= u.motion === 'bank';
        assert(
          u.motion !== 'jump' && u.motion !== 'land',
          'bank lift is not a fall',
        );
      }
      assert.equal(climbed, false);
      assert((u.x - 1000) * dir > 150, `${side}/${kind}: crossed obstacle`);
      assert.equal(u.motion, 'ground');
      assert(Math.abs(u.y - ground(s, u.x)) < 0.01);
    }
});

check('撤退归队后恢复两侧正确行进方向，不保留拥堵或撤退状态', () => {
  for (const side of [0, 1]) {
    const s = arena(),
      dir = side === 0 ? 1 : -1;
    setOrder(s, side, 'advance');
    const u = v13MovementSolo(s, side, 'machinegun', 2000);
    u.tactic = 'retreat';
    u.retreatUntil = 100;
    u.personalMorale = 25;
    u.hp = 17;
    const before = { uid: u.uid, id: u.id, member: u.member, hp: u.hp };
    spawnUnit(s, side, 'infantry', side === 0 ? 2095 : 1905);
    for (const v of s.units) {
      v.cooldown = 100;
      v.decisionIn = 100;
    }
    const host = s.units.at(-1).squad;
    advance(s, 1.3);
    assert.equal(u.squad, host);
    const joinX = u.x;
    advance(s, 3);
    // Regroup no longer bypasses the ten-second low-stance commitment.
    assert((u.x - joinX) * dir > 70, 'advances at the actual crouch speed');
    assert.equal(u.pose, 'crouch');
    advance(s, 6.2);
    const unlockedX = u.x;
    advance(s, 2);
    assert((u.x - unlockedX) * dir > 95, 'upright advance returns once the stance lock expires');
    assert(['walk', 'idle'].includes(u.pose));
    assert.equal(u.facing, dir);
    assert.equal(u.tactic, 'advance');
    for (const key of ['uid', 'id', 'member', 'hp'])
      assert.equal(u[key], before[key]);
  }
});

const v13EngageAdvance = (s, t) => {
  for (let i = 0; i < t * 60; i++) tick(s, 1 / 60);
};
function v13EngageFresh() {
  const s = createGame(37);
  startGame(s);
  s.aiIn = 1e6;
  s.terrain.fill(374);
  s.original.fill(374);
  s.scenery = [];
  s.walls = [];
  return s;
}
function v13EngageSingle(s, side, id, x, tactic = 'prone') {
  const before = s.units.length;
  spawnUnit(s, side, id, x);
  const u = s.units[before];
  s.units = s.units.slice(0, before).concat(u);
  u.tactic = tactic;
  u.decisionIn = 1e6;
  u.cooldown = 0;
  return u;
}
function v13EngageEnemy(s, x) {
  const v = v13EngageSingle(s, 1, 'infantry', x);
  v.cooldown = 1e6;
  setOrder(s, 1, 'hold');
  return v;
}
function v13EngageHouse(s, x, hp = 10000) {
  s.scenery = [
    {
      id: 501,
      kind: 'house',
      x,
      y: 374,
      seed: 1,
      parts: [
        {
          id: 0,
          x: x - 20,
          y: 274,
          w: 40,
          h: 100,
          hp,
          maxHp: hp,
          kind: 'wall',
          brokenAt: -1,
        },
      ],
    },
  ];
  return s.scenery[0].parts[0];
}
check('v13交战：烟幕中125距离已见敌军可原地开火', () => {
  const s = v13EngageFresh(),
    u = v13EngageSingle(s, 0, 'infantry', 600),
    v = v13EngageEnemy(s, 725);
  s.smokes = [{ x: 663, life: 10 }];
  setOrder(s, 0, 'hold');
  refreshVision(s);
  assert(s.visible[0].includes(v.uid));
  tick(s, 1 / 60);
  assert(u.shots > 0);
  assert.equal(u.x, 600);
  return { shots: u.shots, distance: v.x - u.x };
});
check('v13交战：孤立跃进成员在360距离先交火', () => {
  const s = v13EngageFresh(),
    u = v13EngageSingle(s, 0, 'infantry', 600, 'bound');
  u.member = 3;
  v13EngageEnemy(s, 960);
  refreshVision(s);
  v13EngageAdvance(s, 0.5);
  assert(u.shots > 0);
  assert(u.x <= 603);
  return { shots: u.shots, x: u.x };
});
check('v13交战：稳定同班掩护允许跃进且掩护倒下后停步还击', () => {
  const s = v13EngageFresh(),
    u = v13EngageSingle(s, 0, 'infantry', 600, 'bound'),
    v = v13EngageSingle(s, 0, 'infantry', 560);
  v.squad = u.squad;
  v13EngageEnemy(s, 900);
  refreshVision(s);
  tick(s, 1 / 60);
  assert.equal(u.x, 600);
  assert(u.shots > 0);
  v13EngageAdvance(s, 0.35);
  assert(u.x > 605);
  assert(v.shots > 0);
  const x = u.x;
  v.wounded = true;
  v.hp = 5;
  v.bleedOut = 50;
  v13EngageAdvance(s, 0.1);
  assert(u.x <= x + 0.1);
  assert(u.shots > 0);
  return {
    v13EngageAdvance: x - 600,
    coveringShots: v.shots,
    ownShots: u.shots,
  };
});
// Heavy wrecks reach above the adult soldier's chest; lower tank debris can be fired over.
check('v17交战：残骸完全挡线时走通道换位且保留安全距离', () => {
  const s = v13EngageFresh(),
    u = v13EngageSingle(s, 0, 'infantry', 600);
  v13EngageEnemy(s, 900);
  s.wrecks = [
    {
      id: 999,
      cardId: 'heavy_tank',
      side: 0,
      x: 750,
      y: 374,
      angle: 0,
      age: 0,
      falling: false,
      vx: 0,
      vy: 0,
    },
  ];
  refreshVision(s);
  v13EngageAdvance(s, 2);
  assert(u.x >= 600 && 900 - u.x >= 140);
  assert.equal(u.shots, 0);
  return { x: u.x, shots: u.shots, goal: u.firingGoal };
});
check('v13交战：小幅换位后恢复约300距离交火', () => {
  const s = v13EngageFresh(),
    u = v13EngageSingle(s, 0, 'infantry', 550);
  v13EngageEnemy(s, 900);
  for (let x = 640; x < 661; x++) s.terrain[x] = 335;
  refreshVision(s);
  v13EngageAdvance(s, 4);
  assert(u.shots > 0);
  assert(u.x > 550 && u.x <= 614);
  assert(900 - u.x > 280);
  return { x: u.x, shots: u.shots, range: 900 - u.x };
});
check('v13交战：火箭有限破障保留硬碰撞且不穿墙伤敌', () => {
  const s = v13EngageFresh(),
    u = v13EngageSingle(s, 0, 'rocket', 600);
  const v = v13EngageEnemy(s, 900),
    part = v13EngageHouse(s, 850);
  refreshVision(s);
  v13EngageAdvance(s, 8);
  assert(u.shots > 0 && u.shots <= 2);
  assert(part.hp < 10000);
  assert.equal(v.hp, v.maxHp);
  assert(900 - u.x >= 140);
  return { shots: u.shots, houseHp: part.hp, enemyHp: v.hp, x: u.x };
});
check('v13交战：火箭不轰击己方近身掩体且换位有界', () => {
  const s = v13EngageFresh(),
    u = v13EngageSingle(s, 0, 'rocket', 650);
  v13EngageEnemy(s, 840);
  v13EngageHouse(s, 720);
  refreshVision(s);
  v13EngageAdvance(s, 4);
  assert.equal(u.shots, 0);
  assert(840 - u.x >= 140);
  return { shots: u.shots, x: u.x };
});
check('v136交战：卧姿射击和装填期间不擅自起立', () => {
  const s = v13EngageFresh();
  s.terrain = createGame(37, undefined, undefined, undefined, {
    mapSeed: GREYLINE_LAYOUT_SEED,
  }).terrain;
  s.original = [...s.terrain];
  const u = v13EngageSingle(s, 0, 'sniper', 590);
  v13EngageEnemy(s, 1360);
  spawnUnit(s, 0, 'scout_drone', 1200);
  setOrder(s, 0, 'prone');
  refreshVision(s);
  tick(s, 1 / 60);
  assert(u.fire > 0);
  assert.equal(u.pose, 'prone');
  const committedUntil = u.stanceLockUntil;
  for (let i=0; i<60; i++) {
    tick(s, 1 / 60);
    assert.equal(u.pose, 'prone');
    assert.equal(u.stanceLockUntil, committedUntil);
  }
  return { pose: u.pose, exposedUntil: u.exposedUntil };
});
check('v13交战：已抵达掩体目标的同伴可以提供掩护', () => {
  const s = v13EngageFresh(),
    u = v13EngageSingle(s, 0, 'infantry', 600, 'bound'),
    v = v13EngageSingle(s, 0, 'infantry', 560);
  v.squad = u.squad;
  v.coverGoal = v.x;
  v13EngageEnemy(s, 900);
  refreshVision(s);
  tick(s, 1 / 60);
  assert.equal(u.x, 600);
  assert(u.shots > 0);
  v13EngageAdvance(s, 0.3);
  assert(u.x > 600);
  assert(v.shots > 0);
  return { x: u.x };
});
check('v13交战：短时跃进后停步还击而非连续奔跑', () => {
  const s = v13EngageFresh(),
    u = v13EngageSingle(s, 0, 'infantry', 600, 'bound'),
    v = v13EngageSingle(s, 0, 'infantry', 570);
  v.squad = u.squad;
  const target = v13EngageEnemy(s, 930);
  target.hp = target.maxHp = 10000;
  refreshVision(s);
  let movedFrames = 0,
    stationaryAfterMove = 0,
    maxRun = 0,
    run = 0;
  for (let i = 0; i < 100; i++) {
    const x = u.x;
    tick(s, 1 / 60);
    if (u.x > x + 0.01) {
      movedFrames++;
      run++;
      maxRun = Math.max(maxRun, run);
    } else {
      if (movedFrames) stationaryAfterMove++;
      run = 0;
    }
  }
  assert(movedFrames > 5);
  assert(stationaryAfterMove > 30);
  assert(maxRun <= 45);
  assert(u.shots > 0);
  return { movedFrames, stationaryAfterMove, maxRun, shots: u.shots };
});
check('v13交战：跨越全局四秒边界不会切换个人接敌分工', () => {
  const s = v13EngageFresh(),
    u = v13EngageSingle(s, 0, 'infantry', 600);
  v13EngageEnemy(s, 900);
  u.cooldown = 1e6;
  setOrder(s, 0, 'hold');
  refreshVision(s);
  s.time = 3.9;
  u.decisionIn = 0;
  tick(s, 1 / 60);
  const role = u.tactic;
  s.time = 4.1;
  u.decisionIn = 0;
  tick(s, 1 / 60);
  assert.equal(u.tactic, role);
  return { role };
});

// Insert before the final failures/report block in tests/engine.test.mjs.
// Existing public imports and arena/advance helpers are sufficient.
check('轰炸机每架次沿航线投六弹，落点固定且炸弹只向下运动', () => {
  for (const side of [0, 1]) {
    const s = arena(),
      dir = side === 0 ? 1 : -1;
    const x = (value) => (side === 0 ? value : W - value);
    setOrder(s, 1 - side, 'hold');
    spawnUnit(s, side, 'bomber', x(1000));
    const plane = s.units[0];
    spawnUnit(s, 1 - side, 'infantry', x(1350));
    const seen = new Map();
    for (let frame = 0; frame < 180; frame++) {
      tick(s, 1 / 60);
      assert.equal(plane.facing, dir);
      for (const p of s.projectiles.filter((p) => p.sourceUid === plane.uid)) {
        const old = seen.get(p.uid);
        assert.equal(p.guided, false);
        assert((p.tx - p.startX) * dir > 0);
        if (old) {
          assert(p.y >= old.y - 1e-6, 'no mortar-like upward arc');
          assert.equal(p.tx, old.tx, 'dropped bomb must not track targets');
          assert.equal(p.ty, old.ty);
        }
        seen.set(p.uid, { x: p.startX, y: p.y, tx: p.tx, ty: p.ty });
      }
    }
    assert.equal(plane.shots, 6);
    assert.equal(seen.size, 6);
    const drops = [...seen.values()];
    for (let i = 1; i < drops.length; i++) {
      const spacing = (drops[i].tx - drops[i - 1].tx) * dir;
      assert(
        spacing > 55 && spacing < 90,
        'bombs form a bounded flight-path ribbon',
      );
    }
  }
});

check('对地机优先扫射步兵，枪弹向机头前方飞行且飞机不反复翻转', () => {
  for (const side of [0, 1]) {
    const s = arena(),
      dir = side === 0 ? 1 : -1;
    const x = (value) => (side === 0 ? value : W - value);
    setOrder(s, 1 - side, 'hold');
    spawnUnit(s, side, 'strike_jet', x(1000));
    const plane = s.units[0];
    plane.cooldown = 0;
    spawnUnit(s, 1 - side, 'infantry', x(1150));
    const foot = new Set(s.units.slice(1).map((u) => u.uid));
    spawnUnit(s, 1 - side, 'tank', x(1300));
    s.units.filter((u) => u.side !== side).forEach((u) => (u.pace = 0));
    tick(s, 1 / 60);
    const first = s.projectiles.find((p) => p.sourceUid === plane.uid);
    assert(
      first && foot.has(first.targetUid),
      'armor penalty is not armor priority',
    );
    for (let frame = 0; frame < 180; frame++) {
      tick(s, 1 / 60);
      assert.equal(plane.facing, dir);
      for (const p of s.projectiles.filter(
        (p) => p.sourceUid === plane.uid && !p.missed,
      ))
        assert(
          (p.tx - p.startX) * dir > 0,
          'no backward gunfire under the nose',
        );
    }
    assert(plane.shots > 5 && plane.shots <= 24);
  }
});

check('扫射和轰炸弹药逐架次复位，返航仍保留同一张卡与原有费用冷却', () => {
  const deck = [
    'strike_jet',
    'bomber',
    ...Array(6).fill('militia'),
    ...Array(4).fill('infantry'),
    ...Array(2).fill('machinegun'),
    ...Array(2).fill('rocket'),
    ...Array(2).fill('medic'),
    ...Array(2).fill('supply'),
  ];
  for (const id of ['strike_jet', 'bomber']) {
    const s = createGame(37, deck);
    startGame(s);
    s.aiIn = 1e6;
    s.walls = [];
    s.scenery = [];
    s.terrain.fill(374);
    s.original.fill(374);
    setOrder(s, 1, 'hold');
    for (const x of [1400, 2100, 2800]) spawnUnit(s, 1, 'infantry', x);
    for (const u of s.units) {
      u.hp = u.maxHp = 1000;
      u.pace = 0;
      u.cooldown = 100;
    }
    const p = s.players[0];
    const tokens = () => [
      ...p.hand,
      ...p.deck,
      ...p.discard,
      ...s.units
        .filter((u) => u.side === 0 && u.sortieCard)
        .map((u) => u.sortieCard),
    ];
    const token = tokens().find((h) => h.id === id),
      uid = token.uid;
    for (const list of ['hand', 'deck', 'discard'])
      p[list] = p[list].filter((h) => h !== token);
    if (p.hand.length >= MAX_HAND) p.deck.push(p.hand.pop());
    p.hand.push(token);
    for (let sortie = 0; sortie < 2; sortie++) {
      if (sortie) advance(s, cardReadyIn(s, token) + 1 / 60);
      p.energy = 10;
      const cost = cardCost(token);
      assert.equal(cost, sortie ? 2 : CARDS[id].cost);
      assert(playCard(s, 0, uid).ok);
      assert.equal(p.energy, 10 - cost);
      const plane = s.units.find((u) => u.side === 0 && u.sortieCard === token);
      assert(plane && plane.shots === 0 && plane.bombsLeft === undefined);
      const limit = id === 'bomber' ? 6 : 24;
      while (plane.hp > 0 && s.status === 'playing') {
        tick(s, 1 / 60);
        assert(plane.shots <= limit);
        assert.equal(tokens().length, 20);
        assert.equal(new Set(tokens().map((h) => h.uid)).size, 20);
      }
      assert.equal(plane.shots, limit);
      assert(token.returnedOnce);
      assert.equal(token.uid, uid);
      assert(Math.abs(cardReadyIn(s, token) - CARDS[id].sortieCooldown) < 0.02);
    }
  }
});

check('三种坦克履带炮口与受弹保持尺寸，残骸改用独立破损实体', () => {
  for (const id of ['light_tank', 'tank', 'heavy_tank']) {
    const geometry = tankGeometry(id);
    const s = arena();
    spawnUnit(s, 0, id, 1200);
    const unit = s.units[0];
    unit.pace = 0;
    for (const direction of [-1, 1]) {
      unit.hullAngle = direction * 0.13;
      const p = muzzlePoint(unit, unit.x + direction * 300);
      const x = direction * geometry.muzzleX,
        y = -geometry.muzzleY;
      assert(
        Math.abs(
          p.x -
            (unit.x +
              x * Math.cos(unit.hullAngle) -
              y * Math.sin(unit.hullAngle)),
        ) < 1e-6,
      );
      assert(
        Math.abs(
          p.y -
            (unit.y +
              x * Math.sin(unit.hullAngle) +
              y * Math.cos(unit.hullAngle)),
        ) < 1e-6,
      );
      const coax = muzzlePoint(
        { ...unit, hullAngle: 0 },
        unit.x + direction * 300,
        42,
        true,
      );
      assert.equal(coax.x, unit.x + direction * geometry.coaxX);
      assert.equal(coax.y, unit.y - geometry.coaxY);
    }
    unit.hullAngle = 0;
    const oldHp = unit.hp;
    explode(
      s,
      unit.x + geometry.half - 2,
      unit.y - geometry.hullHeight / 2,
      1,
      30,
      1,
    );
    assert(unit.hp < oldHp, '炮弹在可见车身边缘仍命中');
    s.mines.push({ side: 1, x: unit.x + geometry.half - 2, armAt: 0 });
    tick(s, 1 / 60);
    assert.equal(s.mines.length, 0, '前缘履带触雷');
    s.wrecks.push({
      id: 999,
      cardId: id,
      side: 0,
      x: 1500,
      y: 374,
      angle: 0,
      age: 0,
      falling: false,
      vx: 0,
      vy: 0,
    });
    s.time += 1 / 60;
    const pieces = obstacleBoxes(s).filter((b) => b.wreck?.id === 999);
    const shape = wreckGeometry(id);
    assert(
      pieces.length >= 3,
      'turret, hull and detached parts are separate solids',
    );
    assert(
      pieces.every(
        (p) =>
          p.x >= 1500 - shape.width / 2 && p.x + p.w <= 1500 + shape.width / 2,
      ),
    );
    assert(
      Math.min(...pieces.map((p) => p.y)) < 374 - geometry.hullHeight * 0.48,
      'the wreck retains structural height instead of a flattened live sprite',
    );
  }
});

check('成人步态按完整八帧循环，蹲行独立且停步后保持举枪', () => {
  const s = arena();
  spawnUnit(s, 0, 'infantry', 500);
  const u = s.units[0];
  u.moving = true;
  u.pose = 'idle';
  for (const [pose, group] of [
    ['idle', 'walk8'],
    ['crouch', 'crouch8'],
  ]) {
    u.pose = pose;
    u.poseAnimSeen = pose === 'crouch' ? 'crouch' : 'stand';
    u.poseAnimFrom = undefined;
    for (let step = 0; step < 16; step++) {
      u.walk = step + 0.1;
      assert.deepEqual(adultFrameChoice(u), { group, index: step % 8 });
    }
    u.backpedaling = true;
    for (let step = 0; step < 16; step++) {
      u.walk = step + 0.1;
      assert.deepEqual(adultFrameChoice(u), {
        group,
        index: (8 - (step % 8)) % 8,
      });
    }
    u.backpedaling = false;
  }
  u.pose = 'idle';
  u.moving = false;
  // v110: a crouch-walking squad that halts plays the stand-up transition
  // first; let the window elapse before asserting the settled idle frame.
  adultFrameChoice(u, 10);
  for (const fire of [0, 0.05, 0.2]) {
    u.fire = fire;
    assert.deepEqual(adultFrameChoice(u, 11.3), { group: 'actions20', index: 0 });
  }
  u.pose = 'prone';
  adultFrameChoice(u, 12);
  assert.deepEqual(adultFrameChoice(u, 13.3), { group: 'actions20', index: 2 });
});
check('成人四套服装的跳落、攀爬与终态不会退回旧图册', () => {
  for (const [id, identity] of [
    ['infantry', 'infantry'],
    ['marines', 'marines'],
    ['armed_police', 'police'],
    ['militia', 'militia'],
  ]) {
    assert.equal(adultIdentity(id), identity);
    const s = arena();
    spawnUnit(s, 0, id, 500);
    const u = s.units[0];
    u.motion = 'jump';
    u.motionTime = 0.2;
    assert.deepEqual(adultFrameChoice(u), { group: 'actions20', index: 5 });
    u.motion = 'ground';
    u.climbing = 0.25;
    u.climbDuration = 1;
    assert.deepEqual(adultFrameChoice(u), { group: 'crouch8', index: 1 });
    u.surrendered = true;
    u.surrenderTime = 3;
    assert.deepEqual(adultFrameChoice(u), { group: 'reactions8', index: 3 });
    u.hp = 0;
    assert.deepEqual(adultFrameChoice(u), { group: 'actions20', index: 15 });
  }
});
check('卧倒人员死亡保持倒地，尸体保存朝向与队列深度', () => {
  const s = arena();
  spawnUnit(s, 0, 'infantry', 500);
  const u = s.units[0];
  s.units = [u];
  u.pose = 'prone';
  u.facing = -1;
  u.lane = 9;
  u.wounded = true;
  u.woundedFromPose = 'prone';
  u.woundedTime = 0.1;
  assert.deepEqual(adultFrameChoice(u), { group: 'actions20', index: 14 });
  u.woundedFromPose = 'crouch';
  assert.equal(adultFrameChoice(u).index, 5);
  explode(s, u.x, u.y, 20, 1000, 1);
  const wreck = s.wrecks.find((w) => w.id === u.uid);
  assert(wreck);
  assert.equal(wreck.pose, 'prone');
  assert.equal(wreck.facing, -1);
  assert.equal(wreck.lane, 9);
  assert.deepEqual(adultWreckChoice(0, wreck.pose), {
    group: 'actions20',
    index: 15,
  });
  assert.equal(adultWreckChoice(0, 'crouch').index, 5);
  assert.equal(adultWreckChoice(0, 'idle').index, 4);
});
check('弹丸显示随班组深度连接枪口和目标，物理弹道保持不变', () => {
  const s = arena();
  spawnUnit(s, 0, 'infantry', 500);
  spawnUnit(s, 1, 'infantry', 900);
  const a = s.units.find((u) => u.side === 0),
    b = s.units.find((u) => u.side === 1);
  a.lane = 12;
  b.lane = -6;
  const p = {
    sourceUid: a.uid,
    targetUid: b.uid,
    radius: 0,
    missed: false,
    life: 0.5,
    total: 1,
    startX: 531,
    x: 700,
    startY: 327,
    ty: 340,
    y: 333.5,
  };
  const original = { ...p },
    visual = projectileForRender(s, p);
  assert.deepEqual(p, original);
  assert.notEqual(visual, p);
  assert.equal(visual.startY, 328.5);
  assert.equal(visual.ty, 339.25);
  assert.equal(visual.y, 333.875);
  const specialist = projectileForRender(s, p, { x: 10, y: -3 });
  assert.equal(specialist.startX, 541);
  assert.equal(specialist.x, 705);
  assert.equal(specialist.startY, 325.5);
  assert.equal(specialist.y, 332.375);
  assert.deepEqual(p, original);
});

check('成人长枪管贴近墙边时不能从墙内起弹，两侧对称', () => {
  for (const side of [0, 1]) {
    const s = arena(),
      flip = (x) => (side === 0 ? x : W - x);
    spawnUnit(s, side, 'rocket', flip(657));
    const u = s.units[0];
    s.units = [u];
    spawnUnit(s, 1 - side, 'infantry', flip(840));
    const v = s.units.find((v) => v.side !== side);
    s.units = [u, v];
    for (const member of [u, v]) {
      member.pose = 'prone';
      member.tactic = 'prone';
      member.decisionIn = 1e6;
    }
    u.cooldown = 0;
    v.cooldown = 1e6;
    setOrder(s, side, 'hold');
    setOrder(s, 1 - side, 'hold');
    s.scenery = [
      {
        id: 501,
        kind: 'house',
        x: flip(720),
        y: 374,
        seed: 1,
        parts: [
          {
            id: 0,
            x: side === 0 ? 700 : W - 740,
            y: 274,
            w: 40,
            h: 100,
            hp: 10000,
            maxHp: 10000,
            kind: 'wall',
            brokenAt: -1,
          },
        ],
      },
    ];
    refreshVision(s);
    advance(s, 0.5);
    assert.equal(u.shots, 0);
    assert.equal(v.hp, v.maxHp);
  }
});

check(
  '连续炮击后的宽浅坑地带可以双向穿行，步行蹲行匍匐均不会陷入攀爬循环',
  () => {
    for (const side of [0, 1])
      for (const order of ['advance', 'rush', 'crouch', 'prone']) {
        const s = arena(),
          dir = side === 0 ? 1 : -1;
        setOrder(s, side, order);
        for (let x = 900; x <= 1100; x += 40)
          for (let hit = 0; hit < 4; hit++)
            explode(s, x, ground(s, x) - 8, 68, 0, side);
        const start = side === 0 ? 830 : 1170;
        const u = v13MovementSolo(s, side, 'infantry', start);
        let climbing = 0,
          airborne = 0;
        for (let frame = 0; frame < 30 * 60; frame++) {
          tick(s, 1 / 60);
          climbing += Number(u.pose === 'climb');
          airborne += Number(u.motion !== 'ground');
          assert(Number.isFinite(u.y));
        }
        assert(
          (u.x - start) * dir > 340,
          `${side}/${order}: crossed bombarded road`,
        );
        assert.equal(
          climbing,
          0,
          `${side}/${order}: no climb cycle on ordinary pits`,
        );
        assert(airborne < 60, `${side}/${order}: most movement stays grounded`);
      }
  },
);

check('不同战术成员都能选用实际炮击生成的宽浅坑，并在掩体内持续交火', () => {
  for (const side of [0, 1])
    for (const tactic of ['cover', 'prone', 'crouch', 'bound']) {
      const s = arena(),
        x = (value) => (side === 0 ? value : W - value);
      setOrder(s, side, 'advance');
      setOrder(s, 1 - side, 'hold');
      explode(s, x(900), 366, 68, 0, side);
      const u = v13MovementSolo(s, side, 'infantry', x(860));
      u.tactic = tactic;
      const target = v13MovementSolo(s, 1 - side, 'infantry', x(1220));
      target.hp = target.maxHp = 10000;
      target.cooldown = 100;
      let shelteredShots = 0,
        lastShots = 0,
        climbing = 0;
      for (let frame = 0; frame < 10 * 60; frame++) {
        tick(s, 1 / 60);
        if (u.cover > 0.2) shelteredShots += u.shots - lastShots;
        lastShots = u.shots;
        climbing += Number(u.pose === 'climb');
      }
      assert(u.cover > 0.2, `${side}/${tactic}: uses shallow crater`);
      assert(
        shelteredShots >= 6,
        `${side}/${tactic}: keeps firing from cover (${shelteredShots})`,
      );
      assert.equal(climbing, 0);
      const position = u.x;
      advance(s, 2);
      assert(
        Math.abs(u.x - position) < 1,
        'stays at its firing position through reloads',
      );
      s.units = [u];
      advance(s, 5);
      assert(
        (u.x - position) * (side === 0 ? 1 : -1) > 12,
        'resumes advancing after contact is lost',
      );
    }
});

const v14GunScene = (side, id) => {
  const s = arena(),
    x = (value) => (side === 0 ? value : W - value);
  const solo = (team, card, position) => {
    const index = s.units.length;
    spawnUnit(s, team, card, x(position));
    const u = s.units[index];
    s.units.splice(index + 1);
    u.hp = u.maxHp = 100000;
    u.personalMorale = 100;
    u.cooldown = u.secondaryCooldown = 100000;
    u.pace = 0;
    u.decisionIn = 100000;
    // decisionIn alone does not stop the quickContact bypass for 'advance'
    // units; a lone infantry dummy 1v1 vs a tank still drains nerve and
    // retreats, which yanks the howitzer's escort baseline back to base.
    u.tactic = 'hold';
    return u;
  };
  const gun = solo(side, id, 700);
  gun.cooldown = 0;
  setOrder(s, side, 'advance');
  setOrder(s, 1 - side, 'hold');
  return { s, x, solo, gun };
};

check('三类榴弹炮不会因近敌进入射界盲区而放弃另一个合法远目标', () => {
  for (const side of [0, 1])
    for (const id of ['artillery', 'barrage', 'precision']) {
      const { s, solo, gun } = v14GunScene(side, id);
      solo(side, 'infantry', 1000);
      solo(1 - side, 'infantry', 850);
      const far = solo(1 - side, 'tank', 1300);
      refreshVision(s);
      advance(s, 1);
      assert.equal(gun.shots, 0, 'initial setup takes 1.2 seconds');
      advance(s, 0.4);
      const shell = s.projectiles.find((p) => p.sourceUid === gun.uid);
      assert(shell?.shell);
      assert.equal(
        shell.targetUid,
        far.uid,
        'fires at the target outside minimum range',
      );
      advance(s, 20);
      assert(
        gun.shots >= 2,
        `${side}/${id}: keeps firing despite nearby enemy`,
      );
    }
});

check(
  '榴弹炮仅在连续6秒失去合法目标后转移，按牵引速度前进并重新架设开火',
  () => {
    for (const side of [0, 1])
      for (const id of ['artillery', 'barrage', 'precision']) {
        const { s, x, solo, gun } = v14GunScene(side, id);
        const escort = solo(side, 'infantry', 1100),
          target = solo(1 - side, 'tank', 1450);
        refreshVision(s);
        advance(s, 2);
        assert.equal(gun.shots, 1);
        const start = gun.x,
          initialShots = gun.shots;
        escort.x = x(2600);
        target.x = x(3000);
        refreshVision(s);
        assert(
          s.visible[side].includes(target.uid),
          'forward escort really observes the target',
        );
        advance(s, 5.5);
        assert.equal(
          gun.x,
          start,
          'brief idle period does not trigger packing',
        );
        let sawTowing = false,
          setupStarted = null,
          lastX = gun.x,
          lastShots = gun.shots;
        for (let frame = 0; frame < 70 * 60; frame++) {
          const wasEmplaced = gun.emplaced;
          tick(s, 1 / 60);
          assert(
            Math.abs(gun.x - lastX) <= 28 / 60 + 1e-6,
            'no teleport or towing speed boost',
          );
          if (gun.moving) {
            sawTowing = true;
            assert.equal(gun.shots, lastShots, 'cannot fire while towing');
          }
          if (!wasEmplaced && gun.emplaced) setupStarted = s.time;
          if (setupStarted !== null && s.time < setupStarted + 1.2 - 1e-6)
            assert.equal(
              gun.shots,
              initialShots,
              'must finish setting up again',
            );
          lastX = gun.x;
          lastShots = gun.shots;
        }
        assert(sawTowing);
        assert(
          setupStarted !== null,
          JSON.stringify({
            side,
            id,
            x: gun.x,
            emplaced: gun.emplaced,
            shots: gun.shots,
            escort: escort.x,
            target: target.x,
            visible: s.visible[side],
            uid: target.uid,
          }),
        );
        assert(
          gun.shots >= initialShots + 2,
          `${side}/${id}: resumes periodic bombardment`,
        );
        assert.equal(gun.emplaced, true);
        const settledX = gun.x,
          setupDeadline = gun.emplacementSetupUntil;
        advance(s, 16);
        assert.equal(
          gun.x,
          settledX,
          'does not alternate packing and firing at the same point',
        );
        assert.equal(gun.emplacementSetupUntil, setupDeadline);
      }
  },
);

check('榴弹炮尊重驻守命令，恢复推进后才跟随真实前线重新展开', () => {
  for (const side of [0, 1]) {
    const { s, x, solo, gun } = v14GunScene(side, 'artillery');
    const escort = solo(side, 'infantry', 1100),
      target = solo(1 - side, 'tank', 1450);
    advance(s, 2);
    const start = gun.x,
      shots = gun.shots;
    setOrder(s, side, 'hold');
    escort.x = x(2600);
    target.x = x(3000);
    refreshVision(s);
    advance(s, 20);
    assert.equal(gun.x, start);
    assert.equal(gun.shots, shots);
    setOrder(s, side, 'advance');
    advance(s, 70);
    assert(Math.abs(gun.x - start) > 500);
    assert(gun.shots > shots);
  }
});

check('短暂丢失观察与正常装填不会触发榴弹炮反复收炮架设', () => {
  for (const side of [0, 1])
    for (const id of ['artillery', 'barrage', 'precision']) {
      const { s, x, solo, gun } = v14GunScene(side, id);
      const escort = solo(side, 'infantry', 1100);
      solo(1 - side, 'tank', 1450);
      advance(s, 2);
      const start = gun.x,
        deadline = gun.emplacementSetupUntil;
      for (let cycle = 0; cycle < 3; cycle++) {
        escort.x = x(700);
        refreshVision(s);
        advance(s, 4);
        escort.x = x(1100);
        refreshVision(s);
        advance(s, 1);
        assert.equal(gun.x, start);
        assert.equal(gun.emplaced, true);
        assert.equal(gun.emplacementSetupUntil, deadline);
      }
      advance(s, 30);
      assert.equal(gun.x, start);
      assert(gun.shots >= 3);
    }
});

check('榴弹炮仍不攻击射界盲区内的唯一目标或未被观察的远敌', () => {
  for (const side of [0, 1])
    for (const id of ['artillery', 'barrage', 'precision']) {
      for (const position of [850, 1500]) {
        const { s, solo, gun } = v14GunScene(side, id);
        solo(1 - side, 'tank', position);
        setOrder(s, side, 'hold');
        refreshVision(s);
        advance(s, 20);
        assert.equal(gun.shots, 0);
        assert.equal(gun.x, side === 0 ? 700 : W - 700);
      }
    }
});

check('AI 把健康的在途反甲组计入增援，随后补步兵而非重复购买标枪', () => {
  const s = v12Arena();
  spawnUnit(s, 1, 'infantry', 2800);
  spawnUnit(s, 1, 'javelin', 3728);
  spawnUnit(s, 0, 'tank', 2450);
  for (const u of s.units) u.cooldown = u.secondaryCooldown = 100;
  refreshVision(s);
  assert(
    s.visible[1].some(
      (uid) => s.units.find((u) => u.uid === uid)?.id === 'tank',
    ),
  );
  v12AIHand(s, ['javelin', 'infantry'], 4);
  s.aiIn = 0;
  tick(s, 0.01);
  assert.equal(
    s.units.filter((u) => u.side === 1 && u.id === 'javelin').length,
    2,
  );
  assert.equal(
    new Set(
      s.units
        .filter((u) => u.side === 1 && u.id === 'infantry')
        .map((u) => u.squad),
    ).size,
    2,
  );
  assert(s.players[1].energy >= 2 && s.players[1].energy < 2.01);
});

check(
  '空地威胁并存时 AI 优先处理逼近基地的直升机，按正常费用及时部署防空',
  () => {
    const s = v12Arena();
    spawnUnit(s, 1, 'infantry', 3550);
    spawnUnit(s, 1, 'infantry', 2900);
    spawnUnit(s, 0, 'tank', 2500);
    spawnUnit(s, 0, 'helicopter', 3350);
    const heli = s.units.at(-1),
      tank = s.units.find((u) => u.id === 'tank');
    for (const u of s.units) {
      u.pace = 0;
      u.decisionIn = 100;
      u.personalMorale = 100;
    }
    tank.cooldown = tank.secondaryCooldown = 100;
    refreshVision(s);
    assert(s.visible[1].includes(heli.uid) && s.visible[1].includes(tank.uid));
    v12AIHand(s, ['antitank_mine', 'manpads'], CARDS.manpads.cost);
    s.players[1].deck = [];
    s.players[1].discard = [];
    s.aiIn = 0;
    tick(s, 0.01);
    assert(s.units.some((u) => u.side === 1 && u.id === 'manpads'));
    assert.equal(
      s.mines.length,
      0,
      'does not spend emergency AA budget on a cheaper ground mine',
    );
    assert(s.players[1].energy < 0.01);
    advance(s, 7);
    assert(
      heli.hp < heli.maxHp * 0.3,
      'counter reaches and damages the immediate air threat',
    );
  },
);

check(
  'AI 支援兵种齐全但缺少步兵护卫时先补前线，空闲行军快进且接敌恢复战术推进',
  () => {
    const s = v12Arena();
    spawnUnit(s, 1, 'javelin', 3500);
    spawnUnit(s, 1, 'sam_vehicle', 3500);
    v12AIHand(s, ['tank', 'militia'], 6);
    s.aiIn = 0;
    tick(s, 0.01);
    assert(s.units.some((u) => u.side === 1 && u.id === 'militia'));
    assert(!s.units.some((u) => u.side === 1 && u.id === 'tank'));
    const march = v12Arena();
    spawnUnit(march, 1, 'infantry', 3500);
    spawnUnit(march, 1, 'infantry', 3250);
    march.players[1].hand = [];
    march.players[1].deck = [];
    march.players[1].discard = [];
    const leader = march.units.at(-6),
      start = leader.x;
    march.aiIn = 0;
    advance(march, 5);
    assert.equal(march.players[1].order, 'rush');
    assert(start - leader.x > 500);
    spawnUnit(march, 0, 'infantry', leader.x - 280);
    refreshVision(march);
    march.aiIn = 0;
    tick(march, 0.01);
    assert.notEqual(
      march.players[1].order,
      'rush',
      'stops global rush as soon as visible contact is close',
    );
  },
);

check('AI 按对局阶段调整节奏：前期经济、中期协同、后期全力反扑', () => {
  const tempo = (time, setup, hand, energy) => {
    const s = v12Arena();
    s.time = time;
    setup(s);
    refreshVision(s);
    v12AIHand(s, hand, energy);
    s.players[1].deck = [];
    s.players[1].discard = [];
    s.aiIn = 0;
    tick(s, 0.05);
    return s.players[1].discard.map((c) => c.id);
  };
  // 前期：优先经济牌，跳过五费载具
  const early = tempo(
    30,
    (s) => {
      spawnUnit(s, 1, 'infantry', 2800);
      spawnUnit(s, 1, 'infantry', 2850);
    },
    ['war_bonds', 'ifv'],
    6,
  );
  assert(early.includes('war_bonds'), '前期优先战时公债');
  assert(!early.includes('ifv'), '前期不买五费步战车');
  // 中期：看见两架直升机立刻补防空
  const midAir = tempo(
    120,
    (s) => {
      spawnUnit(s, 1, 'infantry', 2800);
      spawnUnit(s, 1, 'infantry', 2850);
      spawnUnit(s, 0, 'helicopter', 2500);
      spawnUnit(s, 0, 'helicopter', 2560);
    },
    ['aa_gun', 'infantry'],
    4,
  );
  assert(midAir.includes('aa_gun'), '中期面对空情优先防空炮');
  assert(!midAir.includes('infantry'), '防空优先于继续堆步兵');
  // 中期：看见两辆坦克补反甲
  const midArmor = tempo(
    120,
    (s) => {
      spawnUnit(s, 1, 'infantry', 2800);
      spawnUnit(s, 1, 'infantry', 2850);
      spawnUnit(s, 0, 'tank', 2500);
      spawnUnit(s, 0, 'tank', 2560);
    },
    ['antiarmor', 'infantry'],
    4,
  );
  assert(midArmor.includes('antiarmor'), '中期面对装甲优先反坦克组');
  // 中期：面对固守步兵群用曲射
  const midTurtle = tempo(
    120,
    (s) => {
      for (let i = 0; i < 4; i++) spawnUnit(s, 1, 'infantry', 2800 - i * 24);
      for (let i = 0; i < 3; i++) {
        const at = s.units.length;
        spawnUnit(s, 0, 'infantry', 2500 - i * 30);
        for (const u of s.units.slice(at)) u.moving = false;
      }
    },
    ['mortar_carrier', 'infantry'],
    5,
  );
  assert(midTurtle.includes('mortar_carrier'), '中期面对固守步兵群用自行迫炮');
  // 后期：不再买经济，全力反扑
  const late = tempo(
    400,
    (s) => {
      spawnUnit(s, 1, 'infantry', 2800);
    },
    ['war_bonds', 'reserve_mobilization'],
    4,
  );
  assert(
    late.includes('reserve_mobilization'),
    '后期优先预备队动员反扑',
  );
  assert(!late.includes('war_bonds'), '后期不再买延迟经济');
});

check('五套推荐与 AI 编队都有合法费用曲线、反甲、防空和各自战术配合', () => {
  const decks = new Map();
  for (let seed = 0; seed < 100; seed++) {
    const deck = chooseAiDeck(seed);
    assert(validDeck(deck));
    decks.set(deck.join(','), deck);
    assert(
      deck.filter((id) => CARDS[id].members && !CARDS[id].heal).length >= 5,
    );
    assert(
      deck.some(
        (id) =>
          (CARDS[id].armorMultiplier ?? 1) >= 1.5 || CARDS[id].penetration,
      ),
    );
    assert(deck.some((id) => CARDS[id].antiAir));
    if (deck.some((id) => CARDS[id].indirect))
      assert(
        deck.some((id) => CARDS[id].observer || id === 'recon'),
        'indirect fire needs a real observation source in its deck',
      );
    assert(deck.includes('supply'));
    assert(deck.filter((id) => CARDS[id].type === 'skill').length >= 4);
    assert(deck.filter((id) => CARDS[id].cost === 1).length >= 3);
    assert(deck.reduce((n, id) => n + CARDS[id].cost, 0) / 20 <= 3.2);
  }
  assert.equal(decks.size, AI_DECKS.length);
  assert.equal(AI_DECKS.length, 7);
  assert.equal(DECK_PRESETS.length, 7);
  for (const deck of AI_DECKS)
    assert(
      decks.has(deck.join(',')),
      'each legal opponent plan can be selected',
    );
  for (const preset of DECK_PRESETS) {
    const deck = preset.cards;
    assert(validDeck(deck));
    if (preset.id === 'combined')
      assert(deck.some((id) => CARDS[id].armored && !CARDS[id].airOnly));
    if (preset.id === 'assault') {
      assert(deck.includes('smoke') && deck.includes('morale'));
      assert(deck.some((id) => CARDS[id].infantryAbility === 'smoke_assault'));
    }
    if (preset.id === 'fire_support')
      assert(deck.some((id) => CARDS[id].indirect));
    if (preset.id === 'air_mobile') {
      assert(deck.some((id) => CARDS[id].airlift));
      assert(deck.some((id) => CARDS[id].sortie));
    }
  }
});

check('破损步战车实体挡弹，敞开的车舱断口不再被整块矩形挡住', () => {
  const s = arena();
  s.wrecks.push({
    id: 100,
    cardId: 'ifv',
    side: 0,
    x: 1000,
    y: 374,
    angle: 0,
    age: 1,
    falling: false,
    vx: 0,
    vy: 0,
  });
  const shape = wreckGeometry('ifv');
  const y = 374 + (0.45 - shape.support[2]) * shape.height;
  assert(
    sceneryIntercept(s, 927, y, 931, y, false, true),
    'solid rear side panel',
  );
  assert.equal(
    sceneryIntercept(s, 965, y, 970, y, false, true),
    null,
    'painted open cabin remains open',
  );
});
check('宽残骸按主车体承重范围贴地，后续挖坑不会把车体按中心拉进土里', () => {
  for (const id of ['tank', 'helicopter', 'bomber'])
    for (const side of [0, 1]) {
      const s = arena(),
        w = {
          id: 100,
          cardId: id,
          side,
          x: 1500,
          y: 374,
          angle: 0,
          age: 1,
          falling: false,
          vx: 0,
          vy: 0,
        };
      s.wrecks.push(w);
      for (let n = 0; n < 4; n++)
        explode(s, 1500, ground(s, 1500) - 8, 68, 0, side);
      tick(s, 1 / 60);
      const g = wreckGeometry(id),
        dir = side === 0 ? 1 : -1;
      for (let p = g.support[0]; p <= g.support[1]; p += 0.02) {
        const dx = (p - 0.5) * g.width * dir;
        assert(
          w.y + Math.sin(w.angle) * dx <=
            ground(s, w.x + Math.cos(w.angle) * dx) + 0.81,
          'main hull supports do not penetrate soil',
        );
      }
      assert(
        w.y < ground(s, w.x) - 2,
        'wide wreck bridges the small depression',
      );
      assert.equal(w.y, wreckContact((x) => ground(s, x), w).y);
    }
});

// Insert before the final report/failures block. Uses existing engine imports.
const v14TacticsArena = () => {
  const s = createGame(37);
  startGame(s);
  s.aiIn = 1e6;
  s.units = [];
  s.walls = [];
  s.scenery = [];
  s.terrain.fill(374);
  s.original.fill(374);
  return s;
};
const v14TacticsSolo = (s, side, id, x, tactic = 'prone') => {
  const index = s.units.length;
  spawnUnit(s, side, id, x);
  const u = s.units[index];
  s.units.splice(index + 1);
  Object.assign(u, {
    x,
    y: 374,
    cooldown: 0,
    shots: 0,
    tactic,
    decisionIn: 1000,
    pace: 1,
  });
  return u;
};
const v14SuperiorContact = (side, order = 'advance') => {
  const s = v14TacticsArena(),
    x = (value) => (side === 0 ? value : W - value);
  spawnUnit(s, side, 'infantry', x(700));
  const own = [...s.units];
  own.forEach((u, i) =>
    Object.assign(u, {
      x: x(700 - i * 25),
      y: 374,
      cooldown: 0,
      shots: 0,
      pace: 1,
      personalMorale: 80,
      decisionIn: 0,
    }),
  );
  for (let group = 0; group < 3; group++)
    spawnUnit(s, 1 - side, 'infantry', x(960 + group * 10));
  for (const u of s.units.filter((v) => v.side !== side))
    Object.assign(u, {
      cooldown: 1000,
      decisionIn: 1000,
      hp: 10000,
      maxHp: 10000,
      pace: 0,
    });
  setOrder(s, side, order);
  setOrder(s, 1 - side, 'hold');
  refreshVision(s);
  return { s, own, x, dir: side === 0 ? 1 : -1 };
};

check('接敌且武器就绪时先开火，附近矮墙不会让士兵放弃持续射击去攀爬', () => {
  for (const side of [0, 1]) {
    const s = v14TacticsArena(),
      x = (value) => (side === 0 ? value : W - value);
    const u = v14TacticsSolo(s, side, 'infantry', x(600), 'bound');
    const cover = v14TacticsSolo(s, side, 'infantry', x(560));
    cover.squad = u.squad;
    const enemy = v14TacticsSolo(s, 1 - side, 'infantry', x(900));
    Object.assign(enemy, { cooldown: 1000, hp: 10000, maxHp: 10000 });
    s.walls = [
      { uid: 90001, x: x(625), width: 20, height: 24, hp: 1000, maxHp: 1000 },
    ];
    setOrder(s, 1 - side, 'hold');
    refreshVision(s);
    const start = u.x;
    tick(s, 1 / 60);
    assert.equal(u.shots, 1, 'the first eligible frame produces a shot');
    assert.equal(u.x, start, 'does not move before its first shot');
    let climbingFrames = 0;
    for (let frame = 0; frame < 4 * 60; frame++) {
      tick(s, 1 / 60);
      climbingFrames += Number(u.climbing > 0 || u.motion === 'bank');
    }
    assert.equal(climbingFrames, 0);
    assert(u.shots >= 4, 'continues firing across several reloads');
    assert(
      Math.abs(enemy.x - u.x) >= 285,
      'does not turn a clear ranged shot into a charge',
    );
  }
});

check('发现可用弹坑时先打出就绪子弹，再利用装填间隙接近掩体', () => {
  for (const side of [0, 1]) {
    const s = v14TacticsArena(),
      x = (value) => (side === 0 ? value : W - value);
    explode(s, x(900), 366, 68, 0, side);
    const u = v14TacticsSolo(s, side, 'infantry', x(860), 'cover');
    const enemy = v14TacticsSolo(s, 1 - side, 'infantry', x(1220));
    Object.assign(enemy, { cooldown: 1000, hp: 10000, maxHp: 10000 });
    setOrder(s, 1 - side, 'hold');
    refreshVision(s);
    const start = u.x;
    tick(s, 1 / 60);
    assert.equal(u.shots, 1);
    assert.equal(
      u.x,
      start,
      'selecting shelter does not cancel the ready shot',
    );
    let movedDuringReload = false,
      climbingFrames = 0;
    for (let frame = 0; frame < 5 * 60; frame++) {
      const previousX = u.x,
        previousShots = u.shots;
      tick(s, 1 / 60);
      if (Math.abs(u.x - previousX) > 0.001 && u.shots === previousShots)
        movedDuringReload = true;
      climbingFrames += Number(u.climbing > 0 || u.motion === 'bank');
    }
    assert(movedDuringReload);
    assert(u.cover > 0.2);
    assert(u.shots >= 4);
    assert.equal(climbingFrames, 0);
  }
});

check(
  '正常士气遇到优势敌军时双向交替后撤，接敌时面敌倒退且始终留人掩护',
  () => {
    for (const side of [0, 1]) {
      const { s, own, dir } = v14SuperiorContact(side);
      const starts = new Map(own.map((u) => [u.uid, u.x]));
      const squads = new Map(own.map((u) => [u.uid, u.squad]));
      const movedMembers = new Set();
      let movementFrames = 0,
        coveringFrames = 0;
      for (let frame = 0; frame < 4.8 * 60; frame++) {
        const before = new Map(own.map((u) => [u.uid, u.x]));
        tick(s, 1 / 60);
        const movingBack = own.filter(
          (u) => (u.x - before.get(u.uid)) * dir < -0.001,
        );
        if (!movingBack.length) continue;
        movementFrames++;
        assert(
          movingBack.length < own.length,
          'controlled withdrawal never turns the entire squad away together',
        );
        const covering = own.some(
          (u) => !u.moving && s.time - (u.lastCombatShotAt ?? -100) < 1.4,
        );
        coveringFrames += Number(covering);
        assert(
          covering,
          'every withdrawal step has a stationary member who recently fired',
        );
        for (const u of movingBack) {
          movedMembers.add(u.uid);
          assert.equal(u.facing, u.backpedaling ? dir : -dir);
          if (u.backpedaling) assert(['crouch', 'hunker', 'prone'].includes(u.pose),
            'a prone member may crawl backwards without bypassing the posture lock');
          assert.equal(
            u.fire,
            0,
            'no muzzle flash pointing backwards while travelling',
          );
          assert.notEqual(
            u.pose,
            'run',
            'controlled withdrawal is not a rout animation',
          );
        }
      }
      assert(movementFrames > 60);
      assert.equal(coveringFrames, movementFrames);
      assert.equal(
        movedMembers.size,
        own.length,
        'both halves take a turn withdrawing',
      );
      for (const u of own) {
        const distance = (starts.get(u.uid) - u.x) * dir;
        assert(
          distance > 0 && distance <= 100,
          'bounded relocation, not flight across the battlefield',
        );
        assert(u.personalMorale >= 70);
        assert.notEqual(u.tactic, 'retreat');
        assert(!u.surrendered);
        assert.equal(u.squad, squads.get(u.uid));
      }
      assert(
        own.slice(0, 3).every((u) => (starts.get(u.uid) - u.x) * dir > 24),
        'the exposed front rank actually gives ground',
      );
      const safeRear = own.filter(
        (u) => u.member >= 4 && (u.withdrawUntil ?? 0) <= s.time,
      );
      assert(
        safeRear.length > 0,
        'rear members stop their automatic fallback after escaping the threat',
      );
      assert(safeRear.every((u) => !u.backpedaling));
      assert(
        own.reduce((n, u) => n + u.shots, 0) >= 12,
        'the squad keeps fighting while giving ground',
      );
    }
  },
);

check('驻守和强行推进命令不会被普通士气的自动交替后撤覆盖', () => {
  for (const side of [0, 1])
    for (const order of ['hold', 'rush']) {
      const { s, own, dir } = v14SuperiorContact(side, order);
      for (let frame = 0; frame < 3 * 60; frame++) {
        const before = new Map(own.map((u) => [u.uid, u.x]));
        tick(s, 1 / 60);
        for (const u of own) {
          assert(
            (u.x - before.get(u.uid)) * dir >= -0.001,
            'the explicit order prevents automatic fallback',
          );
          assert((u.withdrawUntil ?? 0) <= s.time);
          assert.notEqual(u.tactic, 'retreat');
        }
      }
      assert(own.reduce((n, u) => n + u.shots, 0) > 0);
    }
});

check('烟幕后不可见的优势敌军不触发后撤，观察到它们后才重新判断兵力', () => {
  for (const side of [0, 1]) {
    const s = v14TacticsArena(),
      x = (value) => (side === 0 ? value : W - value);
    spawnUnit(s, side, 'infantry', x(700));
    const own = [...s.units];
    own.forEach((u, i) =>
      Object.assign(u, {
        x: x(700 - i * 25),
        y: 374,
        cooldown: 0,
        shots: 0,
        pace: 1,
        personalMorale: 80,
        decisionIn: 0,
      }),
    );
    const weak = v14TacticsSolo(s, 1 - side, 'infantry', x(900));
    Object.assign(weak, { cooldown: 1000, hp: 10000, maxHp: 10000 });
    const hidden = [];
    for (let group = 0; group < 3; group++) {
      const before = s.units.length;
      spawnUnit(s, 1 - side, 'infantry', x(1050));
      s.units.slice(before).forEach((u, member) => {
        Object.assign(u, {
          x: x(1050 + group * 12 + member * 2),
          y: 374,
          cooldown: 1000,
          decisionIn: 1000,
          hp: 10000,
          maxHp: 10000,
          pace: 0,
        });
        hidden.push(u);
      });
    }
    s.smokes = [{ x: x(1015), life: 100, side: 1 - side }];
    setOrder(s, 1 - side, 'hold');
    refreshVision(s);
    assert(s.visible[side].includes(weak.uid));
    assert(hidden.every((u) => !s.visible[side].includes(u.uid)));
    for (let frame = 0; frame < 3 * 60; frame++) {
      tick(s, 1 / 60);
      assert(own.every((u) => (u.withdrawUntil ?? 0) <= s.time));
      assert(hidden.every((u) => !s.visible[side].includes(u.uid)));
    }
    s.smokes = [];
    refreshVision(s);
    assert(hidden.every((u) => s.visible[side].includes(u.uid)));
    own.forEach((u) => {
      u.decisionIn = 0;
    });
    const before = new Map(own.map((u) => [u.uid, u.x])),
      dir = side === 0 ? 1 : -1;
    advance(s, 1.5);
    assert(
      own.some((u) => (u.x - before.get(u.uid)) * dir < -5),
      'observed superiority causes controlled fallback',
    );
  }
});

const v15Use = (s, id, side = 0, x = 900) => {
  s.players[side].energy = 10;
  s.players[side].hand = [{ id, uid: ++s.uid }];
  const result = playCard(s, side, s.uid, x);
  assert(result.ok, result.message);
};
check('低费工具覆盖四类步兵与五类战术，卡面短句均不溢出', () => {
  for (const id of [
    'militia',
    'scouts',
    'medic',
    'engineers',
    'rally',
    'smoke',
    'recon',
    'fortify',
    'jam',
  ])
    assert.equal(CARDS[id].cost, 1);
  for (const id of Object.keys(CARDS)) {
    assert(CARD_COPY[id], id);
    assert([...CARD_COPY[id].rule].length <= 15, `${id} rule`);
    assert([...CARD_COPY[id].flavor].length <= 15, `${id} flavor`);
  }
});
check('火力干扰只影响已见敌人，重复指令不会无限叠加装填时间', () => {
  for (const side of [0, 1]) {
    const s = arena(),
      x = (n) => (side === 0 ? n : W - n);
    v13MovementSolo(s, side, 'infantry', x(900));
    const seen = v13MovementSolo(s, 1 - side, 'infantry', x(1200));
    const hidden = v13MovementSolo(s, 1 - side, 'infantry', x(2700));
    seen.cooldown = hidden.cooldown = 0.5;
    seen.secondaryCooldown = hidden.secondaryCooldown = 0.2;
    refreshVision(s);
    assert(s.visible[side].includes(seen.uid));
    assert(!s.visible[side].includes(hidden.uid));
    v15Use(s, 'sabotage', side);
    assert.equal(seen.cooldown, 3);
    assert.equal(seen.secondaryCooldown, 3);
    assert.equal(hidden.cooldown, 0.5);
    assert.equal(hidden.secondaryCooldown, 0.2);
    v15Use(s, 'sabotage', side);
    assert.equal(seen.cooldown, 3);
  }
});
check('电磁指令压制已见空中与制导武器，普通步枪和隐藏目标不受影响', () => {
  const s = arena();
  v13MovementSolo(s, 0, 'infantry', 900);
  const rifle = v13MovementSolo(s, 1, 'infantry', 1150);
  spawnUnit(s, 1, 'helicopter', 1200);
  const helicopter = s.units.at(-1);
  spawnUnit(s, 1, 'helicopter', 2800);
  const hidden = s.units.at(-1);
  for (const u of [rifle, helicopter, hidden]) u.cooldown = 0.5;
  refreshVision(s);
  assert(s.visible[0].includes(helicopter.uid));
  assert(!s.visible[0].includes(hidden.uid));
  v15Use(s, 'emp');
  assert.equal(helicopter.cooldown, 4);
  assert.equal(rifle.cooldown, 0.5);
  assert.equal(hidden.cooldown, 0.5);
  assert.equal(s.players[1].jam, 14);
});
check('装甲抢修只救一辆重伤地面装甲，不能给整支车队免费回血', () => {
  const s = arena();
  for (const x of [900, 1200]) spawnUnit(s, 0, 'tank', x);
  const [first, second] = s.units;
  first.hp = first.maxHp - 200;
  second.hp = second.maxHp - 80;
  const otherHp = second.hp;
  spawnUnit(s, 0, 'helicopter', 1300);
  const air = s.units.at(-1);
  air.hp = 10;
  v15Use(s, 'repair');
  assert.equal(first.hp, first.maxHp - 170);
  assert.equal(first.repairTime, 6);
  assert.equal(second.hp, otherHp);
  assert.equal(second.repairTime, 0);
  assert.equal(air.hp, 10);
});
check('战地急救优先救伤员，只治疗附近步兵且不复活阵亡者', () => {
  const s = arena();
  const patient = v13MovementSolo(s, 0, 'infantry', 900);
  Object.assign(patient, {
    wounded: true,
    woundedTime: 2,
    bleedOut: 20,
    hp: 2,
    rescueProgress: 0,
  });
  const nearby = v13MovementSolo(s, 0, 'infantry', 960);
  nearby.hp = 5;
  const distant = v13MovementSolo(s, 0, 'infantry', 1500);
  distant.hp = 5;
  const dead = v13MovementSolo(s, 0, 'infantry', 980);
  dead.hp = 0;
  v15Use(s, 'medevac');
  assert.equal(nearby.hp, 23);
  assert.equal(distant.hp, 5);
  assert.equal(dead.hp, 0);
  tick(s, 1 / 60);
  assert(!patient.wounded);
  assert(patient.hp >= patient.maxHp * 0.4);
});
check('固守只保护静止步兵，移动立刻失去三成减伤且不会强制驻守', () => {
  const loss = (fortified, moving) => {
    const s = arena(),
      u = v13MovementSolo(s, 0, 'infantry', 900);
    u.pose = 'idle';
    u.hp = u.maxHp = 1000;
    u.moving = moving;
    if (fortified) v15Use(s, 'fortify');
    assert.equal(s.players[0].order, 'advance');
    explode(s, 900, 374, 20, 10, 1);
    return 1000 - u.hp;
  };
  const normal = loss(false, false);
  assert(Math.abs(loss(true, false) / normal - 0.7) < 0.001);
  assert(Math.abs(loss(true, true) / normal - 1) < 0.001);
});
check('AI 会在受压与装甲受损时购买救场指令，而不是一直堆新单位', () => {
  for (const order of ['rally', 'repair', 'morale']) {
    const s = arena();
    spawnUnit(s, 1, 'infantry', 2100);
    spawnUnit(s, 1, 'infantry', 2220);
    spawnUnit(s, 0, 'infantry', 1800);
    if (order === 'rally')
      for (const u of s.units.filter((u) => u.side === 1)) {
        u.personalMorale = 38;
        u.suppression = 70;
      }
    if (order === 'repair') {
      spawnUnit(s, 1, 'tank', 2300);
      s.units.at(-1).hp = 250;
    }
    refreshVision(s);
    v12AIHand(s, [order, 'infantry'], CARDS[order].cost);
    s.aiIn = 0;
    tick(s, 0.01);
    assert(!s.players[1].hand.some((h) => h.id === order), `${order} used`);
    assert(
      s.players[1].hand.some((h) => h.id === 'infantry'),
      `${order} before more rifles`,
    );
  }
});

// v15 vehicle behavior: isolated from deck choice, AI, and infantry balance values.
const { CARD_COPY: v15Copy } = await import('../game/card-copy.ts');
const { armorHalf: v15Half } = await import('../game/vehicle-geometry.ts');
const v15VehicleIds = [
  'pickup',
  'tow_ifv',
  'mortar_carrier',
  'recovery_vehicle',
  'command_vehicle',
  'mine_clearer',
];
function v15Arena() {
  const s = createGame(915);
  startGame(s);
  s.aiIn = 1e6;
  s.units = [];
  s.walls = [];
  s.scenery = [];
  s.terrain.fill(374);
  s.original.fill(374);
  s.players.forEach((p) => {
    p.order = 'hold';
    p.recon = 0;
  });
  return s;
}
function v15Unit(s, side, id, x, ready = false) {
  const before = s.units.length;
  spawnUnit(s, side, id, x);
  const u = s.units[before];
  s.units.splice(before + 1);
  u.x = x;
  u.y = CARDS[id].air ? (CARDS[id].altitude ?? AIR_ALTITUDE) : 374;
  u.pace = 0;
  u.decisionIn = 1000;
  u.personalMorale = 85;
  u.cooldown = u.secondaryCooldown = ready ? 0 : 1000;
  return u;
}
check('六种新车合法入组，皮卡四张其余两张，卡面短句不溢出', () => {
  for (const id of v15VehicleIds) {
    const c = CARDS[id];
    assert(c.vehicle && c.type === 'unit' && !c.members && !c.air);
    assert.equal(copyLimit(id), id === 'pickup' ? 4 : 2);
    assert([...v15Copy[id].rule].length <= 15);
    assert([...v15Copy[id].flavor].length <= 15);
    const s = v15Arena(),
      p = s.players[0];
    p.energy = 10;
    const card = hand(s, id),
      energy = p.energy;
    assert.equal(playCard(s, 0, card.uid, 3200).ok, true);
    assert.equal(p.energy, energy - c.cost);
    const deployed = s.units.filter((u) => u.id === id);
    assert.equal(deployed.length, 1);
    assert(deployed[0].x < 200, 'new vehicles enter from their own base');
  }
  assert.equal(CARDS.pickup.cost, 2);
  assert.equal(CARDS.pickup.armored, false);
  assert.equal(CARDS.tow_ifv.cost, 5);
});
check('皮卡优先步兵、只有机枪且不能对空，弹体接触按车身计算', () => {
  const s = v15Arena(),
    truck = v15Unit(s, 0, 'pickup', 900, true);
  const armor = v15Unit(s, 1, 'tank', 1120);
  const foot = v15Unit(s, 1, 'infantry', 1220);
  tick(s, 1 / 60);
  const shot = s.projectiles.find((p) => p.sourceUid === truck.uid);
  assert.equal(shot?.targetUid, foot.uid);
  assert.equal(shot.ammunition, 'machinegun');
  assert(shot.armorMultiplier < 0.2);
  assert.equal(armor.hp, armor.maxHp);
  const air = v15Arena(),
    lone = v15Unit(air, 0, 'pickup', 900, true);
  v15Unit(air, 1, 'helicopter', 1180);
  advance(air, 0.5);
  assert.equal(lone.shots, 0);
  const impact = v15Arena(),
    body = v15Unit(impact, 1, 'pickup', 1000);
  const hp = body.hp;
  explode(impact, body.x + v15Half(body.id) - 4, body.y - 22, 8, 30, 0);
  assert(
    body.hp < hp - 15,
    'small blast at hull edge must connect to a wide vehicle body',
  );
});
check('陶式导弹猎甲与独立机枪同时开火，近敌不压住远方合法装甲目标', () => {
  for (const side of [0, 1]) {
    const s = v15Arena(),
      dir = side ? -1 : 1;
    const tow = v15Unit(s, side, 'tow_ifv', 1700, true);
    const close = v15Unit(s, 1 - side, 'infantry', 1700 + dir * 80);
    const armor = v15Unit(s, 1 - side, 'tank', 1700 + dir * 450);
    tick(s, 1 / 60);
    const rocket = s.projectiles.find(
      (p) => p.sourceUid === tow.uid && p.ammunition === 'rocket',
    );
    assert(rocket?.guided && rocket.targetUid === armor.uid);
    assert.equal(
      tow.secondaryShots,
      1,
      'near infantry still receives coax fire',
    );
    assert(
      close.hp < close.maxHp || s.projectiles.some((p) => p.weapon === 'coax'),
    );
    const primary = tow.shots;
    advance(s, 0.4);
    assert.equal(tow.shots, primary, 'main missile remains in reload');
    assert(tow.secondaryShots >= 2, 'machine gun reload is independent');
  }
});
check('陶式死角内不发导弹，单发导弹实际重创重甲且无法对空', () => {
  const s = v15Arena(),
    tow = v15Unit(s, 0, 'tow_ifv', 1000, true);
  v15Unit(s, 1, 'tank', 1070);
  advance(s, 0.25);
  assert.equal(tow.shots, 0);
  s.units[1].x = 1430;
  tick(s, 1 / 60);
  const armor = s.units[1],
    hp = armor.hp;
  advance(s, 1.5);
  assert(armor.hp < hp - 150, `guided antiarmor hit: ${hp} -> ${armor.hp}`);
  const air = v15Arena(),
    gun = v15Unit(air, 0, 'tow_ifv', 1000, true);
  v15Unit(air, 1, 'helicopter', 1230);
  advance(air, 0.5);
  assert.equal(gun.shots + gun.secondaryShots, 0);
});
check('自行迫炮持续发射真实曲射弹，炮口前房屋不拦截上升段', () => {
  const s = v15Arena(),
    gun = v15Unit(s, 0, 'mortar_carrier', 1000, true);
  const foe = v15Unit(s, 1, 'tank', 1380);
  foe.hp = foe.maxHp = 10000;
  // Friendly observer gives a real team sight line around the nearby house.
  v15Unit(s, 0, 'scouts', 1260);
  s.scenery = [
    {
      id: 915,
      kind: 'house',
      x: 1120,
      y: 374,
      seed: 1,
      parts: [
        {
          id: 0,
          kind: 'wall',
          x: 1090,
          y: 215,
          w: 45,
          h: 159,
          hp: 1000,
          maxHp: 1000,
          brokenAt: -1,
        },
      ],
    },
  ];
  tick(s, 1 / 60);
  const shell = s.projectiles.find((p) => p.sourceUid === gun.uid);
  assert(shell?.shell && shell.ammunition === 'mortar' && shell.arc >= 170);
  assert.equal(
    gun.pose,
    'idle',
    'vehicle does not inherit an infantry crouch damage bonus',
  );
  assert.equal(projectileIntercept(s, shell, 1080, 300, 1120, 260), null);
  assert(projectileIntercept(s, { ...shell, life: 0.2 }, 1080, 260, 1120, 300));
  // Observe three launches plus the third shell's travel time at the current reload rate.
  advance(s, CARDS.mortar_carrier.rate * 2 + 2.5);
  assert(gun.shots >= 3, 'mobile mortar continues its firing cycle');
  assert(foe.hp < foe.maxHp, 'shells cause real damage after travelling');
});
check('自行迫炮两侧都远离近敌后撤，移动朝向一致，hold不自行转移', () => {
  for (const side of [0, 1]) {
    const s = v15Arena(),
      dir = side ? -1 : 1;
    const gun = v15Unit(s, side, 'mortar_carrier', 1700, true);
    gun.pace = 1;
    s.players[side].order = 'advance';
    v15Unit(s, 1 - side, 'tank', 1700 + dir * 100);
    advance(s, 0.4);
    assert((gun.x - 1700) * dir < -10);
    assert.equal(gun.facing, -dir);
    assert(gun.moving && Number.isFinite(gun.hullAngle));
    assert.equal(gun.shots, 0);
    s.players[side].order = 'hold';
    const x = gun.x;
    advance(s, 0.3);
    assert.equal(gun.x, x);
    assert.equal(gun.moving, false);
  }
});
check('抢修车停车处理最危急友军装甲，每次只修一辆且不越过上限', () => {
  const s = v15Arena(),
    repair = v15Unit(s, 0, 'recovery_vehicle', 1000, true);
  repair.pace = 1;
  s.players[0].order = 'advance';
  const a = v15Unit(s, 0, 'tank', 1120),
    b = v15Unit(s, 0, 'ifv', 920);
  a.hp = 100;
  b.hp = 300;
  tick(s, 1 / 60);
  assert.equal(a.hp, 109);
  assert.equal(b.hp, 300);
  assert.equal(repair.x, 1000);
  assert.equal(repair.moving, false);
  assert.equal(repair.shots, 0);
  a.hp = a.maxHp - 3;
  b.hp = b.maxHp;
  repair.supportCooldown = 0;
  a.recoverySupportUntil = 0;
  tick(s, 1 / 60);
  assert.equal(a.hp, a.maxHp);
});
check('抢修不治疗自己、另一抢修车、飞机、皮卡、死人、敌军或远处车辆', () => {
  const s = v15Arena(),
    repair = v15Unit(s, 0, 'recovery_vehicle', 1000);
  repair.hp = 100;
  const other = v15Unit(s, 0, 'recovery_vehicle', 1050);
  other.hp = 100;
  const air = v15Unit(s, 0, 'helicopter', 1040);
  air.hp = 100;
  const pickup = v15Unit(s, 0, 'pickup', 990);
  pickup.hp = 50;
  const dead = v15Unit(s, 0, 'tank', 980);
  dead.hp = 0;
  const foe = v15Unit(s, 1, 'tank', 1100);
  foe.hp = 100;
  const far = v15Unit(s, 0, 'tank', 1400);
  far.hp = 100;
  advance(s, 2);
  assert.equal(repair.hp, 100);
  assert.equal(other.hp, 100);
  assert.equal(air.hp, 100);
  assert.equal(pickup.hp, 50);
  assert.equal(dead.hp, 0);
  assert.equal(foe.hp, 100);
  assert.equal(far.hp, 100);
  assert.equal(repair.shots, 0);
});
check('多辆抢修车不能叠加同一目标的维修频率', () => {
  function run(duplicates) {
    const s = v15Arena(),
      tank = v15Unit(s, 0, 'tank', 1100);
    tank.hp = 100;
    v15Unit(s, 0, 'recovery_vehicle', 1000);
    if (duplicates)
      v15Unit(s, 0, 'recovery_vehicle', 1050).supportCooldown = 0.23;
    advance(s, 3);
    return tank.hp;
  }
  const one = run(false),
    many = run(true);
  assert.equal(many, one);
  assert(one > 145 && one <= 154, `bounded repair over 3s: ${one}`);
});
check('指挥车部署从自己的真实牌堆抽牌，驻场与满手牌不会凭空复制卡', () => {
  for (const side of [0, 1]) {
    const s = v15Arena(),
      p = s.players[side],
      enemy = s.players[1 - side];
    p.energy = 10;
    p.hand = [{ uid: ++s.uid, id: 'command_vehicle' }];
    p.deck = ['militia', 'infantry'];
    p.discard = [];
    const otherDeck = [...enemy.deck],
      card = p.hand[0];
    assert(playCard(s, side, card.uid, side ? 3400 : 200).ok);
    assert.equal(p.energy, 5);
    assert.equal(p.hand.length, 1);
    assert.equal(p.deck.length, 1);
    assert.deepEqual(enemy.deck, otherDeck);
    advance(s, 3);
    assert.equal(p.deck.length, 1);
    assert.equal(p.hand.length, 1);
  }
  const s = v15Arena(),
    p = s.players[0];
  p.energy = 10;
  p.hand = Array.from({ length: MAX_HAND }, (_, i) => ({
    uid: ++s.uid,
    id: i ? 'militia' : 'command_vehicle',
  }));
  const deck = p.deck.length;
  assert(playCard(s, 0, p.hand[0].uid, 200).ok);
  assert.equal(p.hand.length, MAX_HAND);
  assert.equal(p.deck.length, deck - 1);
});
check('指挥车只支援局部存活友军步兵，士气不降档且多源错峰也不叠加', () => {
  function run(count) {
    const s = v15Arena(),
      near = v15Unit(s, 0, 'infantry', 1120);
    const far = v15Unit(s, 0, 'infantry', 1450),
      enemy = v15Unit(s, 1, 'infantry', 1150);
    const vehicle = v15Unit(s, 0, 'pickup', 1140),
      wounded = v15Unit(s, 0, 'infantry', 1160);
    const proud = v15Unit(s, 0, 'infantry', 1130);
    proud.personalMorale = 94;
    wounded.wounded = true;
    wounded.bleedOut = 20;
    [near, far, enemy, vehicle, wounded].forEach((u) => {
      u.personalMorale = 60;
      u.suppression = 80;
      u.cooldown = 10;
    });
    if (count) v15Unit(s, 0, 'command_vehicle', 1000);
    if (count > 1)
      v15Unit(s, 0, 'command_vehicle', 1010).supportCooldown = 0.45;
    advance(s, 2.2);
    return { near, far, enemy, vehicle, wounded, proud };
  }
  const none = run(0),
    one = run(1),
    two = run(2);
  assert(one.near.personalMorale > none.near.personalMorale);
  assert(one.near.suppression < none.near.suppression);
  assert(one.near.cooldown < none.near.cooldown);
  for (const field of ['personalMorale', 'suppression', 'cooldown']) {
    assert.equal(two.near[field], one.near[field]);
    for (const id of ['far', 'enemy', 'vehicle', 'wounded'])
      assert.equal(one[id][field], none[id][field]);
  }
  assert.equal(one.proud.personalMorale, 94);
  const s = v15Arena(),
    foot = v15Unit(s, 0, 'infantry', 1100);
  foot.personalMorale = 84;
  v15Unit(s, 0, 'command_vehicle', 1000);
  tick(s, 1 / 60);
  assert.equal(foot.personalMorale, 85);
});
check('扫雷在接触判定前生效，密集雷阵处理间隔停车，远处隐藏地雷保留', () => {
  for (const side of [0, 1]) {
    const s = v15Arena(),
      dir = side ? -1 : 1;
    const clear = v15Unit(s, side, 'mine_clearer', 1700);
    clear.pace = 1;
    s.players[side].order = 'advance';
    const mines = [90, 95, 100].map((dx) => ({
      uid: ++s.uid,
      side: 1 - side,
      x: 1700 + dir * dx,
      armAt: 0,
    }));
    const far = { uid: ++s.uid, side: 1 - side, x: 1700 + dir * 500, armAt: 0 };
    const own = { uid: ++s.uid, side, x: 1700 + dir * 80, armAt: 0 };
    s.mines = [...mines, far, own];
    advance(s, 0.4);
    assert.equal(clear.x, 1700);
    assert.equal(clear.hp, clear.maxHp);
    assert.equal(s.mines.length, 4, 'one mine per service interval');
    advance(s, 0.8);
    assert.equal(
      clear.x,
      1700,
      'does not roll onto another mine between operations',
    );
    advance(s, 0.2);
    assert(s.mines.includes(far) && s.mines.includes(own));
    assert(s.mines.every((m) => !mines.includes(m)));
    assert.equal(s.explosions, 0);
    assert.equal(clear.hp, clear.maxHp);
    assert.equal(Object.hasOwn(snapshot(s, side), 'mines'), false);
  }
  const s = v15Arena(),
    clear = v15Unit(s, 0, 'mine_clearer', 1000);
  s.mines = [{ uid: ++s.uid, side: 1, x: 1000, armAt: 0 }];
  tick(s, 1 / 60);
  assert.equal(clear.hp, clear.maxHp);
  assert.equal(s.mines.length, 0);
  const ordinary = v15Arena(),
    truck = v15Unit(ordinary, 0, 'pickup', 1000);
  ordinary.mines = [{ uid: ++ordinary.uid, side: 1, x: 1000, armAt: 0 }];
  tick(ordinary, 1 / 60);
  assert(truck.hp <= 0, 'unarmored technical still has vehicle mine contact');
});
check('扫雷车停车分次破墙，已毁扫雷车不会继续清雷', () => {
  const s = v15Arena(),
    clear = v15Unit(s, 0, 'mine_clearer', 1000);
  clear.pace = 1;
  s.players[0].order = 'advance';
  const wall = {
    uid: ++s.uid,
    x: 1020,
    hp: 250,
    maxHp: 250,
    width: 24,
    height: 38,
  };
  s.walls = [wall];
  tick(s, 1 / 60);
  assert.equal(wall.hp, 160);
  assert.equal(clear.x, 1000);
  advance(s, 0.4);
  assert.equal(wall.hp, 160);
  assert.equal(clear.x, 1000);
  advance(s, 0.9);
  assert.equal(wall.hp, 0);
  const dead = v15Arena(),
    wreck = v15Unit(dead, 0, 'mine_clearer', 1000);
  wreck.hp = 0;
  const mine = { uid: ++dead.uid, side: 1, x: 1090, armAt: 0 };
  dead.mines = [mine];
  advance(dead, 1);
  assert(dead.mines.includes(mine));
});

check('两费RPG混编班能在皮卡射程外造成实际击毁，低费反制不依赖隐藏加成', () => {
  const s = v15Arena();
  assert.equal(CARDS.antiarmor.cost, 2);
  spawnUnit(s, 0, 'antiarmor', 1000);
  const squad = [...s.units];
  for (const u of squad) {
    u.x = 1000;
    u.y = 374;
    u.pace = 0;
    u.decisionIn = 1000;
    u.cooldown = 0;
    u.personalMorale = 85;
    u.shots = 0;
  }
  const truck = v15Unit(s, 1, 'pickup', 1520, true);
  advance(s, 1.2);
  assert(
    truck.hp < truck.maxHp - 30,
    `first RPG hit must threaten pickup: ${truck.hp}`,
  );
  assert(squad.find((u) => u.member === 0).shots >= 1);
  assert(
    squad.filter((u) => u.member > 0).every((u) => u.shots === 0),
    'rifle escorts remain out of range',
  );
  // A 150 HP technical needs repeated real RPG impacts, now separated by full reloads.
  const operator = squad.find((u) => u.member === 0);
  advance(s, weaponCard(operator).rate * 3 + 2);
  assert(
    truck.hp <= 0,
    'one deployed RPG squad has enough real firepower to destroy a technical',
  );
  assert(squad.every((u) => u.hp > 0));
});

check('低费观察兵保持远距视线，不会为打出微弱自卫火力冲向敌人', () => {
  for (const side of [0, 1]) {
    const s = arena(),
      x = (n) => (side === 0 ? n : W - n),
      dir = side === 0 ? 1 : -1;
    const scout = v13MovementSolo(s, side, 'scouts', x(700));
    const foe = v13MovementSolo(s, 1 - side, 'infantry', x(1220));
    foe.cooldown = 100;
    setOrder(s, 1 - side, 'hold');
    refreshVision(s);
    assert(s.visible[side].includes(foe.uid));
    advance(s, 2);
    assert(Math.abs(scout.x - x(700)) < 1);
    assert.equal(scout.shots, 0);
    assert.equal(scout.pose, 'prone');
    setOrder(s, side, 'rush');
    advance(s, 0.5);
    assert.equal(scout.pose, 'prone', 'rush cannot break the ten-second stance commitment');
    assert((scout.x - x(700)) * dir > 0, 'scout still moves toward the ordered direction');
  }
});

console.log(`${count} gameplay checks passed`);
if (failures.length)
  throw new Error(`${failures.length} failures: ${failures.join('; ')}`);
