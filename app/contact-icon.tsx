import {CONTACT_PIXELS,type ContactKind} from '../game/contact-markers';
export default function ContactIcon({kind}:{kind:ContactKind}) {
 const rows=CONTACT_PIXELS[kind],w=Math.max(...rows.map(row=>row.length));
 return <svg viewBox={`0 0 ${w} ${rows.length}`} shapeRendering="crispEdges" style={{width:"100%",height:"100%"}} aria-hidden="true">{rows.flatMap((row,y)=>[...row].map((pixel,x)=>pixel==='X'?<rect key={`${x}:${y}`} x={x} y={y} width={1} height={1} fill="currentColor"/>:null))}</svg>;
}
