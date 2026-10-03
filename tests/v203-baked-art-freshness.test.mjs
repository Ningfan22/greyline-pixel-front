import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {checkBakedBattleArt} from '../scripts/check-baked-battle-art.mjs';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const root = fileURLToPath(new URL('..', import.meta.url));

test('the committed bake matches its compiler, authoring inputs and generated outputs', () => {
  const provenance = JSON.parse(readFileSync(join(root, 'public/art/v203-battle/provenance.json'), 'utf8'));
  assert.deepEqual(checkBakedBattleArt(root, provenance), []);
  assert(provenance.compilerSources.length >= 30);
  assert(provenance.originalSources.length > 20);
});

test('changed geometry, source art, output atlas or metadata stop the build check', () => {
  const dir = mkdtempSync(join(tmpdir(), 'greyline-bake-freshness-'));
  const contents = {'game/layout.ts': 'mount=10', 'public/art/source.png': 'source pixels',
    'public/art/authoring.png': 'authoring pixels', 'public/art/final.png': 'final pixels',
    'public/art/map.webp': 'map pixels', 'game/data.ts': 'manifest'};
  try {
    for (const [path, content] of Object.entries(contents)) {mkdirSync(dirname(join(dir, path)), {recursive: true}); writeFileSync(join(dir, path), content);}
    const provenance = {compilerSources: [{path: 'game/layout.ts', sha256: hash(contents['game/layout.ts'])}],
      sourceFiles: [{path: '/art/source.png', sha256: hash(contents['public/art/source.png'])}],
      originalSources: [{path: '/art/authoring.png', sha256: hash(contents['public/art/authoring.png'])}],
      atlasFiles: [{path: '/art/final.png', sha256: hash(contents['public/art/final.png'])}],
      backgrounds: {greyline: {path: '/art/map.webp', sha256: hash(contents['public/art/map.webp'])}},
      dataFile: {path: 'game/data.ts', sha256: hash(contents['game/data.ts'])}};
    const check = () => checkBakedBattleArt(dir, provenance, ['game/layout.ts']);
    assert.deepEqual(check(), []);
    for (const [path, content] of Object.entries(contents)) {
      writeFileSync(join(dir, path), content + ' changed');
      assert.deepEqual(check(), [`已变化: ${path}`]);
      writeFileSync(join(dir, path), content);
    }
    rmSync(join(dir, 'public/art/final.png'));
    assert.deepEqual(check(), ['缺少文件: public/art/final.png']);
  } finally {rmSync(dir, {recursive: true, force: true});}
});
