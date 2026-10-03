import data from './tank-wreck-collision.json' with {type:'json'};
import type { WreckGeometry, WreckKind } from './wreck-geometry';
import { tankLayoutV202, type TankIdV202 } from './tank-layout-v202';
type Cause = 'bullet'|'blast'|'burn';

const previousLiveWidth = {light_tank: 185, tank: 270, heavy_tank: 305};
export function tankWreckDimensions(kind: TankIdV202): [number, number] {
  const scale = tankLayoutV202(kind).width / previousLiveWidth[kind];
  return [Math.round(384 * scale), Math.round(192 * scale)];
}
function scaledMetalParts(id: TankIdV202, parts: number[][]) {
  const [width, height] = tankWreckDimensions(id);
  // A one-pixel source edge can vanish during the single downsample. Keep
  // collision inside the surviving metal instead of its transparent fringe.
  return parts.map(([x, y, w, h]) => {
    const left = Math.ceil(x * width + .25), top = Math.ceil(y * height + 1);
    const right = Math.floor((x + w) * width - .25), bottom = Math.floor((y + h) * height);
    return [left / width, top / height, Math.max(1, right - left) / width,
      Math.max(1, bottom - top) / height];
  });
}

// Packed art and this collision data are produced together. A missing turret
// cannot retain the old tall collider, and differently torn roofs differ too.
const profiles=Object.fromEntries(Object.entries(data).map(([id,value])=>[
  id,Object.fromEntries(Object.entries(value.parts).map(([cause,parts])=>[
    cause,{
      atlas:'ground',source:[0,0,384,192],
      width:tankWreckDimensions(id as TankIdV202)[0],height:tankWreckDimensions(id as TankIdV202)[1],
      parts:scaledMetalParts(id as TankIdV202,parts),support:value.support,spriteOffset:0,
    },
  ])),
])) as Partial<Record<WreckKind,Record<Cause,WreckGeometry>>>;

export function paintedTankWreckGeometry(kind: WreckKind,cause: Cause='bullet') {
  return profiles[kind]?.[cause];
}
