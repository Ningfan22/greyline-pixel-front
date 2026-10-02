import { createGame, spawnUnit, refreshVision, type CardId } from './engine';
import { setupCampaign, missionById, type MissionId } from './campaign';
import type { Difficulty } from './economy';
import { AI_DECKS } from './deck-presets';

export function createCampaignGame(
  seed: number,
  deck: CardId[],
  id: MissionId,
  difficulty: Difficulty,
) {
  const mission = missionById(id);
  const ai = AI_DECKS[mission.aiDeck];
  const s = createGame(seed, deck, ai, mission.mapId, {
    difficulty,
    night: mission.night ?? false,
  });
  setupCampaign(s, id, { spawn: spawnUnit, refresh: refreshVision });
  return s;
}
