import {loadBattleArt} from '../game/art';
import {watchBattleArtProgress} from '../game/battle-art-baked';
import {BAKED_BATTLE_ART} from '../game/battle-art-baked-data';
import {createGame, startGame, spawnUnit, type CardId} from '../game/engine';
import {render} from '../game/render';
import type {MapId} from '../game/maps';
const button = document.querySelector<HTMLButtonElement>('#load')!;
const status = document.querySelector('#status')!;
const report = document.querySelector('#report')!;
const canvas = document.querySelector<HTMLCanvasElement>('#battle')!;
watchBattleArtProgress(p => {status.textContent = p.stage === 'download' ? `下载素材 ${p.completed}/${p.total}` : p.stage === 'prepare' ? `准备精灵 ${p.completed}/${p.total}` : '共享素材已就绪';});
button.onclick = async () => {
  button.disabled = true;
  const mapId = (document.querySelector('#map') as unknown as HTMLSelectElement).value as MapId;
  const started = performance.now();
  try {
    const art = await loadBattleArt(mapId), readyMs = performance.now() - started;
    const game = createGame(203, undefined, undefined, mapId);
    startGame(game); game.aiIn = 1e9; game.scenery = []; game.walls = []; game.units = [];
    game.terrain.fill(370); game.original.fill(370); game.knownTerrain[0].fill(370); game.sight[0].fill(true); game.weather.disabled = true;
    (['infantry', 'light_tank', 'tank', 'artillery', 'mlrs'] as CardId[]).forEach((id, index) => spawnUnit(game, 0, id, 200 + index * 230));
    game.visible[0] = game.units.map(unit => unit.uid);
    render(canvas.getContext('2d')!, game, art, null, null, true, 0, 1280);
    const files = [...BAKED_BATTLE_ART.atlases, BAKED_BATTLE_ART.backgrounds[mapId]];
    const resources = performance.getEntriesByType('resource').filter((entry): entry is PerformanceResourceTiming => entry instanceof PerformanceResourceTiming && files.some(file => entry.name.endsWith(file.path)));
    report.textContent = JSON.stringify({map: mapId, readyMs: Math.round(readyMs), firstPaintMs: Math.round(performance.now() - started), coldAssetBytes: files.reduce((sum, file) => sum + file.bytes, 0), assetFiles: files.length,
      transfers: resources.map(entry => ({file: entry.name.split('/').at(-1), durationMs: Math.round(entry.duration), transferBytes: entry.transferSize, encodedBytes: entry.encodedBodySize, cache: entry.transferSize === 0 ? '缓存命中' : entry.transferSize <= 300 && entry.encodedBodySize > 0 ? '缓存已校验' : '网络下载'})),
      soldiers: !!art.soldiers, tankParts: Object.keys(art.gunParts ?? {}), howitzerSize: art.emplacements.howitzer.map(frame => [frame.width, frame.height])}, null, 2);
    status.textContent = `可作战 · ${Math.round(readyMs)} 毫秒`;
  } catch (error) {status.textContent = '加载失败，可点击重试'; report.textContent = String(error);}
  finally {button.disabled = false;}
};
