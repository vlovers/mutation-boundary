import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const json = name => JSON.parse(readFileSync(resolve(root, name), 'utf8'));
const text = name => readFileSync(resolve(root, name), 'utf8');
const STABLE_SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

// The README reports the *latest published* package; while preparing a new
// release it can legitimately lag behind the candidate package.json version.
// Unlike the historic v0.6.0 review, this pointer must advance after publish.
function verifyPublishedReadme(readme, changelog, candidateVersion) {
  const versions = [...readme.matchAll(/^> \*\*Published package: v((?:0|[1-9]\\d*)\\.(?:0|[1-9]\\d*)\\.(?:0|[1-9]\\d*))\*\*/gm)];
  assert.equal(versions.length, 1, 'README must have exactly one published-package announcement');
  const publishedVersion = versions[0][1];
  assert.ok(STABLE_SEMVER.test(publishedVersion));
  const publishedParts = publishedVersion.split('.').map(Number);
  const candidateParts = candidateVersion.split('.').map(Number);
  assert.ok([...publishedParts, ...candidateParts].every(Number.isSafeInteger), 'release components must be safe integers');
  const publishedIsNewer = publishedParts.some((part, i) =>
    part > candidateParts[i] && publishedParts.slice(0, i).every((earlier, j) => earlier === candidateParts[j])
  );
  assert.equal(publishedIsNewer, false, 'README cannot advertise a version newer than the source candidate');
  assert.ok(readme.includes(`https://www.npmjs.com/package/mutation-boundary/v/${publishedVersion}`),
    'README npm package link must match advertised version');
  assert.ok(readme.includes(`https://github.com/vlovers/mutation-boundary/tree/v${publishedVersion}`),
    'README release tag link must match advertised version');
  assert.ok(changelog.includes(`## ${publishedVersion} —`),
    'published package version needs a matching changelog section');
}

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
  verifyPublishedReadme(text('README.md'), text('CHANGELOG.md'), pkg.version);
  assert.match(text('docs/V060_RELEASE_REVIEW.md'), /Tag `v0\.6\.0` points to `6dad293/);
  assert.equal(pkg.private, undefined);
});

test('published README pointer accepts a future release without removing v0.6.0 history', () => {
  const existing = `## 0.6.0 — historical published release
## 0.7.0 — newer published release
`;
  const readme = version => `> **Published package: v${version}** [npm](https://www.npmjs.com/package/mutation-boundary/v/${version}) [tag](https://github.com/vlovers/mutation-boundary/tree/v${version})`;
  assert.doesNotThrow(() => verifyPublishedReadme(readme('0.6.0'), existing, '0.7.0'),
    'published v0.6.0 must remain valid while v0.7.0 is a candidate');
  assert.doesNotThrow(() => verifyPublishedReadme(readme('0.7.0'), existing, '0.7.0'),
    'README can advance after v0.7.0 is actually published');
  assert.throws(() => verifyPublishedReadme(readme('0.8.0'), existing, '0.7.0'), /newer than/);
  assert.throws(() => verifyPublishedReadme(readme('0.7.0'), '## 0.6.0 — historical', '0.7.0'),
    /changelog section/);
  assert.throws(() => verifyPublishedReadme(readme('0.7.0').replace('/tree/v0.7.0', '/tree/v0.6.0'),
    existing, '0.7.0'), /release tag link/);
  assert.throws(() => verifyPublishedReadme(readme('0.7.0') + '\\n' + readme('0.6.0'),
    existing, '0.7.0'), /exactly one/);
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
