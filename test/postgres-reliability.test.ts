import assert from 'node:assert/strict';
import { test } from 'node:test';
import pg from 'pg';
import { assertNoMutation, MutationBoundaryError, assertDisposableDatabase } from '../src/index.ts';

const connectionString = (): string => {
  const url = process.env.MUTATION_BOUNDARY_TEST_DATABASE_URL;
  if (!url) throw new Error('Disposable PostgreSQL test URL required');
  return url;
};
const safety = {
  expectedDatabase: 'mutation_boundary_test',
  expectedUser: 'mutation_boundary_ci',
  confirmDisposableTestDatabase: true as const,
};

// Uses 48 unique 700kB text values: cumulative retained canonical data exceeds
// 32 MiB while every individual scalar remains below the 1 MiB value limit.
const oversizedRowsSql = `
  INSERT INTO boundary_memory_probe (id, payload, state)
  SELECT n, repeat(chr(97 + (n % 26)), 700000), 'untouched'
  FROM generate_series(1, 48) AS n
`;

test('real PostgreSQL: aggregate budget rejects a large valid dataset before action', async () => {
  const db = new pg.Client({ connectionString: connectionString() });
  await db.connect();
  let invoked = false;
  try {
    await assertDisposableDatabase(db, safety);
    await db.query('CREATE TEMP TABLE boundary_memory_probe (id integer PRIMARY KEY, payload text NOT NULL, state text NOT NULL)');
    await db.query(oversizedRowsSql);
    await assert.rejects(assertNoMutation({
      db, tables: [{ name: 'boundary_memory_probe', key: 'id' }], safety,
      action: async () => { invoked = true; },
    }), error => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /snapshot total size limit exceeded \(32 MiB\)/);
      assert.doesNotMatch(error.message, /untouched|payload contents/);
      return true;
    });
    assert.equal(invoked, false, 'baseline overflow must not run the operation');

    // Projection is intentional and must make exactly the selected fields
    // observable without trying to serialize the excluded large payload.
    const selection = [{ name: 'boundary_memory_probe', key: 'id', includeColumns: ['state'] }];
    await assertNoMutation({ db, tables: selection, safety, action: async () => {} });
    await assert.rejects(assertNoMutation({
      db, tables: selection, safety,
      action: async () => {
        await db.query("UPDATE boundary_memory_probe SET state = 'changed' WHERE id = 1");
      },
    }), error => {
      assert.ok(error instanceof MutationBoundaryError);
      assert.deepEqual(error.counts, [{ table: 'boundary_memory_probe', inserted: 0, updated: 1, deleted: 0 }]);
      return true;
    });
  } finally {
    await db.end();
  }
});

test('real pg.Pool: post-action aggregate overflow releases pin and pool stays reusable', async () => {
  const pool = new pg.Pool({
    connectionString: connectionString(), max: 2, connectionTimeoutMillis: 2500,
  });
  const table = 'boundary_after_budget_probe';
  try {
 
    const safetyClient = await pool.connect();
    try { await assertDisposableDatabase(safetyClient, safety); }
    finally { safetyClient.release(); }   await pool.query(`CREATE TABLE ${table} (id integer PRIMARY KEY, payload text NOT NULL)`);
    const tables = [{ name: table, key: 'id' }];
    await assert.rejects(assertNoMutation({
      db: pool, tables, safety,
      action: async () => {
        await pool.query(`INSERT INTO ${table} SELECT n, repeat(chr(97 + (n % 26)), 700000) FROM generate_series(1, 48) n`);
      },
    }), /snapshot total size limit exceeded \(32 MiB\)/);
    assert.equal(pool.idleCount, pool.totalCount, 'checked-out snapshot client must be returned');
    assert.ok(pool.totalCount <= 2);
    await assertNoMutation({
      db: pool, tables: [{ name: table, key: 'id', includeColumns: ['id'] }],
      safety, action: async () => {},
    });
    assert.equal(pool.idleCount, pool.totalCount);
  } finally {
    try { await pool.query(`DROP TABLE IF EXISTS ${table}`); }
    finally { await pool.end(); }
  }
});

test('real pg.Pool: failure of the pinned reader connection fails closed and a fresh client recovers', async () => {
  const pool = new pg.Pool({
    connectionString: connectionString(), max: 3, connectionTimeoutMillis: 2500,
  });
  const table = 'boundary_pinned_disconnect_probe';
  // The pool may emit a connection error after terminating a checked-out
  // backend. Observe it so an expected failure cannot become an unhandled event.
  const poolErrors: Error[] = [];
  pool.on('error', error => { poolErrors.push(error); });
  try {
 
    const safetyClient = await pool.connect();
    try { await assertDisposableDatabase(safetyClient, safety); }
    finally { safetyClient.release(); }   await pool.query(`CREATE TABLE ${table} (id integer PRIMARY KEY, state text NOT NULL)`);
    await pool.query(`INSERT INTO ${table} VALUES (1, 'initial')`);
    // The pool has another connection available for the action, and the
    // snapshot reader is pinned for the whole assertion lifecycle.
    // Terminating just that backend must not result in a successful assertion.
    let readerPid: number | undefined;
    const adapter = {
      async connect() {
        const client = await pool.connect();
        // Checked-out clients can emit an error when their backend dies.
        // The assertion still must reject on its after-snapshot query.
        client.on('error', () => {});
        const pid = await client.query('SELECT pg_backend_pid()::integer AS pid');
        readerPid = pid.rows[0]?.pid;
        return client;
      },
    };
    await assert.rejects(assertNoMutation({
      db: adapter, tables: [{ name: table, key: 'id' }], safety,
      action: async () => {
        assert.ok(Number.isInteger(readerPid));
        const result = await pool.query('SELECT pg_terminate_backend($1::integer) AS terminated', [readerPid]);
        assert.equal(result.rows[0]?.terminated, true);
      },
    }), error => {
      assert.ok(error instanceof Error, 'post-action query failure must be observable');
      assert.ok(!(error instanceof MutationBoundaryError), 'connection loss is not a mutation report');
      return true;
    });
    // The failed snapshot reader should not poison subsequent operations.
    await assertNoMutation({
      db: pool, tables: [{ name: table, key: 'id' }], safety, action: async () => {},
    });
  } finally {
    try { await pool.query(`DROP TABLE IF EXISTS ${table}`); }
    finally { await pool.end(); }
  }
});

test('real PostgreSQL: committed concurrent writer is visible only after it finishes', async () => {
  const pool = new pg.Pool({
    connectionString: connectionString(), max: 3, connectionTimeoutMillis: 2500,
  });
  const table = 'boundary_concurrent_writer_probe';
  try {
 
    const safetyClient = await pool.connect();
    try { await assertDisposableDatabase(safetyClient, safety); }
    finally { safetyClient.release(); }   await pool.query(`CREATE TABLE ${table} (id integer PRIMARY KEY, state text NOT NULL)`);
    await pool.query(`INSERT INTO ${table} VALUES (1, 'before')`);
    await assert.rejects(assertNoMutation({
      db: pool, tables: [{ name: table, key: 'id' }], safety,
      action: async () => {
        const writer = await pool.connect();
        try {
          await writer.query('BEGIN');
          await writer.query(`UPDATE ${table} SET state = 'after' WHERE id = 1`);
          await writer.query('COMMIT');
        } finally {
          writer.release();
        }
      },
    }), error => {
      assert.ok(error instanceof MutationBoundaryError);
      assert.equal(error.counts[0]?.updated, 1);
      return true;
    });
    assert.equal(pool.idleCount, pool.totalCount);
  } finally {
    try { await pool.query(`DROP TABLE IF EXISTS ${table}`); }
    finally { await pool.end(); }
  }
});


test('real PostgreSQL: pre-existing REPEATABLE READ transaction cannot observe an independent commit', async () => {
  const reader = new pg.Client({ connectionString: connectionString() });
  const writer = new pg.Client({ connectionString: connectionString() });
  const table = 'boundary_repeatable_read_probe';
  await reader.connect();
  try {
    await assertDisposableDatabase(reader, safety);
    await reader.query(`CREATE TABLE ${table} (id integer PRIMARY KEY, state text NOT NULL)`);
    await reader.query(`INSERT INTO ${table} VALUES (1, 'before')`);
    await writer.connect();
    await assertDisposableDatabase(writer, safety);
    await reader.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
    try {
      // These two SELECT snapshots execute on the same old PostgreSQL
      // transaction snapshot. The writer commits, but REPEATABLE READ still
      // exposes the old state to the checked reader.
      let writerCommitted = false;
      await assertNoMutation({
        db: reader, tables: [{ name: table, key: 'id' }], safety,
        action: async () => {
          await writer.query(`UPDATE ${table} SET state = 'after' WHERE id = 1`);
          writerCommitted = true;
        },
      });
      assert.equal(writerCommitted, true);
      const invisible = await reader.query(`SELECT state FROM ${table} WHERE id = 1`);
      assert.equal(invisible.rows[0]?.state, 'before', 'repeatable-read snapshot must remain old');
    } finally {
      await reader.query('ROLLBACK');
    }
    const visible = await reader.query(`SELECT state FROM ${table} WHERE id = 1`);
    assert.equal(visible.rows[0]?.state, 'after', 'committed writer must be visible after rollback');
  } finally {
    try {
      await reader.query(`DROP TABLE IF EXISTS ${table}`);
    } finally {
      await reader.end();
      await writer.end().catch(() => {});
    }
  }
});
