import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

export function verifyPackageContents(manifest, entries) {
  assert.equal(manifest.name, 'mutation-boundary');
  assert.match(manifest.version, /^\\d+\\.\\d+\\.\\d+$/);
  assert.equal(manifest.private, undefined);
  assert.equal(manifest.type, 'module');
  assert.equal(manifest.main, './dist/index.js');
  assert.equal(manifest.types, './dist/index.d.ts');
  assert.equal(manifest.exports?.['.']?.types, manifest.types);
  assert.equal(manifest.exports?.['.']?.default, manifest.main);
  assert.equal(manifest.engines?.node, '>=24');
  assert.equal(manifest.publishConfig?.access, 'public');
  assert.equal(manifest.dependencies, undefined, 'runtime must remain dependency-free');

  const files = entries.map(entry => entry.path);
  assert.equal(new Set(files).size, files.length, 'duplicate packed path');
  for (const path of files) {
    assert.ok(
      ['package.json', 'README.md', 'LICENSE'].includes(path) ||
      /^dist\\/[a-z0-9-]+\\.(?:js|d\\.ts)$/.test(path),
      'unexpected packed file: ' + path,
    );
  }
  for (const mandatory of ['package.json', 'README.md', 'LICENSE', 'dist/index.js', 'dist/index.d.ts']) {
    assert.ok(files.includes(mandatory), 'missing packed file: ' + mandatory);
  }
  assert.ok(entries.every(entry => Number.isSafeInteger(entry.size) && entry.size >= 0), 'invalid packed file size');
  return { count: files.length, totalBytes: entries.reduce((sum, entry) => sum + entry.size, 0) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  const output = execFileSync('npm', ['pack', '--json', '--dry-run', '--ignore-scripts'], {
    cwd: root, encoding: 'utf8',
  });
  const packages = JSON.parse(output);
  assert.equal(packages.length, 1);
  assert.equal(packages[0].name, manifest.name);
  assert.equal(packages[0].version, manifest.version);
  const report = verifyPackageContents(manifest, packages[0].files);
  console.log('Verified release package contents:', report);
}
