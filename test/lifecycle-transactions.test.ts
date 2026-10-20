import assert from 'node:assert/strict';
import { test } from 'node:test';
import pg from 'pg';
import { assertNoMutation, MutationBoundaryError } from '../src/index.ts';

const safety = {
  expectedDatabase: 'mutation_boundary_test',
  expectedUser: 'mutation_boundary_ci',
  confirmDisposableTestDatabase: true as const,
};
const tables = [{ name: 'boundary_lifecycle_probe', key: 'id' }];
const connectionString = () => {
  const url = process.env.MUTATION_BOUNDARY_TEST_DATABASE_URL;
  if (!url) throw new Error('Disposable PostgreSQL URL required');
  return url;
};

test('committed writes on an independent connection are detected', async () => {
  const pool = new pg.Pool({ connectionString: connectionString(), max: 2, connectionTimeoutMillis: 1000 });
  try {
    await pool.query('CREATE TABLE boundary_lifecycle_probe (id integer PRIMARY KEY, value text NOT NULL)');
    await assert.rejects(assertNoMutation({
      db: pool, tables, safety,
      action: async () => {
        const writer = await pool.connect();
        try {
          await writer.query('BEGIN');
          await writer.query("INSERT INTO boundary_lifecycle_probe VALUES (1, 'committed')");
          await writer.query('COMMIT');
        } catch (error) {
          await writer.query('ROLLBACK');
          throw error;
        } finally {
          writer.release();
        }
      },
    }), (error: unknown) => {
      assert.ok(error instanceof MutationBoundaryError);
      assert.equal(error.counts[0]?.inserted, 1);
      return true;
    });
    assert.equal(pool.idleCount, pool.totalCount);
  } finally {
    try { await pool.query('DROP TABLE IF EXISTS boundary_lifecycle_probe'); }
    finally { await pool.end(); }
  }
});

test('independent uncommitted writes are invisible until commit', async () => {
  const pool = new pg.Pool({ connectionString: connectionString(), max: 2, connectionTimeoutMillis: 1000 });
  let writer: pg.PoolClient | undefined;
  try {
    await pool.query('CREATE TABLE boundary_lifecycle_probe (id integer PRIMARY KEY, value text NOT NULL)');
    writer = await pool.connect();
    await writer.query('BEGIN');
    await assertNoMutation({
      db: pool, tables, safety,
      action: async () => {
        await writer!.query("INSERT INTO boundary_lifecycle_probe VALUES (1, 'uncommitted')");
        // The snapshot uses another connection and cannot see this uncommitted row.
      },
    });
    await writer.query('COMMIT');
    const count = await writer.query('SELECT count(*)::integer AS n FROM boundary_lifecycle_probe');
    assert.equal(count.rows[0]?.n, 1);
  } finally {
    if (writer) {
      try { await writer.query('ROLLBACK'); } catch { /* connection may already be closed */ }
      writer.release();
    }
    try { await pool.query('DROP TABLE IF EXISTS boundary_lifecycle_probe'); }
    finally { await pool.end(); }
  }
});

test('savepoint rollback does not trigger a false mutation; released savepoint plus commit does', async () => {
  const db = new pg.Client({ connectionString: connectionString() });
  await db.connect();
  try {
    await db.query('CREATE TEMP TABLE boundary_lifecycle_probe (id integer PRIMARY KEY, value text NOT NULL)');
    await assertNoMutation({
      db, tables, safety,
      action: async () => {
        await db.query('BEGIN');
        try {
          await db.query('SAVEPOINT before_write');
          await db.query("INSERT INTO boundary_lifecycle_probe VALUES (1, 'rolled_back')");
          await db.query('ROLLBACK TO SAVEPOINT before_write');
          await db.query('COMMIT');
        } catch (error) {
          await db.query('ROLLBACK');
          throw error;
        }
      },
    });
    await assert.rejects(assertNoMutation({
      db, tables, safety,
      action: async () => {
        await db.query('BEGIN');
        try {
          await db.query('SAVEPOINT before_write');
          await db.query("INSERT INTO boundary_lifecycle_probe VALUES (2, 'committed')");
          await db.query('RELEASE SAVEPOINT before_write');
          await db.query('COMMIT');
        } catch (error) {
          await db.query('ROLLBACK');
          throw error;
        }
      },
    }), MutationBoundaryError);
  } finally {
    await db.end();
  }
});

test('action error preserves original error when the database net state is unchanged', async () => {
  const pool = new pg.Pool({ connectionString: connectionString(), max: 2, connectionTimeoutMillis: 1000 });
  const sentinel = new Error('caller-owned-action-error');
  try {
    await pool.query('CREATE TABLE boundary_lifecycle_probe (id integer PRIMARY KEY, value text NOT NULL)');
    await assert.rejects(assertNoMutation({
      db: pool, tables, safety,
      action: async () => {
        throw sentinel;
      },
    }), (error: unknown) => error === sentinel);
    assert.equal(pool.idleCount, pool.totalCount);
  } finally {
    try { await pool.query('DROP TABLE IF EXISTS boundary_lifecycle_probe'); }
    finally { await pool.end(); }
  }
});

test('baseline validation failure must not execute action or retain a pool connection', async () => {
  const pool = new pg.Pool({ connectionString: connectionString(), max: 2, connectionTimeoutMillis: 1000 });
  let executed = false;
  try {
    await pool.query('CREATE TABLE boundary_lifecycle_probe (id integer PRIMARY KEY, value text NOT NULL)');
    await assert.rejects(assertNoMutation({
      db: pool, tables: [{ name: 'boundary_lifecycle_probe;DROP', key: 'id' }],
      safety, action: async () => { executed = true; },
    }), /unsafe SQL identifier/);
    assert.equal(executed, false);
    assert.equal(pool.idleCount, pool.totalCount);
  } finally {
    try { await pool.query('DROP TABLE IF EXISTS boundary_lifecycle_probe'); }
    finally { await pool.end(); }
  }
});

test('pool exhaustion times out, releases snapshot connection, and subsequently recovers', async () => {
  const pool = new pg.Pool({ connectionString: connectionString(), max: 1, connectionTimeoutMillis: 200 });
  try {
    await pool.query('CREATE TABLE boundary_lifecycle_probe (id integer PRIMARY KEY, value text NOT NULL)');
    await assert.rejects(assertNoMutation({
      db: pool, tables, safety,
      action: async () => { await pool.query('SELECT 1'); },
    }), /timeout/i);
    assert.equal(pool.idleCount, pool.totalCount);
    await assertNoMutation({ db: pool, tables, safety, action: async () => {} });
    assert.equal(pool.idleCount, pool.totalCount);
  } finally {
    try { await pool.query('DROP TABLE IF EXISTS boundary_lifecycle_probe'); }
    finally { await pool.end(); }
  }
});
