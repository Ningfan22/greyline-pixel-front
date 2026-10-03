export const V197_VEHICLE_IDS = ['tow_ifv', 'light_tank', 'mlrs'] as const;
export type V197VehicleId = (typeof V197_VEHICLE_IDS)[number];
type Crop = readonly [number, number, number, number];
type Size = readonly [number, number];
/** Measured alpha bounds of the independently AI-authored v197 paintings.
 * Each whole painting is uniformly fitted once to its final world size.
 * No pixelation filter, palette replacement or procedural vehicle drawing. */
export const VEHICLE_ART_V197: Record<V197VehicleId, {
  stem: string; crop: Crop; size: Size; wreckCrop: Crop; wreckSize: Size;
}> = {
  tow_ifv: {
    stem: 'tow', crop: [117, 241, 1281, 692], size: [150, 82],
    wreckCrop: [107, 318, 1341, 617], wreckSize: [150, 70],
  },
  light_tank: {
    stem: 'light-tank', crop: [97, 253, 1352, 660], size: [185, 91],
    wreckCrop: [95, 336, 1377, 596], wreckSize: [175, 77],
  },
  mlrs: {
    stem: 'mlrs', crop: [104, 203, 1345, 735], size: [168, 92],
    wreckCrop: [62, 185, 1446, 778], wreckSize: [168, 91],
  },
};
export function vehicleAssetV197(id: V197VehicleId, kind: 'sprite' | 'wreck' | 'card') {
  return `/art/v197-armor/${VEHICLE_ART_V197[id].stem}-${kind}.webp`;
}
export function isV197Vehicle(id: string): id is V197VehicleId {
  return Object.hasOwn(VEHICLE_ART_V197, id);
}
export function vehicleFrameV197(id: V197VehicleId, image: HTMLImageElement, wreck = false) {
  const spec = VEHICLE_ART_V197[id];
  const [x, y, width, height] = wreck ? spec.wreckCrop : spec.crop;
  const [worldWidth, worldHeight] = wreck ? spec.wreckSize : spec.size;
  const frame = document.createElement('canvas');
  frame.width = worldWidth; frame.height = worldHeight;
  const context = frame.getContext('2d')!;
  context.imageSmoothingEnabled = false;
  const scale = worldWidth / width;
  context.drawImage(image, x, y, width, height,
    0, worldHeight - height * scale, width * scale, height * scale);
  return frame;
}
