import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

if (!process.env.MUTATION_BOUNDARY_TEST_DATABASE_URL) {
  throw new Error('Disposable PostgreSQL URL required for external consumer test');
}
const root = resolve(import.meta.dirname, '..');
const temp = mkdtempSync(join(tmpdir(), 'mb-postgres-consumer-'));
let archive;
try {
  const [{ filename }] = JSON.parse(execFileSync('npm', ['pack', '--json', '--ignore-scripts'], {
    cwd: root, encoding: 'utf8',
  }));
  archive = resolve(root, filename);
  writeFileSync(join(temp, 'package.json'), '{"private":true,"type":"module"}\n');
  execFileSync('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund',
    '--save-exact', archive, 'pg@8.16.3'], { cwd: temp, stdio: 'pipe' });
  writeFileSync(join(temp, 'verify.mjs'), `
import assert from 'node:assert/strict';
import pg from 'pg';
import { assertNoMutation, MutationBoundaryError, assertDisposableDatabase } from 'mutation-boundary';

const url = process.env.MUTATION_BOUNDARY_TEST_DATABASE_URL;
const safety = {
  expectedDatabase: 'mutation_boundary_test',
  expectedUser: 'mutation_boundary_ci',
  confirmDisposableTestDatabase: true,
};
const table = 'boundary_external_consumer_probe';
const selection = [{ name: table, key: 'id' }];
const pool = new pg.Pool({ connectionString: url, max: 2, connectionTimeoutMillis: 1000 });
let fixtureCreated = false;
try {
  // Safety identity and DDL must execute on the same pinned connection.
  // Never adopt a pre-existing table on a failed CREATE.
  const fixtureClient = await pool.connect();
  try {
    await assertDisposableDatabase(fixtureClient, safety);
    await fixtureClient.query('CREATE TABLE ' + table + ' (id integer PRIMARY KEY, state text NOT NULL)');
    fixtureCreated = true;
  } finally {
    fixtureClient.release();
  }
  const failure = new Error('simulated failed operation');
  await assert.rejects(assertNoMutation({
    db: pool, tables: selection, safety,
    action: async () => {
      await pool.query("INSERT INTO " + table + " VALUES (1, 'private-payload')");
      throw failure;
    },
  }), error => {
    assert.ok(error instanceof MutationBoundaryError);
    assert.deepEqual(error.toJSON().counts, [
      { table, inserted: 1, updated: 0, deleted: 0 },
    ]);
    assert.doesNotMatch(error.message + JSON.stringify(error), /private-payload/);
    return true;
  });
  assert.equal(pool.idleCount, pool.totalCount, 'snapshot connection is released');
  await assertNoMutation({
    db: pool, tables: selection, safety,
    action: async () => {
      const writer = await pool.connect();
      let transactionStarted = false;
      let discardWriter;
      try {
        await writer.query('BEGIN');
        transactionStarted = true;
        await writer.query("UPDATE " + table + " SET state = 'rolled-back' WHERE id = 1");
        await writer.query('ROLLBACK');
        transactionStarted = false;
      } finally {
        if (transactionStarted) {
          try { await writer.query('ROLLBACK'); }
          catch (error) {
            discardWriter = error instanceof Error ? error : new Error('Writer rollback failed');
          }
        }
        // Never recycle a client after failed rollback.
        if (discardWriter) writer.release(discardWriter);
        else writer.release();
      }
    },
  });
  assert.equal(pool.idleCount, pool.totalCount);
  console.log('External npm tarball + real disposable PostgreSQL consumer passed');
} finally {
  try {
    if (fixtureCreated) await pool.query('DROP TABLE IF EXISTS ' + table);
  } finally {
    await pool.end();
  }
}
`);
  execFileSync('node', [join(temp, 'verify.mjs')], {
    cwd: temp, env: process.env, stdio: 'inherit',
  });
} finally {
  if (archive) rmSync(archive, { force: true });
  rmSync(temp, { recursive: true, force: true });
}
