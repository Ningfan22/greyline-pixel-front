import { transparentSheet } from './sprite-atlas';
import { tankGeometry } from './vehicle-geometry';

type Crop = [number, number, number, number];
/** Measured tight source bounds; TOW frames cross the nominal 5-column grid. */
export const MOBILE_FRAMES: Record<
  string,
  { atlas: 'mobile' | 'support'; crops: Crop[]; wheelBand: number }
> = {
  pickup: {
    atlas: 'mobile',
    crops: [
      [48, 164, 343, 190],
      [447, 164, 341, 190],
      [844, 163, 341, 191],
      [1205, 164, 340, 190],
    ],
    wheelBand: 68,
  },
  tow_ifv: {
    atlas: 'mobile',
    crops: [
      [36, 454, 362, 208],
      [435, 454, 361, 208],
      [830, 454, 358, 208],
      [1218, 454, 361, 208],
    ],
    wheelBand: 63,
  },
  mortar_carrier: {
    atlas: 'support',
    crops: [
      [41, 76, 295, 179],
      [434, 76, 295, 179],
      [807, 76, 296, 179],
    ],
    wheelBand: 66,
  },
  recovery_vehicle: {
    atlas: 'support',
    crops: [
      [25, 305, 344, 186],
      [408, 305, 345, 186],
      [791, 305, 345, 186],
    ],
    wheelBand: 56,
  },
  command_vehicle: {
    atlas: 'support',
    crops: [
      [43, 522, 301, 229],
      [427, 522, 301, 229],
      [810, 522, 302, 229],
    ],
    wheelBand: 70,
  },
  mine_clearer: {
    atlas: 'support',
    crops: [
      [12, 796, 358, 166],
      [400, 796, 359, 166],
      [781, 796, 357, 166],
    ],
    wheelBand: 66,
  },
};

/** Keep the authored body fixed while using each authored wheel/track phase.
 * Every source crop uses the same uniform scale and ground anchor; no per-frame stretching. */
export function mobileVehicleFrames(
  mobile: HTMLImageElement,
  support: HTMLImageElement,
) {
  const sources = {
    mobile: transparentSheet(mobile),
    support: transparentSheet(support),
  };
  return Object.fromEntries(
    Object.entries(MOBILE_FRAMES).map(([id, spec]) => {
      const geometry = tankGeometry(id as Parameters<typeof tankGeometry>[0])!;
      const scale = geometry.size[0] / spec.crops[0][2];
      const frames = spec.crops.map(([x, y, w, h]) => {
        const frame = document.createElement('canvas');
        [frame.width, frame.height] = geometry.size;
        const context = frame.getContext('2d')!;
        context.imageSmoothingEnabled = false;
        context.drawImage(
          sources[spec.atlas],
          x,
          y,
          w,
          h,
          (frame.width - w * scale) / 2,
          frame.height - h * scale,
          w * scale,
          h * scale,
        );
        return frame;
      });
      const wheelBand = Math.round(spec.wheelBand * scale);
      return [
        id,
        frames.map((phase, index) => {
          if (!index) return phase;
          const stable = document.createElement('canvas');
          stable.width = phase.width;
          stable.height = phase.height;
          const context = stable.getContext('2d')!;
          context.drawImage(frames[0], 0, 0);
          context.clearRect(
            0,
            phase.height - wheelBand,
            phase.width,
            wheelBand,
          );
          context.drawImage(
            phase,
            0,
            phase.height - wheelBand,
            phase.width,
            wheelBand,
            0,
            phase.height - wheelBand,
            phase.width,
            wheelBand,
          );
          return stable;
        }),
      ];
    }),
  );
}
