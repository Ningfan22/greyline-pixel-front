import type { Unit } from './engine';
import {weaponModel,CARDS} from './cards';
import {crouchTravelAmount} from './crouch-locomotion';
import {isPrecisionObserver} from './precision-team';
import {SPECIALIST_LANDMARKS} from './specialist-landmarks';
import {WEAPON_POSES,HEAVY_MG_MUZZLE,specialistBodyOffset,type WeaponPose} from './weapon-pose-data';

export type InfantryWeaponBody = Pick<Unit,'id'|'pose'|'moving'> & Partial<Pick<Unit,
  'member'|'walk'|'tactic'|'crouchTravel'|'poseAnimProgress'|'poseAnimFrom'|'poseAnimSeen'|'poseAnimFromTravel'|'poseAnimToTravel'>>;
type HeightClass = 'stand'|'crouch'|'prone';
type Muzzle = {x:number;height:number};
const blend=(a:Muzzle,b:Muzzle,t:number):Muzzle=>({x:a.x+(b.x-a.x)*t,height:a.height+(b.height-a.height)*t});

/** Null leaves ordinary rifles and indirect mortar geometry unchanged.
 * This is pure data; it does not decode images or depend on a drawn frame. */
export function infantryWeaponMuzzle(u: InfantryWeaponBody): Muzzle | null {
  if(!CARDS[u.id].members)return null;
  const member=u.member??0,body={id:u.id,member};
  if(isPrecisionObserver(body))return null;
  const role=u.id==='grenadiers'?'grenade':weaponModel(body);
  const heavy=u.id==='heavy_mg'&&member===0;
  const authored=role in WEAPON_POSES&&!heavy?WEAPON_POSES[role as keyof typeof WEAPON_POSES]:null;
  // Heavy MG travelling/prone bodies and medics still use the legacy painted set.
  const legacy=heavy?0:role==='medic'?3:-1;
  if(!authored&&legacy<0)return null;
  const cycle=(n:number)=>((Math.floor((u.walk??0)/2)%n)+n)%n;
  const point=(pose:HeightClass,travel=0,move=false):Muzzle=>{
    const row=pose==='stand'?0:pose==='crouch'?1:2;
    if(heavy&&pose==='crouch'&&travel===0&&!move&&u.pose!=='hunker')
      return {x:HEAVY_MG_MUZZLE.x,height:HEAVY_MG_MUZZLE.height-3};
    const part=(authored?.[pose]??SPECIALIST_LANDMARKS[legacy+row*5]) as WeaponPose;
    const lowGait=pose==='crouch'&&travel>0;
    const composite=move||lowGait||(!authored&&pose==='prone');
    const group=lowGait?'crouch8':pose==='prone'?'actions20':
      move&&(u.pose==='run'||u.tactic==='retreat')?'actions20':'walk8';
    const index=pose==='prone'?(move&&cycle(2)?12:2):group==='actions20'?16+cycle(4):0;
    const offset=composite?specialistBodyOffset(group,index,part):{x:0,y:0};
    const result={x:part.muzzle[0]+offset.x-64,height:93-part.muzzle[1]-offset.y};
    // During knee-up settling there is no live firing, but planning must not
    // jump to the full-height moving muzzle before the body gets there.
    return lowGait&&travel<1?blend(point(pose,0,false),result,travel):result;
  };
  const p=u.poseAnimProgress;
  if(p!==undefined&&p<1&&u.poseAnimFrom&&u.poseAnimSeen){
    const full=u.poseAnimFrom==='stand'&&u.poseAnimSeen==='prone'||u.poseAnimFrom==='prone'&&u.poseAnimSeen==='stand';
    const from=full&&p>=.5?'crouch':u.poseAnimFrom,to=full&&p<.5?'crouch':u.poseAnimSeen;
    return blend(point(from,from==='crouch'?u.poseAnimFromTravel??0:0),
      point(to,to==='crouch'?u.poseAnimToTravel??0:0),full?p<.5?p*2:(p-.5)*2:p);
  }
  const pose=u.pose==='prone'?'prone':u.pose==='crouch'||u.pose==='hunker'||u.pose==='land'?'crouch':'stand';
  return point(pose,crouchTravelAmount(u),u.moving);
}
