import {transportFrameV224} from './parachute-art-v224';
import {VEHICLE_SOURCES_V223,vehicleWreckV223} from './vehicle-art-v223';
import {isVehicleV209,vehicleFrameV209,type VehicleIdV209} from './vehicle-missile-art-v209';
import { transparentSheet } from './sprite-atlas';
import { WRECKS, type WreckKind } from './wreck-geometry';
import {mlrsWreckFrame} from './weapon-art-v204';
import { vehicleFrameV197, isV197Vehicle, type V197VehicleId } from './vehicle-art-v197';

/** Extract authored wrecks; no live sprite, tint or vertical compression is used. */
export function wreckFrames(
  ground: HTMLImageElement,
  air: HTMLImageElement,
  mobile: HTMLImageElement,
  support: HTMLImageElement,
  fpv: HTMLImageElement,
  glider: HTMLCanvasElement,
  authoredVehicles: Record<V197VehicleId, HTMLImageElement>,
  v209Wrecks: Record<VehicleIdV209,HTMLImageElement>,
  v223Wrecks:Record<keyof typeof VEHICLE_SOURCES_V223,HTMLImageElement>,
  parachuteWreck:HTMLImageElement,
) {
  const sheets = {
    ground: transparentSheet(ground),
    air: transparentSheet(air),
    mobile: transparentSheet(mobile),
    support: transparentSheet(support),
    fpv,
    glider,
  };
  return Object.fromEntries(
    Object.entries(WRECKS).map(([id, shape]) => {
      if(id==='parachute_transport')return [id,transportFrameV224(parachuteWreck)];
      if(Object.hasOwn(VEHICLE_SOURCES_V223,id)){const name=id as keyof typeof VEHICLE_SOURCES_V223;return [id,vehicleWreckV223(name,v223Wrecks[name])];}
      if(isVehicleV209(id))return [id,vehicleFrameV209(id,v209Wrecks[id],true)];
      if(id==='mlrs')return [id,mlrsWreckFrame(authoredVehicles[id])];
      if (isV197Vehicle(id)) return [id, vehicleFrameV197(id, authoredVehicles[id], true)];
      const frame = document.createElement('canvas');
      frame.width = shape.width;
      frame.height = shape.height;
      const ctx = frame.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        sheets[shape.atlas as keyof typeof sheets],
        ...shape.source,
        0,
        0,
        frame.width,
        frame.height,
      );
      return [id, frame];
    }),
  ) as Record<WreckKind, HTMLCanvasElement>;
}
