import { type WreckKind } from './wreck-geometry';

export type WreckCause = 'bullet' | 'blast' | 'burn';
export type WreckFamily = Record<WreckCause, HTMLCanvasElement[]>;

/** Each frame is a complete authored wreck, not a sliced/rotated live vehicle
 * with black polygons painted over its missing parts. Until a model has real
 * alternative paintings, preserve its original damaged silhouette exactly. */
export function wreckVariants(
  originals: Record<WreckKind, HTMLCanvasElement>,
  authored: Partial<Record<WreckKind, WreckFamily>> = {},
): Record<WreckKind, WreckFamily> {
  return Object.fromEntries(Object.entries(originals).map(([id, frame]) => [
    id,
    authored[id as WreckKind] ?? {bullet:[frame],blast:[frame],burn:[frame]},
  ])) as Record<WreckKind, WreckFamily>;
}
