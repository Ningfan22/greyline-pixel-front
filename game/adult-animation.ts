import { CARDS, type CardId } from './cards';
import type { Unit } from './engine';
import { GRENADE_THROW_S, POSE_TRANSITION_S } from './infantry-action-timing';
import { isPrecisionObserver } from './precision-team';
export type AdultIdentity = 'infantry' | 'marines' | 'police' | 'militia';
export interface AdultSprites {
  walk8: HTMLCanvasElement[];
  crouch8: HTMLCanvasElement[];
  actions20: HTMLCanvasElement[];
  reactions8: HTMLCanvasElement[];
  /** v121: dedicated hand-signal frames — point fwd, wave overhead, point back, fist. */
  signals4: HTMLCanvasElement[];
  reload8: HTMLCanvasElement[];
  grenade8: HTMLCanvasElement[];
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
const sig = (index: number): AdultFrameChoice => ({
  group: 'signals4',
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
  // v118: standing-only. A crouched or prone soldier who popped back to the
  // standing alert frame every few seconds read as a jack-in-the-box; the
  // low poses have their own fidget layers below.
  if (u.pose !== 'idle') return null;
  // Command vacuum: leaderless soldiers glance around nervously, cycling
  // between alert stance and a knee-scan on a short, irregular cadence so
  // the disorganisation reads visually without any UI hint.
  if (u.vacuum) {
    const phase = (time + u.uid * 3.91) % 4.6;
    if (phase < 1.1) return action(0);
    if (phase < 2.0) return action(0);
    return null;
  }
  // Idle vigilance can turn the soldier, but cannot change body height.
  // All actual kneeling/standing decisions belong to the stance gate.
  const period = 9 + (u.uid % 5) * 1.3;
  const phase = (time + u.uid * 7.31) % period;
  if (phase < 3.3) return action(0);
  if (phase < 3.9) {
    // rise and glance over the shoulder toward the covered flank
    const front = (u.facing < 0 ? -1 : 1) as 1 | -1;
    return { ...action(0), dir: (front * -1) as 1 | -1 };
  }
  return null;
}

/**
 * v118: crouch idle fidget — a soldier holding a knee periodically shifts
 * into a low crouch or leans forward to work the sector, so a dug-in line
 * doesn't freeze into identical statues. Returns null most of the time; the
 * caller falls back to the static kneel. Animation-only, like the other
 * idle layers. The period drifts with uid so neighbours desynchronise.
 */
export function crouchFidgetChoice(
  u: Unit,
  time: number,
): AdultFrameChoice | null {
  if (u.pose !== 'crouch') return null;
  if (u.moving || u.fire > 0 || (u.aimUntil ?? 0) > time) return null;
  if (u.suppression > 0.4) return null;
  if (u.digging || u.tending || u.draggingUid !== undefined) return null;
  if (u.vacuum) return null;
  if ((u.fragThrow ?? 0) > 0) return null;
  const period = 10 + (u.uid % 4) * 0.9;
  const phase = (time + u.uid * 6.13) % period;
  if (phase < 1.4) return action(1); // action 17 is a running frame, not a crouch
  if (phase < 2.4) return action(13); // lean forward to scan the sector
  return null;
}

/**
 * v118: prone idle fidget — the deck-level counterpart of
 * {@link crouchFidgetChoice}. A prone defender stirs between working the
 * ground and a low crawl posture so a held line reads as living vigilance
 * instead of a row of corpses. Same busy-gates as the crouch fidget.
 */
export function proneFidgetChoice(
  u: Unit,
  time: number,
): AdultFrameChoice | null {
  if (u.pose !== 'prone') return null;
  if (u.moving || u.fire > 0 || (u.aimUntil ?? 0) > time) return null;
  if (u.suppression > 0.4) return null;
  if (u.digging || u.tending || u.draggingUid !== undefined) return null;
  if (u.vacuum) return null;
  if ((u.fragThrow ?? 0) > 0) return null;
  const period = 11 + (u.uid % 4) * 1.1;
  const phase = (time + u.uid * 5.47) % period;
  if (phase < 1.5) return action(3); // prone, working the weapon/ground
  if (phase < 2.6) return action(12); // low crawl posture, shifting position
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
  // Beat 2 (0.9–2.0 s): check the flank without taking an unscheduled knee.
  if (phase < 2.0) return { ...action(0), dir: rear };
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
  // Do not let decorative layers replace a throw, reload, or an authored
  // stance transition. They must never invent a different body height.
  if ((u.fragThrow ?? 0) > 0 || (u.reloadingUntil ?? 0) > time ||
      u.poseAnimFrom !== undefined || u.flash > 0 || u.tending) return null;
  return (
    heardContactGlanceChoice(u, time) ??
    blastGlanceChoice(u, time) ??
    dugInBlastGlanceChoice(u, time) ??
    traceGlanceChoice(u, time) ??
    dugInTraceGlanceChoice(u, time) ??
    boundingRestChoice(u, time) ??
    crouchFidgetChoice(u, time) ??
    proneFidgetChoice(u, time) ??
    magCheckChoice(u, time) ??
    engineerFussChoice(u, time) ??
    sectorScanChoice(u, time) ??
    idleMicroChoice(u, time)
  );
}

/**
 * Contact callout: the beat after a soldier spots the enemy, they shout the
 * contact to their squad — arm up and pointing at the threat, alternating
 * with the alert stand so the shout reads as a wave, not a statue.
 * Animation-only, exactly like the glance layers: the returned `dir` points
 * the shout at the contact without touching the unit's real facing. Only
 * upright, unengaged soldiers call out — a man already firing, aiming or
 * reloading keeps the weapon on the threat instead of waving.
 */
export function contactCalloutChoice(
  u: Unit,
  time: number,
): AdultFrameChoice | null {
  if ((u.calloutUntil ?? 0) <= time) return null;
  if (u.moving || u.fire > 0) return null;
  if ((u.aimUntil ?? 0) > time) return null;
  if ((u.reloadingUntil ?? 0) > time) return null;
  if (u.pose !== 'idle' && u.pose !== 'walk') return null;
  const dir = u.calloutDir ?? 1;
  const wave = Math.floor(((u.calloutUntil ?? 0) - time) * 6) % 2;
  // v128: dedicated hand-signal frames — the old action(9) is the climb
  // pose (arm up + knee raised), so a contact shout read as a man scaling
  // a wall in the middle of a field. sig(1) waves overhead, sig(0) points.
  return wave ? { ...sig(1), dir } : { ...sig(0), dir };
}

/**
 * v118: leader point-out — while in contact, a squad leader periodically
 * points an arm at the threat so the squad orients on the right target.
 * Animation-only, exactly like the callout: the returned `dir` points the
 * gesture without touching the unit's real facing. Only upright, unengaged
 * leaders point — a man already firing, aiming or reloading keeps the
 * weapon on the threat instead of waving.
 */
export function leaderPointChoice(
  u: Unit,
  time: number,
): AdultFrameChoice | null {
  if ((u.pointUntil ?? 0) <= time) return null;
  if (u.moving || u.fire > 0) return null;
  if ((u.aimUntil ?? 0) > time) return null;
  if (u.suppression > 0.4) return null;
  if (u.pose !== 'idle' && u.pose !== 'walk') return null;
  if (u.digging || u.tending || u.draggingUid !== undefined) return null;
  if ((u.fragThrow ?? 0) > 0) return null;
  // v128: sig(0) point-forward instead of the climb pose (see above).
  return { ...sig(0), dir: u.pointDir ?? 1 };
}

/**
 * Heard-contact glance: a squad mate's shout travels faster than the threat.
 * For a beat after `heardContactAt`, a soldier who hasn't spotted the enemy
 * themselves snaps to the alert stand and looks toward the shouted bearing,
 * so a platoon reacts as one when contact is called. Animation-only: the
 * `dir` flip never changes the unit's real facing or what the omni-sight
 * system can see. Suppressed once the soldier has made their own contact —
 * a man in the fight has no attention left for second-hand shouts.
 */
export function heardContactGlanceChoice(
  u: Unit,
  time: number,
): AdultFrameChoice | null {
  if (u.heardContactAt === undefined) return null;
  if (time - u.heardContactAt >= 0.7) return null;
  if (u.moving || u.fire > 0) return null;
  if ((u.reloadingUntil ?? 0) > time) return null;
  if (u.pose !== 'idle') return null;
  if ((u.contactUntil ?? 0) > time) return null;
  return { ...action(0), dir: u.heardContactDir ?? 1 };
}

/**
 * Bounding rest: after a fireteam finishes a bound, the lead element drops to
 * a knee for a beat to catch its breath while the overwatch element moves.
 * The engine sets `boundRestUntil` at the end of a bound; the soldier holds
 * the single-knee frame until it expires, so the fireteam-manoeuvre rhythm
 * reads on the field instead of every man standing tall the whole time.
 */
export function boundingRestChoice(
  u: Unit,
  time: number,
): AdultFrameChoice | null {
  if ((u.boundRestUntil ?? 0) <= time) return null;
  if (u.moving || u.fire > 0) return null;
  if ((u.reloadingUntil ?? 0) > time) return null;
  if (u.pose !== 'idle') return null;
  return action(0);
}

/**
 * v120: magazine check — a rifleman holding position periodically hunches
 * over the mag well and seats/checks the magazine, so a held line reads as
 * professionals maintaining their kit instead of statues. Animation-only.
 * Only for units with magazine-managed ammo (ammo >= 0); crews and energy
 * weapons have no mag to check.
 */
export function magCheckChoice(
  u: Unit,
  time: number,
): AdultFrameChoice | null {
  if (u.ammo === undefined || u.ammo < 0) return null;
  if (u.hp <= 0 || u.wounded || u.surrendered) return null;
  if (u.moving || u.fire > 0 || (u.aimUntil ?? 0) > time) return null;
  if (u.suppression > 0.4) return null;
  if (u.digging || u.tending || u.draggingUid !== undefined) return null;
  if (u.vacuum) return null;
  if ((u.fragThrow ?? 0) > 0) return null;
  if (u.pose !== 'crouch') return null;
  const period = 21 + (u.uid % 5) * 1.3;
  const phase = (time + u.uid * 6.83) % period;
  if (phase >= 2.6) return null;
  if (phase < 0.9) return action(13); // hunch over the mag well
  if (phase < 1.7) return action(1); // drop a knee to seat/check the mag
  return action(13); // back to the hunch
}

/**
 * v120: engineer fuss — a sapper holding position periodically drops to a
 * knee and fusses with his kit (detonator, charges, tools), so the squad's
 * technical specialist reads as a man with a job to do even when idle.
 * Animation-only. Only for engineer-trait cards.
 */
export function engineerFussChoice(
  u: Unit,
  time: number,
): AdultFrameChoice | null {
  if (CARDS[u.id].trait !== 'engineer') return null;
  if (u.hp <= 0 || u.wounded || u.surrendered) return null;
  if (u.moving || u.fire > 0 || (u.aimUntil ?? 0) > time) return null;
  if (u.suppression > 0.4) return null;
  if (u.digging || u.tending || u.draggingUid !== undefined) return null;
  if (u.vacuum) return null;
  if ((u.fragThrow ?? 0) > 0) return null;
  if (u.pose !== 'crouch') return null;
  const period = 16 + (u.uid % 4) * 1.2;
  const phase = (time + u.uid * 5.29) % period;
  if (phase >= 2.8) return null;
  // Keep the work on one knee; bank/vault frames do not belong in this drill.
  if (phase < 1.2) return action(13); // kneeling, working the kit
  if (phase < 2.0) return action(1); // keep the established kneeling height
  return action(13); // back to the kneeling work
}

/**
 * v110: authored pose transitions. When a soldier's height class changes
 * (stand ↔ crouch ↔ prone), the renderer plays a short chain of existing
 * hand-drawn frames instead of snapping straight to the new pose. The
 * animator tracks the last height class it drew on the unit itself, so no
 * engine instrumentation is needed — the first draw after a pose change
 * starts the transition.
 *
 * Frame vocabulary (actions20): 0 = standing alert, 1 = knee kneel (the
 * crouch idle), 2 = prone, 6 = landing crouch (drop-in beat), 7 = landing
 * stable (half-rise beat). The chains read as: drop into a crouch, settle
 * onto a knee, then lie flat — and the reverse on the way up.
 *
 * Transitions only play for stationary soldiers: the walk / crouch-walk /
 * crawl cycles already carry a moving pose change, and sliding knee-frames
 * look worse than a clean snap. A fresh reload or hit flinch also takes
 * precedence for its beat; the time-based window simply resumes afterwards.
 */
const POSE_CHAINS: Record<
  'stand' | 'crouch' | 'prone',
  Partial<Record<'stand' | 'crouch' | 'prone', number[]>>
> = {
  stand: { crouch: [0, 6, 1], prone: [0, 6, 1, 2] },
  crouch: { stand: [1, 7, 0], prone: [1, 2] },
  prone: { stand: [2, 1, 7, 0], crouch: [2, 1] },
};
/** Work may move the arms, but never invent a new stance behind the AI's back. */
function groundedWork(u: Unit, time: number): AdultFrameChoice {
  if (u.pose === 'prone') return action(3);
  if (u.pose === 'crouch' || u.pose === 'hunker')
    return action(Math.floor(time * 1.5 + u.uid) % 2 ? 13 : 1);
  return action(0);
}

/**
 * v113: reloads read as a four-beat drill instead of a static hunch. The
 * engine stamps `reloadingStartAt` when the dry receiver locks back, so the
 * animation tracks progress through the reload window — drop the spent mag,
 * grab a fresh one, seat it, rack the charging handle — rather than freezing
 * on one frame for the whole duration. Prone soldiers stay on the deck and
 * alternate the lie with the prone-reload frame so the mag swap still reads
 * as active work at ground level.
 */
function reloadBeat(u: Unit, time: number): AdultFrameChoice {
  const until = u.reloadingUntil ?? 0;
  const startedAt = u.reloadingStartAt ?? until - 1.4;
  const duration = Math.max(0.001, until - startedAt);
  const elapsed = Math.min(duration, Math.max(0, time - startedAt));
  if (u.pose === 'prone')
    return action(Math.floor(elapsed * 3) % 2 ? 3 : 2);
  const beat = Math.min(3, Math.floor((elapsed / duration) * 4));
  // v128: frames 8/9 are the CLIMB cycle (raised hand + raised knee). The old
  // chains reused them for the "seat the mag" / "rack the handle" beats, which
  // is why reloading soldiers kept flashing the swim-lane climb pose. Use the
  // kneeling-work frame (13) and the single-knee frame (1) for the active
  // beats instead — same hunch-and-reach read, no climb.
  // Crouched: hunch over the mag well, drop to a knee, hunch again, arm
  // forward to seat the fresh mag.
  if (u.pose === 'crouch' || u.pose === 'hunker') return action([13, 1, 13, 1][beat]);
  // Eight newly painted standing cels; no reused knee, command or rope poses.
  return { group: 'reload8', index: Math.min(7, Math.floor(elapsed / duration * 8)) };
}

function poseHeightClass(
  pose: Unit['pose'],
): 'stand' | 'crouch' | 'prone' {
  if (pose === 'prone') return 'prone';
  if (pose === 'crouch' || pose === 'hunker') return 'crouch';
  // 'jump', 'land' and 'climb' are transient motion states with their own
  // animation branches; counting them as stand avoids a spurious knee-drop
  // after every landing.
  return 'stand';
}

export function poseTransitionChoice(
  u: Unit,
  time: number,
): AdultFrameChoice | null {
  const cls = poseHeightClass(u.pose);
  if (u.poseAnimSeen === undefined) {
    u.poseAnimSeen = cls;
    return null;
  }
  if (u.poseAnimSeen !== cls) {
    u.poseAnimFrom = u.poseAnimSeen;
    u.poseAnimAt = time;
    u.poseAnimSeen = cls;
  }
  const from = u.poseAnimFrom;
  if (from === undefined || from === cls) return null;
  const chain = POSE_CHAINS[from]?.[cls];
  if (!chain) return null;
  const window = POSE_TRANSITION_S;
  const elapsed = time - (u.poseAnimAt ?? time);
  if (elapsed >= window) {
    u.poseAnimFrom = undefined;
    return null;
  }
  // A burst/reload cannot repeatedly hide the intermediate frames. Horizontal
  // navigation remains independent so a pose animation cannot strand a mover.
  const idx = Math.min(chain.length - 1, Math.floor(elapsed / window * chain.length));
  return action(chain[idx]);
}

/** Every living, casualty and surrender state uses the same adult anatomy. */
export function adultFrameChoice(u: Unit, time = 0): AdultFrameChoice {
  // Reverse the existing raised-rifle gait while the body keeps facing contact.
  const step = u.backpedaling ? -Math.floor(u.walk) : u.walk;
  if (u.hp <= 0) return action(15);
  // v133: surrender is checked BEFORE the rope/parachute branch. A stuck
  // rappelling flag (morale break mid-descent) must never override hands-up —
  // that ordering was how whole squads froze in the swim-lane climb pose.
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
  // Rope poses are only for healthy soldiers actively descending.
  if (u.rappelling) return action(8 + cycle(u.walk / 2, 2));
  const poseTransition = poseTransitionChoice(u, time);
  if (poseTransition && u.motion === 'ground') return poseTransition;
  // Simulation and cels share a clock: the projectile leaves after cel five.
  if ((u.fragThrow ?? 0) > 0) {
    const elapsed = GRENADE_THROW_S - (u.fragThrow ?? 0);
    if (poseHeightClass(u.pose) === 'stand')
      return { group: 'grenade8', index: Math.min(7, Math.max(0, Math.floor(elapsed / GRENADE_THROW_S * 8))) };
    // v120: pose-specific throw chains so a crouching grenadier stays on a
    // knee and a prone one stays on the deck instead of popping to standing.
    // v128: the middle beat used frame 9 (climb — raised knee + arm), which
    // read as the swim-lane pose. The kneeling-work frame (13) carries the
    // same arm-cocked release without the climb silhouette.
    // v130: the crouch wind-up still used frame 11 — ALSO a climb frame —
    // so every crouched grenadier flashed the swimmer pose. Wind-up now
    // stays on the kneeling-work beat (13) and release on the plain kneel (1).
    const chain =
      u.pose === 'prone'
        ? [3, 12, 2]
        : u.pose === 'crouch' || u.pose === 'hunker'
          ? [13, 1, 13]
          : [0, 0, 0];
    if (elapsed < GRENADE_THROW_S / 2) return action(chain[0]); // wind-up
    if (elapsed < GRENADE_THROW_S * 0.75) return action(chain[1]); // release
    return action(chain[2]); // follow-through
  }
  // Medics alternate between a kneeling pose and a low crouch while treating,
  // never the hit-reaction fall frames.
  if (u.tending)
    return u.pose === 'prone' ? action(3)
      : u.pose === 'crouch' || u.pose === 'hunker'
        ? action(Math.floor((u.tendingTime ?? 0) * 2) % 2 ? 13 : 1)
        : action(0);
  // While changing a cooked barrel the gunner drops to one knee and works the
  // weapon, alternating with a low crouch so the pause reads as urgent labour.
  if ((u.overheatedUntil ?? 0) > time && !u.moving)
    return groundedWork(u, time);
  if (u.motion === 'jump') return action(u.motionTime < 0.12 ? 4 : 5);
  if (u.motion === 'land')
    return action(u.motionTime < u.motionDuration * 0.5 ? 6 : 7);
  // v130: walls were removed from the map generator (wallSites: []), so
  // u.climbing is never set in normal play. The old branch returned the
  // climb frames (8-11) which read as the swim-lane pose; if climbing ever
  // comes back it must use a dedicated vault animation, never these frames.
  // Until then, fall through to the crouch gait like a bank out of cover.
  if (u.climbing > 0)
    return { group: 'crouch8', index: cycle(Math.floor(u.motionTime * 8), 8) };
  if (u.motion === 'bank')
    return u.pose === 'prone' ? action(cycle(u.walk / 2, 2) ? 12 : 2)
      : u.pose === 'crouch' || u.pose === 'hunker'
        ? { group: 'crouch8', index: cycle(step, 8) }
        : { group: 'walk8', index: cycle(step, 8) };
  // v81: dry-ammo battle drill. The engine sets reloadingUntil on the dry
  // receiver only, so during the handoff the pair splits into a giver (arm
  // extended with the magazine) and a receiver (hunched over the mag well)
  // instead of two identical hunches. Only upright soldiers run the drill —
  // a pinned rifleman stays low and waits for a lull in the fire.
  if ((u.ammoShareUntil ?? 0) > time && u.pose !== 'prone')
    // v128: giver extends an arm (sig point-forward) instead of the climb pose.
    return u.pose === 'crouch' || u.pose === 'hunker' ? action(13) : action(0);
  // v83: looting a fallen comrade's kit — a knee-down rummage beat
  // alternating with the huddled work beat so the search reads as active.
  if ((u.scavengeUntil ?? 0) > time && u.pose !== 'prone')
    return groundedWork(u, time);
  // v84: combat lifesaver working a tourniquet — the medic kneel / low-crouch
  // rhythm already used while tending, so the aid reads as skilled labour.
  if ((u.firstAidUntil ?? 0) > time && u.pose !== 'prone')
    return u.pose === 'crouch' || u.pose === 'hunker'
      ? action(Math.floor(time * 2 + u.uid) % 2 ? 13 : 1) : action(0);
  if (
    (u.ammoSignalUntil ?? 0) > time &&
    !u.moving &&
    u.fire <= 0 &&
    (u.aimUntil ?? 0) <= time &&
    (u.reloadingUntil ?? 0) <= time &&
    (u.pose === 'idle' || u.pose === 'walk')
  ) {
    // The ammunition UI already communicates this state. No raised-arm
    // command animation, and no decorative drop to a knee.
    return groundedWork(u, time);
  }
  // v119: weapon crews work the gun while emplacing. MG / AT gun / mortar
  // setup is 1.2s of labour — the crew alternates the bent-work beat with
  // the kneel so they read as hauling the weapon into position instead of
  // standing frozen beside it. Prone/hunker crews stay low (they're pinned,
  // not emplacing), and moving crews are handled by the gait branches below.
  if (
    (u.emplacementSetupUntil ?? 0) > time &&
    !u.moving &&
    u.pose !== 'prone' &&
    u.pose !== 'hunker'
  )
    return groundedWork(u, time);
  // Stance transitions are resolved above the work actions, before arrival
  // at the stable prone/crouch frames below.
  const reloading = (u.reloadingUntil ?? 0) > time;
  if (u.pose === 'prone') {
    if (u.moving) return action(cycle(u.walk / 2, 2) ? 12 : 2);
    // Work the radio from prone; observation never raises the silhouette.
    if (u.id === 'scouts' || isPrecisionObserver(u)) {
      const radioT = (time + u.uid * 1.37) % 4.4;
      if (radioT < 1.2) return action(3);
    }
    if (reloading) return reloadBeat(u, time);
    // v117: firing from the deck — alternate the lie with the prone-reload
    // frame so a burst reads as the weapon working instead of a frozen
    // corpse. Covers both the primary and the underslung secondary.
    if (u.fire > 0 || u.secondaryFire > 0)
      return action(Math.floor((u.fire + u.secondaryFire) * 14) % 2 ? 3 : 2);
    // v119: in contact (aimUntil is refreshed on every engagement) a prone
    // soldier keeps working the weapon between bursts — the lie alternates
    // with the prone-work frame so the held line looks alive instead of a
    // row of corpses. The phase is offset by uid so a squad doesn't sway in
    // sync. idleMicro yields whenever aimUntil is active, so this shows.
    if ((u.aimUntil ?? 0) > time)
      return Math.floor(time * 2.2 + u.uid * 1.7) % 2 ? action(3) : action(2);
    return action(2);
  }
  if (u.pose === 'crouch') {
    if (u.moving) {
      // Hauling a casualty: a slow, heavy gait at half the cadence of a
      // normal crouch-walk so the drag reads as effort, not patrol.
      const gait = u.draggingUid !== undefined ? u.walk / 2 : step;
      return { group: 'crouch8', index: cycle(gait, 8) };
    }
    if (reloading) return reloadBeat(u, time);
    // v117: firing from a knee — alternate the kneel with the hunched brace
    // so the burst has a recoil cadence instead of one static pose.
    if (u.fire > 0 || u.secondaryFire > 0)
      return action(Math.floor((u.fire + u.secondaryFire) * 14) % 2 ? 13 : 1);
    // v119: a crouched soldier in contact keeps the gun shouldered between
    // bursts, shifting from the kneel to the hunched brace so the held
    // position reads as aimed overwatch, not a man resting on one knee.
    if ((u.aimUntil ?? 0) > time)
      return Math.floor(time * 2.2 + u.uid * 1.7) % 2 ? action(13) : action(1);
    return action(1);
  }
  if (u.pose === 'hunker') {
    if (u.moving) return { group: 'crouch8', index: cycle(step, 8) };
    if (reloading) return reloadBeat(u, time);
    // Heavy suppression: the soldier drops fully to the deck, too pinned to
    // kneel or steal a glance. They lie on their side hugging the earth,
    // stirring between a propped-on-elbow lie and a full curl so the pin
    // reads as living fear rather than a static corpse. Only the down-time
    // between peeks reaches this branch — peekShouldExpose still lifts them
    // to fire — so the cower shows a soldier forcing themselves up to shoot
    // and dropping back flat, never a hard stun. The phase is offset by uid
    // so a pinned squad doesn't cower in sync.
    if (u.suppression >= 80) {
      const cower = (time + u.uid * 3.31) % 5.2;
      return action(cower < 3.4 ? 13 : 1);
    }
    // Pinned behind cover: head down, stealing a brief glance over the rim
    // every few seconds to check whether the coast is clear. The phase is
    // offset by uid so a whole squad doesn't peek in unison.
    const glance = (time + u.uid * 5.17) % 6.5;
    if (glance < 0.5) return action(1);
    return action(13);
  }
  if (u.moving)
    return u.pose === 'run' || u.tactic === 'retreat'
      ? action(16 + cycle(u.walk / 2, 4))
      : { group: 'walk8', index: cycle(step, 8) };
  // v105: hit flinches — a tall stagger, a knee-buck and a deep cower-flinch
  // — so a burst walking across a squad doesn't pop the identical frame on
  // every man. v116 widened the spread from two to three variants, v118 to
  // four — the deep curl joins the rotation. v120: the flinch now cycles
  // across the full 0.16s hit window instead of flashing for 0.03s, so a
  // burst reads as a live reaction chain — stagger, knee-soft, curl, squat —
  // rather than a single popped frame.
  if (u.flash > 0) {
    return reaction(4);
  }
  // A stationary rifleman keeps the aimed stance (action 0) while firing —
  // the renderer's patrol layer overlays the dedicated aimed-rifle pose
  // (raise3[2]) for the whole burst, so the weapon reads as shouldered and
  // on target between shots instead of rocking through gait frames.
  if (reloading) return reloadBeat(u, time);
  // v117: underslung / personal secondary discharge — the arm-forward frame
  // for the 0.09s window so a GL or pistol shot reads as its own beat
  // instead of vanishing under the patrol idle. Non-plain on purpose: it
  // makes the patrol layer yield so the frame actually shows.
  if (
    u.secondaryFire > 0 &&
    !u.moving &&
    (u.pose === 'idle' || u.pose === 'walk')
  )
    // v128: point-forward signal beat instead of the climb pose.
    return action(0);
  return action(0);
}
export function adultWreckChoice(
  age: number,
  pose?: Unit['pose'],
  seed = 0,
): AdultFrameChoice {
  if (pose === 'prone') return action(15);
  // v105: visibly different death throes so a field of casualties doesn't
  // play the same stagger in unison. v116 widened the spread from three to
  // six variants — classic stagger, knee crumple, clean drop, forward pitch,
  // slow sink and a spin — so a platoon's worth of wrecks rarely repeats.
  // v120 widened to eight — a double-take stagger and a slow fold join the
  // rotation.
  // The seed is the casualty's uid, stable for the wreck's whole lifetime.
  const variant = seed % 8;
  if (variant === 2) return action(15); // clean drop: killed mid-stride
  if (pose === 'crouch' || pose === 'hunker' || pose === 'land')
    return age < 0.45
      ? reaction(5 + Math.min(2, Math.floor(age * 6)))
      : action(15);
  if (variant === 1)
    // Crumple: buckle at the knees first, then go down.
    return age < 0.5
      ? reaction(5 + Math.min(1, Math.floor(age * 4)))
      : action(15);
  if (variant === 3)
    // Forward pitch: flinch, then pitch onto the face.
    return age < 0.55
      ? age < 0.25
        ? reaction(4)
        : reaction(7)
      : action(15);
  if (variant === 4)
    // Slow sink: knees give out slowly, then the body folds.
    return age < 0.7 ? (age < 0.4 ? reaction(5) : reaction(7)) : action(15);
  if (variant === 5)
    // Spin: twist under the impact, stagger, then drop.
    return age < 0.6
      ? [reaction(6), reaction(4), reaction(7)][
          Math.min(2, Math.floor(age * 5))
        ]
      : action(15);
  if (variant === 6)
    // v120: double-take stagger — flinch, curl, deep squat before dropping.
    return age < 0.55
      ? [reaction(4), reaction(6), reaction(7)][
          Math.min(2, Math.floor(age * 5))
        ]
      : action(15);
  if (variant === 7)
    // v120: slow fold — curl, knee-soft, then down.
    return age < 0.7 ? (age < 0.35 ? reaction(6) : reaction(5)) : action(15);
  // Classic: hit stagger, stumble, drop.
  return age < 0.6
    ? reaction(4 + Math.min(3, Math.floor(age * 6)))
    : action(15);
}

/**
 * v106: a soldier thrown by a blast. While airborne the body cycles the
 * stagger/flinch frames fast so the tumble reads as a man flung through the
 * air; the renderer spins the sprite on the wreck's spin axis. On landing the
 * wreck switches to adultWreckChoice's final prone frame.
 */
export function ragdollChoice(age: number, seed = 0): AdultFrameChoice {
  return reaction(4 + ((Math.floor(age * 12) + (seed % 2)) % 4));
}
