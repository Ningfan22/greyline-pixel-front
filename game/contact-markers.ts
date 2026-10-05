import { CARDS,modelOf } from './cards';
import type { GroundContact } from './world';

export type ContactKind = 'infantry' | 'tank' | 'artillery' | 'vehicle';
export function contactKind(id: keyof typeof CARDS): ContactKind {
  const c=CARDS[id];
  return c.members ? 'infantry' : modelOf(id)==='tank' ? 'tank' : c.emplacement || c.indirect ? 'artillery' : 'vehicle';
}
/** Render squad reports together. Every input is an observed snapshot; hidden
 * unit coordinates, health and deaths are never consulted. */
export function contactMarkers(contacts: readonly GroundContact[]) {
  const groups=new Map<string, GroundContact[]>();
  for(const c of contacts) {
    const key=c.kind==='infantry'&&c.squad!==undefined ? `squad:${c.squad}` : `unit:${c.uid}`;
    const group=groups.get(key)??[];group.push(c);groups.set(key,group);
  }
  return [...groups.entries()].map(([key,group])=>({key,kind:group[0].kind??'infantry',side:group[0].side,
    x:group.reduce((a,c)=>a+c.x,0)/group.length,y:group.reduce((a,c)=>a+c.y,0)/group.length,
    seenAt:Math.max(...group.map(c=>c.seenAt)),uids:group.map(c=>c.uid)}));
}
export const CONTACT_LABEL:Record<ContactKind,string>={infantry:'步兵',tank:'坦克',artillery:'火炮',vehicle:'车辆'};
export const CONTACT_PIXELS:Record<ContactKind,string[]>={
  infantry:['  XX  ','  XX  ',' XXXX ','X XX X','  XX  ',' X  X ',' X  X '],
  tank:['   XX     ',' XXXXXX   ','XXXXXXXXXX','XXXXXXXX  ',' XXXXXX   ','XXXXXXXX  ',' XXXXXX   '],
  artillery:['      XX','    XX  ','  XXXX  ',' XXXX   ','XX  XX  ','XX  XX  '],
  vehicle:['  XXXX  ','XXXXXXXX','X XX XXX','XXXXXXXX',' XX  XX '],
};
export function drawContactIcon(ctx:CanvasRenderingContext2D,kind:ContactKind,x:number,y:number,scale=2){
  const rows=CONTACT_PIXELS[kind], width=Math.max(...rows.map(r=>r.length));
  for(let row=0;row<rows.length;row++)for(let col=0;col<rows[row].length;col++)
    if(rows[row][col]==='X')ctx.fillRect(Math.round(x+(col-width/2)*scale),Math.round(y+row*scale),scale,scale);
}
