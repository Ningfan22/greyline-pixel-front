'use client';
import {vehicleOutOfFuel} from '../game/vehicle-logistics';
import { CARDS } from '@/game/cards';
import type { Unit } from '@/game/engine';
import type { LogisticsOrder } from '@/game/logistics-orders';
import SquadMenu from './squad-menu';
/** Shortage replaces the same command fan, without a second selection panel. */
export default function UnitLogisticsFan({unit,reason,x,y,onOrder,onClose}:{
  unit:Unit;reason:string;x:number;y:number;
  onOrder:(order:LogisticsOrder)=>void;onClose:()=>void;
}) {
  const card=CARDS[unit.id];
  return <SquadMenu x={x} y={y} name={`${card.name} · ${reason}`} count={1}
    unitLabel={card.members?'人':card.emplacement?'门':'辆'}
    orders={[
      ...(!vehicleOutOfFuel(unit) && (!card.static || card.emplacement) ? [{id:'attack' as const,label:'继续推进',description:'继续执行推进任务'}] : []),
      {id:'watch',label:'原地待命',description:'留在当前位置观察还击'},
      {id:'retreat',label:vehicleOutOfFuel(unit)?'等待送补给':'回去补给',description:vehicleOutOfFuel(unit)?'燃油耗尽，留在原地，补给组或弹药箱到达后恢复机动':'撤向最近可用补给点，补满后恢复推进'},
    ]}
    order={unit.logisticsOrder==='advance'?'attack':unit.logisticsOrder==='hold'?'watch':unit.logisticsOrder==='resupply'?'retreat':undefined}
    onClose={onClose} onOrder={choice=>onOrder(choice==='attack'?'advance':choice==='watch'?'hold':'resupply')}/>;
}
