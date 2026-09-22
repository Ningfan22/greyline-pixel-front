import { infantryGeometry } from './infantry-geometry';
import { infantryWeaponMuzzle, type InfantryWeaponBody } from './infantry-weapon-geometry';
import { lobY, lobIntercept } from './lob-trajectory';
import { tryVeteranReload, relayReloadActive } from './veteran-team';
import { grenadePriorityTarget, grenadeRelayReady } from './grenade-team';
import { grenadeReleaseOrigin } from './grenade-geometry';
import { beginSupportTick, continueSupportWork, digWorkSettled, type SupportWork } from './support-work';
import { pickRepairVehicle, clearRepairAssignment, repairStation, atRepairContact, REPAIR_CONTACT_TOLERANCE, REPAIR_FIRST_WORK_S } from './repair-work';
import { gliderLanding, prepareGlider, stepGlider, gliderDust, airborneTarget, type GliderFlight } from './glider';
import { HEAVY_MG_SETUP, isHeavyGunner, heavyMGReady, machinegunBurst, lightMGBound } from './machinegun-team';
import { AMBUSH_REVEAL, AMBUSH_FIRE_RANGE, ambushConcealed, canPrepareAmbush, landingGuide, pathfinderReady, finishInfantryInsertion } from './infantry-specialties';
import { isPrecisionObserver, precisionObserverReady, precisionPartner, pairedPrecisionRange } from './precision-team';
import { carrierScootGoal, CARRIER_SETTLE } from './mobile-mortar';
import { isBattleTank, infantryConcentrations, tankTargetPriority, tankPurchaseBonus } from './tank-doctrine';
import { GRENADE_THROW_S, grenadeElapsed, grenadeReleased, stanceTransitionActive, stanceTransitionProgress, magazineReloadActive, pauseMagazineDrill } from './infantry-action-timing';
import { advanceLauncherDrill, launcherDrillBusy } from './launcher-drill';
import { crouchStartDelay, crouchTravelAmount, crouchMotionActive, requestCrouchStep, stepCrouchLocomotion, startMagazineDrill } from './crouch-locomotion';
import { proneStartDelay, proneTravelAmount, proneTravelApplies, proneMotionActive, requestProneStep, stepProneLocomotion } from './prone-locomotion';
import { blastDuration } from './blast-animation';
import { localUnitOrder, stepUnitControl } from './unit-control';
import { heightfieldIntercept } from './terrain-ray';
import { energyInterval } from './economy';
import {
  advanceCampaign,
  campaignResult,
  type CampaignState,
} from './campaign';
import { blastVisible } from './impact-fx';
import { squadFocus, squadSuppressionTarget } from './focus-fire';
import { rotorWash } from './rotor-wash';
import {
  initialEconomy,
  energyLimit,
  economyBlock,
  applyEconomy,
  updateEconomy,
  ECONOMY_RULES,
  type EconomyPlayer,
  type MatchOptions,
} from './economy';
export { energyInterval, energyLimit, DEFAULT_DIFFICULTY } from './economy';
export type { Difficulty, MatchOptions } from './economy';
import {
  comebackBlock,
  comebackScore,
  applyComeback,
  updateComeback,
  type ComebackState,
} from './comeback';
import {
  aimProjectileDepth,
  depthHit,
  suppressNearMiss,
} from './projectile-depth';
import {
  setSquadOrder,
  updateSquadOrders,
  trenchProtection,
  trenchCutDepth,
  preparedTrenchRamp,
  trenchWorksite,
  type Entrenchment,
  type SquadOrder,
} from './squad-orders';
import {
  buildSpatial,
  buildByUid,
  buildSquadIndex,
  nearUnits,
  unitByUid,
  squadMates,
  type SpatialIndex,
} from './spatial';
import { isWeaponTeamId, unitSynergy } from './synergy';
import { createMapLayout, DEFAULT_MAP, type MapId } from './maps';
import { wreckContact } from './wreck-geometry';
import { tankGeometry, armorHalf, armorHeight } from './vehicle-geometry';
import {
  ammunition,
  FLIGHT,
  isTracer,
  isCoverBullet,
  magazine,
  type Ammunition,
} from './ballistics';
import {
  canRicochet,
  ricochetChance,
  reflectAngle,
  RICOCHET_LIFE,
  type Ricochet,
} from './ricochet';
import {
  obstacleBoxes,
  segmentBox,
  debrisCover,
  createScenery,
  refreshVision,
  visibleToSide,
  pointVisible,
  clearSight,
  sightRange,
  observerUnits,
  sceneryIntercept,
  sceneryCoverHits,
  damageScenery,
  contactIsStale,
  type Scenery,
  type GroundContact,
  type Wreck,
  type Mine,
} from './world';
export { refreshVision, visibleToSide, pointVisible } from './world';
import {
  createWeather,
  smokeDecayMultiplier,
  updateWeather,
  type WeatherState,
} from './weather';
import {
  CARDS,
  DECK,
  validDeck,
  chooseAiDeck,
  modelOf,
  weaponCard,
  doctrineOf,
  type CardId,
  type Card,
  type Doctrine,
} from './cards';
export {
  CARDS,
  DECK,
  DECK_SIZE,
  validDeck,
  chooseAiDeck,
  modelOf,
  doctrineOf,
  needsTarget,
} from './cards';
export type { CardId, Card } from './cards';
export type Side = 0 | 1;
export type Order = 'advance' | 'hold' | 'rush' | 'crouch' | 'prone';
export type Status = 'ready' | 'playing' | 'paused' | 'finished';
export const W = 3840,
  VIEW_W = 1440,
  H = 480,
  DURATION = 600,
  MAX_HP = 1000,
  DRAW_TIME = 9,
  ENERGY_TIME = ECONOMY_RULES.baseInterval,
  MAX_HAND = 6;
export const DRAW_COST = 2,
  MAX_CRATER_DEPTH = 28,
  SQUAD_SPACING = 38;
export const AIR_ALTITUDE = 232,
  DROP_HEIGHT = 26,
  CLIMB_HEIGHT = 28;
/** v172: seconds of ineffective close-range fire before a unit breaks off to maneuver. */
const STALEMATE_BREAK_S = 35;
/** v172: a stalemated unit closes to this gap before resuming fire from the new angle. */
const STALEMATE_CLOSE_GAP = 30;
export interface HandCard {
  uid: number;
  id: CardId;
  readyAt?: number;
  returnedOnce?: boolean;
}
export interface Unit {
  squadOrder?: SquadOrder;
  squadOrderX?: number;
  squadOrderUntil?: number;
  escortTankUid?: number;
  escortGoal?: number;
  escortLane?: number;
  escortScanAt?: number;
  escortLostAt?: number;
  escortLastX?: number;
  withdrawHeavyUid?: number;
  withdrawHeavySeenAt?: number;
  withdrawHeavyX?: number;
  withdrawHeavyY?: number;
  withdrawHeavyRange?: number;
  withdrawUnderFireUntil?: number;
  withdrawStandby?: boolean;
  withdrawStandbySince?: number;
  holdLane?: number;
  digging?: boolean;
  digElapsed?: number;
  uid: number;
  id: CardId;
  side: Side;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  cooldown: number;
  walk: number;
  stepDust?: number;
  rotorWashAt?: number;
  flash: number;
  squad: number;
  moving: boolean;
  fire: number;
  flashUntil?: number;
  heat?: number;
  heatAt?: number;
  overheatedUntil?: number;
  mgBurstRestUntil?: number;
  mgBoundGoal?: number;
  deadFor: number;
  lane: number;
  pace: number;
  climbing: number;
  climbFrom: number;
  climbWall: number;
  passedWalls: number[];
  facing: number;
  retreatUntil: number;
  hullAngle: number;
  wounded: boolean;
  woundedFromPose?: Unit['pose'];
  woundedTime: number;
  bleedOut: number;
  woundedBy: Side;
  rescueProgress: number;
  medicalReadyAt?: number;
  crawling?: boolean;
  rescuedAt?: number;
  crawlFxAt?: number;
  draggingUid?: number;
  draggedByUid?: number;
  injuryCooldown: number;
  /** v92: squad kill tally — the feedstock for veterancy. */
  kills?: number;
  /** v92: timestamp of the most recent field promotion (drives the pip flash). */
  veteranAt?: number;
  /** v113: timestamp of the unit's most recent kill (morale anchor). */
  lastKillAt?: number;
  lastAmmo?: Ammunition;
  lastThreat?: { x: number; y: number; until: number };
  /**
   * Last observed enemy position kept for probing fire. Unlike lastThreat this
   * is never cleared by the morale/tactics pass, so a squad that lost sight of
   * a contact can still walk suppressive bursts onto the spot.
   */
  reconMemory?: { x: number; y: number; until: number };
  aimUntil?: number;
  reloadingUntil?: number;
  /** v113: when the current reload began, so the animation can track progress. */
  reloadingStartAt?: number;
  /** v114: top-up reload of a half-spent mag during a lull (not a dry swap). */
  tacticalReload?: boolean;
  /** Rounds left in the current magazine. 0 = dry, -1 = no magazine management. */
  ammo?: number;
  ammoReserve?: number;
  /** Animation-only: dry soldier is signalling for ammunition (wave / work weapon). */
  ammoSignalUntil?: number;
  /** Throttle for re-raising the ammo signal once the previous window closes. */
  ammoSignalAt?: number;
  /** Uid of the buddy with spare ammo the dry soldier is walking to. */
  ammoBuddyUid?: number;
  /** Throttle for the donor search so a dry squad doesn't scan every tick. */
  ammoSearchAt?: number;
  /** Animation-only: soldier is passing / receiving a magazine with a buddy. */
  ammoShareUntil?: number;
  /** Timestamp until which a rescued (ammo-shared) soldier surges toward the enemy. */
  rescuedUntil?: number;
  /** v83: id of the fallen comrade's wreck a dry soldier is looting ammo from. */
  scavengeWreckId?: number;
  /** v83: loot window — until this timestamp the soldier is huddled over the body. */
  scavengeUntil?: number;
  observingUntil?: number;
  observerFollowing?: boolean;
  /** v128: when a continuous observing spell started (hysteresis). */
  observingSince?: number;
  /** v128: hold the prone observer pose until this timestamp. */
  observingHoldUntil?: number;
  readyAt?: number;
  exposedUntil?: number;
  firingGoal?: number | null;
  firingSearchAt?: number;
  firingTransit?: boolean;
  contactUid?: number;
  contactAir?: boolean;
  contactScanAt?: number;
  contactUntil?: number;
  /** v87: contact callout — until this timestamp the soldier is shouting a spot report. */
  calloutUntil?: number;
  /** v87: direction the callout points toward the threat. */
  calloutDir?: 1 | -1;
  /** v118: squad leader is pointing an arm at the threat until this time. */
  pointUntil?: number;
  /** v118: direction the leader's point gesture faces. */
  pointDir?: 1 | -1;
  /** v118: throttle for the leader's next point-out while in contact. */
  pointNextAt?: number;
  /** v87: when a squadmate heard a callout and should orient toward the reported threat. */
  heardContactAt?: number;
  /** v87: direction of the heard callout's threat. */
  heardContactDir?: 1 | -1;
  dragScanAt?: number;
  /** Distance accumulator for laying persistent blood smears while dragging a casualty. */
  dragMarkAccum?: number;
  /** v84: combat lifesaver channel — until this timestamp the soldier kneels over a casualty applying a tourniquet. */
  firstAidUntil?: number;
  /** v84: uid of the casualty receiving buddy aid. */
  firstAidTargetUid?: number;
  /** v84: throttle for the casualty scan so a squad does not scan every tick. */
  firstAidScanAt?: number;
  /** v84: after a completed treatment the lifesaver waits before treating again. */
  firstAidCooldownUntil?: number;
  /** v84: on the casualty — uid of the buddy currently applying aid (holds him still). */
  firstAidByUid?: number;
  /** v84: on the casualty — tourniquet window; bleedout nearly frozen until this time. */
  stabilizedUntil?: number;
  sortKey?: number;
  /** v127/v128: stance-class (stand/crouch/prone) changes are rate-limited. */
  stanceLockUntil?: number;
  /** v127: after a cover peek ends, the soldier rests behind cover this long. */
  peekRestUntil?: number;
  /** v129: stable down-pose held between cover peeks (picked once per drop). */
  peekDownPose?: 'crouch' | 'hunker' | 'prone';
  /** True while the squad is in a command vacuum (leader down, no successor yet). */
  vacuum?: boolean;
  /** v120, animation-only: this unit is its squad's current leader. */
  leader?: boolean;
  dispersionGoal?: number;
  dispersionUntil?: number;
  trafficYieldUntil?: number;
  artilleryChecks?: number[];
  artilleryReactAt?: number;
  lastCombatShotAt?: number;
  /** Single-shot launcher drill advances with the real weapon cooldown. */
  launcherCycleRemaining?: number;
  launcherCycleDuration?: number;
  /** A real, completed magazine drill covered by the veteran's squad. */
  relayReload?: boolean;
  stillFor?: number;
  ambushFor?: number;
  camouflageFor?: number;
  camouflageRevealedUntil?: number;
  rapidUntil?: number;
  smokeAssaultSpent?: boolean;
  assaultBurstUntil?: number;
  assaultSurgeUntil?: number;
  buddyRallied?: boolean;
  fragLeft?: number;
  fragThrow?: number;
  fragThrowStartedAt?: number;
  fragAim?: { x: number; y: number };
  fragCooldown?: number;
  breachPropId?: number;
  breachShots?: number;
  boundStartedAt?: number;
  boundRestUntil?: number;
  /** v172: stalemate detection — uid of the target tracked for ineffective fire. */
  stalemateTargetUid?: number;
  /** v172: last observed hp of the tracked stalemate target. */
  stalemateTargetHp?: number;
  /** v172: when the current no-damage streak against the tracked target began. */
  stalemateSince?: number;
  /** v172: unit x when the stalemate began, so a maneuver resets the clock. */
  stalemateStartX?: number;
  /** v172: until this time, contactSafeX uses the reduced stalemate close gap. */
  stalemateCloseUntil?: number;
  /** Shoot-and-scoot: indirect-fire teams displace to this x once the enemy
   * sound rangers have refined a fix on their current position. */
  displaceGoal?: number | null;
  displaceUntil?: number;
  /** The mobile mortar must stop its tracks and settle before another shell. */
  carrierSettleUntil?: number;
  /** Own rounds at this firing position, not neighboring crew members' reports. */
  mortarSiteShots?: number;
  withdrawStartedAt?: number;
  withdrawUntil?: number;
  withdrawGoal?: number;
  withdrawNextAt?: number;
  /** When set, infantry hold position: friendly AT is engaging an armoured threat ahead. */
  atHoldUntil?: number;
  /** v91: damaged armored vehicle reverses to this x behind its infantry screen. */
  vehicleReverseUntil?: number;
  vehicleReverseGoal?: number;
  vehicleReverseAssessAt?: number;
  /** v91.1: a mauled vehicle that has made its fallback bound and is holding the line. */
  vehicleReverseHeld?: boolean;
  withdrawGroup?: number;
  withdrawAssessAt?: number;
  withdrawPressureSince?: number;
  withdrawSafeSince?: number;
  backpedaling?: boolean;
  dispersionNextAt?: number;
  dispersionStartedAt?: number;
  originalSquad?: number;
  regroupHost?: number;
  emplaced?: boolean;
  emplacementIdleSince?: number;
  emplacementSetupUntil?: number;
  conflictNextAt?: number;
  regroupProgress?: number;
  regroupedAt?: number;
  conflictUntil?: number;
  conflictTarget?: number;
  conflictChecked?: boolean;
  motionLift?: number;
  shots: number;
  secondaryShots: number;
  muzzleX: number;
  muzzleY: number;
  shotAngle: number;
  secondaryMuzzleX: number;
  secondaryMuzzleY: number;
  secondaryAngle: number;
  member: number;
  personalMorale: number;
  suppression: number;
  /** Blast near-miss reaction: infantry hit the dirt until this time. */
  flinchUntil?: number;
  /** Whether the flinch goes prone (close) or just crouches (far). */
  flinchProne?: boolean;
  /** Distant blast awareness: holding infantry glance toward the impact. */
  blastGlanceUntil?: number;
  /** Sprite-flip direction toward the blast that triggered the glance. */
  blastGlanceDir?: 1 | -1;
  /** v79: staggered scan clock for noticing fresh blood trails on the ground. */
  traceScanAt?: number;
  /** v79: a fresh drag mark snagged the soldier's eye for a beat. */
  traceGlanceUntil?: number;
  /** Sprite-flip direction toward the blood trail that triggered the glance. */
  traceGlanceDir?: 1 | -1;
  /** Near-miss rounds crack overhead: soldier ducks for a beat. */
  duckUntil?: number;
  /** Recon-by-fire throttle: next time this soldier may probe a last-known contact. */
  reconFireNextAt?: number;
  decisionIn: number;
  /**
   * Independent cadence for the morale block. decideTactic's body can run
   * ~10x/sec for advancing units in contact (quickContact bypass), but the
   * morale constants were tuned for a ~1.1s tick; without this gate an
   * engaged man's nerve drained ~10x too fast and militia broke on contact.
   */
  moraleIn?: number;
  tactic:
    | 'advance'
    | 'prone'
    | 'crouch'
    | 'cover'
    | 'bound'
    | 'retreat'
    | 'surrender';
  surrendered: boolean;
  surrenderTime: number;
  secondaryCooldown: number;
  secondaryFire: number;
  climbDuration: number;
  pose:
    | 'idle'
    | 'walk'
    | 'run'
    | 'climb'
    | 'crouch'
    | 'hunker'
    | 'prone'
    | 'jump'
    | 'land';
  /**
   * Simulation-owned posture clock. Off-screen units complete the same drill
   * as visible units; rendering cannot start, restart or clear a transition.
   */
  poseAnimSeen?: 'stand' | 'crouch' | 'prone';
  poseAnimFrom?: 'stand' | 'crouch' | 'prone';
  poseAnimAt?: number;
  poseAnimProgress?: number;
  poseAnimFromTravel?: number;
  poseAnimToTravel?: number;
  /** Knee=0, low travelling body=1. Simulation-owned, never a draw-time lerp. */
  crouchTravel?: number;
  crouchMoveRequested?: boolean;
  crouchStoppedFor?: number;
  crouchStepCommittedUntil?: number;
  /** Settled aim=0, supported elbow crawl=1; simulation-owned start/stop. */
  proneTravel?: number;
  proneMoveRequested?: boolean;
  proneStoppedFor?: number;
  proneStepCommittedUntil?: number;
  motion: 'ground' | 'jump' | 'land' | 'bank';
  motionTime: number;
  motionDuration: number;
  motionFromX: number;
  motionFromY: number;
  motionToX: number;
  motionToY: number;
  vx: number;
  vy: number;
  stepCooldown: number;
  cover: number;
  coverGoal: number | null;
  trafficWait?: number;
  passingLane?: number;
  passClearAt?: number;
  coverSearch: number;
  supportCooldown: number;
  healing: number;
  tending?: boolean;
  tendingTime?: number;
  tendingKind?: SupportWork;
  tendingTargetUid?: number;
  repairTargetUid?: number;
  repairSide?: -1 | 1;
  repairTime: number;
  recoverySupportUntil?: number;
  commandSupportUntil?: number;
  patrolDir: number;
  evadeGoal: number | null;
  evadeUntil: number;
  evadeMarker: number | null;
  friendlyWarnAt: number;
  sortieCard: HandCard | null;
  bombsLeft?: number;
  flightUntil?: number;
  patrolExiting?: boolean;
  fpvLock?: { uid: number; x: number; y: number };
  loiterFlight?: {
    anchor: number;
    scanAt: number;
    candidateUid?: number;
    confirmAt?: number;
    lock?: { uid: number; x: number; y: number };
  };
  airlift?: {
    x: number;
    phase: 'approach' | 'unload' | 'exit';
    dropped: number;
    nextAt: number;
    squad?: number;
  };
  glider?: GliderFlight;
  rappelling?: boolean;
  /** Timestamp when rappel descent started — safety net forces a landing. */
  rappellingStartAt?: number;
  /** Parachute insertion from an airdrop card: descending under canopy, no fire. */
  parachuting?: boolean;
  /** Timestamp when parachute descent started — safety net forces a landing. */
  parachutingStartAt?: number;
  /** Forced-march order: movement speed boosted while active. */
  forceMarchUntil?: number;
  slowedUntil: number;
  /** Disoriented period after bailing out of a destroyed vehicle: no fire, slow stumble. */
  bailoutUntil?: number;
  destroyed: boolean;
}
export interface Projectile {
  startLane?: number;
  targetLane?: number;
  suppressedUids?: number[];
  suppressionMultiplier?: number;
  passedCover?: number[];
  uid?: number;
  guided?: boolean;
  topAttack?: boolean;
  loftX?: number;
  loftY?: number;
  lofted?: boolean;
  heading?: number;
  speed?: number;
  infantryMultiplier?: number;
  baseMultiplier?: number;
  shell?: boolean;
  effect?: Blast['kind'];
  sourceUid?: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  side: Side;
  targetUid: number | null;
  base: Side | null;
  damage: number;
  radius: number;
  life: number;
  total: number;
  startX: number;
  startY: number;
  arc?: number;
  ammunition?: Ammunition;
  tracer?: boolean;
  trailIn?: number;
  weapon?: 'coax';
  armorMultiplier?: number;
  missed?: boolean;
  smallArmsAir?: boolean;
  /** v108: fired by an aircraft — strafing runs ignore wall cover, only the ground stops them. */
  fromAir?: boolean;
}
export interface Particle {
  /** Optional starting opacity for authored puffs; life still fades it out. */
  opacity?: number;
  kind?:
    | 'smoke'
    | 'dust'
    | 'spark'
    | 'chip'
    | 'casing'
    | 'tracer'
    | 'impact'
    | 'cloud'
    | 'mote'
    | 'haze'
    | 'flash'
    | 'blood';
  endX?: number;
  endY?: number;
  variant?: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}
export interface Marker {
  uid?: number;
  x: number;
  timer: number;
  side: Side;
  wave: number;
  kind?:
    | 'artillery'
    | 'precision'
    | 'barrage'
    | 'naval'
    | 'cluster'
    | 'thermobaric'
    | 'heavy'
    | 'creeping'
    | 'rocket';
  impacts?: number[];
}
export interface Blast {
  kind?:
    | 'he'
    | 'artillery'
    | 'wreck'
    | 'penetration'
    | 'grenade'
    | 'air'
    | 'crash';
  x: number;
  y: number;
  age: number;
  radius: number;
  soil: boolean;
  seed: number;
}
export interface Smoke {
  x: number;
  life: number;
  side: Side;
}
export interface Flare {
  radius?: number;
  x: number;
  y: number;
  life: number;
  maxLife: number;
  side: Side;
  seed: number;
}
// Sound-ranging fix on an enemy battery: every time a hostile gun fires,
// acoustic detection estimates its position (with error) for the opposing
// side. The report decays as the battery displaces, and repeat detections
// converge on the true location. Counter-battery fire aimed at a fresh
// report lands with a tightly reduced scatter.
export interface BatteryReport {
  uid: number;
  x: number;
  side: Side; // side that received the intelligence
  life: number;
  maxLife: number;
  scatter: number; // acoustic error radius, px
  hits: number; // how many detections converged into this report
}
export interface Scorch {
  x: number;
  y: number;
  radius: number;
  seed: number;
}
export interface TreadMark {
  x: number;
  y: number; // ground height at creation time
  half: number; // vehicle half-width, drives track spacing
  seed: number;
  born: number; // s.time when the mark was laid
}
export interface DragMark {
  x: number;
  y: number; // ground height at creation time
  /** Casualty's side: own-side trails are always known, enemy trails need line of sight. */
  side: Side;
  seed: number;
  born: number; // s.time when the smear was laid
}
/**
 * v79: the freshest blood trail a side has laid eyes on. Medics read it as
 * a friendly casualty's last known position and follow it; the AI director
 * reads enemy blood as proof of contact in that sector. `side` is the
 * casualty's side, not the observer's — consumers must match it themselves.
 */
export interface TraceIntel {
  x: number;
  side: Side;
  at: number; // s.time of the freshest mark folded into this intel
  until: number; // intelligence goes stale after this time
}
export interface Notice {
  audience?: Side[];
  text: string;
  time: number;
  kind: 'good' | 'warn' | 'info';
}
export interface Wall {
  uid: number;
  x: number;
  width: number;
  height: number;
  hp: number;
}
export interface Player extends EconomyPlayer {
  loadout: CardId[];
  drawSeed: number;
  fortify: number;
  captures: number;
  order: Order;
  hp: number;
  energy: number;
  hand: HandCard[];
  deck: HandCard[];
  discard: HandCard[];
  drawIn: number;
  jam: number;
  morale: number;
  recon: number;
  kills: number;
  played: number;
  /** Comm blackout: no energy recharge while active (v108). */
  blackoutUntil?: number;
  /** Supply interdiction: next N cards played cost +2 (v108). */
  taxCards?: number;
  /** Spoof: enemy infantry briefly face the wrong way (v108). */
  spoofUntil?: number;
  /** Radar jam: enemy air & guided weapon accuracy reduced (v108). */
  radarJamUntil?: number;
  /** Blitz doctrine: own infantry speed boost while active (v108). */
  blitzUntil?: number;
  /** Entrench: own infantry forced prone with damage reduction (v108). */
  entrenchUntil?: number;
  /** Command lockdown: cannot play cards while active (v120). */
  lockoutUntil?: number;
  /** Shock action: enemy infantry cannot move while active (v120). */
  shockUntil?: number;
  /** Sensor blind: enemy vision reduced while active (v120). */
  sensorBlindUntil?: number;
  /** Frequency hopping: immune to enemy disruption while active (v120). */
  freqHopUntil?: number;
  /** EW suppression: enemy recharge interval multiplied while active (v120). */
  ewarfareUntil?: number | null;
  /** Tactical fallback: own infantry speed boost while active (v120). */
  fallbackUntil?: number;
}
export interface GameState {
  campaign?: CampaignState;
  comeback?: ComebackState;
  entrenchments?: Entrenchment[];
  mapId: MapId;
  night: boolean;
  scenery: Scenery[];
  wrecks: Wreck[];
  mines: Mine[];
  visible: [number[], number[]];
  sight: [boolean[], boolean[]];
  knownTerrain: [number[], number[]];
  knownWalls: [Record<number, Wall>, Record<number, Wall>];
  knownScenery: [Record<number, Scenery>, Record<number, Scenery>];
  /** Observed ground positions remain uncleared until that sector is checked. */
  groundContacts?: [GroundContact[], GroundContact[]];
  visionIn: number;
  audibleExplosions: [number, number];
  status: Status;
  time: number;
  players: [Player, Player];
  terrain: number[];
  /** Bumped on every terrain write; invalidates derived terrain caches (v100). */
  terrainVersion: number;
  original: number[];
  walls: Wall[];
  units: Unit[];
  // Per-tick acceleration structures, rebuilt at the top of tick(). Optional
  // so code paths exercised outside a tick (tests, editors) degrade to scans.
  spatial?: SpatialIndex;
  byUid?: Map<number, Unit>;
  squadIndex?: Map<number, Unit[]>;
  /** Per-squad fire-team rotation state for bounding overwatch. */
  squadManeuver?: Record<
    number,
    { offset: number; lastRotate: number; lastContact: number }
  >;
  /** Per-squad command state: leader uid and command-vacuum window. */
  squadCommand?: Record<
    number,
    { leaderUid: number; vacuumUntil: number }
  >;
  /** Front-line x per side: [side0 foremost x, side1 foremost x]. */
  frontX?: [number, number];
  projectiles: Projectile[];
  particles: Particle[];
  particlePool?: Particle[];
  markers: Marker[];
  smokes: Smoke[];
  flares: Flare[];
  batteryReports: BatteryReport[];
  blasts: Blast[];
  /** v95: supersonic rounds skipping off armour. */
  ricochets: Ricochet[];
  scorches: Scorch[];
  treads: TreadMark[];
  dragMarks: DragMark[];
  /** v79: per-side freshest blood-trail intelligence, indexed by side. */
  traceIntel: (TraceIntel | undefined)[];
  notices: Notice[];
  result: Side | 'draw' | null;
  aiIn: number;
  aiWaveUntil?: number;
  aiArmorSeenUntil?: number;
  aiAirSeenUntil?: number;
  aiArchetype?: string;
  aiPhase?: 'early' | 'mid' | 'late';
  aiProfile?: { air: number; armor: number; foot: number; turtle: number };
  aiEnemyProfile?: {
    air: number;
    armor: number;
    foot: number;
    indirect: number;
    at: number;
  };
  aiPushUntil?: number;
  /** v88: smoke-assault follow-through window + corridor x. */
  aiSmokeAssaultUntil?: number;
  aiSmokeAssaultX?: number;
  shake: number;
  uid: number;
  seed: number;
  fxSeed: number;
  injurySeed: number;
  explosions: number;
  wind: number;
  windTarget: number;
  windIn: number;
  dustIn: number;
  weather: WeatherState;
}
function rnd(s: GameState) {
  s.seed = (Math.imul(1664525, s.seed) + 1013904223) >>> 0;
  return s.seed / 4294967296;
}
function fxRnd(s: GameState) {
  s.fxSeed = (Math.imul(1664525, s.fxSeed) + 1013904223) >>> 0;
  return s.fxSeed / 4294967296;
}
function shuffle<T>(p: Player, list: T[]) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    p.drawSeed = (Math.imul(1664525, p.drawSeed) + 1013904223) >>> 0;
    const j = Math.floor((p.drawSeed / 4294967296) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
export function ground(s: GameState, x: number) {
  return s.terrain[Math.max(0, Math.min(W - 1, Math.floor(x)))];
}
export function createGame(
  seed = Date.now(),
  playerDeck: CardId[] = DECK,
  aiDeck: CardId[] = chooseAiDeck(seed),
  mapId: MapId = DEFAULT_MAP,
  options: MatchOptions = {},
): GameState {
  if (!validDeck(playerDeck) || !validDeck(aiDeck))
    throw new Error('双方卡组必须各有20张有效卡牌，且不超过各卡数量上限');
  // v113: the game seed drives map generation, so every match with a
  // unique seed gets a unique battlefield. Fixed seeds (tests, replays)
  // still produce the same layout every time.
  const layout = createMapLayout(mapId, W, options.mapSeed ?? seed),
    original = layout.terrain;
  const p = (side: Side, loadout: CardId[]): Player => ({
    loadout: [...loadout],
    drawSeed: (seed ^ (side === 0 ? 0x9e3779b9 : 0x85ebca6b)) >>> 0,
    fortify: 0,
    captures: 0,
    order: 'advance',
    hp: MAX_HP,
    ...initialEconomy(side, options),
    hand: [],
    deck: [],
    discard: [],
    drawIn: 0,
    jam: 0,
    morale: 0,
    recon: 0,
    kills: 0,
    played: 0,
    blackoutUntil: 0,
    taxCards: 0,
    spoofUntil: 0,
    radarJamUntil: 0,
    blitzUntil: 0,
    entrenchUntil: 0,
  });
  const s: GameState = {
    mapId: layout.id,
    night: options.night ?? false,
    scenery: createScenery(original, layout.scenerySites),
    wrecks: [],
    mines: [],
    visible: [[], []],
    sight: [[], []],
    knownTerrain: [[...original], [...original]],
    knownScenery: [{}, {}],
    knownWalls: [{}, {}],
    visionIn: 0,
    audibleExplosions: [0, 0],
    status: 'ready',
    time: 0,
    players: [p(0, playerDeck), p(1, aiDeck)],
    terrain: [...original],
    terrainVersion: 0,
    original,
    walls: layout.wallSites.map((wall, i) => ({
      uid: i + 1,
      ...wall,
    })),
    units: [],
    squadManeuver: {},
    squadCommand: {},
    projectiles: [],
    particles: [],
    markers: [],
    smokes: [],
    flares: [],
    batteryReports: [],
    blasts: [],
    ricochets: [],
    scorches: [],
    treads: [],
    dragMarks: [],
    traceIntel: [undefined, undefined],
    notices: [],
    result: null,
    aiIn: 1.1,
    shake: 0,
    uid: 0,
    seed: seed >>> 0,
    fxSeed: (seed ^ 0x7f4a7c15) >>> 0,
    injurySeed: (seed ^ 0x4cf5ad43) >>> 0,
    explosions: 0,
    wind: 0,
    windTarget: 0,
    windIn: 3,
    dustIn: 0.4,
    weather: createWeather(layout.id, seed, options.weather === false),
  };
  for (const side of [0, 1] as Side[]) {
    const player = s.players[side];
    player.deck = shuffle(
      player,
      player.loadout.map((id) => ({
        id,
        uid: ++s.uid,
        readyAt: 0,
        returnedOnce: false,
      })),
    );
    draw(s, side, MAX_HAND);
  }
  for (const side of [0, 1] as Side[])
    s.knownScenery[side] = Object.fromEntries(
      s.scenery.map((p) => [p.id, structuredClone(p)]),
    );
  for (const side of [0, 1] as Side[])
    s.knownWalls[side] = Object.fromEntries(
      s.walls.map((w) => [w.uid, { ...w }]),
    );
  refreshVision(s);
  return s;
}
export function notify(
  s: GameState,
  text: string,
  kind: Notice['kind'] = 'info',
  audience?: Side[],
) {
  s.notices.unshift({ text, time: s.time, kind, audience });
  s.notices = s.notices.slice(0, 5);
}
export function startGame(s: GameState) {
  if (s.status === 'ready') {
    s.status = 'playing';
    notify(s, '战线已开放，部署你的第一支部队', 'good');
  }
}
export function formationPositions(side: Side, id: CardId, x: number) {
  const count = CARDS[id].members ?? 1,
    span = (count - 1) * SQUAD_SPACING;
  const front =
    side === 0
      ? Math.max(112 + span, Math.min(W - 112, x))
      : Math.min(W - 112 - span, Math.max(112, x));
  return Array.from(
    { length: count },
    (_, i) => front - (side === 0 ? 1 : -1) * i * SQUAD_SPACING,
  );
}
/**
 * Stable depth slot for each squad member in the skirmish line.  Spreads
 * soldiers across lanes so an advancing squad reads as a battle line
 * rather than a single-file column.  Lane only affects rendered depth
 * (infantryDepth), never cover or collision.
 */
export function formationLane(member: number, count: number) {
  if (count <= 1) return 0;
  // Multiplier 8 keeps a 6-member squad within ±20, inside the traffic
  // system's tuned ±24 passing-lane clamp (see moveSoldier).  The old
  // ×12 table reached ±30 and changed passing dynamics enough to pile
  // retreating squads up (v22 regression).
  return (member - (count - 1) / 2) * 8;
}
/**
 * Formation lane for a unit based on its squad's *living* combatants, not
 * the card's full roster.  A squad thinned by casualties re-centers its
 * skirmish line on the survivors: a lone survivor holds lane 0 instead of
 * drifting to the edge slot of a six-man table (which read as a routing
 * straggler and left bypassing units parked far off-lane once traffic
 * cleared).  Cost is O(squad size) ≤ 6 per infantry unit per tick.
 */
export function squadFormationLane(s: GameState, u: Unit): number {
  const mates = s.squadIndex?.get(u.side * 1048576 + u.squad);
  if (!mates) return formationLane(u.member, CARDS[u.id].members ?? 1);
  let rank = 0;
  let count = 0;
  for (const m of mates) {
    if (m.hp <= 0 || m.surrendered || m.wounded || !CARDS[m.id].members)
      continue;
    if (m.member < u.member) rank++;
    count++;
  }
  if (count <= 1) return 0;
  return formationLane(rank, count);
}
export function spawnUnit(
  s: GameState,
  side: Side,
  id: CardId,
  x: number,
  cargo?: { member: number; squad?: number },
) {
  const c = CARDS[id],
    count = c.members ?? 1,
    squad = cargo?.squad ?? ++s.uid,
    dir = side === 0 ? 1 : -1;
  const positions = formationPositions(side, id, x);
  for (
    let i = cargo?.member ?? 0;
    i < (cargo ? cargo.member + 1 : count);
    i++
  ) {
    const px = cargo ? x : positions[i],
      hp = c.hp! / count;
    s.units.push({
      uid: ++s.uid,
      id,
      side,
      x: px,
      y: c.air
        ? (c.altitude ?? AIR_ALTITUDE)
        : c.armored || c.vehicle
          ? vehicleContact(s, px, id).y
          : ground(s, px),
      hp,
      maxHp: hp,
      cooldown: 0.3 + i * 0.13,
      walk: rnd(s) * 8,
      flash: 0,
      squad,
      moving: false,
      digging: false,
      digElapsed: 0,
      fire: 0,
      deadFor: 0,
      lane: formationLane(i, count),
      pace: 0.94 + rnd(s) * 0.12,
      climbing: 0,
      climbFrom: 0,
      climbWall: 0,
      passedWalls: [],
      facing: dir,
      retreatUntil: 0,
      hullAngle: c.armored || c.vehicle ? vehicleContact(s, px, id).angle : 0,
      wounded: false,
      woundedTime: 0,
      bleedOut: 0,
      woundedBy: side === 0 ? 1 : 0,
      rescueProgress: 0,
      medicalReadyAt: c.medicalSetup ? s.time + c.medicalSetup : undefined,
      injuryCooldown: 0,
      shots: i,
      secondaryShots: 0,
      muzzleX: px,
      muzzleY: ground(s, px) - 47,
      shotAngle: 0,
      secondaryMuzzleX: px,
      secondaryMuzzleY: ground(s, px) - 42,
      secondaryAngle: 0,
      member: i,
      personalMorale: c.discipline ?? 80,
      rapidUntil: c.infantryAbility === 'rapid' && !c.airdrop ? s.time + 8 : undefined,
      suppression: 0,
      decisionIn: i * 0.08,
      tactic: 'advance',
      surrendered: false,
      surrenderTime: 0,
      secondaryCooldown: 0.1,
      secondaryFire: 0,
      climbDuration: 1.2,
      pose: 'idle',
      motion: 'ground',
      motionTime: 0,
      motionDuration: 0,
      motionFromX: px,
      motionFromY: ground(s, px),
      motionToX: px,
      motionToY: ground(s, px),
      vx: 0,
      vy: 0,
      stepCooldown: 0,
      cover: 0,
      coverGoal: null,
      coverSearch: 0,
      supportCooldown: 0,
      healing: 0,
      fragLeft: c.frags,
      repairTime: 0,
      patrolDir: side === 0 ? 1 : -1,
      evadeGoal: null,
      evadeUntil: 0,
      evadeMarker: null,
      friendlyWarnAt: -10,
      sortieCard: null,
      flightUntil:
        c.patrolTime || c.flightTime
          ? s.time + (c.patrolTime ?? c.flightTime!)
          : undefined,
      slowedUntil: 0,
      destroyed: false,
    });
  }
}
export function setOrder(s: GameState, side: Side, order: Order) {
  if (!['advance', 'hold', 'rush', 'crouch', 'prone'].includes(order))
    return false;
  s.players[side].order = order;
  return true;
}
export function draw(s: GameState, side: Side, count = 1) {
  const p = s.players[side];
  let drawn = 0;
  for (let i = 0; i < count; i++) {
    if (p.hand.length >= MAX_HAND) break;
    // A battle has a finite draw pile. Spent cards only return through an
    // explicit recovery effect; an empty pile never refills itself.
    const token = p.deck.shift();
    if (!token) break;
    p.hand.push(token);
    drawn++;
  }
  return drawn;
}
export function cardCost(card: HandCard) {
  const c = CARDS[card.id];
  return card.returnedOnce && c.sortie ? (c.returnCost ?? c.cost) : c.cost;
}
export function cardReadyIn(s: GameState, card: HandCard) {
  return Math.max(0, (card.readyAt ?? 0) - s.time);
}
export function requestDraw(
  s: GameState,
  side: Side,
): { ok: boolean; message: string } {
  const p = s.players[side];
  if (s.status !== 'playing')
    return { ok: false, message: '请先开始或继续作战' };
  if (p.jam > 0)
    return { ok: false, message: `通讯受扰，还需 ${Math.ceil(p.jam)} 秒` };
  if (p.hand.length >= MAX_HAND)
    return { ok: false, message: '手牌已满，请先使用一张卡' };
  if (p.drawIn > 0)
    return { ok: false, message: `补给准备中，还需 ${Math.ceil(p.drawIn)} 秒` };
  if (!p.deck.length)
    return { ok: false, message: '没有可抽取的卡牌' };
  if (p.energy < DRAW_COST)
    return { ok: false, message: '抽牌需要 2 点指挥点' };
  if (!draw(s, side)) return { ok: false, message: '没有可抽取的卡牌' };
  p.energy -= DRAW_COST;
  p.drawIn = DRAW_TIME;
  return { ok: true, message: '消耗 2 点指挥点，抽取 1 张卡牌' };
}
export const ARTILLERY = {
  artillery: {
    delay: 2.8,
    count: 3,
    interval: 0.85,
    damage: 26,
    radius: 42,
    spacing: 70,
    scatter: 28,
    baseScale: 0.15,
  },
  barrage: {
    delay: 3.6,
    count: 5,
    interval: 0.75,
    damage: 20,
    radius: 40,
    spacing: 60,
    scatter: 25,
    baseScale: 0.15,
  },
  precision: {
    delay: 2.6,
    count: 1,
    interval: 0,
    damage: 150,
    radius: 26,
    spacing: 0,
    scatter: 8,
    baseScale: 0.2,
  },
  naval: {
    delay: 3.4,
    count: 1,
    interval: 0,
    damage: 120,
    radius: 72,
    spacing: 0,
    scatter: 18,
    baseScale: 0.28,
  },
  cluster: {
    delay: 3.0,
    count: 8,
    interval: 0.32,
    damage: 14,
    radius: 30,
    spacing: 42,
    scatter: 30,
    baseScale: 0.12,
  },
  thermobaric: {
    delay: 2.8,
    count: 1,
    interval: 0,
    damage: 55,
    radius: 58,
    spacing: 0,
    scatter: 12,
    baseScale: 0.24,
  },
  rocket: {
    delay: 2.2,
    count: 1,
    interval: 0,
    damage: 90,
    radius: 22,
    spacing: 0,
    scatter: 4,
    baseScale: 0.18,
  },
  creeping: {
    delay: 2.4,
    count: 6,
    interval: 0.5,
    damage: 22,
    radius: 38,
    spacing: 80,
    scatter: 20,
    baseScale: 0.15,
  },
  heavy: {
    delay: 3.0,
    count: 4,
    interval: 0.9,
    damage: 60,
    radius: 50,
    spacing: 70,
    scatter: 22,
    baseScale: 0.22,
  },
};
function callArtillery(
  s: GameState,
  side: Side,
  x: number,
  kind: keyof typeof ARTILLERY,
) {
  const c = ARTILLERY[kind];
  // Counter-battery: aiming at a fresh sound-ranging fix tightens the
  // sheaf dramatically, and the targeted battery displaces under fire,
  // burning the report down to its last seconds of usefulness.
  let scatterMul = 1;
  const report = s.batteryReports.find(
    (r) =>
      r.side === side &&
      r.life > 2 &&
      Math.abs(r.x - x) <= Math.max(160, r.scatter + 60),
  );
  if (report) {
    scatterMul = 0.45;
    report.life = Math.min(report.life, 4);
  }
  const impacts = Array.from({ length: c.count }, (_, i) =>
    Math.max(
      0,
      Math.min(
        W,
        x +
          (i - (c.count - 1) / 2) * c.spacing +
          (rnd(s) * 2 - 1) * c.scatter * scatterMul,
      ),
    ),
  );
  s.markers.push({
    uid: ++s.uid,
    x,
    timer: c.delay,
    side,
    wave: 0,
    kind,
    impacts,
  });
}
function defaultLanding(s: GameState, side: Side) {
  const dir = side === 0 ? 1 : -1;
  const visible = s.units.filter(
    (v) =>
      v.side !== side &&
      isCombatant(v) &&
      !CARDS[v.id].air &&
      visibleToSide(s, side, v),
  );
  const rear = visible.length
    ? side === 0
      ? Math.max(...visible.map((v) => v.x))
      : Math.min(...visible.map((v) => v.x))
    : W / 2;
  return rear + dir * 220;
}
function landingFootprintClear(s: GameState, x: number, boxes=obstacleBoxes(s)) {
  return !boxes.some(b => b.x < x+110 && b.x+b.w > x-110 &&
    ground(s,b.x+b.w/2)-b.y > 26) &&
    !s.walls.some(w=>w.hp>0 && Math.abs(w.x-x)<130);
}
function safeLanding(s: GameState, requested: number) {
  const center = Math.max(480, Math.min(W - 480, requested));
  const boxes = obstacleBoxes(s);
  // A clear footprint for all five ropes; wrecks and standing walls are real obstacles.
  for (let distance = 0; distance <= 480; distance += 24) {
    for (const sign of [1, -1]) {
      const x = center + distance * sign;
      if (x < 480 || x > W - 480) continue;
      if (landingFootprintClear(s,x,boxes)) return x;
    }
  }
  return center;
}
/** AI reserve/recon insertions must stay on their own side of EVERY observed
 * contact. Recheck after obstacle relocation; clamping can otherwise put a
 * supposedly defensive drop back inside the enemy line. No hidden units. */
function friendlyDropPosition(s: GameState, side: Side, seen: Unit[], setback: number): number | null {
  if (!seen.length) return null;
  const dir = side === 0 ? 1 : -1;
  const front = side === 0 ? Math.min(...seen.map(u=>u.x)) : Math.max(...seen.map(u=>u.x));
  for (let extra = 0; extra <= 480; extra += 48) {
    const x = safeLanding(s,front-dir*(setback+extra));
    if (seen.every(u=>(u.x-x)*dir>=160) && landingFootprintClear(s,x)) return x;
  }
  return null;
}
export function launchFlare(s: GameState, side: Side, x: number, life = 10, radius = 260) {
  const tx = Math.max(40, Math.min(W - 40, x));
  s.flares.push({
    x: tx,
    y: ground(s, tx) - (radius < 260 ? 145 : 250),
    radius,
    life,
    maxLife: life,
    side,
    seed: Math.floor(rnd(s) * 1e9),
  });
}
// Sound ranging: an enemy gun firing gives away an approximate bearing.
// Detection error shrinks as repeated shots from the same area refine the
// fix; the report goes stale as the battery displaces after firing.
export function detectBattery(
  s: GameState,
  shooter: Unit,
  sx: number,
  sy: number,
) {
  const side: Side = shooter.side === 0 ? 1 : 0;
  const fresh = s.batteryReports.find(
    (r) =>
      r.side === side &&
      r.life > r.maxLife * 0.6 &&
      Math.abs(r.x - sx) < 140,
  );
  if (fresh) {
    // Converge toward the true muzzle and tighten the error ellipse.
    const w = Math.min(4, fresh.hits + 1);
    fresh.x = fresh.x + (sx - fresh.x) / w;
    fresh.scatter = Math.max(26, fresh.scatter * 0.8);
    fresh.life = fresh.maxLife;
    fresh.hits++;
    return;
  }
  const scatter = 55 + rnd(s) * 45;
  s.batteryReports.push({
    uid: ++s.uid,
    x: Math.max(20, Math.min(W - 20, sx + (rnd(s) * 2 - 1) * scatter)),
    side,
    life: 20,
    maxLife: 20,
    scatter,
    hits: 1,
  });
}
export function playCard(
  s: GameState,
  side: Side,
  uid: number,
  x?: number,
): { ok: boolean; message: string } {
  if (s.status !== 'playing')
    return { ok: false, message: '请先开始或继续作战' };
  const p = s.players[side],
    index = p.hand.findIndex((c) => c.uid === uid);
  if (index < 0) return { ok: false, message: '这张卡牌已不在手牌中' };
  const token = p.hand[index],
    c = CARDS[token.id],
    cost = cardCost(token) + ((p.taxCards ?? 0) > 0 ? 2 : 0);
  if (c.internal) return {ok:false,message:'运输机体不能单独出牌'};
  if (cardReadyIn(s, token) > 0)
    return {
      ok: false,
      message: `返航补给中，还需 ${Math.ceil(cardReadyIn(s, token))} 秒`,
    };
  if (p.energy + 1e-6 < cost)
    return {
      ok: false,
      message: `还需要 ${Math.ceil(cost - p.energy)} 点指挥点`,
    };
  if ((p.lockoutUntil ?? 0) > s.time)
    return { ok: false, message: '指挥链路被切断，无法出牌' };
  const blocked = c.comeback && comebackBlock(s, side, c.comeback);
  if (blocked) return { ok: false, message: blocked };
  const economyBlocked = c.economy && economyBlock(p, c.economy, s.time);
  if (economyBlocked) return { ok: false, message: economyBlocked };
  if (
    c.type === 'unit' &&
    x !== undefined &&
    (!Number.isFinite(x) || x < 0 || x > W)
  )
    return { ok: false, message: '无效的入场位置' };
  const landingX =
    c.insertion === 'glider' ? gliderLanding(s,x ?? defaultLanding(s,side),side) :
    c.airlift || c.airdrop
      ? safeLanding(s, x ?? defaultLanding(s, side))
      : undefined;
  if(c.insertion==='glider'&&landingX===null)
    return {ok:false,message:'滑翔机需要平缓空地，请避开房屋、树干和残骸'};
  // Airdrop units descend onto the selected point; airlift transports still enter at HQ.
  if (c.airdrop) x = landingX ?? undefined;
  else if (c.type === 'unit') x = side === 0 ? 112 : W - 112;
  if (
    c.targetGround &&
    (x === undefined || !Number.isFinite(x) || x < 0 || x > W)
  )
    return { ok: false, message: '请在战场上选择作用位置' };
  if (
    c.id === 'antitank_mine' &&
    s.units.some(
      (u) =>
        u.side !== side &&
        u.hp > 0 &&
        (CARDS[u.id].armored || CARDS[u.id].vehicle) &&
        visibleToSide(s, side, u) &&
        Math.abs(u.x - x!) < 80,
    )
  )
    return { ok: false, message: '请提前布雷，需离敌方装甲至少 80 距离' };
  p.energy = Math.max(0, p.energy - cost);
  if ((p.taxCards ?? 0) > 0) p.taxCards = (p.taxCards ?? 0) - 1;
  p.hand.splice(index, 1);
  if (!c.sortie) p.discard.push(token);
  p.played++;
  if (c.economy) {
    applyEconomy(p, c.economy, s.time);
  } else if (c.type === 'unit') {
    const spawnedAt = s.units.length;
    spawnUnit(s, side, c.insertion==='glider' ? 'glider_transport' : c.id, x!);
    if(c.insertion==='glider')prepareGlider(s,s.units.at(-1)!,landingX!);
    if (c.airlift)
      s.units.at(-1)!.airlift = {
        x: landingX!,
        phase: 'approach',
        dropped: 0,
        nextAt: s.time,
      };
    if (c.airdrop && !c.insertion)
      for (let i = spawnedAt; i < s.units.length; i++) {
        const u = s.units[i];
        u.parachuting = true;
        u.parachutingStartAt = s.time;
        u.y = ground(s, u.x) - 340;
      }
    if (c.sortie) s.units.at(-1)!.sortieCard = token;
    if (c.deployDraw) draw(s, side, c.deployDraw);
    refreshVision(s);
  } else if (c.id === 'antitank_mine') {
    s.mines.push({ uid: ++s.uid, side, x: x!, armAt: s.time + 2 });
  } else if (c.comeback) {
    applyComeback(s, side, c.comeback);
    if (c.comeback === 'gas')
      notify(s, '毒气封锁：3秒后双方步兵持续受伤', 'warn');
  } else if (c.effect) {
    const own = s.units.filter(
      (u) => u.side === side && isCombatant(u) && CARDS[u.id].members,
    );
    const foe = s.players[side === 0 ? 1 : 0];
    // v120: frequency hopping shrugs off every enemy disruption effect.
    const hopImmune = (foe.freqHopUntil ?? 0) > s.time;
    if (c.effect === 'rally')
      for (const u of own) {
        u.personalMorale = Math.min(100, u.personalMorale + 40);
        u.suppression *= 0.2;
        u.decisionIn = 0;
        u.retreatUntil = 0;
      }
    if (c.effect === 'ammo') draw(s, side, 3);
    if (c.effect === 'emp' && !hopImmune) {
      foe.jam = Math.max(foe.jam, 14);
      foe.recon = 0;
      for (const u of s.units)
        if (
          u.side !== side &&
          isCombatant(u) &&
          visibleToSide(s, side, u) &&
          (CARDS[u.id].air || weaponCard(u).guided)
        ) {
          u.cooldown = Math.max(u.cooldown, 4);
          u.secondaryCooldown = Math.max(u.secondaryCooldown, 4);
        }
    }
    if (c.effect === 'barrage') callArtillery(s, side, x!, 'barrage');
    if (c.effect === 'medevac') {
      const patients = s.units.filter(
        (v) => v.side === side && canTakeDamage(v) && CARDS[v.id].members,
      );
      const patient = [...patients]
        .filter((v) => v.wounded || v.hp < v.maxHp)
        .sort(
          (a, b) =>
            Number(b.wounded) - Number(a.wounded) ||
            a.hp / a.maxHp - b.hp / b.maxHp,
        )[0];
      for (const u of patients.filter(
        (v) => patient && Math.abs(v.x - patient.x) <= 220,
      )) {
        u.hp = Math.min(u.maxHp, u.hp + 18);
        u.personalMorale = Math.min(100, u.personalMorale + 8);
        u.healing = 0.7;
        if (u.wounded) {
          u.rescueProgress += 1.6;
          u.rescuedAt = s.time;
        }
      }
    }
    if (c.effect === 'fortify') {
      p.fortify = 10;
      for (const u of own)
        u.personalMorale = Math.min(100, u.personalMorale + 10);
    }
    if (c.effect === 'sabotage')
      for (const u of s.units)
        if (u.side !== side && isCombatant(u) && visibleToSide(s, side, u)) {
          u.cooldown = Math.max(u.cooldown, 3);
          u.secondaryCooldown = Math.max(u.secondaryCooldown, 3);
        }
    if (c.effect === 'signal_jam' && !hopImmune)
      foe.jam = Math.max(foe.jam, 4);
    if (c.effect === 'forced_march')
      for (const u of own) u.forceMarchUntil = s.time + 12;
    if (c.effect === 'cyber_suppression' && !hopImmune) {
      foe.energy = Math.max(0, foe.energy - 3);
      foe.suppressedUntil = s.time + 6;
      // v132: 点穴打击——截获的 2 点指挥点归己方所有
      p.energy = Math.min(energyLimit(p), p.energy + 2);
    }
    if (c.effect === 'forage') draw(s, side, 1);
    if (c.effect === 'blitz') p.blitzUntil = s.time + 10;
    if (c.effect === 'blackout' && !hopImmune) foe.blackoutUntil = s.time + 8;
    if (c.effect === 'interdict' && !hopImmune)
      foe.taxCards = (foe.taxCards ?? 0) + 3;
    if (c.effect === 'spoof' && !hopImmune) foe.spoofUntil = s.time + 3;
    if (c.effect === 'radar_jam' && !hopImmune) foe.radarJamUntil = s.time + 8;
    if (c.effect === 'entrench') {
      p.entrenchUntil = s.time + 8;
      for (const u of own) {
        u.pose = setStance(u, s.time, 'prone', { force: true });
        u.personalMorale = Math.min(100, u.personalMorale + 5);
      }
    }
    // ── v120 new effects ─────────────────────────────────────────────
    if (c.effect === 'lockout' && !hopImmune) foe.lockoutUntil = s.time + 3;
    // v132: 全面静默——双方同时封锁出牌，双刃剑
    if (c.effect === 'ceasefire') {
      foe.lockoutUntil = s.time + 3;
      p.lockoutUntil = s.time + 3;
    }
    if (c.effect === 'salvage') {
      const pool = p.discard.filter((t) => {
        const cd = CARDS[t.id];
        return cd.type === 'unit' && cardCost(t) <= 3;
      });
      if (pool.length) {
        const t = pool[Math.floor(rnd(s) * pool.length)];
        p.discard.splice(p.discard.indexOf(t), 1);
        p.hand.push(t);
      }
    }
    if (c.effect === 'shock' && !hopImmune) {
      for (const u of s.units)
        if (u.side !== side && isCombatant(u) && CARDS[u.id].members)
          u.suppression = Math.min(100, u.suppression + 35);
      foe.shockUntil = s.time + 1.8;
    }
    if (c.effect === 'sensor_blind' && !hopImmune)
      foe.sensorBlindUntil = s.time + 6;
    if (c.effect === 'logistics_strike' && !hopImmune)
      foe.energy = Math.max(0, foe.energy - 3);
    if (c.effect === 'freq_hop') p.freqHopUntil = s.time + 8;
    if (c.effect === 'ewarfare' && !hopImmune) foe.ewarfareUntil = s.time + 5;
    if (c.effect === 'smoke_screen')
      for (const dx of [-100, 0, 100])
        s.smokes.push({
          x: Math.max(20, Math.min(W - 20, x! + dx)),
          life: 10,
          side,
        });
    if (c.effect === 'illumination') launchFlare(s, side, x!, 14, 160);
    if (c.effect === 'minefield')
      for (const dx of [-60, 0, 60])
        s.mines.push({
          uid: ++s.uid,
          side,
          x: Math.max(20, Math.min(W - 20, x! + dx)),
          armAt: s.time + 2,
        });
    if (c.effect === 'fallback') {
      const dir = side === 0 ? -280 : 280;
      for (const u of own)
        u.x = Math.max(40, Math.min(W - 40, u.x + dir));
      p.fallbackUntil = s.time + 2;
    }
  } else if (c.id === 'artillery') {
    callArtillery(s, side, x!, 'artillery');
  } else if (c.id === 'precision') {
    callArtillery(s, side, x!, 'precision');
  } else if (c.artilleryKind) {
    callArtillery(s, side, x!, c.artilleryKind as keyof typeof ARTILLERY);
  } else if (c.id === 'smoke') {
    s.smokes.push({ x: x!, life: 10, side });
  } else if (c.id === 'flare') {
    launchFlare(s, side, x!);
  } else if (c.id === 'recon') {
    p.recon = 12;
  } else if (c.id === 'repair') {
    const vehicle = s.units
      .filter(
        (u) =>
          u.side === side &&
          isCombatant(u) &&
          CARDS[u.id].armored &&
          !CARDS[u.id].air &&
          u.hp < u.maxHp,
      )
      .sort((a, b) => b.maxHp - b.hp - (a.maxHp - a.hp))[0];
    if (vehicle) {
      vehicle.hp = Math.min(vehicle.maxHp, vehicle.hp + 30);
      vehicle.repairTime = Math.max(vehicle.repairTime, 6);
      vehicle.healing = 0.7;
    }
  } else if (c.id === 'morale') {
    p.morale = 8;
    for (const u of s.units)
      if (u.side === side && isCombatant(u) && CARDS[u.id].members) {
        u.personalMorale = Math.min(100, u.personalMorale + 15);
        u.suppression *= 0.6;
        u.decisionIn = 0;
      }
  } else if (c.id === 'supply') {
    draw(s, side, 2);
  } else if (c.id === 'jam') {
    const foe = s.players[side === 0 ? 1 : 0];
    if ((foe.freqHopUntil ?? 0) <= s.time) foe.jam = Math.max(foe.jam, 9);
  }
  const message =
    side === 0
      ? `${c.name}${c.type === 'unit' ? '已部署' : '已下达'}`
      : `敌方${c.type === 'unit' ? '部署' : '使用'}：${c.name}`;
  notify(s, message, side === 0 ? 'good' : 'warn', [side]);
  return { ok: true, message };
}
// Prepared trench profiles depend only on the entrenchment layout and each
// trench's progress; cache one pair of Float64Arrays per game state so a
// barrage of impacts reuses it instead of allocating ~60KB per crater. The
// signature rounds progress to 4 decimals, so an actively dug trench rebuilds
// at most every few ticks (a sub-pixel staleness that the next impact heals).
const trenchProfiles = new WeakMap<
  GameState,
  { sig: string; depth: Float64Array; slope: Float64Array }
>();
// Games whose terrain has already had one full-width settle pass. The first
// crater of a game sweeps the whole map (trimming the integer-rounding steps
// in authored terrain); every later crater only settles its blast window.
const settledGames = new WeakSet<GameState>();
function trenchProfile(s: GameState) {
  if (!s.entrenchments?.length) return undefined;
  let sig = `${s.entrenchments.length}`;
  for (const t of s.entrenchments)
    sig += `|${t.x},${t.radius},${t.innerRadius},${t.floorY},${Math.round(
      t.progress * 10000,
    )}`;
  let entry = trenchProfiles.get(s);
  if (!entry || entry.sig !== sig) {
    const depth = new Float64Array(W);
    for (const trench of s.entrenchments) {
      const left = Math.max(126, Math.floor(trench.x - trench.radius));
      const right = Math.min(W - 127, Math.ceil(trench.x + trench.radius));
      for (let i = left; i <= right; i++)
        depth[i] = Math.max(
          depth[i],
          trenchCutDepth(s, trench, i) * trench.progress,
        );
    }
    const slope = new Float64Array(W);
    slope.fill(0.8);
    for (let i = 1; i < W; i++) {
      const a = depth[i - 1],
        b = depth[i];
      if (a !== 0 || b !== 0)
        slope[i] = Math.max(
          0.8,
          Math.abs(s.original[i - 1] + a - s.original[i] - b) + 1e-6,
        );
    }
    entry = { sig, depth, slope };
    trenchProfiles.set(s, entry);
  }
  return entry;
}
export function crater(
  s: GameState,
  x: number,
  radius: number,
  depth = radius * 0.5,
) {
  const profile = trenchProfile(s);
  const preparedDepth = profile?.depth;
  const preparedSlope = profile?.slope;
  const centerY = ground(s, x);
  const leftEdge = Math.max(125, Math.floor(x - radius));
  const rightEdge = Math.min(W - 125, x + radius);
  for (let i = leftEdge; i < rightEdge; i++) {
    const a = (i - x) / radius,
      dy = Math.sqrt(Math.max(0, 1 - a * a)) * depth;
    s.terrain[i] = Math.min(
      s.original[i] + Math.max(MAX_CRATER_DEPTH, preparedDepth?.[i] ?? 0),
      Math.max(s.terrain[i], centerY + dy),
    );
  }
  // Settle only the disturbed window. Three passes propagate slope
  // constraints at most three columns beyond the blast, so the four-column
  // margin covers it exactly; re-settling already-settled terrain is an exact
  // no-op (min/max selection, no arithmetic on the selected value).
  // Authored terrain carries sub-pixel steps (integer-rounded landforms), so
  // the first impact of each game still sweeps the full width exactly as
  // before; afterwards the slope invariant holds and later impacts only
  // settle their own window. The backward sweep is the forward window shifted
  // one column left, matching the original [126,W-126]/[125,W-127] stagger.
  const fullWidth = !settledGames.has(s);
  if (fullWidth) settledGames.add(s);
  const settleLoF = fullWidth ? 126 : Math.max(126, leftEdge - 4);
  const settleHiF = fullWidth ? W - 126 : Math.min(W - 126, rightEdge + 4);
  const settleLoB = settleLoF - 1;
  const settleHiB = settleHiF - 1;
  for (let pass = 0; pass < 3; pass++) {
    for (let i = settleLoF; i <= settleHiF; i++)
      s.terrain[i] = Math.max(
        s.original[i],
        Math.min(s.terrain[i], s.terrain[i - 1] + (preparedSlope?.[i] ?? 0.8)),
      );
    for (let i = settleHiB; i >= settleLoB; i--)
      s.terrain[i] = Math.max(
        s.original[i],
        Math.min(
          s.terrain[i],
          s.terrain[i + 1] + (preparedSlope?.[i + 1] ?? 0.8),
        ),
      );
  }
  s.terrainVersion++;
}
// Footsteps and vehicle tracks kick up small soil puffs so movement reads on the field.
function footPuff(s: GameState, u: Unit, heavy = false) {
  const n = heavy ? 2 : 1;
  for (let i = 0; i < n; i++) {
    const life = 0.35 + fxRnd(s) * 0.3;
    emitParticle(s, {
      kind: 'dust',
      x: u.x + (fxRnd(s) - 0.5) * (heavy ? 24 : 8),
      y: u.y - 1,
      vx: (fxRnd(s) - 0.5) * 10 - u.facing * 3,
      vy: -4 - fxRnd(s) * 5,
      life,
      maxLife: life,
      color: fxRnd(s) < 0.5 ? '#94876b' : '#a79571',
      size: (heavy ? 5 : 3) + fxRnd(s) * (heavy ? 5 : 3),
    });
  }
}
// Tracked and armored movement throws a substantial rooster-tail of soil that
// lingers behind the vehicle, so advances read as heavy, tracked motion.
function vehicleDust(s: GameState, u: Unit) {
  for (let i = 0; i < 4; i++) {
    const life = 0.8 + fxRnd(s) * 0.7;
    const roll = fxRnd(s);
    emitParticle(s, {
      kind: 'dust',
      x: u.x - u.facing * 10 + (fxRnd(s) - 0.5) * 28,
      y: u.y - 2,
      vx: (fxRnd(s) - 0.5) * 12 - u.facing * (6 + fxRnd(s) * 6),
      vy: -3 - fxRnd(s) * 6,
      life,
      maxLife: life,
      color: roll < 0.4 ? '#94876b' : roll < 0.75 ? '#a79571' : '#857a5f',
      size: 8 + fxRnd(s) * 10,
    });
  }
}
function burst(
  s: GameState,
  x: number,
  y: number,
  radius: number,
  kind: Blast['kind'] = 'he',
) {
  const soil =
    kind !== 'penetration' &&
    kind !== 'air' &&
    (kind === 'crash' || y >= ground(s, x) - 80);
  if (soil) y = ground(s, x);
  else if (kind !== 'penetration') kind = 'air';
  const blast: Blast = {
    x,
    y,
    age: 0,
    radius,
    kind,
    soil,
    seed: s.fxSeed,
  };
  s.explosions++;
  for (const side of [0, 1] as Side[])
    if (blastVisible(s, side, blast)) s.audibleExplosions[side]++;
  s.blasts.push(blast);
  s.blasts = s.blasts.slice(-32);
  if (blastVisible(s, 0, blast)) s.shake = Math.min(12, radius / 7);
  // v111: kind-tell particles layered under the authored v13 sprite frames.
  // A white-hot core flash sells the detonation in the first ~100ms; heavy
  // shells throw brown soil clods, vehicle kills spray sparks and embers.
  {
    const flashLife = 0.09 + fxRnd(s) * 0.05;
    emitParticle(s, {
      kind: 'flash',
      x,
      y: y - radius * 0.25,
      vx: 0,
      vy: 0,
      life: flashLife,
      maxLife: flashLife,
      color: kind === 'air' ? '#fff7e0' : '#ffe9b8',
      size:
        radius *
        (kind === 'crash' || kind === 'wreck'
          ? 1.25
          : kind === 'air'
            ? 1.1
            : 0.9 + fxRnd(s) * 0.3),
    });
  }
  if (kind === 'artillery' || (kind === 'he' && radius >= 26)) {
    const clods = Math.min(14, Math.max(6, Math.round(radius / 3)));
    for (let i = 0; i < clods; i++) {
      const a = -Math.PI / 2 + (fxRnd(s) - 0.5) * 1.7;
      const sp = 60 + fxRnd(s) * 130;
      const life = 0.5 + fxRnd(s) * 0.5;
      emitParticle(s, {
        kind: 'chip',
        x: x + (fxRnd(s) - 0.5) * radius * 0.4,
        y: y - 4,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life,
        maxLife: life,
        color: fxRnd(s) < 0.5 ? '#6b5638' : '#7d6543',
        size: 2 + fxRnd(s) * 3,
      });
    }
  }
  if (kind === 'wreck' || kind === 'crash') {
    const sparks = Math.min(22, Math.max(10, Math.round(radius / 4)));
    for (let i = 0; i < sparks; i++) {
      const a = -Math.PI / 2 + (fxRnd(s) - 0.5) * 2.2;
      const sp = 90 + fxRnd(s) * 200;
      const life = 0.25 + fxRnd(s) * 0.4;
      emitParticle(s, {
        kind: 'spark',
        x: x + (fxRnd(s) - 0.5) * radius * 0.5,
        y: y - radius * 0.3,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life,
        maxLife: life,
        color: fxRnd(s) < 0.6 ? '#ffd27a' : '#ff9a3c',
        size: 2,
      });
    }
    for (let i = 0; i < 6; i++) {
      const life = 0.8 + fxRnd(s) * 1.2;
      emitParticle(s, {
        kind: 'flash',
        x: x + (fxRnd(s) - 0.5) * radius * 0.6,
        y: y - radius * (0.2 + fxRnd(s) * 0.4),
        vx: (fxRnd(s) - 0.5) * 12,
        vy: -8 - fxRnd(s) * 14,
        life,
        maxLife: life,
        color: fxRnd(s) < 0.5 ? '#ff8a3c' : '#ffb05a',
        size: 3 + fxRnd(s) * 4,
      });
    }
  }
  // Lingering dust clouds rise and drift after the blast sprite fades.
  if (kind !== 'air' && kind !== 'penetration') {
    const cloudCount = Math.min(16, Math.max(5, Math.round(radius / 5)));
    for (let i = 0; i < cloudCount; i++) {
      const a = fxRnd(s) * Math.PI * 2;
      const d = fxRnd(s) * radius * 0.65;
      const life = 1.8 + fxRnd(s) * 2.2;
      emitParticle(s, {
        kind: 'cloud',
        x: x + Math.cos(a) * d,
        y: y - fxRnd(s) * 14,
        vx: (fxRnd(s) * 2 - 1) * 16,
        vy: -12 - fxRnd(s) * 18,
        life,
        maxLife: life,
        color: '#6e6358',
        size: radius * (0.35 + fxRnd(s) * 0.4),
      });
    }
    // v109: heavy blasts leave a standing smoke column — a bomb or tank
    // kill marks the sky for seconds instead of fading with the flash.
    if (soil && radius >= 20) {
      // v112: bombs and heavy shells (radius >= 30) throw a much taller,
      // darker column — a jet strike on the ground should read as a real
      // blast, not a rifle puff.
      const heavy = radius >= 30;
      const columnCount = heavy ? 24 : 12;
      for (let i = 0; i < columnCount; i++) {
        const life = heavy ? 4.5 + fxRnd(s) * 3.5 : 3 + fxRnd(s) * 2.5;
        emitParticle(s, {
          kind: 'cloud',
          x: x + (fxRnd(s) - 0.5) * radius * (heavy ? 0.7 : 0.5),
          y: y - fxRnd(s) * 10,
          vx: (fxRnd(s) - 0.5) * (heavy ? 14 : 10),
          vy: heavy ? -34 - fxRnd(s) * 40 : -24 - fxRnd(s) * 26,
          life,
          maxLife: life,
          color: heavy
            ? (fxRnd(s) < 0.5 ? '#463e34' : '#5c5347')
            : (fxRnd(s) < 0.5 ? '#5c5347' : '#6e6358'),
          size: radius * (heavy ? 0.7 + fxRnd(s) * 0.6 : 0.5 + fxRnd(s) * 0.45),
        });
      }
    }
  }
  // Persistent scorch marks accumulate so the field shows its battle history.
  if (soil) {
    s.scorches.push({
      x,
      y,
      radius: Math.max(10, radius * (0.5 + fxRnd(s) * 0.3)),
      seed: s.fxSeed,
    });
    s.scorches = s.scorches.slice(-64);
  }
  // Generated sprite frames contain the fire, smoke and debris. Only animation state is simulated.
  fxRnd(s);
}

export function emitParticle(s: GameState, init: Particle): void {
  const pool = s.particlePool;
  const p = pool && pool.length ? pool.pop()! : init;
  if (p !== init) {
    p.kind = init.kind;
    p.x = init.x;
    p.y = init.y;
    p.vx = init.vx;
    p.vy = init.vy;
    p.life = init.life;
    p.maxLife = init.maxLife;
    p.color = init.color;
    p.size = init.size;
    p.endX = init.endX;
    p.endY = init.endY;
    p.variant = init.variant;
    p.opacity = init.opacity;
  }
  s.particles.push(p);
}

// --- Weapon overheat -----------------------------------------------------
// Sustained automatic fire cooks the barrel: past OVERHEAT_HOT the gunner's
// aim wanders as the barrel shimmers, and at OVERHEAT_CRIT he is forced to
// break off and change barrels before the weapon jams or cooks off.
export const OVERHEAT_HOT = 4.5;
export const OVERHEAT_CRIT = 7;
const OVERHEAT_LOCK = 2.5;
const OVERHEAT_VENT = 4.5;
export function canOverheat(u: Unit): boolean {
  // Aircraft autocannons are slipstream-cooled; the infantry barrel-change
  // heat model does not apply to them (was locking strike jets mid-strafe).
  if (CARDS[u.id].air) return false;
  const a = ammunition(u.id, u.member);
  return a === 'machinegun' || a === 'autocannon';
}
export function unitHeat(s: GameState, u: Unit): number {
  return (u.heat ?? 0) * Math.exp(-(s.time - (u.heatAt ?? s.time)) / 4);
}
export function overheated(s: GameState, u: Unit): boolean {
  return (u.overheatedUntil ?? 0) > s.time;
}

function muzzleParticles(
  s: GameState,
  u: Unit,
  kind: Ammunition,
  sx: number,
  sy: number,
  secondary = false,
) {
  if (kind === 'drone') return;
  // AP leaves the same tank/AT-gun barrel as HE. Its muzzle discharge must
  // not fall through to the tiny rifle puff just because the target is armor.
  const heavy = kind === 'cannon' || kind === 'ap';
  const angle = secondary ? u.secondaryAngle : u.shotAngle;
  const dx = Math.cos(angle), dy = Math.sin(angle);
  emitParticle(s, {
    kind: 'smoke',
    x: sx,
    y: sy,
    vx: dx * 9,
    vy: dy * 9 - 7,
    life: heavy ? 0.42 : 0.22,
    maxLife: heavy ? 0.42 : 0.22,
    color: '#a7aa98',
    size: heavy ? 8 : 3,
    opacity: heavy ? 0.55 : undefined,
  });
  // v109: a cannon shot belches a rolling smoke jet and a star of hot
  // sparks from the muzzle — the blast reads as an event, not a puff.
  if (heavy) {
    for (let i = 0; i < 5; i++) {
      const life = 0.5 + fxRnd(s) * 0.5;
      const offset = 4 + fxRnd(s) * 6;
      const lift = fxRnd(s) * 4;
      const speed = 14 + fxRnd(s) * 22;
      const rise = 6 + fxRnd(s) * 12;
      emitParticle(s, {
        kind: 'smoke',
        x: sx + dx * offset,
        y: sy + dy * offset - lift,
        vx: dx * speed,
        vy: dy * speed - rise,
        life,
        maxLife: life,
        color: fxRnd(s) < 0.5 ? '#b8b3a2' : '#8f8c7c',
        size: 6 + fxRnd(s) * 7,
        opacity: 0.55,
      });
    }
    for (let i = 0; i < 7; i++) {
      const ang = (i / 7) * Math.PI * 2 + (fxRnd(s) - 0.5) * 0.5;
      const sp = 60 + fxRnd(s) * 90;
      const life = 0.1 + fxRnd(s) * 0.12;
      emitParticle(s, {
        kind: 'spark',
        x: sx,
        y: sy,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        life,
        maxLife: life,
        color: fxRnd(s) < 0.5 ? '#ffd27a' : '#ffb347',
        size: 1,
      });
    }
  }
  // Sustained fire builds gunsmoke that lingers over the firing position.
  const heatGain =
    kind === 'cannon' || kind === 'ap'
      ? 2.6
      : kind === 'rocket' || kind === 'mortar'
        ? 1.6
        : kind === 'machinegun'
          ? 0.5
          : kind === 'autocannon'
            ? 0.75
            : 0.5;
  const since = s.time - (u.heatAt ?? s.time);
  u.heat = (u.heat ?? 0) * Math.exp(-since / 4) + heatGain;
  u.heatAt = s.time;
  if (u.heat >= 3) {
    const life = 6 + fxRnd(s) * 6;
    emitParticle(s, {
      kind: 'haze',
      x: sx + (fxRnd(s) - 0.5) * 14,
      y: sy - 6 - fxRnd(s) * 8,
      vx: (u.side === 0 ? 3 : -3) + (fxRnd(s) - 0.5) * 6,
      vy: -2.5 - fxRnd(s) * 2,
      life,
      maxLife: life,
      color: fxRnd(s) < 0.5 ? '#8f8d80' : '#9a9384',
      size: 13 + fxRnd(s) * 9,
    });
  }
  if (kind === 'rifle' || kind === 'machinegun' || kind === 'autocannon') {
    // Casings arc out of the ejection port, bounce off the dirt and lie
    // glinting on the ground for a few seconds before they fade.
    const life = 2.4 + fxRnd(s) * 1.8;
    emitParticle(s, {
      kind: 'casing',
      x: u.x + (u.side === 0 ? 1 : -1) * (secondary ? 40 : 4),
      y: sy + 4,
      vx: (u.side === 0 ? -1 : 1) * (14 + fxRnd(s) * 15),
      vy: -25 - fxRnd(s) * 12,
      life,
      maxLife: life,
      color: fxRnd(s) < 0.5 ? '#c8a84e' : '#a18a55',
      size: 1,
    });
  }
}
function bulletImpact(
  s: GameState,
  x: number,
  y: number,
  material: 'soil' | 'armor' | 'cloth',
  direction: number,
  ammo?: Ammunition,
  incomingAngle = 0,
) {
  // v95: a supersonic round that strikes armour may skip off it. Visual and
  // audio only — the round's damage is already resolved by the caller.
  if (material === 'armor' && canRicochet(ammo) && fxRnd(s) < ricochetChance(ammo))
    s.ricochets.push({
      x,
      y,
      angle: reflectAngle(incomingAngle, (fxRnd(s) - 0.5) * 0.7),
      age: 0,
      seed: s.fxSeed % 8,
      side: 0,
    });
  if (material === 'soil')
    emitParticle(s, {
      kind: 'impact',
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0.48,
      maxLife: 0.48,
      color: '#b3a07a',
      // v107: autocannon hits burst like small explosions — a 30mm round
      // throws a dirt column, not a rifle puff.
      size: ammo === 'cannon' ? 46 : ammo === 'autocannon' ? 52 : 26,
      variant: y < ground(s, x) - 5 ? 1 : 0,
    });
  const heavy = ammo === 'cannon' || ammo === 'autocannon';
  const count = material === 'soil' ? (ammo === 'cannon' ? 9 : heavy ? 7 : 5) : 3;
  for (let i = 0; i < count; i++) {
    const life = 0.1 + fxRnd(s) * 0.16;
    emitParticle(s, {
      kind: material === 'armor' ? 'spark' : 'chip',
      x,
      y,
      vx:
        direction *
          ((heavy ? 18 : 10) + fxRnd(s) * (heavy ? 60 : 38)) +
        (fxRnd(s) - 0.5) * 20,
      vy: -(heavy ? 14 : 8) - fxRnd(s) * (heavy ? 70 : 45),
      life,
      maxLife: life,
      color:
        material === 'armor'
          ? i
            ? '#b7a17a'
            : '#ddc9a1'
          : material === 'cloth'
            ? '#777b63'
            : i % 2
              ? '#71624b'
              : '#a79571',
      size: 1,
    });
  }
  if (material === 'soil')
    for (let i = 0; i < (ammo === 'cannon' ? 7 : ammo === 'autocannon' ? 10 : 3); i++) {
      const life = 0.2 + fxRnd(s) * 0.18;
      emitParticle(s, {
        kind: 'dust',
        x: x + (fxRnd(s) - 0.5) * 4,
        y: y - 2,
        vx: (fxRnd(s) - 0.5) * 16,
        vy: -(ammo === 'autocannon' ? 22 : heavy ? 13 : 8) - fxRnd(s) * (ammo === 'autocannon' ? 28 : heavy ? 18 : 11),
        life,
        maxLife: life,
        color: '#94876b',
        size:
          (ammo === 'cannon' ? 9 : ammo === 'autocannon' ? 12 : 5) +
          fxRnd(s) * (ammo === 'cannon' ? 7 : ammo === 'autocannon' ? 9 : 4),
      });
    }
  // v107: autocannon strafes leave a tall smoke column — each 30mm hit
  // throws a dirt-and-smoke pillar that lingers, so a strafing run reads
  // as a line of bursting explosions, not rifle puffs.
  if (material === 'soil' && heavy)
    for (let i = 0; i < (ammo === 'cannon' ? 4 : ammo === 'autocannon' ? 10 : 2); i++) {
      const life = ammo === 'autocannon' ? 1.6 + fxRnd(s) * 1.2 : 0.7 + fxRnd(s) * 0.6;
      emitParticle(s, {
        kind: 'smoke',
        x: x + (fxRnd(s) - 0.5) * (ammo === 'autocannon' ? 18 : 8),
        y: y - (ammo === 'autocannon' ? 8 : 3),
        vx: (fxRnd(s) - 0.5) * (ammo === 'autocannon' ? 20 : 10),
        vy: -(ammo === 'autocannon' ? 30 : 14) - fxRnd(s) * (ammo === 'autocannon' ? 26 : 12),
        life,
        maxLife: life,
        color: '#8f8b7d',
        size:
          (ammo === 'cannon' ? 10 : ammo === 'autocannon' ? 18 : 7) +
          fxRnd(s) * (ammo === 'cannon' ? 7 : ammo === 'autocannon' ? 14 : 5),
      });
    }
  // v107: autocannon soil hits also kick up a brief flash of loose dirt
  // clods that arc outward and fall, selling the explosion scale.
  if (material === 'soil' && ammo === 'autocannon')
    for (let i = 0; i < 5; i++) {
      const life = 0.35 + fxRnd(s) * 0.3;
      emitParticle(s, {
        kind: 'chip',
        x: x + (fxRnd(s) - 0.5) * 6,
        y: y - 2,
        vx: direction * (30 + fxRnd(s) * 70) + (fxRnd(s) - 0.5) * 40,
        vy: -(40 + fxRnd(s) * 80),
        life,
        maxLife: life,
        color: i % 2 ? '#71624b' : '#a79571',
        size: 1.5 + fxRnd(s) * 1.5,
      });
    }
}
// v92: squad veterancy — a squad that has spilled blood keeps its nerve under
// fire, walks its shells closer, and brings its weapon to bear faster. The
// director never grants this: both sides earn it the same way, with real kills.
const VETERAN_KILLS = [3, 7, 12];
const VETERAN_SUPPRESSION = [1, 0.85, 0.72, 0.6];
const VETERAN_SCATTER = [1, 0.9, 0.8, 0.7];
const VETERAN_READINESS = [1, 0.85, 0.7, 0.55];
const VETERAN_NAMES = ['', '老兵', '精锐', '王牌'];
export function veteranTier(u: Unit): number {
  const k = u.kills ?? 0;
  return k >= VETERAN_KILLS[2]
    ? 3
    : k >= VETERAN_KILLS[1]
      ? 2
      : k >= VETERAN_KILLS[0]
        ? 1
        : 0;
}
export function veteranSuppression(u: Unit): number {
  return VETERAN_SUPPRESSION[veteranTier(u)];
}
export function veteranScatter(u: Unit): number {
  return VETERAN_SCATTER[veteranTier(u)];
}
export function veteranReadiness(u: Unit): number {
  return VETERAN_READINESS[veteranTier(u)];
}

function creditKill(s: GameState, a: Unit) {
  const before = veteranTier(a);
  a.kills = (a.kills ?? 0) + 1;
  a.lastKillAt = s.time;
  const after = veteranTier(a);
  if (after > before) {
    a.veteranAt = s.time;
    notify(
      s,
      `${a.side === 0 ? '我方' : '敌方'}${CARDS[a.id].name}在战火中锤炼为${VETERAN_NAMES[after]}`,
      'info',
      ([0, 1] as Side[]).filter((side) => visibleToSide(s, side, a)),
    );
  }
}

function hitUnit(
  s: GameState,
  u: Unit,
  damage: number,
  side: Side,
  cover = 0,
  source: 'bullet' | 'blast' | 'gas' = 'bullet',
  attackerUid?: number,
  blastX?: number,
  blastY?: number,
) {
  if (!canTakeDamage(u)) return;
  const c = CARDS[u.id];
  const attacker =
    attackerUid !== undefined
      ? s.units.find((q) => q.uid === attackerUid)
      : undefined;
  const attackerCard = attacker ? CARDS[attacker.id] : undefined;
  const protection =
    u.pose === 'prone'
      ? 0.7
      : u.pose === 'hunker'
        ? 0.8
        : u.pose === 'crouch'
          ? 0.85
          : 1;
  const actual =
    source === 'gas'
      ? damage
      : damage *
        protection *
        (attackerCard?.infantryAbility === 'flusher' ? 1 : 1 - cover) *
        (source === 'blast' ? (c.blastProtection ?? 1) : 1) *
        (c.trait === 'armor_vest' ? 0.88 : 1) *
        (attackerCard?.infantryAbility === 'anti_materiel' &&
        (c.armored || c.vehicle)
          ? 2.5
          : 1) *
        (c.members && !u.moving && s.players[u.side].fortify > 0 ? 0.7 : 1) *
        (c.members && (s.players[u.side].entrenchUntil ?? 0) > s.time
          ? 0.7
          : 1);
  u.hp -= actual;
  if (actual > 0 && u.id === 'ambush_squad') {
    u.camouflageFor = 0;
    u.camouflageRevealedUntil = s.time + AMBUSH_REVEAL;
  }
  // v109: blast hits that chunk a squad spray blood and equipment
  // fragments off the impact point — bullets poke, blasts shred.
  if (c.members && source === 'blast' && actual > u.maxHp * 0.08) {
    for (let i = 0; i < 6; i++) {
      const life = 0.5 + fxRnd(s) * 0.6;
      emitParticle(s, {
        kind: 'blood',
        x: u.x + (fxRnd(s) - 0.5) * 8,
        y: u.y - 14 - fxRnd(s) * 8,
        vx: (fxRnd(s) - 0.5) * 180,
        vy: -60 - fxRnd(s) * 90,
        life,
        maxLife: life,
        color: '#7a2420',
        size: 1.5 + fxRnd(s) * 2,
      });
    }
    for (let i = 0; i < 4; i++) {
      const life = 0.7 + fxRnd(s) * 0.7;
      emitParticle(s, {
        kind: 'chip',
        x: u.x + (fxRnd(s) - 0.5) * 8,
        y: u.y - 12 - fxRnd(s) * 6,
        vx: (fxRnd(s) - 0.5) * 240,
        vy: -80 - fxRnd(s) * 110,
        life,
        maxLife: life,
        color: fxRnd(s) < 0.5 ? '#3d3a30' : '#5a5142',
        size: 1 + fxRnd(s) * 1.5,
      });
    }
  }
  if (c.members && source !== 'gas') {
    const supported =
      c.infantryAbility === 'cohesion' &&
      squadMates(s, u.side, u.squad).filter(
        (v) =>
          v !== u &&
          isCombatant(v) &&
          Math.abs(v.x - u.x) <= 90,
      ).length >= 2;
    const resolve = supported || c.infantryAbility === 'elite' || c.infantryAbility === 'fire_discipline' ? 0.65 : 1;
    const umbrella = aaUmbrella(s, u.side, u.x) ? 0.7 : 1;
    const firebase = unitSynergy(s, u, s.time).fire_base ? 0.65 : 1;
    const suppressiveFire =
      attackerCard?.infantryAbility === 'suppressive' ? 1.5 : 1;
    const swarmNerves = c.infantryAbility === 'swarm' ? 0.75 : 1;
    u.suppression = Math.min(
      100,
      u.suppression +
        ((actual / u.maxHp) * 90 + 6) *
          resolve *
          umbrella *
          firebase *
          suppressiveFire *
          swarmNerves *
          veteranSuppression(u),
    );
    u.personalMorale = Math.max(
      0,
      u.personalMorale -
        // v113: being shot at mainly builds suppression; direct morale
        // damage is a small fraction of the hit so a single burst doesn't
        // break a man. Morale erosion now comes from the local force ratio
        // and mounting casualties (see decideTactic / finishDeath).
        (actual / u.maxHp) * (30 - (c.discipline ?? 80) * 0.12) * resolve,
    );
    if (u.personalMorale < 35) u.decisionIn = 0;
  }
  u.flash = 0.16;
  if (u.hp <= 0) {
    if (attackerUid !== undefined) {
      const a = s.units.find((q) => q.uid === attackerUid);
      if (a && a.side !== u.side && a.uid !== u.uid) creditKill(s, a);
    }
    finishDeath(s, u, side, source, blastX, blastY);
    return;
  }
  if (
    c.members &&
    !u.wounded &&
    source === 'bullet' &&
    u.injuryCooldown <= 0 &&
    u.hp <= u.maxHp * 0.55
  ) {
    s.injurySeed = (Math.imul(1664525, s.injurySeed) + 1013904223) >>> 0;
    if (s.injurySeed / 4294967296 < Math.min(0.35, (0.9 * actual) / u.maxHp)) {
      u.woundedFromPose = u.pose;
      u.wounded = true;
      u.rappelling = false;
      u.parachuting = false;
      u.woundedTime = 0;
      u.bleedOut = 25;
      u.woundedBy = side;
      u.rescueProgress = 0;
      u.fire = 0;
      u.secondaryFire = 0;
      u.moving = false;
      u.climbing = 0;
      u.motion = 'ground';
      u.coverGoal = null;
      u.pose = setStance(u, s.time, 'prone', { force: true });
      u.y = ground(s, u.x);
      notify(
        s,
        `${u.side === 0 ? '我方' : '敌方'}${c.name}有队员倒地待救`,
        'info',
        ([0, 1] as Side[]).filter((side) => visibleToSide(s, side, u)),
      );
    }
  }
}
function finishDeath(
  s: GameState,
  u: Unit,
  side: Side,
  source: 'bullet' | 'blast' | 'gas' = 'bullet',
  blastX?: number,
  blastY?: number,
) {
  if (u.destroyed) return;
  u.destroyed = true;
  // Sever any buddy-drag bond so the survivor returns to combat.
  if (u.draggingUid !== undefined) {
    const p = s.units.find((q) => q.uid === u.draggingUid);
    if (p) p.draggedByUid = undefined;
    u.draggingUid = undefined;
  }
  if (u.draggedByUid !== undefined) {
    const d = s.units.find((q) => q.uid === u.draggedByUid);
    if (d) d.draggingUid = undefined;
    u.draggedByUid = undefined;
  }
  // v84: sever the lifesaver bond — the man he was bandaging is gone.
  if (u.firstAidByUid !== undefined) {
    const d = s.units.find((q) => q.uid === u.firstAidByUid);
    if (d) {
      d.firstAidUntil = undefined;
      d.firstAidTargetUid = undefined;
    }
    u.firstAidByUid = undefined;
  }
  const overkill = Math.max(0, -u.hp);
  u.hp = 0;
  u.wounded = false;
  u.deadFor = 0;
  u.moving = false;
  u.fire = 0;
  u.secondaryFire = 0;
  if (side !== u.side) s.players[side].kills++;
  // v113: the first casualty stings but doesn't break a squad; morale damage
  // scales with how much of the squad has already been lost, so a unit being
  // carved up alone collapses while a fresh squad shrugs off one man down.
  const squadInitial = CARDS[u.id].members ?? 1;
  const squadAlive = squadMates(s, u.side, u.squad).filter(isCombatant)
    .length;
  const lostRatio = Math.max(
    0,
    Math.min(1, 1 - squadAlive / Math.max(1, squadInitial)),
  );
  for (const friend of squadMates(s, u.side, u.squad))
    if (friend !== u && isCombatant(friend)) {
      friend.personalMorale = Math.max(
        0,
        friend.personalMorale -
          7 * (1 + lostRatio * 2.2) * veteranSuppression(friend),
      );
      friend.decisionIn = 0;
    }
  const c = CARDS[u.id];
  // v106: infantry caught inside a blast are thrown clear — the body flies,
  // tumbles on a spin axis and crumples where it lands, instead of dropping
  // in place like a bullet casualty. Power falls off with distance from the
  // burst so a near miss tosses a man across the lane while a grazing kill
  // only kicks him a step.
  const ragdoll =
    !!c.members &&
    source === 'blast' &&
    blastX !== undefined &&
    blastY !== undefined;
  const blastDist = ragdoll
    ? Math.hypot(u.x - blastX, u.y - 20 - blastY)
    : 0;
  const blastPower = ragdoll ? Math.max(0.25, 1 - blastDist / 110) : 0;
  const throwDir = ragdoll
    ? Math.sign(u.x - (blastX as number)) || u.facing || 1
    : 0;
  s.wrecks.push({
    id: u.uid,
    cardId: u.id,
    side: u.side,
    pose: u.pose,
    facing: u.facing,
    lane: u.lane,
    x: u.x,
    y: u.y,
    angle: u.hullAngle,
    age: 0,
    falling: airborneTarget(u) || ragdoll,
    vx: c.air
      ? u.facing * 70
      : ragdoll
        ? throwDir * (80 + blastPower * 120)
        : 0,
    vy: ragdoll ? -(110 + blastPower * 100) : 0,
    ...(ragdoll ? { spin: throwDir * (4 + blastPower * 6) } : {}),
    cause: source === 'gas' ? 'burn' : source,
    // v83: a fallen rifleman keeps his remaining ammunition on the body
    // so a dry squadmate can pull a magazine off the same weapon.
    ...(magazine(u.id, u.member)
      ? { member: u.member, ammo: u.ammo, ammoReserve: u.ammoReserve ?? 0 }
      : {}),
  });
  // v109: a ragdolling body leaves a short blood arc behind it so the throw
  // reads as violent rather than a statue sliding across the ground.
  if (ragdoll) {
    for (let i = 0; i < 8; i++) {
      const life = 0.4 + fxRnd(s) * 0.5;
      emitParticle(s, {
        kind: 'blood',
        x: u.x + (fxRnd(s) - 0.5) * 6,
        y: u.y - 12 - fxRnd(s) * 10,
        vx: -throwDir * (30 + fxRnd(s) * 60),
        vy: -40 - fxRnd(s) * 70,
        life,
        maxLife: life,
        color: '#7a2420',
        size: 1.5 + fxRnd(s) * 2,
      });
    }
  }
  if (!c.members && !c.air)
    burst(s, u.x, u.y - 20, c.armored ? 60 : 42, 'wreck');
  else if (c.air && !u.glider) burst(s, u.x, u.y - 20, c.oneWay ? 12 : 24, 'air');
  bailoutCrew(s, u, c, overkill);
  settleSortie(s, u, false);
}

/** Spawn surviving vehicle crew as shaken infantry who stumble away from the wreck. */
function bailoutCrew(s: GameState, u: Unit, c: Card, overkill: number) {
  const crew = c.crew ?? 0;
  if (!crew || c.air || c.oneWay) return;
  // A catastrophic kill (heavy overkill) leaves fewer survivors than a gradual knock-out.
  const survival = Math.max(0.22, 0.82 - (overkill / Math.max(1, u.maxHp)) * 0.55);
  const dir = u.side === 0 ? -1 : 1; // toward own baseline
  let bailed = 0;
  for (let i = 0; i < crew; i++) {
    if (rnd(s) >= survival) continue;
    const lateral = (i - (crew - 1) / 2) * 15;
    const bx = Math.max(
      60,
      Math.min(W - 60, u.x + dir * (16 + rnd(s) * 12) + lateral * 0.35),
    );
    spawnUnit(s, u.side, 'infantry', bx, { member: 0 });
    const m = s.units[s.units.length - 1];
    m.lane = lateral;
    m.hp = m.maxHp * (0.35 + rnd(s) * 0.25);
    m.personalMorale = 28 + rnd(s) * 14;
    m.suppression = 58 + rnd(s) * 28;
    m.bailoutUntil = s.time + 1.8 + rnd(s) * 0.9;
    m.cooldown = 1.4 + rnd(s) * 0.7;
    m.facing = dir;
    bailed++;
  }
  if (bailed > 0)
    notify(
      s,
      `${u.side === 0 ? '我方' : '敌方'}${c.name}${bailed} 名乘员弃车逃生`,
      'info',
      ([0, 1] as Side[]).filter((side) => visibleToSide(s, side, u)),
    );
}
function settleSortie(s: GameState, u: Unit, success: boolean) {
  const token = u.sortieCard;
  if (!token) return;
  u.sortieCard = null;
  token.returnedOnce = success;
  token.readyAt = s.time + (CARDS[u.id].sortieCooldown ?? 18);
  const p = s.players[u.side];
  if (success && p.hand.length < MAX_HAND) p.hand.push(token);
  else p.discard.push(token);
  if (success)
    notify(
      s,
      `${CARDS[u.id].name}返航${p.hand.includes(token) ? '回手' : '，手牌已满转入弃牌'}，补给后可低费派遣`,
      'info',
      [u.side],
    );
}
function revive(u: Unit, time: number) {
  u.wounded = false;
  u.woundedTime = 0;
  u.bleedOut = 0;
  u.rescueProgress = 0;
  u.stabilizedUntil = 0;
  u.firstAidByUid = undefined;
  // v131: a revived soldier is on the ground, not on a rope.
  u.rappelling = false;
  u.parachuting = false;
  // The dragger notices his comrade is back on his feet and lets go.
  u.draggedByUid = undefined;
  u.injuryCooldown = 4;
  u.hp = Math.max(u.hp, u.maxHp * 0.4);
  u.personalMorale = Math.max(55, u.personalMorale);
  u.suppression = 20;
  u.cooldown = Math.max(1.2, u.cooldown);
  u.tactic = 'crouch';
  u.pose = setStance(u, time, 'crouch', { force: true });
  u.decisionIn = 1.5;
  u.retreatUntil = 0;
}
/** Sample actual earth before the blast digs it away; the decorative rear wall is not collision. */
function blastEarthCover(s: GameState, x: number, y: number, u: Unit) {
  const startY = Math.min(y, ground(s, x) - 2);
  const torso = bodyHeight(u);
  const lower = Math.max(3, torso * 0.4);
  let blocked = 0;
  for (const height of [lower, torso])
    if (terrainIntercept(s, x, startY, u.x, u.y - height, true, true))
      blocked++;
  // Earth can shield legs while the torso remains exposed. Even both rays never grant immunity.
  return blocked * 0.3;
}
export function explode(
  s: GameState,
  x: number,
  y: number,
  radius: number,
  damage: number,
  side: Side,
  baseScale = 1,
  armorMultiplier = 1,
  kind: Blast['kind'] = 'he',
  infantryMultiplier = 1,
  sourceUid?: number,
) {
  burst(s, x, y, radius, kind);
  const sheltered = new Map<number, number>();
  for (const u of s.units) {
    if (
      u.side === side ||
      !CARDS[u.id].members ||
      !canTakeDamage(u) ||
      Math.hypot(u.x - x, u.y - 20 - y) >= radius + 12
    )
      continue;
    const earth = blastEarthCover(s, x, y, u);
    const debris = sceneryIntercept(
      s,
      x,
      y,
      u.x,
      u.y - 20,
      false,
      true,
      false,
      kind === 'artillery',
    )
      ? 0.65
      : 0;
    sheltered.set(u.uid, Math.max(earth, debris));
  }
  damageScenery(s, x, y, radius, damage);
  s.visionIn = 0;
  for (const wall of s.walls) {
    if (
      wall.hp > 0 &&
      Math.hypot(wall.x - x, ground(s, wall.x) - wall.height / 2 - y) <
        radius + wall.width / 2
    )
      wall.hp = Math.max(0, wall.hp - damage);
  }
  // Blast reach and the excavated soil footprint are deliberately separate.
  if (y > ground(s, x) - 80) {
    const small = kind === 'grenade';
    const soilRadius = Math.min(small ? 15 : 44, radius * (small ? 0.4 : 0.8));
    crater(
      s,
      x,
      soilRadius,
      Math.min(small ? 3.5 : 10, radius * (small ? 0.1 : 0.18)),
    );
  }
  for (const u of s.units) {
    if (u.side === side || !canTakeDamage(u)) continue;
    let dist = Math.hypot(
      u.x - x,
      u.y - (CARDS[u.id].air ? bodyHeight(u) : 20) - y,
    );
    if (CARDS[u.id].armored || CARDS[u.id].vehicle) {
      // Measure from the hull, including when tracks bridge a crater.
      const dx = x - u.x,
        dy = y - u.y,
        cos = Math.cos(u.hullAngle),
        sin = Math.sin(u.hullAngle),
        localX = dx * cos + dy * sin,
        localY = -dx * sin + dy * cos,
        half = armorHalf(u.id);
      dist = Math.hypot(
        Math.max(0, Math.abs(localX) - half),
        Math.max(0, localY, -armorHeight(u.id) - localY),
      );
    }
    if (dist < radius + 12)
      hitUnit(
        s,
        u,
        damage *
          Math.pow(Math.max(0, 1 - dist / (radius + 12)), 1.25) *
          (CARDS[u.id].armored
            ? armorMultiplier
            : CARDS[u.id].members
              ? infantryMultiplier
              : 1),
        // Weapon modifiers apply to each victim, never to the selected target alone.
        side,
        sheltered.get(u.uid) ?? 0,
        'blast',
        sourceUid,
        x,
        y,
      );
  }
  // Near misses landing just outside the kill radius still make infantry
  // hit the dirt — the closer the blast, the longer and lower the reaction.
  for (const u of s.units) {
    if (
      u.side === side ||
      !CARDS[u.id].members ||
      u.wounded ||
      u.surrendered ||
      !canTakeDamage(u)
    )
      continue;
    const inner = radius + 12;
    const dist = Math.hypot(u.x - x, u.y - 20 - y);
    if (dist <= inner || dist > inner * 2.1) continue;
    const proximity = 1 - (dist - inner) / (inner * 1.1);
    u.suppression = Math.min(100, u.suppression + 10 + proximity * 22);
    u.flinchUntil = s.time + 0.4 + proximity * 0.45;
    u.flinchProne = dist < inner * 1.35;
    u.decisionIn = Math.max(u.decisionIn, 0.3);
    u.lastThreat = { x, y, until: s.time + 2 };
  }
  // Distant blasts draw the eye: infantry well outside the flinch band snap
  // their gaze toward the impact for a beat, so the whole line reacts to
  // artillery instead of only the men caught in the open. Both sides glance —
  // the flash and dust column read across the battlefield — and the reaction
  // is animation-only (a sprite-flip hint consumed by the idle pose layer),
  // never a change to facing, vision or AI state.
  const glanceInner = (radius + 12) * 2.1;
  const awareness = Math.min(800, Math.max(280, (radius + 12) * 4.5));
  for (const u of s.units) {
    if (!CARDS[u.id].members || u.wounded || u.surrendered || u.hp <= 0)
      continue;
    const dist = Math.hypot(u.x - x, u.y - 20 - y);
    if (dist <= glanceInner || dist > awareness) continue;
    u.blastGlanceUntil = s.time + 0.85;
    u.blastGlanceDir = (u.x >= x ? -1 : 1) as 1 | -1;
  }
  for (const target of [0, 1] as Side[]) {
    if (target === side) continue;
    const bx = target === 0 ? 70 : W - 70;
    if (Math.hypot(bx - x, ground(s, bx) - 20 - y) < radius + 40)
      s.players[target].hp = Math.max(
        0,
        s.players[target].hp - damage * baseScale,
      );
  }
}
export function craterCover(s: GameState, x: number, threatX: number) {
  const y = ground(s, x),
    depth = y - s.original[Math.max(0, Math.min(W - 1, Math.floor(x)))];
  const debris = Math.max(debrisCover(s, x, threatX), trenchProtection(s, x));
  if (depth < 6) return debris;
  const dir = threatX >= x ? 1 : -1;
  let lip = y;
  for (let d = 8; d <= 60; d += 2) lip = Math.min(lip, ground(s, x + dir * d));
  return Math.max(debris, Math.max(0, Math.min(1, (y - lip - 4) / 15)));
}
export function terrainIntercept(
  s: GameState,
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  ignoreSoftCover = false,
  ignoreAllCover = false,
  ignoreRubble = false,
) {
  const prop = ignoreAllCover
    ? null
    : sceneryIntercept(
        s,
        sx,
        sy,
        tx,
        ty,
        false,
        false,
        ignoreSoftCover,
        ignoreRubble,
      );
  const soil = heightfieldIntercept(s, sx, sy, tx, ty, prop?.t ?? 1);
  if (soil)
    return prop && prop.t < soil.t
      ? { x: prop.x, y: prop.y }
      : { x: soil.x, y: soil.y };
  return prop ? { x: prop.x, y: prop.y } : null;
}
export function projectileIntercept(
  s: GameState,
  p: Projectile,
  sx: number,
  sy: number,
  tx: number,
  ty: number,
) {
  // Indirect shells clear nearby scenery throughout the ascent to their apex.
  // Ground is still solid, and buildings/trees intercept the descending shell.
  const progress = 1 - Math.max(0, p.life) / p.total;
  const rising = p.ty - p.startY - 4 * (p.arc ?? 0) * (1 - 2 * progress) < 0;
  const indirectShell = p.shell || p.ammunition === 'mortar';
  if ((indirectShell && rising) || (p.topAttack && ty < sy))
    return terrainIntercept(s, sx, sy, tx, ty, true, true);
  if (indirectShell)
    return terrainIntercept(s, sx, sy, tx, ty, false, false, true);
  // v112: aircraft ordnance is aimed at the target's body centre, which sits
  // above the ground. A heightfield ray from a high dive angle clips the
  // near slope of any hill the target stands on and detonates the bomb on
  // the hillside dozens of pixels short — so a strafing run that should
  // shred infantry instead scratches dirt. Ground-attack projectiles
  // therefore fly straight to their aim point and detonate there on life
  // expiry; burst() snaps the blast down to the soil under the target.
  if (p.fromAir) return null;
  if (!isCoverBullet(p.ammunition ?? (p.radius ? 'cannon' : 'rifle')))
    return terrainIntercept(s, sx, sy, tx, ty);
  const totalPath = Math.hypot(p.tx - p.startX, p.ty - p.startY) || 1;
  const muzzleClear = totalPath * 0.5;
  const travelled = Math.hypot(sx - p.startX, sy - p.startY);
  const hardHit = smallArmsRayIntercept(s, sx, sy, tx, ty,
    Number.isFinite(travelled) ? Math.max(0, muzzleClear - travelled) : 0);
  const hardDistance = hardHit
    ? Math.hypot(hardHit.x - sx, hardHit.y - sy)
    : Infinity;
  // 枪口前半程不被己方掩体挡弹：士兵躲在废墟后开火时，
  // 贴着枪口的掩体不应吃掉自己的子弹。
  for (const hit of sceneryCoverHits(s, sx, sy, tx, ty)) {
    if (Math.hypot(hit.x - sx, hit.y - sy) >= hardDistance) break;
    if (p.passedCover?.includes(hit.id)) continue;
    if (Math.hypot(hit.x - p.startX, hit.y - p.startY) < muzzleClear) {
      (p.passedCover ??= []).push(hit.id);
      continue;
    }
    (p.passedCover ??= []).push(hit.id);
    // A projectile rolls once per whole prop, independent of frame rate and wall pieces.
    if (rnd(s) < 0.5) return { x: hit.x, y: hit.y };
  }
  return hardHit;
}

/** The first half ignores scenery INCLUDING wrecks, but never the soil.
 * Use the same rule for aim permission and the travelling projectile. */
function smallArmsRayIntercept(
  s: GameState, sx: number, sy: number, tx: number, ty: number,
  clearDistance = Math.hypot(tx - sx, ty - sy) * 0.5,
) {
  const length = Math.hypot(tx - sx, ty - sy);
  if (clearDistance <= 0) return terrainIntercept(s, sx, sy, tx, ty, true);
  const split = Math.min(1, clearDistance / (length || 1));
  const mx = sx + (tx - sx) * split, my = sy + (ty - sy) * split;
  const soil = terrainIntercept(s, sx, sy, mx, my, true, true);
  return soil ?? (split < 1 ? terrainIntercept(s, mx, my, tx, ty, true) : null);
}
/** Aim with the same path the round will fly. A grenade is lobbed, not a
 * mortar: it still collides with scenery on both ascent and descent. */
export function directShotIntercept(
  s: GameState, kind: ReturnType<typeof ammunition>,
  sx: number, sy: number, tx: number, ty: number,
) {
  if (kind === 'grenade')
    return lobIntercept(sx, sy, tx, ty, FLIGHT.grenade.arc,
      (x0, y0, x1, y1) => terrainIntercept(s, x0, y0, x1, y1));
  return isCoverBullet(kind)
    ? smallArmsRayIntercept(s, sx, sy, tx, ty)
    : terrainIntercept(s, sx, sy, tx, ty);
}
function retreatingFriendlyHit(
  s: GameState,
  p: Projectile,
  sx: number,
  sy: number,
  tx: number,
  ty: number,
) {
  if (p.radius || p.missed || p.damage <= 0 || p.sourceUid === undefined)
    return null;
  let nearest: { u: Unit; t: number; x: number; y: number } | null = null;
  for (const u of s.units) {
    if (
      u.uid === p.sourceUid ||
      u.side !== p.side ||
      u.tactic !== 'retreat' ||
      !canTakeDamage(u) ||
      !CARDS[u.id].members
    )
      continue;
    const height =
      u.wounded || u.pose === 'prone'
        ? 14
        : u.pose === 'crouch'
          ? 32
          : u.pose === 'hunker'
            ? 26
            : 56;
    let near = 0,
      far = 1;
    for (const [start, delta, min, max] of [
      [sx, tx - sx, u.x - 5, u.x + 5],
      [sy, ty - sy, u.y - height, u.y - 3],
    ]) {
      if (Math.abs(delta) < 1e-8) {
        if (start < min || start > max) {
          near = 2;
          break;
        }
      } else {
        const a = (min - start) / delta,
          b = (max - start) / delta;
        near = Math.max(near, Math.min(a, b));
        far = Math.min(far, Math.max(a, b));
      }
    }
    if (
      near <= far &&
      near >= 0 &&
      near <= 1 &&
      depthHit(p, u, sx + (tx - sx) * near) &&
      (!nearest || near < nearest.t)
    )
      nearest = {
        u,
        t: near,
        x: sx + (tx - sx) * near,
        y: sy + (ty - sy) * near,
      };
  }
  return nearest;
}
type MuzzleBody = Pick<
  Unit,
  'id' | 'x' | 'y' | 'pose' | 'moving' | 'hullAngle'
> & Partial<InfantryWeaponBody>;
type FiringBody = MuzzleBody & Pick<Unit, 'side' | 'member'>;
export function muzzleOffset(u: MuzzleBody) {
  if (CARDS[u.id].members && modelOf(u.id) !== 'mortar')
    return infantryWeaponMuzzle(u)?.x ?? infantryGeometry(u).muzzleX;
  const tank = tankGeometry(u.id);
  if (tank) return tank.muzzleX;
  if (CARDS[u.id].emplacement)
    return CARDS[u.id].emplacement === 'aa_gun' ? 45 : 90;
  if (CARDS[u.id].airframe)
    return CARDS[u.id].airframe === 'rocket_heli'
      ? 72
      : CARDS[u.id].airframe === 'interceptor'
        ? 75
        : 20;
  return modelOf(u.id) === 'tank'
    ? 88
    : modelOf(u.id) === 'ifv'
      ? 65
      : CARDS[u.id].air
        ? 90
        : modelOf(u.id) === 'mortar'
          ? 12
          : 18;
}
export function muzzleHeight(u: MuzzleBody) {
  if (CARDS[u.id].members && modelOf(u.id) !== 'mortar')
    return infantryWeaponMuzzle(u)?.height ?? infantryGeometry(u).muzzleHeight;
  const tank = tankGeometry(u.id);
  if (tank) return tank.muzzleY;
  if (CARDS[u.id].emplacement)
    return CARDS[u.id].emplacement === 'aa_gun'
      ? 92
      : CARDS[u.id].emplacement === 'at_gun'
        ? 30
        : 60;
  return CARDS[u.id].air
    ? 16
    : modelOf(u.id) === 'mortar'
      ? 30
      : modelOf(u.id) === 'tank'
        ? 54
        : modelOf(u.id) === 'ifv'
          ? 42
          : u.pose === 'prone'
            ? 9
            : u.pose === 'crouch' || u.pose === 'land'
              ? 28
              : u.pose === 'hunker'
                ? 24
                : 47;
}
export function muzzlePoint(
  u: MuzzleBody,
  tx: number,
  height = muzzleHeight(u),
  coax = false,
) {
  const tank = tankGeometry(u.id);
  const dx =
      Math.sign(tx - u.x) * (coax ? (tank?.coaxX ?? 58) : muzzleOffset(u)),
    dy = -(coax ? (tank?.coaxY ?? height) : height);
  const angle = CARDS[u.id].armored || CARDS[u.id].vehicle ? u.hullAngle : 0,
    c = Math.cos(angle),
    sn = Math.sin(angle);
  return { x: u.x + dx * c - dy * sn, y: u.y + dx * sn + dy * c };
}
function bodyHeight(
  u: Pick<Unit, 'pose'> & Partial<Pick<Unit, 'id' | 'moving'>>,
) {
  if(u.id==='glider_transport')return 26;
  if (u.id && CARDS[u.id].members) return infantryGeometry(u).bodyHeight;
  if (u.id && (CARDS[u.id].armored || CARDS[u.id].vehicle))
    return armorHeight(u.id) * 0.55;
  return u.pose === 'prone'
    ? 7
    : u.pose === 'crouch' || u.pose === 'land'
      ? 18
      : u.pose === 'hunker'
        ? 15
        : 27;
}
export function unitRange(s: GameState, u: Unit) {
  return (
    (pairedPrecisionRange(s, u) ? 930 : weaponCard(u).range!) *
    (CARDS[u.id].infantryAbility === 'mountain_fire' &&
    !u.moving &&
    u.motion === 'ground' &&
    (u.stillFor ?? 0) >= 0.65 &&
    craterCover(s, u.x, u.lastThreat?.x ?? u.x + u.facing * 400) > 0.2
      ? 1.25
      : 1) *
    (s.players[u.side].recon > 0 ? 1.2 : droneRecon(s, u.side, u.x) ? 1.1 : 1)
  );
}
export function droneRecon(s: GameState, side: Side, x: number) {
  return (
    s.players[side].jam <= 0 &&
    observerUnits(s, side).some(
      (u) =>
        u.side === side &&
        CARDS[u.id].observer &&
        isCombatant(u) &&
        Math.abs(u.x - x) <= 650,
    )
  );
}
export function smokeBlocks(s: GameState, side: Side, sx: number, tx: number) {
  if (
    s.players[side].recon > 0 ||
    droneRecon(s, side, sx) ||
    Math.abs(tx - sx) <= 140
  )
    return false;
  const left = Math.min(sx, tx),
    right = Math.max(sx, tx);
  return s.smokes.some(
    (f) => f.life > 0 && f.x + 95 > left && f.x - 95 < right,
  );
}
/**
 * Forward observer: a live friendly scout (or observer drone) within 760px of
 * an impact point that has line of sight to it. Lets indirect-fire units shoot
 * faster and tighter when a spotter is watching the fall of shot. Smoke blocks
 * spotting just like it blocks sight.
 */
function scoutSpotter(
  s: GameState,
  side: Side,
  tx: number,
  ty: number,
): boolean {
  for (const v of s.units) {
    if (v.side !== side || v.hp <= 0 || v.wounded || v.surrendered) continue;
    const vc = CARDS[v.id];
    if (vc.trait !== 'scout' && !vc.observer && !precisionObserverReady(v)) continue;
    if (Math.abs(v.x - tx) > 760) continue;
    const eye = v.y - (vc.air ? 20 : v.pose === 'prone' ? 12 : 48);
    // v120: a sensor-blinded spotter sees less than half as far, so its
    // spotting contribution degrades exactly like its direct vision.
    const blind = (s.players[side].sensorBlindUntil ?? 0) > s.time ? 0.45 : 1;
    if (Math.hypot(tx - v.x, (ty - eye) * 0.65) > sightRange(v) * 1.1 * blind)
      continue;
    if (clearSight(s, v.x, eye, tx, ty)) return true;
  }
  return false;
}
/**
 * Recon + marksman: a live friendly scout (or observer drone) within 700px of
 * an enemy that has line of sight to it "designates" that target for friendly
 * marksmen, who gain +25% damage on designated targets.
 */
function scoutDesignates(
  s: GameState,
  side: Side,
  target: Unit,
): boolean {
  for (const v of s.units) {
    if (v.side !== side || v.hp <= 0 || v.wounded || v.surrendered) continue;
    const vc = CARDS[v.id];
    if (vc.trait !== 'scout' && !vc.observer && !precisionObserverReady(v)) continue;
    if (Math.abs(v.x - target.x) > 700) continue;
    const eye = v.y - (vc.air ? 20 : v.pose === 'prone' ? 12 : 48);
    // v120: sensor blind degrades target designation the same way it degrades
    // direct sight — a blinded scout cannot mark targets for the marksmen.
    const blind = (s.players[side].sensorBlindUntil ?? 0) > s.time ? 0.45 : 1;
    if (
      Math.hypot(target.x - v.x, (target.y - eye) * 0.65) >
      sightRange(v) * 1.1 * blind
    )
      continue;
    if (clearSight(s, v.x, eye, target.x, target.y - bodyHeight(target)))
      return true;
  }
  return false;
}
/**
 * AA umbrella: a live friendly anti-air unit within 420px of a ground position
 * keeps nearby infantry steadier — suppression buildup is reduced while the
 * sky is watched over them.
 */
function aaUmbrella(s: GameState, side: Side, x: number): boolean {
  for (const v of s.units) {
    if (v.side !== side || v.hp <= 0 || v.wounded || v.surrendered) continue;
    if (!weaponCard(v).antiAir) continue;
    if (CARDS[v.id].air) continue;
    if (Math.abs(v.x - x) <= 420) return true;
  }
  return false;
}
/** A forecast is a fresh settled body, never the current lowering clock. */
function standingBody(u: MuzzleBody): MuzzleBody {
  return {id:u.id,member:u.member,x:u.x,y:u.y,hullAngle:u.hullAngle,pose:'idle',moving:false};
}
function standingMuzzleHeight(u: MuzzleBody) {
  return muzzleHeight(standingBody(u));
}
function firingHeight(
  s: GameState,
  u: FiringBody,
  tx: number,
  ty: number,
  planStanding = false,
): number | null {
  const c = CARDS[u.id],
    height = muzzleHeight(u);
  if (c.indirect) return height;
  if (smokeBlocks(s, u.side, u.x, tx)) return null;
  const softCover = isCoverBullet(ammunition(u.id, u.member));
  const clear = (shooter: MuzzleBody, h: number) => {
    const point = muzzlePoint(shooter, tx, h);
    // A long prone barrel cannot start a projectile through solid soil.
    // Small arms may clear nearby scenery; heavy ordnance still checks it.
    if (
      c.members &&
      terrainIntercept(s, shooter.x, shooter.y - h, point.x, point.y, softCover, softCover)
    )
      return false;
    return (
      u.id === 'javelin' ||
      !directShotIntercept(s, ammunition(u.id, u.member), point.x, point.y, tx, ty)
    );
  };
  if (clear(u, height)) return height;
  // Only the stance planner may test a hypothetical standing shot. Target
  // selection must use the actual body: accepting a shot that needs a locked
  // stance made the soldier neither shoot nor look for a firing position.
  if (planStanding && c.members) {
    const standing=standingBody(u),standingHeight=muzzleHeight(standing);
    if(clear(standing,standingHeight))return standingHeight;
  }
  return null;
}

type CoverTarget = Pick<Unit, 'x' | 'y'> &
  Partial<Pick<Unit, 'pose' | 'id' | 'moving'>>;
function canFireFromCover(
  s: GameState,
  u: Unit,
  x: number,
  target: CoverTarget,
) {
  return (
    firingHeight(
      s,
      {
        id: u.id,
        side: u.side,
        member: u.member,
        x,
        y: ground(s, x),
        hullAngle: u.hullAngle,
        pose: u.pose,
        moving: false,
      },
      target.x,
      target.y -
        bodyHeight({
          id: target.id,
          moving: target.moving,
          pose: target.pose ?? 'prone',
        }),
    ) !== null
  );
}
function seekCover(s: GameState, u: Unit, target: CoverTarget) {
  let best: number | null = null,
    score = 0;
  // Every rifleman can use nearby shelter; designated cover/scout roles search farther.
  const reach =
    CARDS[u.id].trait === 'scout' ? 120 : u.tactic === 'cover' ? 58 : 32;
  for (
    let x = Math.max(125, u.x - reach);
    x <= Math.min(W - 125, u.x + reach);
    x += 4
  ) {
    if (Math.abs(target.x - x) > unitRange(s, u)) continue;
    const cover = craterCover(s, x, target.x);
    if (
      cover < 0.25 ||
      obstacleBoxes(s).some(
        (b) =>
          !b.foliage &&
          x > b.x - (b.rubble ? 2 : 10) &&
          x < b.x + b.w + (b.rubble ? 2 : 10),
      )
    )
      continue;
    if (!canFireFromCover(s, u, x, target)) continue;
    if (crowdedInfantry(s, u, x) >= 3) continue;
    if (
      s.units.some(
        (v) =>
          v !== u &&
          v.side === u.side &&
          isCombatant(v) &&
          CARDS[v.id].members &&
          Math.abs(v.lane - u.lane) < 5 &&
          [
            v.x,
            v.coverGoal,
            v.firingGoal,
            v.dispersionGoal,
            (v.withdrawUntil ?? 0) > s.time ? v.withdrawGoal : null,
          ].some((reserved) => reserved != null && Math.abs(reserved - x) < 26),
      )
    )
      continue;
    const value = cover * 50 - Math.abs(x - u.x) * 0.4;
    if (value > score) {
      score = value;
      best = x;
    }
  }
  return best;
}
// --- v46: combat AI — medic triage, patient claiming, peek rhythm ---

/**
 * Triage score for a medic choosing who to treat. Higher = treat first.
 * Returns -Infinity for patients who cannot be saved in time (bleedout
 * already too far gone), so the medic skips them and spends the heal on
 * someone who will survive it.
 */
export function medicTriageScore(medic: Unit, patient: Unit): number {
  if (patient.wounded && patient.bleedOut <= 2.5) return -Infinity;
  let score: number;
  if (patient.wounded) {
    score = 100 + Math.max(0, 18 - patient.bleedOut) * 2.2;
    if (patient.hp > patient.maxHp * 0.55) score -= 25;
  } else {
    score = (1 - patient.hp / patient.maxHp) * 12;
  }
  score -= Math.abs(patient.x - medic.x) * 0.12;
  return score;
}

/**
 * True when another unhurt medic of the same side is already tending this
 * patient (within 70px). Requires the other medic to have *committed*
 * (tending === true) so two medics arriving on the same tick do not
 * deadlock by both assuming the other will take the patient.
 */
export function anotherMedicOnPatient(
  s: GameState,
  medic: Unit,
  patient: Unit,
): boolean {
  return s.units.some(
    (v) =>
      v !== medic &&
      v.side === medic.side &&
      CARDS[v.id].heal &&
      v.hp > 0 &&
      !v.wounded &&
      v.tending === true &&
      Math.abs(v.x - patient.x) < 70,
  );
}

/**
 * Pick the best patient for a medic this tick, or undefined when nobody is
 * worth treating. Radius follows the watch-order rule (64px for downed
 * wounded under watch, 140px otherwise) and is evaluated per candidate.
 */
export function pickMedicPatient(
  s: GameState,
  medic: Unit,
): Unit | undefined {
  let best: Unit | undefined;
  let bestScore = -Infinity;
  for (const v of s.units) {
    if (
      v.side !== medic.side ||
      !canTakeDamage(v) ||
      (!v.wounded && v.hp >= v.maxHp) ||
      !CARDS[v.id].members
    )
      continue;
    const card = CARDS[medic.id];
    const radius = v.wounded && (medic.squadOrder === 'watch' || card.static)
      ? 64 : (card.healRange ?? 140);
    if (Math.abs(v.x - medic.x) > radius) continue;
    if (v.wounded && anotherMedicOnPatient(s, medic, v)) continue;
    const score = medicTriageScore(medic, v);
    if (score > bestScore) {
      bestScore = score;
      best = v;
    }
  }
  return best;
}

/**
 * Decide whether an infantryman behind cover should expose (stand) to fire
 * this tick. Enforces a peek rhythm: up for a short window, drop back to
 * reload, hesitate longer while suppressed. Mutates u.exposedUntil when a
 * new peek starts.
 */
export function peekShouldExpose(s: GameState, u: Unit): boolean {
  if ((u.exposedUntil ?? 0) > s.time) return true;
  // v127: after a peek ends the soldier stays down for a full reload/breath
  // cycle instead of bobbing up again on the next tick. The old rhythm
  // (~0.55s up, immediately back up) read as nervous hopping, not fire and
  // movement. Suppression stretches the rest.
  if (s.time < (u.peekRestUntil ?? 0)) return false;
  if (u.cooldown > 0.05) return false;
  if (u.suppression > 45) {
    const hesitation = 0.3 + u.suppression * 0.004;
    if (s.time - (u.lastCombatShotAt ?? -Infinity) < hesitation) return false;
  }
  // v127: longer windows so the peek carries a real burst (3-5 shots) instead
  // of one panicked round, and the up/down cycle reads as deliberate.
  let peek =
    1.5 + (u.uid % 3) * 0.15 - Math.min(0.3, u.suppression * 0.004);
  peek = Math.max(1.1, peek);
  u.exposedUntil = s.time + peek;
  const rest = 1.6 + Math.min(1.2, u.suppression * 0.012);
  u.peekRestUntil = s.time + peek + rest;
  return true;
}

/**
 * v127/v128: rate-limit stance-class changes. Soldiers used to flip between
 * stand/crouch/prone every time the tactic or order context twitched, which
 * read as nervous hopping on the field. A cross-class change is accepted at
 * most once per STANCE_COOLDOWN_S.
 *
 * v128: the lock is evaluated against the *current* u.pose, not a separate
 * lockedStance field. Functional override blocks (cover peek, observation
 * hold, flinch, air contact, reload) run after this block and write u.pose
 * directly; while a cross-class change is locked this function returns the
 * current pose, so the main path yields to those overrides instead of
 * re-asserting a stale stance every frame (that fight was the prone/up
 * twitch). Within-class changes (idle<->walk<->run, crouch<->hunker) are
 * always free, and motion poses (jump/land/climb) bypass the lock.
 */
const STANCE_COOLDOWN_S = 10;
function stanceClass(
  pose: string,
): 'stand' | 'crouch' | 'prone' | 'motion' {
  if (pose === 'prone') return 'prone';
  if (pose === 'crouch' || pose === 'hunker') return 'crouch';
  if (pose === 'jump' || pose === 'land' || pose === 'climb') return 'motion';
  return 'stand';
}
function applyStanceCooldown(
  u: Unit,
  time: number,
  desired: string,
): string {
  const curClass = stanceClass(u.pose);
  if (curClass === 'motion') return desired;
  if (curClass === stanceClass(desired)) return desired;
  if (u.stanceLockUntil !== undefined && time < u.stanceLockUntil)
    return u.pose;
  u.stanceLockUntil = time + STANCE_COOLDOWN_S;
  return desired;
}

/**
 * v129: the single gateway for cross-class stance writes. applyStanceCooldown
 * only computed the gated pose; every other block in the engine still wrote
 * u.pose directly, so flinch / bailout / peek / reload / movement logic kept
 * snapping soldiers between stand and prone every frame — the "twitch" the
 * player saw. setStance routes ALL of those through the same 10s lock.
 *
 * - motion poses (jump/land/climb) pass straight through, they're transient.
 * - within-class changes (idle<->walk<->run, crouch<->hunker) are always free.
 * - cross-class changes (stand<->crouch<->prone) are rate-limited to once per
 *   STANCE_COOLDOWN_S; while locked the current pose is held.
 * - Legacy force hints no longer bypass healthy posture commitment. Real
 *   casualties retain their separate wounded/death animation path.
 */
function setStance(
  u: Unit,
  time: number,
  desired: Unit['pose'],
  options?: { force?: boolean; travel?: boolean },
): Unit['pose'] {
  // Already in the requested pose: never re-arm the lock on a re-asserted
  // state. Continuous override blocks (observer hold, medic treatment,
  // digging) run every frame; without this early return each frame would
  // push stanceLockUntil another 10s into the future and pin the soldier
  // long after the override ended.
  if (u.pose === desired) return desired;
  const curClass = stanceClass(u.pose);
  if (curClass === 'motion' || curClass === stanceClass(desired)) {
    u.pose = desired;
    return desired;
  }
  // A grounded bank step keeps its existing gait. Queue a newly requested
  // height until support is restored; never run a hidden drill underneath it.
  if (u.motion === 'bank') return u.pose;
  // Finish a magazine drill before starting another whole-body action.
  if (!u.wounded && magazineReloadActive(u, time)) return u.pose;
  if (
    !u.wounded &&
    u.stanceLockUntil !== undefined &&
    time < u.stanceLockUntil
  )
    return u.pose;
  const fromTravel = curClass === 'prone' ? proneTravelAmount(u) : crouchTravelAmount(u);
  u.pose = desired;
  u.stanceLockUntil = time + STANCE_COOLDOWN_S;
  const nextClass = stanceClass(desired);
  if (nextClass !== 'motion') {
    u.poseAnimFrom = curClass;
    u.poseAnimSeen = nextClass;
    u.poseAnimFromTravel = curClass === 'crouch' || curClass === 'prone' ? fromTravel : 0;
    u.poseAnimToTravel = options?.travel && (nextClass === 'crouch' ||
      (nextClass === 'prone' && proneTravelApplies(u))) ? 1 : 0;
    u.poseAnimAt = time;
    u.poseAnimProgress = 0;
  }
  return desired;
}

/** A throw owns the hands and movement until the follow-through is complete.
 * The target is committed at wind-up, not magically tracked after release. */
function stepHandGrenade(s: GameState, u: Unit): boolean {
  if ((u.fragThrow ?? 0) <= 0 || u.fragThrowStartedAt === undefined) return false;
  const elapsed = grenadeElapsed(u, s.time);
  u.fragThrow = Math.max(0, GRENADE_THROW_S - elapsed);
  u.moving = false;
  u.fire = u.secondaryFire = 0;
  u.vx = u.vy = 0;
  u.y = ground(s, u.x);
  if (grenadeReleased(elapsed) && u.fragAim) {
    const aim = u.fragAim;
    u.fragAim = undefined;
    if ((u.fragLeft ?? 0) > 0) {
      u.fragLeft = (u.fragLeft ?? 0) - 1;
      const dir = Math.sign(aim.x - u.x) || u.facing;
      const {x: sx, y: sy} = grenadeReleaseOrigin(u, dir);
      const total = Math.max(0.65, Math.min(1.15, Math.hypot(aim.x - sx, aim.y - sy) / 210));
      s.projectiles.push({ uid: ++s.uid, ammunition: 'grenade', effect: 'grenade',
        damage: 42, radius: 40, arc: 70, life: total, total,
        targetUid: null, base: null, side: u.side, sourceUid: u.uid, startLane: u.lane,
        x: sx, y: sy, tx: aim.x, ty: aim.y, startX: sx, startY: sy });
    }
  }
  if (u.fragThrow === 0) u.fragThrowStartedAt = undefined;
  return true;
}

export function coveringMate(
  s: GameState,
  u: Unit,
  target: Unit,
  requireShot = false,
) {
  const airThreat = !!CARDS[target.id].air;
  const check = (v: Unit): boolean => {
    const c = weaponCard(v);
    if (
      v === u ||
      v.side !== u.side ||
      !isCombatant(v) ||
      (airThreat && !c.antiAir) ||
      (CARDS[target.id].armored &&
        !c.penetration &&
        (c.armorMultiplier ?? 1) <= 1.2) ||
      (v.squad !== u.squad && !(airThreat && Math.abs(v.x - u.x) <= 260))
    )
      return false;
    if (
      (!c.members && !airThreat) ||
      c.indirect ||
      v.moving ||
      stanceTransitionActive(v,s.time) || crouchMotionActive(v) || proneMotionActive(v) ||
      v.motion !== 'ground' ||
      v.climbing > 0 ||
      v.tactic === 'retreat' ||
      (v.coverGoal !== null && Math.abs(v.coverGoal - v.x) > 0.5) ||
      (v.firingGoal != null && Math.abs(v.firingGoal - v.x) > 0.5) ||
      v.evadeUntil > s.time
    )
      return false;
    const distance = Math.abs(v.x - target.x);
    return (
      distance <= unitRange(s, v) &&
      distance >= (c.minRange ?? 0) &&
      visibleToSide(s, v.side, target) &&
      firingHeight(s, v, target.x, target.y - bodyHeight(target)) !== null &&
      ((!requireShot && v.cooldown <= 0) ||
        s.time - (v.lastCombatShotAt ?? -Infinity) <=
          Math.max(0.8, c.rate! * 1.35))
    );
  };
  // Same-squad mates are the common case; the squad index makes that O(squad).
  for (const v of squadMates(s, u.side, u.squad)) {
    if (check(v)) return true;
  }
  // Anti-air cover is the only case where a non-squadmate counts, and only
  // within 260px — the spatial index keeps that scan local too.
  if (airThreat) {
    for (const v of nearUnits(s, u.x, 260, coverNearScratch)) {
      if (v.side === u.side && v.squad !== u.squad && check(v)) return true;
    }
  }
  return false;
}

function nearbyFiringPosition(s: GameState, u: Unit, target: CoverTarget) {
  const range = unitRange(s, u),
    currentDistance = Math.abs(target.x - u.x);
  // Reposition around this contact; never turn an obstructed ray into an unlimited charge.
  const insideCover = obstacleBoxes(s).some(
    (b) => !b.foliage && u.x > b.x - 16 && u.x < b.x + b.w + 16,
  );
  const minimumDistance = Math.min(
    range * (insideCover ? 0.38 : 0.62),
    currentDistance,
  );
  let best: number | null = null,
    bestScore = -Infinity;
  const edges = obstacleBoxes(s)
    .flatMap((box) => [box.x - 12 - u.x, box.x + box.w + 12 - u.x])
    .filter((offset) => Math.abs(offset) > 64 && Math.abs(offset) <= 320);
  for (const offset of [-64, -48, -32, -16, -8, 8, 16, 32, 48, 64, ...edges]) {
    const x = u.x + offset,
      distance = Math.abs(target.x - x);
    if (
      x < 125 ||
      x > W - 125 ||
      distance < minimumDistance ||
      distance > range
    )
      continue;
    if (
      obstacleBoxes(s).some(
        (b) => !b.foliage && x > b.x - 10 && x < b.x + b.w + 10,
      )
    )
      continue;
    if (
      s.units.some(
        (v) =>
          v !== u &&
          v.side === u.side &&
          isCombatant(v) &&
          CARDS[v.id].members &&
          Math.abs(v.lane - u.lane) < 5 &&
          [v.x, v.coverGoal, v.firingGoal].some(
            (reserved) => reserved != null && Math.abs(reserved - x) < 26,
          ),
      )
    )
      continue;
    if (!canFireFromCover(s, u, x, target)) continue;
    const score = craterCover(s, x, target.x) * 20 - Math.abs(offset);
    if (score > bestScore) {
      bestScore = score;
      best = x;
    }
  }
  return best;
}

function enemyCoverShot(s: GameState, u: Unit, target: Unit | undefined) {
  const c = weaponCard(u);
  if (
    !target ||
    !c.members ||
    c.indirect ||
    !c.radius ||
    ammunition(u.id, u.member) !== 'rocket' ||
    u.id === 'javelin' ||
    CARDS[target.id].air ||
    !visibleToSide(s, u.side, target) ||
    smokeBlocks(s, u.side, u.x, target.x)
  )
    return null;
  const point = muzzlePoint(u, target.x),
    ty = target.y - bodyHeight(target);
  if (terrainIntercept(s, u.x, u.y - muzzleHeight(u), point.x, point.y)) return null;
  const hit = sceneryIntercept(s, point.x, point.y, target.x, ty);
  if (!hit?.box.prop || hit.box.rubble) return null;
  const first = terrainIntercept(s, point.x, point.y, target.x, ty);
  if (!first || Math.hypot(first.x - hit.x, first.y - hit.y) > 3) return null;
  const distance = Math.abs(target.x - u.x),
    toEnemy = Math.abs(target.x - hit.x);
  // Only attack an enemy-side obstruction. Do not shell the squad's own nearby shelter.
  if (
    toEnemy > Math.min(230, distance * 0.65) ||
    Math.abs(hit.x - u.x) < Math.max(120, c.radius * 2.5)
  )
    return null;
  if (
    s.units.some(
      (v) =>
        v.side === u.side &&
        canTakeDamage(v) &&
        Math.hypot(v.x - hit.x, v.y - 20 - hit.y) < c.radius! + 45,
    )
  )
    return null;
  if (u.breachPropId === hit.box.prop.id && (u.breachShots ?? 0) >= 2)
    return null;
  return { x: hit.x, y: hit.y, propId: hit.box.prop.id };
}

function beginDrop(u: Unit, dir: number, speed: number, falling = false) {
  u.motion = 'jump';
  u.motionTime = 0;
  u.motionDuration = 0.6;
  u.vx = dir * Math.min(45, speed);
  u.vy = falling ? 0 : -18;
  u.motionFromY = u.y;
  u.pose = 'jump';
  u.cover = 0;
}
function traverse(s: GameState, u: Unit, dt: number) {
  if (u.motion === 'ground') return false;
  u.motionTime += dt;
  u.moving = true;
  u.cover = 0;
  if (u.motion === 'jump') {
    u.pose = 'jump';
    u.x = Math.max(55, Math.min(W - 55, u.x + u.vx * dt));
    u.vy += 430 * dt;
    u.y += u.vy * dt;
    if (u.vy > 0 && u.y >= ground(s, u.x)) {
      u.y = ground(s, u.x);
      u.motion = 'land';
      u.motionTime = 0;
      u.motionDuration = 0.22;
      u.pose = 'land';
      u.vy = 0;
      u.stepCooldown = 0.6;
    }
  } else if (u.motion === 'land') {
    u.pose = 'land';
    u.y = ground(s, u.x);
    if (u.motionTime >= u.motionDuration) u.motion = 'ground';
  } else {
    // A bank follows the ground in the committed gait, not a forced crouch
    // or rope climb. Keep real footwork and recheck newly observed contacts.
    const t = Math.min(1, u.motionTime / u.motionDuration),
      ease = t * t * (3 - 2 * t);
    const previousX = u.x;
    const proposed = u.motionFromX + (u.motionToX - u.motionFromX) * ease;
    u.x = contactSafeX(s,u,proposed);
    const blocked = Math.abs(u.x-proposed) > 1e-6;
    const distance = Math.abs(u.x-previousX);
    // v175: divisor 8 (was 6) so the passing cels stay on screen long enough
    // to read; clamp 0.95 so a lag spike or stacked speed buffs can never skip
    // a cel and teleport the rear leg to the front.
    u.walk += Math.min(distance / (u.pose === 'prone' ? 4 : 8), 0.95);
    u.moving = distance > 1e-6;
    u.y = ground(s, u.x);
    if (t >= 1 || blocked) {
      u.motion = 'ground';
      u.stepCooldown = 0.6;
      u.motionLift = 0;
    }
  }
  return true;
}
/** Squad orders remain local; an attack still allows sensible use of cover. */
function infantryOrder(s: GameState, u: Unit): Order {
  if (u.squadOrder && (u.squadOrderUntil ?? Infinity) > s.time) {
    if (u.squadOrder === 'hold' || u.squadOrder === 'watch') return 'hold';
    return 'advance';
  }
  return s.players[u.side].order;
}
function orderedWithdrawal(s: GameState, u: Unit) {
  return (
    u.squadOrder === 'retreat' &&
    (u.squadOrderUntil ?? Infinity) > s.time &&
    u.squadOrderX !== undefined
  );
}

/** Ground units cannot pass an uncleared enemy contact, even on a rush order.
 * Repositioning to the rear is always allowed. Air sorties are independent. */
export function contactSafeX(s: GameState, u: Unit, proposedX: number) {
  const dir = u.side === 0 ? 1 : -1;
  if (CARDS[u.id].air || (proposedX - u.x) * dir <= 0) return proposedX;
  // v172: a stalemated unit (ineffective close-range fire against a dug-in
  // target) closes the distance to gain a flatter trajectory that clears the
  // terrain lip intercepting its shots. The reduced gap persists briefly so
  // the unit is not pushed back when it stops to try firing from the new angle.
  const stalemateClose = (u.stalemateCloseUntil ?? 0) > s.time;
  const gap = stalemateClose
    ? STALEMATE_CLOSE_GAP
    : CARDS[u.id].members
      ? 105
      : 150;
  let limit = proposedX;
  for (const enemy of s.units) {
    if (enemy.side === u.side || !isCombatant(enemy) || CARDS[enemy.id].air ||
        enemy.rappelling || enemy.parachuting || (enemy.x - u.x) * dir < 0 ||
        (enemy.x - u.x) * dir > Math.abs(proposedX - u.x) + gap ||
        !visibleToSide(s, u.side, enemy)) continue;
    const stop = enemy.x - dir * gap;
    if ((stop - limit) * dir < 0) limit = stop;
  }
  // Only last OBSERVED coordinates may constrain travel through lost contact.
  // Never read a hidden unit's current position, health or continued existence.
  // A snapshot older than CONTACT_STALE_S is too stale to be a hard barrier:
  // the unit probes forward and either reacquires the threat or clears ground.
  for (const contact of s.groundContacts?.[u.side] ?? []) {
    if (contactIsStale(s.time, contact) || visibleToSide(s, u.side, contact) || (contact.x-u.x)*dir < 0 ||
        (contact.x-u.x)*dir > Math.abs(proposedX-u.x)+gap) continue;
    const stop = contact.x-dir*gap;
    if ((stop-limit)*dir < 0) limit = stop;
  }
  // v173: don't overrun the enemy base — stop 35px short so the structure
  // stays in range and wrecks near the base footprint don't trap the unit.
  const enemyBaseX = u.side === 0 ? W - 70 : 70;
  const baseStop = enemyBaseX - dir * 35;
  if ((baseStop - limit) * dir < 0) limit = baseStop;
  return (limit - u.x) * dir < 0 ? u.x : limit;
}
function moveSoldier(
  s: GameState,
  u: Unit,
  dir: number,
  speed: number,
  dt: number,
  mayTraverse = true,
) {
  if (!dir || speed <= 0 || localUnitOrder(s, u) === 'watch' ||
      (u.motion === 'ground' && stanceTransitionActive(u, s.time))) return;
  const safeStep = contactSafeX(s, u, u.x + dir * speed * dt);
  speed = Math.abs(safeStep - u.x) / Math.max(dt, 0.001);
  if (speed <= 0) return;
  if (!requestCrouchStep(u,s.time) || !requestProneStep(u,s.time)) return;
  u.facing = dir;
  const y = ground(s, u.x),
    ahead = ground(s, u.x + dir * 24);
  const depth = y - s.original[Math.floor(u.x)];
  const aheadDepth =
    ahead -
    s.original[Math.max(0, Math.min(W - 1, Math.floor(u.x + dir * 24)))];
  const preparedRamp = preparedTrenchRamp(s, u.x, u.x + dir * 24);
  if (
    !preparedRamp &&
    u.stepCooldown <= 0 &&
    aheadDepth >= DROP_HEIGHT &&
    ahead - y >= DROP_HEIGHT &&
    // A distant ledge is not yet a fall. Reach the supported edge first;
    // otherwise a slow crawl repeatedly hops and lands on the same flat lip.
    ground(s, u.x + dir * 2) - y > 3 &&
    depth < 3
  ) {
    if (mayTraverse) beginDrop(u, dir, speed);
    return;
  }
  if (
    !preparedRamp &&
    u.stepCooldown <= 0 &&
    depth >= CLIMB_HEIGHT &&
    y - ahead >= CLIMB_HEIGHT &&
    // v129: only bank up a real ledge, not a continuing hillside. Sample the
    // ground further out — a crater lip levels off near the original grade,
    // while a slope keeps climbing past the 24px probe and would otherwise
    // make flat-ground soldiers strike a climb pose on gentle terrain.
    (() => {
      const g36 = ground(s, u.x + dir * 36);
      return Math.abs(g36 - ahead) < 6;
    })()
  ) {
    if (!mayTraverse) return;
    let destination = u.x + dir * 12;
    for (let d = 12; d <= 52; d += 2) {
      destination = Math.max(125, Math.min(W - 125, u.x + dir * d));
      if (ground(s, destination) - s.original[Math.floor(destination)] < 3)
        break;
    }
    const goal = u.coverGoal ?? u.firingGoal;
    if (
      goal != null &&
      (goal - u.x) * dir > 0 &&
      (destination - goal) * dir > 0
    )
      destination = goal;
    u.motion = 'bank';
    u.motionTime = 0;
    u.motionDuration = CARDS[u.id].trait === 'mountain' ? 0.5 : 0.8;
    u.motionFromX = u.x;
    u.motionFromY = u.y;
    u.motionToX = destination;
    u.motionToY = ground(s, destination);
    u.motionLift = 0;
    return;
  }
  const wall = s.walls.find(
    (w) =>
      w.hp > 0 &&
      (w.x - u.x) * dir >= w.width / 2 + 5 &&
      Math.abs(w.x - u.x) < w.width / 2 + 14,
  );
  if (wall) {
    if (!mayTraverse) return;
    if (CARDS[u.id].trait === 'engineer') {
      u.pose = setStance(u, s.time, 'crouch');
      if (u.supportCooldown <= 0) {
        const wallHpBefore = wall.hp;
        const breachDamage =
          CARDS[u.id].infantryAbility === 'demolition' ? 70 * 3 : 70;
        wall.hp = Math.max(0, wall.hp - breachDamage);
        u.supportCooldown = 1.2;
        burst(s, wall.x, ground(s, wall.x) - 8, 10);
        // Breach! Nearby assault troops surge through the gap.
        if (wallHpBefore > 0 && wall.hp === 0) {
          for (const mate of s.units) {
            if (
              mate.side === u.side &&
              mate.hp > 0 &&
              CARDS[mate.id].trait === 'close_assault' &&
              Math.abs(mate.x - wall.x) <= 200
            ) {
              mate.assaultBurstUntil = s.time + 5;
              mate.assaultSurgeUntil = s.time + 4;
            }
          }
          // The blast showers defenders behind the wall with dust and
          // rubble — they flinch and lose their footing for a beat while
          // the assault pours through the gap.
          for (const foe of s.units) {
            if (
              foe.side !== u.side &&
              CARDS[foe.id].members &&
              !foe.wounded &&
              canTakeDamage(foe) &&
              Math.abs(foe.x - wall.x) <= 130
            ) {
              foe.suppression = Math.min(100, foe.suppression + 26);
              foe.flinchUntil = s.time + 0.5;
              foe.decisionIn = Math.max(foe.decisionIn, 0.4);
              foe.lastThreat = {
                x: wall.x,
                y: ground(s, wall.x),
                until: s.time + 2,
              };
            }
          }
        }
      }
      return;
    }
    u.climbDuration = CARDS[u.id].trait === 'mountain' ? 0.65 : 1.2;
    u.climbing = u.climbDuration;
    u.climbFrom = u.x;
    u.motionToX = wall.x + dir * (wall.width / 2 + 10);
    u.climbWall = wall.uid;
    u.pose = 'climb';
    return;
  }
  // Only same-side infantry within 72px affect traffic flow; the spatial
  // index shrinks the scan to a few cells. The closures below capture this
  // array but are all invoked synchronously before moveSoldier returns.
  nearUnits(s, u.x, 72, neighborNearScratch);
  neighborOutScratch.length = 0;
  for (const v of neighborNearScratch) {
    if (
      v !== u &&
      v.side === u.side &&
      isCombatant(v) &&
      CARDS[v.id].members &&
      Math.abs(v.x - u.x) < 72
    )
      neighborOutScratch.push(v);
  }
  const neighbors = neighborOutScratch;
  // Single linear scan with no allocation (v100: was filter+sort per call,
  // and the closure was invoked twice per soldier with identical inputs).
  const nearestBlocker = () => {
    let best: Unit | undefined;
    let bestDist = Infinity;
    for (let i = 0; i < neighbors.length; i++) {
      const v = neighbors[i];
      const vDir =
        v.withdrawHeavyUid !== undefined
          ? Math.sign(v.x - (v.withdrawHeavyX ?? v.x))
          : v.escortGoal !== undefined && Math.abs(v.escortGoal - v.x) > 0.5
            ? Math.sign(v.escortGoal - v.x)
            : v.backpedaling
              ? -v.facing
              : v.facing;
      if (vDir !== dir) continue;
      if (Math.abs(v.lane - u.lane) >= 4) continue;
      if ((v.x - u.x) * dir <= 0) continue;
      const d = Math.abs(v.x - u.x);
      if (d < bestDist) {
        bestDist = d;
        best = v;
      }
    }
    return best;
  };
  const flow = (v: Unit | undefined) => {
    if (!v) return 1;
    const compact =
      u.squadOrder === 'hold' &&
      v.squadOrder === 'hold' &&
      u.squad === v.squad &&
      u.holdLane !== undefined &&
      v.holdLane !== undefined;
    // Escort slots are 26 px apart. A 36 px full-speed following gap makes
    // every valid rank brake into the one behind while its tank reverses.
    const escortColumn =
      u.escortTankUid !== undefined &&
      u.escortTankUid === v.escortTankUid &&
      u.escortGoal !== undefined &&
      v.escortGoal !== undefined &&
      Math.sign(u.escortGoal - u.x) === dir &&
      Math.sign(v.escortGoal - v.x) === dir;
    const gap = compact ? 8 : escortColumn ? 18 : 24;
    const buffer = compact ? 4 : escortColumn ? 8 : 12;
    return Math.max(0, Math.min(1, (Math.abs(v.x - u.x) - gap) / buffer));
  };
  const laneFree = (lane: number) =>
    !neighbors.some(
      (v) => Math.abs(v.x - u.x) < 36 && Math.abs(v.lane - lane) < 4,
    );
  const blocker = nearestBlocker();
  u.trafficWait =
    blocker && flow(blocker) < 0.35 ? (u.trafficWait ?? 0) + dt : 0;
  if (u.passingLane === undefined && u.trafficWait > 0.4) {
    const preferred = u.uid % 2 ? 1 : -1;
    const lanes = [6, -6, 12, -12, 18, -18, 24, -24].map((offset) =>
      Math.max(-24, Math.min(24, u.lane + preferred * offset)),
    );
    u.passingLane = lanes.find(laneFree);
    // A dense front rank is not a solid wall: use a neighboring depth passage.
    if (u.trafficWait > 0.75 && u.passingLane === undefined) {
      let bestLane = lanes[0];
      let bestCount = Infinity;
      for (const lane of lanes) {
        let count = 0;
        for (const v of neighbors)
          if (Math.abs(v.lane - lane) < 4) count++;
        if (count < bestCount) {
          bestCount = count;
          bestLane = lane;
        }
      }
      u.passingLane = bestLane;
    }
  }
  const beforeLane = u.lane;
  if (u.passingLane !== undefined) {
    if (!laneFree(u.passingLane) && (u.trafficWait ?? 0) <= 0.75)
      u.passingLane = undefined;
    else {
      const change = u.passingLane - u.lane;
      u.lane += Math.max(-12 * dt, Math.min(12 * dt, change));
      if (Math.abs(change) <= 12 * dt) {
        u.lane = u.passingLane;
        u.passingLane = undefined;
        u.trafficWait = 0;
        // Hold the passing lane briefly instead of snapping back to the
        // formation slot — the blocker we just passed is still alongside,
        // and formation drift would immediately re-block us (v82 surge).
        u.passClearAt = s.time;
      }
    }
  }
  if ((u.trafficWait ?? 0) > 0.75) u.trafficYieldUntil = s.time + 1.8;
  // Same query as `blocker` above: u.x is unchanged and the lane shifted by
  // at most 12*dt, far inside the 4-lane acceptance window (v100).
  const following = blocker;
  const coordinated =
    following &&
    ((u.withdrawHeavyUid !== undefined &&
      following.withdrawHeavyUid !== undefined) ||
      (u.escortTankUid !== undefined &&
        u.escortTankUid === following.escortTankUid));
  const passage =
    !coordinated && (u.trafficYieldUntil ?? 0) > s.time ? 0.55 : 0;
  speed *= Math.max(passage, flow(following));
  const beforeX = u.x;
  u.facing = dir;
  u.x = Math.max(55, Math.min(W - 55, u.x + dir * speed * dt));
  const distance = Math.hypot(u.x - beforeX, u.lane - beforeLane);
  // Gait advances by travelled distance so feet stop when the soldier stops.
  // v175: divisor 8 + clamp keeps the passing cels visible and prevents
  // frame-skipping at high speed or on lag spikes.
  u.walk += Math.min(distance / (u.pose === 'prone' ? 4 : 8), 0.95);
  u.y = ground(s, u.x);
  u.moving = distance > 0.001;
  if (distance > 0.001 && u.motion === 'ground' && !u.climbing) {
    u.stepDust = (u.stepDust ?? 0) + distance;
    if (u.stepDust >= (u.pose === 'prone' ? 30 : 24)) {
      u.stepDust = 0;
      footPuff(s, u);
    }
    // Healthy soldiers crawling under fire kick up a steady dust trail on a
    // time cadence — at prone speed the distance-based foot puff above only
    // fires every ~3 s, far too sparse to read as a low crawl. The wounded
    // crawl uses the same timer for blood; the two branches never overlap.
    if (
      u.pose === 'prone' &&
      !u.wounded &&
      (u.crawlFxAt === undefined || s.time >= u.crawlFxAt)
    ) {
      emitParticle(s, {
        kind: 'dust',
        x: u.x - u.facing * 5 + (fxRnd(s) - 0.5) * 6,
        y: u.y - 1,
        vx: (fxRnd(s) - 0.5) * 6 - u.facing * 2,
        vy: -2 - fxRnd(s) * 3,
        life: 0.4 + fxRnd(s) * 0.2,
        maxLife: 0.6,
        color: fxRnd(s) < 0.5 ? '#94876b' : '#a79571',
        size: 2 + fxRnd(s) * 2,
      });
      u.crawlFxAt = s.time + 0.38 + fxRnd(s) * 0.22;
    }
  }
}
export function isCombatant(u: Unit) {
  return u.hp > 0 && !u.surrendered && !u.wounded;
}
export function canTakeDamage(u: Unit) {
  return u.hp > 0 && !u.surrendered;
}
export function vehicleContact(s: GameState, x: number, id: CardId) {
  const half = armorHalf(id);
  const left = ground(s, x - half),
    right = ground(s, x + half);
  const slope = Math.max(-0.18, Math.min(0.18, (right - left) / (half * 2)));
  let y = (left + right) / 2;
  for (let i = -half; i <= half; i++)
    y = Math.min(y, ground(s, x + i) - slope * i);
  return { y, angle: Math.atan(slope) };
}
const roles: Record<Doctrine, Unit['tactic'][]> = {
  balanced: ['prone', 'cover', 'crouch', 'bound', 'cover', 'bound'],
  assault: ['bound', 'cover', 'crouch', 'bound', 'prone', 'bound'],
  defensive: ['prone', 'crouch', 'cover', 'prone', 'cover', 'crouch'],
  recon: ['prone', 'cover', 'bound', 'cover'],
  support: ['prone', 'crouch', 'cover', 'crouch', 'prone'],
  irregular: ['crouch', 'cover', 'prone', 'bound'],
  elite: ['bound', 'cover', 'bound', 'prone'],
};
/** Persistent, armed ground support is a local threat; recon, transport and passing interceptors are not. */
function sustainedAirThreat(u: Unit) {
  const c = weaponCard(u);
  return !!(
    c.air &&
    !c.sortie &&
    !c.oneWay &&
    !c.airOnly &&
    !c.observer &&
    !c.airlift &&
    (c.damage ?? 0) > 0
  );
}
/** Rifles can make low-probability snapshots at rotary aircraft, never passing jets. */
function rifleRotorTarget(source: Unit, target: Unit) {
  const c = weaponCard(source);
  return (
    !!c.members &&
    !c.antiAir &&
    ammunition(source.id, source.member) === 'rifle' &&
    (target.id === 'helicopter' ||
      target.id === 'rocket_heli' ||
      target.id === 'air_assault')
  );
}
/** A visible contact must be able to bring a real weapon to bear before it drives a fallback. */
function tacticalReach(s: GameState, source: Unit, target: Unit, margin = 24) {
  const c = weaponCard(source),
    t = CARDS[target.id];
  const distance = Math.abs(source.x - target.x);
  return (
    (c.damage ?? 0) > 0 &&
    (!airborneTarget(target) || c.antiAir || rifleRotorTarget(source, target)) &&
    (!c.airOnly || airborneTarget(target)) &&
    (!c.armorOnly || t.armored || t.vehicle) &&
    distance >= (c.minRange ?? 0) &&
    distance <= unitRange(s, source) + margin &&
    (c.indirect ||
      firingHeight(s, source, target.x, target.y - bodyHeight(target)) !== null)
  );
}
function tacticalPressure(s: GameState, source: Unit, target: Unit) {
  if (!tacticalReach(s, source, target)) return 0;
  const c = weaponCard(source),
    t = CARDS[target.id];
  const cycle = c.burstSize
    ? ((c.burstSize - 1) * c.rate! + c.burstPause!) / c.burstSize
    : c.rate!;
  const hit = t.armored && c.penetration ? c.penetration : c.damage!;
  const multiplier = t.armored
    ? (c.armorMultiplier ?? 1)
    : t.members
      ? (c.infantryMultiplier ?? 1)
      : 1;
  // Compare sustained weapons, not recruitment prices; splash pressures a small local group.
  const splash = t.members && c.radius ? 1 + Math.min(0.8, c.radius / 60) : 1;
  // A cooking or locked-up automatic weapon is a moment of weakness: the
  // enemy reads the steam and knows the gun cannot answer right now.
  const heatFactor = overheated(s, source)
    ? 0.05
    : canOverheat(source) && unitHeat(s, source) > OVERHEAT_HOT
      ? 0.85
      : 1;
  return (
    (hit / (c.members ?? 1) / Math.max(0.12, cycle)) *
    (rifleRotorTarget(source, target) ? 0.018 : 1) *
    multiplier *
    splash *
    heatFactor *
    Math.sqrt(40 / Math.max(25, target.maxHp)) *
    Math.sqrt(Math.max(0.1, source.hp / source.maxHp))
  );
}
function effectiveHeavyCounter(s: GameState, friend: Unit, foe: Unit) {
  const weapon = weaponCard(friend),
    ammo = ammunition(friend.id, friend.member);
  return (
    ((CARDS[foe.id].air &&
      weapon.antiAir &&
      ammo !== 'rifle' &&
      ammo !== 'machinegun') ||
      (CARDS[foe.id].armored &&
        ((weapon.armorMultiplier ?? 1) > 1.2 || weapon.penetration))) &&
    tacticalReach(s, friend, foe, 0)
  );
}
function heavySupport(s: GameState, u: Unit, foe: Unit) {
  return s.units.some(
    (friend) =>
      friend.side === u.side &&
      isCombatant(friend) &&
      friend.tactic !== 'retreat' &&
      Math.abs(friend.x - u.x) <= 320 &&
      effectiveHeavyCounter(s, friend, foe),
  );
}
/** Continue short bounds while a known heavy weapon still covers this soldier. */
function continueHeavyWithdrawal(s: GameState, u: Unit) {
  if (u.withdrawHeavyUid === undefined) return;
  const clear = () => {
    u.withdrawHeavyUid = undefined;
    u.withdrawStandby = false;
    u.withdrawStandbySince = undefined;
    u.withdrawUntil = 0;
    u.withdrawGoal = undefined;
    u.passingLane = undefined;
  };
  if (
    infantryOrder(s, u) === 'hold' ||
    infantryOrder(s, u) === 'rush' ||
    orderedWithdrawal(s, u)
  ) {
    clear();
    return;
  }
  if (
    u.flash > 0 ||
    (u.suppression >= 3 &&
      u.lastThreat &&
      u.lastThreat.until > s.time &&
      u.withdrawHeavyX !== undefined &&
      (u.lastThreat.x - u.x) * (u.withdrawHeavyX - u.x) > 0)
  )
    u.withdrawUnderFireUntil = s.time + 6;
  const foe = s.units.find((v) => v.uid === u.withdrawHeavyUid);
  const seen = foe && visibleToSide(s, u.side, foe);
  if (seen) {
    u.withdrawHeavySeenAt = s.time;
    u.withdrawHeavyX = foe.x;
    u.withdrawHeavyY = foe.y - bodyHeight(foe);
    u.withdrawHeavyRange = unitRange(s, foe);
    if (!isCombatant(foe) || heavySupport(s, u, foe)) {
      clear();
      return;
    }
    if (tacticalReach(s, foe, u, 24)) {
      const away = Math.sign(u.x - foe.x) || (u.side === 0 ? -1 : 1);
      u.withdrawStandby = false;
      u.withdrawStandbySince = undefined;
      u.withdrawUntil = s.time + 1.5;
      if (
        u.withdrawGoal === undefined ||
        Math.abs(u.withdrawGoal - u.x) <= 4 ||
        (u.withdrawGoal - u.x) * away < 0
      ) {
        const safe = foe.x + away * (unitRange(s, foe) + 220);
        const slot = infantrySpace(s, u, safe, 72, away);
        u.withdrawGoal = slot.x;
        u.passingLane = slot.lane;
      }
      u.coverGoal = null;
      u.firingGoal = null;
      u.dispersionGoal = undefined;
      return;
    }
  } else if (
    u.withdrawHeavyX !== undefined &&
    u.withdrawHeavyY !== undefined &&
    pointVisible(s, u.side, u.withdrawHeavyX, u.withdrawHeavyY)
  ) {
    // The remembered position has actually been observed clear, not merely hidden by fog.
    clear();
    return;
  }
  if (
    (u.withdrawUnderFireUntil ?? 0) > s.time &&
    (u.withdrawGoal === undefined || Math.abs(u.withdrawGoal - u.x) <= 4)
  ) {
    const away =
      Math.sign(u.x - (u.lastThreat?.x ?? u.withdrawHeavyX ?? u.x)) ||
      (u.side === 0 ? -1 : 1);
    const slot = infantrySpace(s, u, u.x + away * 112, 48, away);
    u.withdrawGoal = slot.x;
    u.passingLane = slot.lane;
  }
  if (u.withdrawGoal !== undefined && Math.abs(u.withdrawGoal - u.x) > 4) {
    u.withdrawStandby = false;
    u.withdrawStandbySince = undefined;
    u.withdrawUntil = s.time + 1.5;
    return;
  }
  // v173: if the squad has been pinned in standby long enough, resume the
  // advance instead of standing forever. Staying pinned hands the initiative
  // to the enemy; the withdrawal logic re-evaluates on next contact, and AT
  // support that has since closed distance will hold. Uses a standby-local
  // timestamp because side-level vision keeps the heavy "seen" via a
  // distant spotter even when this squad cannot engage it.
  if (s.time - (u.withdrawStandbySince ?? s.time) > 30) {
    clear();
    return;
  }
  // Once outside its firing lane, observe rather than walking straight back into it.
  u.withdrawStandby = true;
  u.withdrawStandbySince ??= s.time;
  u.withdrawUntil = 0;
  u.withdrawGoal = undefined;
  u.coverGoal = null;
  u.firingGoal = null;
  u.dispersionGoal = undefined;
}
function crowdedInfantry(s: GameState, u: Unit, x: number) {
  return s.units.filter(
    (v) =>
      v !== u &&
      v.side === u.side &&
      isCombatant(v) &&
      CARDS[v.id].members &&
      [
        v.x,
        v.coverGoal,
        v.firingGoal,
        v.dispersionGoal,
        (v.withdrawUntil ?? 0) > s.time ? v.withdrawGoal : null,
      ].some((at) => at != null && Math.abs(at - x) < 26),
  ).length;
}
/** Reserve distinct local positions, including other squads' pending moves. */
function infantrySpace(
  s: GameState,
  u: Unit,
  preferred: number,
  reach: number,
  away = 0,
) {
  const neighbors = s.units.filter(
    (v) =>
      v !== u &&
      v.side === u.side &&
      isCombatant(v) &&
      CARDS[v.id].members &&
      [v.x, v.withdrawGoal, v.escortGoal].some(
        (x) => x !== undefined && Math.abs(x - preferred) < reach + 100,
      ),
  );
  let best = { x: preferred, lane: u.lane },
    score = Infinity;
  for (let offset = -reach; offset <= reach; offset += 12) {
    const x = Math.max(80, Math.min(W - 80, preferred + offset));
    if (away && (x - u.x) * away < 30) continue;
    for (const lane of [-18, -6, 6, 18]) {
      let value = Math.abs(offset) * 0.16 + Math.abs(lane - u.lane) * 0.15;
      for (const v of neighbors) {
        const reserved =
          (v.withdrawUntil ?? 0) > s.time
            ? v.withdrawGoal
            : (v.coverGoal ?? v.firingGoal ?? v.dispersionGoal ?? v.x);
        const gap = Math.abs((reserved ?? v.x) - x);
        value += Math.max(0, 38 - gap) * 0.7;
        if (Math.abs((v.passingLane ?? v.lane) - lane) < 8)
          value += Math.max(0, 28 - gap) * 3;
      }
      if (value < score) {
        score = value;
        best = { x, lane };
      }
    }
  }
  return best;
}
/**
 * v91: a badly wounded armoured vehicle under anti-tank threat reverses back
 * behind its infantry screen instead of fighting to the death. The hull keeps
 * its face toward the enemy so the turret stays on target while the tracks
 * carry it out of the kill zone.
 */
function planVehicleReverse(s: GameState, u: Unit) {
  const c = CARDS[u.id];
  if (!c.armored || c.air || c.static || c.vehicleSupport) return;
  if (u.hp <= 0 || u.surrendered) return;
  const reversing = (u.vehicleReverseUntil ?? 0) > s.time;
  // A vehicle that has reached its fallback goal or been repaired above the
  // threshold stops reversing.
  if (reversing) {
    const goal = u.vehicleReverseGoal ?? u.x;
    const arrived =
      Math.abs(u.x - goal) < 8 ||
      (u.side === 0 ? u.x <= goal : u.x >= goal);
    if (arrived || u.hp >= u.maxHp * 0.55) {
      u.vehicleReverseUntil = 0;
      u.vehicleReverseGoal = undefined;
      // Reaching the fallback goal while still mauled: plant on this line and
      // hold it instead of planning another bound backward.
      if (arrived && u.hp < u.maxHp * 0.35) u.vehicleReverseHeld = true;
    }
    return;
  }
  // Only assess on a staggered clock so a whole troop doesn't snap into reverse
  // on the same frame.
  if (s.time < (u.vehicleReverseAssessAt ?? 0)) return;
  u.vehicleReverseAssessAt = s.time + 0.8 + (u.uid % 5) * 0.15;
  // A healthy vehicle fights; only a badly mauled one disengages.
  if (u.hp >= u.maxHp * 0.35) {
    u.vehicleReverseHeld = false;
    return;
  }
  // Find the nearest visible enemy that can punch through this vehicle's
  // armour, and how close it is.
  let threatDist = Infinity;
  for (const v of s.units) {
    if (v.side === u.side || !isCombatant(v) || CARDS[v.id].air) continue;
    if (!visibleToSide(s, u.side, v)) continue;
    const d = Math.abs(v.x - u.x);
    if (d > 700) continue;
    const w = weaponCard(v);
    if (
      ((w.penetration ?? 0) > 0 ||
        (w.armorMultiplier ?? 1) >= 1.5 ||
        (CARDS[v.id].armored && (w.damage ?? 0) >= 40)) &&
      d < threatDist
    )
      threatDist = d;
  }
  if (!isFinite(threatDist)) {
    // The anti-tank threat is gone — a vehicle holding a fallback line
    // rejoins the fight.
    u.vehicleReverseHeld = false;
    return;
  }
  // A vehicle that has already made its fallback bound holds this line and
  // only disengages again if the enemy actually overruns it.
  if (u.vehicleReverseHeld && threatDist > 380) return;
  u.vehicleReverseHeld = false;
  // Fall back to the nearest friendly infantry screen behind the vehicle.
  const dir = u.side === 0 ? 1 : -1;
  let bestX: number | undefined;
  let bestDist = Infinity;
  for (const v of s.units) {
    if (
      v.side !== u.side ||
      !isCombatant(v) ||
      !CARDS[v.id].members ||
      v.tactic === 'retreat' ||
      v.hp <= 0
    )
      continue;
    const behind = (u.x - v.x) * dir > 30;
    if (!behind) continue;
    const d = Math.abs(v.x - u.x);
    if (d < bestDist) {
      bestDist = d;
      bestX = v.x;
    }
  }
  // No infantry screen? Fall back a fixed distance toward the baseline.
  const goal = bestX ?? u.x - dir * 220;
  u.vehicleReverseGoal = goal;
  u.vehicleReverseUntil = s.time + 6;
}
function planWithdrawal(s: GameState, u: Unit, threat: Unit) {
  const order = infantryOrder(s, u);
  if (
    order === 'hold' ||
    order === 'rush' ||
    CARDS[u.id].indirect ||
    CARDS[u.id].airOnly ||
    !visibleToSide(s, u.side, threat) ||
    !tacticalReach(s, threat, u, 36)
  )
    return;
  const squad = squadMates(s, u.side, u.squad)
    .filter(
      (v) =>
        isCombatant(v) &&
        CARDS[v.id].members &&
        v.tactic !== 'retreat' &&
        !CARDS[v.id].indirect &&
        infantryOrder(s, v) !== 'hold' &&
        infantryOrder(s, v) !== 'rush' &&
        !orderedWithdrawal(s, v),
    )
    .sort((a, b) => a.uid - b.uid);
  if (
    !squad.length ||
    squad.some(
      (v) =>
        s.time < (v.withdrawAssessAt ?? 0) || v.withdrawHeavyUid !== undefined,
    )
  )
    return;
  // A squad makes one assessment, even if its individual decision timers differ.
  for (const mate of squad)
    mate.withdrawAssessAt = s.time + vacuumAssessInterval(s, u);
  const center = squad.reduce((n, v) => n + v.x, 0) / squad.length;
  const fighters = s.units.filter(
    (v) =>
      isCombatant(v) &&
      (!CARDS[v.id].air || sustainedAirThreat(v) || weaponCard(v).antiAir) &&
      v.tactic !== 'retreat' &&
      (!CARDS[v.id].members || v.personalMorale >= 35),
  );
  const friends = fighters.filter(
    (v) => v.side === u.side && Math.abs(v.x - center) <= 320,
  );
  const foes = fighters.filter(
    (v) =>
      v.side !== u.side &&
      visibleToSide(s, u.side, v) &&
      Math.abs(v.x - center) <= 640 &&
      squad.some((mate) => tacticalReach(s, v, mate, 36)),
  );
  const pressures = foes.map((foe) => ({
    foe,
    power: Math.max(0, ...squad.map((mate) => tacticalPressure(s, foe, mate))),
  }));
  const enemyPower = pressures.reduce((n, v) => n + v.power, 0);
  const unsupportedHeavy = pressures.find(
    ({ foe, power }) =>
      power >= 8 &&
      (CARDS[foe.id].armored || sustainedAirThreat(foe)) &&
      squad.some((mate) => tacticalReach(s, foe, mate, 0)) &&
      !friends.some((friend) => effectiveHeavyCounter(s, friend, foe)),
  );
  // When friendly AT/AA is effectively countering a visible heavy threat,
  // infantry hold at standoff instead of charging into its kill zone — the
  // support weapon does the killing, the riflemen keep their skins.
  const coveredArmor = pressures.some(
    ({ foe }) =>
      (CARDS[foe.id].armored || sustainedAirThreat(foe)) &&
      squad.some((mate) => tacticalReach(s, foe, mate, 0)) &&
      friends.some((friend) => effectiveHeavyCounter(s, friend, foe)),
  );
  for (const mate of squad)
    mate.atHoldUntil = coveredArmor ? s.time + 1.5 : 0;
  if (!unsupportedHeavy && squad.some((v) => s.time < (v.withdrawNextAt ?? 0)))
    return;
  const friendlyPower = friends.reduce((n, friend) => {
    let power = Math.max(
      0,
      ...foes.map((foe) => tacticalPressure(s, friend, foe)),
    );
    // Real AT/AA support can pin its matching threat; ordinary guards cannot inherit its credit.
    for (const { foe, power: hostile } of pressures) {
      if (effectiveHeavyCounter(s, friend, foe))
        power = Math.max(power, hostile * 0.8);
    }
    return n + power;
  }, 0);
  if (!unsupportedHeavy && enemyPower < Math.max(12, friendlyPower * 1.85)) {
    for (const mate of squad) mate.withdrawPressureSince = undefined;
    return;
  }
  const since = squad.find(
    (v) => v.withdrawPressureSince !== undefined,
  )?.withdrawPressureSince;
  if (since === undefined || s.time - since < 0.6) {
    for (const mate of squad) mate.withdrawPressureSince = since ?? s.time;
    return;
  }
  const away = Math.sign(center - threat.x) || (u.side === 0 ? -1 : 1);
  for (const [index, mate] of squad.entries()) {
    const desired = unsupportedHeavy
      ? unsupportedHeavy.foe.x +
        away * (unitRange(s, unsupportedHeavy.foe) + 220)
      : mate.x + away * 66;
    const slot = infantrySpace(
      s,
      mate,
      desired,
      unsupportedHeavy ? 72 : 24,
      away,
    );
    mate.withdrawHeavyUid = unsupportedHeavy?.foe.uid;
    mate.withdrawHeavySeenAt = unsupportedHeavy ? s.time : undefined;
    mate.withdrawHeavyRange = unsupportedHeavy
      ? unitRange(s, unsupportedHeavy.foe)
      : undefined;
    mate.withdrawHeavyX = unsupportedHeavy?.foe.x;
    mate.withdrawHeavyY = unsupportedHeavy
      ? unsupportedHeavy.foe.y - bodyHeight(unsupportedHeavy.foe)
      : undefined;
    mate.withdrawStandby = false;
    mate.withdrawStandbySince = undefined;
    mate.withdrawStartedAt = s.time;
    mate.withdrawUntil = s.time + 4.8;
    mate.withdrawNextAt = s.time + 11;
    mate.withdrawSafeSince = undefined;
    mate.withdrawGroup = index % 2;
    mate.withdrawGoal = slot.x;
    mate.passingLane = slot.lane;
    mate.coverGoal = null;
    mate.firingGoal = null;
    mate.dispersionGoal = undefined;
  }
}

function prepareInfantry(s: GameState, u: Unit, dt: number) {
  const c = CARDS[u.id];
  if (orderedWithdrawal(s, u)) {
    if (u.withdrawGoal !== u.squadOrderX) {
      u.withdrawStartedAt = s.time;
      u.withdrawGroup = u.member % 2;
    }
    u.withdrawUntil = s.time + 1;
    u.withdrawGoal = u.squadOrderX;
    u.coverGoal = null;
    u.firingGoal = null;
    u.dispersionGoal = undefined;
    // A commanded fallback is not a morale rout and cannot cause friendly conflict.
    if (u.tactic === 'retreat') u.tactic = 'crouch';
  } else if (infantryOrder(s, u) === 'hold') {
    u.withdrawUntil = 0;
    u.coverGoal = null;
    u.firingGoal = null;
    u.dispersionGoal = undefined;
  }
  continueHeavyWithdrawal(s, u);
  const settled = !u.moving && !crouchMotionActive(u) && !proneMotionActive(u) && !stanceTransitionActive(u,s.time) && u.motion === 'ground' && u.climbing <= 0;
  u.stillFor = settled ? (u.stillFor ?? 0) + dt : 0;
  if (isHeavyGunner(u))
    u.emplacementSetupUntil = s.time + Math.max(0, HEAVY_MG_SETUP - (u.stillFor ?? 0));
  if (u.id === 'ambush_squad')
    u.camouflageFor = canPrepareAmbush(u, s.time) ? (u.camouflageFor ?? 0) + dt : 0;
  u.ambushFor =
    settled && u.fire <= 0 && s.time - (u.lastCombatShotAt ?? -Infinity) > 0.3
      ? (u.ambushFor ?? 0) + dt
      : 0;
  if (
    c.infantryAbility === 'buddy_rally' &&
    !u.buddyRallied &&
    squadMates(s, u.side, u.squad).some(
      (v) =>
        v !== u &&
        v.hp > 0 &&
        (v.wounded || v.hp < v.maxHp * 0.5) &&
        Math.abs(v.x - u.x) <= 96,
    )
  ) {
    for (const mate of squadMates(s, u.side, u.squad)) {
      mate.buddyRallied = true;
      if (isCombatant(mate) && Math.abs(mate.x - u.x) <= 96) {
        mate.personalMorale = Math.max(
          mate.personalMorale,
          Math.min(CARDS[mate.id].discipline ?? 80, mate.personalMorale + 10),
        );
        mate.suppression = Math.max(0, mate.suppression - 15);
      }
    }
  }
  if (
    (c.trait === 'engineer' || c.trait === 'mechanic') &&
    u.motion === 'ground' &&
    u.climbing <= 0 &&
    u.supportCooldown <= 0
  ) {
    const mine = s.mines.find(
      (m) => m.side !== u.side && Math.abs(m.x - u.x) <= 36,
    );
    if (mine) {
      s.mines = s.mines.filter((m) => m !== mine);
      u.supportCooldown = 1.2;
    }
  }
}

/** Seconds of disorganisation after a squad leader falls before a successor takes over. */
export const COMMAND_VACUUM_DURATION = 5;
/** Suppression recovery is slowed to this fraction while leaderless. */
const VACUUM_SUPPRESSION_FACTOR = 0.55;
/** Withdrawal assessments are spaced this far apart (seconds) while leaderless. */
const VACUUM_ASSESS_INTERVAL = 2.4;

/**
 * Squad command tracking: the leader is the living combatant with the lowest
 * uid in the squad (matching the hand-signal convention in squad-orders).
 * When the leader dies the squad enters a command vacuum for
 * COMMAND_VACUUM_DURATION seconds — suppression recovery slows, bounding
 * overwatch freezes, and withdrawal assessments lag — until the next man
 * steps up. Called once per tick after the squad index is rebuilt.
 */
export function updateSquadCommand(s: GameState) {
  if (!s.squadCommand) s.squadCommand = {};
  const cmd = s.squadCommand;
  const seen = new Set<number>();
  for (const [key, mates] of s.squadIndex ?? []) {
    seen.add(key);
    const living = mates.filter(
      (v) => v.hp > 0 && isCombatant(v) && CARDS[v.id].members,
    );
    if (!living.length) continue;
    let leader = living[0];
    for (const m of living) if (m.uid < leader.uid) leader = m;
    const rec = cmd[key];
    if (!rec) {
      cmd[key] = { leaderUid: leader.uid, vacuumUntil: 0 };
    } else if (rec.leaderUid !== leader.uid) {
      // The previous leader is gone (dead or the squad was wiped and
      // reformed). Open a vacuum window, then hand over to the successor.
      rec.vacuumUntil = s.time + COMMAND_VACUUM_DURATION;
      rec.leaderUid = leader.uid;
    }
  }
  // Drop records for squads that no longer exist so the map doesn't grow
  // across a long battle.
  for (const key of Object.keys(cmd)) {
    if (!seen.has(Number(key))) delete cmd[Number(key)];
  }
}

/** True while the squad is leaderless and hasn't yet handed over command. */
export function squadInVacuum(s: GameState, side: Side, squad: number): boolean {
  const rec = s.squadCommand?.[side * 1048576 + squad];
  return !!rec && s.time < rec.vacuumUntil;
}

/** Suppression-decay multiplier for a unit, accounting for command vacuum. */
export function vacuumSuppressionFactor(s: GameState, u: Unit): number {
  return squadInVacuum(s, u.side, u.squad) ? VACUUM_SUPPRESSION_FACTOR : 1;
}

/** Withdrawal-assessment interval for a squad, extended while leaderless. */
export function vacuumAssessInterval(s: GameState, u: Unit): number {
  return squadInVacuum(s, u.side, u.squad) ? VACUUM_ASSESS_INTERVAL : 0.75;
}

/**
 * Fire-team rotation (bounding overwatch): while a squad stays in contact,
 * members periodically trade who sprints (bound) and who shoots from cover.
 * Returns the squad's current role offset; the caller applies it modulo the
 * doctrine list. Frozen when the squad is too depleted or too suppressed to
 * manoeuvre, and re-clocked when contact was lost long enough to count as a
 * fresh engagement.
 */
export function squadRoleOffset(
  s: GameState,
  u: Unit,
  survivors: Unit[],
): number {
  if (!s.squadManeuver) s.squadManeuver = {};
  const rec =
    s.squadManeuver[u.squad] ??
    (s.squadManeuver[u.squad] = {
      offset: 0,
      lastRotate: s.time,
      lastContact: s.time,
    });
  const now = s.time;
  // A contact gap over 3s is a fresh engagement; don't rotate on first touch.
  if (now - rec.lastContact > 3) rec.lastRotate = now;
  rec.lastContact = now;
  const fighting = survivors.filter((v) => isCombatant(v));
  if (fighting.length < 3) return rec.offset;
  // A leaderless squad can't coordinate fire-and-manoeuvre rotation.
  if (squadInVacuum(s, u.side, u.squad)) return rec.offset;
  const avgSuppression =
    fighting.reduce((n, v) => n + v.suppression, 0) / fighting.length;
  if (avgSuppression >= 50) return rec.offset;
  const cadence = 5.2 + (u.squad % 3) * 0.7;
  if (now - rec.lastRotate >= cadence) {
    rec.offset++;
    rec.lastRotate = now;
  }
  return rec.offset;
}
// Extra suppression a unit absorbs before pinning when a halted sniper team
// is overwatching it. Covered infantry stay on their feet and keep manoeuvring
// through fire that would flatten an uncovered squad.
const OVERWATCH_NERVE = 14;
// Covered infantry also hold their nerve longer before *breaking*: the
// overwatch sniper's covering fire shaves the morale-break point by this many
// points, so a covered squad only routs at 28 morale instead of 35.
const OVERWATCH_MORALE_NERVE = 7;
function decideTactic(s: GameState, u: Unit, dt: number) {
  u.decisionIn -= dt;
  u.moraleIn = Math.max(0, (u.moraleIn ?? 0) - dt);
  const moraleDue = u.moraleIn <= 0;
  if (moraleDue) u.moraleIn = 1.1 + (u.member % 4) * 0.18;
  // Overwatch nerve: infantry covered by a halted sniper team keep their
  // nerve under fire and only pin at a higher suppression level, so an
  // overwatched advance keeps bounding through fire that would flatten an
  // uncovered squad. Matches the overwatch synergy's suppression-decay buff.
  const overwatch = unitSynergy(s, u, s.time).overwatch;
  const nerve = overwatch ? OVERWATCH_NERVE : 0;
  const moraleNerve = overwatch ? OVERWATCH_MORALE_NERVE : 0;
  const quickContact =
    u.tactic === 'advance' && (u.contactScanAt ?? 0) <= s.time;
  if (u.decisionIn > 0 && !quickContact) return;
  u.contactScanAt = s.time + 0.09 + (u.uid % 3) * 0.015;
  const c = CARDS[u.id];
  // 1200px covers the longest effective range (max card range 900, times
  // recon/mountain modifiers ~1125); every downstream use of `threat`
  // (inContact, surrender, retreat morale, planWithdrawal) treats a foe
  // beyond that distance identically to no threat at all.
  nearUnits(s, u.x, 1200, tacticNearScratch);
  tacticOutScratch.length = 0;
  for (const v of tacticNearScratch) {
    if (
      v.side !== u.side &&
      isCombatant(v) &&
      visibleToSide(s, u.side, v) &&
      (!CARDS[v.id].air ||
        (sustainedAirThreat(v) &&
          Math.abs(v.x - u.x) <= Math.min(560, unitRange(s, v) + 40)))
    ) {
      tacticOutScratch.push(v);
    }
  }
  const threat = tacticOutScratch.sort(
    (a, b) => Math.abs(a.x - u.x) - Math.abs(b.x - u.x),
  )[0];
  const inContact =
    !!threat &&
    Math.abs(threat.x - u.x) <=
      Math.max(unitRange(s, u), Math.min(720, unitRange(s, threat) + 40));
  const newContact = inContact && (u.contactUntil ?? 0) <= s.time;
  if (inContact) {
    u.contactUid = threat.uid;
    u.contactAir = !!CARDS[threat.id].air;
    u.contactUntil = s.time + 1.2;
  } else u.contactAir = false;
  // v87: a soldier who newly spots a threat shouts a contact report so
  // nearby squadmates orient toward the danger before they see it
  // themselves. Throttled per squad so a platoon does not chant in chorus.
  if (newContact && (u.calloutUntil ?? 0) <= s.time) {
    const squadShouting = squadMates(s, u.side, u.squad).some(
      (v) => v !== u && (v.calloutUntil ?? 0) > s.time,
    );
    if (!squadShouting) {
      const dir = (threat.x > u.x ? 1 : -1) as 1 | -1;
      u.calloutUntil = s.time + 0.9;
      u.calloutDir = dir;
      for (const v of squadMates(s, u.side, u.squad)) {
        if (v !== u && isCombatant(v) && Math.abs(v.x - u.x) <= 140) {
          v.heardContactAt = s.time;
          v.heardContactDir = dir;
        }
      }
    }
  }
  // v118: squad leaders point out the threat while in contact — an arm-out
  // beat between fire orders so the chain of command reads on the field.
  // Throttled per leader so it punctuates the fight instead of chanting.
  const leaderUid = s.squadCommand?.[u.side * 1048576 + u.squad]?.leaderUid;
  if (
    leaderUid === u.uid &&
    inContact &&
    !u.moving &&
    (u.pointNextAt ?? 0) <= s.time
  ) {
    u.pointUntil = s.time + 1.2;
    u.pointDir = (threat.x > u.x ? 1 : -1) as 1 | -1;
    u.pointNextAt = s.time + 6.5 + (u.uid % 3) * 0.7;
  }
  const reactNow = newContact && u.tactic === 'advance';
  if (!reactNow && u.decisionIn > 0) return;
  u.decisionIn = 1.1 + (u.member % 4) * 0.18;
  if (
    inContact &&
    (u.dispersionNextAt ?? 0) <= s.time &&
    (u.withdrawUntil ?? 0) <= s.time &&
    infantryOrder(s, u) !== 'hold' &&
    infantryOrder(s, u) !== 'rush' &&
    !orderedWithdrawal(s, u) &&
    !c.indirect &&
    u.member % 3 !== 0 &&
    (crowdedInfantry(s, u, u.x) >= 5 ||
      s.units.some(
        (v) =>
          v !== u &&
          v.side === u.side &&
          isCombatant(v) &&
          CARDS[v.id].members &&
          Math.abs(v.x - u.x) < 20 &&
          Math.abs(v.lane - u.lane) < 8,
      ))
  ) {
    const slot = infantrySpace(s, u, u.x, 36);
    u.dispersionGoal = slot.x;
    u.dispersionUntil = s.time + 2.5;
    u.dispersionNextAt = s.time + 4.5;
    u.dispersionStartedAt = s.time;
    u.passingLane = slot.lane;
  }
  const survivorList = squadMates(s, u.side, u.squad).filter(isCombatant);
  const survivors = survivorList.length;
  if (
    !c.neverSurrender &&
    u.personalMorale < 18 &&
    survivors <= 2 &&
    u.hp / u.maxHp < 0.35 &&
    threat &&
    Math.abs(threat.x - u.x) < 320
  ) {
    u.surrendered = true;
    u.tactic = 'surrender';
    u.surrenderTime = 0;
    u.fire = 0;
    u.secondaryFire = 0;
    u.coverGoal = null;
    u.climbing = 0;
    u.motion = 'ground';
    s.players[u.side === 0 ? 1 : 0].captures++;
    notify(
      s,
      `${u.side === 0 ? '我方' : '敌方'}${c.name}有队员放下武器`,
      'info',
      ([0, 1] as Side[]).filter((side) => visibleToSide(s, side, u)),
    );
    return;
  }
  if (u.tactic === 'retreat') {
    if (
      u.personalMorale < 70 &&
      (!threat ||
        Math.abs(threat.x - u.x) > Math.max(560, unitRange(s, u)) + 130)
    )
      u.personalMorale = Math.min(70, u.personalMorale + 8);
    if (s.time < u.retreatUntil || u.personalMorale < 52) {
      u.coverGoal = null;
      return;
    }
  }
  if (!inContact) {
    u.withdrawPressureSince = undefined;
    u.dispersionGoal = undefined;
    u.coverGoal = null;
    u.firingGoal = null;
    u.lastThreat = undefined;
    u.tactic = u.suppression > 68 + nerve ? 'prone' : 'advance';
    if (moraleDue && u.personalMorale < (c.discipline ?? 80))
      u.personalMorale = Math.min(c.discipline ?? 80, u.personalMorale + 1.5);
    return;
  }
  // v113: morale under fire is driven by the local force ratio, not by every
  // graze. A man who sees his side badly outmatched loses nerve steadily;
  // one who is winning, fighting beside armour, led by a live leader, or who
  // just dropped an enemy, steadies. Green troops fold faster than veterans.
  // Gated by moraleIn so the per-tick constants hold no matter how often the
  // quickContact bypass re-enters this function.
  if (moraleDue) {
    let ownPower = 0;
    let foePower = 0;
    for (const v of tacticNearScratch) {
      if (!isCombatant(v)) continue;
      const vc = CARDS[v.id];
      // Support vehicles (command, repair, mine-clear) are not fighting
      // strength: their aura helps nearby men, but their presence 500px
      // away must not tilt the local force ratio.
      if (vc.vehicleSupport) continue;
      const power =
        (v.hp / v.maxHp) * (vc.armored ? 2.6 : vc.air ? 1.6 : 1);
      if (v.side === u.side) {
        if (Math.abs(v.x - u.x) <= 520) ownPower += power;
      } else if (
        visibleToSide(s, u.side, v) &&
        Math.abs(v.x - u.x) <= 640
      ) {
        foePower += power;
      }
    }
    const ratio = foePower > 0.01 ? ownPower / foePower : 4;
    const discipline = c.discipline ?? 80;
    const greenFactor = 0.55 + (100 - discipline) / 95;
    if (ratio < 0.6) {
      // A bounded fighting withdrawal is the morale safety valve: men giving
      // ground in good order (overwatch behind them) lose nerve far slower
      // than men pinned in place under the same bad odds.
      const orderlyFallBack =
        (u.withdrawUntil ?? 0) > s.time && u.tactic !== 'retreat';
      u.personalMorale = Math.max(
        0,
        u.personalMorale -
          (0.6 - ratio) * 13 * greenFactor * (orderlyFallBack ? 0.4 : 1),
      );
    } else if (ratio > 1.5) {
      if (u.personalMorale < discipline)
        u.personalMorale = Math.min(
          discipline,
          u.personalMorale + (ratio - 1.5) * 3.5,
        );
    }
    const leaderUid = s.squadCommand?.[u.side * 1048576 + u.squad]?.leaderUid;
    if (
      leaderUid !== undefined &&
      leaderUid !== u.uid &&
      Math.abs(
        (s.units.find((v) => v.uid === leaderUid)?.x ?? u.x) - u.x,
      ) <= 300
    ) {
      if (u.personalMorale < discipline)
        u.personalMorale = Math.min(discipline, u.personalMorale + 2.5);
    }
    if (
      s.units.some(
        (v) =>
          v.side === u.side &&
          isCombatant(v) &&
          CARDS[v.id].armored &&
          !CARDS[v.id].air &&
        Math.abs(v.x - u.x) <= 360,
    )
    ) {
      if (u.personalMorale < discipline)
        u.personalMorale = Math.min(discipline, u.personalMorale + 2);
    }
    if ((u.lastKillAt ?? -99) > s.time - 6) {
      if (u.personalMorale < discipline)
        u.personalMorale = Math.min(discipline, u.personalMorale + 1.5);
    }
  }
  if (u.personalMorale < 35 - moraleNerve && !orderedWithdrawal(s, u)) {
    u.originalSquad = u.squad;
    u.conflictChecked = false;
    u.regroupProgress = 0;
    u.tactic = 'retreat';
    u.retreatUntil = s.time + 4;
    u.coverGoal = null;
    return;
  }
  if (!orderedWithdrawal(s, u)) planWithdrawal(s, u, threat);
  const doctrine = doctrineOf(u.id),
    list = roles[doctrine];
  // Fire teams trade bound/cover roles on a squad-wide cadence so one group
  // sprints while the other shoots (bounding overwatch / fire and movement).
  // A visible foe caught mid-reload (dry magazine, swap in progress) cannot
  // fire back, so pinned units discount their suppression and seize the
  // window to bound. Only genuine reloads count (ammo === 0), not the
  // decorative bolt-cycle flag on slow-firing rifles.
  const threatReloading =
    !!threat && threat.ammo === 0 && (threat.reloadingUntil ?? 0) > s.time;
  const effectiveSuppression = u.suppression - (threatReloading ? 30 : 0);
  u.tactic =
    effectiveSuppression > 65 + nerve
      ? 'prone'
      : list[
          (u.member + squadRoleOffset(s, u, survivorList)) % list.length
        ];
}
function evadeArtillery(s: GameState, u: Unit, dt: number) {
  const eta = (p: Projectile) =>
    p.guided
      ? Math.hypot(p.tx - p.x, p.ty - p.y) /
        FLIGHT[p.ammunition ?? 'mortar'].speed
      : p.life;
  const incoming = s.projectiles.find((p) => {
    const progress = 1 - Math.max(0, p.life) / p.total;
    const descending =
      p.ty - p.startY - 4 * (p.arc ?? 0) * (1 - 2 * progress) > 0;
    return (
      p.side !== u.side &&
      p.shell &&
      descending &&
      eta(p) > 0 &&
      eta(p) < 0.58 &&
      Math.hypot(p.x - u.x, p.y - (u.y - 30)) < 145
    );
  });
  if (incoming && !(u.artilleryChecks ?? []).includes(incoming.uid ?? -1)) {
    const id = incoming.uid ?? -1;
    u.artilleryChecks = [...(u.artilleryChecks ?? []).slice(-7), id];
    // One local perception roll per shell/member; no impact marker or squad-wide alert.
    let hash = Math.imul((id + 1) ^ Math.imul(u.uid + 1, 374761393), 668265263);
    hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
    const roll = ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
    const distance = Math.hypot(incoming.x - u.x, incoming.y - (u.y - 30));
    const chance = Math.max(
      0.3,
      Math.min(
        0.88,
        0.48 + (CARDS[u.id].discipline ?? 70) * 0.004 - distance / 650,
      ),
    );
    if (roll < chance) {
      u.evadeMarker = id;
      u.artilleryReactAt = s.time + 0.04 + ((hash >>> 20) / 4096) * 0.13;
      u.evadeUntil = s.time + 1.1 + (u.uid % 4) * 0.08;
      const dir = hash & 1 ? 1 : -1;
      u.evadeGoal = Math.max(
        80,
        Math.min(W - 80, u.x + dir * (10 + (u.uid % 3) * 5)),
      );
    }
  }
  if (u.evadeUntil <= s.time) {
    u.evadeGoal = null;
    return false;
  }
  if ((u.artilleryReactAt ?? 0) > s.time) return false;
  u.coverGoal = null;
  u.firingGoal = null;
  u.fire = 0;
  u.secondaryFire = 0;
  const noticed = s.projectiles.find((p) => p.uid === u.evadeMarker);
  if (!noticed || eta(noticed) < 0.18 || localUnitOrder(s, u) === 'watch')
    u.evadeGoal = null;
  if (u.evadeGoal !== null && Math.abs(u.evadeGoal - u.x) > 4) {
    u.pose = setStance(u, s.time, 'run', { force: true });
    moveSoldier(
      s,
      u,
      Math.sign(u.evadeGoal - u.x),
      CARDS[u.id].speed! * u.pace * 1.5,
      dt,
      false,
    );
    if (u.moving) return true;
  }
  u.evadeGoal = null;
  u.pose = setStance(u, s.time, 'prone', { force: true });
  u.moving = false;
  return true;
}
function fireCoax(s: GameState, u: Unit) {
  if (u.secondaryCooldown > 0) return;
  const personal = !!CARDS[u.id].armorOnly;
  const selfRange = personal ? 240 : 420;
  const selfHeight = personal ? (CARDS[u.id].members ? 38 : 30) : 42;
  const target = s.units
    .filter(
      (v) =>
        v.side !== u.side &&
        isCombatant(v) &&
        visibleToSide(s, u.side, v) &&
        CARDS[v.id].members &&
        Math.abs(v.x - u.x) <=
          selfRange *
            (s.players[u.side].recon > 0
              ? 1.2
              : droneRecon(s, u.side, u.x)
                ? 1.1
                : 1),
    )
    .sort((a, b) => Math.abs(a.x - u.x) - Math.abs(b.x - u.x))
    .find((v) => {
      const p = muzzlePoint(u, v.x, selfHeight, true);
      return (
        !smokeBlocks(s, u.side, u.x, v.x) &&
        !terrainIntercept(s, p.x, p.y, v.x, v.y - bodyHeight(v), true)
      );
    });
  if (!target) return;
  const point = muzzlePoint(u, target.x, selfHeight, true),
    sx = point.x,
    sy = point.y,
    total = Math.max(
      FLIGHT.machinegun.minimum,
      Math.abs(target.x - sx) / FLIGHT.machinegun.speed,
    );
  u.secondaryShots++;
  u.secondaryMuzzleX = sx;
  u.secondaryMuzzleY = sy;
  u.secondaryAngle = Math.atan2(
    target.y - bodyHeight(target) - sy,
    target.x - sx,
  );
  muzzleParticles(s, u, 'machinegun', sx, sy, true);
  if (s.night) u.flashUntil = s.time + 0.9;
  u.secondaryCooldown = personal
    ? 1.4
    : u.secondaryShots % 4 === 0
      ? 1.2
      : 0.12;
  u.secondaryFire = 0.09;
  s.projectiles.push({
    sourceUid: u.uid,
    x: sx,
    y: sy,
    tx: target.x,
    ty: target.y - bodyHeight(target),
    side: u.side,
    targetUid: target.uid,
    base: null,
    damage: 3 * (s.players[u.side].morale > 0 ? 1.35 : 1),
    radius: 0,
    life: total,
    total,
    startX: sx,
    startY: sy,
    arc: 0,
    weapon: 'coax',
    ammunition: personal ? 'rifle' : 'machinegun',
    tracer: true,
  });
}
/** Local service work happens before mine contact. Return true while parked at a job. */
function serviceVehicle(s: GameState, u: Unit) {
  const support = CARDS[u.id].vehicleSupport;
  if (support === 'repair') {
    const patients = s.units
      .filter(
        (v) =>
          v !== u &&
          v.side === u.side &&
          isCombatant(v) &&
          CARDS[v.id].armored &&
          !CARDS[v.id].air &&
          CARDS[v.id].vehicleSupport !== 'repair' &&
          v.hp < v.maxHp &&
          Math.abs(v.x - u.x) <= 180,
      )
      .sort(
        (a, b) =>
          a.hp / a.maxHp - b.hp / b.maxHp ||
          Math.abs(a.x - u.x) - Math.abs(b.x - u.x),
      );
    const patient =
      patients.find((v) => (v.recoverySupportUntil ?? 0) <= s.time) ??
      patients[0];
    if (!patient) return false;
    if (
      u.supportCooldown <= 0 &&
      (patient.recoverySupportUntil ?? 0) <= s.time
    ) {
      patient.hp = Math.min(patient.maxHp, patient.hp + 9);
      patient.recoverySupportUntil = s.time + 0.5;
      patient.healing = u.healing = 0.6;
      u.supportCooldown = 0.5;
    }
    return true;
  }
  if (support === 'command') {
    if (u.supportCooldown > 0) return false;
    u.supportCooldown = 1;
    for (const v of s.units) {
      if (
        v.side !== u.side ||
        !isCombatant(v) ||
        !CARDS[v.id].members ||
        Math.abs(v.x - u.x) > 220 ||
        (v.commandSupportUntil ?? 0) > s.time
      )
        continue;
      v.commandSupportUntil = s.time + 1;
      if (v.personalMorale < 85)
        v.personalMorale = Math.min(85, v.personalMorale + 2);
      v.suppression = Math.max(0, v.suppression - 3);
      v.cooldown = Math.max(0, v.cooldown - 0.12);
    }
    return false;
  }
  if (support === 'mine_clear') {
    // Search only the local tool reach; no mine information is added to team vision or UI.
    const reach = Math.max(110, armorHalf(u.id) + 35);
    const mine = s.mines
      .filter(
        (m) =>
          m.side !== u.side &&
          m.armAt !== Infinity &&
          Math.abs(m.x - u.x) <= reach,
      )
      .sort((a, b) => Math.abs(a.x - u.x) - Math.abs(b.x - u.x))[0];
    if (mine) {
      if (u.supportCooldown <= 0) {
        mine.armAt = Infinity;
        u.supportCooldown = 0.6;
      }
      // Keep the vehicle stopped between operations in a dense minefield.
      return true;
    }
    const dir = u.side === 0 ? 1 : -1;
    const wall = s.walls.find(
      (w) => w.hp > 0 && (w.x - u.x) * dir >= 0 && Math.abs(w.x - u.x) <= 65,
    );
    if (wall) {
      if (u.supportCooldown <= 0) {
        wall.hp = Math.max(0, wall.hp - 90);
        u.supportCooldown = 0.6;
      }
      return true;
    }
  }
  return false;
}
function emplacementPosition(s: GameState, side: Side, id: CardId) {
  const dir = side === 0 ? 1 : -1,
    base = side === 0 ? 112 : W - 112;
  const escorts = s.units.filter(
    (u) =>
      u.side === side &&
      isCombatant(u) &&
      !CARDS[u.id].air &&
      !CARDS[u.id].static &&
      u.tactic !== 'retreat',
  );
  if (!escorts.length) return base;
  const front = escorts.reduce((a, u) => (dir * u.x > dir * a ? u.x : a), base);
  let goal = front - dir * (CARDS[id].emplacement === 'howitzer' ? 360 : 180);
  for (const foe of s.units.filter(
    (u) =>
      u.side !== side &&
      isCombatant(u) &&
      !CARDS[u.id].air &&
      visibleToSide(s, side, u),
  )) {
    const safe = foe.x - dir * Math.max(220, (CARDS[id].minRange ?? 0) + 100);
    if (dir * safe < dir * goal) goal = safe;
  }
  return side === 0
    ? Math.max(base, Math.min(W - 220, goal))
    : Math.min(base, Math.max(220, goal));
}

// A howitzer can redeploy after its observed firing sector has stayed empty.
// Reloading and brief losses of sight never make it pack up between shots.
function towHowitzer(s: GameState, u: Unit, dt: number) {
  const c = CARDS[u.id],
    range = unitRange(s, u),
    baseX = u.side === 0 ? W - 70 : 70,
    baseDistance = Math.abs(baseX - u.x);
  const canEngage =
    (baseDistance >= (c.minRange ?? 0) && baseDistance <= range) ||
    s.units.some(
      (v) =>
        v.side !== u.side &&
        isCombatant(v) &&
        !CARDS[v.id].air &&
        visibleToSide(s, u.side, v) &&
        Math.abs(v.x - u.x) >= (c.minRange ?? 0) &&
        Math.abs(v.x - u.x) <= range,
    ) ||
    // A fresh sound-ranging fix on an enemy battery is enough to emplace
    // and prepare counter-battery fire even without a visible target.
    s.batteryReports.some(
      (r) =>
        r.side === u.side &&
        r.life > 3 &&
        Math.abs(r.x - u.x) >= (c.minRange ?? 0) &&
        Math.abs(r.x - u.x) <= range,
    );
  if (canEngage) {
    u.emplacementIdleSince = undefined;
    if (!u.emplaced) {
      u.emplaced = true;
      u.emplacementSetupUntil = s.time + 1.2;
    }
    if (s.time < (u.emplacementSetupUntil ?? 0)) {
      u.moving = false;
      u.fire = 0;
      u.secondaryFire = 0;
      return true;
    }
    return false;
  }
  const goal = emplacementPosition(s, u.side, u.id),
    delta = goal - u.x;
  if (u.emplaced) {
    u.emplacementIdleSince ??= s.time;
    if (
      s.players[u.side].order === 'hold' ||
      s.time - u.emplacementIdleSince < 6 ||
      Math.abs(delta) < 1
    )
      return false;
    u.emplaced = false;
    u.emplacementSetupUntil = undefined;
  }
  if (s.players[u.side].order === 'hold' || Math.abs(delta) < 1) return false;
  const change = Math.sign(delta) * Math.min(Math.abs(delta), 28 * dt);
  const before = u.x;
  u.x = contactSafeX(s, u, u.x + change);
  u.y = ground(s, u.x);
  u.facing = Math.sign(change);
  u.moving = Math.abs(u.x-before) > .001;
  u.walk += Math.min(Math.abs(u.x-before) / 8, 0.95);
  u.fire = 0;
  u.secondaryFire = 0;
  return true;
}

// Direct-fire emplacements remain fixed after their initial deployment.
function towEmplacement(s: GameState, u: Unit, dt: number) {
  const c = CARDS[u.id];
  if (c.emplacement === 'howitzer') return towHowitzer(s, u, dt);
  if (!c.emplacement || u.emplaced) return false;
  const canEngage = s.units.some(
    (v) =>
      v.side !== u.side &&
      isCombatant(v) &&
      visibleToSide(s, u.side, v) &&
      (!CARDS[v.id].air || c.antiAir) &&
      (!c.airOnly || CARDS[v.id].air) &&
      Math.abs(v.x - u.x) >= (c.minRange ?? 0) &&
      Math.abs(v.x - u.x) <= unitRange(s, u) &&
      firingHeight(s, u, v.x, v.y - bodyHeight(v)) !== null,
  );
  if (canEngage || u.shots > 0) {
    u.emplaced = true;
    return false;
  }
  const goal = emplacementPosition(s, u.side, u.id),
    delta = goal - u.x;
  if (Math.abs(delta) < 1) return false;
  const change = Math.sign(delta) * Math.min(Math.abs(delta), 28 * dt);
  const before = u.x;
  u.x = contactSafeX(s, u, u.x + change);
  u.y = ground(s, u.x);
  u.facing = Math.sign(change);
  u.moving = Math.abs(u.x-before) > .001;
  u.walk += Math.min(Math.abs(u.x-before) / 8, 0.95);
  u.fire = 0;
  u.secondaryFire = 0;
  return true;
}

const aiSquadCommandState = new WeakMap<
  GameState,
  Map<
    number,
    {
      at: number;
      order: 'hold' | 'watch' | 'retreat' | null;
    }
  >
>();
function commandAiSquads(
  s: GameState,
  own: Unit[],
  visibleFoes: Unit[],
  staging: boolean,
) {
  let state = aiSquadCommandState.get(s);
  if (!state) {
    state = new Map();
    aiSquadCommandState.set(s, state);
  }
  const groups = new Map<number, Unit[]>();
  for (const u of own)
    if (CARDS[u.id].members && !u.rappelling) {
      const group = groups.get(u.squad) ?? [];
      group.push(u);
      groups.set(u.squad, group);
    }
  for (const id of state.keys()) if (!groups.has(id)) state.delete(id);
  for (const [squad, members] of groups) {
    const previous = state.get(squad);
    const clearLocalOrder = () => {
      // Only clear orders owned by this AI hook, including retreat's automatic watch.
      if (!previous?.order) return;
      for (const u of members)
        if (
          u.squadOrder === previous.order ||
          (previous.order === 'retreat' && u.squadOrder === 'watch')
        ) {
          u.squadOrder = undefined;
          u.squadOrderX = undefined;
          u.squadOrderUntil = undefined;
          u.decisionIn = 0;
        }
      state.set(squad, { at: s.time, order: null });
    };
    const center = members.reduce((n, u) => n + u.x, 0) / members.length;
    const enemies = visibleFoes.filter(
      (u) => !CARDS[u.id].air && Math.abs(u.x - center) < 420,
    );
    const meanMorale =
      members.reduce((n, u) => n + u.personalMorale, 0) / members.length;
    const fallback = own.some(
      (u) =>
        CARDS[u.id].members &&
        u.squad !== squad &&
        u.x > center + 100 &&
        u.x < center + 420 &&
        u.personalMorale >= 55,
    );
    // The autonomous infantry logic handles ordinary bounding withdrawals. A
    // squad-level retreat is only a short regroup behind an existing healthy line.
    const retreat =
      enemies.length &&
      meanMorale < 30 &&
      fallback &&
      center < W - 500 &&
      !members.some(
        (u) =>
          weaponCard(u).armorOnly ||
          weaponCard(u).airOnly ||
          weaponCard(u).indirect,
      );
    // Local infantry threat assessment owns normal cover and withdrawals. The
    // strategic hook must not replace that assessment with a card-price ratio.
    const next = retreat
      ? 'retreat'
      : members.every((u) => CARDS[u.id].observer || u.id === 'scouts') &&
          enemies.length
        ? 'watch'
        : null;
    if (staging || next === null) {
      clearLocalOrder();
      continue;
    }
    if (members.some((u) => u.squadOrder === 'retreat')) {
      if (previous && s.time - previous.at >= 12) clearLocalOrder();
      continue;
    }
    if (s.time - (previous?.at ?? -Infinity) < 9) continue;
    if (next === null) clearLocalOrder();
    else if (!members.every((u) => u.squadOrder === next))
      setSquadOrder(s, 1, squad, next);
    state.set(squad, { at: s.time, order: next });
  }
}

// The AI's 20-card deck is always the union of deck + discard + hand (plus
// sortie tokens currently airborne), so the archetype is stable at any moment.
function inferArchetype(s: GameState): string {
  const p = s.players[1];
  const ids: CardId[] = [
    ...p.deck.map((h) => h.id),
    ...p.discard.map((h) => h.id),
    ...p.hand.map((h) => h.id),
    ...s.units
      .filter((u) => u.side === 1 && u.sortieCard)
      .map((u) => u.sortieCard!.id),
  ];
  const count = (id: CardId) => ids.filter((x) => x === id).length;
  const has = (id: CardId) => count(id) > 0;
  const countAny = (list: CardId[]) =>
    list.reduce((n, id) => n + count(id), 0);
  // v120: 干扰封锁流 — 3 张以上干扰/电子战牌即判定为 lockdown
  if (
    countAny([
      'signal_jam',
      'cyber_suppression',
      'jam',
      'sensor_blind',
      'logistics_strike',
      'ewarfare',
      'freq_hop',
    ]) >= 3
  )
    return 'lockdown';
  // v120: 透支快攻流 — 透支/强行军/紧急征发等爆发经济牌 ≥2
  if (
    countAny(['overdraft', 'forced_march', 'emergency_levy', 'command_lockdown']) >=
    2
  )
    return 'blitz';
  if (
    (has('artillery') || has('mortar_carrier')) &&
    (has('scouts') || has('recon'))
  )
    return 'fire_support';
  if (countAny(['air_assault', 'strike_jet', 'paratroopers']) >= 2)
    return 'air_mobile';
  if (
    countAny(['assault', 'commandos', 'marines', 'rangers']) >= 2 &&
    has('smoke')
  )
    return 'assault';
  if (countAny(['reserve_mobilization', 'smoke_withdrawal']) >= 2)
    return 'counterattack';
  return 'combined';
}

function updateAI(s: GameState) {
  const p = s.players[1];
  const own = s.units.filter((u) => u.side === 1 && isCombatant(u));
  // Every enemy-dependent branch below uses this visible set, never hidden units
  // or the opposing player's hand, energy, or deck.
  const foes = s.units.filter(
    (u) => u.side === 0 && isCombatant(u) && visibleToSide(s, 1, u),
  );
  const groundFoes = foes.filter((u) => !CARDS[u.id].air);
  const armor = groundFoes.filter(
    (u) => CARDS[u.id].armored || CARDS[u.id].vehicle,
  );
  const air = foes.filter((u) => CARDS[u.id].air);
  const foot = groundFoes.filter((u) => CARDS[u.id].members);
  const knownEnemyBattery = groundFoes.some(v => weaponCard(v).indirect) ||
    s.batteryReports.some(r => r.side === 1 && r.life > 3);
  const groups = (list: Unit[]) => new Set(list.map((u) => u.squad)).size;
  const fighters = own.filter(
    (u) => !CARDS[u.id].observer && u.id !== 'scouts' && u.tactic !== 'retreat',
  );
  const cohorts = groups(
    fighters.filter(
      (u) =>
        !CARDS[u.id].air &&
        !CARDS[u.id].heal &&
        !CARDS[u.id].airOnly &&
        !CARDS[u.id].armorOnly &&
        !['engineers', 'supply_team'].includes(u.id),
    ),
  );
  const armedAir = air.filter((u) => !CARDS[u.id].observer);
  // A screen, a launcher still marching, and a weapon that can win this match-up
  // are different commitments. Count actual operators, health and time to contact.
  const counterPower = (id: CardId, role: 'armor' | 'air') => {
    const c = CARDS[id];
    if (c.type !== 'unit') return 0;
    if (role === 'air')
      return !c.antiAir
        ? 0
        : c.airOnly && c.guided
          ? 1
          : c.guided
            ? 0.65
            : 0.25;
    if (c.airOnly) return 0;
    if (c.penetration) return 1;
    if ((c.armorMultiplier ?? 1) < 1.5) return 0;
    if (c.oneWay) return ((c.damage ?? 0) * (c.armorMultiplier ?? 1)) / 650;
    return c.guided && c.armorOnly ? 1 : c.guided ? 0.75 : 0.4;
  };
  // Mirrors synergy.isSpotterProvider: recon squads (scout trait) and dedicated
  // observer cards are spotters. Rangers carry the scout trait, so the director
  // must value them as recon assets — not double-buy observers alongside them.
  const observerCard = (id: CardId) =>
    CARDS[id].observer || CARDS[id].trait === 'scout';
  // The hybrid card keeps its marksman purchase score. Only its surviving
  // observer counts as an existing recon asset, not the rifleman's card id.
  const observerUnit = (u: Unit) => observerCard(u.id) || isPrecisionObserver(u);
  const canSupportContact = (u: Unit, target: Unit) => {
    const c = weaponCard(u),
      distance = Math.abs(target.x - u.x);
    if (
      u.rappelling ||
      u.squadOrder === 'retreat' ||
      (c.members && (u.personalMorale < 40 || u.hp < u.maxHp * 0.35))
    )
      return 0;
    if (distance >= (c.minRange ?? 0) && distance <= unitRange(s, u))
      return firingHeight(s, u, target.x, target.y - bodyHeight(target)) !==
        null
        ? 1
        : 0;
    if (
      distance < (c.minRange ?? 0) ||
      u.x <= target.x ||
      (c.static && u.emplaced)
    )
      return 0;
    const speed = c.emplacement ? 28 : (c.speed ?? 0) * (c.members ? 0.8 : 1);
    // Six seconds of travel is only a partial commitment, never complete cover.
    return speed > 0 && distance - unitRange(s, u) <= speed * 6 ? 0.25 : 0;
  };
  const coverage = (role: 'armor' | 'air', targets: Unit[]) =>
    fighters.reduce((sum, u) => {
      const weapon = weaponCard(u);
      const armed =
        role === 'air'
          ? weapon.antiAir
          : !weapon.airOnly &&
            ((weapon.armorMultiplier ?? 1) >= 1.5 || weapon.penetration);
      if (!armed) return sum;
      const support = targets.reduce(
        (best, target) => Math.max(best, canSupportContact(u, target)),
        0,
      );
      return (
        sum +
        (counterPower(u.id, role) * Math.min(1, u.hp / u.maxHp) * support) /
          (weapon.members ?? 1)
      );
    }, 0);
  const antitank = coverage('armor', armor),
    antiair = coverage('air', armedAir);
  const armorNeed = armor.reduce((n, u) => n + Math.max(0.2, u.hp / 650), 0);
  const airNeed = armedAir.reduce((n, u) => n + Math.max(0.1, u.hp / 260), 0);
  const urgentArmor = armorNeed > antitank + 0.05,
    urgentAir = airNeed > antiair + 0.05;
  const lineInfantry = (id: CardId) => {
    const c = CARDS[id];
    return (
      !!c.members &&
      !c.indirect &&
      !c.airOnly &&
      !c.heal &&
      !['scouts', 'engineers', 'supply_team'].includes(id) &&
      ((c.damage ?? 0) >= 12 || modelOf(id) === 'machinegun') &&
      (c.armorMultiplier ?? 1) < 1.5
    );
  };
  // A lone survivor is not a complete screen, even after it absorbs stragglers.
  const screens = fighters
    .filter((u) => lineInfantry(u.id))
    .reduce((n, u) => n + u.hp / CARDS[u.id].hp!, 0);
  const opposingScreen = foot.reduce((n, u) => n + u.hp / CARDS[u.id].hp!, 0);
  const requiredScreens = Math.max(2.4, Math.min(5, opposingScreen * 1.05));
  const screenNeed = screens < requiredScreens;
  const pressure = (list: Unit[]) =>
    list.reduce((n, u) => n + 0.4 + Math.max(0, (u.x - (W - 1800)) / 1800), 0);
  const armorPressure = pressure(armor) / Math.max(1, antitank),
    airPressure = pressure(armedAir) / Math.max(1, antiair);
  const emergency = groundFoes.some((u) => u.x > W - 650);
  const battle = foes.some((v) =>
    fighters.some((u) => Math.abs(v.x - u.x) < 850),
  );
  const patients = s.units.filter(
    (u) =>
      u.side === 1 &&
      canTakeDamage(u) &&
      CARDS[u.id].members &&
      (u.wounded || u.maxHp - u.hp >= 5),
  );
  const armorDamage = own
    .filter((u) => CARDS[u.id].armored)
    .reduce((n, u) => n + u.maxHp - u.hp, 0);
  const moraleNeed = own.filter(
    (u) =>
      CARDS[u.id].members && (u.personalMorale < 45 || u.tactic === 'retreat'),
  ).length;
  const front = fighters
    .filter((u) => !CARDS[u.id].air)
    .reduce((x, u) => Math.min(x, u.x), W - 112);
  const unclearedFront = (s.groundContacts?.[1] ?? [])
    .filter(c => !contactIsStale(s.time,c) && !visibleToSide(s,1,c) && c.clearSince === undefined &&
      front-c.x >= -120 && front-c.x < 800)
    .sort((a,b) => Math.abs(front-a.x)-Math.abs(front-b.x))[0];

  // v79: enemy blood on the ground is proof of contact in that sector — the
  // player is hauling wounded, so the line there is shifting. The director
  // screens an advance through the sector with smoke and values recon while
  // the trace is fresh. Only enemy-side intel (side 0) counts; the AI never
  // reacts to its own casualties' blood.
  const trace = s.traceIntel[1];
  const enemyTrace =
    trace && trace.side === 0 && trace.until > s.time ? trace : undefined;

  if (!s.aiArchetype) s.aiArchetype = inferArchetype(s);
  const archetype = s.aiArchetype;
  const pushing = s.time < (s.aiPushUntil ?? 0);
  // v88: smoke-assault follow-through window. After screening the contact
  // line, the AI reserves energy for assault reinforcements and fire support
  // until the shock troops have crossed the blinded gap.
  const smokeAssault = s.time < (s.aiSmokeAssaultUntil ?? 0);
  // Match tempo shifts: build economy and a screen early, combine arms against
  // the player's visible force mix mid-game, then spend out in the endgame.
  const phase: 'early' | 'mid' | 'late' =
    s.time < 90 ? 'early' : s.time < 300 ? 'mid' : 'late';
  s.aiPhase = phase;
  // The profile only counts units the AI can actually see through the fog.
  s.aiProfile = {
    air: air.length,
    armor: armor.length,
    foot: foot.length,
    turtle: foot.filter((u) => !u.moving).length,
  };
  // Enemy tendency memory: visible counts pull the estimate in fast (2s half
  // life), a quiet front fades it slowly (45s). The AI thus keeps
  // counter-reserves against the player's deck build — a helicopter fleet or
  // tank company it saw minutes ago — instead of forgetting the moment they
  // leave the fog. Only ever folded from the visible set above.
  {
    const mem =
      s.aiEnemyProfile ??
      (s.aiEnemyProfile = {
        air: 0,
        armor: 0,
        foot: 0,
        indirect: 0,
        at: s.time,
      });
    const dt = Math.max(0, s.time - mem.at);
    const track = (
      key: 'air' | 'armor' | 'foot' | 'indirect',
      seen: number,
    ) => {
      const halfLife = seen > 0 ? 2 : 45;
      mem[key] += (seen - mem[key]) * (1 - Math.pow(0.5, dt / halfLife));
    };
    track('air', armedAir.length);
    track('armor', armor.length);
    track('foot', foot.length);
    track(
      'indirect',
      groundFoes.filter((u) => weaponCard(u).indirect).length,
    );
    mem.at = s.time;
  }
  const memArmor = s.aiEnemyProfile.armor,
    memAir = s.aiEnemyProfile.air;

  // Stage a short opening/rebuilding wave by squad, not individual soldier.
  if (!cohorts) s.aiWaveUntil = s.time + 10;
  const staging =
    !emergency &&
    !foes.length &&
    !battle &&
    cohorts < 2 &&
    s.time < (s.aiWaveUntil ?? 0);
  // A quiet front: no visible foe and no fresh remembered contact. Once the
  // enemy is wiped (or every contact has gone stale), survivors must push to
  // the enemy base instead of staging forever — a lone surviving squad (e.g.
  // scouts, who don't count as a cohort) otherwise refreshes the staging
  // window every frame and holds until the 600s draw.
  const rememberedThreat = (s.groundContacts?.[1] ?? []).some(
    (c) => !contactIsStale(s.time, c) && !visibleToSide(s, 1, c),
  );
  const frontQuiet = foes.length === 0 && !rememberedThreat;
  // Armor assault: when the AI has an active armor_assault synergy (armored
  // vehicle + infantry within 170px) and contact is made, push the advantage
  // instead of settling into a static firefight.
  const armorAssault =
    battle &&
    !emergency &&
    own.some(
      (v) =>
        CARDS[v.id].vehicle === true &&
        CARDS[v.id].armored === true &&
        !CARDS[v.id].air,
    ) &&
    own.some(
      (v) =>
        (CARDS[v.id].members ?? 0) > 0 &&
        !CARDS[v.id].indirect &&
        unitSynergy(s, v, s.time).armor_assault,
    );
  // Double-time only between contacts. Once a threat is close, normal advance
  // gives each squad its own firing/cover decisions instead of a global rush.
  p.order = staging && !frontQuiet
    ? 'hold'
    : frontQuiet || (!battle && cohorts >= 2) ||
        (pushing && battle && !emergency) ||
        armorAssault
      ? 'rush'
      : 'advance';
  // Keep newly deployed reinforcements mobile; local cover orders defend the line.
  commandAiSquads(s, own, foes, staging);

  const options = p.hand
    .filter((h) => cardReadyIn(s, h) <= 0)
    .map((h) => {
      const c = CARDS[h.id],
        model = modelOf(h.id);
      let score = -100,
        x: number | undefined;
      if (c.type === 'unit') {
        score = 6 + (cohorts < 2 ? 4 : 0);
        const counterArmor =
          !c.airOnly && ((c.armorMultiplier ?? 1) >= 1.5 || !!c.penetration);
        if (counterArmor)
          score += armor.length
            ? urgentArmor
              ? 19
              : -2
            : memArmor >= 0.6
              ? 4
              : 0;
        if (c.antiAir)
          score += armedAir.length
            ? urgentAir
              ? 19
              : -2
            : memAir >= 0.6
              ? 4
              : 0;
        // AA umbrella: anti-air keeps fire-support crews steady under air threat.
        if (c.antiAir && armedAir.length) {
          const ownFireSupport = own.some(
            (u) =>
              !CARDS[u.id].air &&
              (weaponCard(u).indirect || (weaponCard(u).range ?? 0) >= 700),
          );
          if (ownFireSupport) score += 6;
        }
        if (lineInfantry(c.id))
          score += screens < 1.5 ? 27 : screenNeed ? 20 : 5;
        if (c.members && counterArmor && !armor.length && screens === 0)
          score -= 3;
        if (c.airOnly && !air.length) {
          const covered = own.some(
            (v) => counterPower(v.id, 'air') >= 0.8 && v.hp >= v.maxHp * 0.35,
          );
          score = screens >= 1.5 && !covered ? (c.patrolTime ? 12 : 14) : -100;
        }
        if (observerCard(c.id)) {
          const needsSpotter = own.some(
            (u) =>
              !CARDS[u.id].air &&
              (weaponCard(u).indirect ||
                (weaponCard(u).range ?? 0) >= 700 ||
                modelOf(u.id) === 'sniper'),
          );
          score = own.some((u) => observerUnit(u))
            ? -100
            : needsSpotter || unclearedFront
              ? 34
              : screens >= 1
                ? 19
                : 1;
        }
        if (c.heal)
          score =
            patients.length >= 2 && screens >= 1
              ? 26
              : patients.length
                ? 12
                : screens >= 2
                  ? 4
                  : 0;
        // Suppression assault: machine guns pin targets so assault troops close in.
        const hasAssault =
          own.some(
            (u) => CARDS[u.id].trait === 'close_assault' && isCombatant(u),
          ) || p.hand.some((h) => CARDS[h.id].trait === 'close_assault');
        const hasSpotter = own.some(
          (u) => observerUnit(u) && isCombatant(u),
        );
        const hasEngineer = own.some(
          (u) => CARDS[u.id].trait === 'engineer' && isCombatant(u),
        );
        // Massed infantry is only worth suppressing when assault troops can
        // exploit the pin, and indirect fire only lands tightly with a spotter.
        if (
          foot.length >= 4 &&
          ((model === 'machinegun' && hasAssault) ||
            (c.indirect && hasSpotter))
        )
          score += 6;
        // Forward observer: indirect fire is faster and tighter with a spotter.
        if (c.indirect && hasSpotter) score += 5;
        // Mobile tubes trade a denser infantry mortar salvo for the ability
        // to leave their launch position. Value that trade only against
        // observed artillery or our own still-fresh sound-ranging reports.
        if (c.id === 'mortar_carrier' && knownEnemyBattery) score += 7;
        if (c.id === 'mortar' && !knownEnemyBattery && foot.length >= 4) score += 4;
        score += tankPurchaseBonus(c.id, groundFoes);
        if (c.id === 'assault_grenadiers' && groundFoes.some(grenadePriorityTarget)) score += 6;
        if (
          c.indirect &&
          own.some((u) => weaponCard(u).antiAir && isCombatant(u))
        )
          score += 3;
        if (model === 'machinegun' && hasAssault && foot.length >= 2)
          score += 7;
        if (c.id === 'heavy_mg') {
          // Prepared guns cover a visible concentration, not a missing screen.
          score += foot.length >= 6 && screens >= 1.5 && !emergency ? 11 : -3;
        }
        if (c.id === 'lmg_team' && hasAssault && own.some(u => u.moving && CARDS[u.id].members))
          score += 9;
        if (c.id === 'machinegun' && screens < 1.5) score += 6;
        if (model === 'sniper' && foot.length && !observerCard(c.id))
          score += 3;
        if (c.id === 'sniper_team' && foot.some(v =>
            ['machinegun', 'mortar', 'rocket'].includes(weaponCard(v).model ?? modelOf(v.id))))
          score += 8;
        // Recon + marksman: scouts designate targets for snipers.
        if (model === 'sniper' && hasSpotter) score += 5;
        // Overwatch: a halted sniper covering a massed infantry advance lets
        // those squads shed suppression faster under fire.
        if (model === 'sniper' && !observerCard(c.id) && foot.length >= 4)
          score += 2;
        // Spotter on the field makes precision howitzers and guided AT teams
        // significantly deadlier — the AI values them more accordingly.
        if (c.id === 'precision' && hasSpotter) score += 5;
        if (c.guided && c.armorOnly && hasSpotter) score += 4;
        // Engineer + breach: assault troops exploit gaps opened by engineers.
        if (c.trait === 'close_assault' && hasEngineer) score += 5;
        if (c.trait === 'engineer') {
          const wallAhead = Object.values(s.knownWalls[1]).some(
            (w) => w.hp > 0 && Math.abs(w.x - front) < 500,
          );
          score = hasAssault && wallAhead ? 24 : wallAhead ? 12 : score;
        }
        // v132: 维修工兵——己方有受损装甲时才值得带
        if (c.trait === 'mechanic') {
          const damagedArmor = own.some(
            (v) =>
              isCombatant(v) &&
              CARDS[v.id].armored &&
              !CARDS[v.id].air &&
              !CARDS[v.id].vehicleSupport &&
              v.hp < v.maxHp * 0.85,
          );
          score = damagedArmor ? (armorDamage >= 120 ? 20 : 12) : -100;
        }
        if (c.deployDraw && p.hand.length <= 4) score += 3;
        // Supply run: a supply team keeps the AI's heavy weapon teams fed.
        if (c.id === 'supply_team') {
          const weaponTeams = own.filter(
            (u) => isWeaponTeamId(u.id) && isCombatant(u),
          );
          if (weaponTeams.length)
            score += 4 + Math.min(4, weaponTeams.length);
        }
        if (c.armored && !c.airOnly && cohorts >= 1) score += 3;
        if (c.id === 'pickup') score += foot.length >= 4 ? 8 : 0;
        if (c.vehicleSupport === 'repair')
          score = own.some(
            (u) => CARDS[u.id].armored && !CARDS[u.id].vehicleSupport,
          )
            ? armorDamage >= 100
              ? 19
              : 7
            : -100;
        if (c.vehicleSupport === 'command')
          score = screens >= requiredScreens ? 15 : screens >= 2 ? 5 : 1;
        if (c.vehicleSupport === 'mine_clear')
          score =
            own.some((u) => CARDS[u.id].armored) &&
            Object.values(s.knownWalls[1]).some(
              (w) => w.hp > 0 && Math.abs(w.x - front) < 450,
            )
              ? 15
              : cohorts >= 2
                ? 5
                : -100;
        if (c.sortie && !c.patrolTime && !foes.length) score = -100;
        if (c.id === 'fpv_drone')
          score += armor.length ? 10 : foot.length ? -2 : -8;
        if (c.id === 'loiter_drone')
          score = groundFoes.some(v => CARDS[v.id].emplacement)
            ? 22 : armor.length ? 14 : -100;
        if (c.airlift) {
          x = safeLanding(s, defaultLanding(s, 1));
          score = cohorts >= 2 && groundFoes.length ? 18 : -2;
        }
        if (c.airdrop) {
          const enemyFront = groundFoes.length
            ? Math.min(...groundFoes.map((u) => u.x))
            : defaultLanding(s, 1);
          // Red advances left. A guide must land to the RIGHT of the nearest
          // known enemy, not between two contacts spread across the front.
          const guideFront = groundFoes.length ? Math.max(...groundFoes.map(u => u.x)) : enemyFront;
          const friendlyInsertion = c.id === 'rapid_insertion' || c.id === 'recon_jump';
          x = friendlyInsertion
            ? groundFoes.length
              ? friendlyDropPosition(s,1,groundFoes,c.id==='rapid_insertion'?260:560) ?? undefined
              : c.id==='recon_jump' && cohorts>=2 ? safeLanding(s,front-300) : undefined
            : safeLanding(s, c.id === 'pathfinders' ? guideFront + 300 : enemyFront - 140);
          score = cohorts >= 2 && groundFoes.length ? 17 : -2;
          if (c.id==='rapid_insertion' && emergency && x!==undefined) score = 36;
          if (c.id !== 'pathfinders' && !c.insertion) {
            const guide = own.filter(u => pathfinderReady(s, u) &&
              x!==undefined && Math.abs(u.x - x) <= 500 &&
              (!friendlyInsertion || groundFoes.every(v=>u.x-v.x>=160)) &&
              groundFoes.every(v => Math.abs(v.x - u.x) >= 160))
              .sort((a, b) => Math.abs(a.x - x!) - Math.abs(b.x - x!))[0];
            if (guide) {
              const guided = safeLanding(s, guide.x);
              if (!friendlyInsertion || (groundFoes.every(v=>guided-v.x>=160) && landingFootprintClear(s,guided))) {
                x = guided; score += 5;
              }
            }
          } else if (c.id==='pathfinders' && p.hand.some(h => h.id !== c.id && CARDS[h.id].airdrop)) {
            score += own.some(u => u.id === 'pathfinders') ? -6 : 6;
          }
          if(c.insertion==='glider'){
            const lz=gliderLanding(s,x!,1);
            if(lz===null)score=-100;
            else {x=lz;score-=foes.filter(v=>weaponCard(v).antiAir&&v.x>x!-500).length*9;}
          }
        }
        // v120: airborne AT hunts armour from the drop zone; rapid insertion
        // plugs a collapsing sector; recon jump fills a missing spotter.
        if (c.id === 'airborne_at' && armor.length) score += 8;
        if (c.id === 'rapid_insertion' && emergency) score += 6;
        if (c.id === 'recon_jump' && !own.some((u) => observerUnit(u)))
          score += 5;
        if (c.air && !c.observer && !c.airOnly) {
          const enemyAA = groups(foes.filter((u) => weaponCard(u).antiAir));
          score +=
            (c.attackRun === 'strafe' || c.attackRun === 'bomb') &&
            foot.length >= 6
              ? 12
              : 0;
          score -= Math.min(12, enemyAA * 5);
        }
        if (c.emplacement) {
          const position = emplacementPosition(s, 1, c.id);
          const valid = foes.some(
            (v) =>
              (!CARDS[v.id].air || c.antiAir) &&
              (!c.airOnly || CARDS[v.id].air) &&
              Math.abs(v.x - position) >= (c.minRange ?? 0) &&
              Math.abs(v.x - position) <= c.range!,
          );
          // Evaluate the position a guarded gun can actually reach on foot.
          if (!valid) score = -100;
          // v88: during a smoke assault, heavy howitzers shell the blinded
          // line so shock troops close the gap against a suppressed enemy.
          if (valid && smokeAssault && c.id === 'barrage') score += 14;
        }
        // Expensive support cannot substitute for the infantry that must protect it.
        // Heavy anti-tank ammunition has no useful target in an infantry-only contact.
        if (c.armorOnly && !armor.length)
          score =
            screens >= 1.5 &&
            !own.some((u) => counterPower(u.id, 'armor') >= 0.8)
              ? 16
              : -100;
        if ((c.indirect || c.vehicleSupport) && screens < 1.5) score = -100;
        // Counter-battery: a fresh sound-ranging fix on an enemy gun is the
        // natural job of howitzers. It overrides the "no visible target" and
        // "no screen" penalties above — the gun fights blind, off map data.
        if (c.id === 'artillery' || c.id === 'precision') {
          const fix = s.batteryReports
            .filter((r) => r.side === 1 && r.life > 3)
            .sort((a, b) => b.hits - a.hits || b.life - a.life)[0];
          if (fix) {
            const position = emplacementPosition(s, 1, c.id);
            const inRange =
              Math.abs(fix.x - position) >= (c.minRange ?? 0) &&
              Math.abs(fix.x - position) <= c.range!;
            if (inRange) {
              x = fix.x;
              score = fix.hits >= 3 ? 26 : 20;
            }
          }
        }
        // Avoid continuously buying a specialised role already covered by own units.
        score -= Math.min(6, groups(own.filter((u) => u.id === c.id)) * 2);
      } else if (c.economy) {
        const peaceful =
          !battle && !emergency && !armor.length && !armedAir.length;
        if (peaceful && !economyBlock(p, c.economy, s.time)) {
          if (
            c.economy === 'logistics' &&
            screens >= 2 &&
            s.time < DURATION - 150 &&
            p.energy >= cardCost(h) + 2
          )
            score = 21;
          if (
            c.economy === 'capacity' &&
            screens >= 1 &&
            p.energy >= energyLimit(p) - 1
          )
            score = 20;
          if (
            c.economy === 'bonds' &&
            s.time + ECONOMY_RULES.bondDelay < DURATION &&
            p.energy >= cardCost(h) + 1 &&
            (screens >= 1 || s.time < 12)
          )
            score = screens >= 1 ? 18 : 5;
          if (
            c.economy === 'overdraft' &&
            s.time < DURATION - 60 &&
            p.hand.length >= 2
          )
            score = archetype === 'assault' ? 20 : 13;
          if (
            c.economy === 'production' &&
            s.time < DURATION - 120 &&
            p.energy >= cardCost(h)
          )
            // The surge pays for itself only with runway left; holding a
            // high-cost card makes the immediate payout more valuable.
            score = p.hand.some((h2) => cardCost(h2) >= 4) ? 19 : 15;
          if (c.economy === 'forward_hq' && s.time < DURATION - 180)
            // Permanent recharge upgrade — strictly better the earlier it lands.
            // economyBlock already guarantees p.forwardHq is unset.
            score = s.time < 120 ? 18 : s.time < 300 ? 14 : 8;
        }
        // v120: emergency levy is a battle-tempo card, not a peace-time
        // investment — it pays out immediately so the AI can chain a second
        // unit into a live contact.
        if (
          c.economy === 'levy' &&
          (battle || pushing) &&
          (p.levyUntil ?? 0) < s.time
        )
          score = archetype === 'assault' ? 18 : 12;
      } else if (c.id === 'antitank_mine') {
        x = armor
          .flatMap((v) => [v.x + 120, v.x + 220, v.x + 320])
          .filter((a) => a >= 100 && a <= W - 120)
          .find(
            (a) =>
              armor.every((v) => Math.abs(v.x - a) >= 85) &&
              !s.mines.some((m) => m.side === 1 && Math.abs(m.x - a) < 90),
          );
        score = x === undefined ? -100 : urgentArmor ? 18 : 7;
      } else if (c.id === 'smoke') {
        const needsCover = own.some(
          (u) =>
            CARDS[u.id].members &&
            (u.tactic === 'retreat' || u.hp < u.maxHp * 0.5),
        );
        const assault = fighters.find(
          (u) =>
            CARDS[u.id].members &&
            CARDS[u.id].trait === 'close_assault' &&
            groundFoes.some((v) => Math.abs(v.x - u.x) < 500),
        );
        if (battle && needsCover) {
          x = Math.max(100, Math.min(W - 100, front - 90));
          score = 22;
        } else if (battle && assault) {
          x = Math.max(100, assault.x - 110);
          score = 19;
        } else if (enemyTrace) {
          // v79: screen the push through the contact sector — the blood
          // trail says the player's line there is busy hauling wounded.
          x = Math.max(100, Math.min(W - 100, enemyTrace.x + 140));
          score = battle ? 16 : 12;
        }
        if (
          x !== undefined &&
          s.smokes.some(
            (m) => m.side === 1 && m.life > 2 && Math.abs(m.x - x!) < 160,
          )
        )
          score = -100;
      } else if (c.id === 'recon') {
        if (p.recon <= 0 && cohorts && unclearedFront) score = 23;
        else if (p.recon <= 0 && cohorts && (battle || front < W - 900))
          score = fighters.some((u) => (CARDS[u.id].range ?? 0) >= 650)
            ? 19
            : 9;
        else if (p.recon <= 0 && enemyTrace && cohorts) score = 8;
      } else if (c.id === 'repair') {
        if (
          armorDamage > 80 &&
          own.some((u) => CARDS[u.id].armored && u.repairTime <= 0)
        )
          score = 20 + Math.min(6, armorDamage / 50);
      } else if (c.comeback) {
        score = comebackScore(s, 1, c.comeback, own, foes);
      } else if (c.id === 'morale') {
        if (battle && cohorts >= 2 && p.morale <= 0) score = 22;
      } else if (c.id === 'supply' || c.effect === 'ammo') {
        if (p.deck.length > 0) score = 25;
      } else if (c.effect === 'rally') {
        if (moraleNeed >= 2) score = 26;
      } else if (c.effect === 'medevac') {
        if (patients.some((u) => u.wounded) || patients.length >= 2)
          score =
            22 + Math.min(6, patients.filter((u) => u.wounded).length * 2);
      } else if (c.effect === 'fortify') {
        if (
          battle &&
          own.filter((u) => CARDS[u.id].members && !u.moving).length >= 3 &&
          p.fortify <= 0
        )
          score = 20;
      } else if (c.id === 'artillery' || c.id === 'precision') {
        // Counter-battery is these cards' natural job: a fresh sound-ranging
        // fix on an enemy gun is the highest-value target on the map.
        const fix = s.batteryReports
          .filter((r) => r.side === 1 && r.life > 3)
          .sort((a, b) => b.hits - a.hits || b.life - a.life)[0];
        if (fix) {
          x = fix.x;
          score = fix.hits >= 3 ? 26 : 20;
        } else {
          // No fix: fall back to a visible armour concentration or a
          // sizeable infantry cluster, whichever the sheaf covers best.
          const armorCluster = armor
            .map((v) => ({
              x: v.x,
              n: armor.filter((a) => Math.abs(a.x - v.x) < 150).length,
            }))
            .sort((a, b) => b.n - a.n)[0];
          const blob = groundFoes
            .map((v) => ({
              x: v.x,
              n: groundFoes.filter((a) => Math.abs(a.x - v.x) < 130).length,
            }))
            .sort((a, b) => b.n - a.n)[0];
          if (armorCluster && armorCluster.n >= 2) {
            x = armorCluster.x;
            score = 16;
          } else if (blob && blob.n >= 4) {
            x = blob.x;
            score = 12;
          }
        }
      } else if (c.effect === 'sabotage') {
        if (battle && foes.some((u) => u.cooldown < 1.2))
          score = foes.some(
            (u) => CARDS[u.id].penetration || CARDS[u.id].indirect,
          )
            ? 24
            : foes.length >= 4
              ? 19
              : 8;
      } else if (c.effect === 'emp') {
        if (battle && foes.some((u) => CARDS[u.id].air || weaponCard(u).guided))
          score = 25;
      } else if (c.id === 'jam') {
        if (battle && cohorts >= 2 && s.players[0].jam <= 0) score = 8;
      } else if (c.effect === 'signal_jam') {
        if (battle && cohorts >= 2 && s.players[0].jam <= 0) score = 11;
      } else if (c.effect === 'forced_march') {
        if (battle && own.filter((u) => CARDS[u.id].members).length >= 3)
          score = groundFoes.length ? 15 : 8;
      } else if (c.effect === 'cyber_suppression') {
        if (battle && s.players[0].energy >= 4) score = 16;
      }
      // v119: the v108 effect/economy cards had no scoring branches, so the
      // director never played them. Each branch mirrors the closest existing
      // pattern and checks the matching state field so the same buff is not
      // re-cast while still active.
      else if (c.effect === 'forage') {
        if (p.hand.length <= MAX_HAND - 1) score = 25;
      } else if (c.effect === 'blitz') {
        if (
          (p.blitzUntil ?? 0) < s.time &&
          own.some((u) => CARDS[u.id].members)
        ) {
          if (battle || pushing) score = archetype === 'assault' ? 19 : 14;
          else if (!emergency && cohorts >= 2) score = 8;
        }
      } else if (c.effect === 'blackout') {
        if (
          battle &&
          s.players[0].energy >= 4 &&
          (s.players[0].blackoutUntil ?? 0) < s.time
        )
          score = 15;
      } else if (c.effect === 'interdict') {
        if (battle && s.players[0].energy >= 3 && (s.players[0].taxCards ?? 0) <= 0)
          score = 14;
      } else if (c.effect === 'spoof') {
        // Spoof is a cheap battle trick: worth it whenever enemy infantry is
        // in contact, not only against massed charges. The active-window
        // check below prevents re-casting the same debuff back-to-back.
        if (battle && foot.length >= 1 && (s.players[0].spoofUntil ?? 0) < s.time)
          score = 10;
      } else if (c.effect === 'radar_jam') {
        if ((armedAir.length || memAir >= 0.6) && (s.players[0].radarJamUntil ?? 0) < s.time)
          score = armedAir.length ? 18 : 10;
      } else if (c.effect === 'entrench') {
        if (
          battle &&
          own.filter((u) => CARDS[u.id].members).length >= 3 &&
          (p.entrenchUntil ?? 0) < s.time
        )
          score = emergency || armedAir.length ? 18 : 9;
      }
      // v120: new-school cards. Each branch mirrors the closest existing
      // pattern and checks the matching state field so the same effect is
      // not re-cast while still active.
      else if (c.id === 'creeping_barrage' || c.id === 'heavy_barrage') {
        // Counter-battery first, then a visible infantry cluster. The creeping
        // barrage walks its shells forward so it values a deeper blob; the
        // heavy barrage hits harder so it wants a tighter pack.
        const fix = s.batteryReports
          .filter((r) => r.side === 1 && r.life > 3)
          .sort((a, b) => b.hits - a.hits || b.life - a.life)[0];
        if (fix) {
          x = fix.x;
          score = fix.hits >= 3 ? 24 : 18;
        } else {
          const blob = groundFoes
            .map((v) => ({
              x: v.x,
              n: groundFoes.filter((a) => Math.abs(a.x - v.x) < 140).length,
            }))
            .sort((a, b) => b.n - a.n)[0];
          if (blob && blob.n >= 4) {
            x = blob.x;
            score = c.id === 'heavy_barrage' ? 16 : 13;
          }
        }
      } else if (c.effect === 'lockout') {
        if (battle && cohorts >= 2 && (s.players[0].lockoutUntil ?? 0) < s.time)
          score = 12;
      } else if (c.effect === 'salvage') {
        if (
          p.hand.length <= MAX_HAND - 1 &&
          p.discard.some(
            (t) => CARDS[t.id].type === 'unit' && cardCost(t) <= 3,
          )
        )
          score = 22;
      } else if (c.effect === 'shock') {
        if (
          battle &&
          foot.length >= 3 &&
          (s.players[0].shockUntil ?? 0) < s.time
        )
          score = 14;
      } else if (c.effect === 'sensor_blind') {
        if (battle && (s.players[0].sensorBlindUntil ?? 0) < s.time)
          score = 10;
      } else if (c.effect === 'logistics_strike') {
        if (battle && s.players[0].energy >= 4) score = 14;
      } else if (c.effect === 'freq_hop') {
        if (battle && (p.freqHopUntil ?? 0) < s.time) score = 11;
      } else if (c.effect === 'ewarfare') {
        if (battle && (s.players[0].ewarfareUntil ?? 0) < s.time) score = 13;
      } else if (c.effect === 'smoke_screen') {
        const needsCover = own.some(
          (u) =>
            CARDS[u.id].members &&
            (u.tactic === 'retreat' || u.hp < u.maxHp * 0.5),
        );
        const assault = fighters.find(
          (u) =>
            CARDS[u.id].members &&
            CARDS[u.id].trait === 'close_assault' &&
            groundFoes.some((v) => Math.abs(v.x - u.x) < 500),
        );
        if (battle && needsCover) {
          x = Math.max(100, Math.min(W - 100, front - 90));
          score = 22;
        } else if (battle && assault) {
          x = Math.max(100, assault.x - 110);
          score = 19;
        } else if (enemyTrace) {
          x = Math.max(100, Math.min(W - 100, enemyTrace.x + 140));
          score = battle ? 16 : 12;
        }
        if (
          x !== undefined &&
          s.smokes.some(
            (m) => m.side === 1 && m.life > 2 && Math.abs(m.x - x!) < 200,
          )
        )
          score = -100;
      } else if (c.effect === 'illumination') {
        if (unclearedFront && cohorts) { x = unclearedFront.x; score = 20; }
        else if (s.night && cohorts) score = 10;
      } else if (c.effect === 'minefield') {
        x = armor
          .flatMap((v) => [v.x + 120, v.x + 220, v.x + 320])
          .filter((a) => a >= 100 && a <= W - 120)
          .find(
            (a) =>
              armor.every((v) => Math.abs(v.x - a) >= 85) &&
              !s.mines.some((m) => m.side === 1 && Math.abs(m.x - a) < 90),
          );
        score = x === undefined ? -100 : urgentArmor ? 18 : 7;
      } else if (c.effect === 'fallback') {
        if (
          (emergency ||
            (pushing &&
              own.some(
                (u) =>
                  CARDS[u.id].members &&
                  (u.hp < u.maxHp * 0.4 || u.tactic === 'retreat'),
              ))) &&
          (p.fallbackUntil ?? 0) < s.time
        )
          score = 16;
      }
      // Archetype flavour: nudge the generic scoring toward the deck's plan.
      // Hard vetoes (-100) stay negative after a nudge, so this never revives
      // a card the situation forbids.
      if (archetype === 'assault') {
        if (c.trait === 'close_assault' || c.infantryAbility === 'smoke_assault')
          score += 4;
        // v120: 烟幕突击的新尖刀——掷弹兵、震慑、紧急征发、指挥静默
        if (
          c.id === 'assault_grenadiers' ||
          c.id === 'shock_action' ||
          c.id === 'emergency_levy' ||
          c.id === 'command_lockdown'
        )
          score += 4;
      } else if (archetype === 'fire_support') {
        if (observerCard(c.id)) score += 4;
        if (c.id === 'artillery' || c.id === 'precision') score += 6;
        if (c.id === 'fortify') score += 3;
        // v120: 炮兵流派的新弹药——徐进/重型弹幕是主力，照明与烟幕是辅助
        if (c.id === 'creeping_barrage' || c.id === 'heavy_barrage')
          score += 6;
        if (c.id === 'illumination_round' || c.id === 'smoke_cover')
          score += 4;
      } else if (archetype === 'air_mobile') {
        if (c.air && !c.observer) score += 3;
        // v120: 空降三件套——反甲、穿插、跳降侦察
        if (
          c.id === 'airborne_at' ||
          c.id === 'rapid_insertion' ||
          c.id === 'recon_jump'
        )
          score += 3;
      } else if (archetype === 'counterattack') {
        if (c.comeback) score += 4;
        // v120: 纵深反击的守备工具——雷场、医院、后撤
        if (c.id === 'minefield' || c.id === 'field_hospital' || c.id === 'fallback')
          score += 4;
      } else if (archetype === 'lockdown') {
        // v120: 电磁封锁——干扰即输出，跳频是内战保险
        if (
          c.id === 'sensor_blind' ||
          c.id === 'logistics_strike' ||
          c.id === 'ewarfare' ||
          c.id === 'command_lockdown'
        )
          score += 5;
        if (c.id === 'freq_hop') score += 3;
      } else if (archetype === 'blitz') {
        // v120: 透支快攻——爆发经济与封锁牌优先，廉价班组填线
        if (
          c.id === 'emergency_levy' ||
          c.id === 'command_lockdown' ||
          c.id === 'shock_action'
        )
          score += 5;
        if (c.id === 'fire_team' || c.id === 'battlefield_salvage')
          score += 4;
      }
      // v88: smoke-assault follow-through — while the screen blinds the enemy
      // line, assault troops are the highest-value reinforcement on the map.
      if (
        smokeAssault &&
        (c.trait === 'close_assault' || c.infantryAbility === 'smoke_assault')
      )
        score += 14;
      // Phase tempo: hard vetoes (-100) stay negative after a nudge, so this
      // never revives a card the situation forbids.
      // Opening tempo only steers quiet build-out; once a real clash is on,
      // the situational scoring above (morale, repair, rally, ...) must win.
      if (phase === 'early' && !battle && !emergency) {
        if (c.economy) score += 4;
        if (lineInfantry(h.id)) score += 3;
        if (cardCost(h) >= 4) score -= 4;
      } else if (phase === 'mid') {
        if ((c.armored || c.vehicle) && screens >= 2) score += 4;
        if (c.antiAir && (s.aiProfile?.air ?? 0) >= 2) score += 5;
        if (
          (c.armorMultiplier ?? 1) >= 1.5 ||
          (!!c.penetration && !c.airOnly)
        )
          score += (s.aiProfile?.armor ?? 0) >= 2 ? 5 : 0;
        if ((c.indirect || c.vehicleSupport) && (s.aiProfile?.turtle ?? 0) >= 3)
          score += 5;
      } else if (phase === 'late') {
        if (c.economy) score -= 10;
        if (c.comeback) score += 6;
        if (c.id === 'fortify') score += 4;
        if (cardCost(h) >= 4) score += 3;
      }
      if (c.targetGround && (x === undefined || !Number.isFinite(x)))
        score = -100;
      return {
        h,
        x,
        score: score - cardCost(h) * (lineInfantry(h.id) ? 0.9 : 0.05),
      };
    })
    .filter((v) => v.score > 0)
    .sort((a, b) => b.score - a.score || a.h.uid - b.h.uid);

  const armorRole = (id: CardId) => {
    const c = CARDS[id];
    return (
      c.type === 'unit' &&
      !c.airOnly &&
      ((c.armorMultiplier ?? 1) >= 1.5 || !!c.penetration)
    );
  };
  const airRole = (id: CardId) =>
    CARDS[id].type === 'unit' && !!CARDS[id].antiAir;
  const healthyRole = (role: (id: CardId) => boolean) =>
    fighters.some(
      (u) =>
        role(u.id) &&
        Math.max(counterPower(u.id, 'armor'), counterPower(u.id, 'air')) >=
          0.8 &&
        u.hp >= u.maxHp * 0.35 &&
        (!CARDS[u.id].members || u.personalMorale >= 40),
    );
  if (armor.length) s.aiArmorSeenUntil = s.time + 15;
  if (armedAir.length) s.aiAirSeenUntil = s.time + 15;
  const seekArmor =
    (armor.length > 0 && urgentArmor) ||
    (!armor.length &&
      (s.time < (s.aiArmorSeenUntil ?? 0) || memArmor >= 0.6) &&
      !healthyRole(armorRole));
  const seekAir =
    (armedAir.length > 0 && urgentAir) ||
    (!armedAir.length &&
      (s.time < (s.aiAirSeenUntil ?? 0) || memAir >= 0.6) &&
      !healthyRole(airRole));

  if (seekArmor || seekAir) {
    // A real launcher already committed still needs eyes and a surviving screen.
    // This is support for that deployment, not fictitious coverage at the HQ:
    // only an affordable card can delay the next counter, never an empty promise.
    const committed = (role: 'armor' | 'air') =>
      own.some(
        (u) =>
          counterPower(u.id, role) >= 0.8 &&
          u.hp >= u.maxHp * 0.35 &&
          u.tactic !== 'retreat' &&
          u.squadOrder !== 'retreat' &&
          (!CARDS[u.id].members || u.personalMorale >= 40),
      );
    if ((!seekArmor || committed('armor')) && (!seekAir || committed('air'))) {
      const support = options.find(
        (o) =>
          cardCost(o.h) <= p.energy + 1e-6 &&
          ((screens < 1.5 && lineInfantry(o.h.id)) ||
            (seekArmor &&
              !own.some((u) => observerUnit(u)) &&
              observerCard(o.h.id))),
      );
      if (support && playCard(s, 1, support.h.uid, support.x).ok) return;
    }
    // A ready counter already in hand is more reliable than buying another draw.
    // Unlike ordinary scoring, short-lived lost sight does not disqualify a MANPADS
    // card held in reserve. Mines still require the already-computed legal target.
    const counterChoices = p.hand
      .filter((h) => cardReadyIn(s, h) <= 0)
      .flatMap((h) => {
        const targetOption = options.find(o=>o.h.uid===h.uid);
        if (
          ((seekArmor && armorRole(h.id)) || (seekAir && airRole(h.id))) &&
          (!CARDS[h.id].emplacement || targetOption) &&
          (!CARDS[h.id].targetGround || targetOption?.x !== undefined)
        )
          return [{ h, x: CARDS[h.id].targetGround ? targetOption!.x : undefined }];
        const mine =
          seekArmor && h.id === 'antitank_mine'
            ? options.find((o) => o.h.uid === h.uid)
            : undefined;
        return mine ? [{ h, x: mine.x }] : [];
      })
      .sort((a, b) => {
        const importance = (choice: typeof a) =>
          Math.max(
            seekArmor &&
              (armorRole(choice.h.id) || choice.h.id === 'antitank_mine')
              ? armorPressure
              : 0,
            seekAir && airRole(choice.h.id) ? airPressure : 0,
          );
        const quality = (choice: typeof a) =>
          Math.max(
            seekArmor
              ? choice.h.id === 'antitank_mine'
                ? 0.45
                : counterPower(choice.h.id, 'armor')
              : 0,
            seekAir ? counterPower(choice.h.id, 'air') : 0,
          );
        const rolePreference = (choice: typeof a) =>
          cardCost(choice.h) <= p.energy ? tankPurchaseBonus(choice.h.id, groundFoes) : 0;
        return (
          importance(b) - importance(a) ||
          quality(b) - quality(a) ||
          // One scalar per option keeps this ordering transitive even when
          // tanks, cheaper launchers and unaffordable cards share the hand.
          rolePreference(b) - rolePreference(a) ||
          cardCost(a.h) - cardCost(b.h) ||
          a.h.uid - b.h.uid
        );
      });
    const requiredPower = (id: CardId) =>
      Math.max(
        seekArmor ? counterPower(id, 'armor') : 0,
        seekAir ? counterPower(id, 'air') : 0,
      );
    // Own remaining card identities are public deck-building information; never
    // inspect the opposing hand or use the shuffled draw order to choose a card.
    const strongInPool = p.deck.filter(
      (h) => requiredPower(h.id) >= 0.8,
    );
    const counter = counterChoices[0];
    const weakAlreadyDeployed =
      counter && own.some((u) => u.id === counter.h.id && isCombatant(u));
    if (
      counter &&
      (requiredPower(counter.h.id) >= 0.8 ||
        !weakAlreadyDeployed ||
        !strongInPool.length)
    ) {
      if (cardCost(counter.h) <= p.energy + 1e-6)
        playCard(s, 1, counter.h.uid, counter.x);
      return; // Save for the effective held counter before any command or rifle squad.
    }

    const canSearch = p.deck.length > 0;
    // Playing supply removes its own card first: five held cards still leave
    // room for both draws. Use this paid effect before the more expensive draw.
    const resupply =
      canSearch &&
      p.hand.length < MAX_HAND &&
      p.hand.find(
        (h) =>
          CARDS[h.id].id === 'supply' &&
          cardReadyIn(s, h) <= 0 &&
          cardCost(h) <= p.energy + 1e-6,
      );
    if (resupply && playCard(s, 1, resupply.uid).ok) return;
    if (canSearch && p.hand.length < MAX_HAND) {
      if (p.energy < DRAW_COST) return;
      if (requestDraw(s, 1).ok) return;
      // Keep both the paid draw and the cheapest useful launcher budget while
      // waiting on the shared draw cooldown, rather than repeatedly buying rifles.
      const deployBudget = strongInPool.length
        ? Math.min(...strongInPool.map(cardCost))
        : 2;
      const support = options.find(
        (o) => cardCost(o.h) <= p.energy - DRAW_COST - deployBudget + 1e-6,
      );
      if (support) playCard(s, 1, support.h.uid, support.x);
      return;
    }
    if (canSearch && p.hand.length >= MAX_HAND) {
      const release = p.hand
        .filter(
          (h) =>
            cardReadyIn(s, h) <= 0 &&
            !CARDS[h.id].targetGround &&
            (CARDS[h.id].type === 'unit' ||
              h.id === 'supply' ||
              CARDS[h.id].effect === 'ammo' ||
              options.some((o) => o.h.uid === h.uid)),
        )
        .map((h) => {
          const c = CARDS[h.id];
          // Supply/ammo/deployDraw replace cards using their real paid effects.
          // Otherwise deploy a cheap defender; no discard or replacement cheat.
          const searchCard =
            c.deployDraw || c.id === 'supply' || c.effect === 'ammo';
          return {
            h,
            rank:
              (c.id === 'supply' || c.effect === 'ammo'
                ? 4
                : options.some((o) => o.h.uid === h.uid)
                  ? c.type === 'unit'
                    ? 2
                    : 1
                  : c.type === 'unit'
                    ? 0.5
                    : 0) +
              (searchCard && c.deployDraw ? 0.5 : 0) -
              cardCost(h) * 0.75,
          };
        })
        .sort((a, b) => b.rank - a.rank || cardCost(a.h) - cardCost(b.h))[0];
      if (release && cardCost(release.h) <= p.energy + 1e-6)
        playCard(s, 1, release.h.uid);
      return;
    }
    // If no draw pool remains, ordinary affordable defence is still preferable
    // to waiting forever. Fall through to the existing choice logic.
  }

  // Proactive tactics: fight the next battle on the AI's terms, not just react.
  if (!emergency && (cohorts >= 2 || (cohorts >= 1 && unclearedFront))) {
    // Smoke-contact: blind the enemy line so shock troops can close the gap.
    const smokeX = Math.max(100, Math.min(W - 100, front - 170));
    const smokeCovered = s.smokes.some(
      (m) => m.side === 1 && m.life > 2 && Math.abs(m.x - smokeX) < 210,
    );
    const shockTroops = fighters.filter(
      (u) =>
        CARDS[u.id].trait === 'close_assault' ||
        CARDS[u.id].infantryAbility === 'smoke_assault',
    );
    const contactAhead = groundFoes.some(
      (v) => front - v.x > 160 && front - v.x < 950,
    );
    // Pinned screen: line infantry stalled under fire at the contact line.
    // Own smoke speeds their suppression recovery 1.5x (v53 synergy) while
    // blinding the guns pinning them, so a screen on the front breaks the
    // stalemate and the rush order carries the squads through to better ground.
    // Two distinct squads must be pinned — one squad's bad moment does not
    // burn the army's smoke, but a stalled front does.
    const pinnedCohorts = new Set(
      fighters
        .filter(
          (u) =>
            lineInfantry(u.id) &&
            u.suppression > 68 &&
            u.x - front >= 0 &&
            u.x - front < 500,
        )
        .map((u) => u.squad),
    ).size;
    const readySmoke = p.hand.find(
      (h) =>
        h.id === 'smoke' &&
        cardReadyIn(s, h) <= 0 &&
        cardCost(h) <= p.energy + 1e-6,
    );
    if (
      cohorts >= 2 && readySmoke &&
      !smokeCovered &&
      contactAhead &&
      (shockTroops.length > 0 ||
        (archetype === 'assault' && screens >= 2.5) ||
        pinnedCohorts >= 2)
    ) {
      if (playCard(s, 1, readySmoke.uid, smokeX).ok) {
        s.aiPushUntil = s.time + 9;
        s.aiSmokeAssaultUntil = s.time + 12;
        s.aiSmokeAssaultX = smokeX;
        return;
      }
    }
    // Illuminate hostile smoke or a previously observed but uncleared sector.
    const readyFlare = p.hand.find(
      (h) =>
        h.id === 'flare' &&
        cardReadyIn(s, h) <= 0 &&
        cardCost(h) <= p.energy + 1e-6,
    );
    if (readyFlare) {
      const enemySmokeAhead = s.smokes.find(
        (m) =>
          m.side === 0 &&
          m.life > 2 &&
          front - m.x > -120 &&
          front - m.x < 800,
      );
      // groundFoes is already visible-only: looking for hidden foes inside
      // it could never succeed. Search the last reported sector instead.
      if (enemySmokeAhead || unclearedFront) {
        const flareX = unclearedFront?.x ?? enemySmokeAhead!.x;
        if (playCard(s, 1, readyFlare.uid, flareX).ok) return;
      }
    }
  }

  // The endgame is all-in: banked energy buys nothing after the timer expires.
  const reserve =
    (phase !== 'late' && !emergency && !battle && !screenNeed ? 2 : 0) +
    // v88: bank CP for assault reinforcements while the smoke screen is up.
    (smokeAssault ? 3 : 0);
  const usefulSupply = options.find(
    (o) =>
      (CARDS[o.h.id].id === 'supply' || CARDS[o.h.id].effect === 'ammo') &&
      cardCost(o.h) <= p.energy,
  );
  if (
    usefulSupply &&
    p.hand.length < MAX_HAND &&
    playCard(s, 1, usefulSupply.h.uid).ok
  )
    return;
  // Buy the next real card while an established screen fights. Two CP are never gifted.
  if (
    !emergency &&
    !screenNeed &&
    p.hand.length <= 3 &&
    p.drawIn <= 0 &&
    p.energy >= DRAW_COST + (battle ? 1 : 0) &&
    requestDraw(s, 1).ok
  )
    return;
  const best = options[0];
  // When points would otherwise cap, prepare the next choice while keeping the
  // budget for the current one. Urgent counters have already been handled above.
  if (
    !emergency &&
    p.energy >= energyLimit(p) - 1 &&
    p.hand.length <= 3 &&
    (!best || best.score < 16) &&
    (!best || p.energy >= cardCost(best.h) + DRAW_COST) &&
    requestDraw(s, 1).ok
  )
    return;
  if (best && cardCost(best.h) > p.energy + 1e-6) {
    // Reserve real command points for the best ready card, including counters.
    // An urgent HQ fight may use an already affordable useful defender instead.
    if (!emergency) return;
    const defender = options.find(
      (o) => cardCost(o.h) <= p.energy + 1e-6 && CARDS[o.h.id].type === 'unit',
    );
    if (!defender) return;
    if (playCard(s, 1, defender.h.uid, defender.x).ok) return;
  }
  for (const option of options) {
    if (cardCost(option.h) > p.energy + 1e-6) continue;
    const highNeed = option.score >= 18 || screenNeed;
    if (!highNeed && cardCost(option.h) > p.energy - reserve + 1e-6) continue;
    if (playCard(s, 1, option.h.uid, option.x).ok) return;
  }
  // A completely blocked full hand needs one cheap slot cleared before drawing.
  if (p.hand.length >= MAX_HAND && !options.length) {
    const clear = p.hand
      .filter(
        (h) =>
          !CARDS[h.id].targetGround &&
          cardReadyIn(s, h) <= 0 &&
          (CARDS[h.id].type === 'unit' ||
            h.id === 'supply' ||
            CARDS[h.id].effect === 'ammo'),
      )
      .sort(
        (a, b) =>
          // The card itself frees a slot before drawing. Otherwise reserve for
          // an actual unit, even when it costs slightly more than current CP.
          Number(!(a.id === 'supply' || CARDS[a.id].effect === 'ammo')) -
            Number(!(b.id === 'supply' || CARDS[b.id].effect === 'ammo')) ||
          cardCost(a) - cardCost(b),
      )[0];
    if (clear && cardCost(clear) <= p.energy + 1e-6) playCard(s, 1, clear.uid);
  }
  // Draw only after deciding there is no useful card to buy or reserve for.
  if (p.hand.length < MAX_HAND) requestDraw(s, 1);
}

// Called inside the existing footsoldier retreat branch, before moveSoldier.
// true means this frame was spent regrouping/in a conflict; false means keep fleeing.
function recoverRetreat(s: GameState, u: Unit, dt: number) {
  u.originalSquad ??= u.squad;
  const friends = s.units.filter(
    (v) =>
      v !== u &&
      v.side === u.side &&
      isCombatant(v) &&
      CARDS[v.id].members &&
      v.tactic !== 'retreat',
  );
  const groups = new Map<number, Unit[]>();
  for (const v of friends)
    if (Math.abs(v.x - u.x) <= 140) {
      const list = groups.get(v.squad) ?? [];
      list.push(v);
      groups.set(v.squad, list);
    }
  const host = [...groups.entries()]
    .map(([squad, members]) => ({
      squad,
      members,
      morale:
        members.reduce((n, v) => n + v.personalMorale, 0) / members.length,
      x: members.reduce((n, v) => n + v.x, 0) / members.length,
    }))
    .filter((g) => g.members.length >= 4 && g.morale >= 55)
    .sort((a, b) => Math.abs(a.x - u.x) - Math.abs(b.x - u.x))[0];
  if (host && s.time - (u.regroupedAt ?? -100) >= 6) {
    if (u.regroupHost !== host.squad) {
      u.regroupHost = host.squad;
      u.regroupProgress = 0;
    }
    u.regroupProgress = (u.regroupProgress ?? 0) + dt;
    u.moving = false;
    u.fire = 0;
    u.secondaryFire = 0;
    u.coverGoal = null;
    u.cover = 0;
    u.pose = setStance(u, s.time, 'crouch', { force: true });
    u.facing = u.side === 0 ? 1 : -1;
    if (u.regroupProgress >= 1.2) {
      // member and id define the weapon: never overwrite them when joining.
      u.squad = host.squad;
      u.personalMorale = Math.max(
        u.personalMorale,
        Math.min(70, Math.max(52, host.morale - 10)),
      );
      u.suppression = Math.min(25, u.suppression);
      u.tactic = 'advance';
      u.retreatUntil = 0;
      u.decisionIn = 0.5;
      u.regroupedAt = s.time;
      u.regroupProgress = 0;
      u.regroupHost = undefined;
      u.conflictUntil = 0;
      u.conflictTarget = undefined;
      u.conflictChecked = false;
      notify(
        s,
        `${u.side === 0 ? '我方' : '敌方'}撤退士兵加入附近部队`,
        'info',
        ([0, 1] as Side[]).filter((side) => visibleToSide(s, side, u)),
      );
    }
    return true;
  }
  u.regroupProgress = 0;
  u.regroupHost = undefined;
  const former =
    friends.find(
      (v) =>
        v.uid === u.conflictTarget &&
        v.squad === u.originalSquad &&
        Math.abs(v.x - u.x) < 120,
    ) ??
    friends
      .filter((v) => v.squad === u.originalSquad && Math.abs(v.x - u.x) < 65)
      .sort((a, b) => Math.abs(a.x - u.x) - Math.abs(b.x - u.x))[0];
  if (!former) {
    u.conflictTarget = undefined;
    u.conflictChecked = false;
    return false;
  }
  if (u.conflictTarget !== former.uid) {
    u.conflictTarget = former.uid;
    u.conflictChecked = false;
  }
  if (!u.conflictChecked && s.time >= (u.conflictNextAt ?? 0)) {
    u.conflictChecked = true;
    u.conflictNextAt = s.time + 3;
    const chance =
      u.personalMorale < 35 && former.personalMorale < 55
        ? Math.min(
            0.4,
            (35 - u.personalMorale) / 100 + (55 - former.personalMorale) / 200,
          )
        : 0;
    if (chance > 0 && rnd(s) < chance) {
      // One brief low-morale clash per encounter, not a new hostile faction.
      u.conflictUntil = s.time + 0.7;
      u.personalMorale = Math.max(0, u.personalMorale - 3);
      u.suppression = Math.min(100, u.suppression + 10);
      u.fire = 0.25;
      const point = muzzlePoint(u, former.x, 47);
      // The conflict shot must also clear the solid wreck between shoulder and muzzle.
      if (
        sceneryIntercept(s, u.x, u.y - 47, point.x, point.y, false, true, true)
      ) {
        u.fire = 0;
        return true;
      }
      u.muzzleX = point.x;
      u.muzzleY = point.y;
      if (s.night) u.flashUntil = s.time + 0.9;
      u.shotAngle = Math.atan2(former.y - 27 - point.y, former.x - point.x);
      u.aimUntil = s.time + 1;
      u.lastAmmo = 'rifle';
      const duration = Math.max(
        0.04,
        Math.hypot(former.x - point.x, former.y - 27 - point.y) /
          FLIGHT.rifle.speed,
      );
      s.projectiles.push({
        uid: ++s.uid,
        sourceUid: u.uid,
        side: u.side,
        targetUid: former.uid,
        x: point.x,
        y: point.y,
        startX: point.x,
        startY: point.y,
        tx: former.x,
        ty: former.y - 27,
        base: null,
        damage: 3,
        radius: 0,
        life: duration,
        total: duration,
        ammunition: 'rifle',
        tracer: true,
      });
      notify(
        s,
        `${u.side === 0 ? '我方' : '敌方'}低士气士兵与原部队发生冲突`,
        'warn',
        ([0, 1] as Side[]).filter((side) => visibleToSide(s, side, u)),
      );
    }
  }
  if (s.time < (u.conflictUntil ?? 0)) {
    u.moving = false;
    u.pose = setStance(u, s.time, 'idle');
    u.facing = Math.sign(former.x - u.x) || u.facing;
    return true;
  }
  return false;
}

// A bomber releases a bounded salvo at fixed forward landing points.
function fireBombRun(s: GameState, u: Unit) {
  const c = CARDS[u.id],
    dir = u.side === 0 ? 1 : -1;
  if (u.bombsLeft === undefined) {
    const contact = s.units.some(
      (v) =>
        v.side !== u.side &&
        isCombatant(v) &&
        !CARDS[v.id].air &&
        visibleToSide(s, u.side, v) &&
        (v.x - u.x) * dir >= 0 &&
        (v.x - u.x) * dir <= 180,
    );
    const baseX = u.side === 0 ? W - 70 : 70;
    const baseContact = (baseX - u.x) * dir >= 0 && (baseX - u.x) * dir <= 180;
    if (!contact && !baseContact) return;
    u.bombsLeft = c.sortieAmmo ?? 6;
  }
  if (u.bombsLeft <= 0 || u.cooldown > 0 || u.shots >= (c.sortieAmmo ?? 6))
    return;
  const sx = u.x,
    sy = u.y + 10;
  // v108 radar jam: bomb drift widens sharply when the attacker's seeker
  // is being spoofed.
  const jammed = (s.players[u.side].radarJamUntil ?? 0) > s.time;
  const tx = sx + dir * 160 + (jammed ? (rnd(s) - 0.5) * 130 : 0);
  const ty = ground(s, tx) - 8;
  const total = Math.max(0.5, Math.sqrt(Math.max(0, (2 * (ty - sy)) / 800)));
  u.bombsLeft--;
  u.cooldown = c.rate!;
  u.shots++;
  u.lastCombatShotAt = s.time;
  u.lastAmmo = 'mortar';
  u.fire = 0.12;
  u.muzzleX = sx;
  u.muzzleY = sy;
  u.shotAngle = Math.atan2(ty - sy, tx - sx);
  s.projectiles.push({
    uid: ++s.uid,
    sourceUid: u.uid,
    side: u.side,
    x: sx,
    y: sy,
    startX: sx,
    startY: sy,
    tx,
    ty,
    targetUid: null,
    base: null,
    // This value makes the shared parabola y = startY + (ty-startY)*t*t.
    arc: Math.max(0, (ty - sy) / 4),
    total,
    life: total,
    guided: false,
    shell: true,
    ammunition: 'mortar',
    effect: 'artillery',
    damage: c.damage! * (s.players[u.side].morale > 0 ? 1.35 : 1),
    radius: c.radius ?? 42,
    armorMultiplier: c.armorMultiplier,
    infantryMultiplier: c.infantryMultiplier,
    baseMultiplier: c.baseMultiplier,
    tracer: false,
  });
}

function moveAirTo(u: Unit, x: number, y: number, speed: number, dt: number) {
  const dx = x - u.x,
    dy = y - u.y,
    distance = Math.hypot(dx, dy);
  const step = Math.min(distance, speed * dt);
  if (distance > 0.01) {
    u.x += (dx / distance) * step;
    u.y += (dy / distance) * step;
    if (Math.abs(dx) > 0.5) u.facing = Math.sign(dx);
  }
  u.moving = step > 0.01;
  return distance <= speed * dt + 1;
}
function flyTransport(s: GameState, u: Unit, dt: number) {
  const c = CARDS[u.id],
    dir = u.side === 0 ? 1 : -1;
  u.airlift ??= {
    x: safeLanding(s, defaultLanding(s, u.side)),
    phase: 'approach',
    dropped: 0,
    nextAt: s.time,
  };
  const flight = u.airlift;
  if (flight.phase === 'exit') {
    moveAirTo(
      u,
      u.side === 0 ? -200 : W + 200,
      c.altitude ?? 154,
      c.speed!,
      dt,
    );
    if (u.x < -150 || u.x > W + 150) {
      u.hp = 0;
      u.destroyed = true;
      u.deadFor = 0;
    }
    return;
  }
  const cargoSize = CARDS[c.airlift!].members ?? 5;
  const ropeX =
    flight.x +
    dir * (Math.min(cargoSize - 1, flight.dropped) - 2) * SQUAD_SPACING;
  if (flight.phase === 'approach') {
    if (
      moveAirTo(
        u,
        ropeX,
        Math.min(c.altitude ?? 154, ground(s, ropeX) - 150),
        c.speed!,
        dt,
      )
    ) {
      // Terrain may have changed during flight; correct once, before unloading starts.
      flight.x = safeLanding(s, flight.x);
      flight.phase = 'unload';
      flight.nextAt = s.time + 0.65;
    }
    return;
  }
  const settled = moveAirTo(u, ropeX, ground(s, ropeX) - 130, 85, dt);
  if (flight.dropped >= cargoSize) {
    if (
      !s.units.some((v) => v.squad === flight.squad && v.hp > 0 && v.rappelling)
    )
      flight.phase = 'exit';
    return;
  }
  if (!settled || s.time < flight.nextAt) return;
  const next = s.units.length;
  spawnUnit(s, u.side, c.airlift!, ropeX, {
    member: flight.dropped,
    squad: flight.squad,
  });
  const soldier = s.units[next];
  flight.squad = soldier.squad;
  soldier.y = u.y + 58;
  soldier.rappelling = true;
  soldier.rappellingStartAt = s.time;
  soldier.pose = 'climb';
  soldier.cooldown = 0.7;
  soldier.rapidUntil = 0;
  flight.dropped++;
  flight.nextAt = s.time + 0.85;
}
function detonateMunition(s: GameState, u: Unit, x: number, y: number) {
  const c = CARDS[u.id];
  u.hp = 0;
  u.destroyed = true;
  u.deadFor = 0;
  u.moving = false;
  const wreck: Wreck = {
    id: u.uid,
    cardId: u.id,
    side: u.side,
    facing: u.facing,
    x,
    y,
    angle: 0,
    age: 0,
    falling: y < ground(s, x) - 35,
    vx: u.facing * 12,
    vy: 0,
    cause: 'blast',
    spentWarhead: true,
  };
  if (!wreck.falling)
    Object.assign(
      wreck,
      wreckContact((px) => ground(s, px), wreck),
    );
  s.wrecks.push(wreck);
  explode(
    s,
    x,
    y,
    c.radius!,
    c.damage!,
    u.side,
    0,
    c.armorMultiplier,
    'grenade',
    c.infantryMultiplier,
  );
}
function flyAirPatrol(s: GameState, u: Unit, dt: number) {
  const c = CARDS[u.id],
    sideDir = u.side === 0 ? 1 : -1;
  u.flightUntil ??= s.time + c.patrolTime!;
  const groundFriends = s.units.filter(
    (v) => v !== u && v.side === u.side && isCombatant(v) && !CARDS[v.id].air,
  );
  const localFront = groundFriends.length
    ? Math.max(...groundFriends.map((v) => (u.side === 0 ? v.x : W - v.x)))
    : 680;
  const forward = Math.max(900, Math.min(W - 650, localFront + 220));
  const rear = Math.max(280, forward - 760);
  const local = u.side === 0 ? u.x : W - u.x;
  if (s.time >= u.flightUntil) u.patrolExiting = true;
  if (u.patrolExiting) u.patrolDir = -sideDir;
  else if (local >= forward) u.patrolDir = -sideDir;
  else if (local <= rear) u.patrolDir = sideDir;
  const goal = u.patrolExiting
    ? u.side === 0
      ? -200
      : W + 200
    : (u.patrolDir === sideDir ? forward : rear) * sideDir +
      (u.side === 0 ? 0 : W);
  moveAirTo(
    u,
    goal,
    c.altitude ?? 140,
    c.speed! * (s.players[u.side].morale > 0 ? 1.2 : 1),
    dt,
  );
  u.facing = u.patrolDir;
  u.moving = true;
}
function flyFpv(s: GameState, u: Unit, dt: number) {
  const c = CARDS[u.id],
    dir = u.side === 0 ? 1 : -1;
  if (s.time >= (u.flightUntil ?? Infinity)) {
    finishDeath(s, u, u.side);
    return;
  }
  if (u.cooldown > 0) {
    u.moving = false;
    return;
  }
  if (!u.fpvLock) {
    const target = s.units
      .filter(
        (v) =>
          v.side !== u.side &&
          isCombatant(v) &&
          !CARDS[v.id].air &&
          visibleToSide(s, u.side, v) &&
          Math.abs(v.x - u.x) <= c.range!,
      )
      .sort(
        (a, b) =>
          Number(!CARDS[a.id].armored) - Number(!CARDS[b.id].armored) ||
          Number(!CARDS[a.id].vehicle) - Number(!CARDS[b.id].vehicle) ||
          Math.abs(a.x - u.x) - Math.abs(b.x - u.x),
      )[0];
    if (target)
      u.fpvLock = {
        uid: target.uid,
        x: target.x,
        y: target.y - bodyHeight(target),
      };
  }
  if (u.fpvLock) {
    flyMunitionDive(s, u, u.fpvLock, dt);
    return;
  }
  const nextX = Math.max(420, Math.min(W - 420, u.x + dir * c.speed! * dt));
  // Do not snap a newly launched drone to the forward patrol boundary.
  const x =
    (nextX - u.x) * dir > c.speed! * dt + 1 ? u.x + dir * c.speed! * dt : nextX;
  let height = ground(s, x) - 130;
  for (const box of obstacleBoxes(s))
    if (box.x < x + 130 && box.x + box.w > x - 55)
      height = Math.min(height, box.y - 34);
  const y = u.y + Math.max(-80 * dt, Math.min(80 * dt, height - u.y));
  u.facing = dir;
  u.moving = Math.abs(x - u.x) > 0.01;
  u.x = x;
  u.y = y;
  u.hullAngle = 0;
}
/** The aircraft itself strikes the scene; never replace it with a remote projectile. */
function flyMunitionDive(s: GameState, u: Unit, lock: {uid: number; x: number; y: number}, dt: number) {
    const target = s.units.find((v) => v.uid === lock.uid && isCombatant(v));
    if (target && visibleToSide(s, u.side, target)) {
      lock.x = target.x;
      lock.y = target.y - bodyHeight(target);
    }
    const oldX = u.x,
      oldY = u.y;
    const arrived = moveAirTo(u, lock.x, lock.y, 260, dt);
    const pitch = Math.atan2(lock.y - oldY, Math.abs(lock.x - oldX));
    u.hullAngle = pitch * u.facing;
    let hit: { x: number; y: number; t: number } | null = sceneryIntercept(
      s,
      oldX,
      oldY,
      u.x,
      u.y,
      false,
      true,
    );
    for (const wall of s.walls) {
      if (wall.hp <= 0) continue;
      const t = segmentBox(oldX, oldY, u.x, u.y, {
        x: wall.x - wall.width / 2,
        y: ground(s, wall.x) - wall.height,
        w: wall.width,
        h: wall.height,
      });
      if (t !== null && (!hit || t < hit.t))
        hit = {
          t,
          x: oldX + (u.x - oldX) * t,
          y: oldY + (u.y - oldY) * t,
        };
    }
    if (hit) detonateMunition(s, u, hit.x, hit.y);
    else if (u.y >= ground(s, u.x) - 3) detonateMunition(s, u, u.x, ground(s, u.x));
    else if (arrived) detonateMunition(s, u, lock.x, lock.y);
}
function flyLoiterMunition(s: GameState, u: Unit, dt: number) {
  const c = CARDS[u.id], dir = u.side === 0 ? 1 : -1;
  if (s.time >= (u.flightUntil ?? Infinity)) {
    finishDeath(s, u, u.side);
    return;
  }
  if (!u.loiterFlight) {
    let front = 680;
    for (const v of s.units)
      if (v.side === u.side && isCombatant(v) && !CARDS[v.id].air)
        front = Math.max(front, u.side === 0 ? v.x : W - v.x);
    const local = Math.max(800, Math.min(W - 650, front + 160));
    u.loiterFlight = {anchor: u.side === 0 ? local : W - local, scanAt: 0};
  }
  const flight = u.loiterFlight;
  if (flight.lock) {
    // Once committed, a terminal dive cannot teleport back to a watch order.
    flyMunitionDive(s, u, flight.lock, dt);
    return;
  }
  const order = localUnitOrder(s, u);
  if (order === 'watch' || order === 'retreat')
    flight.anchor = Math.max(100, Math.min(W - 100, u.squadOrderX ?? u.x));
  const valid = (v: Unit) => v.side !== u.side && isCombatant(v) &&
    !CARDS[v.id].air && !!(CARDS[v.id].vehicle || CARDS[v.id].armored || CARDS[v.id].emplacement) &&
    Math.abs(v.x - u.x) <= c.range! && visibleToSide(s, u.side, v);
  let target = flight.candidateUid === undefined ? undefined : s.units.find(v => v.uid === flight.candidateUid);
  if (order === 'retreat' || u.cooldown > 0 || !target || !valid(target)) {
    target = undefined;
    flight.candidateUid = undefined;
    flight.confirmAt = undefined;
  }
  if (!target && order !== 'retreat' && u.cooldown <= 0 && s.time >= flight.scanAt) {
    flight.scanAt = s.time + 0.2;
    let best = Infinity;
    // No candidate array/sort per simulation step. Ignore infantry bait entirely.
    for (const v of s.units) {
      if (!valid(v)) continue;
      const vc = CARDS[v.id];
      const rank = (vc.emplacement ? 0 : vc.armored ? 1 : 2) * W + Math.abs(v.x - u.x);
      if (rank < best) { best = rank; target = v; }
    }
    if (target) { flight.candidateUid = target.uid; flight.confirmAt = s.time + 2; }
  }
  if (target && s.time >= flight.confirmAt!) {
    flight.lock = {uid: target.uid, x: target.x, y: target.y - bodyHeight(target)};
    flyMunitionDive(s, u, flight.lock, dt);
    return;
  }
  const left = Math.max(60, flight.anchor - 120), right = Math.min(W - 60, flight.anchor + 120);
  if (u.x >= right) u.patrolDir = -1;
  else if (u.x <= left) u.patrolDir = 1;
  const goal = (u.patrolDir || dir) > 0 ? right : left;
  let height = Math.min(ground(s, u.x), ground(s, goal)) - 210;
  for (const box of obstacleBoxes(s))
    if (box.x < Math.max(u.x, goal) + 90 && box.x + box.w > Math.min(u.x, goal) - 90)
      height = Math.min(height, box.y - 65);
  moveAirTo(u, goal, height, c.speed!, dt);
  u.moving = true;
  u.hullAngle = 0;
}
// Reused per-unit scratch buffers for spatial candidate queries. The game is
// single-threaded and each buffer is drained (filtered into a persistent array
// or consumed inline) before the next unit runs, so reuse is safe.
const candNearScratch: Unit[] = [];
const candOutScratch: Unit[] = [];
const neighborNearScratch: Unit[] = [];
const neighborOutScratch: Unit[] = [];
const tacticNearScratch: Unit[] = [];
const tacticOutScratch: Unit[] = [];
const coverNearScratch: Unit[] = [];
const scanNearScratch: Unit[] = [];
const ammoNearScratch: Unit[] = [];

/**
 * v84: a lifesaver only kneels over a casualty while the enemy is far enough
 * away that 1.5 s of heads-down work is not a suicide pact. Tighter than the
 * drag rule's under-fire check — care under fire happens, just not with a
 * rifleman 200 px away.
 */
function firstAidHotZone(s: GameState, u: Unit): boolean {
  nearUnits(s, u.x, 700, tacticNearScratch);
  for (const v of tacticNearScratch) {
    if (
      v.side !== u.side &&
      isCombatant(v) &&
      visibleToSide(s, u.side, v) &&
      Math.abs(v.x - u.x) <= 340
    )
      return true;
  }
  return false;
}

export function tick(s: GameState, dt: number) {
  if (s.status !== 'playing') return;
  dt = Math.min(0.05, Math.max(0, dt));
  if (!dt) return;
  // Only aircraft need velocity bookkeeping; skip the allocation entirely
  // when the battle has no air units (the common case).
  let airPositions: Map<number, { x: number; y: number }> | undefined;
  for (const u of s.units)
    if (CARDS[u.id].air)
      (airPositions ??= new Map()).set(u.uid, { x: u.x, y: u.y });
  s.time = Math.min(s.campaign?.duration ?? DURATION, s.time + dt);
  updateComeback(s, { damage: hitUnit, spawn: spawnUnit, draw });
  s.shake = Math.max(0, s.shake - dt * 24);
  // Wind slowly shifts direction and strength, carrying smoke and dust.
  s.windIn -= dt;
  if (s.windIn <= 0) {
    s.windIn = 5 + fxRnd(s) * 9;
    s.windTarget = (fxRnd(s) * 2 - 1) * 18;
  }
  s.wind += (s.windTarget - s.wind) * Math.min(1, dt * 0.15);
  // Map weather cycles between clear spells and the front's signature
  // condition, degrading everyone's vision symmetrically (v62).
  updateWeather(s, dt);
  // Ambient dust motes drift through contested ground to keep the battlefield alive.
  s.dustIn -= dt;
  if (s.dustIn <= 0) {
    s.dustIn = 0.5 + fxRnd(s) * 0.7;
    let pick: Unit | null = null;
    let count = 0;
    for (const u of s.units) {
      if (u.hp > 0 && isCombatant(u) && !CARDS[u.id].air) {
        count++;
        if (fxRnd(s) < 1 / count) pick = u;
      }
    }
    if (count >= 4 && pick) {
      const u = pick;
      const life = 2.5 + fxRnd(s) * 3;
      emitParticle(s, {
        kind: 'mote',
        x: u.x + (fxRnd(s) * 2 - 1) * 160,
        y: ground(s, u.x) - 30 - fxRnd(s) * 60,
        vx: (fxRnd(s) * 2 - 1) * 6,
        vy: -2 - fxRnd(s) * 4,
        life,
        maxLife: life,
        color: '#8a7e6e',
        size: 2 + fxRnd(s) * 3,
      });
    }
  }
  for (const side of [0, 1] as Side[]) {
    const p = s.players[side];
    if (!(p.blackoutUntil && p.blackoutUntil > s.time))
      updateEconomy(s, side, dt);
    p.morale = Math.max(0, p.morale - dt);
    p.recon = Math.max(0, p.recon - dt);
    p.fortify = Math.max(0, p.fortify - dt);
    p.jam = Math.max(0, p.jam - dt);
    p.drawIn = Math.max(0, p.drawIn - dt);
  }
  s.visionIn -= dt;
  if (s.visionIn <= 0) {
    refreshVision(s);
    s.visionIn = 0.18;
  }
  s.aiIn -= dt;
  if (s.aiIn <= 0) {
    updateAI(s);
    s.aiIn = 0.75 + rnd(s) * 0.6;
  }
  for (const f of s.smokes) {
    f.life -= dt * smokeDecayMultiplier(s);
    f.x += s.wind * dt * 0.5;
  }
  s.smokes = s.smokes.filter((f) => f.life > 0);
  for (const f of s.flares) {
    f.life -= dt;
    f.y = Math.min(ground(s, f.x) - 60, f.y + 13 * dt);
    f.x += Math.sin(f.life * 2.2 + f.seed) * 9 * dt;
  }
  s.flares = s.flares.filter((f) => f.life > 0);
  for (const r of s.batteryReports) r.life -= dt;
  s.batteryReports = s.batteryReports.filter((r) => r.life > 0);
  for (const m of s.markers) {
    const c = ARTILLERY[m.kind ?? 'artillery'];
    m.timer -= dt;
    if (m.timer <= 0) {
      const x = m.impacts?.[m.wave] ?? m.x;
      explode(s, x, ground(s, x) - 8, c.radius, c.damage, m.side, c.baseScale);
      m.wave++;
      m.timer = c.interval;
    }
  }
  s.markers = s.markers.filter(
    (m) => m.wave < ARTILLERY[m.kind ?? 'artillery'].count,
  );
  // Rebuild the per-tick lookup structures once, O(N). Units spawned later
  // this tick (airlift roping, bailing crews) are absent until next tick;
  // every query site keeps exact distance/hp checks as a backstop.
  s.spatial = buildSpatial(s.units, W);
  s.byUid = buildByUid(s.units);
  s.squadIndex = buildSquadIndex(s.units);
  let front0 = 650;
  let front1 = W - 650;
  for (const v of s.units) {
    if (isCombatant(v) && !CARDS[v.id].air) {
      if (v.side === 0) {
        if (v.x > front0) front0 = v.x;
      } else if (v.x < front1) front1 = v.x;
    }
  }
  s.frontX = [front0, front1];
  updateSquadCommand(s);
  for (const u of s.units) {
    if (CARDS[u.id].members) pauseMagazineDrill(u,s.time,dt);
    const launcherBusy = u.id === 'grenadiers' && launcherDrillBusy(u, s.time - dt);
    u.poseAnimProgress = stanceTransitionProgress(u, s.time) ?? undefined;
    const previousWork = beginSupportTick(u);
    if (!isCombatant(u) || u.rappelling || u.parachuting || u.tactic === 'retreat' ||
        orderedWithdrawal(s,u) || localUnitOrder(s,u) === 'retreat') clearRepairAssignment(u);
    u.crouchMoveRequested = false;
    u.proneMoveRequested = false;
    u.fragCooldown = Math.max(0, (u.fragCooldown ?? 0) - dt);
    if (!isCombatant(u) || u.rappelling || u.parachuting) {
      // Incapacitation before release cancels preparation; no delayed throw
      // can emerge from a casualty or resume after a medic revives them.
      u.fragThrow = 0;
      u.fragAim = undefined;
      u.fragThrowStartedAt = undefined;
    }
    u.digging = false;
    u.backpedaling = false;
    u.vacuum = CARDS[u.id].members
      ? squadInVacuum(s, u.side, u.squad)
      : false;
    // v120, animation-only: mark the squad's current leader so the
    // animation layer can give him radio/hand-signal idle beats.
    u.leader = CARDS[u.id].members
      ? s.squadCommand?.[u.side * 1048576 + u.squad]?.leaderUid === u.uid
      : false;
    if (u.hp <= 0) {
      // v131: a man hit on the rope stops being a rappeller — without this
      // the flag stuck forever and the animation layer kept serving climb
      // frames to a corpse (and to the same soldier after a medic revive).
      u.rappelling = false;
      u.parachuting = false;
      u.deadFor -= dt;
      u.y = Math.min(ground(s, u.x), u.y + 110 * dt);
      continue;
    }
    if (u.wounded) {
      // v131: same hazard for casualties. The wounded branch `continue`s
      // before the descent-clearing code below, so a rifleman hit on the
      // rope kept rappelling=true through his whole casualty cycle — the
      // animation dispatch checks rappelling BEFORE wounded, so he played
      // the climb silhouette the whole time he lay on the stretcher.
      u.rappelling = false;
      u.parachuting = false;
      // A dragger who is himself hit releases his comrade before collapsing.
      if (u.draggingUid !== undefined) {
        const p = unitByUid(s, u.draggingUid);
        if (p) p.draggedByUid = undefined;
        u.draggingUid = undefined;
      }
      // A lifesaver who is himself hit lets go of the casualty he was
      // bandaging before he collapses.
      if (u.firstAidTargetUid !== undefined) {
        const p = unitByUid(s, u.firstAidTargetUid);
        if (p && p.firstAidByUid === u.uid) p.firstAidByUid = undefined;
        u.firstAidUntil = undefined;
        u.firstAidTargetUid = undefined;
      }
      u.woundedTime += dt;
      // v84: a tourniquet buys time — a stabilized casualty bleeds out at a
      // trickle, long enough for a medic to arrive or a buddy to drag him in.
      u.bleedOut -= (u.stabilizedUntil ?? 0) > s.time ? dt * 0.15 : dt;
      u.fire = 0;
      u.secondaryFire = 0;
      u.moving = false;
      // After the initial shock, a wounded soldier crawls back toward his own
      // line while no medic is actively tending him.
      // v84: a man being bandaged lies still so the lifesaver can work.
      const farFromBase =
        u.side === 0 ? u.x > 104 : u.x < W - 104;
      if (
        u.draggedByUid === undefined &&
        u.firstAidByUid === undefined &&
        u.woundedTime >= 2.2 &&
        s.time - (u.rescuedAt ?? -99) >= 2.5 &&
        u.bleedOut > 8 &&
        farFromBase
      ) {
        const dir = u.side === 0 ? -1 : 1;
        u.crawling = true;
        u.moving = true;
        u.x = Math.max(
          90,
          Math.min(
            W - 90,
            u.x +
              dir *
                9 *
                (unitSynergy(s, u, s.time).medevac_chain ? 1.35 : 1) *
                dt,
          ),
        );
        u.walk += dt * 1.6;
        if (u.crawlFxAt === undefined || s.time >= u.crawlFxAt) {
          emitParticle(s, {
            kind: 'blood',
            x: u.x - dir * 6,
            y: ground(s, u.x) - 2,
            vx: (fxRnd(s) - 0.5) * 4,
            vy: -6 - fxRnd(s) * 5,
            life: 0.5,
            maxLife: 0.5,
            color: '#7a2420',
            size: 2,
          });
          u.crawlFxAt = s.time + 0.35 + fxRnd(s) * 0.3;
        }
      } else {
        u.crawling = false;
      }
      // While hauled by a buddy the soldier keeps the prone crawl animation
      // but does not self-propel; the dragger drives his position.
      if (u.draggedByUid !== undefined) u.crawling = true;
      u.y = ground(s, u.x);
      u.healing = Math.max(0, u.healing - dt);
      if (
        u.woundedTime >= 1.5 &&
        u.hp >= u.maxHp * 0.4 &&
        u.rescueProgress >= 1.6
      )
        revive(u, s.time);
      else if (u.bleedOut <= 0) finishDeath(s, u, u.woundedBy);
      continue;
    }
    if (u.surrendered) {
      u.surrenderTime += dt;
      u.moving = false;
      u.fire = 0;
      u.secondaryFire = 0;
      // v133: a soldier whose morale breaks mid-rope / mid-canopy used to
      // keep the rappelling|parachuting flag forever (this branch ran before
      // the descent loops and `continue`d past them). The animation dispatcher
      // checks rappelling BEFORE surrendered, so he cycled the climb frames
      // for the rest of the battle — whole helicopter squads froze in the
      // swim-lane pose. Surrender happens on the ground, with hands up.
      if (u.rappelling || u.parachuting) {
        u.rappelling = false;
        u.parachuting = false;
        u.pose = 'idle';
        u.motion = 'ground';
      }
      u.y = ground(s, u.x);
      continue;
    }
    // v79: blood-trail intelligence. On a staggered scan a soldier notices
    // fresh drag marks — blood left by a casualty hauled across the ground —
    // and glances toward the contact trace for a beat. Own-side blood is
    // always known; enemy blood needs line of sight at scan time, so
    // advancing onto a fresh enemy trail reads as genuine intelligence.
    // The freshest mark a side has seen feeds medic triage and the AI
    // director. Bounded: the scan walks at most 70 marks with an x-distance
    // early-out, and runs per soldier on a ~0.6s jittered clock.
    if ((u.traceScanAt ?? 0) <= s.time) {
      u.traceScanAt = s.time + 0.55 + (u.uid % 5) * 0.08;
      if (u.suppression < 40 && !u.rappelling) {
        let best: DragMark | undefined;
        for (const m of s.dragMarks) {
          if (Math.abs(m.x - u.x) > 320) continue;
          const age = s.time - m.born;
          if (age < 0 || age > 15) continue;
          if (m.side !== u.side && !pointVisible(s, u.side, m.x, m.y))
            continue;
          if (!best || m.born > best.born) best = m;
        }
        if (best) {
          u.traceGlanceUntil = s.time + 1.0;
          u.traceGlanceDir = (best.x >= u.x ? 1 : -1) as 1 | -1;
          const intel = s.traceIntel[u.side];
          if (!intel || best.born > intel.at) {
            s.traceIntel[u.side] = {
              x: best.x,
              side: best.side,
              at: best.born,
              until: s.time + 8,
            };
          }
        }
      }
    }
    const c = weaponCard(u),
      dir = ((u.side === 0 ? 1 : -1) *
        ((s.players[u.side].spoofUntil ?? 0) > s.time ? -1 : 1)) as 1 | -1,
      enemySide: Side = u.side === 0 ? 1 : 0,
      baseX = enemySide === 0 ? 70 : W - 70;
    if (u.parachuting) {
      u.fire = 0;
      u.secondaryFire = 0;
      u.moving = true;
      u.pose = 'climb';
      u.walk += dt * 5;
      // A live ground guide shortens exposure under the canopy. Recheck
      // every tick: a dead, moving or jammed guide cannot finish the job.
      const guide = landingGuide(s, u.side, u.x);
      u.y = Math.min(ground(s, u.x), u.y + 135 * (guide ? 1.35 : 1) * dt);
      // v133: safety net — if the descent somehow never reaches ground
      // (terrain reshaped under the canopy, knockback over a pit), force
      // the landing after 12s so the flag can never stick for the battle.
      if (
        u.y >= ground(s, u.x) ||
        s.time - (u.parachutingStartAt ?? s.time) > 12
      ) {
        u.y = ground(s, u.x);
        u.parachuting = false;
        u.pose = 'land';
        u.motion = 'land';
        u.motionTime = 0;
        u.motionDuration = 0.3;
        finishInfantryInsertion(u,s.time);
        if (guide) {
          u.suppression = Math.max(0, u.suppression - 30);
          u.personalMorale = Math.min(c.discipline ?? 80, u.personalMorale + 12);
          u.cooldown = 0;
        }
      }
      continue;
    }
    if (u.rappelling) {
      u.fire = 0;
      u.secondaryFire = 0;
      u.moving = true;
      u.pose = 'climb';
      u.walk += dt * 6;
      u.y = Math.min(ground(s, u.x), u.y + 65 * dt);
      // v133: same safety net for rope descents.
      if (
        u.y >= ground(s, u.x) ||
        s.time - (u.rappellingStartAt ?? s.time) > 12
      ) {
        u.y = ground(s, u.x);
        u.rappelling = false;
        u.pose = 'land';
        u.motion = 'land';
        u.motionTime = 0;
        u.motionDuration = 0.3;
        finishInfantryInsertion(u,s.time);
      }
      continue;
    }
    // v84: combat lifesaver channel. A rifleman kneeling beside a downed
    // squadmate, working a tourniquet. He keeps at it while the casualty is
    // still there, still bleeding, and the zone has not turned hot; the
    // moment it does he is back on his weapon.
    if (u.firstAidUntil !== undefined) {
      const patient =
        u.firstAidTargetUid !== undefined
          ? unitByUid(s, u.firstAidTargetUid)
          : undefined;
      const stillValid =
        patient !== undefined &&
        patient.wounded &&
        patient.hp > 0 &&
        patient.bleedOut > 0 &&
        patient.draggedByUid === undefined &&
        patient.firstAidByUid === u.uid &&
        Math.abs(patient.x - u.x) <= 96 &&
        u.suppression < 55 &&
        u.hp >= u.maxHp * 0.4 &&
        !firstAidHotZone(s, u);
      if (!stillValid) {
        if (patient && patient.firstAidByUid === u.uid)
          patient.firstAidByUid = undefined;
        u.firstAidUntil = undefined;
        u.firstAidTargetUid = undefined;
      } else if (s.time >= u.firstAidUntil) {
        // Tourniquet on: the casualty stops bleeding out for a long window,
        // buying the medic time to reach him or a buddy time to drag him in.
        patient.stabilizedUntil = s.time + 14;
        patient.rescueProgress += 0.5;
        patient.firstAidByUid = undefined;
        u.firstAidUntil = undefined;
        u.firstAidTargetUid = undefined;
        u.firstAidCooldownUntil = s.time + 8;
      } else {
        u.fire = 0;
        u.secondaryFire = 0;
        u.moving = false;
        u.pose = setStance(u, s.time, u.pose === 'prone' ? 'prone' : 'crouch');
        u.y = ground(s, u.x);
        continue;
      }
    }
    // Buddy drag: a squadmate hauling a bleeding casualty back to the line.
    if (u.draggingUid !== undefined) {
      const patient = unitByUid(s, u.draggingUid);
      const baseDir = -dir;
      const reachedBase = u.side === 0 ? u.x <= 116 : u.x >= W - 116;
      if (
        !patient ||
        patient.side !== u.side ||
        !patient.wounded ||
        patient.hp <= 0 ||
        patient.bleedOut <= 0 ||
        patient.draggedByUid !== u.uid ||
        reachedBase ||
        u.hp < u.maxHp * 0.3 ||
        u.personalMorale < 25 ||
        u.withdrawHeavyUid !== undefined
      ) {
        if (patient) patient.draggedByUid = undefined;
        u.draggingUid = undefined;
      } else {
        u.fire = 0;
        u.secondaryFire = 0;
        u.moving = true;
        u.pose = setStance(u, s.time, 'crouch');
        const gap = patient.x - u.x;
        if (Math.abs(gap) > 18) {
          moveSoldier(s, u, Math.sign(gap), c.speed! * u.pace * 0.85, dt);
        } else {
          const px = patient.x;
          u.x = Math.max(80, Math.min(W - 80, u.x + baseDir * 16 * dt));
          u.walk += dt * 1.8;
          patient.x = u.x - baseDir * 16;
          patient.y = ground(s, patient.x);
          patient.crawling = true;
          patient.walk += dt * 1.2;
          // Persistent blood trail: a casualty hauled across the ground
          // leaves a dark smear that lingers long after the drag is over.
          u.dragMarkAccum = (u.dragMarkAccum ?? 0) + Math.abs(patient.x - px);
          if (u.dragMarkAccum >= 14) {
            u.dragMarkAccum = 0;
            s.dragMarks.push({
              x: patient.x,
              y: patient.y,
              side: patient.side,
              seed:
                (s.fxSeed ^
                  Math.imul(Math.floor(patient.x * 7 + u.uid), 2654435761)) >>>
                0,
              born: s.time,
            });
            s.dragMarks = s.dragMarks.slice(-70);
          }
          if (
            patient.crawlFxAt === undefined ||
            s.time >= patient.crawlFxAt
          ) {
            emitParticle(s, {
              kind: 'blood',
              x: patient.x - baseDir * 6,
              y: ground(s, patient.x) - 2,
              vx: (fxRnd(s) - 0.5) * 4,
              vy: -6 - fxRnd(s) * 5,
              life: 0.5,
              maxLife: 0.5,
              color: '#7a2420',
              size: 2,
            });
            patient.crawlFxAt = s.time + 0.35 + fxRnd(s) * 0.3;
          }
        }
        u.y = ground(s, u.x);
        continue;
      }
    }
    // Decision to grab a casualty: same squad, bleeding out far from the
    // line, not already being tended by a medic or dragged by someone else.
    if (
      c.members &&
      u.hp >= u.maxHp * 0.5 &&
      u.personalMorale >= 40 &&
      !previousWork.tending &&
      u.id !== 'medic' &&
      u.squadOrder !== 'retreat' &&
      u.withdrawHeavyUid === undefined &&
      !u.backpedaling &&
      (u.dragScanAt ?? 0) <= s.time
    ) {
      u.dragScanAt = s.time + 0.25 + (u.uid % 4) * 0.06;
      // One buddy per squad may haul casualties, and only while no armed
      // foe is visible in weapons range: under direct fire the rest of the
      // fireteam keeps their weapons up (bounding overwatch, not a
      // stretcher race in the open).
      const squadDragger = squadMates(s, u.side, u.squad).some(
        (v) => v !== u && v.draggingUid !== undefined,
      );
      let underFire = false;
      if (!squadDragger) {
        nearUnits(s, u.x, 1200, tacticNearScratch);
        for (const v of tacticNearScratch) {
          if (
            v.side !== u.side &&
            isCombatant(v) &&
            visibleToSide(s, u.side, v) &&
            (!CARDS[v.id].air ||
              (sustainedAirThreat(v) &&
                Math.abs(v.x - u.x) <= Math.min(560, unitRange(s, v) + 40))) &&
            Math.abs(v.x - u.x) <=
              Math.max(unitRange(s, u), Math.min(720, unitRange(s, v) + 40))
          ) {
            underFire = true;
            break;
          }
        }
      }
      if (!squadDragger && !underFire) {
        let bestPatient: Unit | undefined;
        for (const q of squadMates(s, u.side, u.squad)) {
          if (
            q.wounded &&
            q.draggedByUid === undefined &&
            q.bleedOut > 0 &&
            q.bleedOut < 25 &&
            s.time - (q.rescuedAt ?? -99) > 3 &&
            Math.abs(q.x - u.x) <= 150 &&
            (q.side === 0 ? q.x > 130 : q.x < W - 130) &&
            (!bestPatient || q.bleedOut < bestPatient.bleedOut)
          )
            bestPatient = q;
        }
        if (bestPatient) {
          u.draggingUid = bestPatient.uid;
          bestPatient.draggedByUid = u.uid;
        }
      }
    }
    // v84: decision to start buddy aid. Same squad, the casualty lying right
    // beside him, bleeding out but not yet stabilized, and no enemy close
    // enough to punish a kneeling man. One lifesaver per squad at a time.
    if (
      c.members &&
      u.hp >= u.maxHp * 0.5 &&
      u.personalMorale >= 40 &&
      u.suppression < 55 &&
      !previousWork.tending &&
      u.id !== 'medic' &&
      u.squadOrder !== 'retreat' &&
      u.withdrawHeavyUid === undefined &&
      !u.backpedaling &&
      (u.firstAidCooldownUntil ?? 0) <= s.time &&
      (u.firstAidScanAt ?? 0) <= s.time
    ) {
      u.firstAidScanAt = s.time + 0.3 + (u.uid % 5) * 0.05;
      const squadAider = squadMates(s, u.side, u.squad).some(
        (v) => v !== u && v.firstAidUntil !== undefined,
      );
      if (!squadAider && !firstAidHotZone(s, u)) {
        let bestPatient: Unit | undefined;
        for (const q of squadMates(s, u.side, u.squad)) {
          if (
            q.wounded &&
            q.draggedByUid === undefined &&
            q.firstAidByUid === undefined &&
            (q.stabilizedUntil ?? 0) <= s.time &&
            q.bleedOut > 0 &&
            q.bleedOut < 20 &&
            s.time - (q.rescuedAt ?? -99) > 3 &&
            Math.abs(q.x - u.x) <= 64 &&
            (q.side === 0 ? q.x > 110 : q.x < W - 110) &&
            (!bestPatient || q.bleedOut < bestPatient.bleedOut)
          )
            bestPatient = q;
        }
        if (bestPatient) {
          u.firstAidTargetUid = bestPatient.uid;
          u.firstAidUntil = s.time + 1.5;
          bestPatient.firstAidByUid = u.uid;
        }
      }
    }
    const morale = s.players[u.side].morale > 0;
    const syn = unitSynergy(s, u, s.time);
    u.injuryCooldown = Math.max(0, u.injuryCooldown - dt);
    const weaponStep = dt * (syn.supply_run ? 1.6 : 1) * (syn.recon_spot ? 1.3 : 1);
    u.cooldown -= weaponStep;
    // Work flags are reset at tick start; retain last tick's occupied hands.
    if (!launcherBusy) advanceLauncherDrill(u, s.time, weaponStep);
    // Small-arms magazines: lazy-init on first tick, then seat a fresh mag
    // once the reload window closes. A dry reserve leaves the weapon silent.
    if (u.ammo === undefined) {
      const spec = magazine(u.id, u.member);
      u.ammo = spec ? spec.mag : -1;
      u.ammoReserve = spec ? spec.reserve : 0;
    } else if (
      (u.ammo === 0 || u.tacticalReload) &&
      (u.reloadingUntil ?? 0) > 0 &&
      s.time >= u.reloadingUntil!
    ) {
      const spec = magazine(u.id, u.member);
      if (spec) {
        if (u.tacticalReload) {
          // v114: top-up — the rounds still in the mag are kept, only the
          // missing ones come up from reserve.
          const take = Math.min(spec.mag - u.ammo, u.ammoReserve ?? 0);
          u.ammo += take;
          u.ammoReserve = Math.max(0, (u.ammoReserve ?? 0) - take);
          u.tacticalReload = false;
        } else {
          const take = Math.min(spec.mag, u.ammoReserve ?? 0);
          u.ammo = take;
          u.ammoReserve = Math.max(0, (u.ammoReserve ?? 0) - take);
        }
      }
      u.reloadingUntil = 0;
      u.relayReload = false;
    }
    u.secondaryCooldown -= dt;
    u.secondaryFire = Math.max(0, u.secondaryFire - dt);
    u.suppression = Math.max(
      0,
      u.suppression -
        dt *
          7 *
          (syn.armor_assault ? 1.6 : 1) *
          (syn.smoke_screen ? 1.5 : 1) *
          (syn.overwatch ? 1.35 : 1) *
          (c.infantryAbility === 'swarm' ? 1.8 : 1) *
          vacuumSuppressionFactor(s, u),
    );
    if (stepHandGrenade(s, u)) continue;
    if (c.members) {
      prepareInfantry(s, u, dt);
      decideTactic(s, u, dt);
    }
    if (u.surrendered) continue;
    u.supportCooldown -= dt;
    u.healing = Math.max(0, u.healing - dt);
    if (u.repairTime > 0) {
      u.hp = Math.min(u.maxHp, u.hp + Math.min(dt, u.repairTime) * 20);
      u.repairTime = Math.max(0, u.repairTime - dt);
    }
    u.flash = Math.max(0, u.flash - dt);
    u.fire = Math.max(0, u.fire - dt);
    if (u.id === 'mortar' && u.moving) u.mortarSiteShots = 0;
    u.moving = false;
    if(u.glider){
      stepGlider(s,u,dt,{spawn:spawnUnit,crash:v=>finishDeath(s,v,v.side,'bullet')});
      continue;
    }
    if (u.id === 'loiter_drone') {
      flyLoiterMunition(s, u, dt);
      continue;
    }
    const controlledNavigation = stepUnitControl(s, u, dt);
    if (u.id === 'mortar_carrier' && controlledNavigation) {
      u.displaceGoal = null;
      if (u.moving) u.carrierSettleUntil = s.time + CARRIER_SETTLE;
    }
    const localOrder = localUnitOrder(s, u);
    const order = c.members
      ? infantryOrder(s, u)
      : localOrder
        ? localOrder === 'watch'
          ? 'hold'
          : 'advance'
        : s.players[u.side].order;
    // v91: a badly mauled armoured vehicle under anti-tank threat plans a
    // reverse behind its infantry screen. The flag it sets is consumed by
    // the movement block below.
    if (c.armored && !c.air) planVehicleReverse(s, u);
    if (c.airlift) {
      if (!controlledNavigation) flyTransport(s, u, dt);
      rotorWash(s, u, dt);
      continue;
    }
    if (u.id === 'fpv_drone') {
      if (!controlledNavigation || s.time >= (u.flightUntil ?? Infinity))
        flyFpv(s, u, dt);
      continue;
    }
    u.stepCooldown = Math.max(0, u.stepCooldown - dt);
    u.coverSearch -= dt;
    const worksite = c.members ? trenchWorksite(s, u) : null;
    let desiredPose: Unit['pose'] = c.members
      ? order === 'crouch'
        ? 'crouch'
        : order === 'prone'
          ? 'prone'
          : u.tactic === 'prone'
            ? 'prone'
            : u.tactic === 'crouch' ||
                u.tactic === 'cover' ||
                u.tactic === 'bound'
              ? 'crouch'
              : 'idle'
      : 'idle';
    // An ongoing service task requests the same height before the generic
    // combat stance commits. Otherwise every expired ten-second lock could
    // make a treating medic stand up and immediately ask to kneel again.
    if (previousWork.tending && c.members && order !== 'prone')
      desiredPose = u.pose === 'prone' ? 'prone' : 'crouch';
    // Choose the real work height before the generic stance gate. Otherwise
    // a prone worker first stands up, locks for ten seconds, then kneels.
    if (worksite?.pending && (u.contactUntil ?? 0) <= s.time && u.suppression < 35 &&
        Math.abs(u.x-worksite.x)<=1 && Math.abs(u.lane-worksite.lane)<=.5 &&
        order !== 'prone') desiredPose = 'crouch';
    // A tripod is worked from a low position; this request still passes the
    // shared ten-second posture gate and the authored transition below.
    if (isHeavyGunner(u) && ((u.contactUntil ?? 0) > s.time ||
        Math.abs(u.x - (u.side === 0 ? W - 70 : 70)) <= unitRange(s,u)) &&
        order !== 'rush' && desiredPose === 'idle') desiredPose = 'crouch';
    // Choose a usable firing height BEFORE committing for ten seconds. The
    // old order first locked a crouch, then immediately asked the peek layer
    // to stand up again; honoring the lock consequently left that man silent.
    if (c.members && !c.indirect && !isHeavyGunner(u) && u.suppression < 65 &&
        order !== 'prone' && order !== 'crouch' &&
        !previousWork.tending && desiredPose !== 'idle' && s.time >= (u.stanceLockUntil ?? 0)) {
      const lowBody = { ...u, pose: desiredPose, moving: false };
      if (s.units.some(enemy => enemy.side !== u.side && isCombatant(enemy) &&
          !CARDS[enemy.id].air && visibleToSide(s, u.side, enemy) &&
          Math.abs(enemy.x - u.x) <= unitRange(s, u) + 120 &&
          [0, 12, 24].some(step => {
            const x = u.x + dir * step;
            return firingHeight(s, { ...lowBody, x, y: ground(s, x) },
              enemy.x, enemy.y - bodyHeight(enemy), true) === standingMuzzleHeight(u);
          }))) {
        desiredPose = 'idle';
        setStance(u, s.time, 'idle');
        // Also commit when already standing: movement/peek code later in the
        // same tick must not immediately replace this chosen firing stance.
        u.stanceLockUntil = s.time + STANCE_COOLDOWN_S;
      }
    }
    // v127: basic stance changes are rate-limited so a squad doesn't hop
    // between stand/crouch/prone every time the tactic context twitches.
    u.pose = c.members
      ? setStance(u, s.time, desiredPose, { travel: (order === 'crouch' || order === 'prone') && (u.contactUntil ?? 0) <= s.time && !previousWork.tending })
      : desiredPose;
    if (c.members && u.withdrawStandby)
      u.pose = setStance(u, s.time, 'crouch', { force: true });
    // A blast that landed nearby pins the soldier: they drop low and stop
    // shooting until the flinch window passes.
    if (
      c.members &&
      (u.flinchUntil ?? 0) > s.time &&
      (u.evadeUntil ?? 0) <= s.time &&
      u.climbing <= 0 &&
      u.motion === 'ground'
    ) {
      // A soldier already committed to a withdrawal keeps scrambling back
      // under fire — the blast drops them low and stops their shooting, but
      // it cannot freeze a retreat in place.
      const pinned =
        (u.withdrawUntil ?? 0) <= s.time || u.withdrawGoal === undefined;
      // v129: route the flinch drop through the stance gate with force, and
      // never lift a man who's already on the deck back to a crouch — that
      // snap-to-crouch-then-back was half the prone twitch.
      let flinchWant: Unit['pose'] = pinned && u.flinchProne ? 'prone' : 'crouch';
      if (stanceClass(u.pose) === 'prone') flinchWant = 'prone';
      u.pose = setStance(u, s.time, flinchWant, { force: true });
      u.fire = 0;
      u.secondaryFire = 0;
      if (pinned) {
        u.moving = false;
        u.coverGoal = null;
        continue;
      }
    }
    if (c.members && u.climbing > 0) {
      u.cover = 0;
      const wall = s.walls.find((w) => w.uid === u.climbWall);
      if (!wall || wall.hp <= 0) {
        u.climbing = 0;
        if (wall) u.passedWalls.push(wall.uid);
        if (ground(s, u.x) - u.y > 3) beginDrop(u, u.facing, 0, true);
      } else {
        u.climbing = Math.max(0, u.climbing - dt);
        const progress = 1 - u.climbing / u.climbDuration;
        const travel = Math.sign(u.motionToX - u.climbFrom) || u.facing;
        const near = wall.x - travel * (wall.width / 2 + 6);
        const far = wall.x + travel * (wall.width / 2 + 6);
        const top = ground(s, wall.x) - wall.height - 1;
        // Lift at the near face, cross on the wall top, then lower at the far face.
        if (progress < 0.28) {
          const t = progress / 0.28;
          u.x = u.climbFrom + (near - u.climbFrom) * t;
          u.y = ground(s, u.climbFrom) + (top - ground(s, u.climbFrom)) * t;
        } else if (progress < 0.72) {
          u.x = near + (far - near) * ((progress - 0.28) / 0.44);
          u.y = top;
        } else {
          const t = (progress - 0.72) / 0.28;
          u.x = far + (u.motionToX - far) * t;
          u.y = top + (ground(s, u.motionToX) - top) * t;
        }
        u.facing = travel;
        u.pose = 'climb';
        u.walk += dt * 5;
        u.moving = true;
        if (u.climbing === 0) u.passedWalls.push(wall.uid);
        continue;
      }
    }
    if (
      c.members &&
      u.motion === 'ground' &&
      ground(s, u.x) - u.y > DROP_HEIGHT
    )
      beginDrop(u, dir, 0, true);
    if (c.members && traverse(s, u, dt)) continue;
    // v129: ground-snap defense. A foot soldier on the ground never floats a
    // pixel above the terrain — any residual offset from a finished bank or a
    // deformed crater is corrected every frame so the sprite can't strike a
    // climb pose in mid-air.
    if (c.members && u.motion === 'ground' && u.climbing <= 0) {
      const gy = ground(s, u.x);
      if (Math.abs(u.y - gy) > 1) u.y = gy;
    }
    if (c.members && !c.air && evadeArtillery(s, u, dt)) continue;
    // Bailing crew stumble away from their burning wreck, disoriented.
    if (c.members && u.bailoutUntil !== undefined && s.time < u.bailoutUntil) {
      u.fire = 0;
      u.secondaryFire = 0;
      u.cover = 0;
      u.coverGoal = null;
      u.suppression = Math.max(u.suppression, 55);
      // v129: suppression jitters around the 78 threshold, which used to flip
      // bailing crew between prone and hunker every frame. Gate it with
      // force and keep a man on the deck once he's down.
      let bailWant: Unit['pose'] =
        u.suppression > 78 ? 'prone' : u.suppression > 55 ? 'hunker' : 'crouch';
      if (stanceClass(u.pose) === 'prone') bailWant = 'prone';
      u.pose = setStance(u, s.time, bailWant, { force: true });
      u.facing = -dir;
      moveSoldier(
        s,
        u,
        -dir,
        c.speed! * u.pace * 0.38 * (morale ? 1.2 : 1),
        dt,
      );
      if (!u.moving && u.motion === 'ground')
        u.pose = setStance(
          u,
          s.time,
          stanceClass(u.pose) === 'prone'
            ? 'prone'
            : u.suppression > 55
              ? 'hunker'
              : 'crouch',
          { force: true },
        );
      continue;
    }
    if (c.members && u.tactic === 'retreat' && !orderedWithdrawal(s, u)) {
      if (recoverRetreat(s, u, dt)) continue;
      u.cover = 0;
      u.coverGoal = null;
      u.fire = 0;
      u.pose = setStance(u, s.time, 'run', { force: true });
      u.facing = -dir;
      moveSoldier(s, u, -dir, c.speed! * u.pace * 1.2 * (morale ? 1.2 : 1), dt);
      if (!u.moving && u.motion === 'ground')
        u.pose = setStance(u, s.time, 'idle');
      continue;
    }

    if (c.emplacement && !controlledNavigation && towEmplacement(s, u, dt))
      continue;

    // A locally circling/returning aircraft is not beginning an attack run.
    // The shared sortie-boundary cleanup still returns its card after departure.
    if (controlledNavigation && c.air && c.sortie) continue;
    if (!controlledNavigation && c.patrolTime) flyAirPatrol(s, u, dt);
    else if (!controlledNavigation && c.air && c.sortie) {
      u.x += dir * c.speed! * (morale ? 1.2 : 1) * dt;
      u.facing = dir;
      u.moving = true;
    }
    if (c.air) rotorWash(s, u, dt);
    if (c.attackRun === 'bomb') {
      fireBombRun(s, u);
      u.y = c.altitude ?? AIR_ALTITUDE;
      continue;
    }
    if (c.observer && controlledNavigation) continue;
    if (c.observer) {
      // Observers are air units, so the front line (ground combatants only)
      // never includes u itself; frontX is exact for this query.
      const frontX = s.frontX
        ? s.frontX[u.side]
        : u.side === 0
          ? 650
          : W - 650;
      const goal = Math.max(250, Math.min(W - 250, frontX + dir * 180));
      const change = Math.max(
        -c.speed! * (morale ? 1.2 : 1) * dt,
        Math.min(c.speed! * (morale ? 1.2 : 1) * dt, goal - u.x),
      );
      u.x += change;
      u.moving = Math.abs(change) > 0.1;
      u.facing = Math.sign(change) || dir;
      u.y = c.altitude ?? AIR_ALTITUDE;
      u.fire = 0;
      continue;
    }

    const range = unitRange(s, u);
    let treating = serviceVehicle(s, u);
    if (c.heal) {
      const medicalSettingUp = (u.medicalReadyAt ?? 0) > s.time;
      const patient = medicalSettingUp ? undefined : pickMedicPatient(s, u);
      if (c.static) {
        treating = true;
        u.moving = false;
        setStance(u, s.time, u.pose === 'prone' ? 'prone' : 'crouch');
      }
      if (patient) {
        treating = true;
        u.pose = setStance(u, s.time, u.pose === 'prone' ? 'prone' : 'crouch');
        const movingToPatient =
          !c.static && patient.wounded && Math.abs(patient.x - u.x) > 64;
        if (movingToPatient) {
          u.pose = setStance(u, s.time, 'walk');
          moveSoldier(
            s,
            u,
            Math.sign(patient.x - u.x),
            c.speed! * u.pace * 0.8,
            dt,
          );
        } else {
          continueSupportWork(u, previousWork, 'medical', patient.uid, s.time, dt);
          if (patient.x !== u.x) u.facing = Math.sign(patient.x - u.x);
          if (u.supportCooldown <= 0) {
            if (patient.wounded) {
              // v132: 治疗量越高的医疗单位扶起倒地伤员越快
              patient.rescueProgress += 0.8 * Math.max(1, c.heal / 6);
              patient.rescuedAt = s.time;
            }
            patient.hp = Math.min(patient.maxHp, patient.hp + c.heal);
            patient.healing = 0.6;
            u.healing = 0.6;
            u.supportCooldown = 0.8;
          }
        }
      } else {
        // v79: no patient in triage range — a medic follows a fresh friendly
        // blood trail to where a casualty was last dragged, closing the gap
        // until normal triage picks the man up. Enemy blood is ignored:
        // medics do not chase the other side's wounded.
        const intel = s.traceIntel[u.side];
        if (
          !c.static && intel &&
          intel.side === u.side &&
          intel.until > s.time &&
          Math.abs(intel.x - u.x) > 40 &&
          Math.abs(intel.x - u.x) < 320 &&
          u.squadOrder !== 'retreat'
        ) {
          // Treat the trail as a live task: squad movement and fire commands
          // must not yank the medic off the blood trail mid-follow, exactly
          // like the move-to-patient branch above.
          treating = true;
          u.pose = setStance(u, s.time, 'walk');
          moveSoldier(
            s,
            u,
            Math.sign(intel.x - u.x),
            c.speed! * u.pace * 0.8,
            dt,
          );
        }
      }
    }
    // v132: 维修工兵（mechanic）自动靠近受损己方装甲车辆进行抢修
    if (c.trait === 'mechanic' && c.members && !controlledNavigation &&
        !orderedWithdrawal(s,u) && u.tactic !== 'retreat' && localUnitOrder(s,u) !== 'retreat') {
      const vehicle = pickRepairVehicle(s,u);
      if (vehicle) {
        treating = true;
        const station = repairStation(u,vehicle), delta = station-u.x;
        if (Math.abs(delta) > REPAIR_CONTACT_TOLERANCE) {
          u.pose = setStance(u, s.time, u.pose === 'prone' ? 'prone' : 'walk');
          moveSoldier(
            s,
            u,
            Math.sign(delta),
            Math.min(c.speed! * u.pace * 0.85, Math.abs(delta)/Math.max(dt,.001)),
            dt,
          );
        } else if (atRepairContact(u,vehicle)) {
          u.pose = setStance(u, s.time, u.pose === 'prone' ? 'prone' : 'crouch');
          continueSupportWork(u, previousWork, 'repair', vehicle.uid, s.time, dt);
          if (vehicle.x !== u.x) u.facing = Math.sign(vehicle.x - u.x);
          // A first tool stroke must actually happen: lowering, walking or a
          // departing vehicle cannot repair armor while the drill is hidden.
          if ((u.tendingTime ?? 0) >= REPAIR_FIRST_WORK_S && u.supportCooldown <= 0) {
            vehicle.hp = Math.min(vehicle.maxHp, vehicle.hp + 8);
            vehicle.healing = 0.6;
            u.healing = 0.6;
            u.supportCooldown = 0.5;
          }
        }
      }
    }
    const primaryAmmo = ammunition(u.id, u.member);
    const softTargetWeapon =
      !c.armorOnly &&
      (c.armorMultiplier ?? 1) <= 1.2 &&
      (primaryAmmo === 'rifle' || primaryAmmo === 'machinegun');
    const softTargetRank = (v: Unit) =>
      CARDS[v.id].members
        ? 0
        : rifleRotorTarget(u, v)
          ? 3
          : CARDS[v.id].armored
            ? 2
            : 1;
    // Infantry squads concentrate fire on one designated high-value target,
    // while a two-man support team (every third member) suppresses the next
    // nearest visible enemy so the tracer fan covers the whole enemy line.
    let focusUid: number | undefined;
    if (c.members) {
      const squadFocusUid = squadFocus(s, u.side, u.squad, s.time);
      focusUid = squadFocusUid;
      if (
        squadFocusUid !== undefined &&
        u.member % 3 === 1 &&
        !c.indirect &&
        !c.air &&
        !c.armorOnly &&
        order !== 'rush'
      ) {
        focusUid =
          squadSuppressionTarget(
            s,
            u.side,
            u.squad,
            squadFocusUid,
            s.time,
          ) ?? squadFocusUid;
      }
    }
    // Spatial pre-filter: only nearby cells are scanned, then the exact
    // predicate below (including the precise distance checks) is applied.
    nearUnits(s, u.x, range, candNearScratch);
    candOutScratch.length = 0;
    for (const v of candNearScratch) {
      if (
        v.side !== u.side &&
        v.hp > 0 &&
        !v.surrendered &&
        !v.wounded &&
        visibleToSide(s, u.side, v) &&
        (!airborneTarget(v) || c.antiAir || rifleRotorTarget(u, v)) &&
        (!c.airOnly || airborneTarget(v)) &&
        (!c.armorOnly || CARDS[v.id].armored || CARDS[v.id].vehicle) &&
        (!c.patrolTime || !u.patrolExiting) &&
        (!c.sortie ||
          (v.x - u.x) * (c.patrolTime ? u.facing : dir) >
            muzzleOffset(u) + 8) &&
        (c.attackRun !== 'strafe' ||
          (v.x - u.x) * dir > muzzleOffset(u) + 16) &&
        Math.abs(v.x - u.x) <= range &&
        Math.abs(v.x - u.x) >= (c.minRange ?? 0)
      )
        candOutScratch.push(v);
    }
    // The ranking mode and each candidate's rank are invariant within one
    // sort, so precompute a numeric key per candidate instead of recomputing
    // ammunition/model lookups on every comparator call.
    const coverAmmo = isCoverBullet(primaryAmmo);
    const tankDoctrine = isBattleTank(u.id);
    const concentrations = u.id === 'heavy_tank' ? infantryConcentrations(candOutScratch) : undefined;
    const sortMode: 'soft' | 'sniper' | 'crew' | 'armor' | 'tank' | 'none' =
      tankDoctrine ? 'tank' :
      u.id === 'sniper_team' && u.member === 0 ? 'crew' :
      c.attackRun === 'strafe' ||
      softTargetWeapon ||
      ((c.armorMultiplier ?? 1) < 0.8 && coverAmmo)
        ? 'soft'
        : modelOf(u.id) === 'sniper'
          ? 'sniper'
          : modelOf(u.id) === 'tank' || (c.armorMultiplier ?? 1) > 1.2
            ? 'armor'
            : 'none';
    for (const v of candOutScratch) {
      const rank =
        sortMode === 'tank' ? tankTargetPriority(u, v, concentrations) :
        sortMode === 'crew'
          ? !CARDS[v.id].members ? 3
            : ['machinegun', 'mortar', 'rocket'].includes(weaponCard(v).model ?? modelOf(v.id)) ? 0
              : modelOf(v.id) === 'sniper' && !isPrecisionObserver(v) ? 1 : 2
          : sortMode === 'soft'
          ? softTargetRank(v)
          : sortMode === 'sniper'
            ? Number(!CARDS[v.id].members)
            : sortMode === 'armor'
              ? Number(!CARDS[v.id].armored)
              : 0;
      v.sortKey =
        (sortMode === 'crew' || v.uid === focusUid ? 0 : 1_000_000) +
        rank * 10_000 +
        // AT teams concentrate on the most damaged armoured vehicle: a
        // crippled tank still shoots, so finishing it beats splitting fire.
        ((sortMode === 'armor' || u.id === 'tank') && CARDS[v.id].armored
          ? Math.floor((v.hp / v.maxHp) * 8) * 300
          : 0) +
        Math.abs(v.x - u.x);
    }
    const candidates = candOutScratch.sort((a, b) => a.sortKey! - b.sortKey!);
    if (candidates[0])
      u.lastThreat = {
        x: candidates[0].x,
        y: candidates[0].y,
        until: s.time + 3,
      };
    if (candidates[0])
      u.reconMemory = {
        x: candidates[0].x,
        y: candidates[0].y,
        until: s.time + 3,
      };
    const contactUnit =
      c.members && u.contactAir ? unitByUid(s, u.contactUid) : undefined;
    const airContact =
      contactUnit &&
      isCombatant(contactUnit) &&
      sustainedAirThreat(contactUnit) &&
      visibleToSide(s, u.side, contactUnit) &&
      Math.abs(contactUnit.x - u.x) <=
        Math.min(560, unitRange(s, contactUnit) + 40)
        ? contactUnit
        : undefined;
    // Unarmed-for-air infantry takes cover, while actual AA retains its own target selection.
    // Observers hold their useful sight line instead of marching into rifle range.
    const precisionObserver = isPrecisionObserver(u);
    const observerMate = precisionObserver ? precisionPartner(s, u) : undefined;
    const observerDestination = observerMate ? observerMate.x - dir * 36 : u.x;
    // Hysteresis: follow the rifle, not the generic unarmed-unit advance.
    // No early return: casualty aid, withdrawal and contact-line safety still apply.
    if (precisionObserver) {
      if (Math.abs(observerDestination - u.x) > 60) u.observerFollowing = true;
      if (!observerMate || Math.abs(observerDestination - u.x) <= 8) u.observerFollowing = false;
    }
    const observerTravel = precisionObserver && u.observerFollowing;
    const observing =
      (precisionObserver && !observerTravel) ||
      !!(airContact && !c.antiAir && order !== 'rush') ||
      (u.id === 'scouts' &&
        order !== 'rush' &&
        !candidates.length &&
        nearUnits(s, u.x, 600, scanNearScratch).some(
          (v) =>
            v.side !== u.side &&
            isCombatant(v) &&
            !CARDS[v.id].air &&
            Math.abs(v.x - u.x) <= 600 &&
            visibleToSide(s, u.side, v),
        ));
    const threat =
      candidates[0] ??
      airContact ??
      (u.lastThreat && u.lastThreat.until > s.time ? u.lastThreat : null);
    let target = candidates.find(
      (v) => firingHeight(s, u, v.x, v.y - bodyHeight(v)) !== null,
    );
    if (
      target &&
      CARDS[target.id].members &&
      isCoverBullet(ammunition(u.id, u.member))
    ) {
      const protectedTarget = target;
      target =
        candidates.find(
          (v) =>
            CARDS[v.id].infantryAbility === 'guard' &&
            !v.moving &&
            v.motion === 'ground' &&
            (v.stillFor ?? 0) >= 0.65 &&
            Math.abs(v.x - protectedTarget.x) <= 90 &&
            firingHeight(s, u, v.x, v.y - bodyHeight(v)) !== null,
        ) ?? target;
    }
    if (
      target &&
      c.infantryAbility === 'smoke_assault' &&
      !u.smokeAssaultSpent &&
      !CARDS[target.id].air &&
      Math.abs(target.x - u.x) <= 140
    ) {
      s.smokes.push({ x: u.x, life: 4, side: u.side });
      for (const mate of squadMates(s, u.side, u.squad)) {
        mate.smokeAssaultSpent = true;
        if (isCombatant(mate) && Math.abs(mate.x - u.x) <= 96) {
          mate.assaultBurstUntil = s.time + 4;
          mate.assaultSurgeUntil = s.time + 3.2;
        }
      }
    }
    if (c.frags) {
      // Hand grenades can arc over cover even if the rifle has no firing ray.
      const relay = u.id === 'assault_grenadiers';
      const inFragRange = (v: Unit) => !CARDS[v.id].air &&
        (!relay || (!CARDS[v.id].armored && !CARDS[v.id].vehicle)) &&
        Math.abs(v.x - u.x) >= 70 && Math.abs(v.x - u.x) <= 220;
      const fragTarget = (relay ? candidates.find(v => inFragRange(v) && grenadePriorityTarget(v)) : undefined)
        ?? candidates.find(inFragRange);
      if (
        (u.fragLeft ?? 0) > 0 &&
        (u.fragCooldown ?? 0) <= 0 &&
        !u.tending &&
        !u.wounded &&
        u.motion === 'ground' &&
        u.climbing <= 0 &&
        u.tactic !== 'retreat' &&
        u.squadOrder !== 'retreat' &&
        (u.withdrawUntil ?? 0) <= s.time &&
        (u.reloadingUntil ?? 0) <= s.time &&
        !stanceTransitionActive(u, s.time) && !crouchMotionActive(u) && crouchTravelAmount(u) === 0 && proneTravelAmount(u) === 0 &&
        fragTarget &&
        (!relay || grenadeRelayReady(s,u,mate =>
          Math.abs(mate.x-fragTarget.x)<=unitRange(s,mate) &&
          visibleToSide(s,u.side,fragTarget) &&
          firingHeight(s,mate,fragTarget.x,fragTarget.y-bodyHeight(fragTarget))!==null))
      ) {
        const clusterNear = nearUnits(s, fragTarget.x, 40, scanNearScratch);
        let clusterCount = 0;
        let clusterSumX = 0;
        for (const v of clusterNear) {
          if (
            v.side !== u.side &&
            isCombatant(v) &&
            !CARDS[v.id].air &&
            (!relay || (!CARDS[v.id].armored && !CARDS[v.id].vehicle)) &&
            visibleToSide(s, u.side, v) &&
            Math.abs(v.x - fragTarget.x) <= 40 &&
            Math.abs(v.x - u.x) <= 220
          ) {
            clusterCount++;
            clusterSumX += v.x;
          }
        }
        // Never lob a blast into an ally already contesting that position.
        if ((clusterCount >= 2 || (relay && clusterCount === 1 && grenadePriorityTarget(fragTarget))) &&
            !s.units.some(v => v.side === u.side &&
            v.hp > 0 && !CARDS[v.id].air && Math.abs(v.x - clusterSumX / clusterCount) < 55)) {
          const cx = clusterSumX / clusterCount;
          const cy = ground(s, cx);
          const origin = grenadeReleaseOrigin(u,Math.sign(cx-u.x)||dir);
          const hit = relay ? directShotIntercept(s,'grenade',origin.x,origin.y,cx,cy) : null;
          // Soil contact at the intended landing point is allowed, an early
          // roof/bank collision is not. Actual flight still uses normal collision.
          if (!hit || Math.hypot(hit.x-cx,hit.y-cy)<=8) {
            u.fragThrow = GRENADE_THROW_S;
            u.fragThrowStartedAt = s.time;
            u.fragAim = { x: cx, y: cy };
            u.fragCooldown = 6;
            u.facing = Math.sign(cx - u.x) || dir;
            stepHandGrenade(s, u);
            continue;
          }
       }
     }
   }
  const baseInRange =
    !target &&
    !c.airOnly &&
    !c.armorOnly &&
    (c.attackRun !== 'strafe' ||
      (baseX - u.x) * dir > muzzleOffset(u) + 16) &&
    Math.abs(baseX - u.x) <= range &&
    Math.abs(baseX - u.x) >= (c.minRange ?? 0) &&
    (Math.abs(baseX - u.x) < 60 ||
      firingHeight(s, u, baseX, ground(s, baseX) - 25) !== null);
    // Counter-battery: a howitzer with no visible target can fire at a
    // fresh sound-ranging fix on an enemy battery position.
    let counterBattery: BatteryReport | null = null;
    if (
      c.emplacement === 'howitzer' &&
      !target &&
      !baseInRange
    ) {
      counterBattery =
        s.batteryReports
          .filter(
            (r) =>
              r.side === u.side &&
              r.life > 3 &&
              Math.abs(r.x - u.x) <= range &&
              Math.abs(r.x - u.x) >= (c.minRange ?? 0),
          )
          .sort((a, b) => b.hits - a.hits || b.life - a.life)[0] ?? null;
    }
    // A howitzer's dead zone excludes that target, not a separate valid distant target.
    const closeThreat =
      c.minRange &&
      !(
        (c.emplacement === 'howitzer' || u.id === 'tow_ifv') &&
        (target || baseInRange || counterBattery)
      )
        ? nearUnits(s, u.x, c.minRange!, scanNearScratch).find(
            (v) =>
              v.side !== u.side &&
              isCombatant(v) &&
              visibleToSide(s, u.side, v) &&
              !CARDS[v.id].air &&
              Math.abs(v.x - u.x) < c.minRange!,
          )
        : null;
    let withdrawing = !!(
      c.members &&
      (u.withdrawUntil ?? 0) > s.time &&
      u.withdrawGoal !== undefined &&
      order !== 'hold' &&
      order !== 'rush'
    );
    let withdrawalThreat: Unit | undefined;
    if (withdrawing) {
      withdrawalThreat =
        (target && tacticalReach(s, target, u, 36) ? target : undefined) ??
        airContact;
      if (!withdrawalThreat) {
        const near = nearUnits(s, u.x, 640, scanNearScratch);
        let bestDist = Infinity;
        for (const v of near) {
          if (
            v.side !== u.side &&
            (!CARDS[v.id].air || sustainedAirThreat(v)) &&
            isCombatant(v) &&
            visibleToSide(s, u.side, v) &&
            Math.abs(v.x - u.x) <= 640 &&
            tacticalReach(s, v, u, 36)
          ) {
            const d = Math.abs(v.x - u.x);
            if (d < bestDist) {
              bestDist = d;
              withdrawalThreat = v;
            }
          }
        }
      }
    }
    if (
      withdrawing &&
      !orderedWithdrawal(s, u) &&
      u.withdrawHeavyUid === undefined
    ) {
      if (withdrawalThreat) u.withdrawSafeSince = undefined;
      else {
        u.withdrawSafeSince ??= s.time;
        if (s.time - u.withdrawSafeSince >= 0.55) {
          withdrawing = false;
          u.withdrawUntil = 0;
          u.withdrawGoal = undefined;
          u.passingLane = undefined;
        }
      }
    }
    // Only squad mates (or, against air threats, nearby anti-air units) can
    // satisfy this check — iterate the squad index instead of scanning every
    // unit on the field.
    let withdrawalCoverPossible = false;
    if (withdrawalThreat) {
      const threat = withdrawalThreat;
      const threatAir = CARDS[threat.id].air;
      const threatArmored = CARDS[threat.id].armored;
      const coverCheck = (v: Unit): boolean =>
        !!(
          v !== u &&
          v.side === u.side &&
          isCombatant(v) &&
          (!threatAir || weaponCard(v).antiAir) &&
          (!threatArmored ||
            weaponCard(v).penetration ||
            (weaponCard(v).armorMultiplier ?? 1) > 1.2) &&
          (CARDS[v.id].members || threatAir) &&
          Math.abs(v.x - threat.x) <= unitRange(s, v) &&
          firingHeight(
            s,
            v,
            threat.x,
            threat.y - bodyHeight(threat),
          ) !== null
        );
      const mates = squadMates(s, u.side, u.squad);
      for (let i = 0; i < mates.length; i++) {
        if (coverCheck(mates[i])) {
          withdrawalCoverPossible = true;
          break;
        }
      }
      if (!withdrawalCoverPossible && threatAir) {
        nearUnits(s, u.x, 260, scanNearScratch);
        for (let i = 0; i < scanNearScratch.length; i++) {
          const v = scanNearScratch[i];
          if (Math.abs(v.x - u.x) <= 260 && coverCheck(v)) {
            withdrawalCoverPossible = true;
            break;
          }
        }
      }
    }
    const withdrawalStep =
      withdrawing &&
      Math.abs(u.withdrawGoal! - u.x) > 0.5 &&
      (!withdrawalThreat ||
        (Math.floor((s.time - u.withdrawStartedAt!) / 1.8) % 2 ===
          u.withdrawGroup &&
          (!withdrawalCoverPossible ||
            coveringMate(s, u, withdrawalThreat, true))));
    if (
      c.members &&
      threat &&
      !withdrawing &&
      order !== 'rush' &&
      !c.indirect &&
      !treating
    ) {
      if (
        u.coverGoal !== null &&
        (craterCover(s, u.coverGoal, threat.x) < 0.2 ||
          Math.abs(threat.x - u.coverGoal) > range ||
          !canFireFromCover(s, u, u.coverGoal, threat))
      )
        u.coverGoal = null;
      u.cover = craterCover(s, u.x, threat.x);
      // Hold an already useful firing position instead of climbing out or bounding past it.
      if (
        u.coverGoal === null &&
        u.cover > 0.2 &&
        canFireFromCover(s, u, u.x, threat)
      )
        u.coverGoal = u.x;
      if (u.coverGoal === null && order !== 'hold' && u.coverSearch <= 0) {
        u.coverGoal = seekCover(s, u, threat);
        u.coverSearch = 0.7;
      }
    } else {
      u.cover = 0;
      u.coverGoal = null;
    }
    if (
      c.members &&
      !withdrawing &&
      order !== 'hold' &&
      u.dispersionGoal !== undefined &&
      (u.dispersionUntil ?? 0) > s.time
    ) {
      // A good crater is not an unlimited-capacity position. Let the assigned movers leave it.
      u.coverGoal = null;
    }
    const coverShot =
      !target && order !== 'hold' && order !== 'rush'
        ? enemyCoverShot(s, u, candidates[0])
        : null;
    // Recon by fire: infantry with a fresh contact but no visible target walk
    // controlled bursts onto the last known enemy position. The rounds suppress
    // anyone still near that spot and screen the squad's own movement.
    let reconFire: { x: number; y: number } | null = null;
    if (
      c.members &&
      !c.indirect &&
      !c.airOnly &&
      !c.armorOnly &&
      !target &&
      !coverShot &&
      !baseInRange &&
      !counterBattery &&
      u.reconMemory &&
      u.reconMemory.until > s.time &&
      // Recon by fire is a stationary, probing tactic. A squad on the advance
      // should regain contact through movement, not by walking bursts onto a
      // remembered spot — the near-miss pressure feeds back into friendly
      // dispersal and stalls the very maneuver the advance ordered.
      infantryOrder(s, u) !== 'advance' &&
      // A static watch post that loses sight should wait for the enemy to
      // reappear, not probe a remembered spot — its near-miss suppression
      // stalls the advancing squad's dispersal out of cover.
      u.squadOrder !== 'watch' &&
      s.time >= (u.reconFireNextAt ?? 0) &&
      (u.suppression > 25 || (u.lastCombatShotAt ?? -100) > s.time - 6)
    ) {
      const lt = u.reconMemory;
      const dist = Math.abs(lt.x - u.x);
      if (
        dist >= (c.minRange ?? 0) &&
        dist <= range &&
        (lt.x - u.x) * dir > 0 &&
        firingHeight(s, u, lt.x, lt.y - 20) !== null
      ) {
        reconFire = { x: lt.x, y: lt.y };
      }
    }
    const blockedContact = !!(
      c.members &&
      !airContact &&
      !c.indirect &&
      !target &&
      !baseInRange &&
      !closeThreat &&
      threat &&
      order !== 'rush' &&
      Math.abs(threat.x - u.x) <= range + 15
    );
    if (
      blockedContact &&
      !coverShot &&
      order !== 'hold' &&
      !treating &&
      !withdrawing
    ) {
      if (
        u.firingGoal != null &&
        ((!u.firingTransit && !canFireFromCover(s, u, u.firingGoal, threat!)) ||
          Math.abs(u.firingGoal - u.x) <= 1)
      )
        u.firingGoal = null;
      if ((u.firingSearchAt ?? 0) <= s.time && u.firingGoal == null) {
        u.firingGoal = nearbyFiringPosition(s, u, threat!);
        u.firingTransit = false;
        if (u.firingGoal === null) {
          const toward = Math.sign(threat!.x - u.x);
          const standoff = Math.max(140, (c.minRange ?? 0) + 25);
          const available = Math.abs(threat!.x - u.x) - standoff;
          if (available > 4) {
            // Walk a depth passage beside the obstacle, then reassess the firing ray.
            u.firingGoal = u.x + toward * Math.min(32, available);
            u.firingTransit = true;
          }
        }
        u.firingSearchAt = s.time + 0.7;
      }
    } else u.firingGoal = null;
    // Combat engineers push to a breachable wall instead of stopping to trade
    // rifle shots — their job is demolition, and the breach only triggers from
    // moveSoldier, so they must keep moving the last stretch under fire.
    const breachRun = !!(
      c.members &&
      CARDS[u.id].trait === 'engineer' &&
      order !== 'hold' &&
      order !== 'prone' &&
      s.walls.some(
        (w) =>
          w.hp > 0 &&
          (w.x - u.x) * dir >= w.width / 2 + 5 &&
          Math.abs(w.x - u.x) < w.width / 2 + 40,
      )
    );
    if (
      (u.dispersionUntil ?? 0) <= s.time ||
      (u.dispersionGoal !== undefined && Math.abs(u.dispersionGoal - u.x) <= 1)
    )
      u.dispersionGoal = undefined;
    const holdTravel =
      worksite &&
      !target &&
      !threat &&
      !closeThreat &&
      !treating &&
      !withdrawing &&
      u.tactic !== 'retreat' &&
      (Math.abs(worksite.x - u.x) > 0.5 ||
        Math.abs(worksite.lane - u.lane) > 0.5);
    const escorting = !!(
      c.members &&
      u.escortGoal !== undefined &&
      (!u.squadOrder || u.squadOrder === 'escort')
    );
    const escortTravel = escorting && Math.abs(u.escortGoal! - u.x) > 8;
    const escortAhead = escorting && (u.x - u.escortGoal!) * dir > 12;
    // v81: dry-ammo battle drill. A soldier who has burned through every
    // magazine does not just stand silent: he waves for ammunition, then
    // walks to the nearest buddy with a deep reserve while the fire
    // situation allows, takes a mag, and gets back in the fight. Donors
    // only give up half their reserve so the squad never strips one man
    // to feed another. The search is throttled and the walk gated on
    // suppression / close threats, so under contact the squad keeps
    // whatever fire it has instead of staging a bullet handoff in the open.
    let ammoGoalX: number | null = null;
    let scavengeGoalX: number | null = null;
    const magSpec = magazine(u.id, u.member);
    const dryAmmo =
      !!magSpec &&
      u.ammo === 0 &&
      (u.ammoReserve ?? 0) === 0 &&
      (u.reloadingUntil ?? 0) <= s.time;
    if (dryAmmo && !u.wounded && !u.surrendered) {
      if (s.time >= (u.ammoSignalAt ?? 0)) {
        u.ammoSignalUntil = s.time + 1.4;
        u.ammoSignalAt = s.time + 6.0;
      }
      if (s.time >= (u.ammoSearchAt ?? 0)) {
        u.ammoSearchAt = s.time + 0.6;
        let bestBuddy: Unit | undefined;
        let bestDist = Infinity;
        for (const v of nearUnits(s, u.x, 120, ammoNearScratch)) {
          if (
            v.side === u.side &&
            v.hp > 0 &&
            !v.wounded &&
            !v.surrendered &&
            v.ammo !== 0 &&
            (v.ammoReserve ?? 0) >= 30 &&
            magazine(v.id, v.member)
          ) {
            const d = Math.abs(v.x - u.x);
            if (d < bestDist) {
              bestDist = d;
              bestBuddy = v;
            }
          }
        }
        u.ammoBuddyUid = bestBuddy ? bestBuddy.uid : undefined;
        // v83: no living donor — look for a fallen comrade still carrying
        // the same weapon. A dry rifleman pulls a magazine off a
        // squadmate's body before he goes back in with an empty rifle.
        if (!bestBuddy) {
          let bestWreck: Wreck | undefined;
          let bestWreckDist = Infinity;
          for (const w of s.wrecks) {
            if (
              w.side === u.side &&
              ammunition(w.cardId, w.member ?? 0) ===
                ammunition(u.id, u.member) &&
              (w.ammo ?? 0) + (w.ammoReserve ?? 0) > 0
            ) {
              const d = Math.abs(w.x - u.x);
              if (d < 160 && d < bestWreckDist) {
                bestWreckDist = d;
                bestWreck = w;
              }
            }
          }
          u.scavengeWreckId = bestWreck ? bestWreck.id : undefined;
        } else {
          u.scavengeWreckId = undefined;
        }
      }
      const buddy = unitByUid(s, u.ammoBuddyUid);
      if (
        buddy &&
        buddy.hp > 0 &&
        !buddy.wounded &&
        (buddy.ammoReserve ?? 0) >= 30 &&
        u.suppression < 55 &&
        !closeThreat
      ) {
        const dist = Math.abs(buddy.x - u.x);
        if (dist <= 26) {
          const share = Math.min(
            30,
            Math.floor((buddy.ammoReserve ?? 0) / 2),
          );
          if (share > 0) {
            buddy.ammoReserve = (buddy.ammoReserve ?? 0) - share;
            u.ammoReserve = (u.ammoReserve ?? 0) + share;
            startMagazineDrill(u, s.time, magSpec.reload);
            u.ammoShareUntil = s.time + 1.0;
            buddy.ammoShareUntil = s.time + 1.0;
            u.ammoBuddyUid = undefined;
            // v82: a rescued soldier surges. The magazine handoff is a
            // morale event — suppression drops and, if the enemy is still
            // out there, the man springs up and charges back into rifle
            // range with a faster burst.
            u.suppression = Math.max(0, u.suppression - 35);
            u.assaultBurstUntil = s.time + 4.5;
            if (
              target &&
              !u.wounded &&
              order !== 'prone' &&
              order !== 'hold'
            ) {
              u.assaultSurgeUntil = s.time + 4.5;
              u.rescuedUntil = s.time + 4.5;
            }
          }
        } else {
          ammoGoalX = buddy.x;
        }
      }
      // v83: looting the fallen. Same fire gates as a living handoff:
      // walk to the body, hunker over the weapon for 1.2s, then pull up
      // to 30 rounds — reserve first, then the magazine in the weapon.
      if (ammoGoalX === null) {
        const wreck = s.wrecks.find((w) => w.id === u.scavengeWreckId);
        if (
          wreck &&
          (wreck.ammo ?? 0) + (wreck.ammoReserve ?? 0) > 0 &&
          u.suppression < 55 &&
          !closeThreat
        ) {
          const dist = Math.abs(wreck.x - u.x);
          if (dist <= 26) {
            // 0 means "never started"; a past timestamp means the window
            // has closed and it is time to pull the rounds. Using <= s.time
            // here would re-open the window forever and never transfer.
            if ((u.scavengeUntil ?? 0) === 0) {
              u.scavengeUntil = s.time + 1.2;
            } else if (s.time >= u.scavengeUntil!) {
              const take = Math.min(
                30,
                (wreck.ammoReserve ?? 0) + (wreck.ammo ?? 0),
              );
              const fromReserve = Math.min(take, wreck.ammoReserve ?? 0);
              wreck.ammoReserve = (wreck.ammoReserve ?? 0) - fromReserve;
              wreck.ammo = (wreck.ammo ?? 0) - (take - fromReserve);
              u.ammoReserve = (u.ammoReserve ?? 0) + take;
              startMagazineDrill(u, s.time, magSpec.reload);
              u.scavengeWreckId = undefined;
              u.scavengeUntil = 0;
            }
          } else {
            u.scavengeUntil = 0;
            scavengeGoalX = wreck.x;
          }
        } else {
          u.scavengeUntil = 0;
        }
      }
    } else {
      if (u.ammoBuddyUid !== undefined) u.ammoBuddyUid = undefined;
      if (u.scavengeWreckId !== undefined) {
        u.scavengeWreckId = undefined;
        u.scavengeUntil = 0;
      }
    }
    // v82: rescued-man surge goal. A soldier who just received a buddy's
    // magazine charges back toward the enemy, stopping at rifle range.
    let rescuedGoalX: number | null = null;
    if (
      (u.rescuedUntil ?? 0) > s.time &&
      target &&
      !u.wounded &&
      Math.abs(target.x - u.x) > 320
    ) {
      rescuedGoalX = target.x + dir * 320;
    }
    const moveGoal = withdrawing
      ? u.withdrawGoal!
      : holdTravel
        ? worksite.x
        : u.withdrawStandby
          ? null
          : escorting
            ? escortTravel
              ? u.escortGoal!
              : null
            : (observerTravel ? observerDestination : precisionObserver ? null :
              ammoGoalX ??
              scavengeGoalX ??
              rescuedGoalX ??
              u.coverGoal ??
              u.firingGoal ??
              u.dispersionGoal ??
              null);
    const seeking =
      !withdrawing &&
      (!!holdTravel || (moveGoal !== null && Math.abs(moveGoal - u.x) > 0.5));
    // A new hold order cancels the vehicle's automatic firing-position change.
    // Otherwise a stopped vehicle would retain a goal that also blocks firing.
    if (u.id === 'mortar_carrier' && order === 'hold') u.displaceGoal = null;
    if (u.displaceGoal != null && Math.abs(u.displaceGoal - u.x) <= 2)
      u.displaceGoal = null;
    const displacing = u.displaceGoal != null;
    const dispersionStep =
      seeking &&
      u.dispersionGoal !== undefined &&
      s.time - (u.dispersionStartedAt ?? -100) < 0.8 &&
      target &&
      (u.lastCombatShotAt ?? -100) >= (u.dispersionStartedAt ?? s.time) &&
      coveringMate(s, u, target, true);
    // A ready weapon gets a short stable firing window before another ground move.
    const contactFire = !!(
      c.members &&
      target &&
      // A safe cover/withdrawal move owns its initial rise and first step.
      // Cooldown expiry cannot cancel it halfway and restart it next frame.
      !(Math.max(u.crouchStepCommittedUntil ?? 0,u.proneStepCommittedUntil ?? 0) > s.time &&
        (seeking || displacing || withdrawing || u.tactic === 'bound')) &&
      !dispersionStep &&
      !(escortAhead && s.time - (u.lastCombatShotAt ?? -100) < 0.8) &&
      (u.cooldown <= 0 ||
        s.time - (u.lastCombatShotAt ?? -Infinity) <
          Math.min(0.18, c.rate! * 0.35))
    );
    // v128: never snap a pinned observer back up to idle — the observer
    // hold below owns the prone pose while aircraft are overhead or a
    // scout is scanning. Fighting the two every tick was the prone/up
    // twitch.
    if (
      !seeking &&
      threat &&
      (u.exposedUntil ?? 0) > s.time && !isHeavyGunner(u) &&
      (u.observingHoldUntil ?? 0) <= s.time
    )
      u.pose = setStance(u, s.time, 'idle');
    if (threat && c.members) {
      if ((u.aimUntil ?? 0) <= s.time) u.readyAt = s.time;
      u.aimUntil = s.time + 2.5;
    }
    // v128: hysteresis on the observer pose. `observing` flickers as contact
    // appears and drops out of scan range; snapping straight to prone made
    // scouts bob up and down every few ticks. Require a sustained observing
    // spell before dropping, then hold the pose for a full beat.
    const settledObservation = observing && (!precisionObserver || !observerMate?.moving);
    if (settledObservation) {
      u.observingSince ??= s.time;
    } else {
      u.observingSince = undefined;
    }
    if (settledObservation && s.time - (u.observingSince ?? s.time) > 0.5)
      u.observingHoldUntil = Math.max(
        u.observingHoldUntil ?? 0,
        s.time + 1.2,
      );
    if ((u.observingHoldUntil ?? 0) > s.time) {
      u.pose = setStance(u, s.time, 'prone', { force: true });
      // Spotters hold the radio pose on a timer the renderer can read.
      if (u.id === 'scouts' || precisionObserver) u.observingUntil = s.time + 0.25;
    }
    // v128: while the observer hold is active the soldier is pinned to the
    // deck watching aircraft / scanning — the cover block below must not
    // pop him back up to a crouch every tick (that was the prone/up twitch).
    // Observers in this state have no shot to peek for anyway.
    if (
      u.cover > 0.2 &&
      !seeking &&
      threat &&
      (u.observingHoldUntil ?? 0) <= s.time
    ) {
      // Peek rhythm: pop up to fire, drop back behind cover to reload.
      if (!isHeavyGunner(u) && s.time >= (u.stanceLockUntil ?? 0) &&
          firingHeight(s, u, threat.x, threat.y - 20, true) === standingMuzzleHeight(u))
        peekShouldExpose(s, u);
      const peekExposed = !isHeavyGunner(u) && (u.exposedUntil ?? 0) > s.time;
      if (peekExposed) {
        // Exposure changes firing eligibility, not the posture commitment.
        // Rising over cover obeys the same ten-second gate as other actions.
        setStance(u, s.time, 'idle');
        u.peekDownPose = undefined;
      } else {
        // Down-pose: pick once when the peek ends, then hold it for the
        // whole rest cycle. Recomputing from suppression every frame flipped
        // crouch↔hunker on the 55 threshold and read as twitching.
        if (u.peekDownPose === undefined) {
          u.peekDownPose =
            u.tactic === 'prone' || order === 'prone'
              ? 'prone'
              : u.suppression > 55
                ? 'hunker'
                : 'crouch';
        }
        setStance(u, s.time, u.peekDownPose);
      }
    }
    // v114: a soldier caught mid-reload while in contact stops advancing and
    // drops to a knee — or hunkers if pinned — so the mag swap reads as a
    // deliberate, vulnerable drill. Moving soldiers never reached the
    // animation's reload branch, which is why reloads used to be invisible
    // on the advance. Dry swaps and tactical top-ups both count; the
    // decorative bolt-cycle after a shot does not.
    if (c.infantryAbility==='fire_discipline' && target && CARDS[target.id].members && Math.abs(target.x-u.x)>100 &&
        !seeking && !treating && !displacing && !withdrawing && !withdrawalStep &&
        order!=='rush' && (u.assaultSurgeUntil??0)<=s.time && (u.coverGoal===null) &&
        (u.firingGoal==null))
      tryVeteranReload(s,u,v=>Math.abs(v.x-target.x)<=unitRange(s,v) &&
        visibleToSide(s,v.side,target) &&
        firingHeight(s,v,target.x,target.y-bodyHeight(target))!==null);
    const reloadingUnderContact =
      c.members &&
      (u.observingHoldUntil ?? 0) <= s.time &&
      (u.ammo === 0 || u.tacticalReload) &&
      (u.reloadingUntil ?? 0) > s.time &&
      ((u.contactUntil ?? 0) > s.time || relayReloadActive(u,s.time)) &&
      order !== 'rush' &&
      (u.assaultSurgeUntil ?? 0) <= s.time &&
      !withdrawing &&
      u.tactic !== 'retreat' &&
      !withdrawalStep;
    if (reloadingUnderContact && !relayReloadActive(u,s.time))
      u.pose = setStance(
        u,
        s.time,
        u.suppression > 55 ? 'hunker' : 'crouch',
      );
    // v114: tactical reload — a soldier with a near-empty mag and cover to
    // hide behind tops up during a lull, so he doesn't meet the next contact
    // with three rounds left. Only when genuinely safe: under cover, not
    // pinned, with enough reserve to fill the mag.
    if (
      c.members &&
      (c.infantryAbility !== 'fire_discipline' || (!target && (u.contactUntil??0)<=s.time)) &&
      u.ammo > 0 &&
      !u.tacticalReload &&
      (u.reloadingUntil ?? 0) <= s.time &&
      u.cover > 0.2 &&
      u.suppression < 40 &&
      (u.ammoReserve ?? 0) > 0
    ) {
      const spec = magazine(u.id, u.member);
      if (spec && u.ammo < spec.mag * 0.35 && (u.ammoReserve ?? 0) >= spec.mag) {
        startMagazineDrill(u, s.time, spec.reload * 0.75);
        u.tacticalReload = true;
      }
    }
    // v128: aircraft overhead pins the squad — but route it through the
    // observer hold instead of snapping `u.pose` directly. airContact
    // flickers in and out as planes cross the scan cone, and a bare pose
    // assignment fought the cover/observer blocks every tick (the prone
    // twitch). The hold is sticky and the observer block owns the pose.
    if (airContact && !c.antiAir && !seeking && order !== 'rush')
      u.observingHoldUntil = Math.max(
        u.observingHoldUntil ?? 0,
        s.time + 1.2,
      );
    let bounding =
      c.members &&
      !withdrawing &&
      !escorting &&
      !u.withdrawStandby &&
      !contactFire &&
      u.withdrawPressureSince === undefined &&
      order === 'advance' &&
      u.tactic === 'bound' &&
      u.cover <= 0.2 &&
      u.coverGoal === null &&
      target &&
      Math.abs(target.x - u.x) > range * 0.62 &&
      coveringMate(s, u, target) &&
      s.time >= (u.boundRestUntil ?? 0);
    if (bounding) {
      if (!stanceTransitionActive(u,s.time) && crouchStartDelay(u)+proneStartDelay(u) === 0)
        u.boundStartedAt ??= s.time;
      if (u.boundStartedAt !== undefined && s.time - u.boundStartedAt >= 0.55 + (u.uid % 3) * 0.08) {
        bounding = false;
        u.boundRestUntil = s.time + 1.35;
        u.boundStartedAt = undefined;
      }
    } else u.boundStartedAt = undefined;
    const retreating = c.members && u.tactic === 'retreat';
    if ((u.mgBurstRestUntil ?? 0) <= s.time) u.mgBoundGoal = undefined;
    const mobileBurstCover = !withdrawing && !seeking && !displacing && !treating &&
      !retreating && !withdrawalStep && !reloadingUnderContact && lightMGBound(s,u,target,order);
    if (mobileBurstCover && u.mgBoundGoal === undefined) {
      u.mgBoundGoal = u.x + dir * 24;
      // A covering bound includes the real time needed to rise off the knee.
      // Only a chosen covered move extends the burst rest, not ordinary fire.
      u.mgBurstRestUntil = (u.mgBurstRestUntil ?? s.time) + crouchStartDelay(u)+proneStartDelay(u);
    }
    const mobileBurstStep = mobileBurstCover && Math.abs(u.mgBoundGoal! - u.x) > 1;
    // Prepared ambushers let distant patrols approach instead of revealing
    // themselves at maximum rifle range. An explicit squad attack overrides it.
    const ambushHold = ambushConcealed(u, s.time) && target &&
      Math.abs(target.x - u.x) > AMBUSH_FIRE_RANGE && u.squadOrder !== 'attack' && order !== 'rush';
    // v120: shock_action — a shaken squad freezes for the duration.
    const shocked = c.members && (s.players[u.side].shockUntil ?? 0) > s.time;
    // v91: an armoured vehicle that has decided to reverse out of a kill zone.
    // While reversing it forgoes firing — the crew is focused on backing out
    // — but the hull keeps its face toward the enemy.
    const reversing =
      !c.members && !c.air && (u.vehicleReverseUntil ?? 0) > s.time;
    if ((!c.members || (!stanceTransitionActive(u, s.time) && !crouchMotionActive(u) && !proneMotionActive(u))) &&
        u.id !== 'airborne_at' && (modelOf(u.id) === 'tank' || u.id === 'tow_ifv' || c.armorOnly))
      fireCoax(s, u);
    // v172: stalemate break — a unit pinned in a static firefight against a
    // close, dug-in target it cannot damage (terrain intercepts every round)
    // breaks off and maneuvers instead of burning the clock until the draw.
    // Once the unit has closed to point-blank range it resumes fire: the
    // flatter trajectory may clear the terrain that blocked long-range shots.
   let stalemated = false;
   if (
     target &&
     c.members &&
     !c.indirect &&
     !breachRun &&
     order !== 'rush' &&
     u.ammo !== 0 &&
     Math.abs(target.x - u.x) <= range * 0.62
   ) {
     if (u.stalemateTargetUid !== target.uid) {
       u.stalemateTargetUid = target.uid;
       u.stalemateTargetHp = target.hp;
       u.stalemateSince = s.time;
     } else if (target.hp < (u.stalemateTargetHp ?? target.hp) - 0.01) {
       // Fire is effective — reset the clock.
       u.stalemateTargetHp = target.hp;
       u.stalemateSince = s.time;
     } else if (s.time - (u.stalemateSince ?? s.time) >= STALEMATE_BREAK_S) {
       if (Math.abs(target.x - u.x) > STALEMATE_CLOSE_GAP) {
         stalemated = true;
         u.stalemateCloseUntil = s.time + 2;
       }
     }
   } else if (
     blockedContact &&
     c.members &&
     !c.indirect &&
     !breachRun &&
     threat
   ) {
      // v172b: blocked-contact stalemate — the unit has a threat it cannot
      // acquire as a target (terrain blocks the firing ray) and the
      // blockedContact drill cannot find a firing position. After the
      // grace period it maneuvers to close the distance, where the flatter
      // trajectory may clear the obstacle.
      if (u.stalemateTargetUid !== threat.uid) {
        u.stalemateTargetUid = threat.uid;
        u.stalemateSince = s.time;
      } else if (s.time - (u.stalemateSince ?? s.time) >= STALEMATE_BREAK_S) {
        if (Math.abs(threat.x - u.x) > STALEMATE_CLOSE_GAP) {
          stalemated = true;
          u.stalemateCloseUntil = s.time + 2;
        }
      }
    } else {
    u.stalemateTargetUid = undefined;
    u.stalemateSince = undefined;
  }
   if (
     (c.damage ?? 0) > 0 &&
      !relayReloadActive(u,s.time) &&
      !ambushHold &&
      !mobileBurstStep &&
      !stalemated &&
      (!c.armorOnly || !!target) &&
      (target || coverShot || baseInRange || counterBattery || reconFire) &&
      (!seeking || contactFire) &&
      !displacing &&
      !closeThreat &&
      !treating &&
      (!bounding || contactFire) &&
      !withdrawalStep &&
      !retreating &&
      !reversing &&
      !breachRun &&
      (u.carrierSettleUntil ?? 0) <= s.time &&
      u.ammo !== 0
    ) {
      // v114: a tactical top-up is dropped the instant the soldier commits
      // to a shot — contact trumps housekeeping.
      if (u.tacticalReload) {
        u.tacticalReload = false;
        u.reloadingUntil = 0;
      }
      let tx = target ? target.x : coverShot ? coverShot.x : counterBattery ? counterBattery.x : reconFire ? reconFire.x : baseX;
      let ty = target
        ? target.y - bodyHeight(target)
        : coverShot
          ? coverShot.y
          : counterBattery
            ? ground(s, counterBattery.x) - 8
            : reconFire
              ? reconFire.y - 20
              : ground(s, baseX) - 25;
      // Memory-based aim: walk the burst around the last known position.
      if (reconFire) tx += (fxRnd(s) - 0.5) * 80;
      if (target && c.antiAir && !c.guided && CARDS[target.id].air) {
        const speed = FLIGHT[ammunition(u.id, u.member)].speed;
        const travel = Math.min(1, Math.hypot(tx - u.x, ty - u.y) / speed);
        tx += target.vx * travel;
        ty += target.vy * travel;
      }
      // v109: air-to-ground strafers lead running infantry — a jet on a
      // 560 px/s attack run otherwise hoses empty dirt behind a sprinting
      // squad, which made the strike jet feel like it couldn't hit anything.
      if (target && c.air && !CARDS[target.id].air && !c.indirect) {
        const speed = FLIGHT[ammunition(u.id, u.member)].speed;
        const travel = Math.min(1, Math.hypot(tx - u.x, ty - u.y) / speed);
        tx += target.vx * travel;
        ty += target.vy * travel;
      }
      // v108 radar jam: air units fighting through spoofed sensors scatter
      // their fire around the intended aim point.
      if (c.air && (s.players[u.side].radarJamUntil ?? 0) > s.time) {
        tx += (rnd(s) - 0.5) * 90;
        ty += (rnd(s) - 0.5) * 44;
      }
      // v128: don't pop a pinned observer up to fire at cover — the
      // observer hold owns the pose while aircraft are overhead.
      if (coverShot && (u.observingHoldUntil ?? 0) <= s.time) {
        u.pose = setStance(u, s.time, 'idle');
        u.exposedUntil = s.time + 2.5;
      }
      let spotted = false;
      let burnedReport: BatteryReport | null = null;
      if (c.indirect && u.cooldown <= 0) {
        spotted = scoutSpotter(s, u.side, tx, ground(s, tx) - 8);
        burnedReport =
          s.batteryReports.find(
            (r) =>
              r.side === u.side &&
              r.life > 3 &&
              Math.abs(r.x - tx) <= Math.max(160, r.scatter + 60),
          ) ?? null;
        const scatter =
          (u.id === 'precision' ? 14 : c.emplacement ? 42 : 26) *
          (spotted ? 0.55 : 1) *
          (burnedReport ? 0.45 : 1) *
          veteranScatter(u);
        tx += (rnd(s) - 0.5) * scatter * 2;
        ty = ground(s, tx) - 8;
      }
      // A cooking barrel drags the sight picture off target: the hotter the
      // gun, the wider the wander, until the gunner is forced to change tubes.
      if (!c.indirect && canOverheat(u)) {
        const h = unitHeat(s, u);
        if (h > OVERHEAT_HOT) {
          const jitter = Math.min(14, (h - OVERHEAT_HOT) * 4);
          tx += (rnd(s) - 0.5) * jitter * 2;
        }
      }
      if (c.indirect && !c.vehicle && (u.observingHoldUntil ?? 0) <= s.time)
        u.pose = setStance(u, s.time, 'crouch');
      if (
        u.cooldown <= 0 &&
        (u.id !== 'grenadiers' || (u.launcherCycleRemaining ?? 0) <= 0) &&
        (!c.members || (!stanceTransitionActive(u, s.time) && !crouchMotionActive(u) && !proneMotionActive(u))) &&
        (!isHeavyGunner(u) || heavyMGReady(s,u)) &&
        !overheated(s, u) &&
        !(
          c.members &&
          ['idle', 'walk'].includes(u.pose) &&
          ammunition(u.id, u.member) === 'rifle' &&
          s.time - (u.readyAt ?? -100) < 0.24 * veteranReadiness(u)
        ) &&
        (c.sortieAmmo === undefined || u.shots < c.sortieAmmo) &&
        // A deliberate breach round is meant to collide with this surface.
        (coverShot || firingHeight(s, u, tx, ty) !== null)
      ) {
        if (c.members && !c.indirect && firingHeight(s, u, tx, ty) === standingMuzzleHeight(u)) {
          // v128: never snap the pose per shot — the peek/cover block owns
          // stance. Keep the exposure window alive across the whole burst and
          // push the reload rest past the last shot, so a soldier fires a
          // real burst standing, drops back once, and stays down instead of
          // bobbing up and down round by round (the old 0.35s per-shot
          // extension made him twitch between idle and crouch/prone).
          const burstWindow = Math.max(0.9, (c.rate ?? 0.5) * 4);
          u.exposedUntil = Math.max(
            u.exposedUntil ?? -Infinity,
            s.time + burstWindow,
          );
          u.peekRestUntil = Math.max(
            u.peekRestUntil ?? 0,
            u.exposedUntil + 1.4 + Math.min(1.0, u.suppression * 0.01),
          );
        }
        const point = muzzlePoint(u, tx),
          sx = point.x,
          sy = point.y;
        if (
          coverShot ||
          c.indirect ||
          u.id === 'javelin' ||
          !directShotIntercept(s, ammunition(u.id, u.member), sx, sy, tx, ty)
        ) {
          const closeBurst =
            (u.assaultBurstUntil ?? 0) > s.time &&
            target &&
            Math.abs(target.x - u.x) <= 140;
          const ambush =
            target &&
            CARDS[target.id].members &&
            (c.infantryAbility === 'ambush' || c.infantryAbility === 'elite') &&
            (u.ambushFor ?? 0) >= (c.infantryAbility === 'elite' ? 1 : 2);
          const smallArmsAir = !!(target && rifleRotorTarget(u, target));
          const openingDamage = ambush
            ? c.infantryAbility === 'elite'
              ? 1.5
              : 1.8
            : 1;
          u.cooldown =
            c.burstSize && (u.shots + 1) % c.burstSize === 0
              ? c.burstPause!
              : c.rate! * (closeBurst ? 0.65 : 1) * (spotted ? 0.7 : 1);
          const gunBurst = machinegunBurst(u);
          if (u.id === 'grenadiers') {
            u.launcherCycleDuration = u.cooldown;
            u.launcherCycleRemaining = u.cooldown;
          }
          if (gunBurst && (u.shots + 1) % gunBurst.rounds === 0) {
            u.cooldown = gunBurst.pause;
            u.mgBurstRestUntil = s.time + gunBurst.pause;
            u.mgBoundGoal = undefined;
          }
          u.ambushFor = 0;
          if (u.id === 'ambush_squad') {
            u.camouflageFor = 0;
            u.camouflageRevealedUntil = s.time + AMBUSH_REVEAL;
          }
          u.rapidUntil = 0;
          u.fire = 0.25;
          // A discharged round cycles the weapon, not the entire magazine.
          // Only the dry-magazine/top-up/handoff paths start a reload below.
          const ap = !!(c.penetration && target && CARDS[target.id].armored);
          const kind: Ammunition = ap ? 'ap' : ammunition(u.id, u.member),
            flight = FLIGHT[kind];
          const total = Math.max(
            c.indirect ? 2 : flight.minimum,
            Math.abs(tx - sx) / flight.speed,
          );
          u.facing = c.sortie
            ? c.patrolTime
              ? u.patrolDir
              : dir
            : Math.sign(tx - u.x) || dir;
          u.shots++;
          // Small arms burn a round per shot; a dry magazine locks the
          // weapon into a visible reload (slower while pinned) that the
          // enemy can exploit.
          if (u.ammo > 0) {
            u.ammo--;
            if (u.ammo === 0 && (u.ammoReserve ?? 0) > 0) {
              const spec = magazine(u.id, u.member);
              if (spec) {
                const rt = spec.reload * (u.suppression > 50 ? 1.5 : 1);
                startMagazineDrill(u, s.time, rt);
              }
            }
          }
          if (target) u.lastCombatShotAt = s.time;
          if (coverShot) {
            u.breachShots =
              u.breachPropId === coverShot.propId
                ? (u.breachShots ?? 0) + 1
                : 1;
            u.breachPropId = coverShot.propId;
          }
          u.lastAmmo = kind;
          u.muzzleX = sx;
          u.muzzleY = sy;
          u.shotAngle = Math.atan2(ty - sy - 4 * flight.arc, tx - sx);
          muzzleParticles(s, u, kind, sx, sy);
          // Critical heat: the gunner breaks off, vents the barrel and swaps
          // tubes. Steam and haze burst off the weapon while he works.
          if (canOverheat(u) && !overheated(s, u) && unitHeat(s, u) >= OVERHEAT_CRIT) {
            u.overheatedUntil = s.time + OVERHEAT_LOCK;
            u.heat = Math.max(0, (u.heat ?? 0) - OVERHEAT_VENT);
            u.heatAt = s.time;
            u.cooldown = Math.max(u.cooldown, OVERHEAT_LOCK);
            for (let i = 0; i < 6; i++) {
              emitParticle(s, {
                kind: 'haze',
                x: sx + (fxRnd(s) - 0.5) * 10,
                y: sy - 4 - fxRnd(s) * 6,
                vx: (fxRnd(s) - 0.5) * 8,
                vy: -8 - fxRnd(s) * 6,
                life: 0.8 + fxRnd(s) * 0.5,
                maxLife: 1.3,
                color: '#d8dcd2',
                size: 8 + fxRnd(s) * 6,
              });
            }
          }
          if (s.night) u.flashUntil = s.time + 0.9;
          // Indirect guns cannot hide: every shell gives the enemy's sound
          // rangers a fix on the battery (aircraft sorties are excluded —
          // their launch points are off-board or already obvious).
          if (c.indirect && !c.air && !c.sortie)
            detectBattery(s, u, sx, sy);
          if (u.id === 'mortar') u.mortarSiteShots = (u.mortarSiteShots ?? 0) + 1;
          if (u.id === 'mortar_carrier' && !controlledNavigation)
            u.displaceGoal = carrierScootGoal(u, target?.x ?? tx, order, W);
          // Shoot-and-scoot: once the enemy's sound rangers have refined a
          // fix on this battery, displace to a fresh firing position before
          // their counter-battery fire arrives. The stale report on the old
          // position decays while the team limbers up and moves.
          if (
            c.indirect &&
            u.id !== 'mortar_carrier' &&
            (u.id !== 'mortar' || (u.mortarSiteShots ?? 0) >= 2) &&
            !c.air &&
            !c.sortie &&
            !c.static &&
            (c.speed ?? 0) > 0 &&
            order !== 'hold' &&
            s.time >= (u.displaceUntil ?? 0)
          ) {
            const fix = s.batteryReports.find(
              (r) =>
                r.side !== u.side &&
                r.hits >= 2 &&
                Math.abs(r.x - u.x) < r.scatter + 100,
            );
            if (fix) {
              const dirBack = u.side === 0 ? -1 : 1;
              // Stay inside our own firing range: a battery that displaces
              // past max range can neither shoot nor advance (it still holds
              // a target, so the advance gate never moves it forward again).
              // Only displace when there is room to fall back at least 60px
              // while keeping the aim point 80px inside max range.
              const room =
                (c.range ?? 0) - Math.abs(tx - u.x) - 80;
              if (room >= 60) {
                const back = Math.min(150 + (u.uid % 5) * 18, room);
                u.displaceGoal = Math.max(
                  80,
                  Math.min(W - 80, u.x + dirBack * back),
                );
              }
              u.displaceUntil = s.time + 9;
              u.coverGoal = null;
            }
          }
          // Counter-battery shells landing on a known fix force the enemy
          // battery to displace, burning the report down to its last seconds.
          if (burnedReport) burnedReport.life = Math.min(burnedReport.life, 4);
          s.projectiles.push({
            uid: ++s.uid,
            guided: c.guided && !c.indirect,
            topAttack: u.id === 'javelin',
            loftX:
              u.id === 'javelin'
                ? sx +
                  Math.sign(tx - sx) * Math.min(160, Math.abs(tx - sx) * 0.25)
                : undefined,
            loftY: u.id === 'javelin' ? Math.min(sy, ty) - 180 : undefined,
            speed: c.guided && c.airOnly ? 1250 : undefined,
            infantryMultiplier: c.infantryMultiplier,
            baseMultiplier: c.baseMultiplier,
            smallArmsAir,
            shell: !!c.indirect,
            effect: ap
              ? 'penetration'
              : c.indirect
                ? 'artillery'
                : kind === 'grenade'
                  ? 'grenade'
                  : 'he',
            sourceUid: u.uid,
            suppressionMultiplier: isHeavyGunner(u) ? 1.75 : 1,
            x: sx,
            y: sy,
            tx,
            ty,
            side: u.side,
            targetUid: target?.uid ?? null,
            base: target || coverShot || reconFire ? null : enemySide,
            damage:
              ((ap ? c.penetration! : c.damage!) / (c.members ?? 1)) *
              openingDamage *
              (c.infantryAbility === 'entrenched' &&
              !u.moving &&
              (u.stillFor ?? 0) >= 2
                ? 1.35
                : 1) *
              (smallArmsAir ? 0.12 : 1) *
              (morale ? 1.35 : 1) *
              (c.trait === 'close_assault' && Math.abs(tx - u.x) < 200
                ? 1.2
                : 1) *
              (c.trait === 'close_assault' &&
              target &&
              (target.suppression ?? 0) > 45
                ? 1.3
                : 1) *
              (c.members &&
              s.smokes.some(
                (f) =>
                  f.side === u.side &&
                  f.life > 0 &&
                  Math.abs(f.x - u.x) < 95,
              )
                ? 1.15
                : 1) *
              (modelOf(u.id) === 'sniper' &&
              target &&
              scoutDesignates(s, u.side, target)
                ? 1.25
                : 1) *
              // Scout designation lets precision howitzers walk fire onto
              // the exact enemy position — tighter correction, deeper hit.
              (c.id === 'precision' &&
              target &&
              scoutDesignates(s, u.side, target)
                ? 1.3
                : 1) *
              // Guided anti-armor teams with a spotter get a cleaner lock.
              (c.guided &&
              c.armorOnly &&
              target &&
              scoutDesignates(s, u.side, target)
                ? 1.2
                : 1) *
              (modelOf(u.id) === 'sniper' && target && CARDS[target.id].armored
                ? 0.5
                : 1),
            armorMultiplier: c.armorMultiplier,
            ammunition: kind,
            tracer: isTracer(kind, u.shots),
            trailIn: 0,
            arc: flight.arc,
            radius: ap ? 0 : (c.radius ?? 0),
            life: c.guided && !c.indirect ? 8 : total,
            total,
            startX: sx,
            startY: sy,
            fromAir: !!c.air,
          });
          // Recon-by-fire rounds need explicit lanes so suppressNearMiss can
          // project their pressure through depth (aimProjectileDepth only
          // assigns lanes when a concrete target unit exists).
          if (reconFire) {
            const proj = s.projectiles[s.projectiles.length - 1];
            proj.startLane = u.lane;
            proj.targetLane = u.lane;
            u.reconFireNextAt = s.time + 2.2 + (u.uid % 4) * 0.3;
          }
          if (c.oneWay) {
            u.hp = 0;
            u.deadFor = 0;
            u.fire = 0;
          }
        }
      }
    } else if (
      !treating &&
      !reloadingUnderContact &&
      !shocked &&
      // Let the real barrel recoil finish before moving; an immediate danger
      // withdrawal still takes priority over this short firing dwell.
      !(u.id === 'mortar_carrier' && displacing && u.fire > 0 && !closeThreat && !reversing) &&
      (withdrawalStep ||
        mobileBurstStep ||
        seeking ||
        bounding ||
        retreating ||
        displacing ||
        reversing ||
        (!!closeThreat &&
          (!c.members ||
            (u.squadOrder !== 'hold' && u.squadOrder !== 'watch'))) ||
        (!withdrawing &&
          !observing &&
          !escorting &&
          !u.withdrawStandby &&
          // A battery that lost sight while backing out waits out its reload
          // at the new position instead of instantly driving back into the
          // muzzle-flash location. It still needs genuine vision to fire.
          !(u.id === 'mortar_carrier' && u.shots > 0 && u.cooldown > 0) &&
         (!target || breachRun || stalemated) &&
         !baseInRange &&
          (!blockedContact || stalemated) &&
         (s.time >= (u.atHoldUntil ?? 0) || breachRun) &&
        (!c.members || order !== 'hold') &&
        !u.vehicleReverseHeld))
    ) {
      if (c.members) {
        // v129: route the movement pose through the stance gate and add
        // hysteresis on the suppression threshold. The old direct write
        // flipped prone↔crouch every frame near 65 suppression — the
        // "rapidly prone and stand up" twitch.
        let moveWant: Unit['pose'];
        if (
          (u.assaultSurgeUntil ?? 0) > s.time &&
          !withdrawing &&
          !retreating
        ) {
          moveWant = 'run';
        } else if (
          order === 'rush' ||
          bounding ||
          retreating ||
          breachRun
        ) {
          moveWant = 'run';
        } else if (
          order === 'crouch' ||
          (withdrawing && withdrawalThreat && order !== 'prone')
        ) {
          // Hysteresis: once pinned prone, stay prone until suppression
          // eases well below the threshold.
          const pinned =
            u.pose === 'prone' ? u.suppression > 45 : u.suppression > 65;
          moveWant = pinned ? 'prone' : 'crouch';
        } else if (order === 'prone') {
          moveWant = 'prone';
        } else if (withdrawing || escortAhead) {
          moveWant = 'walk';
        } else if (u.tactic === 'prone') {
          moveWant = 'prone';
        } else if (u.tactic === 'crouch' || u.tactic === 'cover') {
          moveWant = 'crouch';
        } else {
          moveWant = 'walk';
        }
        u.pose = setStance(u, s.time, moveWant, { travel: true });
      }
      if (c.members && (s.players[u.side].entrenchUntil ?? 0) > s.time)
        u.pose = setStance(u, s.time, 'prone', { force: true });
      const orderSpeed = c.members
        ? u.pose === 'run'
          ? 1.7
          : u.pose === 'crouch'
            ? 0.55
            : u.pose === 'prone'
              ? 0.25
              : 1
        : 1;
      const speed =
        c.speed! *
        u.pace *
        orderSpeed *
        (!withdrawing &&
        !retreating &&
        !closeThreat &&
        (u.rapidUntil ?? 0) > s.time
          ? 1.8
          : 1) *
        (morale ? 1.2 : 1) *
        (u.slowedUntil > s.time ? 0.5 : 1) *
        ((u.forceMarchUntil ?? 0) > s.time ? 1.35 : 1) *
        ((s.players[u.side].blitzUntil ?? 0) > s.time ? 1.45 : 1) *
        ((s.players[u.side].fallbackUntil ?? 0) > s.time ? 1.6 : 1);
      const moveDir = withdrawing
        ? Math.sign(u.withdrawGoal! - u.x)
        : reversing
          ? -dir
        : retreating
          ? -dir
          : closeThreat
            ? u.x > closeThreat.x
              ? 1
              : -1
            : mobileBurstStep
              ? Math.sign(u.mgBoundGoal! - u.x)
            : displacing
              ? Math.sign(u.displaceGoal! - u.x)
            : seeking
              ? Math.sign(moveGoal! - u.x)
              : dir;
      if (c.members) {
        // Our atlas turns to travel; never keep a muzzle flash facing the old target.
        u.fire = 0;
        u.secondaryFire = 0;
        const desiredLane = holdTravel
          ? worksite.lane
          : escortTravel
            ? u.escortLane
            : u.passingLane === undefined &&
                (u.passClearAt ?? -1e9) + 0.6 <= s.time &&
                (u.dispersionUntil ?? 0) <= s.time &&
                !withdrawing &&
                !retreating
              ? squadFormationLane(s, u)
              : undefined;
        const laneChange =
          desiredLane !== undefined && !stanceTransitionActive(u, s.time) &&
            (Math.abs(desiredLane-u.lane) <= .001 || (requestCrouchStep(u,s.time) && requestProneStep(u,s.time)))
            ? Math.max(-12 * dt, Math.min(12 * dt, desiredLane - u.lane))
            : 0;
        u.lane += laneChange;
        u.walk += Math.min(Math.abs(laneChange) / 8, 0.95);
        const beforeMove = u.x;
          moveSoldier(
            s,
            u,
            moveDir,
            mobileBurstStep
              ? Math.min(speed, Math.abs(u.mgBoundGoal! - u.x) / dt)
            : seeking || withdrawing
              ? Math.min(speed, Math.abs(moveGoal! - u.x) / dt)
              : displacing
                ? Math.min(speed, Math.abs(u.displaceGoal! - u.x) / dt)
              : speed,
          dt,
          !target || withdrawing || breachRun,
        );
        if (laneChange) u.moving = true;
        if (
          ((withdrawing && withdrawalThreat) || (escortAhead && target)) &&
          (u.x - beforeMove) * moveDir > 0.001 &&
          u.motion === 'ground' &&
          !u.climbing
        ) {
          const faceThreat =
            Math.sign((withdrawalThreat ?? target)!.x - u.x) || dir;
          if (faceThreat !== moveDir) {
            u.facing = faceThreat;
            u.backpedaling = true;
          }
        }
      } else if (
        !controlledNavigation &&
        !c.sortie &&
        !c.static &&
        (!c.vehicle || order !== 'hold' || reversing)
      ) {
        const before = u.x;
        const scooting = u.id === 'mortar_carrier' && displacing && !closeThreat && !reversing;
        const distance = scooting ? Math.min(speed * dt, Math.abs(u.displaceGoal! - u.x)) : speed * dt;
        u.x = contactSafeX(s, u, Math.max(55, Math.min(W - 55, u.x + moveDir * distance)));
        u.moving = Math.abs(u.x - before) > 0.001;
        // A reversing vehicle keeps its hull aimed at the threat it is
        // backing away from — only the tracks carry it out of the kill zone.
        if (u.moving) u.facing = reversing || scooting ? dir : moveDir;
        if (u.moving && u.id === 'mortar_carrier') u.carrierSettleUntil = s.time + CARRIER_SETTLE;
        if (u.moving && (c.armored || c.vehicle)) {
          u.stepDust = (u.stepDust ?? 0) + Math.abs(u.x - before);
          if (u.stepDust >= 12) {
            u.stepDust = 0;
            vehicleDust(s, u);
            // Persistent tread marks record the vehicle's path long after
            // the transient dust has settled.
            s.treads.push({
              x: u.x,
              y: ground(s, u.x),
              half: armorHalf(u.id),
              seed: (s.fxSeed ^ Math.imul(Math.floor(u.x), 2654435761)) >>> 0,
              born: s.time,
            });
            s.treads = s.treads.slice(-90);
          }
        }
      }
    }
    // v87: a soldier who heard a contact callout but has not yet spotted the
    // threat themselves turns toward the reported direction so their muzzle
    // and attention are already on the danger when it appears. Only when
    // stationary — a moving soldier looks where they are going.
    if (
      c.members &&
      u.motion === 'ground' &&
      !u.moving &&
      (u.contactUntil ?? 0) <= s.time &&
      (u.heardContactAt ?? 0) > s.time - 1.2
    ) {
      u.facing = u.heardContactDir ?? u.facing;
    }
    // Rounds cracking past the soldier's head drop them into a crouch for a
    // beat — they keep shooting and moving, just lower to the ground.
    if (
      c.members &&
      (u.duckUntil ?? 0) > s.time &&
      u.motion === 'ground' &&
      u.climbing <= 0 &&
      (u.pose === 'idle' || u.pose === 'walk' || u.pose === 'run')
    )
      u.pose = setStance(u, s.time, 'crouch');
    if (
      worksite?.pending &&
      worksite.digTurn &&
      !target &&
      !threat &&
      !baseInRange &&
      !closeThreat &&
      !treating &&
      !withdrawing &&
      !retreating &&
      !u.moving &&
      !u.climbing &&
      u.motion === 'ground' &&
      u.suppression < 35 &&
      u.fire <= 0 &&
      u.secondaryFire <= 0 &&
      Math.abs(u.x - worksite.x) <= 1 &&
      Math.abs(u.lane - worksite.lane) <= 0.5
    ) {
      u.pose = setStance(u, s.time, 'crouch');
      u.digging = digWorkSettled(u,s.time);
      u.facing = dir;
    }
    if (c.armored && c.vehicleSupport !== 'mine_clear') {
      for (const wall of s.walls) {
        if (wall.hp > 0 && Math.abs(u.x - wall.x) < 26) {
          wall.hp = 0;
          burst(s, wall.x, ground(s, wall.x) - 12, 22);
        }
      }
    }
    if (c.armored || c.vehicle) {
      const contact = vehicleContact(s, u.x, u.id),
        blend = 1 - Math.exp(-dt * 9);
      u.y += (contact.y - u.y) * blend;
      u.hullAngle += (contact.angle - u.hullAngle) * blend;
    } else if (!c.members || u.motion === 'ground')
      u.y = c.air ? (c.altitude ?? AIR_ALTITUDE) : ground(s, u.x);
  }
  for (const u of s.units) if (CARDS[u.id].members) {
    stepCrouchLocomotion(u,s.time,dt);
    stepProneLocomotion(u,s.time,dt);
  }
  if (airPositions)
    for (const u of s.units) {
      const previous = airPositions.get(u.uid);
      if (previous) {
        u.vx = (u.x - previous.x) / dt;
        u.vy = (u.y - previous.y) / dt;
      }
    }
  for (const p of s.projectiles) {
    const oldX = p.x,
      oldY = p.y;
    p.life -= dt;
    if (p.guided) {
      const tracked = s.units.find(
        (u) => u.uid === p.targetUid && canTakeDamage(u),
      );
      if (tracked && visibleToSide(s, p.side, tracked)) {
        // v108 radar jam: the seeker hunts a corrupted track, wandering
        // around the real target instead of locking it cleanly.
        const jammed = (s.players[p.side].radarJamUntil ?? 0) > s.time;
        p.tx = tracked.x + (jammed ? (rnd(s) - 0.5) * 70 : 0);
        p.ty =
          tracked.y - bodyHeight(tracked) + (jammed ? (rnd(s) - 0.5) * 36 : 0);
      }
      const climbing = p.topAttack && !p.lofted;
      const goalX = climbing ? p.loftX! : p.tx,
        goalY = climbing ? p.loftY! : p.ty;
      const dx = goalX - p.x,
        dy = goalY - p.y,
        dist = Math.hypot(dx, dy),
        step = (p.speed ?? FLIGHT[p.ammunition ?? 'rocket'].speed) * dt;
      if (p.life <= 0) {
        // Fuel/TTL exhaustion is a visual detonation at the missile's actual position.
        // It must not damage the tracked target or dig a crater at the unvisited goal.
        if (p.radius) burst(s, p.x, p.y, p.radius, p.effect);
        continue;
      }
      p.heading = Math.atan2(dy, dx);
      if (dist <= step) {
        p.x = goalX;
        p.y = goalY;
        if (climbing) p.lofted = true;
        else p.life = 0;
      } else {
        p.x += (dx / dist) * step;
        p.y += (dy / dist) * step;
      }
    } else {
      const t = 1 - Math.max(0, p.life) / p.total;
      p.x = p.startX + (p.tx - p.startX) * t;
      p.y = lobY(p.startY, p.ty, p.arc ?? 0, t);
    }
    if (p.ammunition === 'rocket') {
      p.trailIn = (p.trailIn ?? 0) - dt;
      if (p.trailIn <= 0) {
        p.trailIn = 0.035;
        const life = 0.22;
        emitParticle(s, {
          kind: 'smoke',
          x: oldX,
          y: oldY,
          vx: 0,
          vy: -6,
          life,
          maxLife: life,
          color: '#969b8b',
          size: 3,
        });
      }
    }
    const impact = projectileIntercept(s, p, oldX, oldY, p.x, p.y);
    aimProjectileDepth(s, p);
    suppressNearMiss(s, p, oldX, oldY, impact?.x ?? p.x, impact?.y ?? p.y);
    const friendly = retreatingFriendlyHit(s, p, oldX, oldY, p.x, p.y);
    if (p.tracer) {
      const end =
        friendly &&
        (!impact ||
          Math.hypot(friendly.x - oldX, friendly.y - oldY) <
            Math.hypot(impact.x - oldX, impact.y - oldY))
          ? friendly
          : (impact ?? p);
      emitParticle(s, {
        kind: 'tracer',
        x: oldX,
        y: oldY,
        endX: end.x,
        endY: end.y,
        vx: 0,
        vy: 0,
        life: 0.065,
        maxLife: 0.065,
        color: '#f8d28e',
        size: 1,
      });
    }
    if (
      friendly &&
      (!impact ||
        Math.hypot(friendly.x - oldX, friendly.y - oldY) <
          Math.hypot(impact.x - oldX, impact.y - oldY))
    ) {
      p.life = 0;
      p.x = friendly.x;
      p.y = friendly.y;
      if (s.time - friendly.u.friendlyWarnAt > 3) {
        notify(s, '撤退队员进入友军射线，发生误伤', 'warn', [friendly.u.side]);
        friendly.u.friendlyWarnAt = s.time;
      }
      hitUnit(s, friendly.u, p.damage, p.side, 0, 'bullet', p.sourceUid);
      bulletImpact(s, p.x, p.y, 'cloth', Math.sign(p.tx - p.startX));
      continue;
    }
    if (impact) {
      p.life = 0;
      if (p.radius)
        explode(
          s,
          impact.x,
          impact.y,
          p.radius,
          p.damage,
          p.side,
          p.baseMultiplier ?? 1,
          p.armorMultiplier,
          p.effect,
          p.infantryMultiplier,
          p.sourceUid,
        );
      else {
        damageScenery(s, impact.x, impact.y, 3, p.damage);
        bulletImpact(
          s,
          impact.x,
          impact.y,
          p.ammunition === 'ap' ? 'armor' : 'soil',
          Math.sign(p.tx - p.startX),
          p.ammunition,
          p.heading ?? Math.atan2(p.ty - p.startY, p.tx - p.startX),
        );
      }
      continue;
    }
    if (p.life <= 0) {
      let connected = !!p.radius;
      if (p.radius)
        explode(
          s,
          p.tx,
          p.ty,
          p.radius,
          p.damage,
          p.side,
          p.baseMultiplier ?? 1,
          p.armorMultiplier,
          p.effect,
          p.infantryMultiplier,
          p.sourceUid,
        );
      else if (p.targetUid !== null) {
        const u = s.units.find((u) => u.uid === p.targetUid);
        if (
          u &&
          canTakeDamage(u) &&
          depthHit(p, u) &&
          Math.abs(u.x - p.tx) <
            (CARDS[u.id].armored || CARDS[u.id].vehicle
              ? armorHalf(u.id) + 8
              : CARDS[u.id].air
                ? 80
                : 18) &&
          !projectileIntercept(s, p, p.x, p.y, u.x, u.y - bodyHeight(u))
        ) {
          connected = true;
          const cover =
            CARDS[u.id].members && u.motion === 'ground' && !u.climbing
              ? craterCover(s, u.x, p.startX) *
                (p.startY < u.y - 100
                  ? 0
                  : u.pose === 'crouch' || u.pose === 'prone'
                    ? 0.6
                    : 0.25)
              : 0;
          hitUnit(
            s,
            u,
            p.damage *
              (CARDS[u.id].armored
                ? (p.armorMultiplier ?? 1)
                : CARDS[u.id].members
                  ? (p.infantryMultiplier ?? 1)
                  : 1),
            p.side,
            cover,
            'bullet',
            p.sourceUid,
          );
          if (p.ammunition === 'ap')
            s.blasts.push({
              x: p.tx,
              y: p.ty,
              age: 0,
              radius: 4,
              kind: 'penetration',
              soil: false,
              seed: s.fxSeed,
            });
          bulletImpact(
            s,
            p.tx,
            p.ty,
            CARDS[u.id].armored || CARDS[u.id].vehicle ? 'armor' : 'cloth',
            Math.sign(p.tx - p.startX),
            p.ammunition,
            p.heading ?? Math.atan2(p.ty - p.startY, p.tx - p.startX),
          );
        }
      } else if (p.base !== null) {
        connected = true;
        s.players[p.base].hp = Math.max(
          0,
          s.players[p.base].hp - p.damage * (p.baseMultiplier ?? 1),
        );
        bulletImpact(
          s,
          p.tx,
          ground(s, p.tx),
          'soil',
          Math.sign(p.tx - p.startX),
        );
      }
      if (!connected && isCoverBullet(p.ammunition ?? 'rifle')) {
        if (p.missed)
          bulletImpact(
            s,
            p.x,
            ground(s, p.x),
            'soil',
            Math.sign(p.tx - p.startX),
          );
        else {
          // A missed round continues downrange and kicks up earth instead of vanishing.
          const dir = Math.sign(p.tx - p.startX) || 1;
          p.startX = p.x;
          p.startY = p.y;
          p.tx = Math.max(1, Math.min(W - 1, p.x + dir * 90));
          p.ty = ground(s, p.tx);
          p.total = p.life = Math.max(
            0.045,
            Math.hypot(p.tx - p.x, p.ty - p.y) / 2200,
          );
          p.targetUid = null;
          p.base = null;
          p.damage = 0;
          p.missed = true;
        }
      }
    }
  }
  s.projectiles = s.projectiles.filter((p) => p.life > 0);
  for (const mine of s.mines) {
    if (mine.armAt > s.time) continue;
    const victim = s.units.find(
      (u) =>
        u.side !== mine.side &&
        canTakeDamage(u) &&
        (mine.kind === 'antipersonnel'
          ? !!CARDS[u.id].members && !u.rappelling
          : CARDS[u.id].armored || CARDS[u.id].vehicle) &&
        Math.abs(u.x - mine.x) <
          (mine.kind === 'antipersonnel'
            ? 16
            : (tankGeometry(u.id)?.half ?? 24)),
    );
    if (victim) {
      mine.armAt = Infinity;
      victim.slowedUntil = s.time + 3;
      hitUnit(
        s,
        victim,
        mine.kind === 'antipersonnel' ? 22 : 260,
        mine.side,
        0,
        'blast',
        undefined,
        mine.x,
        ground(s, mine.x) - 4,
      );
      burst(
        s,
        mine.x,
        ground(s, mine.x) - 4,
        mine.kind === 'antipersonnel' ? 16 : 32,
        mine.kind === 'antipersonnel' ? 'grenade' : 'he',
      );
    }
  }
  s.mines = s.mines.filter((m) => m.armAt !== Infinity);
  for (const u of s.units)
    if (u.hp > 0 && CARDS[u.id].sortie && (u.x < -160 || u.x > W + 160)) {
      settleSortie(s, u, true);
      u.hp = 0;
      u.deadFor = 0;
      u.destroyed = true;
    }
  for (const w of s.wrecks) {
    w.age += dt;
    const isInfantry = !!CARDS[w.cardId].members;
    const contact = isInfantry
      ? null
      : wreckContact((x) => ground(s, x), w);
    if (w.falling) {
      w.x = Math.max(20, Math.min(W - 20, w.x + w.vx * dt));
      // v121: infantry ragdolls use heavier gravity and real air drag so a
      // blast tosses a man a believable distance (~100-160px) instead of
      // launching him across the whole map. Aircraft wrecks keep their
      // original floatier fall.
      if (isInfantry) w.vx *= Math.max(0, 1 - 2.2 * dt);
      w.vy += (isInfantry ? 420 : 250) * dt;
      w.y += w.vy * dt;
      w.angle += dt * (w.spin ?? 0.7 * Math.sign(w.vx || 1));
      const floorY = isInfantry ? ground(s, w.x) : contact!.y;
      if (w.y >= floorY) {
        w.falling = false;
        if (isInfantry) {
          // Ragdoll landing: pin to the dirt, kill the momentum and let the
          // body settle into a sprawled angle carried out of the tumble.
          w.y = floorY;
          w.vx = 0;
          w.vy = 0;
          w.angle = Math.max(-0.35, Math.min(0.35, w.angle));
          // v121: a body hitting the dirt kicks up a dust puff — the old
          // crash burst read as the corpse exploding on landing.
          for (let i = 0; i < 10; i++) {
            const life = 0.5 + fxRnd(s) * 0.6;
            emitParticle(s, {
              kind: 'dust',
              x: w.x + (fxRnd(s) - 0.5) * 14,
              y: floorY - 2,
              vx: (fxRnd(s) - 0.5) * 40,
              vy: -14 - fxRnd(s) * 26,
              life,
              maxLife: life,
              color: fxRnd(s) < 0.5 ? '#8a7a5e' : '#756549',
              size: 3 + fxRnd(s) * 4,
            });
          }
        } else {
          Object.assign(w, wreckContact((x) => ground(s, x), w));
          if(w.cardId==='glider_transport' || w.spentWarhead)gliderDust(s,w.x,w.y,w.spentWarhead ? 5 : 18);
          else burst(s, w.x, w.y, CARDS[w.cardId].oneWay ? 18 : 30, 'crash');
        }
        s.visionIn = 0;
      }
    } else if (contact) Object.assign(w, contact);
    else w.y = ground(s, w.x);
  }
  s.units = s.units.filter(
    (u) =>
      (u.hp > 0 || u.deadFor > 0) && (!u.surrendered || u.surrenderTime < 6),
  );
  for (const b of s.blasts) {
    b.age += dt;
    if (b.soil) b.y = ground(s, b.x);
  }
  s.blasts = s.blasts.filter((b) => b.age < blastDuration(b.kind));
  for (const r of s.ricochets) r.age += dt;
  s.ricochets = s.ricochets.filter((r) => r.age < RICOCHET_LIFE);
  for (const p of s.particles) {
    p.life -= dt;
    if (p.kind === 'tracer' || p.kind === 'impact') continue;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy +=
      (p.kind === 'flash'
        ? -10
        : p.kind === 'smoke'
        ? -2
        : p.kind === 'cloud'
          ? -9
          : p.kind === 'mote' || p.kind === 'haze'
            ? -1.5
            : p.kind === 'dust'
          ? 6
          : p.kind === 'casing'
            ? 320
            : 190) * dt;
    // Wind carries smoke, dust and lingering clouds across the battlefield.
    if (
      p.kind === 'smoke' ||
      p.kind === 'dust' ||
      p.kind === 'cloud' ||
      p.kind === 'mote' ||
      p.kind === 'haze'
    )
      p.x +=
        s.wind *
        dt *
        (p.kind === 'mote'
          ? 2.2
          : p.kind === 'haze'
            ? 1.3
            : p.kind === 'cloud'
              ? 1.6
              : 1);
    // Spent brass bounces off the dirt, sheds energy and comes to rest
    // glinting on the ground; a breeze nudges settled casings along.
    if (p.kind === 'casing') {
      const gy = ground(s, p.x);
      if (p.y >= gy) {
        p.y = gy;
        if (p.vy > 30) {
          p.vy = -p.vy * 0.32;
          p.vx *= 0.55;
        } else {
          p.vy = 0;
          p.vx *= Math.max(0, 1 - 6 * dt);
        }
      }
      p.x += s.wind * dt * 0.35;
    }
  }
  {
    const pool = (s.particlePool ??= []);
    let alive = 0;
    const ps = s.particles;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      if (p.life > 0) ps[alive++] = p;
      else if (pool.length < 800) pool.push(p);
    }
    ps.length = alive;
    if (alive > 700) {
      const excess = alive - 700;
      for (let i = 0; i < excess; i++)
        if (pool.length < 800) pool.push(ps[i]);
      ps.copyWithin(0, excess);
      ps.length = 700;
    }
  }
  // Resolve construction after movement, firing and incoming impacts for this frame.
  updateSquadOrders(s, dt);
  advanceCampaign(s, dt, spawnUnit);
  const [a, b] = s.players;
  const missionResult = campaignResult(s);
  if (
    missionResult !== null ||
    (!s.campaign && (a.hp <= 0 || b.hp <= 0 || s.time >= DURATION))
  ) {
    s.status = 'finished';
    s.result =
      missionResult ??
      (Math.abs(a.hp - b.hp) < 0.01 ? 'draw' : a.hp > b.hp ? 0 : 1);
    notify(
      s,
      s.result === 0
        ? '作战胜利'
        : s.result === 1
          ? '作战结束，防线失守'
          : '作战结束，双方平局',
    );
  }
}
export function snapshot(s: GameState, viewer: Side = 0) {
  return {
    campaign: s.campaign ? { ...s.campaign } : null,
    gas: s.comeback?.gas ? { ...s.comeback.gas } : null,
    reserves: (s.comeback?.reserves ?? [])
      .filter((r) => r.side === viewer)
      .map((r) => ({ ...r })),
    entrenchments: (s.entrenchments ?? [])
      .filter((t) => t.side === viewer)
      .map((t) => ({ ...t })),
    status: s.status,
    time: s.time,
    result: s.result,
    night: s.night,
    weather: { kind: s.weather.kind, intensity: s.weather.intensity },
    players: s.players.map((p, i) => ({
      side: i,
      order: p.order,
      hp: p.hp,
      energy: i === viewer ? p.energy : 0,
      difficulty: p.difficulty,
      economyRate: p.economyRate,
      energyCap: i === viewer ? energyLimit(p) : 0,
      energyInterval: i === viewer ? energyInterval(s, viewer) : 0,
      logisticsLevel: i === viewer ? p.logisticsLevel : 0,
      bondUses: i === viewer ? p.bondUses : 0,
      bondDueAt: i === viewer ? p.bondDueAt : null,
      overdraftUntil: i === viewer ? p.overdraftUntil : null,
      suppressedUntil: i === viewer ? p.suppressedUntil : null,
      hand:
        i === viewer
          ? p.hand.map((h) => ({
              ...h,
              ...CARDS[h.id],
              cost: cardCost(h),
              readyIn: cardReadyIn(s, h),
            }))
          : [],
      deckCount: i === viewer ? p.deck.length : 0,
      discardCount: i === viewer ? p.discard.length : 0,
      drawIn: p.drawIn,
      jam: p.jam,
      morale: p.morale,
      recon: p.recon,
      captures: p.captures,
      fortify: p.fortify,
      kills: p.kills,
      played: p.played,
    })),
    units: s.units
      .filter((u) => visibleToSide(s, viewer, u))
      .map((u) => ({ ...u, sortieCard: null })),
    walls: Object.values(s.knownWalls[viewer]).map((w) => ({ ...w })),
    smokes: s.smokes.map((f) => ({ ...f })),
    flares: s.flares.map((f) => ({ ...f })),
    batteryReports: s.batteryReports
      .filter((r) => r.side === viewer)
      .map((r) => ({ ...r })),
    explosions: s.audibleExplosions[viewer],
    notices: s.notices
      .filter((n) => !n.audience || n.audience.includes(viewer))
      .map((n) => ({ ...n })),
  };
}
