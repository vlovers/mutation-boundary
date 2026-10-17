import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const workspace = mkdtempSync(join(tmpdir(), 'mutation-boundary-consumer-'));
try {
  const packOutput = execFileSync('npm', ['pack', '--json', '--ignore-scripts'], {
    cwd: root,
    encoding: 'utf8',
  });
  const [{ filename }] = JSON.parse(packOutput);
  const tarball = resolve(root, filename);
  try {
    writeFileSync(join(workspace, 'package.json'), '{"type":"module","private":true}\n');
    execFileSync('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', tarball], {
      cwd: workspace,
      stdio: 'pipe',
    });
    const consumer = join(workspace, 'consumer.mjs');
    writeFileSync(consumer, [
      "import assert from 'node:assert/strict';",
      "import { assertNoMutation, MutationBoundaryError } from 'mutation-boundary';",
      "assert.equal(typeof assertNoMutation, 'function');",
      "assert.equal(typeof MutationBoundaryError, 'function');",
    ].join('\n'));
    execFileSync('node', [consumer], { cwd: workspace, stdio: 'inherit' });
    const declarations = readFileSync(join(workspace, 'node_modules', 'mutation-boundary', 'dist', 'index.d.ts'), 'utf8');
    assert.match(declarations, /assertNoMutation/);
    const packageJson = JSON.parse(readFileSync(join(workspace, 'node_modules', 'mutation-boundary', 'package.json'), 'utf8'));
    assert.equal(packageJson.main, './dist/index.js');
    assert.equal(packageJson.types, './dist/index.d.ts');
    const tarballListing = execFileSync('tar', ['-tzf', tarball], { encoding: 'utf8' });
    assert.ok(tarballListing.includes('package/dist/index.js'));
    assert.ok(tarballListing.includes('package/dist/index.d.ts'));
    assert.ok(!tarballListing.includes('package/src/'));
    const cjsConsumer = join(workspace, 'consumer.cjs');
    writeFileSync(cjsConsumer, "const assert = require('node:assert/strict'); const pkg = require('mutation-boundary'); assert.equal(typeof pkg.assertNoMutation, 'function');");
    execFileSync('node', [cjsConsumer], { cwd: workspace, stdio: 'inherit' });
    const typeConsumer = join(workspace, 'consumer.ts');
    writeFileSync(typeConsumer, [
      "import { assertNoMutation, MutationBoundaryError, type AssertNoMutationOptions } from 'mutation-boundary';",
      "const check: typeof assertNoMutation = assertNoMutation;",
      "const options: AssertNoMutationOptions | undefined = undefined;",
      "void check; void options; void MutationBoundaryError;",
    ].join('\n'));
    writeFileSync(join(workspace, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        strict: true,
        noEmit: true,
        skipLibCheck: true,
      },
      files: ['consumer.ts'],
    }));
    execFileSync(resolve(root, 'node_modules', '.bin', 'tsc'), ['-p', 'tsconfig.json'], {
      cwd: workspace,
      stdio: 'inherit',
    });
    assert.ok(!tarballListing.includes('package/test/'));
    assert.ok(!tarballListing.includes('package/.github/'));
    assert.ok(!tarballListing.includes('package/scripts/'));
    assert.ok(!tarballListing.includes('package/.env'));
    assert.doesNotMatch(declarations, /export declare (function|const) (observeFailureBoundary|takeBoundarySnapshot|diffBoundarySnapshots)/);
    console.log('External tarball ESM/CommonJS/TypeScript consumer smoke and package contents passed');
  } finally {
    rmSync(tarball, { force: true });
  }
} finally {
  rmSync(workspace, { recursive: true, force: true });
}
