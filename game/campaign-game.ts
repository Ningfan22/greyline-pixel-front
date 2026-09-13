import { createGame, spawnUnit, refreshVision, type CardId } from './engine';
import { setupCampaign, missionById, type MissionId } from './campaign';
import type { Difficulty } from './economy';
import { AI_DECKS } from './deck-presets';

const MISSION_AI: Record<MissionId, number> = {
  'salt-road': 0,
  'ridge-relay': 2,
  'river-counterattack': 4,
  'canopy-signal': 1,
  'last-convoy': 3,
  'silent-terminal': 2,
};

export function createCampaignGame(
  seed: number,
  deck: CardId[],
  id: MissionId,
  difficulty: Difficulty,
) {
  const mission = missionById(id);
  const ai = AI_DECKS[MISSION_AI[id]];
  const s = createGame(seed, deck, ai, mission.mapId, { difficulty });
  setupCampaign(s, id, { spawn: spawnUnit, refresh: refreshVision });
  return s;
}
