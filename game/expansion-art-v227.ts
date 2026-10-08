import type {CardId} from './cards';
import type {GunMount} from './gun-geometry';
import type {PaintedGunParts} from './gun-art';
/** Authored plate coordinates. One uniform scale preserves tube/carriage proportions. */
type Rig={size:[number,number];width:number;pivot:[number,number];tube:[number,number];gunPivot:[number,number];muzzle:[number,number];feet?:[[number,number],[number,number]];mortar?:boolean};
const RIGS:Record<string,Rig>={
 howitzer_105:{size:[1109,464],width:125,pivot:[989,90],tube:[1130,236],gunPivot:[118,144],muzzle:[1124,144],feet:[[110,450],[914,461]]},
 howitzer_120:{size:[1108,464],width:145,pivot:[1038,82],tube:[1119,181],gunPivot:[137,97],muzzle:[1110,92],feet:[[88,460],[900,444]]},
 howitzer_122:{size:[1176,351],width:150,pivot:[781,95],tube:[1116,165],gunPivot:[173,39],muzzle:[1108,90],feet:[[111,346],[808,348]]},
 howitzer_152:{size:[1114,491],width:165,pivot:[1084,133],tube:[1149,194],gunPivot:[176,138],muzzle:[1140,97],feet:[[95,486],[940,468]]},
 howitzer_155:{size:[1123,330],width:175,pivot:[1025,36],tube:[1112,173],gunPivot:[158,116],muzzle:[1102,76],feet:[[85,324],[911,320]]},
 howitzer_203:{size:[1204,362],width:195,pivot:[999,36],tube:[1196,194],gunPivot:[185,111],muzzle:[1187,112],feet:[[90,355],[956,357]]},
 field_gun_85:{size:[1095,503],width:155,pivot:[968,144],tube:[1166,202],gunPivot:[168,86],muzzle:[1155,86],feet:[[55,495],[861,480]]},
 sp_howitzer_122:{size:[1223,493],width:160,pivot:[723,133],tube:[1075,180],gunPivot:[197,105],muzzle:[1064,85]},
 sp_howitzer_155:{size:[1167,633],width:185,pivot:[754,225],tube:[1166,199],gunPivot:[269,108],muzzle:[1157,108]},
 mortar_60:{size:[1151,644],width:64,pivot:[17,34],tube:[1141,184],gunPivot:[5,100],muzzle:[1135,100],mortar:true},
 mortar_81:{size:[1141,578],width:76,pivot:[20,40],tube:[1134,197],gunPivot:[6,108],muzzle:[1129,108],mortar:true},
 mortar_120:{size:[1128,516],width:94,pivot:[24,49],tube:[1124,189],gunPivot:[6,90],muzzle:[1118,90],mortar:true},
};
export function expansionGunLayout(id:CardId){
 const r=RIGS[id];if(!r)return null;
 const scale=r.mortar?({mortar_60:48,mortar_81:60,mortar_120:75}[id as 'mortar_60'])/(r.muzzle[0]-r.gunPivot[0]):r.width/r.size[0];
 const bodyWidth=r.width,bodyHeight=r.mortar?Math.round(r.width*.66):Math.round(r.size[1]*scale);
 const pivotX=r.mortar?r.pivot[0]-bodyWidth/2:r.pivot[0]*scale-bodyWidth/2;
 const pivotHeight=bodyHeight-r.pivot[1]*(r.mortar?1:scale);
 return {bodyWidth,bodyHeight,pivotX,pivotHeight,barrelLength:(r.muzzle[0]-r.gunPivot[0])*scale,mortar:!!r.mortar,scale,
 barrelWidth:Math.round(r.tube[0]*scale),barrelHeight:Math.round(r.tube[1]*scale),barrelPivot:[r.gunPivot[0]*scale,r.gunPivot[1]*scale] as [number,number],
 muzzleOffset:[(r.muzzle[0]-r.gunPivot[0])*scale,(r.muzzle[1]-r.gunPivot[1])*scale] as [number,number]};
}
export function expansionGunMount(id:CardId):GunMount|null{
 const a=expansionGunLayout(id);if(!a)return null;
 return {pivotX:a.pivotX,pivotHeight:a.pivotHeight,barrelLength:a.barrelLength,muzzleOffset:a.muzzleOffset,minElevation:(a.mortar?45:-5)*Math.PI/180,maxElevation:(a.mortar?82:65)*Math.PI/180,restElevation:(a.mortar?65:8)*Math.PI/180};
}
function surface(w:number,h:number){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
export function expansionGunParts(id:CardId,bodySource:HTMLImageElement,barrelSource:HTMLImageElement):PaintedGunParts{
 const a=expansionGunLayout(id)!,r=RIGS[id],body=surface(a.bodyWidth,a.bodyHeight),b=body.getContext('2d')!;b.imageSmoothingEnabled=false;
 let mortarBipod:PaintedGunParts['mortarBipod'];
 if(a.mortar){
  // The imagegen plate contains detached baseplate and bipod. Assemble their
  // authored pixels without deforming either part or fusing the moving tube.
  const split= id==='mortar_60'?680:id==='mortar_81'?710:690;
  const plateTop=id==='mortar_60'?408:id==='mortar_81'?292:292;
  const pw=Math.round(a.bodyWidth*.52),ph=Math.round((r.size[1]-plateTop)*pw/split);
  b.drawImage(bodySource,0,plateTop,split,r.size[1]-plateTop,0,a.bodyHeight-ph,pw,ph);
  const sw=r.size[0]-split,sh=r.size[1],bh=Math.round(a.bodyHeight*.80),bw=Math.round(sw*bh/sh);
  const sprite=surface(bw,bh),support=sprite.getContext('2d')!;support.imageSmoothingEnabled=false;support.drawImage(bodySource,split,0,sw,sh,0,0,bw,bh);
  mortarBipod={sprite,joint:[bw*(id==='mortar_60'?.40:id==='mortar_81'?.27:.37),bh*.04]};
 }else b.drawImage(bodySource,0,0,a.bodyWidth,a.bodyHeight);
 const barrel=surface(a.barrelWidth,a.barrelHeight),c=barrel.getContext('2d')!;c.imageSmoothingEnabled=false;c.drawImage(barrelSource,0,0,barrel.width,barrel.height);
 return {body,barrel,barrelPivot:a.barrelPivot,sourceElevation:0,barrelBehindBody:id.startsWith('sp_'),mortarBipod};
}
export function expansionGunSupports(id:CardId){
 const r=RIGS[id],a=expansionGunLayout(id);if(!a)return null;
 if(a.mortar)return [[-a.bodyWidth*.35,0],[a.bodyWidth*.18,0]] as const;
 return r.feet?.map(([x,y])=>[x*a.scale-a.bodyWidth/2,y*a.scale-a.bodyHeight] as const)??null;
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
