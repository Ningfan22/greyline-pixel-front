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
  assert(ground(s, 720) <= 438);
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
    assert.notEqual(s.units[0].pose, 'climb');
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
      s.terrain.every((y, x) => y >= s.original[x] && y <= s.original[x] + 64),
    );
    console.log(
      `  seed ${seed}: ${s.result}, ${s.time.toFixed(1)}s, ${Math.round(s.players[0].hp)}:${Math.round(s.players[1].hp)}`,
    );
  }
});
console.log(`${count} gameplay checks passed`);
