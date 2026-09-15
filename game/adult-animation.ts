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
  /**
   * Visual facing override for the renderer's sprite flip. Sector scans set
   * this so the soldier visibly glances toward a flank without touching the
   * unit's real facing, which keeps driving muzzle direction and movement.
   */
  dir?: 1 | -1;
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

/**
 * Idle micro-motion: a soldier holding position briefly shifts to an alert
 * stance or takes a knee to scan, so the front line never freezes into
 * statues. Returns null most of the time; the caller falls back to the
 * normal idle frame. Phase is offset by uid so squads don't move in sync.
 */
export function idleMicroChoice(u: Unit, time: number): AdultFrameChoice | null {
  if (u.moving || u.fire > 0 || (u.aimUntil ?? 0) > time) return null;
  if (u.suppression > 0.4) return null;
  if (u.digging || u.tending || u.draggingUid !== undefined) return null;
  // Command vacuum: leaderless soldiers glance around nervously, cycling
  // between alert stance and a knee-scan on a short, irregular cadence so
  // the disorganisation reads visually without any UI hint.
  if (u.vacuum) {
    const phase = (time + u.uid * 3.91) % 4.6;
    if (phase < 1.1) return action(0);
    if (phase < 2.0) return action(1);
    return null;
  }
  // Alert stance: rifle across chest, ~1.6 s every 11 s.
  const alertPhase = (time + u.uid * 7.31) % 11;
  if (alertPhase < 1.6) return action(0);
  // Crouch glance: take a knee to scan, ~2.2 s every 27 s.
  const crouchPhase = (time + u.uid * 13.7) % 27;
  if (crouchPhase < 2.2) return action(1);
  return null;
}

/**
 * Sector scan: a soldier holding a position works through a structured scan
 * cycle — alert check to the front, take a knee and glance over the shoulder
 * toward the covered flank, then rise back to the alert stance. The scan is
 * animation-only: the returned `dir` overrides the sprite flip in the
 * renderer while the unit's real facing (muzzle direction, movement) is
 * untouched, and the omni-directional sight system means the scan never
 * changes what the soldier can actually see. Pure O(1) arithmetic; the phase
 * is offset by uid so a squad's scans interleave instead of rippling in
 * sync, and the period stretches slightly with uid so neighbours drift out
 * of phase over time.
 */
export function sectorScanChoice(
  u: Unit,
  time: number,
): AdultFrameChoice | null {
  if (u.hp <= 0 || u.wounded || u.surrendered) return null;
  if (u.moving || u.fire > 0 || (u.aimUntil ?? 0) > time) return null;
  if (u.suppression > 0.4) return null;
  if (u.digging || u.tending || u.draggingUid !== undefined) return null;
  if (u.vacuum) return null;
  if ((u.fragThrow ?? 0) > 0) return null;
  // Scanning is a deliberate hold behaviour: only from a standing idle pose.
  // Crouch/prone/hunker poses have their own glance cycles.
  if (u.pose !== 'idle') return null;
  // 23 s + up to ~8.5 s, so a six-man squad never locks into a shared rhythm.
  const period = 23 + (u.uid % 6) * 1.7;
  const phase = (time + u.uid * 5.77) % period;
  if (phase >= 3.0) return null;
  const front = (u.facing < 0 ? -1 : 1) as 1 | -1;
  const rear = (front * -1) as 1 | -1;
  // Beat 1 (0.0–0.9 s): alert stance, eyes front.
  if (phase < 0.9) return { ...action(0), dir: front };
  // Beat 2 (0.9–2.0 s): take a knee and check the covered flank/rear.
  if (phase < 2.0) return { ...action(1), dir: rear };
  // Beat 3 (2.0–3.0 s): rise back to the alert stance, eyes front.
  return { ...action(0), dir: front };
}

/**
 * Blast glance: a distant explosion snags a holding soldier's attention —
 * they snap to the alert stance and look toward the impact for a beat. Like
 * the sector scan this is animation-only: the returned `dir` flips the sprite
 * while the unit's real facing (muzzle direction, movement) is untouched, and
 * the omni-directional sight system means the glance never changes what the
 * soldier can see. Takes priority over the routine sector scan because a
 * fresh blast is far more salient than a scheduled sweep.
 */
export function blastGlanceChoice(
  u: Unit,
  time: number,
): AdultFrameChoice | null {
  if ((u.blastGlanceUntil ?? 0) <= time) return null;
  if (u.hp <= 0 || u.wounded || u.surrendered) return null;
  if (u.moving || u.fire > 0 || (u.aimUntil ?? 0) > time) return null;
  if (u.suppression > 0.4) return null;
  if (u.digging || u.tending || u.draggingUid !== undefined) return null;
  if (u.vacuum) return null;
  if ((u.fragThrow ?? 0) > 0) return null;
  if (u.pose !== 'idle') return null;
  return { ...action(0), dir: u.blastGlanceDir ?? 1 };
}

/**
 * Dug-in blast glance: the same distant-blast awareness as
 * {@link blastGlanceChoice}, but for soldiers holding a low crouch or prone
 * position. They keep their profile down — a crouching defender stays on one
 * knee, a prone defender stays on the deck — and only turn to track the
 * impact. Animation-only, exactly like the standing glance: the returned
 * `dir` flips the sprite while the real facing and the omni-directional
 * sight system are untouched. Heavily suppressed soldiers (hunker pose) are
 * gated out by the suppression check, so a pinned defender keeps their head
 * down instead of looking up at the shellburst.
 */
export function dugInBlastGlanceChoice(
  u: Unit,
  time: number,
): AdultFrameChoice | null {
  if ((u.blastGlanceUntil ?? 0) <= time) return null;
  if (u.hp <= 0 || u.wounded || u.surrendered) return null;
  if (u.moving || u.fire > 0 || (u.aimUntil ?? 0) > time) return null;
  if (u.suppression > 0.4) return null;
  if (u.digging || u.tending || u.draggingUid !== undefined) return null;
  if (u.vacuum) return null;
  if ((u.fragThrow ?? 0) > 0) return null;
  if (u.pose === 'crouch') return { ...action(1), dir: u.blastGlanceDir ?? 1 };
  if (u.pose === 'prone') return { ...action(2), dir: u.blastGlanceDir ?? 1 };
  return null;
}

/**
 * Trace glance: fresh drag marks on the ground — blood left by a casualty
 * hauled across the dirt — snag a holding soldier's attention for a beat.
 * Animation-only, exactly like the blast glance: the returned `dir` flips
 * the sprite toward the trace while the unit's real facing and the
 * omni-directional sight system are untouched. Ranks below the blast glance
 * because an explosion is more salient than a blood smear, but above the
 * routine sector scan because a fresh trail means recent contact nearby.
 */
export function traceGlanceChoice(
  u: Unit,
  time: number,
): AdultFrameChoice | null {
  if ((u.traceGlanceUntil ?? 0) <= time) return null;
  if (u.hp <= 0 || u.wounded || u.surrendered) return null;
  if (u.moving || u.fire > 0 || (u.aimUntil ?? 0) > time) return null;
  if (u.suppression > 0.4) return null;
  if (u.digging || u.tending || u.draggingUid !== undefined) return null;
  if (u.vacuum) return null;
  if ((u.fragThrow ?? 0) > 0) return null;
  if (u.pose !== 'idle') return null;
  return { ...action(0), dir: u.traceGlanceDir ?? 1 };
}

/**
 * Dug-in trace glance: the same blood-trail awareness as
 * {@link traceGlanceChoice}, but for soldiers holding a low crouch or prone
 * position. They keep their profile down and only turn to track the trace.
 * Animation-only, with the same gating as the dug-in blast glance — pinned
 * defenders keep their heads down instead of looking at the blood.
 */
export function dugInTraceGlanceChoice(
  u: Unit,
  time: number,
): AdultFrameChoice | null {
  if ((u.traceGlanceUntil ?? 0) <= time) return null;
  if (u.hp <= 0 || u.wounded || u.surrendered) return null;
  if (u.moving || u.fire > 0 || (u.aimUntil ?? 0) > time) return null;
  if (u.suppression > 0.4) return null;
  if (u.digging || u.tending || u.draggingUid !== undefined) return null;
  if (u.vacuum) return null;
  if ((u.fragThrow ?? 0) > 0) return null;
  if (u.pose === 'crouch')
    return { ...action(1), dir: u.traceGlanceDir ?? 1 };
  if (u.pose === 'prone')
    return { ...action(2), dir: u.traceGlanceDir ?? 1 };
  return null;
}

/**
 * Composed idle pose for the renderer: a structured sector scan takes
 * precedence over the random idle micro-motion, so the two never fight over
 * the same frame. A fresh blast glance outranks both — an explosion always
 * interrupts a routine scan. Dug-in defenders (crouch/prone) get their own
 * glance layer between the standing glance and the routine scan. A fresh
 * blood-trail glance ranks just below the blast glance — the trail means
 * recent contact, but a shellburst is louder. Returns null when the soldier
 * should hold the default patrol idle frame.
 */
export function idlePoseChoice(u: Unit, time: number): AdultFrameChoice | null {
  // A fresh hand-signal acknowledgment outranks routine scans and fidgets.
  if ((u.ackUntil ?? 0) > time) return null;
  return (
    blastGlanceChoice(u, time) ??
    dugInBlastGlanceChoice(u, time) ??
    traceGlanceChoice(u, time) ??
    dugInTraceGlanceChoice(u, time) ??
    sectorScanChoice(u, time) ??
    idleMicroChoice(u, time)
  );
}

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
    if (u.crawling)
      return action(Math.floor(u.walk * 2) % 2 ? 12 : 2);
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
  // While changing a cooked barrel the gunner drops to one knee and works the
  // weapon, alternating with a low crouch so the pause reads as urgent labour.
  if ((u.overheatedUntil ?? 0) > time && !u.moving)
    return action(Math.floor((u.overheatedUntil - time) * 2.2) % 2 ? 13 : 1);
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
  // Squad leaders pump a hand signal for a beat after an order changes, so the
  // chain of command reads on the field. The arm-over-head frame alternates
  // with the alert stand so it waves instead of freezing like a statue.
  if ((u.signalUntil ?? 0) > time && !u.moving && u.fire <= 0)
    return action(Math.floor((u.signalUntil - time) * 6) % 2 ? 8 : 0);
  // Squad mates answer a fresh hand signal with a quick return pump of the
  // arm. Only upright members answer — crouched and prone defenders stay low
  // instead of popping up out of a trench to wave back.
  if (
    (u.ackUntil ?? 0) > time &&
    !u.moving &&
    u.fire <= 0 &&
    (u.aimUntil ?? 0) <= time &&
    (u.reloadingUntil ?? 0) <= time &&
    (u.pose === 'idle' || u.pose === 'walk')
  )
    return action(Math.floor((u.ackUntil - time) * 7) % 2 ? 8 : 0);
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
    if (u.moving) {
      // Hauling a casualty: a slow, heavy gait at half the cadence of a
      // normal crouch-walk so the drag reads as effort, not patrol.
      const gait = u.draggingUid !== undefined ? u.walk / 2 : step;
      return { group: 'crouch8', index: cycle(gait, 8) };
    }
    if (reloading) return action(13);
    return action(1);
  }
  if (u.pose === 'hunker') {
    if (u.moving) return { group: 'crouch8', index: cycle(step, 8) };
    if (reloading) return action(13);
    // Pinned behind cover: head down, stealing a brief glance over the rim
    // every few seconds to check whether the coast is clear. The phase is
    // offset by uid so a whole squad doesn't peek in unison.
    const glance = (time + u.uid * 5.17) % 6.5;
    if (glance < 0.5) return action(1);
    return reaction(5);
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
  if (pose === 'crouch' || pose === 'hunker' || pose === 'land')
    return age < 0.45
      ? reaction(5 + Math.min(2, Math.floor(age * 6)))
      : action(15);
  return age < 0.6
    ? reaction(4 + Math.min(3, Math.floor(age * 6)))
    : action(15);
}
