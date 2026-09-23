/// <reference types="vite/client" />

/**
 * CDN base URL for art assets. When set, `/art/...` paths are rewritten to
 * load from this URL with `.webp` extension instead of `.png`.
 *
 * Set before the game starts:
 *   (globalThis as any).__ART_CDN_BASE__ = 'https://cdn.example.com/pf/';
 */
declare global {
  // eslint-disable-next-line no-var
  var __ART_CDN_BASE__: string | undefined;
  // eslint-disable-next-line no-var
  var __AUDIO_CDN_BASE__: string | undefined;
}

function artCdnBase(): string {
  return (globalThis as { __ART_CDN_BASE__?: string }).__ART_CDN_BASE__ ?? '';
}

function audioCdnBase(): string {
  return (globalThis as { __AUDIO_CDN_BASE__?: string }).__AUDIO_CDN_BASE__ ?? '';
}

/** Large audio files hosted on CDN to keep the mini-game main package small. */
const CDN_AUDIO = new Set(['searching.mp3']);

/**
 * Resolve an asset path.
 *
 * - `/art/...` paths: when a CDN base is configured, load `.webp` from the
 *   CDN (the CDN package contains WebP-converted atlases). Otherwise load
 *   locally (web dev / GitHub Pages).
 * - `/audio/...` paths: large files (BGM) load from CDN when configured;
 *   short sound effects stay local for low latency.
 * - Everything else: always local (bundled in the package).
 */
export function assetUrl(path: string) {
  // Canvas screens also pass `art/...`; route both forms through the CDN.
  if (!path.startsWith('/')) path = `/${path}`;
  if (path.startsWith('/art/')) {
    const cdn = artCdnBase();
    if (cdn) {
      const webp = path.replace(/\.png$/i, '.webp');
      return `${cdn}${webp.replace(/^\//, '')}`;
    }
  }
  if (path.startsWith('/audio/')) {
    const file = path.slice('/audio/'.length);
    if (CDN_AUDIO.has(file)) {
      const cdn = audioCdnBase();
      if (cdn) {
        return `${cdn}audio/${file}`;
      }
    }
  }
  return `${import.meta.env?.BASE_URL ?? '/'}${path.replace(/^\//, '')}`;
}
