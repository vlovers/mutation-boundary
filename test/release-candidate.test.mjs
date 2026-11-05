import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const json = name => JSON.parse(readFileSync(resolve(root, name), 'utf8'));
const text = name => readFileSync(resolve(root, name), 'utf8');
const STABLE_SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

test('candidate package and lockfile root versions are identical', () => {
  const pkg = json('package.json');
  const lock = json('package-lock.json');
  assert.equal(pkg.version, lock.version);
  assert.equal(pkg.version, lock.packages[''].version);
  assert.equal(pkg.name, lock.name);
  assert.equal(pkg.name, lock.packages[''].name);
  assert.match(pkg.version, STABLE_SEMVER, 'candidate version must be a stable semver release');
  for (const invalid of ['01.2.3', '1.02.3', '1.2.03', '1.2', '1.2.3-rc.1', '1.2.3+build.1']) {
    assert.doesNotMatch(invalid, STABLE_SEMVER, `invalid stable version: ${invalid}`);
  }
  assert.match(text('CHANGELOG.md'), new RegExp(`^## (?:v)?${pkg.version.replaceAll('.', '\\.')}(?:\\s|\\u2014|\\u2013)`, 'm'), 'candidate version must have a changelog section');
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
  assert.match(workflow, /node scripts\/release-preflight\.mjs/);
  assert.match(text('scripts/release-preflight.mjs'), /tag, 'v' \+ pkg\.version/);
  assert.match(workflow, /node scripts\/verify-package\.mjs/);
  const releaseCandidateGate = workflow.indexOf('npm run test:release-candidate');
  const publishStep = workflow.indexOf('npm publish --access public');
  assert.ok(releaseCandidateGate > workflow.indexOf('npm ci --ignore-scripts'), 'release candidate test must run after dependency install');
  assert.ok(publishStep > releaseCandidateGate, 'release candidate test must run before npm publish');
  assert.match(workflow, /npm publish --access public/);
});
