import data from './tank-wreck-collision.json' with {type:'json'};
import type { WreckGeometry, WreckKind } from './wreck-geometry';
type Cause = 'bullet'|'blast'|'burn';

// Packed art and this collision data are produced together. A missing turret
// cannot retain the old tall collider, and differently torn roofs differ too.
const profiles=Object.fromEntries(Object.entries(data).map(([id,value])=>[
  id,Object.fromEntries(Object.entries(value.parts).map(([cause,parts])=>[
    cause,{
      atlas:'ground',source:[0,0,384,192],width:384,height:192,
      parts,support:value.support,spriteOffset:0,
    },
  ])),
])) as Partial<Record<WreckKind,Record<Cause,WreckGeometry>>>;

export function paintedTankWreckGeometry(kind: WreckKind,cause: Cause='bullet') {
  return profiles[kind]?.[cause];
}
