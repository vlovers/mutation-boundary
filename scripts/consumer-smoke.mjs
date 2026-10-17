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
    console.log('External tarball consumer smoke passed');
  } finally {
    rmSync(tarball, { force: true });
  }
} finally {
  rmSync(workspace, { recursive: true, force: true });
}
