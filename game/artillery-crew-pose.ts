import { CARDS, type CardId } from './cards';
import type { Unit } from './engine';
import { emplacementCrewGrip, type EmplacementName } from './emplacement-layout';
import { soldierPose, solveLimb, type Point, type SoldierPose } from './soldier-pose';

type CrewOwner = Pick<Unit, 'id' | 'uid' | 'x' | 'side' | 'moving'> & Partial<Unit>;
/** Operators keep the infantry rig and real walking legs. Their hands belong
 * to the carriage contact, so the shoulders bend without the gloves sliding. */
export function artilleryCrewPose(owner: CrewOwner, member: number, time: number, ground?: (x:number)=>number) {
  const name = CARDS[owner.id].emplacement as EmplacementName;
  const facing = (owner.gunFacing ?? (owner.side === 0 ? 1 : -1)) < 0 ? -1 : 1;
  const moving = !!owner.moving;
  const base = soldierPose({
    id: 'infantry' as CardId, uid: owner.uid * 2 + member, member,
    hp: 100, pose: moving ? 'walk' : 'crouch', motion: 'ground', facing,
    moving, gaitWeight: moving ? 1 : 0, gaitRun: 0,
    // The foot phase follows translation, including a backwards push. It
    // stops with the gun, instead of jogging in place while it is blocked.
    gaitPhase: owner.x * facing / 6.25 + member * 3.2,
    rifleReady: 0, fire: 0, secondaryFire: 0,
    scavengeUntil: moving ? 0 : time + 1, digElapsed: time + member * .85,
  }, time);
  const angle=owner.hullAngle??0;
  const groundY=(localX:number)=>ground ? ground(owner.x+facing*localX)-(owner.y??0)+3 : 3;
  if (!moving) return {
    pose: { ...base, weaponVisible: false, prop: undefined }, facing,
    x: -(42 + member * 32), y: groundY(-(42 + member * 32)),
  };

  const originalGrip = emplacementCrewGrip(name, member);
  const grip=[originalGrip[0]*Math.cos(angle)-facing*originalGrip[1]*Math.sin(angle),facing*originalGrip[0]*Math.sin(angle)+originalGrip[1]*Math.cos(angle)];
  const crewX=grip[0]-18,crewY=groundY(crewX);
  const handY = grip[1]-crewY + (name === 'aa_gun' ? 3 : 0);
  const lean = .70 + Math.max(0, 26 + handY) * .045;
  const hip: Point = [base.hip[0] - 3, base.hip[1] + 3];
  const neck: Point = [hip[0] + Math.sin(lean) * 22, hip[1] - Math.cos(lean) * 22];
  const shoulder: Point = [neck[0] + (hip[0] - neck[0]) * .2 - 1, neck[1] + (hip[1] - neck[1]) * .2];
  const farShoulder: Point = [shoulder[0] + 1, shoulder[1] - 1];
  const nearArm = solveLimb(shoulder, [18, handY], 12, 13, 1);
  const farArm = solveLimb(farShoulder, [16, handY - 1], 12, 13, 1);
  const nearLeg = solveLimb(hip, base.nearFoot, 17, 17, -1);
  const farLeg = solveLimb([hip[0] - 1, hip[1]], base.farFoot, 17, 17, -1);
  const pose: SoldierPose = {
    ...base, hip, neck, shoulder, head: [neck[0] + 1, neck[1] + 2], headAngle: .16,
    nearKnee: nearLeg.joint, farKnee: farLeg.joint, nearFoot: nearLeg.end, farFoot: farLeg.end,
    nearElbow: nearArm.joint, nearHand: nearArm.end, farElbow: farArm.joint, farHand: farArm.end,
    weaponVisible: false, slung: false, prop: undefined,
  };
  return { pose, facing, x: crewX, y: crewY };
}
