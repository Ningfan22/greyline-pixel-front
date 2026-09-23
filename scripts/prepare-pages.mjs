import { cpSync, existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../dist-pages/', import.meta.url));
const destination = fileURLToPath(new URL('../docs/', import.meta.url));
if (!existsSync(`${source}/index.html`)) {
  throw new Error('Run pnpm build:pages before preparing GitHub Pages.');
}
// docs/copyright contains maintained application materials, not build output.
// Overlay the generated site without deleting those documents. Retain older
// hashed bundles too, so clients with a cached index can still finish loading.
cpSync(source, destination, { recursive: true });
writeFileSync(`${destination}/.nojekyll`, '');
console.log('Static game copied to docs/ for GitHub Pages.');
