// Minimal ESM loader: resolve extensionless relative imports to local .ts files
// so the engine test suite can run under Node's type-stripping.
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

export async function resolve(specifier, context, nextResolve) {
  if (
    (specifier.startsWith('./') || specifier.startsWith('../')) &&
    !/\.[cm]?[jt]s$/.test(specifier)
  ) {
    const base = new URL(specifier, context.parentURL);
    const path = fileURLToPath(base);
    for (const ext of ['.ts', '.tsx', '.js', '.mjs']) {
      if (existsSync(path + ext)) {
        return nextResolve(pathToFileURL(path + ext).href, context);
      }
    }
  }
  return nextResolve(specifier, context);
}
