import ContactIcon from './contact-icon';
import {contactMarkers,CONTACT_LABEL} from '../game/contact-markers';
import type {GroundContact} from '../game/world';
export default function ContactMapMarks({contacts,time,width=3840}:{contacts:GroundContact[];time:number;width?:number}) {
 return <>{contactMarkers(contacts).map(mark=><span key={mark.key} className={`map-contact ${time-mark.seenAt>2?'remembered':''}`} role="img"
  aria-label={`敌方${CONTACT_LABEL[mark.kind]}最后观测位置`} title={`${CONTACT_LABEL[mark.kind]} · ${Math.floor(time-mark.seenAt)}秒前观测`}
  style={{position:'absolute',left:`${mark.x/width*100}%`,top:12,width:16,height:11,transform:'translateX(-50%)',color:time-mark.seenAt>2?'#c3a57f':'#edb984',opacity:time-mark.seenAt>2?.72:1,zIndex:3,transition:'none'}}><ContactIcon kind={mark.kind}/></span>)}</>;
}
