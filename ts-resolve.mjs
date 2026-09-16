// Resolve hook: extensionless relative imports -> .ts files.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export async function resolve(specifier, context, nextResolve) {
  if (
    (specifier.startsWith('./') || specifier.startsWith('../')) &&
    !/\.[a-zA-Z0-9]+$/.test(specifier)
  ) {
    const candidate = new URL(specifier + '.ts', context.parentURL).href;
    if (existsSync(fileURLToPath(candidate))) {
      return nextResolve(candidate, context);
    }
  }
  return nextResolve(specifier, context);
}
