import type {PaintedGunParts} from './gun-art';
import type {Unit} from './engine';
export const VEHICLE_SOURCES_V223={
 apc_transport:'/art/v223-vehicles/apc_transport.png',
 supply_truck:'/art/v223-vehicles/supply_truck.png',
 pickup:'/art/v223-vehicles/pickup.png',
} as const;
type Crop=readonly [number,number,number,number];
export const VEHICLE_CROPS_V223={
 apc_transport:[20,237,1504,569],supply_truck:[39,216,1464,594],pickup:[49,105,1460,589],
} as const;
export const VEHICLE_WRECKS_V223={apc_transport:{crop:[16,221,1501,608],size:[180,74]},supply_truck:{crop:[32,220,1479,584],size:[188,75]},pickup:{crop:[37,231,1482,542],size:[160,59]}} as const;
export const VEHICLE_SIZES_V223={apc_transport:[180,69],supply_truck:[188,78],pickup:[160,65]} as const;
export function pickupMountV223(){return {pivotX:-31.7,pivotHeight:76.4,barrelLength:44.5,minElevation:-12*Math.PI/180,maxElevation:35*Math.PI/180,restElevation:0};}
function canvas(w:number,h:number){const c=document.createElement('canvas');c.width=Math.ceil(w);c.height=Math.ceil(h);return c;}
/** Texture import only: drop faint transparent matte fringes. Original AI
 * source files and opaque colour pixels are retained without repainting. */
function alphaCut(source:HTMLImageElement){const c=canvas(source.width,source.height),ctx=c.getContext('2d')!;ctx.drawImage(source,0,0);const pixels=ctx.getImageData(0,0,c.width,c.height);for(let i=3;i<pixels.data.length;i+=4)pixels.data[i]=pixels.data[i]<220?0:255;ctx.putImageData(pixels,0,0);return c;}
function crop(source:CanvasImageSource,rect:Crop,width:number,height:number){const c=canvas(width,height),ctx=c.getContext('2d')!;ctx.imageSmoothingEnabled=false;const scale=width/rect[2];ctx.drawImage(source,rect[0],rect[1],rect[2],rect[3],0,height-rect[3]*scale,width,rect[3]*scale);return c;}
export function vehicleFrameV223(id:keyof typeof VEHICLE_SOURCES_V223,source:HTMLImageElement){return crop(alphaCut(source),VEHICLE_CROPS_V223[id],VEHICLE_SIZES_V223[id][0],VEHICLE_SIZES_V223[id][1]);}
export function apcPartsV223(source:HTMLImageElement,gunSource:HTMLImageElement):PaintedGunParts{
 const parts=pickupPartsV223(gunSource);return {...parts,body:vehicleFrameV223('apc_transport',source)};
}
export function vehicleWreckV223(id:keyof typeof VEHICLE_SOURCES_V223,source:HTMLImageElement){const a=VEHICLE_WRECKS_V223[id];return crop(alphaCut(source),a.crop,a.size[0],a.size[1]);}
export function pickupPartsV223(source:HTMLImageElement):PaintedGunParts{
 const clean=alphaCut(source),barrel=canvas(770*.07,191*.07),ctx=barrel.getContext('2d')!;ctx.imageSmoothingEnabled=false;
 ctx.drawImage(clean,403,775,770,191,0,0,770*.07,191*.07);
 const body=canvas(160,84),bodyCtx=body.getContext('2d')!;bodyCtx.imageSmoothingEnabled=false;bodyCtx.drawImage(crop(clean,VEHICLE_CROPS_V223.pickup,...VEHICLE_SIZES_V223.pickup),0,19);
 // Reposition the existing painted steel mount, extending its own pole pixels.
 const mount=canvas(32,38),mc=mount.getContext('2d')!;mc.imageSmoothingEnabled=false;mc.drawImage(clean,350,133,270,200,0,0,30,22);
 mc.drawImage(clean,482,205,34,120,15,20,4,18);bodyCtx.drawImage(mount,33,0);
 return {body,barrel,barrelPivot:[(535-403)*.07,(832-775)*.07],sourceElevation:0};
}
export interface TowRackParts {body:HTMLCanvasElement;tubes:HTMLCanvasElement[];}
const TOW_RECTS:Crop[]=[[51,0,48,13],[51,14,48,13]];
/** Detach the two painted canisters from the existing TOW vehicle. */
export function towRackParts(frame:HTMLCanvasElement):TowRackParts{
 const body=canvas(frame.width,frame.height),ctx=body.getContext('2d')!;ctx.drawImage(frame,0,0);
 const tubes=TOW_RECTS.map(rect=>{const out=canvas(rect[2],rect[3]);out.getContext('2d')!.drawImage(frame,...rect,0,0,rect[2],rect[3]);ctx.clearRect(...rect);return out;});return {body,tubes};
}
export function towRackState(u:Pick<Unit,'ammo'|'reloadingStartAt'|'reloadingUntil'|'towFired'|'towShotAt'>,time:number){
 const reload=(u.reloadingUntil??0)>time,progress=reload?Math.max(0,Math.min(1,(time-(u.reloadingStartAt??time))/Math.max(.01,(u.reloadingUntil??time)-(u.reloadingStartAt??time)))):0;
 return {loaded:[(u.ammo??2)>=2||reload&&progress>.48,(u.ammo??2)>=1||reload&&progress>.82],progress,ejectAge:time-(u.towShotAt??-100),ejectSlot:u.towFired??0};
}
export function drawTowRack(ctx:CanvasRenderingContext2D,parts:TowRackParts,u:Unit,time:number,depth=0){
 const status=towRackState(u,time);ctx.save();ctx.translate(u.x,u.y+depth);ctx.rotate(u.hullAngle??0);ctx.scale(u.facing<0?-1:1,1);ctx.drawImage(parts.body,-75,-82);
 TOW_RECTS.forEach((r,i)=>{if(status.loaded[i]){const lift=status.progress&&status.progress<(i?.93:.62)?Math.max(0,(i?.93:.62)-status.progress)*30:0;ctx.drawImage(parts.tubes[i],r[0]-75,r[1]-82+lift);}else if(status.ejectSlot===i&&status.ejectAge>=0&&status.ejectAge<.7){ctx.save();ctx.translate(r[0]-75-status.ejectAge*18,r[1]-82+status.ejectAge**2*80);ctx.rotate(-status.ejectAge*1.4);ctx.globalAlpha=1-status.ejectAge/.7;ctx.drawImage(parts.tubes[i],0,0);ctx.restore();}});ctx.restore();
}
