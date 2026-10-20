import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertNoMutation, MutationBoundaryError } from '../src/index.ts';

const safety = {
  expectedDatabase: 'mutation_boundary_test',
  expectedUser: 'mutation_boundary_ci',
  confirmDisposableTestDatabase: true as const,
};
const tables = [{ name: 'tasks', key: 'id' }];
type Row = Record<string, unknown>;

function fixture(options: {
  baseline?: Row[];
  after?: Row[];
  failAtRead?: number;
  clientError?: Error;
  failConnect?: Error;
} = {}) {
  let queryReads = 0;
  let releases = 0;
  let connects = 0;
  const client = {
    async query(sql: string): Promise<Row[]> {
      if (sql.includes('current_database()')) {
        return [{ database_name: safety.expectedDatabase, user_name: safety.expectedUser }];
      }
      queryReads++;
      if (options.failAtRead === queryReads) throw options.clientError ?? new Error('injected database failure');
      return structuredClone(queryReads === 1 ? (options.baseline ?? []) : (options.after ?? options.baseline ?? []));
    },
    release() { releases++; },
  };
  const pool = {
    async connect() {
      connects++;
      if (options.failConnect) throw options.failConnect;
      return client;
    },
  };
  return { pool, stats: () => ({ queryReads, releases, connects }) };
}

test('failed safety checks do not run actions and release pinned connection', async () => {
  const f = fixture();
  let called = false;
  await assert.rejects(assertNoMutation({
    db: f.pool, tables,
    safety: { ...safety, expectedDatabase: 'other_test' },
    action: async () => { called = true; },
  }), /does not match/);
  assert.equal(called, false);
  assert.deepEqual(f.stats(), { queryReads: 0, releases: 1, connects: 1 });
});

test('first snapshot driver error does not run action and releases connection', async () => {
  const error = new Error('simulated baseline query failure');
  const f = fixture({ failAtRead: 1, clientError: error });
  let called = false;
  await assert.rejects(assertNoMutation({
    db: f.pool, tables, safety, action: async () => { called = true; },
  }), (received: unknown) => received === error);
  assert.equal(called, false);
  assert.deepEqual(f.stats(), { queryReads: 1, releases: 1, connects: 1 });
});

test('second snapshot driver error propagates and releases connection', async () => {
  const error = new Error('simulated after-snapshot query failure');
  const f = fixture({ failAtRead: 2, clientError: error });
  let called = false;
  await assert.rejects(assertNoMutation({
    db: f.pool, tables, safety, action: async () => { called = true; },
  }), (received: unknown) => received === error);
  assert.equal(called, true);
  assert.deepEqual(f.stats(), { queryReads: 2, releases: 1, connects: 1 });
});

test('mutation contract error takes precedence over action error', async () => {
  const f = fixture({ baseline: [{ id: 1, state: 'before', secret: 'private' }], after: [{ id: 1, state: 'after', secret: 'private' }] });
  const actionError = new Error('caller owned');
  await assert.rejects(assertNoMutation({
    db: f.pool, tables, safety, action: async () => { throw actionError; },
  }), (received: unknown) => {
    assert.ok(received instanceof MutationBoundaryError);
    assert.equal(received.counts[0]?.updated, 1);
    assert.doesNotMatch(received.message, /private|caller owned/);
    assert.doesNotMatch(JSON.stringify(received), /private|caller owned/);
    return true;
  });
  assert.equal(f.stats().releases, 1);
});

test('action error survives unchanged when database state is unchanged', async () => {
  const f = fixture({ baseline: [{ id: 1 }] });
  const error = new Error('caller owned action exception');
  await assert.rejects(assertNoMutation({
    db: f.pool, tables, safety, action: async () => { throw error; },
  }), (received: unknown) => received === error);
  assert.equal(f.stats().releases, 1);
});

test('connect rejection never invokes action or releases a missing client', async () => {
  const error = new Error('pool exhausted');
  const f = fixture({ failConnect: error });
  let called = false;
  await assert.rejects(assertNoMutation({
    db: f.pool, tables, safety, action: async () => { called = true; },
  }), (received: unknown) => received === error);
  assert.equal(called, false);
  assert.deepEqual(f.stats(), { queryReads: 0, releases: 0, connects: 1 });
});

test('unsupported after-snapshot value fails closed and releases pinned connection', async () => {
  const f = fixture({ baseline: [{ id: 1, state: 'normal' }], after: [{ id: 1, state: undefined }] });
  await assert.rejects(assertNoMutation({
    db: f.pool, tables, safety, action: async () => {},
  }), /unsupported snapshot value in table tasks/);
  assert.equal(f.stats().releases, 1);
});

test('empty table selections reject before executing action and release connection', async () => {
  const f = fixture();
  let called = false;
  await assert.rejects(assertNoMutation({
    db: f.pool, tables: [], safety, action: async () => { called = true; },
  }), /select at least one table/);
  assert.equal(called, false);
  assert.equal(f.stats().releases, 1);
});
