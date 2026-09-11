import assert from 'node:assert/strict';
import {
  createGame,
  startGame,
  spawnUnit,
  setOrder,
  tick,
  refreshVision,
  explode,
  unitRange,
  ground,
  craterCover,
  CARDS,
  W,
} from '../game/engine.ts';
import { weaponCard, weaponModel } from '../game/cards.ts';
import { ammunition } from '../game/ballistics.ts';
import { CARD_COPY } from '../game/card-copy.ts';
const v15Metrics = [];
let v15Count = 0;
const v15Check = (name, fn) => {
  const metrics = fn();
  v15Count++;
  v15Metrics.push({ name, ...metrics });
  console.log('PASS', name, JSON.stringify(metrics));
};
const v15Arena = () => {
  const s = createGame(37);
  startGame(s);
  s.aiIn = 1e6;
  s.terrain.fill(374);
  s.original.fill(374);
  s.scenery = [];
  s.walls = [];
  return s;
};
const v15Solo = (s, side, id, x) => {
  const before = s.units.length;
  spawnUnit(s, side, id, x);
  const u = s.units[before];
  s.units = s.units.slice(0, before).concat(u);
  Object.assign(u, {
    x,
    y: 374,
    shots: 0,
    cooldown: 0,
    decisionIn: 1e6,
    pace: 1,
    tactic: 'advance',
  });
  return u;
};
const v15Run = (s, seconds) => {
  for (let i = 0; i < Math.round(seconds * 60); i++) tick(s, 1 / 60);
};
const v15Still = (s) => {
  for (const side of [0, 1]) setOrder(s, side, 'hold');
};
for (const side of [0, 1]) {
  const x = (v) => (side === 0 ? v : W - v),
    enemy = 1 - side,
    dir = side ? -1 : 1;
  v15Check(
    `side${side}: guard changes an actual shot to a visible stationary guard`,
    () => {
      const s = v15Arena(),
        u = v15Solo(s, side, 'infantry', x(600)),
        target = v15Solo(s, enemy, 'medic', x(870)),
        guard = v15Solo(s, enemy, 'armed_police', x(930));
      guard.stillFor = 1;
      target.cooldown = guard.cooldown = 1e6;
      v15Still(s);
      refreshVision(s);
      tick(s, 1 / 60);
      const p = s.projectiles.find((p) => p.sourceUid === u.uid);
      assert.equal(p.targetUid, guard.uid);
      return { target: p.targetUid, guard: guard.uid };
    },
  );
  v15Check(
    `side${side}: hidden guard cannot reveal itself or redirect a close shot`,
    () => {
      const s = v15Arena(),
        u = v15Solo(s, side, 'infantry', x(600)),
        target = v15Solo(s, enemy, 'medic', x(730)),
        guard = v15Solo(s, enemy, 'armed_police', x(800));
      guard.stillFor = 1;
      target.cooldown = guard.cooldown = 1e6;
      s.smokes = [{ x: x(760), life: 20 }];
      v15Still(s);
      refreshVision(s);
      assert(s.visible[side].includes(target.uid));
      assert(!s.visible[side].includes(guard.uid));
      tick(s, 1 / 60);
      assert.equal(
        s.projectiles.find((p) => p.sourceUid === u.uid).targetUid,
        target.uid,
      );
      return { hiddenGuard: true };
    },
  );
  v15Check(
    `side${side}: stationary ambush boosts exactly one shot and movement cancels preparation`,
    () => {
      const damages = [];
      for (const prepared of [false, true]) {
        const s = v15Arena(),
          u = v15Solo(s, side, 'rangers', x(600)),
          v = v15Solo(s, enemy, 'infantry', x(950));
        v.cooldown = 1e6;
        u.ambushFor = prepared ? 2.1 : 0;
        v15Still(s);
        refreshVision(s);
        tick(s, 1 / 60);
        damages.push(s.projectiles.find((p) => p.sourceUid === u.uid).damage);
        assert.equal(u.ambushFor, 0);
        u.cooldown = 0;
        tick(s, 1 / 60);
        assert.equal(
          s.projectiles.filter((p) => p.sourceUid === u.uid).at(-1).damage,
          7,
        );
      }
      assert(Math.abs(damages[1] / damages[0] - 1.8) < 1e-9);
      const s = v15Arena(),
        u = v15Solo(s, side, 'rangers', x(600));
      u.ambushFor = 3;
      u.moving = true;
      tick(s, 1 / 60);
      assert.equal(u.ambushFor, 0);
      return { damages };
    },
  );
  v15Check(
    `side${side}: rapid deployment travels faster then ends on first shot`,
    () => {
      const distances = [];
      for (const enabled of [false, true]) {
        const s = v15Arena(),
          u = v15Solo(s, side, 'paratroopers', x(600));
        if (!enabled) u.rapidUntil = 0;
        v15Run(s, 1);
        distances.push((u.x - x(600)) * dir);
        const v = v15Solo(s, enemy, 'infantry', u.x + dir * 200);
        v.cooldown = 1e6;
        setOrder(s, enemy, 'hold');
        refreshVision(s);
        tick(s, 1 / 60);
        assert.equal(u.rapidUntil, 0);
      }
      assert(Math.abs(distances[1] / distances[0] - 1.8) < 0.01);
      return { distances };
    },
  );
  v15Check(
    `side${side}: close assault smoke is once per squad and never triggers on hidden contact`,
    () => {
      const s = v15Arena(),
        u = v15Solo(s, side, 'assault', x(600)),
        v = v15Solo(s, enemy, 'infantry', x(720));
      v.cooldown = 1e6;
      v.hp = v.maxHp = 10000;
      v15Still(s);
      refreshVision(s);
      tick(s, 1 / 60);
      assert.equal(s.smokes.length, 1);
      assert(u.cooldown < CARDS.assault.rate);
      v15Run(s, 6);
      assert.equal(s.smokes.length, 0);
      assert(u.smokeAssaultSpent);
      const h = v15Arena(),
        a = v15Solo(h, side, 'assault', x(600));
      v15Solo(h, enemy, 'infantry', x(900));
      h.smokes = [{ x: x(760), life: 20 }];
      v15Still(h);
      refreshVision(h);
      tick(h, 1 / 60);
      assert(!a.smokeAssaultSpent);
      return { spent: true, shots: u.shots };
    },
  );
  v15Check(
    `side${side}: mountain range requires settled cover and disappears when moving`,
    () => {
      const s = v15Arena(),
        u = v15Solo(s, side, 'mountain', x(880));
      explode(s, x(900), 366, 68, 0, side);
      u.x = Array.from({ length: 81 }, (_, i) => x(860 + i)).find(
        (px) => craterCover(s, px, x(1250)) > 0.2,
      );
      assert(Number.isFinite(u.x));
      u.y = ground(s, u.x);
      u.lastThreat = { x: x(1250), y: 374, until: 20 };
      u.stillFor = 1;
      const sheltered = unitRange(s, u);
      u.moving = true;
      const moving = unitRange(s, u);
      assert.equal(sheltered, moving * 1.25);
      u.moving = false;
      u.x = x(600);
      assert.equal(unitRange(s, u), moving);
      return { sheltered, moving };
    },
  );
  v15Check(
    `side${side}: same-squad cohesion reduces suppression without reducing HP damage`,
    () => {
      const values = [];
      for (const nearby of [false, true]) {
        const s = v15Arena();
        spawnUnit(s, side, 'infantry', x(700));
        const u = s.units[0];
        u.x = x(700);
        u.y = 374;
        u.pose = 'idle';
        s.units.forEach((v, i) => {
          if (i) v.x = x(700 - i * (nearby ? 38 : 200));
        });
        const hp = u.hp;
        explode(s, u.x, 354, 1, 8, enemy);
        values.push({
          hp: hp - u.hp,
          suppression: u.suppression,
          morale: u.personalMorale,
        });
      }
      assert.equal(values[0].hp, values[1].hp);
      assert(values[1].suppression < values[0].suppression * 0.7);
      return { values };
    },
  );
  v15Check(
    `side${side}: marines rally is once per squad with bounded morale`,
    () => {
      const s = v15Arena();
      spawnUnit(s, side, 'marines', x(700));
      const own = [...s.units];
      spawnUnit(s, side, 'marines', x(700));
      const other = s.units.slice(own.length);
      for (const u of s.units) {
        u.decisionIn = 1e6;
        u.personalMorale = 50;
        u.suppression = 40;
      }
      own[1].hp = own[1].maxHp * 0.4;
      v15Still(s);
      tick(s, 1 / 60);
      assert(own[0].buddyRallied);
      assert.equal(own[0].personalMorale, 60);
      assert.equal(other[0].personalMorale, 50);
      v15Run(s, 5);
      assert.equal(own[0].personalMorale, 60);
      assert(own.every((u) => u.personalMorale <= 92));
      return { first: own[0].personalMorale, other: other[0].personalMorale };
    },
  );
  v15Check(
    `side${side}: engineers remove only nearby hostile mines and medics heal`,
    () => {
      const s = v15Arena(),
        eng = v15Solo(s, side, 'engineers', x(600));
      s.mines = [
        { uid: 900, side: enemy, x: x(620), armAt: 0 },
        { uid: 901, side: enemy, x: x(800), armAt: 0 },
        { uid: 902, side, x: x(620), armAt: 0 },
      ];
      v15Still(s);
      tick(s, 1 / 60);
      assert.deepEqual(
        s.mines.map((m) => m.uid),
        [901, 902],
      );
      v15Solo(s, side, 'medic', x(660));
      eng.hp = 15;
      eng.maxHp = 35;
      v15Run(s, 1);
      assert(eng.hp > 15);
      return { mines: s.mines.length, healed: eng.hp - 15 };
    },
  );
  v15Check(
    `side${side}: RPG mix has one launcher, three rifles and meaningful light-armor hits`,
    () => {
      const measurements = [];
      for (const targetId of ['ifv', 'tank'])
        for (const id of ['antiarmor', 'javelin']) {
          const s = v15Arena();
          spawnUnit(s, side, id, x(600));
          const own = [...s.units];
          own.forEach((u, i) => {
            u.x = x(600 - i * 18);
            u.y = 374;
            u.cooldown = 0;
            u.decisionIn = 1e6;
            u.shots = 0;
          });
          const target = v15Solo(s, enemy, targetId, x(1000));
          target.cooldown = target.secondaryCooldown = 1e6;
          target.pace = 0;
          v15Still(s);
          refreshVision(s);
          v15Run(s, 8);
          const damage = target.maxHp - target.hp;
          measurements.push({
            id,
            targetId,
            damage,
            hp: target.hp,
            shots: own.map((u) => u.shots),
          });
          if (id === 'antiarmor') assert(damage > 60 && target.hp > 0);
        }
      const rpg = measurements.find(
          (m) => m.id === 'antiarmor' && m.targetId === 'tank',
        ),
        jav = measurements.find(
          (m) => m.id === 'javelin' && m.targetId === 'tank',
        );
      assert(jav.damage > rpg.damage * 1.4);
      for (let i = 0; i < 4; i++) {
        const model = weaponModel({ id: 'antiarmor', member: i });
        assert.equal(model, i ? 'infantry' : 'rocket');
        assert.equal(ammunition('antiarmor', i), i ? 'rifle' : 'rocket');
        assert.equal(weaponCard({ id: 'antiarmor', member: i }).members, 1);
      }
      return { measurements };
    },
  );
}
for (const side of [0, 1])
  v15Check(
    `side${side}: close RPG volley uses three real rifle projectiles`,
    () => {
      const s = v15Arena(),
        x = (v) => (side ? W - v : v);
      spawnUnit(s, side, 'antiarmor', x(600));
      const own = [...s.units];
      own.forEach((u, i) =>
        Object.assign(u, {
          x: x(600 - i * 18),
          y: 374,
          cooldown: 0,
          decisionIn: 1e6,
          shots: 0,
        }),
      );
      const target = v15Solo(s, 1 - side, 'infantry', x(850));
      target.cooldown = 1e6;
      target.hp = target.maxHp = 10000;
      v15Still(s);
      refreshVision(s);
      tick(s, 1 / 60);
      const volley = s.projectiles.filter((p) =>
        own.some((u) => u.uid === p.sourceUid),
      );
      assert.equal(volley.filter((p) => p.ammunition === 'rocket').length, 1);
      assert.equal(volley.filter((p) => p.ammunition === 'rifle').length, 3);
      assert(
        volley
          .filter((p) => p.ammunition === 'rifle')
          .every((p) => p.damage === 3 && p.radius === 0),
      );
      return {
        ammunition: volley.map((p) => p.ammunition),
        damage: volley.map((p) => p.damage),
      };
    },
  );
v15Check(
  'elite pays for a shorter-range faster ambush and keeps fighting without surrender',
  () => {
    const s = v15Arena(),
      u = v15Solo(s, 0, 'commandos', 600);
    v15Still(s);
    v15Run(s, 1.2);
    assert(u.ambushFor >= 1);
    const target = v15Solo(s, 1, 'infantry', 940);
    target.cooldown = 1e6;
    refreshVision(s);
    tick(s, 1 / 60);
    const p = s.projectiles.find((p) => p.sourceUid === u.uid);
    assert.equal(p.damage, 18);
    assert(CARDS.commandos.range < CARDS.rangers.range);
    assert(CARDS.commandos.cost > CARDS.rangers.cost);
    u.personalMorale = 1;
    u.hp = u.maxHp * 0.2;
    u.decisionIn = 0;
    tick(s, 1 / 60);
    assert(!u.surrendered);
    assert.equal(u.tactic, 'retreat');
    return {
      damage: p.damage,
      cost: CARDS.commandos.cost,
      range: CARDS.commandos.range,
      tactic: u.tactic,
    };
  },
);
v15Check(
  'rapid deployment never accelerates a morale rout in either direction',
  () => {
    const values = [];
    for (const side of [0, 1]) {
      const distances = [];
      for (const rapid of [false, true]) {
        const s = v15Arena(),
          start = side ? W - 1000 : 1000,
          u = v15Solo(s, side, 'paratroopers', start);
        u.tactic = 'retreat';
        u.personalMorale = 20;
        u.retreatUntil = 100;
        u.rapidUntil = rapid ? 8 : 0;
        v15Run(s, 1);
        distances.push(Math.abs(u.x - start));
        assert.equal(u.tactic, 'retreat');
        assert.equal(u.facing, side ? 1 : -1);
      }
      assert(Math.abs(distances[0] - distances[1]) < 1e-8);
      values.push({ side, distances });
    }
    return { values };
  },
);
v15Check(
  'moving engineers clear proximal hostile mines without reading distant mines',
  () => {
    const values = [];
    for (const side of [0, 1]) {
      const s = v15Arena(),
        dir = side ? -1 : 1,
        u = v15Solo(s, side, 'engineers', side ? W - 600 : 600);
      v15Run(s, 0.5);
      assert(u.moving);
      const start = u.x;
      s.mines = [
        { uid: 900, side: 1 - side, x: start + dir * 24, armAt: 0 },
        { uid: 901, side: 1 - side, x: start + dir * 300, armAt: 0 },
        { uid: 902, side, x: start + dir * 24, armAt: 0 },
      ];
      refreshVision(s);
      tick(s, 1 / 60);
      assert.deepEqual(
        s.mines.map((m) => m.uid),
        [901, 902],
      );
      assert(u.moving);
      v15Run(s, 1);
      assert(s.mines.some((m) => m.uid === 901));
      values.push({
        side,
        remaining: s.mines.map((m) => m.uid),
        moved: Math.abs(u.x - start),
      });
    }
    return { values };
  },
);
v15Check(
  'four 1-cost roles remain weaker than 2-cost rifle squad in an open duel',
  () => {
    const values = [];
    for (const id of ['militia', 'scouts', 'medic', 'engineers']) {
      assert.equal(CARDS[id].cost, 1);
      const s = v15Arena();
      spawnUnit(s, 0, id, 700);
      spawnUnit(s, 1, 'infantry', 900);
      for (const u of s.units) {
        u.cooldown = 0;
        u.decisionIn = 1e6;
        u.pace = 0;
        u.tactic = 'advance';
      }
      v15Still(s);
      refreshVision(s);
      v15Run(s, 30);
      const health = (side) =>
        s.units
          .filter((u) => u.side === side && u.hp > 0)
          .reduce((a, u) => a + u.hp, 0);
      values.push({ id, cheap: health(0), rifle: health(1) });
      assert(health(0) < health(1));
    }
    return { values };
  },
);
v15Check('new ability copy fits the physical cards', () => {
  for (const id of [
    'infantry',
    'armed_police',
    'marines',
    'assault',
    'rangers',
    'paratroopers',
    'mountain',
    'commandos',
    'scouts',
    'medic',
    'engineers',
    'antiarmor',
  ])
    for (const key of ['ability', 'rule', 'flavor'])
      assert([...CARD_COPY[id][key]].length <= 15, `${id}/${key}`);
  return {
    costs: Object.fromEntries(
      [
        'militia',
        'scouts',
        'medic',
        'engineers',
        'infantry',
        'armed_police',
        'antiarmor',
        'marines',
        'assault',
        'paratroopers',
        'mountain',
        'rangers',
        'commandos',
      ].map((id) => [id, CARDS[id].cost]),
    ),
  };
});
console.log(JSON.stringify({ passed: v15Count, metrics: v15Metrics }));
