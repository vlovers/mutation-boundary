import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { verifyReleaseMetadata, verifyTagCheckout, verifyUnpublishedVersion } from '../scripts/release-preflight.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = path => readFileSync(new URL(path, 'file://' + root), 'utf8');
const pkg = { name: 'mutation-boundary', version: '0.7.0' };
const lock = { name: 'mutation-boundary', version: '0.7.0', packages: { '': { name: 'mutation-boundary', version: '0.7.0' } } };
const sha = 'a'.repeat(40);
const validCheckout = {
  tag: 'v0.7.0',
  eventName: 'push',
  githubRef: 'refs/tags/v0.7.0',
  head: sha,
  tagCommit: sha,
  tagObject: sha,
  remoteTagObject: sha,
  onMain: true,
};

test('accepts exact package/tag/lockfile agreement', () => {
  assert.doesNotThrow(() => verifyReleaseMetadata('v0.7.0', pkg, lock));
});
test('rejects malformed, prerelease, and mismatched tags', () => {
  for (const tag of ['v0.7', 'v0.7.0-rc.1', 'v0.7.1', 'v0.7.0;echo bad']) {
    assert.throws(() => verifyReleaseMetadata(tag, pkg, lock));
  }
});
test('rejects private or differently named packages', () => {
  assert.throws(() => verifyReleaseMetadata('v0.7.0', { ...pkg, private: true }, lock));
  assert.throws(() => verifyReleaseMetadata('v0.7.0', { ...pkg, name: 'other' }, lock));
});
test('rejects inconsistent lockfile metadata', () => {
  assert.throws(() => verifyReleaseMetadata('v0.7.0', pkg, { ...lock, version: '0.6.0' }));
  assert.throws(() => verifyReleaseMetadata('v0.7.0', pkg, { ...lock, packages: { '': { name: pkg.name, version: '0.6.0' } } }));
  assert.throws(() => verifyReleaseMetadata('v0.7.0', pkg, { ...lock, packages: {} }));
});
test('accepts a verified push tag from main', () => {
  assert.doesNotThrow(() => verifyTagCheckout(validCheckout));
});
test('accepts an explicit workflow_dispatch retry of a verified tag', () => {
  assert.doesNotThrow(() => verifyTagCheckout({ ...validCheckout, eventName: 'workflow_dispatch', githubRef: 'refs/heads/main' }));
});
test('rejects unrelated or unsupported publishing events', () => {
  assert.throws(() => verifyTagCheckout({ ...validCheckout, eventName: 'pull_request' }));
  assert.throws(() => verifyTagCheckout({ ...validCheckout, githubRef: 'refs/heads/main' }));
});
test('rejects checked-out commits other than the tag commit', () => {
  assert.throws(() => verifyTagCheckout({ ...validCheckout, head: 'b'.repeat(40) }));
});
test('rejects moved or unexpected remote tags', () => {
  assert.throws(() => verifyTagCheckout({ ...validCheckout, remoteTagObject: 'b'.repeat(40) }));
  assert.throws(() => verifyTagCheckout({ ...validCheckout, remoteTagObject: undefined }));
});
test('rejects tags whose commits are not ancestors of main', () => {
  assert.throws(() => verifyTagCheckout({ ...validCheckout, onMain: false }));
});
test('rejects malformed Git object identifiers', () => {
  assert.throws(() => verifyTagCheckout({ ...validCheckout, tagCommit: 'not-a-sha' }));
});
test('accepts a version absent from npm registry', () => {
  assert.doesNotThrow(() => verifyUnpublishedVersion(['0.5.0', '0.6.0'], '0.7.0'));
});
test('rejects republishing any existing version', () => {
  assert.throws(() => verifyUnpublishedVersion(['0.6.0', '0.7.0'], '0.7.0'));
});
test('fails closed on malformed registry data', () => {
  for (const versions of [null, '0.6.0', { versions: [] }, [1], [null]]) {
    assert.throws(() => verifyUnpublishedVersion(versions, '0.7.0'));
  }
});
test('release workflow runs the gate before installing packages or publishing', () => {
  const workflow = read('.github/workflows/publish.yml');
  const gate = workflow.indexOf('node scripts/release-preflight.mjs');
  assert.ok(gate > 0);
  assert.ok(gate < workflow.indexOf('npm install --global npm@'));
  assert.ok(gate < workflow.indexOf('npm ci --ignore-scripts'));
  assert.ok(gate < workflow.indexOf('npm publish --access public'));
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /fetch-depth: 0/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /id-token: write/);
  assert.doesNotMatch(workflow, /pull_request_target:/);
});
