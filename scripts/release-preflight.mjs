import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SHA = /^[a-f0-9]{40}$/i;
const RELEASE_TAG = /^v\d+\.\d+\.\d+$/;

export function verifyReleaseMetadata(tag, pkg, lock) {
  assert.equal(typeof tag, 'string', 'release tag is required');
  assert.match(tag, RELEASE_TAG, 'release tag must be vMAJOR.MINOR.PATCH');
  assert.equal(pkg.name, 'mutation-boundary', 'unexpected npm package name');
  assert.notEqual(pkg.private, true, 'private package must not be published');
  assert.equal(tag, 'v' + pkg.version, 'tag must match package.json version');
  assert.equal(lock.name, pkg.name, 'lockfile package name mismatch');
  assert.equal(lock.version, pkg.version, 'lockfile version mismatch');
  assert.equal(lock.packages?.['']?.name, pkg.name, 'lockfile root name mismatch');
  assert.equal(lock.packages?.['']?.version, pkg.version, 'lockfile root version mismatch');
}

export function verifyTagCheckout({ tag, eventName, githubRef, head, tagCommit, tagObject, remoteTagObject, onMain }) {
  assert.match(tag, RELEASE_TAG, 'invalid release tag');
  assert.ok(eventName === 'push' || eventName === 'workflow_dispatch', 'unsupported publishing event');
  if (eventName === 'push') {
    assert.equal(githubRef, 'refs/tags/' + tag, 'push must originate from the release tag');
  }
  for (const [label, value] of Object.entries({ head, tagCommit, tagObject, remoteTagObject })) {
    assert.match(value || '', SHA, label + ' must be a full Git SHA');
  }
  assert.equal(head, tagCommit, 'checked out commit differs from release tag');
  assert.equal(tagObject, remoteTagObject, 'release tag differs from origin');
  assert.equal(onMain, true, 'release commit must be reachable from origin/main');
}

export function verifyUnpublishedVersion(versions, version) {
  assert.ok(Array.isArray(versions), 'npm registry must return an array of versions');
  assert.ok(versions.every(value => typeof value === 'string'), 'malformed npm registry version list');
  assert.ok(!versions.includes(version), 'version already published; never republish');
}

const command = (program, args) => execFileSync(program, args, {
  cwd: ROOT,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
}).trim();

function runPreflight() {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  const lock = JSON.parse(readFileSync(join(ROOT, 'package-lock.json'), 'utf8'));
  const tag = process.env.RELEASE_TAG;
  verifyReleaseMetadata(tag, pkg, lock);

  const head = command('git', ['rev-parse', 'HEAD']);
  const tagObject = command('git', ['rev-parse', 'refs/tags/' + tag]);
  const tagCommit = command('git', ['rev-parse', 'refs/tags/' + tag + '^{commit}']);
  const remoteTag = command('git', ['ls-remote', '--exit-code', 'origin', 'refs/tags/' + tag]);
  const remoteTagObject = remoteTag.split('\n')
    .map(line => line.split('\t'))
    .find(parts => parts[1] === 'refs/tags/' + tag)?.[0];
  command('git', ['fetch', '--no-tags', 'origin', 'main']);
  const ancestry = spawnSync('git', ['merge-base', '--is-ancestor', head, 'FETCH_HEAD'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  if (ancestry.error) throw ancestry.error;
  verifyTagCheckout({
    tag,
    eventName: process.env.GITHUB_EVENT_NAME,
    githubRef: process.env.GITHUB_REF,
    head,
    tagCommit,
    tagObject,
    remoteTagObject,
    onMain: ancestry.status === 0,
  });

  const cache = join(process.env.RUNNER_TEMP || tmpdir(), 'mutation-boundary-release-preflight-cache');
  const versions = JSON.parse(command('npm', [
    'view', 'mutation-boundary', 'versions', '--json',
    '--registry=https://registry.npmjs.org/', '--prefer-online', '--cache=' + cache,
  ]));
  verifyUnpublishedVersion(versions, pkg.version);
  console.log('Release preflight passed for ' + tag + ': trusted main ancestry, immutable tag reference, unpublished version');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runPreflight();
}
