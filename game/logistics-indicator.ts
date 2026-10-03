import type {GameState,Unit} from './engine';
import {logisticsAlert,logisticsNeedsDecision} from './logistics-orders';
import {unitSelectionBounds} from './selection-render';

/** Shared drawing/hit geometry keeps the small pixel mark easy to select. */
export function logisticsIndicator(u:Unit) {
  if(!logisticsAlert(u))return null;
  const bounds=unitSelectionBounds(u);
  return {x:Math.round(u.x),y:Math.round(bounds.y-23),w:16,h:20};
}
export function pickLogisticsIndicator(s:GameState,x:number,y:number,touch=false) {
  let found:Unit|null=null,best=Infinity;
  const pad=touch?20:9;
  for(const u of s.units){
    const mark=logisticsIndicator(u);if(!mark)continue;
    const dx=x-mark.x,dy=y-(mark.y+mark.h/2);
    if(Math.abs(dx)>mark.w/2+pad||Math.abs(dy)>mark.h/2+pad)continue;
    const distance=dx*dx+dy*dy;
    if(distance<best){best=distance;found=u;}
  }
  return found;
}
export function drawLogisticsIndicator(ctx:CanvasRenderingContext2D,u:Unit) {
  const mark=logisticsIndicator(u);if(!mark)return;
  ctx.save();ctx.imageSmoothingEnabled=false;
  const x=mark.x-8,y=mark.y;
  ctx.fillStyle='#242c22';ctx.fillRect(x,y,16,20);
  ctx.fillStyle=logisticsNeedsDecision(u)?'#f1cf4d':'#ad994c';
  ctx.fillRect(x+2,y+2,12,16);
  ctx.fillStyle='#332e1e';ctx.fillRect(x+6,y+4,4,7);ctx.fillRect(x+6,y+13,4,3);
  ctx.restore();
}
