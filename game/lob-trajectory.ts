/** Same parabola used by live unguided projectiles. */
export function lobY(startY:number,endY:number,arc:number,t:number) {
  return startY+(endY-startY)*t-4*t*(1-t)*arc;
}
/** Short chords keep the 70px grenade arc within 0.2px at normal ranges.
 * Each chord still uses the normal solid-soil/scenery collision policy. */
export function lobIntercept<T>(
  sx:number,sy:number,tx:number,ty:number,arc:number,
  intercept:(x0:number,y0:number,x1:number,y1:number)=>T|null,
):T|null {
  const steps=Math.max(20,Math.ceil(Math.hypot(tx-sx,ty-sy)/12));
  let x=sx,y=sy;
  for(let i=1;i<=steps;i++) {
    const t=i/steps,nx=sx+(tx-sx)*t,ny=lobY(sy,ty,arc,t);
    const hit=intercept(x,y,nx,ny);if(hit)return hit;
    x=nx;y=ny;
  }
  return null;
}
