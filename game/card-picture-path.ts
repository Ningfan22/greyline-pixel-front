import {EXPANSION_IDS_V227} from './expansion-v227';
import { type CardId } from './cards';
import { isV197Vehicle, vehicleAssetV197 } from './vehicle-art-v197';
const identity = (path: string) => path;
const ADDITIONAL_CARD_ART = new Set([
  'pickup',
  'mortar_carrier',
  'recovery_vehicle',
  'command_vehicle',
  'mine_clearer',
]);
export function cardPicturePath(id: CardId) {
  if(id==='stealth_bomber'||id==='anti_radiation_shell')return `/art/v233/${id}.webp`;
  if((EXPANSION_IDS_V227 as readonly string[]).includes(id)||['apc_transport','supply_truck','pickup','mlrs'].includes(id))return `/art/v227-cards/${id}.webp`;
  if(id==='rapid_assault')return cardPicturePath('assault');
  if(id==='rapid_at')return cardPicturePath('antiarmor');
  if(id==='rapid_recon')return cardPicturePath('scouts');
  if (['antitank_cluster','hunter_swarm','antitank_barrier'].includes(id)) return `/art/v212-counterarmor/${id}.webp`;
  if (id === 'mlrs') return '/art/v204-weapons/mlrs-card.webp';
  if (isV197Vehicle(id)) return identity(vehicleAssetV197(id, 'card'));
  if (
    id === 'rapid_reinforcements' ||
    id === 'escort_gunship' ||
    id === 'field_gun' ||
    id === 'siege_gun' ||
    id === 'fort_bunker' ||
    id === 'fort_machinegun' ||
    id === 'fort_aa' ||
    id === 'fort_spawn' ||
    id === 'fort_wire'
  )
    return identity(`/art/v190/cards/${id}.webp`);
  if (id === 'glider_transport') return cardPicturePath('glider_assault');
  if (
    id === 'field_logistics' ||
    id === 'command_expansion' ||
    id === 'war_bonds'
  )
    return identity(`/art/v21-economy/cards/${id}.webp`);
  if (
    id === 'toxic_cloud' ||
    id === 'smoke_withdrawal' ||
    id === 'reserve_mobilization'
  )
    return identity(`/art/v18-comeback/cards/${id}.webp`);
  if (id === 'fpv_drone' || id === 'air_assault')
    return identity(`/art/v16-air/cards/${id}.webp`);
  if (
    id === 'overdraft' ||
    id === 'signal_jam' ||
    id === 'airborne_insertion' ||
    id === 'forced_march' ||
    id === 'cyber_suppression'
  )
    return identity(`/art/v23-doctrine/cards/${id}.webp`);
  return identity(
    `/art/${ADDITIONAL_CARD_ART.has(id) ? 'cards-v15' : 'cards-v10'}/${id}.webp`,
  );
}
