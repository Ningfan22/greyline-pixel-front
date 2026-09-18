import { CARDS, type CardId } from './cards';
import type { Unit } from './engine';
export type AdultIdentity = 'infantry' | 'marines' | 'police' | 'militia';
export interface AdultSprites {
  walk8: HTMLCanvasElement[];
  crouch8: HTMLCanvasElement[];
  actions20: HTMLCanvasElement[];
  reactions8: HTMLCanvasElement[];
  /** v121: dedicated hand-signal frames — point fwd, wave overhead, point back, fist. */
  signals4: HTMLCanvasElement[];
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
    if (phase < 2.0) return action(1);
    return null;
  }
  // v114: a four-beat fidget cycle so holding position reads as living
  // vigilance — alert stance, take a knee, lean forward to scan the sector,
  // rise and glance over the shoulder — instead of two isolated poses. The
  // period stretches with uid so neighbours drift out of phase over time.
  const period = 9 + (u.uid % 5) * 1.3;
  const phase = (time + u.uid * 7.31) % period;
  if (phase < 1.4) return action(0); // alert stance, rifle across chest
  if (phase < 2.6) return action(1); // take a knee
  if (phase < 3.3) return action(13); // lean forward to scan
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
  if (phase < 1.4) return action(17); // low crouch, weight shifted off the knee
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
  return (
    contactCalloutChoice(u, time) ??
    heardContactGlanceChoice(u, time) ??
    leaderPointChoice(u, time) ??
    blastGlanceChoice(u, time) ??
    dugInBlastGlanceChoice(u, time) ??
    traceGlanceChoice(u, time) ??
    dugInTraceGlanceChoice(u, time) ??
    boundingRestChoice(u, time) ??
    leaderRadioChoice(u, time) ??
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
  return wave ? { ...action(9), dir } : { ...action(0), dir };
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
  return { ...action(9), dir: u.pointDir ?? 1 };
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
  return action(1);
}

/**
 * v120: leader radio beat — a squad leader holding position out of contact
 * periodically raises a hand to his ear as if working the radio, alternating
 * with the alert stance so the beat reads as a live comms check instead of a
 * statue. Animation-only, like the other idle layers. Only fires out of
 * contact — a leader in a fight has the point-out and callout layers above.
 */
export function leaderRadioChoice(
  u: Unit,
  time: number,
): AdultFrameChoice | null {
  if (!u.leader) return null;
  if ((u.contactUntil ?? 0) > time) return null;
  if (u.hp <= 0 || u.wounded || u.surrendered) return null;
  if (u.moving || u.fire > 0 || (u.aimUntil ?? 0) > time) return null;
  if (u.suppression > 0.4) return null;
  if (u.digging || u.tending || u.draggingUid !== undefined) return null;
  if (u.vacuum) return null;
  if ((u.fragThrow ?? 0) > 0) return null;
  if (u.pose !== 'idle') return null;
  const period = 13 + (u.uid % 4) * 1.1;
  const phase = (time + u.uid * 4.57) % period;
  if (phase >= 2.4) return null;
  return Math.floor((2.4 - phase) * 2.6) % 2 ? action(8) : action(0);
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
  if (u.pose !== 'idle') return null;
  const period = 21 + (u.uid % 5) * 1.3;
  const phase = (time + u.uid * 6.83) % period;
  if (phase >= 2.6) return null;
  if (phase < 0.9) return action(13); // hunch over the mag well
  if (phase < 1.7) return action(9); // arm forward, seat/check the mag
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
  if (u.pose !== 'idle') return null;
  const period = 16 + (u.uid % 4) * 1.2;
  const phase = (time + u.uid * 5.29) % period;
  if (phase >= 2.8) return null;
  if (phase < 1.2) return action(11); // kneeling, working the kit
  if (phase < 2.0) return action(13); // hunch over the task
  return action(11); // back to the kneeling work
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
// v127: stance transitions play at half speed so stand/crouch/prone changes
// read as deliberate movement instead of a snap.
const POSE_FRAME_S = 0.3;

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
  // Crouched: hunch over the mag well, drop to a knee, hunch again, arm
  // forward to seat the fresh mag.
  if (u.pose === 'crouch') return action([13, 1, 13, 9][beat]);
  // Standing / hunkered: hunch, arm forward to the chest rig, hunch to seat
  // the mag, arm overhead to rack the charging handle.
  return action([13, 9, 13, 8][beat]);
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
  const window = chain.length * POSE_FRAME_S;
  const elapsed = time - (u.poseAnimAt ?? time);
  if (elapsed >= window) {
    u.poseAnimFrom = undefined;
    return null;
  }
  if (u.moving || (u.reloadingUntil ?? 0) > time || u.flash > 0.13) return null;
  const idx = Math.min(chain.length - 1, Math.floor(elapsed / POSE_FRAME_S));
  return action(chain[idx]);
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
    // v120: pose-specific throw chains so a crouching grenadier stays on a
    // knee and a prone one stays on the deck instead of popping to standing.
    const chain =
      u.pose === 'prone'
        ? [3, 9, 2]
        : u.pose === 'crouch'
          ? [11, 9, 10]
          : [8, 9, 10];
    if (t > 0.33) return action(chain[0]); // wind-up
    if (t > 0.17) return action(chain[1]); // release
    return action(chain[2]); // follow-through
  }
  // Medics alternate between a kneeling pose and a low crouch while treating,
  // never the hit-reaction fall frames.
  if (u.tending)
    return Math.floor((u.tendingTime ?? 0) * 2.5) % 2 ? action(17) : reaction(5);
  // While changing a cooked barrel the gunner drops to one knee and works the
  // weapon, alternating with a low crouch so the pause reads as urgent labour.
  if ((u.overheatedUntil ?? 0) > time && !u.moving)
    return action(Math.floor(((u.overheatedUntil ?? 0) - time) * 2.2) % 2 ? 13 : 1);
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
  // v81: dry-ammo battle drill. The engine sets reloadingUntil on the dry
  // receiver only, so during the handoff the pair splits into a giver (arm
  // extended with the magazine) and a receiver (hunched over the mag well)
  // instead of two identical hunches. Only upright soldiers run the drill —
  // a pinned rifleman stays low and waits for a lull in the fire.
  if ((u.ammoShareUntil ?? 0) > time && u.pose !== 'prone')
    return (u.reloadingUntil ?? 0) > time ? action(13) : action(9);
  // v83: looting a fallen comrade's kit — a knee-down rummage beat
  // alternating with the huddled work beat so the search reads as active.
  if ((u.scavengeUntil ?? 0) > time && u.pose !== 'prone')
    return Math.floor(time * 2.5 + u.uid) % 2 ? action(1) : action(13);
  // v84: combat lifesaver working a tourniquet — the medic kneel / low-crouch
  // rhythm already used while tending, so the aid reads as skilled labour.
  if ((u.firstAidUntil ?? 0) > time && u.pose !== 'prone')
    return Math.floor(time * 2.5 + u.uid) % 2 ? action(17) : reaction(5);
  if (
    (u.ammoSignalUntil ?? 0) > time &&
    !u.moving &&
    u.fire <= 0 &&
    (u.aimUntil ?? 0) <= time &&
    (u.reloadingUntil ?? 0) <= time &&
    (u.pose === 'idle' || u.pose === 'walk')
  ) {
    const t = (u.ammoSignalUntil ?? 0) - time;
    return Math.floor((1.4 - t) * 2.2) % 2 ? sig(1) : action(13);
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
    return Math.floor(time * 3 + u.uid) % 2 ? action(13) : action(1);
  // v110: stand↔crouch↔prone transitions. Placed after every action branch
  // (throws, treatment, signals, reload drills) so a real action always
  // interrupts the posture change, and before the pose branches below so the
  // chain plays instead of snapping to the new idle frame.
  const poseTransition = poseTransitionChoice(u, time);
  if (poseTransition) return poseTransition;
  const reloading = (u.reloadingUntil ?? 0) > time;
  if (u.pose === 'prone') {
    if (u.moving) return action(cycle(u.walk / 2, 2) ? 12 : 2);
    // Spotters periodically kneel to work the radio while observing.
    if (u.id === 'scouts') {
      const radioT = (time + u.uid * 1.37) % 4.4;
      if (radioT < 1.2) return action(13);
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
      return reaction(cower < 3.4 ? 6 : 7);
    }
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
  // v105: hit flinches — a tall stagger, a knee-buck and a deep cower-flinch
  // — so a burst walking across a squad doesn't pop the identical frame on
  // every man. v116 widened the spread from two to three variants, v118 to
  // four — the deep curl joins the rotation. v120: the flinch now cycles
  // across the full 0.16s hit window instead of flashing for 0.03s, so a
  // burst reads as a live reaction chain — stagger, knee-soft, curl, squat —
  // rather than a single popped frame.
  if (u.flash > 0) {
    const beat = Math.max(0, Math.floor((0.16 - u.flash) * 25));
    return reaction(4 + ((u.uid + beat) % 4));
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
    return action(9);
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
