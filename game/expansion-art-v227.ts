import {GUN_SIZES_V227} from './expansion-v227';
import type {CardId} from './cards';
import type {GunMount} from './gun-geometry';
import type {PaintedGunParts} from './gun-art';
const LAYOUT:Record<string,{aspect:number;pivot:[number,number]}>={
 mortar_60:{aspect:0.5346,pivot:[.30,.75]},mortar_81:{aspect:0.6108,pivot:[.30,.76]},mortar_120:{aspect:0.4224,pivot:[.35,.68]},
 howitzer_105:{aspect:0.3511,pivot:[.76,.24]},howitzer_120:{aspect:0.3178,pivot:[.70,.26]},howitzer_122:{aspect:0.3577,pivot:[.74,.22]},
 howitzer_152:{aspect:0.3947,pivot:[.74,.21]},howitzer_155:{aspect:0.3043,pivot:[.68,.23]},howitzer_203:{aspect:0.3124,pivot:[.69,.21]},field_gun_85:{aspect:0.4357,pivot:[.74,.24]},
 sp_howitzer_122:{aspect:0.4608,pivot:[.63,.283]},sp_howitzer_155:{aspect:0.5603,pivot:[.658,.378]},
};
export function expansionGunLayout(id:CardId){
 const a=LAYOUT[id];if(!a)return null;
 const mortar=id.startsWith('mortar_'),self=id.startsWith('sp_'),w=GUN_SIZES_V227[id][0],bodyWidth=Math.round(w*(mortar||self?1:.74)),bodyHeight=Math.round(bodyWidth*a.aspect);
 if(id==='mortar_60')return {bodyWidth,bodyHeight,pivotX:bodyWidth*(-.138),pivotHeight:bodyHeight*.356,barrelLength:bodyWidth*.32,mortar,fixedTube:true};
 if(id==='mortar_120')return {bodyWidth,bodyHeight,pivotX:bodyWidth*(-.28),pivotHeight:bodyHeight*.10,barrelLength:Math.round(w*.7),mortar};
 const barrelLength=Math.round(w*(mortar?.7:self?.54:.46));
 return {bodyWidth,bodyHeight,pivotX:bodyWidth*(a.pivot[0]-.5),pivotHeight:bodyHeight*(1-a.pivot[1]),barrelLength,mortar};
}
export function expansionGunMount(id:CardId):GunMount|null{
 const a=expansionGunLayout(id);if(!a)return null;
 return {pivotX:a.pivotX,pivotHeight:a.pivotHeight,barrelLength:a.barrelLength,minElevation:(a.fixedTube?56:a.mortar?45:-5)*Math.PI/180,maxElevation:(a.fixedTube?56:a.mortar?82:65)*Math.PI/180,restElevation:(a.fixedTube?56:a.mortar?65:8)*Math.PI/180};
}
function surface(w:number,h:number){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
export function expansionGunParts(id:CardId,bodySource:HTMLImageElement,barrelSource:HTMLImageElement):PaintedGunParts{
 const a=expansionGunLayout(id)!;
 const body=surface(a.bodyWidth,a.bodyHeight);body.getContext('2d')!.imageSmoothingEnabled=false;const b=body.getContext('2d')!;
 if(id==='mortar_60'||id==='mortar_120'){b.translate(a.bodyWidth,0);b.scale(-1,1);}
 b.drawImage(bodySource,0,0,a.bodyWidth,a.bodyHeight);
 if(a.fixedTube)return {body,barrel:surface(1,1),barrelPivot:[0,0],sourceElevation:0};
 const width=Math.round(a.barrelLength/ (id.startsWith('sp_')?.86:.90)),height=Math.max(3,Math.round(width*barrelSource.height/barrelSource.width));
 const barrel=surface(width,height),c=barrel.getContext('2d')!;c.imageSmoothingEnabled=false;c.drawImage(barrelSource,0,0,width,height);
 return {body,barrel,barrelPivot:[width*(id.startsWith('sp_')?.14:.10),height/2],sourceElevation:0,barrelBehindBody:id.startsWith('sp_')};
}
/** Remove only transparent padding from imported authored fort pixels. */
export function groundedFortSprite(source:HTMLImageElement,width:number,height:number){
 const imported=surface(source.width,source.height),c=imported.getContext('2d')!;c.drawImage(source,0,0);
 const data=c.getImageData(0,0,source.width,source.height).data;
 let l=source.width,t=source.height,r=0,b=0;
 for(let y=0;y<source.height;y++)for(let x=0;x<source.width;x++)if(data[(y*source.width+x)*4+3]>180){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}
 if(l>r)throw Error('Empty fort sprite');
 const out=surface(width,height),ctx=out.getContext('2d')!;ctx.imageSmoothingEnabled=false;ctx.drawImage(source,l,t,r-l+1,b-t+1,0,0,width,height);return out;
}

/** Visible tyre/baseplate contacts measured in each imported carriage. */
export function expansionGunSupports(id:CardId){
 const a=expansionGunLayout(id);if(!a)return null;
 const contacts:Record<string,readonly[readonly[number,number],readonly[number,number]]>={
  mortar_60:[[-.27,-.04],[.24,0]],mortar_81:[[-.23,-.06],[.39,0]],mortar_120:[[-.29,0],[.38,-.015]],
  howitzer_105:[[-.44,-.084],[.10,0]],howitzer_120:[[-.44,-.075],[.185,-.06]],howitzer_122:[[-.12,0],[.025,-.105]],
  howitzer_152:[[-.42,0],[.38,0]],howitzer_155:[[-.44,0],[.145,0]],howitzer_203:[[-.242,0],[.211,0]],field_gun_85:[[-.43,0],[.375,0]],
 };
 const p=contacts[id];return p?.map(([x,y])=>[x*a.bodyWidth,y*a.bodyHeight] as const)??null;
}
