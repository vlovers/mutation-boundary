import { performance } from 'node:perf_hooks';
import pg from 'pg';
import { assertNoMutation, assertDisposableDatabase } from '../dist/index.js';

const url = process.env.MUTATION_BOUNDARY_TEST_DATABASE_URL;
if (!url) throw new Error('Disposable PostgreSQL URL required; no default connection');
const safety = {
  expectedDatabase: 'mutation_boundary_test',
  expectedUser: 'mutation_boundary_ci',
  confirmDisposableTestDatabase: true,
};
const db = new pg.Client({ connectionString: url });
const memory = () => {
  const { rss, heapUsed, external, arrayBuffers } = process.memoryUsage();
  return { rss, heapUsed, external, arrayBuffers };
};
const sample = async (label, rows, projection) => {
  await db.query('TRUNCATE boundary_memory_profile');
  await db.query(`
    INSERT INTO boundary_memory_profile (id, payload, status)
    SELECT n, repeat(chr(97 + (n % 26)), 700000), 'stable'
    FROM generate_series(1, $1::integer) n
  `, [rows]);
  const before = memory();
  const started = performance.now();
  let outcome = 'passed';
  try {
    await assertNoMutation({
      db, safety,
      tables: [{ name: 'boundary_memory_profile', key: 'id', ...(projection ? { includeColumns: ['status'] } : {}) }],
      action: async () => {},
    });
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('snapshot total size limit exceeded')) throw error;
    outcome = 'aggregate_cap_rejected';
  }
  const after = memory();
  return { label, rows, projection: Boolean(projection), outcome, elapsedMs: Math.round(performance.now() - started), before, after };
};
try {
  await db.connect();
  await assertDisposableDatabase(db, safety);
  await db.query('CREATE TEMP TABLE boundary_memory_profile (id integer PRIMARY KEY, payload text NOT NULL, status text NOT NULL)');
  // RSS/heap/external are observational samples, not peaks. For absolute
  // production safety never run this against shared or production data.
  const measurements = [
    await sample('small', 6, false),
    await sample('valid-large', 32, false),
    await sample('aggregate-overflow', 48, false),
    await sample('narrow-projection', 48, true),
  ];
  console.log(JSON.stringify({
    kind: 'mutation-boundary-memory-observation',
    node: process.version,
    note: 'Point-in-time memory samples only; not a peak RSS or driver allocation bound',
    measurements,
  }, null, 2));
} finally {
  await db.end().catch(() => {});
}
