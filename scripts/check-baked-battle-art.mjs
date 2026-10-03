import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {BATTLE_ART_COMPILER_INPUTS} from './battle-art-bake-inputs.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export function checkBakedBattleArt(root, provenance, expectedCompilerPaths = BATTLE_ART_COMPILER_INPUTS) {
  const errors = [];
  const verify = (path, expected) => {
    try {
      if (!expected || sha(readFileSync(resolve(root, path))) !== expected) errors.push(`已变化: ${path}`);
    } catch {errors.push(`缺少文件: ${path}`);}
  };
  const compiler = new Map((provenance.compilerSources ?? []).map(entry => [entry.path, entry.sha256]));
  for (const path of expectedCompilerPaths) verify(path, compiler.get(path));
  if (!provenance.sourceFiles?.length) errors.push('缺少输入图片记录');
  for (const entry of provenance.sourceFiles ?? []) verify('public' + entry.path, entry.sha256);
  // Original PNGs behind compact source WebPs are checked too: changing the
  // authoring image must not silently leave its old derivative in a new bake.
  for (const entry of provenance.originalSources ?? []) verify('public' + entry.path, entry.sha256);
  for (const entry of provenance.atlasFiles ?? []) verify('public' + entry.path, entry.sha256);
  for (const entry of Object.values(provenance.backgrounds ?? {})) verify('public' + entry.path, entry.sha256);
  if (!provenance.dataFile) errors.push('缺少精灵元数据记录');
  else verify(provenance.dataFile.path, provenance.dataFile.sha256);
  return errors;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  let errors;
  try {errors = checkBakedBattleArt(root, JSON.parse(readFileSync(resolve(root, 'public/art/v203-battle/provenance.json'), 'utf8')));}
  catch (error) {errors = [String(error)];}
  if (errors.length) {
    console.error('战场图集已过期，停止构建。请先重新烘焙素材：\n' +
      'node --no-warnings --experimental-strip-types --loader ./scripts/ts-loader.mjs scripts/bake-battle-art.mjs\n' + errors.join('\n'));
    process.exitCode = 1;
  } else console.log('战场图集输入、输出和元数据校验通过。');
}
