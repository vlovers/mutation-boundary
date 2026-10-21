import assert from 'node:assert/strict';
import { test } from 'node:test';
import { verifyPackageContents } from '../scripts/verify-package.mjs';

const manifest = {
  name: 'mutation-boundary', version: '0.6.0', type: 'module',
  main: './dist/index.js', types: './dist/index.d.ts',
  exports: { '.': { types: './dist/index.d.ts', default: './dist/index.js' } },
  engines: { node: '>=24' }, publishConfig: { access: 'public' },
};
const files = ['package.json','README.md','LICENSE','dist/index.js','dist/index.d.ts']
  .map(path => ({ path, size: 1 }));

test('valid minimal package passes', () => {
  assert.deepEqual(verifyPackageContents(manifest, files), { count: 5, totalBytes: 5 });
});
test('rejects source, tests and extra packed internals', () => {
  for (const path of ['src/index.ts', 'test/core.test.ts', '.env', 'scripts/publish.mjs', 'dist/secret.json']) {
    assert.throws(() => verifyPackageContents(manifest, [...files, { path, size: 1 }]), /unexpected packed file/);
  }
});
test('rejects duplicate or missing packed files', () => {
  assert.throws(() => verifyPackageContents(manifest, [...files, files[0]]), /duplicate packed path/);
  assert.throws(() => verifyPackageContents(manifest, files.slice(1)), /missing packed file/);
});
test('rejects manifest exports, version and unexpected runtime dependencies', () => {
  assert.throws(() => verifyPackageContents({ ...manifest, version: '0.6.0-rc.1' }, files));
  assert.throws(() => verifyPackageContents({ ...manifest, dependencies: { lodash: '*' } }, files), /runtime must remain dependency-free/);
  assert.throws(() => verifyPackageContents({ ...manifest, exports: { '.': { default: './src/index.ts' } } }, files));
});
