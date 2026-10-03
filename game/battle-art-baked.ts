import {BAKED_BATTLE_ART} from './battle-art-baked-data';
import {loadArtImage} from './battle-art-loader';
import type {SharedBattleArt} from './art';
import type {MapId} from './maps';

type File = {path: string; bytes: number; width: number; height: number};
type Manifest = {atlases: File[]; frames: number[][]; external: string[]; graph: unknown; backgrounds: Record<MapId, File>};
const manifest = BAKED_BATTLE_ART as unknown as Manifest;
export interface BattleArtProgress {stage: 'download' | 'prepare' | 'ready'; completed: number; total: number}
let progress: BattleArtProgress = {stage: 'download', completed: 0, total: manifest.atlases.length};
const listeners = new Set<(progress: BattleArtProgress) => void>();
export function watchBattleArtProgress(listener: (progress: BattleArtProgress) => void) {
  listeners.add(listener); listener(progress);
  return () => {listeners.delete(listener);};
}
function report(stage: BattleArtProgress['stage'], completed: number, total: number) {
  progress = {stage, completed, total};
  for (const listener of listeners) listener(progress);
}
// Retain successful images across retries. Rejected resources must be attempted
// again, rather than leaving a rejected singleton promise until page reload.
const images = new Map<string, Promise<HTMLImageElement>>();
function imageAt(path: string) {
  let pending = images.get(path);
  if (!pending) {
    pending = loadArtImage(path).catch(error => {images.delete(path); throw error;});
    images.set(path, pending);
  }
  return pending;
}
const yieldToBrowser = () => new Promise<void>(resolve => setTimeout(resolve, 0));

/** Restore the exact final sprite cels. There is no source-sheet scanning,
 * transparency keying, connected-component extraction or pose construction. */
export async function loadBakedBattleArt(): Promise<SharedBattleArt> {
  let completed = 0;
  report('download', 0, manifest.atlases.length);
  const [atlases, externals] = await Promise.all([
    Promise.all(manifest.atlases.map(async file => {
      const image = await imageAt(file.path);
      if (image.width !== file.width || image.height !== file.height) throw new Error(`素材尺寸错误 ${file.path}`);
      report('download', ++completed, manifest.atlases.length);
      return image;
    })),
    Promise.all(manifest.external.map(async path => [path, await imageAt(path)] as const)),
  ]);
  const imageMap = new Map(externals), frames: HTMLCanvasElement[] = [];
  report('prepare', 0, manifest.frames.length);
  for (let index = 0; index < manifest.frames.length; index++) {
    const [page, x, y, width, height] = manifest.frames[index];
    const frame = document.createElement('canvas'); frame.width = width; frame.height = height;
    const context = frame.getContext('2d')!;
    context.imageSmoothingEnabled = false;
    context.drawImage(atlases[page], x, y, width, height, 0, 0, width, height);
    frames.push(frame);
    // Do not monopolize the main thread even on slower phones.
    if (index % 48 === 47) {report('prepare', index + 1, manifest.frames.length); await yieldToBrowser();}
  }
  function restore(value: unknown): unknown {
    if (value === null || typeof value !== 'object') return value;
    const object = value as Record<string, unknown>;
    if ('$frame' in object) return frames[object.$frame as number];
    if ('$image' in object) return imageMap.get(object.$image as string);
    if ('$map' in object) return new Map();
    if (Array.isArray(value)) return value.map(restore);
    return Object.fromEntries(Object.entries(object).map(([key, entry]) => [key, restore(entry)]));
  }
  const restored = restore(manifest.graph) as SharedBattleArt;
  report('ready', manifest.frames.length, manifest.frames.length);
  return restored;
}

export async function loadBakedMapBackground(mapId: MapId): Promise<HTMLCanvasElement> {
  const file = manifest.backgrounds[mapId], image = await imageAt(file.path);
  if (image.width !== file.width || image.height !== file.height) throw new Error(`地图尺寸错误 ${mapId}`);
  const frame = document.createElement('canvas'); frame.width = file.width; frame.height = file.height;
  frame.getContext('2d')!.drawImage(image, 0, 0);
  return frame;
}
