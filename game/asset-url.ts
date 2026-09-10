/// <reference types="vite/client" />

/** Keep art under the game's own directory, including GitHub project Pages. */
export function assetUrl(path: string) {
  return `${import.meta.env?.BASE_URL ?? '/'}${path.replace(/^\//, '')}`;
}
