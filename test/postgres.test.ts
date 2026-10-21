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

test('PostgreSQL nested JSONB, bytea and null transitions use net-state comparisons', async () => {
  const url = process.env.MUTATION_BOUNDARY_TEST_DATABASE_URL;
  if (!url) throw new Error('Isolated test database URL required');
  const db = new pg.Client({ connectionString: url });
  await db.connect();
  const safety = {
    expectedDatabase: 'mutation_boundary_test',
    expectedUser: 'mutation_boundary_ci',
    confirmDisposableTestDatabase: true as const,
  };
  const tables = [{ name: 'boundary_edge_probe', key: 'id' }];
  try {
    await assertDisposableDatabase(db, safety);
    await db.query('CREATE TEMP TABLE boundary_edge_probe (id integer PRIMARY KEY, payload jsonb, bytes bytea, note text)');
    await db.query(
      "INSERT INTO boundary_edge_probe(id, payload, bytes, note) VALUES (1, '{\"nested\":{\"a\":1,\"b\":null}}'::jsonb, decode('00ff', 'hex'), NULL)",
    );
    await assertNoMutation({ db, tables, safety, action: async () => {
      await db.query(
        "UPDATE boundary_edge_probe SET payload = '{\"nested\":{\"b\":null,\"a\":1}}'::jsonb WHERE id = 1",
      );
    } });
    for (const sql of [
      "UPDATE boundary_edge_probe SET note = 'changed' WHERE id = 1",
      "UPDATE boundary_edge_probe SET bytes = decode('00fe', 'hex') WHERE id = 1",
      "UPDATE boundary_edge_probe SET payload = '{\"nested\":{\"a\":2,\"b\":null}}'::jsonb WHERE id = 1",
    ]) {
      await assert.rejects(assertNoMutation({
        db, tables, safety, action: async () => { await db.query(sql); },
      }), MutationBoundaryError);
    }
  } finally {
    await db.end();
  }
});

test('PostgreSQL rolled-back writes are not incorrectly reported as surviving mutations', async () => {
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
    await db.query('CREATE TEMP TABLE boundary_rollback_probe (id integer PRIMARY KEY)');
    await assertNoMutation({
      db, tables: [{ name: 'boundary_rollback_probe', key: 'id' }], safety,
      action: async () => {
        await db.query('BEGIN');
        try {
          await db.query('INSERT INTO boundary_rollback_probe(id) VALUES (1)');
        } finally {
          await db.query('ROLLBACK');
        }
      },
    });
  } finally {
    await db.end();
  }
});

test('single-connection pg.Pool completes when action does not acquire the pool', async () => {
  const url = process.env.MUTATION_BOUNDARY_TEST_DATABASE_URL;
  if (!url) throw new Error('Isolated test database URL required');
  const pool = new pg.Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 1000 });
  const safety = {
    expectedDatabase: 'mutation_boundary_test',
    expectedUser: 'mutation_boundary_ci',
    confirmDisposableTestDatabase: true as const,
  };
  try {
    await pool.query('CREATE TABLE boundary_single_pool_probe (id integer PRIMARY KEY)');
    await assertNoMutation({
      db: pool, tables: [{ name: 'boundary_single_pool_probe', key: 'id' }],
      safety, action: async () => {},
    });
    assert.equal(pool.idleCount, pool.totalCount);
  } finally {
    await pool.query('DROP TABLE IF EXISTS boundary_single_pool_probe');
    await pool.end();
  }
});

test('schema-qualified tables and composite row keys detect surviving mutations', async () => {
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
    await db.query('CREATE SCHEMA IF NOT EXISTS boundary_v02_test');
    await db.query('CREATE TABLE boundary_v02_test.memberships (tenant_id integer NOT NULL, member_id integer NOT NULL, state text NOT NULL, PRIMARY KEY (tenant_id, member_id))');
    await db.query("INSERT INTO boundary_v02_test.memberships VALUES (1, 1, 'active'), (2, 1, 'active')");
    const tables = [{ name: 'boundary_v02_test.memberships', key: ['tenant_id', 'member_id'] }];
    await assertNoMutation({ db, tables, safety, action: async () => {} });
    await assert.rejects(assertNoMutation({ db, tables, safety, action: async () => {
      await db.query("UPDATE boundary_v02_test.memberships SET state = 'blocked' WHERE tenant_id = 2 AND member_id = 1");
    } }), (error: unknown) => {
      assert.ok(error instanceof MutationBoundaryError);
      assert.equal(error.counts[0]?.updated, 1);
      return true;
    });
    await assert.rejects(assertNoMutation({
      db, tables: [{ name: 'boundary_v02_test.memberships;DROP', key: ['tenant_id', 'member_id'] }],
      safety, action: async () => { throw new Error('should not run'); },
    }), /unsafe SQL identifier/);
  } finally {
    await db.query('DROP SCHEMA IF EXISTS boundary_v02_test CASCADE');
    await db.end();
  }
});

test('parameterized row filter scopes changes to selected tenant', async () => {
  const url = process.env.MUTATION_BOUNDARY_TEST_DATABASE_URL;
  if (!url) throw new Error('Isolated test database URL required');
  const db = new pg.Client({ connectionString: url });
  await db.connect();
  const safety = { expectedDatabase: 'mutation_boundary_test', expectedUser: 'mutation_boundary_ci', confirmDisposableTestDatabase: true as const };
  try {
    await assertDisposableDatabase(db, safety);
    await db.query('CREATE TEMP TABLE boundary_filter_probe (id integer PRIMARY KEY, tenant_id text, state text)');
    await db.query("INSERT INTO boundary_filter_probe VALUES (1, 'tenant-a', 'open'), (2, 'tenant-b', 'open'), (3, NULL, 'open')");
    const tables = [{ name: 'boundary_filter_probe', key: 'id', where: { column: 'tenant_id', equals: 'tenant-a' } }];
    await assertNoMutation({ db, tables, safety, action: async () => {
      await db.query("UPDATE boundary_filter_probe SET state = 'done' WHERE id = 2");
    } });
    await assert.rejects(assertNoMutation({ db, tables, safety, action: async () => {
      await db.query("UPDATE boundary_filter_probe SET state = 'done' WHERE id = 1");
    } }), MutationBoundaryError);
    await assert.rejects(assertNoMutation({
      db, tables: [{ name: 'boundary_filter_probe', key: 'id', where: { column: 'tenant_id', equals: null } }],
      safety, action: async () => { await db.query("UPDATE boundary_filter_probe SET state = 'done' WHERE id = 3"); },
    }), MutationBoundaryError);
  } finally {
    await db.end();
  }
});

test('includeColumns and excludeColumns ignore volatile timestamps but detect selected changes', async () => {
  const url = process.env.MUTATION_BOUNDARY_TEST_DATABASE_URL;
  if (!url) throw new Error('Isolated test database URL required');
  const db = new pg.Client({ connectionString: url });
  await db.connect();
  const safety = { expectedDatabase: 'mutation_boundary_test', expectedUser: 'mutation_boundary_ci', confirmDisposableTestDatabase: true as const };
  try {
    await assertDisposableDatabase(db, safety);
    await db.query('CREATE TEMP TABLE boundary_column_probe (id integer PRIMARY KEY, tenant_id text, status text, updated_at integer)');
    await db.query("INSERT INTO boundary_column_probe VALUES (1, 'a', 'open', 1)");
    const excluded = [{ name: 'boundary_column_probe', key: 'id', excludeColumns: ['updated_at'] }];
    await assertNoMutation({ db, tables: excluded, safety, action: async () => {
      await db.query('UPDATE boundary_column_probe SET updated_at = 2 WHERE id = 1');
    } });
    const included = [{ name: 'boundary_column_probe', key: 'id', includeColumns: ['status'] }];
    await assertNoMutation({ db, tables: included, safety, action: async () => {
      await db.query("UPDATE boundary_column_probe SET tenant_id = 'b' WHERE id = 1");
    } });
    await assert.rejects(assertNoMutation({ db, tables: included, safety, action: async () => {
      await db.query("UPDATE boundary_column_probe SET status = 'done' WHERE id = 1");
    } }), MutationBoundaryError);
    await assert.rejects(assertNoMutation({ db, tables: excluded, safety, action: async () => {
      await db.query("UPDATE boundary_column_probe SET status = 'closed' WHERE id = 1");
    } }), MutationBoundaryError);
  } finally {
    await db.end();
  }
});


test('single-connection pool fails with a bounded timeout when action also acquires it', async () => {
  const url = process.env.MUTATION_BOUNDARY_TEST_DATABASE_URL;
  if (!url) throw new Error('Isolated test database URL required');
  const pool = new pg.Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 300 });
  const safety = {
    expectedDatabase: 'mutation_boundary_test',
    expectedUser: 'mutation_boundary_ci',
    confirmDisposableTestDatabase: true as const,
  };
  try {
    await pool.query('CREATE TABLE boundary_pool_contention_probe (id integer PRIMARY KEY)');
    await assert.rejects(assertNoMutation({
      db: pool,
      tables: [{ name: 'boundary_pool_contention_probe', key: 'id' }],
      safety,
      action: async () => { await pool.query('SELECT 1'); },
    }), /timeout/i);
    assert.equal(pool.idleCount, pool.totalCount, 'snapshot client must be returned even when action fails');
    await assertNoMutation({
      db: pool,
      tables: [{ name: 'boundary_pool_contention_probe', key: 'id' }],
      safety,
      action: async () => {},
    });
  } finally {
    try {
      await pool.query('DROP TABLE IF EXISTS boundary_pool_contention_probe');
    } finally {
      await pool.end();
    }
  }
});


test('real PostgreSQL JSONB canonical order, nested updates and Unicode text', async () => {
  const db = new pg.Client({ connectionString: process.env.MUTATION_BOUNDARY_TEST_DATABASE_URL });
  await db.connect();
  const safety = { expectedDatabase: 'mutation_boundary_test', expectedUser: 'mutation_boundary_ci', confirmDisposableTestDatabase: true as const };
  const tables = [{ name: 'boundary_json_unicode_probe', key: 'id' }];
  try {
    await assertDisposableDatabase(db, safety);
    await db.query('CREATE TEMP TABLE boundary_json_unicode_probe (id integer PRIMARY KEY, data jsonb NOT NULL, label text NOT NULL)');
    await db.query('INSERT INTO boundary_json_unicode_probe VALUES (1, $1::jsonb, $2)', [JSON.stringify({ b: 2, nested: { x: 1, y: 'тест' } }), 'Привіт 👋']);
    await assertNoMutation({ db, tables, safety, action: async () => {
      await db.query('UPDATE boundary_json_unicode_probe SET data = $1::jsonb WHERE id = 1', [JSON.stringify({ nested: { y: 'тест', x: 1 }, b: 2 })]);
    } });
    await assert.rejects(assertNoMutation({ db, tables, safety, action: async () => {
      await db.query("UPDATE boundary_json_unicode_probe SET data = jsonb_set(data, '{nested,x}', '2'::jsonb) WHERE id = 1");
    } }), (error: unknown) => {
      assert.ok(error instanceof MutationBoundaryError);
      assert.equal(error.counts[0]?.updated, 1);
      assert.doesNotMatch(error.message + JSON.stringify(error), /Привіт|тест/);
      return true;
    });
    await assert.rejects(assertNoMutation({ db, tables, safety, action: async () => {
      await db.query('UPDATE boundary_json_unicode_probe SET label = $1 WHERE id = 1', ['Привіт 🌍']);
    } }), MutationBoundaryError);
  } finally {
    await db.end();
  }
});

test('real PostgreSQL bytea and NULL transitions preserve typed net-state changes', async () => {
  const db = new pg.Client({ connectionString: process.env.MUTATION_BOUNDARY_TEST_DATABASE_URL });
  await db.connect();
  const safety = { expectedDatabase: 'mutation_boundary_test', expectedUser: 'mutation_boundary_ci', confirmDisposableTestDatabase: true as const };
  const tables = [{ name: 'boundary_binary_null_probe', key: 'id' }];
  try {
    await assertDisposableDatabase(db, safety);
    await db.query('CREATE TEMP TABLE boundary_binary_null_probe (id integer PRIMARY KEY, payload bytea, annotation text)');
    await db.query('INSERT INTO boundary_binary_null_probe VALUES (1, $1::bytea, NULL)', [Buffer.from([0, 255, 12])]);
    await assertNoMutation({ db, tables, safety, action: async () => {} });
    await assert.rejects(assertNoMutation({ db, tables, safety, action: async () => {
      await db.query('UPDATE boundary_binary_null_probe SET annotation = $1 WHERE id = 1', ['not-null']);
    } }), MutationBoundaryError);
    await assert.rejects(assertNoMutation({ db, tables, safety, action: async () => {
      await db.query('UPDATE boundary_binary_null_probe SET payload = $1::bytea WHERE id = 1', [Buffer.from([0, 255, 13])]);
    } }), (error: unknown) => {
      assert.ok(error instanceof MutationBoundaryError);
      assert.equal(error.counts[0]?.updated, 1);
      return true;
    });
  } finally {
    await db.end();
  }
});

test('real PostgreSQL composite keys distinguish updates from key replacement', async () => {
  const db = new pg.Client({ connectionString: process.env.MUTATION_BOUNDARY_TEST_DATABASE_URL });
  await db.connect();
  const safety = { expectedDatabase: 'mutation_boundary_test', expectedUser: 'mutation_boundary_ci', confirmDisposableTestDatabase: true as const };
  const tables = [{ name: 'boundary_composite_probe', key: ['tenant_id', 'member_id'] }];
  try {
    await assertDisposableDatabase(db, safety);
    await db.query('CREATE TEMP TABLE boundary_composite_probe (tenant_id integer NOT NULL, member_id integer NOT NULL, state text NOT NULL, PRIMARY KEY (tenant_id, member_id))');
    await db.query("INSERT INTO boundary_composite_probe VALUES (1, 1, 'open')");
    await assert.rejects(assertNoMutation({ db, tables, safety, action: async () => {
      await db.query("UPDATE boundary_composite_probe SET state = 'closed' WHERE tenant_id = 1 AND member_id = 1");
    } }), (error: unknown) => {
      assert.ok(error instanceof MutationBoundaryError);
      assert.deepEqual(error.counts, [{ table: 'boundary_composite_probe', inserted: 0, updated: 1, deleted: 0 }]);
      return true;
    });
    await assert.rejects(assertNoMutation({ db, tables, safety, action: async () => {
      await db.query('UPDATE boundary_composite_probe SET member_id = 2 WHERE tenant_id = 1 AND member_id = 1');
    } }), (error: unknown) => {
      assert.ok(error instanceof MutationBoundaryError);
      assert.deepEqual(error.counts, [{ table: 'boundary_composite_probe', inserted: 1, updated: 0, deleted: 1 }]);
      return true;
    });
  } finally {
    await db.end();
  }
});
