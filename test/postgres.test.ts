import assert from 'node:assert/strict';
import { test } from 'node:test';
import pg from 'pg';
import { assertNoMutation, MutationBoundaryError, assertDisposableDatabase } from '../src/index.ts';

test('PostgreSQL INSERT UPDATE DELETE JSONB and timestamps', async () => {
  const url = process.env.MUTATION_BOUNDARY_TEST_DATABASE_URL;
  if (!url) throw new Error('Isolated test database URL required');
  const db = new pg.Client({ connectionString: url });
  await db.connect();
  const safety = {
    expectedDatabase: 'mutation_boundary_test',
    expectedUser: 'mutation_boundary_ci',
    confirmDisposableTestDatabase: true as const,
  };
  try {
    await assertDisposableDatabase(db, safety);
    await db.query('CREATE TEMP TABLE boundary_probe (id integer PRIMARY KEY, data jsonb, changed_at timestamptz)');
    // Dedicated client keeps the temporary table and safety checks on one session.
    const tables = [{ name: 'boundary_probe', key: 'id' }];
    const statements = [
      'INSERT INTO boundary_probe(id) VALUES (1)',
      "UPDATE boundary_probe SET data = jsonb_build_object('token', 'redacted') WHERE id = 1",
      "UPDATE boundary_probe SET changed_at = now() WHERE id = 1",
      'DELETE FROM boundary_probe WHERE id = 1',
    ];
    for (const statement of statements) {
      await assert.rejects(
        assertNoMutation({ db, tables, safety, action: async () => { await db.query(statement); } }),
        (error: unknown) => {
          assert.ok(error instanceof MutationBoundaryError);
          assert.doesNotMatch(error.message, /redacted/);
          return true;
        },
      );
    }
    await assertNoMutation({ db, tables, safety, action: async () => {} });
    await db.query('INSERT INTO boundary_probe(id) VALUES (3), (4)');
    await assert.rejects(
      assertNoMutation({ db, tables, safety, maxRowsPerTable: 1, action: async () => {} }),
      /row limit exceeded/,
    );
    await assert.rejects(
      assertNoMutation({
        db, tables, safety: { ...safety, expectedDatabase: 'unexpected_test' },
        action: async () => { throw new Error('action must not execute'); },
      }),
      /database identity does not match/,
    );
  } finally {
    await db.end();
  }
});

test('real pg.Pool pins a connection and observes committed changes', async () => {
  const url = process.env.MUTATION_BOUNDARY_TEST_DATABASE_URL;
  if (!url) throw new Error('Isolated test database URL required');
  const pool = new pg.Pool({ connectionString: url, max: 2 });
  const safety = {
    expectedDatabase: 'mutation_boundary_test',
    expectedUser: 'mutation_boundary_ci',
    confirmDisposableTestDatabase: true as const,
  };
  const table = 'boundary_pool_probe';
  try {
    await pool.query('CREATE TABLE ' + table + ' (id integer PRIMARY KEY, value text)');
    await assert.rejects(
      assertNoMutation({
        db: pool,
        tables: [{ name: table, key: 'id' }],
        safety,
        action: async () => {
          await pool.query('INSERT INTO ' + table + " (id, value) VALUES (1, 'changed')");
        },
      }),
      MutationBoundaryError,
    );
    await assertNoMutation({
      db: pool,
      tables: [{ name: table, key: 'id' }],
      safety,
      action: async () => {},
    });
    assert.equal(pool.idleCount, pool.totalCount);
  } finally {
    await pool.query('DROP TABLE IF EXISTS ' + table);
    await pool.end();
  }
});
