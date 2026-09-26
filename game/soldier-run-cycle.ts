/** Foot path for a loaded run. One leg supports the body for 38% of the
 * cycle; the half-cycle offset of the other leg leaves a short flight phase.
 * Coordinates face right. `stride` is half the distance covered by one
 * planted foot, and lift is positive above the local ground plane.
 */
const TAU = Math.PI * 2;
const CONTACT = .38;
const SWING = 1 - CONTACT;
// Derivative with respect to normalized swing time. Matching this at both
// ends preserves zero world-space foot velocity when contact changes.
const CONTACT_TANGENT = -2 * SWING / CONTACT;

type HorizontalKey = readonly [time: number, x: number, velocity: number];
const HORIZONTAL: readonly HorizontalKey[] = [
  [0, -1, CONTACT_TANGENT],
  [.10, -1 + CONTACT_TANGENT * .05, 0],
  [.48, -.30, 4],
  [.88, .92, 2],
  [.96, 1 - CONTACT_TANGENT * .02, 0],
  [1, 1, CONTACT_TANGENT],
];

type LiftKey = readonly [time: number, height: number];
const LIFT: readonly LiftKey[] = [
  [0, 0],
  [.20, 6], // Recover the trailing heel while the foot is behind the body.
  [.50, 3], // Lower it before the leg passes underneath the pelvis.
  [.72, 2],
  [.90, 2], // Clear the ground through the brief flight before touchdown.
  [1, 0],
];

function horizontalAt(q: number): number {
  for (let i = 1; i < HORIZONTAL.length; i++) {
    const a = HORIZONTAL[i - 1], b = HORIZONTAL[i];
    if (q > b[0]) continue;
    const span = b[0] - a[0], t = (q - a[0]) / span;
    const t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * a[1]
      + (t3 - 2 * t2 + t) * span * a[2]
      + (-2 * t3 + 3 * t2) * b[1]
      + (t3 - t2) * span * b[2];
  }
  return 1;
}

function liftAt(q: number): number {
  for (let i = 1; i < LIFT.length; i++) {
    const a = LIFT[i - 1], b = LIFT[i];
    if (q > b[0]) continue;
    const t = (q - a[0]) / (b[0] - a[0]);
    const eased = t * t * (3 - 2 * t);
    return a[1] + (b[1] - a[1]) * eased;
  }
  return 0;
}

/** The stance derivative is -stride / (4 * CONTACT) per eight-unit gait
 * phase. Use that same distance divisor when advancing the simulation.
 * Unlike a high-knee sprint, the lead foot stays low and reaches its front
 * extreme just before landing; the taller recovery arc belongs to the heel
 * behind the pelvis. Keep the existing 17 + 17 limb lengths.
 */
export function runStep(phase: number, stride: number): readonly [number, number] {
  const cycle = ((phase / TAU) % 1 + 1) % 1;
  if (cycle < CONTACT) return [stride * (1 - 2 * cycle / CONTACT), 0];
  const q = (cycle - CONTACT) / SWING;
  return [stride * horizontalAt(q), liftAt(q)];
}
