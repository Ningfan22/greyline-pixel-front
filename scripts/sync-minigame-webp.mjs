// Preserve converted PNG atlases; add/update the already-WebP public assets
// (card faces, frames and pack art were omitted from the original CDN bundle).
import { readdir, mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
let count = 0;
async function sync(relative = '') {
  const source = path.join(root, 'public/art', relative);
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) await sync(child);
    else if (entry.isFile() && child.endsWith('.webp')) {
      const target = path.join(root, 'minigame-cdn/art', child);
      await mkdir(path.dirname(target), { recursive: true });
      await copyFile(path.join(source, entry.name), target);
      count++;
    }
  }
}
await sync();
console.log(`Synced ${count} WebP art assets to minigame-cdn/art`);
