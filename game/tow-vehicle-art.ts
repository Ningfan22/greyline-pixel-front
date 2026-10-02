/** Alpha bounds and weapon sockets measured from the v196 AI-authored sprite.
 * Keep the generated art intact: only crop transparent margin and use one
 * uniform scale, with the track baseline anchored at the world ground. */
export const TOW_SPRITE_CROP = [64, 56, 1414, 878] as const;
export const TOW_SPRITE_SIZE = [200, 125] as const;
export const TOW_WRECK_CROP = [57, 113, 1420, 833] as const;
export const TOW_WRECK_SIZE = [200, 118] as const;
function authoredVehicleFrame(
  image: HTMLImageElement,
  crop: readonly [number, number, number, number],
  size: readonly [number, number],
) {
  const frame = document.createElement('canvas');
  [frame.width, frame.height] = size;
  const context = frame.getContext('2d')!;
  context.imageSmoothingEnabled = false;
  const [x, y, width, height] = crop;
  const scale = frame.width / width;
  context.drawImage(
    image, x, y, width, height,
    0, frame.height - height * scale, width * scale, height * scale,
  );
  return frame;
}
export function towMissileCarrierFrame(image: HTMLImageElement) {
  return authoredVehicleFrame(image, TOW_SPRITE_CROP, TOW_SPRITE_SIZE);
}
export function towMissileCarrierWreckFrame(image: HTMLImageElement) {
  return authoredVehicleFrame(image, TOW_WRECK_CROP, TOW_WRECK_SIZE);
}
