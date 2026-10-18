# Verified PostgreSQL recipes (v0.3 development)

The following recipes use the existing public `assertNoMutation` API. They require **Node.js 24+**, an isolated, disposable PostgreSQL database, and the `pg` package in your test project. The corresponding real-client and real-pool behaviors are exercised by `test/postgres.test.ts` with PostgreSQL 16 in CI.

Set `MUTATION_BOUNDARY_TEST_DATABASE_URL` to a disposable database (for example, the CI fixture `mutation_boundary_test` using session role `mutation_boundary_ci`). **Never point these examples at a shared or production database.** Adjust both expectations to the actual disposable test identity.

## pg.Client: dedicated connection (including temporary tables)

```ts
import pg from 'pg';
import { assertNoMutation } from 'mutation-boundary';

const db = new pg.Client({ connectionString: process.env.MUTATION_BOUNDARY_TEST_DATABASE_URL });
await db.connect();
try {
  await db.query('CREATE TEMP TABLE boundary_example (id integer PRIMARY KEY, status text)');
  await db.query("INSERT INTO boundary_example VALUES (1, 'pending')");
  await assertNoMutation({
    db,
    tables: [{ name: 'boundary_example', key: 'id' }],
    safety: {
      expectedDatabase: 'mutation_boundary_test',
      expectedUser: 'mutation_boundary_ci',
      confirmDisposableTestDatabase: true,
    },
    action: async () => {
      // Replace with the awaited operation expected to leave the selected rows unchanged.
      await db.query('SELECT 1');
    },
  });
} finally {
  await db.end();
}
```

A temporary table belongs to one PostgreSQL session, so keep it on a dedicated `pg.Client`. Calling `db.end()` in `finally` prevents connection leaks.

## pg.Pool: committed changes on a separate connection

```ts
import pg from 'pg';
import { assertNoMutation } from 'mutation-boundary';

const pool = new pg.Pool({
  connectionString: process.env.MUTATION_BOUNDARY_TEST_DATABASE_URL,
  max: 2,
  connectionTimeoutMillis: 2000,
});
try {
  // Permanent fixture table in a disposable test database; never a temporary table.
  await pool.query('CREATE TABLE boundary_pool_example (id integer PRIMARY KEY)');
  await assertNoMutation({
    db: pool,
    tables: [{ name: 'boundary_pool_example', key: 'id' }],
    safety: {
      expectedDatabase: 'mutation_boundary_test',
      expectedUser: 'mutation_boundary_ci',
      confirmDisposableTestDatabase: true,
    },
    action: async () => {
      await pool.query('SELECT 1'); // Uses another checked-out connection.
    },
  });
} finally {
  try {
    await pool.query('DROP TABLE IF EXISTS boundary_pool_example');
  } finally {
    await pool.end();
  }
}
```

`assertNoMutation` pins one client for the safety check and both snapshots and returns it in `finally`. The callback does **not** receive this client. If the callback queries through the same pool, `max: 1` can wait until the connection timeout (or indefinitely when none is configured). Use `max >= 2` when the callback requires another connection; more connections may be required by concurrent requests or test runners. Avoid concurrent writers to selected tables: snapshot comparisons are not concurrency-safe.

**Limitations:** both examples test surviving **net** changes in selected rows only. Restored or rolled-back writes, concurrent writers, sequences, background jobs and external side effects are not detected reliably. Driver/application errors can contain sensitive information; the library's own mutation-count summary deliberately omits row values and keys.
