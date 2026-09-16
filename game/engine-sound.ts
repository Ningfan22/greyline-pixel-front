/**
 * Vehicle engine sound model (v97).
 *
 * Ground armour — tanks and IFVs — run continuously, so their voice is a
 * looping synthesised diesel rumble rather than a one-shot sample. This
 * module is the pure half of that system: it turns observed motion into
 * the voice parameters (rpm, pitch, level, pan) the audio layer should
 * apply. Nothing here touches the simulation or consumes its randomness —
 * speed is *observed* from position deltas, exactly as a listener would.
 */
import { weaponModel, type CardId } from './cards';

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));

/** Lowest rpm fraction an engine settles to — a diesel never goes silent. */
export const ENGINE_IDLE_RPM = 0.14;

/** How far beyond the view edge (px) an engine is still faintly audible. */
export const ENGINE_AUDIBLE_MARGIN = 900;

/** Per-second lerp factor for the observed speed smoothing. */
export const ENGINE_SMOOTHING = 3.5;

/** Structural view of a unit — everything the engine model needs. */
export interface EngineUnit {
  uid: number;
  id: CardId;
  member: number;
  x: number;
  hp: number;
  moving: boolean;
  motion?: string;
}

/** Smoothed motion observation for one vehicle, carried between frames. */
export interface EngineObservation {
  x: number;
  t: number;
  speed: number;
}

/** What the audio layer should play for one vehicle this frame. */
export interface EngineVoiceSpec {
  uid: number;
  x: number;
  model: 'tank' | 'ifv';
  /** 0..1 throttle, floored at {@link ENGINE_IDLE_RPM}. */
  rpm: number;
  /** Oscillator frequency multiplier (1 = nominal cruising pitch). */
  pitch: number;
  /** 0..1 linear gain, already faded by distance. */
  level: number;
  /** -1 (left) .. 1 (right). */
  pan: number;
  /** Distance outside the view edge, 0 when on screen. */
  distance: number;
}

/**
 * Updates the smoothed observed speed (px/s) from a position sample.
 * Pure: previous observation in, new observation out. A vehicle that is
 * not flagged as moving is treated as stationary so the rpm settles to
 * idle even while formation logic shuffles its x by sub-pixel amounts.
 */
export function observeEngineSpeed(
  prev: EngineObservation | undefined,
  x: number,
  t: number,
  moving: boolean,
): EngineObservation {
  if (!prev) return { x, t, speed: 0 };
  const dt = Math.max(0.001, t - prev.t);
  const instant = moving ? Math.abs(x - prev.x) / dt : 0;
  const k = Math.min(1, dt * ENGINE_SMOOTHING);
  return { x, t, speed: prev.speed + (instant - prev.speed) * k };
}

/** Alive, grounded tanks and IFVs (and their variants) have engine noise. */
export function isEngineVehicle(u: EngineUnit): boolean {
  if (u.hp <= 0) return false;
  if (u.motion !== undefined && u.motion !== 'ground') return false;
  const model = weaponModel(u);
  return model === 'tank' || model === 'ifv';
}

/** Maps observed speed to a 0..1 throttle with a diesel idle floor. */
export function engineRpm(speed: number, topSpeed: number): number {
  const denom = Math.max(24, topSpeed);
  return clamp(
    ENGINE_IDLE_RPM + (1 - ENGINE_IDLE_RPM) * clamp(speed / denom, 0, 1),
    ENGINE_IDLE_RPM,
    1,
  );
}

/**
 * Frequency multiplier for the rpm. Tanks idle deeper and rev narrower;
 * IFVs (and the pickup technicals that share their model) run higher and
 * wind up more — the ear can tell a column's composition by its growl.
 */
export function enginePitch(rpm: number, model: 'tank' | 'ifv'): number {
  return model === 'tank' ? 0.62 + rpm * 0.5 : 0.8 + rpm * 0.55;
}

/**
 * Linear gain for the voice. Fades to zero exactly at the audible margin
 * so starting/stopping a voice is inaudible, and idling engines still
 * rumble at a little over half their cruising level.
 */
export function engineLevel(rpm: number, distance: number): number {
  const proximity = clamp(1 - distance / ENGINE_AUDIBLE_MARGIN, 0, 1);
  return proximity * (0.45 + 0.55 * rpm);
}
/** Stereo pan from the listener (screen centre), matching one-shot audio. */
export function enginePan(x: number, camera: number, width: number): number {
  return clamp((x - camera - width / 2) / (width * 0.65), -1, 1);
}

/** Distance outside the view edge; 0 while the vehicle is on screen. */
export function engineEdgeDistance(
  x: number,
  camera: number,
  width: number,
): number {
  return Math.max(camera - x, x - camera - width, 0);
}

/**
 * The full voice decision for one vehicle, or null when it should be
 * silent (infantry, wreck, airborne, or beyond the audible margin).
 */
export function desiredEngineVoice(
  u: EngineUnit,
  obs: EngineObservation | undefined,
  camera: number,
  width: number,
  topSpeed: number,
): EngineVoiceSpec | null {
  if (!isEngineVehicle(u)) return null;
  const distance = engineEdgeDistance(u.x, camera, width);
  if (distance > ENGINE_AUDIBLE_MARGIN) return null;
  const model: 'tank' | 'ifv' =
    weaponModel(u) === 'tank' ? 'tank' : 'ifv';
  const rpm = engineRpm(obs?.speed ?? 0, topSpeed);
  return {
    uid: u.uid,
    x: u.x,
    model,
    rpm,
    pitch: enginePitch(rpm, model),
    level: engineLevel(rpm, distance),
    pan: enginePan(u.x, camera, width),
    distance,
  };
}
