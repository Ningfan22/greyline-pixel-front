import assert from 'node:assert/strict';
import {
  createGame,
  startGame,
  spawnUnit,
  setOrder,
  tick,
  CARDS,
  W,
} from '../game/engine.ts';
import { adultFrameChoice } from '../game/adult-animation.ts';

const v23Metrics = [];
let v23Count = 0;
const v23Check = (name, fn) => {
  const metrics = fn();
  v23Count++;
  v23Metrics.push({ name, ...metrics });
  console.log('PASS', name, JSON.stringify(metrics));
};
const v23Arena = () => {
  const s = createGame(37);
  startGame(s);
  s.aiIn = 1e6;
  s.terrain.fill(374);
  s.original.fill(374);
  s.scenery = [];
  s.walls = [];
  return s;
};
const v23Solo = (s, side, id, x) => {
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
const v23Run = (s, seconds) => {
  for (let i = 0; i < Math.round(seconds * 60); i++) tick(s, 1 / 60);
};
const v23Still = (s) => {
  for (const side of [0, 1]) setOrder(s, side, 'hold');
};

for (const side of [0, 1]) {
  const x = (v) => (side === 0 ? v : W - v),
    enemy = 1 - side;
  v23Check(
    `side${side}: assault throws a grenade at a visible cluster beyond smoke range`,
    () => {
      const s = v23Arena(),
        u = v23Solo(s, side, 'assault', x(600));
      u.hp = u.maxHp;
      for (const d of [190, 210]) {
        const v = v23Solo(s, enemy, 'infantry', x(600 + d));
        v.cooldown = 1e6;
        v.hp = v.maxHp = 10000;
      }
      v23Still(s);
      v23Run(s, 0.3);
      const grenade = s.projectiles.find(
        (p) => p.sourceUid === u.uid && p.ammunition === 'grenade',
      );
      assert(grenade, 'expected a grenade projectile from the assault unit');
      assert.equal(u.fragLeft, CARDS.assault.frags - 1);
      assert(u.fragThrow > 0, 'throw animation timer should be active');
      assert(u.fragCooldown > 0, 'per-unit cooldown should be armed');
      assert.equal(s.smokes.length, 0, 'contact beyond 140 must not trigger smoke');
      return {
        fragLeft: u.fragLeft,
        fragThrow: Number(u.fragThrow.toFixed(2)),
        grenadeTx: Math.round(grenade.tx),
      };
    },
  );
  v23Check(
    `side${side}: grenade is spent once and respects the per-unit cooldown`,
    () => {
      const s = v23Arena(),
        u = v23Solo(s, side, 'rangers', x(600));
      u.hp = u.maxHp;
      for (const d of [170, 200]) {
        const v = v23Solo(s, enemy, 'militia', x(600 + d));
        v.cooldown = 1e6;
        v.hp = v.maxHp = 10000;
      }
      v23Still(s);
      v23Run(s, 0.25);
      const grenades = s.projectiles.filter(
        (p) => p.sourceUid === u.uid && p.ammunition === 'grenade',
      );
      assert.equal(grenades.length, 1);
      v23Run(s, 2);
      assert.equal(u.fragLeft, CARDS.rangers.frags - 1);
      assert(u.fragCooldown > 3, 'cooldown should still be running after 2s');
      return { grenades: grenades.length, fragLeft: u.fragLeft };
    },
  );
  v23Check(
    `side${side}: single distant contact never earns a grenade`,
    () => {
      const s = v23Arena(),
        u = v23Solo(s, side, 'commandos', x(600));
      u.hp = u.maxHp;
      const v = v23Solo(s, enemy, 'infantry', x(700));
      v.cooldown = 1e6;
      v.hp = v.maxHp = 10000;
      v23Still(s);
      v23Run(s, 1);
      assert.equal(
        s.projectiles.filter(
          (p) => p.sourceUid === u.uid && p.ammunition === 'grenade',
        ).length,
        0,
      );
      assert.equal(u.fragLeft, CARDS.commandos.frags);
      return { fragLeft: u.fragLeft };
    },
  );
  v23Check(
    `side${side}: medic shows the tending pose while treating a damaged patient`,
    () => {
      const s = v23Arena(),
        medic = v23Solo(s, side, 'medic', x(600)),
        patient = v23Solo(s, side, 'infantry', x(660));
      patient.hp = patient.maxHp - 20;
      v23Still(s);
      tick(s, 1 / 60);
      assert(medic.tending, 'medic should be tending the patient');
      assert((medic.tendingTime ?? 0) > 0);
      assert(patient.hp > patient.maxHp - 20, 'patient should be healing');
      v23Run(s, 1);
      assert(medic.tending, 'tending continues across cooldown gaps');
      assert(medic.tendingTime > 0.5);
      // Tending must alternate between crouch (action 17) and kneel (reaction 5),
      // never the hit side-fall frame (reaction 6).
      for (let t = 0; t < 2; t += 1 / 30) {
        medic.tendingTime = t;
        const f = adultFrameChoice(medic);
        const ok =
          (f.group === 'actions20' && f.index === 17) ||
          (f.group === 'reactions8' && f.index === 5);
        assert(ok, `tending frame ${f.group}[${f.index}] at t=${t} should be crouch or kneel`);
      }
      return {
        tending: medic.tending,
        tendingTime: Number(medic.tendingTime.toFixed(2)),
        healed: patient.maxHp - patient.hp,
      };
    },
  );
  v23Check(
    `side${side}: tending flag clears when no patient remains`,
    () => {
      const s = v23Arena(),
        medic = v23Solo(s, side, 'medic', x(600)),
        patient = v23Solo(s, side, 'infantry', x(660));
      patient.hp = patient.maxHp - 5;
      v23Still(s);
      tick(s, 1 / 60);
      assert(medic.tending);
      s.units = s.units.filter((v) => v !== patient);
      v23Run(s, 0.5);
      assert(!medic.tending, 'tending should reset without a patient');
      assert.equal(medic.tendingTime, 0);
      return { tending: medic.tending };
    },
  );
}

console.log(`--- v23: ${v23Count} checks passed`);
