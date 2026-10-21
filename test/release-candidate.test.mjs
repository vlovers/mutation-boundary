import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const json = name => JSON.parse(readFileSync(resolve(root, name), 'utf8'));
const text = name => readFileSync(resolve(root, name), 'utf8');

test('candidate package and lockfile root versions are identical', () => {
  const pkg = json('package.json');
  const lock = json('package-lock.json');
  assert.equal(pkg.version, lock.version);
  assert.equal(pkg.version, lock.packages[''].version);
  assert.equal(pkg.name, lock.name);
  assert.equal(pkg.name, lock.packages[''].name);
  assert.equal(pkg.version, '0.6.0');
});

test('published release documentation matches v0.6 tag and install instructions', () => {
  const pkg = json('package.json');
  assert.match(text('CHANGELOG.md'), /0\.6\.0 — reliability hardening \(published/);
  assert.match(text('README.md'), /Published package: v0\.6\.0/);
  assert.match(text('docs/V060_RELEASE_REVIEW.md'), /Tag `v0\.6\.0` points to `6dad293/);
  assert.equal(pkg.private, undefined);
});

test('npm publisher rejects version-tag mismatch before publishing', () => {
  const workflow = text('.github/workflows/publish.yml');
  assert.match(workflow, /tag !== 'v' \+ pkg\.version/);
  assert.match(workflow, /node scripts\/verify-package\.mjs/);
  assert.match(workflow, /npm publish --access public/);
});
