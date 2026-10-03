import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame, startGame, spawnUnit, tick } from '../game/engine.ts';
import { selectUnitGroup, setSquadOrder, trenchConstructionLabel } from '../game/squad-orders.ts';
import { POSE_TRANSITION_S, stanceTransitionActive } from '../game/infantry-action-timing.ts';

const DT = 1 / 60;
function arena(side = 0) {
  const s = createGame(198108);
  startGame(s);
  s.aiIn = 1e9;
  s.units = [];
  s.scenery = [];
  s.wrecks = [];
  s.walls = [];
  s.terrain.fill(374);
  s.original.fill(374);
  s.knownTerrain = [s.terrain.slice(), s.terrain.slice()];
  spawnUnit(s, side, 'infantry', 1800);
  return s;
}
function step(s, seconds) {
  for (let i = 0; i < seconds / DT; i++) tick(s, DT);
}

for (const side of [0, 1]) test(`side ${side}: one construction command reaches a real kneeling drill despite a walking posture lock`, () => {
  const s = arena(side), squad = s.units[0].squad;
  assert(selectUnitGroup(s, side, squad).ok);
  assert(setSquadOrder(s, side, squad, 'hold').ok);
  const trench = s.entrenchments[0];
  // Isolate the reported post-arrival stall: an already selected squad has
  // arrived at its actual assigned stations, with the ten-second walk lock.
  for (const u of s.units) Object.assign(u, {
    x: u.squadOrderX, lane: u.holdLane, moving: false,
    pose: 'walk', poseAnimSeen: 'stand', poseAnimFrom: undefined,
    poseAnimAt: undefined, stanceLockUntil: 60, tactic: 'advance',
    motion: 'ground', readyAt: -1, personalMorale: 100,
  });
  tick(s, DT);
  const workers = s.units.filter(u => u.pose === 'crouch');
  assert(workers.length > 0, 'one accepted command starts the crouching drill');
  assert(workers.every(u => stanceTransitionActive(u, s.time)));
  assert.equal(trench.progress, 0, 'no earth removed before authored knees settle');
  step(s, POSE_TRANSITION_S - .1);
  assert.equal(trench.progress, 0);
  step(s, .2);
  assert(trench.progress > 0, 'first command opens the trench without being sent twice');
  assert.equal(trenchConstructionLabel(s.units, trench, s.time), '正在施工');
  step(s, 9);
  assert(trench.built);
  assert.equal(trenchConstructionLabel(s.units, trench, s.time), '阵地就绪');
  const before = { count: s.entrenchments.length, progress: trench.progress, mines: s.mines.length };
  assert(setSquadOrder(s, side, squad, 'hold').ok);
  assert.deepEqual({ count: s.entrenchments.length, progress: trench.progress, mines: s.mines.length }, before);
});

test('construction feedback distinguishes accepted travel, real digging and combat interruption', () => {
  const s = arena(), squad = s.units[0].squad;
  assert(selectUnitGroup(s, 0, squad).ok);
  assert.equal(trenchConstructionLabel(s.units, undefined, s.time), undefined);
  assert(setSquadOrder(s, 0, squad, 'hold').ok);
  const trench = s.entrenchments[0];
  assert.equal(trenchConstructionLabel(s.units, trench, s.time), '前往工位');
  for (const u of s.units) Object.assign(u, { x: u.squadOrderX, lane: u.holdLane, moving: false });
  assert.equal(trenchConstructionLabel(s.units, trench, s.time), '准备开挖');
  s.units[0].suppression = 40;
  assert.equal(trenchConstructionLabel(s.units, trench, s.time), '交战中，施工暂停');
  s.units[0].suppression = 0;
  s.units[0].digging = true;
  assert.equal(trenchConstructionLabel(s.units, trench, s.time), '正在施工');
});

test('one selected moving squad completes its trench without a second order', () => {
  const s = arena(), squad = s.units[0].squad;
  step(s, .5);
  assert(selectUnitGroup(s, 0, squad).ok);
  assert(setSquadOrder(s, 0, squad, 'hold').ok);
  const starts = new Map(s.units.map(u => [u.uid, u.x]));
  let firstDig = null;
  for (let i = 0; i < 18 / DT; i++) {
    tick(s, DT);
    if (s.entrenchments[0].progress > 0 && firstDig === null) firstDig = s.time;
    for (const u of s.units) {
      assert(Math.abs(u.x - starts.get(u.uid)) < 2, 'troops walk to stations without teleporting');
      starts.set(u.uid, u.x);
    }
    if (s.entrenchments[0].built) break;
  }
  assert(firstDig !== null && firstDig < 8, 'no extra ten-second lock after arriving');
  assert(s.entrenchments[0].built);
  assert.equal(s.entrenchments.length, 1);
});
