import {expansionGunSupports} from './expansion-art-v227';
import {CARDS,type CardId} from './cards';
/** Contacts measured on the existing final-size carriage pixels: trail/spade,
 * then the near wheel (AA uses its two ground pads). The barrel is no support. */
export function emplacementSupports(id:CardId):readonly (readonly [number,number])[] {
  const custom=expansionGunSupports(id);
  if(custom)return custom;
  if(id==='field_gun')return [[-68,-3],[51,0]];
  if(id==='siege_gun')return [[-113,-1],[87,-2]];
  switch(CARDS[id].emplacement){
    case 'at_gun':return [[-105,-2],[-2,0]];
    case 'aa_gun':return [[-60,0],[54,0]];
    default:return [[-104,0],[8,-1]];
  }
}
export function emplacementContact(ground:(x:number)=>number,x:number,id:CardId,facing=1){
  const dir=facing<0?-1:1,[a,b]=emplacementSupports(id);
  const offsets=(p:readonly [number,number],angle:number)=>({x:dir*p[0]*Math.cos(angle)-p[1]*Math.sin(angle),y:dir*p[0]*Math.sin(angle)+p[1]*Math.cos(angle)});
  // Solve the two painted supports against their rotated terrain samples.
  // Sampling only the carriage centre leaves the wheel floating over dips.
  const gap=(angle:number)=>{const p=offsets(a,angle),q=offsets(b,angle);return dir*(ground(x+q.x)-ground(x+p.x)-(q.y-p.y));};
  let lo=-.6,hi=.6;
  for(let i=0;i<24;i++){const mid=(lo+hi)/2;if(gap(mid)>0)lo=mid;else hi=mid;}
  const angle=(lo+hi)/2,p=offsets(a,angle),q=offsets(b,angle);
  return {y:Math.min(ground(x+p.x)-p.y,ground(x+q.x)-q.y),angle};
}
