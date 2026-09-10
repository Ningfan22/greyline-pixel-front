import { cpSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../dist-pages/', import.meta.url));
const destination = fileURLToPath(new URL('../docs/', import.meta.url));
if (!existsSync(`${source}/index.html`)) {
  throw new Error('Run pnpm build:pages before preparing GitHub Pages.');
}
rmSync(destination, { recursive: true, force: true });
cpSync(source, destination, { recursive: true });
writeFileSync(`${destination}/.nojekyll`, '');
console.log('Static game copied to docs/ for GitHub Pages.');
