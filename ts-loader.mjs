// Temporary ESM loader so Node can run the game's .ts test suite directly.
// The engine uses extensionless relative imports (./infantry-geometry); this
// resolves them to their .ts files and lets --experimental-strip-types handle
// the rest. Not part of the shipped game.
import { register } from 'node:module';

register('./ts-resolve.mjs', import.meta.url);
