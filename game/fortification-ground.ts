import {CARDS,type CardId} from './cards';
import {FORT_SIZES_V227} from './expansion-v227';
export function fortificationSize(id:CardId):[number,number]{
 const custom=FORT_SIZES_V227[id];if(custom)return [...custom];
 const kind=CARDS[id].fortification;
 return kind==='wire'?[116,34]:kind==='aa'?[112,82]:kind==='spawn'?[118,64]:[112,64];
}
/** A level footing sits at the highest terrain point across its width. Render
 * fills the gap beneath it with the existing soil; no floating low-side base. */
export function fortificationContact(ground:(x:number)=>number,x:number,id:CardId){
 const [w]=fortificationSize(id);let y=ground(x);
 for(let dx=-w/2;dx<=w/2;dx+=4)y=Math.min(y,ground(x+dx));
 return y;
}

/** Fixed guards on the watchtower use its elevated, level deck. */
export const fortCrewElevation=(id:CardId)=>id==='fort_watchtower'?106:0;
