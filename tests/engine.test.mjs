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
    c = s.players[0].hand.find((c) => c.id === 'infantry');
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
    c = p.hand[0],
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
      crater(s, 900, 25, 18);
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
              : c.id === 'artillery'
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
