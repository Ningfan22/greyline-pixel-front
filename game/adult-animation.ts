import { CARDS, type CardId } from './cards';
import type { Unit } from './engine';
export type AdultIdentity = 'infantry' | 'marines' | 'police' | 'militia';
export interface AdultSprites {
  walk8: HTMLCanvasElement[];
  crouch8: HTMLCanvasElement[];
  actions20: HTMLCanvasElement[];
  reactions8: HTMLCanvasElement[];
}
export interface AdultFrameChoice {
  group: keyof AdultSprites;
  index: number;
}
export function adultIdentity(id: CardId): AdultIdentity {
  if (id === 'militia') return 'militia';
  if (CARDS[id].uniform === 'police') return 'police';
  if (
    CARDS[id].uniform === 'marine' ||
    ['marines', 'paratroopers', 'rangers'].includes(id)
  )
    return 'marines';
  return 'infantry';
}
const action = (index: number): AdultFrameChoice => ({
  group: 'actions20',
  index,
});
const reaction = (index: number): AdultFrameChoice => ({
  group: 'reactions8',
  index,
});
const cycle = (walk: number, length: number) =>
  ((Math.floor(walk) % length) + length) % length;
/** Every living, casualty and surrender state uses the same adult anatomy. */
export function adultFrameChoice(u: Unit): AdultFrameChoice {
  if (u.hp <= 0) return action(15);
  if (u.surrendered)
    return reaction(
      u.surrenderTime < 0.35
        ? 0
        : u.surrenderTime < 0.75
          ? 1
          : u.surrenderTime < 2.5
            ? 2
            : 3,
    );
  if (u.wounded) {
    if (u.woundedFromPose === 'prone' || u.woundedTime >= 0.7)
      return action(14);
    const low = u.woundedFromPose === 'crouch' || u.woundedFromPose === 'land';
    return reaction(
      (low ? 5 : 4) + Math.min(low ? 2 : 3, Math.floor(u.woundedTime * 6)),
    );
  }
  if (u.motion === 'jump') return action(u.motionTime < 0.12 ? 4 : 5);
  if (u.motion === 'land')
    return action(u.motionTime < u.motionDuration * 0.5 ? 6 : 7);
  if (u.climbing > 0 || u.motion === 'bank') {
    const progress =
      u.climbing > 0
        ? 1 - u.climbing / Math.max(0.01, u.climbDuration)
        : u.motionTime / Math.max(0.01, u.motionDuration);
    return action(8 + Math.min(3, Math.max(0, Math.floor(progress * 4))));
  }
  if (u.pose === 'prone')
    return action(u.moving && cycle(u.walk / 2, 2) ? 12 : 2);
  if (u.pose === 'crouch')
    return u.moving ? { group: 'crouch8', index: cycle(u.walk, 8) } : action(1);
  if (u.moving)
    return u.pose === 'run' || u.tactic === 'retreat'
      ? action(16 + cycle(u.walk / 2, 4))
      : { group: 'walk8', index: cycle(u.walk, 8) };
  if (u.flash > 0.13) return reaction(4);
  return action(0);
}
export function adultWreckChoice(
  age: number,
  pose?: Unit['pose'],
): AdultFrameChoice {
  if (pose === 'prone') return action(15);
  if (pose === 'crouch' || pose === 'land')
    return age < 0.45
      ? reaction(5 + Math.min(2, Math.floor(age * 6)))
      : action(15);
  return age < 0.6
    ? reaction(4 + Math.min(3, Math.floor(age * 6)))
    : action(15);
}
