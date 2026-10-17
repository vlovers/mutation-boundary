import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const spec = process.argv[2];
if (!spec || !/^mutation-boundary@\d+\.\d+\.\d+$/.test(spec)) {
  throw new Error('Usage: npm run test:registry -- mutation-boundary@0.1.0');
}
const version = spec.slice('mutation-boundary@'.length);
const workspace = mkdtempSync(join(tmpdir(), 'mutation-boundary-registry-'));
try {
  writeFileSync(join(workspace, 'package.json'), '{"private":true,"type":"module"}\n');
  // Explicit registry version; no npm lifecycle scripts or source checkout.
  execFileSync('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--save-exact', spec], {
    cwd: workspace, stdio: 'pipe',
  });
  const dir = join(workspace, 'node_modules', 'mutation-boundary');
  const installed = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  assert.equal(installed.name, 'mutation-boundary');
  assert.equal(installed.version, version);
  assert.equal(installed.type, 'module');
  assert.equal(installed.exports?.['.']?.types, './dist/index.d.ts');
  assert.equal(installed.exports?.['.']?.default, './dist/index.js');
  const declarations = readFileSync(join(dir, 'dist', 'index.d.ts'), 'utf8');
  assert.match(declarations, /assertNoMutation/);
  writeFileSync(join(workspace, 'smoke.mjs'),
    "import assert from 'node:assert/strict';\n" +
    "import { assertNoMutation, MutationBoundaryError } from 'mutation-boundary';\n" +
    "assert.equal(typeof assertNoMutation, 'function');\n" +
    "assert.equal(typeof MutationBoundaryError, 'function');\n");
  execFileSync('node', ['smoke.mjs'], { cwd: workspace, stdio: 'inherit' });
  console.log('Verified npm registry installation: ' + spec);
  console.log('Note: this is a registry consumer smoke, not a byte-for-byte provenance check.');
} finally {
  rmSync(workspace, { recursive: true, force: true });
}
