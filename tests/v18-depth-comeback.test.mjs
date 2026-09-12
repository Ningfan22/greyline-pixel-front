import assert from 'node:assert/strict';
import {
  createGame,
  startGame,
  spawnUnit,
  tick,
  playCard,
  CARDS,
  W,
  MAX_HAND,
  refreshVision,
  visibleToSide,
  validDeck,
} from '../game/engine.ts';
import {
  aimProjectileDepth,
  depthHit,
} from '../game/projectile-depth.ts';
import { comebackScore } from '../game/comeback.ts';
import { setSquadOrder } from '../game/squad-orders.ts';
import { copyLimit } from '../game/cards.ts';
import { CARD_COPY } from '../game/card-copy.ts';
import { DECK_PRESETS } from '../game/deck-presets.ts';
const DT = 1 / 60,
  results = [],
  failures = [];
function check(name, fn) {
  try {
    const value = fn() ?? {};
    results.push({ name, ...value });
    console.log('PASS', name, JSON.stringify(value));
  } catch (e) {
    failures.push(name);
    console.error('FAIL', name, e.stack);
  }
}
function arena(seed = 18) {
  const s = createGame(seed);
  startGame(s);
  s.aiIn = 1e6;
  s.terrain.fill(374);
  s.original.fill(374);
  s.scenery = [];
  s.walls = [];
  for (const p of s.players) {
    p.order = 'hold';
    p.energy = 10;
  }
  return s;
}
function run(s, seconds, fn = () => {}) {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    tick(s, DT);
    fn();
  }
}
function spawn(s, side, id, x) {
  const n = s.units.length;
  spawnUnit(s, side, id, x);
  const us = s.units.slice(n);
  for (const u of us) {
    u.cooldown = u.secondaryCooldown = 1e6;
    u.pace = 0;
  }
  return us;
}
function one(s, side, id, x) {
  const us = spawn(s, side, id, x);
  s.units = s.units.filter((u) => !us.includes(u) || u === us[0]);
  const u = us[0];
  u.x = x;
  u.lane = 0;
  u.pose = 'idle';
  return u;
}
function token(s, side, id) {
  const t = { id, uid: ++s.uid };
  s.players[side].hand.push(t);
  return t;
}
function play(s, side, id) {
  const t = token(s, side, id),
    p = s.players[side],
    before = p.energy;
  const r = playCard(s, side, t.uid);
  assert.ok(r.ok, r.message);
  assert.ok(Math.abs(p.energy - (before - CARDS[id].cost)) < 1e-8);
  return t;
}
function bullet(s, side, source, target, extra = {}) {
  return {
    uid: ++s.uid,
    x: source.x,
    y: 338,
    startX: source.x,
    startY: 338,
    tx: target.x,
    ty: 338,
    side,
    sourceUid: source.uid,
    targetUid: target.uid,
    base: null,
    damage: 10,
    radius: 0,
    shell: false,
    ammunition: 'rifle',
    life: 0.2,
    total: 0.2,
    ...extra,
  };
}
for (const side of [0, 1]) {
  const dir = side ? -1 : 1,
    x = (n) => (side ? W - n : n);
  check(
    `side${side}: bullet misses a coincident silhouette in another lane, but same-lane ray really damages`,
    () => {
      const damage = [];
      for (const lane of [0, 18]) {
        const s = arena(),
          a = one(s, side, 'infantry', x(1000)),
          b = one(s, 1 - side, 'infantry', x(1150));
        b.lane = lane;
        const hp = b.hp;
        s.projectiles.push(
          bullet(s, side, a, b, { startLane: 0, targetLane: 0 }),
        );
        run(s, 0.3);
        damage.push(hp - b.hp);
      }
      assert.ok(damage[0] > 0);
      assert.equal(damage[1], 0);
      return { damage };
    },
  );
  check(
    `side${side}: launched depth aim remains fixed when target changes lane`,
    () => {
      const s = arena(),
        a = one(s, side, 'sniper', x(1000)),
        b = one(s, 1 - side, 'infantry', x(1250));
      const p = bullet(s, side, a, b);
      aimProjectileDepth(s, p);
      const fixed = p.targetLane,
        hp = b.hp;
      b.lane = 18;
      aimProjectileDepth(s, p);
      assert.equal(p.targetLane, fixed);
      s.projectiles.push(p);
      run(s, 0.3);
      assert.equal(b.hp, hp);
      assert.equal(p.targetLane, fixed);
      return { fixed };
    },
  );
  check(
    `side${side}: precise close shots exceed fixed quarter chance and prone narrows depth silhouette`,
    () => {
      const s = arena(),
        a = one(s, side, 'sniper', x(1000)),
        b = one(s, 1 - side, 'infantry', x(1080));
      let hits = 0,
        standing = 0,
        prone = 0;
      for (let i = 0; i < 200; i++) {
        const p = bullet(s, side, a, b);
        aimProjectileDepth(s, p);
        hits += Number(depthHit(p, b));
        const q = { ...p, startLane: 0, targetLane: -8 + (16 * i) / 199 };
        b.pose = 'idle';
        standing += Number(depthHit(q, b));
        b.pose = 'prone';
        prone += Number(depthHit(q, b));
      }
      assert.ok(hits > 180);
      assert.ok(prone < standing * 0.75);
      return { precise: hits, standing, prone };
    },
  );
  check(
    `side${side}: solid earth wall stops actual near-miss suppression and open near miss suppresses only once`,
    () => {
      const deltas = [];
      for (const wall of [false, true]) {
        const s = arena(),
          a = one(s, side, 'infantry', x(1000)),
          b = one(s, 1 - side, 'infantry', x(1110)),
          far = one(s, 1 - side, 'infantry', x(1300));
        if (wall) {
          const wx = x(1100);
          for (let at = wx - 6; at <= wx + 6; at++) s.terrain[at] = 309;
        }
        const p = bullet(s, side, a, far, {
          y: 344,
          startY: 344,
          ty: 344,
          startLane: 0,
          targetLane: 0,
          life: 0.5,
          total: 0.5,
        });
        s.projectiles.push(p);
        let peak = 0;
        run(s, 0.6, () => {
          peak = Math.max(peak, b.suppression);
        });
        deltas.push(peak);
        if (wall)
          assert.equal(
            b.lastThreat,
            undefined,
            'no hidden shooter threat leaks through wall',
          );
      }
      assert.ok(deltas[0] > 0);
      assert.ok(deltas[0] <= 2);
      assert.equal(deltas[1], 0);
      return { peakSuppression: deltas };
    },
  );
  check(
    `side${side}: gas has public 3s warning and exactly eight 2.6 damage pulses to both sides`,
    () => {
      const s = arena(),
        a = one(s, side, 'infantry', x(900)),
        b = one(s, 1 - side, 'infantry', x(2400));
      const hp = [a.hp, b.hp],
        changes = [];
      play(s, side, 'toxic_cloud');
      assert.equal(s.comeback.gas.start, 3);
      assert.equal(s.comeback.gas.end, 11);
      let last = a.hp;
      run(s, 11.1, () => {
        if (a.hp !== last) {
          changes.push({ at: s.time, damage: last - a.hp });
          last = a.hp;
        }
        if (s.time <= 3 + 1e-6) assert.equal(a.hp, hp[0]);
      });
      assert.equal(changes.length, 8);
      for (let i = 0; i < 8; i++) {
        assert.ok(Math.abs(changes[i].at - (4 + i)) < DT + 1e-6);
        assert.ok(Math.abs(changes[i].damage - 2.6) < 1e-7);
      }
      assert.ok(Math.abs(hp[0] - a.hp - 20.8) < 1e-7);
      assert.ok(Math.abs(hp[1] - b.hp - 20.8) < 1e-7);
      assert.equal(s.comeback.gas, undefined);
      return { pulses: changes.length, damage: hp[0] - a.hp };
    },
  );
  check(
    `side${side}: active gas cannot charge or discard another token on either side`,
    () => {
      const s = arena();
      play(s, side, 'toxic_cloud');
      for (const other of [side, 1 - side]) {
        const t = token(s, other, 'toxic_cloud'),
          p = s.players[other],
          before = [p.energy, p.hand.length, p.discard.length];
        assert.equal(playCard(s, other, t.uid).ok, false);
        assert.deepEqual([p.energy, p.hand.length, p.discard.length], before);
        assert.ok(p.hand.includes(t));
      }
      return {};
    },
  );
  check(
    `side${side}: reserve deploys two real squads at 6s/8s and draws once at most`,
    () => {
      for (const full of [false, true]) {
        const s = arena();
        play(s, side, 'reserve_mobilization');
        const p = s.players[side];
        p.hand = Array.from({ length: full ? MAX_HAND : 2 }, () => ({
          uid: ++s.uid,
          id: 'infantry',
        }));
        p.deck = Array.from({ length: 8 }, () => ({
          uid: ++s.uid,
          id: 'militia',
        }));
        const hand = p.hand.length;
        run(s, 5.9);
        assert.equal(s.units.length, 0);
        run(s, 0.2);
        assert.equal(s.units.length, CARDS.militia.members);
        assert.equal(p.hand.length, hand);
        run(s, 2);
        assert.equal(s.units.length, 2 * CARDS.militia.members);
        assert.equal(new Set(s.units.map((u) => u.squad)).size, 2);
        assert.ok(s.units.every((u) => u.side === side));
        assert.equal(p.hand.length, Math.min(MAX_HAND, hand + 1));
        assert.equal(p.deck.length, 8 - Number(!full));
        run(s, 3);
        assert.equal(s.units.length, 2 * CARDS.militia.members);
        assert.equal(p.hand.length, Math.min(MAX_HAND, hand + 1));
        assert.equal(s.comeback.reserves.length, 0);
      }
      return { arrival: [6, 8], squads: 2 };
    },
  );
  check(
    `side${side}: withdrawal walks 240px and heals only after arrival, once per member`,
    () => {
      const s = arena(),
        us = spawn(s, side, 'infantry', x(1500));
      for (const u of us) {
        u.pace = 1;
        u.hp -= 15;
        u.personalMorale = 50;
      }
      const initial = us.map((u) => ({
        x: u.x,
        hp: u.hp,
        morale: u.personalMorale,
      }));
      play(s, side, 'smoke_withdrawal');
      assert.deepEqual(
        us.map((u) => u.x),
        initial.map((u) => u.x),
      );
      const healed = new Set();
      let maxStep = 0;
      run(s, 19, () => {
        for (let i = 0; i < us.length; i++) {
          const u = us[i],
            before = initial[i];
          maxStep = Math.max(
            maxStep,
            Math.abs(u.x - (before.last ?? before.x)),
          );
          before.last = u.x;
          if (!s.comeback.withdrawing.some((v) => v.uid === u.uid)) {
            assert.ok(Math.abs(u.x - u.squadOrderX) <= 12);
            assert.ok(Math.abs(u.hp - before.hp - 8) < 1e-7);
            if (!healed.has(u.uid))
              assert.ok(
                u.personalMorale >= Math.min(100, before.morale + 20) &&
                  u.personalMorale <= Math.min(100, before.morale + 21.5),
                `arrival morale before=${before.morale} after=${u.personalMorale}`,
              );
            healed.add(u.uid);
          } else assert.equal(u.hp, before.hp);
          before.morale = u.personalMorale;
        }
      });
      assert.equal(healed.size, us.length);
      assert.ok(maxStep < 2);
      for (let i = 0; i < us.length; i++) {
        assert.ok((initial[i].x - us[i].x) * dir >= 228);
        assert.equal(us[i].squadOrder, 'watch');
      }
      const hp = us.map((u) => u.hp);
      run(s, 3);
      assert.deepEqual(
        us.map((u) => u.hp),
        hp,
      );
      return { healed: healed.size, maxStep };
    },
  );
  check(
    `side${side}: attack cancels withdrawal recovery before arrival`,
    () => {
      const s = arena(),
        us = spawn(s, side, 'infantry', x(1500));
      for (const u of us) {
        u.pace = 1;
        u.hp -= 15;
      }
      play(s, side, 'smoke_withdrawal');
      run(s, 0.2);
      const hp = us.map((u) => u.hp);
      assert.ok(s.comeback.withdrawing.length > 0);
      setSquadOrder(s, side, us[0].squad, 'attack');
      run(s, 2);
      assert.equal(s.comeback.withdrawing.length, 0);
      assert.deepEqual(
        us.map((u) => u.hp),
        hp,
      );
      return {};
    },
  );
  check(
    `side${side}: gas AI excludes HQ immunity and rejects sacrificing wounded allies`,
    () => {
      const s = arena(),
        own = spawn(s, side, 'infantry', x(1100)),
        foes = [
          ...spawn(s, 1 - side, 'infantry', x(1600)),
          ...spawn(s, 1 - side, 'infantry', x(1800)),
        ];
      for (const u of own) u.hp = 8;
      for (const u of foes) u.hp = u.maxHp;
      assert.ok(
        comebackScore(s, side, 'gas', own, foes) < 0,
        'healthy enemies must not justify killing own entire screen',
      );
      for (const u of own) {
        u.wounded = true;
        u.hp = 8;
      }
      assert.ok(
        comebackScore(s, side, 'gas', [], foes) < 0,
        'wounded own troops are still gas casualties',
      );
      for (const u of own) u.x = x(100);
      for (const u of foes) u.x = x(W - 100);
      assert.ok(
        comebackScore(s, side, 'gas', own, foes) < 0,
        'enemy HQ protected troops offer no gas value',
      );
      for (const u of foes) {
        u.x = x(1700);
        u.hp = 8;
      }
      assert.ok(
        comebackScore(s, side, 'gas', own, foes) > 0,
        'favorable observed gas cleanup remains available',
      );
      return {};
    },
  );
  check(
    `side${side}: AI scores only observed foes and hidden troop changes do not affect score`,
    () => {
      const s = arena(),
        own = spawn(s, side, 'infantry', x(500)),
        _seen = spawn(s, 1 - side, 'infantry', x(900)),
        hidden = spawn(s, 1 - side, 'infantry', x(2900));
      refreshVision(s);
      const observed = () =>
        s.units.filter((u) => u.side !== side && visibleToSide(s, side, u));
      assert.ok(observed().length > 0);
      assert.ok(hidden.every((u) => !observed().includes(u)));
      const before = comebackScore(s, side, 'gas', own, observed());
      for (const u of hidden) {
        u.hp = 1;
        u.x = x(3100);
        u.personalMorale = 0;
      }
      refreshVision(s);
      assert.equal(comebackScore(s, side, 'gas', own, observed()), before);
      return { observed: observed().length };
    },
  );
}
check(
  'gas ignores pose, cover and fortification but spares vehicles, air and both HQ margins',
  () => {
    const s = arena(),
      us = [];
    for (const pose of ['idle', 'crouch', 'prone']) {
      const u = one(s, 0, 'infantry', 700 + us.length * 50);
      u.pose = pose;
      u.cover = 0.95;
      u.squadOrder = 'watch';
      u.squadOrderX = u.x;
      us.push(u);
    }
    const armored = one(s, 0, 'tank', 1000),
      air = one(s, 1, 'helicopter', 2600),
      left = one(s, 0, 'infantry', 120),
      right = one(s, 1, 'infantry', W - 120),
      inside = one(s, 1, 'infantry', W - 121);
    s.players[0].fortify = 100;
    const safe = [armored, air, left, right];
    const hp = us.map((u) => u.hp),
      immune = safe.map((u) => u.hp),
      insideHp = inside.hp;
    play(s, 0, 'toxic_cloud');
    run(s, 11.1);
    for (let i = 0; i < us.length; i++)
      assert.ok(Math.abs(hp[i] - us[i].hp - 20.8) < 1e-7);
    assert.deepEqual(
      safe.map((u) => u.hp),
      immune,
    );
    assert.ok(Math.abs(insideHp - inside.hp - 20.8) < 1e-7);
    return { footDamage: 20.8, safe: 4 };
  },
);
check(
  'all card copy fits 15 characters; comeback limits and every preset is legal at 20 cards',
  () => {
    for (const [id, c] of Object.entries(CARD_COPY)) {
      assert.ok(Array.from(c.rule).length <= 15, `${id} rule`);
      assert.ok(Array.from(c.flavor).length <= 15, `${id} flavor`);
    }
    assert.equal(copyLimit('toxic_cloud'), 1);
    assert.equal(copyLimit('reserve_mobilization'), 2);
    for (const p of DECK_PRESETS) {
      assert.equal(p.cards.length, 20, p.id);
      assert.ok(validDeck(p.cards), p.id);
      for (const id of new Set(p.cards))
        assert.ok(p.cards.filter((v) => v === id).length <= copyLimit(id));
    }
    return { cards: Object.keys(CARDS).length, presets: DECK_PRESETS.length };
  },
);
console.log(
  JSON.stringify({
    passed: results.length,
    failed: failures.length,
    failures,
    results,
  }),
);
if (failures.length) process.exitCode = 1;
