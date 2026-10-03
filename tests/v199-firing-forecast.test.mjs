import test from 'node:test';
import assert from 'node:assert/strict';
import { CARDS } from '../game/cards.ts';
import { soldierMuzzle } from '../game/soldier-pose.ts';

test('settled forecast preserves every infantry weapon socket without copying or mutating the live actor', () => {
  const states = [
    {}, { moving: true }, { moving: true, gaitWeight: .72, gaitRun: .6, rifleReady: .2 },
    { moving: false, gaitWeight: .7, gaitRun: .8, rifleReady: 0 },
    { moving: true, crouchTravel: .7, proneTravel: .4 },
    { tactic: 'retreat', moving: true, gaitWeight: 1, gaitRun: 1 },
    { wounded: true }, { surrendered: true }, { rappelling: true }, { parachuting: true },
    { fire: .1, flash: .2, secondaryFire: .1 },
    { poseAnimFrom: 'idle', poseAnimSeen: 'prone', poseAnimProgress: .3,
      poseAnimFromTravel: 0, poseAnimToTravel: .7 },
    { poseAnimFrom: 'prone', poseAnimSeen: 'crouch', poseAnimProgress: .72,
      poseAnimFromTravel: .8, poseAnimToTravel: 0 },
    { soldierGround: { near: 2, far: -4, hip: 1.5, weight: .83, y: 342 } },
    { soldierTurn: { at: 0, duration: .6, progress: .3, hip: [2, -1],
      angles: [.2, -.3, .1, -.2, .15], targets: [.1, 1, -.2, .6, .5],
      initialTargets: [0, .5, -.1, .7, .3], head: [.3, -.2], headAngle: .2, bottom: 0 } },
  ];
  let sockets = 0;
  for (const [id, card] of Object.entries(CARDS)) {
    if (!card.members) continue;
    for (let member = 0; member < card.members; member++) {
      for (const pose of ['idle', 'walk', 'run', 'crouch', 'prone', 'hunker']) {
        for (const state of states) {
          const u = { id, member, pose, walk: 2.73, gaitPhase: 5.19, ...state };
          const unchanged = JSON.stringify(u);
          const expected = soldierMuzzle({ ...u, moving: false, gaitWeight: 0,
            gaitRun: 0, rifleReady: 1 });
          assert.deepEqual(soldierMuzzle(u, true), expected, `${id}/${member}/${pose}/${sockets}`);
          assert.equal(JSON.stringify(u), unchanged, 'forecast must not modify the live actor');
          sockets++;
        }
      }
    }
  }
  assert.ok(sockets > 10000, `${sockets} distinct sockets checked`);
});
