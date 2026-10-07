import {assetUrl} from './asset-url';
import {BATTLE_LOSSLESS_ART} from './battle-art-assets';

/** Web battles opt in; legacy/CDN callers keep their original resource paths. */
export function battleArtPath(source: string) {
  return globalThis.__ART_CDN_BASE__ ? source : BATTLE_LOSSLESS_ART[source] ?? source;
}

function imageAt(path: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.fetchPriority = 'low';
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`无法加载 ${path}`));
    image.src = assetUrl(path);
  });
}

export function loadArtImage(source: string, compact = false): Promise<HTMLImageElement> {
  const preferred = compact ? battleArtPath(source) : source;
  return preferred === source ? imageAt(source) : imageAt(preferred).catch(() => imageAt(source));
}
