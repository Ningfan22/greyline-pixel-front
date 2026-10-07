/** Independently painted fixed-wing transport, compiled to native world pixels. */
export const PARACHUTE_TRANSPORT_ART='/art/v224-airborne/parachute-transport.png';
export const PARACHUTE_TRANSPORT_WRECK='/art/v224-airborne/parachute-transport-wreck.png';
export function transportFrameV224(image:HTMLImageElement){
  const frame=document.createElement('canvas');frame.width=320;frame.height=110;
  const ctx=frame.getContext('2d')!;ctx.imageSmoothingEnabled=false;
  // Whole alpha-bearing canvas is registered identically, with room for the tail.
  ctx.drawImage(image,0,0,image.width,image.height,0,0,320,110);
  return frame;
}
