'use client';
import type {LogisticsOrder} from '@/game/logistics-orders';
import styles from './logistics-menu.module.css';
const choices=[['advance','继续前进'],['hold','原地待命'],['resupply','回去补给']] as const;
export default function LogisticsMenu({x,y,name,reason,order,staticUnit,onOrder,onClose}:{
  x:number;y:number;name:string;reason:string;order?:LogisticsOrder;staticUnit?:boolean;
  onOrder:(order:LogisticsOrder)=>void;onClose:()=>void;
}){
  return <div className={styles.menu} role="group" aria-label={`${name}补给选择`}
    style={{left:`clamp(146px, ${x}%, calc(100% - 146px))`,top:`clamp(122px, ${y}%, calc(100% - 12px))`}}
    onPointerDown={e=>e.stopPropagation()}>
    <div className={styles.heading}><b>{name} · {reason}</b>
      <button onClick={onClose} aria-label="关闭补给选择">×</button></div>
    <div className={styles.choices}>{choices.map(([value,label])=><button key={value}
      disabled={staticUnit&&value==='advance'} title={staticUnit&&value==='advance'?'固定阵地无法前进':undefined}
      aria-pressed={order===value} onClick={()=>onOrder(value)}>{label}</button>)}</div>
    <p>选择后按你的指令行动</p>
  </div>;
}
