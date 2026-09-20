/** Measured landmarks in the prepared 128×96 whole-body cels.
 * Rendering and ballistics share these; the world foot inset is +3px. */
export interface WeaponPose {
  waist: readonly number[];
  muzzle: readonly number[];
}
export const LAUNCHER_CEL_FEET = [[91,326,533,756,981,1198,1418,1636],
  [99,330,537,763,988,1204,1418,1644]] as const;
export const LAUNCHER_CEL_MUZZLES = [[201,81],[430,73],[1520,113],[1749,77],
  [202,489],[430,487],[1524,525],[1747,489]] as const;
const launcherReady = (row: 0 | 1): WeaponPose => ({
  waist: [64,row?76:65],
  muzzle: [64+(LAUNCHER_CEL_MUZZLES[row*4][0]-LAUNCHER_CEL_FEET[row][0])*.195,
    96-((row?697:387)-LAUNCHER_CEL_MUZZLES[row*4][1])*.195],
});
export const WEAPON_POSES = {
  machinegun: {
    stand:{waist:[62.1,66.2],muzzle:[96.1,42]},
    crouch:{waist:[59.8,75.6],muzzle:[102.6,60.3]},
    prone:{waist:[63,89.6],muzzle:[111.4,83.2]},
  },
  rocket: {
    stand:{waist:[62.1,66.2],muzzle:[96.6,41.8]},
    crouch:{waist:[59.8,75.6],muzzle:[103.9,61]},
    prone:{waist:[63,90.2],muzzle:[112.6,83.8]},
  },
  sniper: {
    stand:{waist:[62.1,66.2],muzzle:[104.1,41.8]},
    crouch:{waist:[59.8,75.6],muzzle:[108.5,61.6]},
    prone:{waist:[63,91.2],muzzle:[112,85.4]},
  },
  grenade: {
    stand:launcherReady(0),crouch:launcherReady(1),
    prone:{waist:[64,89],muzzle:[107.5,86]},
  },
} satisfies Record<string,Record<'stand'|'crouch'|'prone',WeaponPose>>;
export const HEAVY_MG_MUZZLE = {x:273*.14,height:3+211*.14};

/** The existing painted-leg composition, shared with its ballistic origin. */
export function specialistLegWaist(group: string,index: number): readonly number[] {
  if(group==='actions20'&&(index===2||index===12))return index===12?[43,92]:[40,92];
  if(group==='crouch8'||group==='actions20'&&index===1)return [45,68];
  if(group==='actions20'&&index>=16&&index<=19)return [[45,60],[44,58],[45,59],[44,58]][index-16];
  return [48,63];
}
export function specialistBodyOffset(group: string,index: number,part: Pick<WeaponPose,'waist'>) {
  const waist=specialistLegWaist(group,index);
  return {x:Math.round(16+waist[0]-part.waist[0]),y:Math.round(waist[1]-part.waist[1])};
}
