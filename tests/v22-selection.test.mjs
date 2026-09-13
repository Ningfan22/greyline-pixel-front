import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createGame, startGame, spawnUnit, tick, W } from '../game/engine.ts';
import {
  pickSquad,
  selectUnitGroup,
  setSquadOrder,
  ordersForUnit,
} from '../game/squad-orders.ts';
import { stepUnitControl } from '../game/unit-control.ts';
import {
  unitSelectionBounds,
  selectionOccluded,
  drawUnitSelection,
} from '../game/selection-render.ts';
const out = path.resolve('output/v22-selection-qa');
fs.mkdirSync(out, { recursive: true });
const results = [],
  failures = [],
  DT = 1 / 60;
function check(name, fn) {
  try {
    const result = fn();
    results.push({ name, ...result });
    console.log('PASS', name);
  } catch (error) {
    failures.push({ name, error: error.stack });
    console.error('FAIL', name, error.stack);
  }
}
function fixture(id = 'infantry', side = 0) {
  const s = createGame(2237);
  startGame(s);
  s.aiIn = 1e9;
  s.scenery = [];
  s.walls = [];
  s.terrain.fill(374);
  s.original.fill(374);
  spawnUnit(s, side, id, side === 0 ? 1400 : W - 1400);
  return { s, u: s.units[0] };
}
for (const id of [
  'infantry',
  'tank',
  'pickup',
  'tow_ifv',
  'mortar_carrier',
  'recovery_vehicle',
  'command_vehicle',
  'mine_clearer',
  'artillery',
  'helicopter',
  'fpv_drone',
  'strike_jet',
  'air_assault',
])
  check(
    `${id}: desktop and touch body picking selects the owning unit group and commands match capability`,
    () => {
      const { s, u } = fixture(id),
        b = unitSelectionBounds(u);
      assert.equal(pickSquad(s, 0, b.x + b.w / 2, b.y + b.h / 2), u.squad);
      assert.equal(
        pickSquad(s, 0, b.x + b.w + 14, b.y + b.h / 2, true),
        u.squad,
      );
      assert.equal(pickSquad(s, 1, b.x + b.w / 2, b.y + b.h / 2), null);
      assert.equal(selectUnitGroup(s, 0, u.squad).ok, true);
      assert.equal(u.squadOrder, 'watch');
      assert.equal(u.squadOrderX, u.x);
      const ids = ordersForUnit(id).map((o) => o.id);
      assert.deepEqual(
        ids,
        id === 'infantry'
          ? ['hold', 'retreat', 'attack', 'watch', 'escort']
          : id === 'artillery'
            ? ['watch']
            : id === 'strike_jet'
              ? ['attack', 'retreat']
              : ['attack', 'retreat', 'watch'],
      );
      return { bounds: b, commands: ids };
    },
  );
check(
  'clicking an already selected squad refreshes watch and clears retreat/cover/escort/digging movement',
  () => {
    const { s, u } = fixture();
    for (const v of s.units)
      Object.assign(v, {
        squadOrder: 'retreat',
        squadOrderX: v.x - 240,
        moving: true,
        vx: -70,
        coverGoal: 1200,
        firingGoal: 1100,
        withdrawGoal: 900,
        retreatUntil: 99,
        escortTankUid: 777,
        digging: true,
        motion: 'bank',
        climbing: 0.5,
      });
    const x = s.units.map((v) => v.x);
    assert.equal(selectUnitGroup(s, 0, u.squad).ok, true);
    for (const v of s.units) {
      assert.equal(v.squadOrder, 'watch');
      assert.equal(v.moving, false);
      assert.equal(v.coverGoal, null);
      assert.equal(v.firingGoal, null);
      assert.equal(v.withdrawGoal, undefined);
      assert.equal(v.escortTankUid, undefined);
      assert.equal(v.digging, false);
      assert.equal(v.motion, 'ground');
      assert.equal(v.climbing, 0);
    }
    assert.equal(selectUnitGroup(s, 0, u.squad).ok, true);
    assert.deepEqual(
      s.units.map((v) => v.x),
      x,
    );
    return {};
  },
);
check(
  'wounded, surrendered, dead and enemy units cannot be selected or given player orders',
  () => {
    for (const flag of ['wounded', 'surrendered', 'dead']) {
      const { s, u } = fixture('tank');
      if (flag === 'dead') u.hp = 0;
      else u[flag] = true;
      const b = unitSelectionBounds(u);
      assert.equal(pickSquad(s, 0, u.x, b.y + b.h / 2), null);
      assert.equal(selectUnitGroup(s, 0, u.squad).ok, false);
    }
    const { s, u } = fixture('tank', 1);
    assert.equal(selectUnitGroup(s, 0, u.squad).ok, false);
    return {};
  },
);
check(
  'unsupported vehicle entrench/escort commands do not change a parked vehicle',
  () => {
    const { s, u } = fixture('tank');
    selectUnitGroup(s, 0, u.squad);
    assert.equal(setSquadOrder(s, 0, u.squad, 'hold').ok, false);
    assert.equal(setSquadOrder(s, 0, u.squad, 'escort').ok, false);
    assert.equal(u.squadOrder, 'watch');
    assert.equal(s.entrenchments?.length ?? 0, 0);
    return {};
  },
);
for (const side of [0, 1])
  check(
    `side${side}: non-infantry watch and retreat helpers stop then move toward home and finish in watch`,
    () => {
      const { s, u } = fixture('tank', side),
        x = u.x;
      selectUnitGroup(s, side, u.squad);
      for (let i = 0; i < 120; i++) {
        s.time += DT;
        assert.equal(stepUnitControl(s, u, DT), true);
      }
      assert.equal(u.x, x);
      assert.equal(u.moving, false);
      setSquadOrder(s, side, u.squad, 'retreat');
      const goal = u.squadOrderX;
      for (let i = 0; i < 1200; i++) {
        s.time += DT;
        stepUnitControl(s, u, DT);
      }
      assert.ok(Math.abs(u.x - goal) < 1);
      assert.equal(u.squadOrder, 'watch');
      assert.ok((u.x - x) * (side === 0 ? -1 : 1) > 200);
      return { x, end: u.x };
    },
  );
check(
  'fixed-wing selection stays airborne in local moving orbit; resume and return remain distinct',
  () => {
    const { s, u } = fixture('strike_jet'),
      x = u.x,
      y = u.y;
    selectUnitGroup(s, 0, u.squad);
    let distance = 0,
      extent = 0;
    for (let i = 0; i < 600; i++) {
      const old = u.x;
      s.time += DT;
      stepUnitControl(s, u, DT);
      distance += Math.abs(u.x - old);
      extent = Math.max(extent, Math.abs(u.x - x));
    }
    assert.ok(distance > 250);
    assert.ok(extent < 68);
    assert.equal(u.y, y);
    setSquadOrder(s, 0, u.squad, 'attack');
    assert.equal(stepUnitControl(s, u, DT), false);
    setSquadOrder(s, 0, u.squad, 'retreat');
    stepUnitControl(s, u, DT);
    assert.equal(u.patrolExiting, true);
    assert.equal(u.facing, -1);
    return { distance, extent };
  },
);
check(
  'markers draw only known living units; occlusion uses provided cover rectangles without vision queries',
  () => {
    const { u } = fixture(),
      b = unitSelectionBounds(u),
      calls = [];
    const ctx = {
      save() {},
      restore() {},
      strokeRect(...a) {
        calls.push(['box', ...a]);
      },
      fillRect(...a) {
        calls.push(['mark', ...a]);
      },
    };
    assert.equal(
      selectionOccluded(u, [
        { x: b.x - 1, y: b.y - 1, w: b.w + 2, h: b.h + 2 },
      ]),
      true,
    );
    assert.equal(selectionOccluded(u, [{ x: 0, y: 0, w: 1, h: 1 }]), false);
    drawUnitSelection(ctx, u, {
      selected: true,
      visible: false,
      occluded: true,
    });
    assert.equal(calls.length, 0);
    drawUnitSelection(ctx, u, {
      selected: true,
      visible: true,
      occluded: true,
    });
    assert.equal(calls.filter((c) => c[0] === 'box').length, 1);
    assert.equal(calls.filter((c) => c[0] === 'mark').length, 3);
    u.hp = 0;
    const n = calls.length;
    drawUnitSelection(ctx, u, { selected: true, visible: true });
    assert.equal(calls.length, n);
    return {};
  },
);
for (const id of ['infantry', 'tank', 'pickup', 'helicopter', 'mortar_carrier'])
  check(
    `${id}: actual engine preserves selection watch without a menu or target`,
    () => {
      const { s, u } = fixture(id);
      selectUnitGroup(s, 0, u.squad);
      const x = s.units.map((v) => v.x);
      for (let i = 0; i < 180; i++) tick(s, DT);
      assert.deepEqual(
        s.units.map((v) => v.x),
        x,
      );
      assert.ok(s.units.every((v) => !v.moving));
      fs.writeFileSync(
        path.join(out, `${id}-watch-state.json`),
        JSON.stringify(s),
      );
      return { time: s.time, x: u.x };
    },
  );
fs.writeFileSync(
  path.join(out, 'checks.json'),
  JSON.stringify({ results, failures }, null, 2),
);
console.log(`${results.length} passed, ${failures.length} failed`);
if (failures.length) process.exitCode = 1;
