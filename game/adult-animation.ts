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
export function adultFrameChoice(u: Unit, time = 0): AdultFrameChoice {
  // Reverse the existing raised-rifle gait while the body keeps facing contact.
  const step = u.backpedaling ? -Math.floor(u.walk) : u.walk;
  if (u.hp <= 0) return action(15);
  if (u.rappelling) return action(8 + (3 - cycle(u.walk, 4)));
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
  // Grenade throw is a 0.45s countdown. The projectile spawns at the start of
  // the animation, so the arm comes forward early and settles into a follow-through.
  if ((u.fragThrow ?? 0) > 0) {
    const t = u.fragThrow ?? 0;
    if (t > 0.33) return action(8); // wind-up (arm back)
    if (t > 0.17) return action(9); // release (arm forward)
    return action(10); // follow-through
  }
  // Medics alternate between a kneeling pose and a low crouch while treating,
  // never the hit-reaction fall frames.
  if (u.tending)
    return Math.floor((u.tendingTime ?? 0) * 2.5) % 2 ? action(17) : reaction(5);
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
  const reloading = (u.reloadingUntil ?? 0) > time;
  if (u.pose === 'prone') {
    if (u.moving) return action(cycle(u.walk / 2, 2) ? 12 : 2);
    // Spotters periodically kneel to work the radio while observing.
    if (u.id === 'scouts') {
      const radioT = (time + u.uid * 1.37) % 4.4;
      if (radioT < 1.2) return action(13);
    }
    if (reloading) return action(Math.floor(time * 3) % 2 ? 2 : 3);
    return action(2);
  }
  if (u.pose === 'crouch') {
    if (u.moving) return { group: 'crouch8', index: cycle(step, 8) };
    if (reloading) return action(13);
    return action(1);
  }
  if (u.moving)
    return u.pose === 'run' || u.tactic === 'retreat'
      ? action(16 + cycle(u.walk / 2, 4))
      : { group: 'walk8', index: cycle(step, 8) };
  if (u.flash > 0.13) return reaction(4);
  if (reloading) return action(13);
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
