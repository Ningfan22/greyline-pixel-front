import type {Unit} from './engine';
import {weaponModel} from './cards';
import {isPrecisionObserver} from './precision-team';
import {magazineReloadActive,stanceTransitionActive} from './infantry-action-timing';

export const PRONE_STEP_S = .65;
export const PRONE_STOP_GRACE_S = 1.25;
type LowBody = Pick<Unit,'pose'> & Partial<Pick<Unit,'proneTravel'>>;
/** Ordinary rifle bodies have a taller elbow-crawl than their settled aim.
 * Specialist weapon bodies already have a separate, nearly level silhouette. */
export function proneTravelApplies(u: Pick<Unit,'id'|'member'>) {
  return weaponModel(u)==='infantry' || isPrecisionObserver(u);
}
export function proneTravelAmount(u: LowBody) {
  return u.pose==='prone' ? Math.max(0,Math.min(1,u.proneTravel??0)) : 0;
}
export function proneMotionActive(u: LowBody) {
  const p=proneTravelAmount(u);return p>0&&p<1;
}
export function proneStartDelay(u: Unit) {
  return u.pose==='prone'&&proneTravelApplies(u) ? (1-proneTravelAmount(u))*PRONE_STEP_S : 0;
}
/** Record intent before moving feet or changing formation lane. */
export function requestProneStep(u: Unit,time: number) {
  if(u.pose!=='prone'||!proneTravelApplies(u))return true;
  u.proneMoveRequested=true;
  if(proneTravelAmount(u)<1&&(u.proneStepCommittedUntil??0)<=time)
    u.proneStepCommittedUntil=time+proneStartDelay(u)+.35;
  return proneTravelAmount(u)>=1;
}
export function stepProneLocomotion(u: Unit,time: number,dt: number) {
  if(u.pose!=='prone'||u.hp<=0||u.wounded||u.surrendered||u.rappelling||u.parachuting||
    u.climbing>0||!['ground','bank'].includes(u.motion)||!proneTravelApplies(u)) {
    u.proneTravel=undefined;u.proneStoppedFor=0;u.proneStepCommittedUntil=0;return;
  }
  if(u.motion==='bank'){u.proneStoppedFor=0;return;}
  if(stanceTransitionActive(u,time)){u.proneTravel=u.poseAnimToTravel??0;u.proneStoppedFor=0;return;}
  const p=proneTravelAmount(u),moving=u.proneMoveRequested||u.moving;
  if(!moving&&p<1)u.proneStepCommittedUntil=0;
  u.proneStoppedFor=moving?0:(u.proneStoppedFor??0)+dt;
  const work=magazineReloadActive(u,time)||u.tending||u.digging||
    (u.firstAidUntil??0)>time||(u.fragThrow??0)>0||(u.overheatedUntil??0)>time;
  // Do not restart a whole-body action during every short traffic stop.
  // A cancelled initial step returns smoothly, never freezes halfway up.
  const target=moving?1:work||p<1||u.proneStoppedFor>PRONE_STOP_GRACE_S+1e-8?0:p;
  const next=p+Math.max(-dt/PRONE_STEP_S,Math.min(dt/PRONE_STEP_S,target-p));
  u.proneTravel=next<1e-6?0:next>1-1e-6?1:next;
}
