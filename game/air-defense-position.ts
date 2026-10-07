import {CARDS} from './cards';
import {visibleToSide} from './world';
import type {GameState,Unit} from './engine';
/** Missile air defence screens the army from behind; airborne targets never
 * become ground pursuit destinations. Explicit local destinations still win. */
export function airDefensePosition(s:GameState,u:Unit):number|null {
  if(u.id!=='sam_vehicle'||u.squadOrder||s.players[u.side].order!=='advance')return null;
  const dir=u.side===0?1:-1,world=s.terrain.length;
  let front=u.side===0?540:world-540;
  for(const v of s.units){const c=CARDS[v.id];
    if(v.side!==u.side||v.hp<=0||v.wounded||v.surrendered||v.parachuting||v.rappelling||
      c.air||c.airOnly||c.static||c.fortification||c.vehicleSupport||!(c.damage!>0))continue;
    if((v.x-front)*dir>0)front=v.x;
  }
  let goal=front-dir*320;
  for(const v of s.units){const c=CARDS[v.id];
    if(v.side===u.side||v.hp<=0||v.wounded||v.surrendered||c.air||!(c.damage!>0)||
        !visibleToSide(s,u.side,v)||Math.abs(v.x-u.x)>900)continue;
    const safe=v.x-dir*Math.max(470,Math.min(850,(c.range??380)+120));
    if((safe-goal)*dir<0)goal=safe;
  }
  return Math.max(220,Math.min(world-220,goal));
}
