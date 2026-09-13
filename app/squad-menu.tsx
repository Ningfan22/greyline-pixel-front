'use client';
import type { CSSProperties } from 'react';
import { SQUAD_ORDERS, type SquadOrder } from '@/game/squad-orders';
import { assetUrl } from '@/game/asset-url';
import styles from './squad-menu.module.css';

const glyphs: Record<SquadOrder, string> = {
  escort:
    'M2 7h12v5H2zM1 12h14v3H1zM6 3h5v4H6zM10 4h6v2h-6zM0 1h2v2h2v2H2v2H0z',
  hold: 'M1 10h3V7h2v3h4V7h2v3h3v4H1zM6 1h4v4H6z',
  retreat: 'M7 1v3H4v3H1v2h3v3h3v3h2v-5h6V6H9V1z',
  attack: 'M7 1v5H1v4h6v5h2v-3h3V9h3V7h-3V4H9V1z',
  watch:
    'M5 1h6v2h3v3h2v4h-2v3h-3v2H5v-2H2v-3H0V6h2V3h3zM4 6v4h2v2h4v-2h2V6h-2V4H6v2zM6 6h4v4H6z',
};
export default function SquadMenu({
  x,
  y,
  name,
  count,
  order,
  progress,
  onOrder,
  onClose,
}: {
  x: number;
  y: number;
  name: string;
  count: number;
  order?: SquadOrder;
  progress?: number;
  onOrder: (order: SquadOrder) => void;
  onClose: () => void;
}) {
  return (
    <div
      className={styles.menu}
      role="toolbar"
      aria-label={`${name}小队指令`}
      style={{
        left: `clamp(145px, ${x}%, calc(100% - 145px))`,
        top: `clamp(104px, ${y}%, calc(100% - 86px))`,
      }}
    >
      <style>{`@font-face{font-family:'Greyline Squad Pixel';src:url('${assetUrl('/fonts/fusion-pixel-12px-monospaced-zh_hans.otf.woff2')}') format('woff2');font-display:swap;}`}</style>
      {SQUAD_ORDERS.map((item, i) => (
        <button
          key={item.id}
          type="button"
          aria-pressed={order === item.id}
          aria-label={`小队${item.label}`}
          title={item.description}
          className={styles.action}
          style={
            {
              '--x': `${[-112, -56, 0, 56, 112][i]}px`,
              '--y': `${[24, 6, 0, 6, 24][i]}px`,
              '--tilt': `${[-14, -7, 0, 7, 14][i]}deg`,
            } as CSSProperties
          }
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onOrder(item.id)}
        >
          <svg
            viewBox="0 0 16 16"
            aria-hidden="true"
            shapeRendering="crispEdges"
          >
            <path d={glyphs[item.id]} fill="currentColor" fillRule="evenodd" />
          </svg>
          <span>{item.label}</span>
        </button>
      ))}
      <div className={styles.caption}>
        <span>
          {name} · {count}人
        </span>
        <button type="button" aria-label="关闭小队指令" onClick={onClose}>
          ×
        </button>
      </div>
      {order === 'hold' && progress !== undefined && (
        <div
          className={styles.progress}
          aria-label={
            progress < 1
              ? `修筑战壕 ${Math.round(progress * 100)}%`
              : '阵地已完成'
          }
        >
          <i style={{ width: `${progress * 100}%` }} />
          <span>{progress < 1 ? '修筑阵地' : '阵地就绪'}</span>
        </div>
      )}
    </div>
  );
}
