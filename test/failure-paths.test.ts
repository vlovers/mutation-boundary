import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertNoMutation, MutationBoundaryError, type TableSpec } from '../src/index.ts';

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


test('pool-style adapter exposing only connect pins exactly one client', async () => {
  const fixturePool = fixture({ baseline: [{ id: 1 }], after: [{ id: 1 }] });
  await assertNoMutation({ db: fixturePool.pool, tables, safety, action: async () => {} });
  assert.deepEqual(fixturePool.stats(), { queryReads: 2, releases: 1, connects: 1 });
});

test('query-first adapter with connect method but no pool metrics uses its query interface', async () => {
  let queried = 0;
  let connected = 0;
  const adapter = {
    async query(sql: string): Promise<Row[]> {
      queried++;
      if (sql.includes('current_database()')) {
        return [{ database_name: safety.expectedDatabase, user_name: safety.expectedUser }];
      }
      return [{ id: 1, state: 'unchanged' }];
    },
    async connect(): Promise<never> {
      connected++;
      throw new Error('connect is not a pool checkout');
    },
  };
  await assertNoMutation({ db: adapter, tables, safety, action: async () => {} });
  assert.equal(queried, 3);
  assert.equal(connected, 0);
});

test('pg-like adapter with query, connect and numeric pool metrics pins and releases', async () => {
  const f = fixture({ baseline: [{ id: 1 }], after: [{ id: 1 }] });
  let directQueries = 0;
  const adapter = {
    async query(): Promise<Row[]> { directQueries++; throw new Error('must not query pool directly'); },
    async connect() { return f.pool.connect(); },
    totalCount: 1,
    idleCount: 1,
  };
  await assertNoMutation({ db: adapter, tables, safety, action: async () => {} });
  assert.equal(directQueries, 0);
  assert.deepEqual(f.stats(), { queryReads: 2, releases: 1, connects: 1 });
});


test('action rejection after a pool snapshot still releases the client exactly once', async () => {
  const f = fixture({ baseline: [{ id: 1, value: 'unchanged' }] });
  const original = new Error('caller failed');
  await assert.rejects(assertNoMutation({
    db: f.pool, tables, safety,
    action: async () => { throw original; },
  }), received => received === original);
  assert.deepEqual(f.stats(), { queryReads: 2, releases: 1, connects: 1 });
});

test('detected mutations take precedence over action errors and release exactly once', async () => {
  const f = fixture({ baseline: [{ id: 1, value: 'old' }], after: [{ id: 1, value: 'new' }] });
  const original = new Error('private caller failure');
  await assert.rejects(assertNoMutation({
    db: f.pool, tables, safety,
    action: async () => { throw original; },
  }), received => {
    assert.ok(received instanceof MutationBoundaryError);
    assert.deepEqual(received.toJSON().counts, [{ table: 'tasks', inserted: 0, updated: 1, deleted: 0 }]);
    assert.doesNotMatch(JSON.stringify(received), /private caller failure|old|new/);
    return true;
  });
  assert.deepEqual(f.stats(), { queryReads: 2, releases: 1, connects: 1 });
});

test('a failed post-action snapshot propagates its driver error and releases once', async () => {
  const error = new Error('post-action database failure');
  const f = fixture({ failAtRead: 2, clientError: error });
  const actionError = new Error('earlier action failure');
  await assert.rejects(assertNoMutation({
    db: f.pool, tables, safety,
    action: async () => { throw actionError; },
  }), received => received === error);
  assert.deepEqual(f.stats(), { queryReads: 2, releases: 1, connects: 1 });
});


test('release failure is observable when verification otherwise succeeds', async () => {
  const releaseError = new Error('injected client release failure');
  let releases = 0;
  let reads = 0;
  const db = {
    async connect() {
      return {
        async query(sql: string): Promise<Row[]> {
          if (sql.includes('current_database()')) {
            return [{ database_name: safety.expectedDatabase, user_name: safety.expectedUser }];
          }
          reads++;
          return [{ id: 1, state: 'unchanged' }];
        },
        release() { releases++; throw releaseError; },
      };
    },
  };
  await assert.rejects(assertNoMutation({
    db, tables, safety, action: async () => {},
  }), received => received === releaseError);
  assert.equal(reads, 2);
  assert.equal(releases, 1);
});

test('release failure currently takes precedence over earlier action failure', async () => {
  const releaseError = new Error('release failed');
  const actionError = new Error('operation failed');
  let releases = 0;
  const db = {
    async connect() {
      return {
        async query(sql: string): Promise<Row[]> {
          if (sql.includes('current_database()')) {
            return [{ database_name: safety.expectedDatabase, user_name: safety.expectedUser }];
          }
          return [{ id: 1 }];
        },
        release() { releases++; throw releaseError; },
      };
    },
  };
  await assert.rejects(assertNoMutation({
    db, tables, safety, action: async () => { throw actionError; },
  }), received => {
    assert.equal(received, releaseError);
    assert.equal((received as Error & { cause?: unknown }).cause, actionError);
    assert.equal(JSON.stringify(received), '{}');
    return true;
  });
  assert.equal(releases, 1);
});

test('release failure retains mutation report as its cause without leaking row data', async () => {
  const releaseError = new Error('release failed');
  let reads = 0;
  const db = {
    async connect() {
      return {
        async query(sql: string): Promise<Row[]> {
          if (sql.includes('current_database()')) {
            return [{ database_name: safety.expectedDatabase, user_name: safety.expectedUser }];
          }
          reads++;
          return [{ id: 1, privateField: reads === 1 ? 'before secret' : 'after secret' }];
        },
        release() { throw releaseError; },
      };
    },
  };
  await assert.rejects(assertNoMutation({ db, tables, safety, action: async () => {} }), received => {
    assert.equal(received, releaseError);
    const cause = (received as Error & { cause?: unknown }).cause;
    assert.ok(cause instanceof MutationBoundaryError);
    assert.equal(cause.counts[0]?.updated, 1);
    assert.doesNotMatch(JSON.stringify(received), /before secret|after secret/);
    return true;
  });
});

test('release failure preserves a pre-existing cause', async () => {
  const existing = new Error('existing diagnostic');
  const releaseError = new Error('release failed', { cause: existing });
  const db = {
    async connect() {
      return {
        async query(sql: string): Promise<Row[]> {
          if (sql.includes('current_database()')) {
            return [{ database_name: safety.expectedDatabase, user_name: safety.expectedUser }];
          }
          return [{ id: 1 }];
        },
        release() { throw releaseError; },
      };
    },
  };
  await assert.rejects(assertNoMutation({
    db, tables, safety, action: async () => { throw new Error('action failed'); },
  }), received => received === releaseError && (received as Error).cause === existing);
});


test('invalid snapshot configuration fails before action and releases a pooled client', async () => {
  const cases: { name: string; selected: readonly TableSpec[]; maxRowsPerTable?: number; message: RegExp }[] = [
    { name: 'duplicate table', selected: [...tables, ...tables], message: /duplicate table selection/ },
    { name: 'unsafe table name', selected: [{ name: 'tasks;drop', key: 'id' }], message: /unsafe SQL identifier/ },
    { name: 'empty composite key', selected: [{ name: 'tasks', key: [] }], message: /invalid row key/ },
    { name: 'duplicate composite key', selected: [{ name: 'tasks', key: ['id', 'id'] }], message: /invalid row key/ },
    { name: 'conflicting projection options', selected: [{ name: 'tasks', key: 'id', includeColumns: ['id'], excludeColumns: ['value'] }], message: /choose includeColumns or excludeColumns/ },
    { name: 'excluded key', selected: [{ name: 'tasks', key: 'id', excludeColumns: ['id'] }], message: /cannot exclude key columns/ },
    { name: 'invalid filter', selected: [{ name: 'tasks', key: 'id', where: { column: 'id;bad', equals: 1 } }], message: /unsafe SQL identifier/ },
    { name: 'invalid row limit', selected: tables, maxRowsPerTable: 0, message: /invalid snapshot limit/ },
  ];
  for (const scenario of cases) {
    const f = fixture();
    let actionCalls = 0;
    await assert.rejects(assertNoMutation({
      db: f.pool,
      tables: scenario.selected,
      safety,
      ...(scenario.maxRowsPerTable === undefined ? {} : { maxRowsPerTable: scenario.maxRowsPerTable }),
      action: async () => { actionCalls++; },
    }), scenario.message, scenario.name);
    assert.equal(actionCalls, 0, scenario.name);
    assert.equal(f.stats().releases, 1, scenario.name);
    assert.equal(f.stats().connects, 1, scenario.name);
  }
});

test('baseline row-key ambiguity fails closed before invoking action', async () => {
  const cases = [
    { name: 'duplicate key', baseline: [{ id: 1 }, { id: 1 }], message: /duplicate row key/ },
    { name: 'missing key', baseline: [{ value: 'no id' }], message: /missing row key/ },
    { name: 'null key', baseline: [{ id: null }], message: /missing row key/ },
    { name: 'unsupported value', baseline: [{ id: 1, value: undefined }], message: /unsupported snapshot value/ },
  ];
  for (const scenario of cases) {
    const f = fixture({ baseline: scenario.baseline });
    let actionCalls = 0;
    await assert.rejects(assertNoMutation({
      db: f.pool, tables, safety,
      action: async () => { actionCalls++; },
    }), scenario.message, scenario.name);
    assert.equal(actionCalls, 0, scenario.name);
    assert.equal(f.stats().releases, 1, scenario.name);
  }
});


test('reused mutable adapter row objects cannot rewrite the baseline snapshot', async () => {
  const row = { id: 1, status: 'before', metadata: { nested: 'original' } };
  let reads = 0;
  const db = {
    async query(sql: string): Promise<Row[]> {
      if (sql.includes('current_database()')) {
        return [{ database_name: safety.expectedDatabase, user_name: safety.expectedUser }];
      }
      reads++;
      return [row];
    },
  };
  await assert.rejects(assertNoMutation({
    db, tables, safety,
    action: async () => {
      row.status = 'after';
      row.metadata.nested = 'changed';
    },
  }), (error: unknown) => {
    assert.ok(error instanceof MutationBoundaryError);
    assert.deepEqual(error.counts, [{ table: 'tasks', inserted: 0, updated: 1, deleted: 0 }]);
    return true;
  });
  assert.equal(reads, 2);
});


test('canonical snapshot serializer visits each selected row once per snapshot', async () => {
  let prototypeChecks = 0;
  let readCount = 0;
  const source = { id: 1, payload: { state: 'old' } };
  const wrapped = new Proxy(source, {
    getPrototypeOf(target) {
      prototypeChecks++;
      return Reflect.getPrototypeOf(target);
    },
  });
  const db = {
    async query(sql: string): Promise<Row[]> {
      if (sql.includes('current_database()')) {
        return [{ database_name: safety.expectedDatabase, user_name: safety.expectedUser }];
      }
      readCount++;
      return [wrapped];
    },
  };
  await assert.rejects(assertNoMutation({
    db, tables, safety,
    action: async () => { source.payload.state = 'new'; },
  }), (error: unknown) => {
    assert.ok(error instanceof MutationBoundaryError);
    assert.equal(error.counts[0]?.updated, 1);
    return true;
  });
  assert.equal(readCount, 2);
  assert.equal(prototypeChecks, 6, 'one serializer pass causes three prototype checks per snapshot');
});


test('post-action aggregate snapshot limit propagates and releases pooled connection', async () => {
  const baseline = [{ id: 1, payload: 'small' }];
  const enlarged = Array.from({ length: 41 }, (_, i) => ({
    id: i + 1, payload: 'x'.repeat(850_000),
  }));
  let reads = 0;
  let releases = 0;
  let connects = 0;
  let actions = 0;
  const pool = {
    async connect() {
      connects++;
      return {
        async query(sql: string): Promise<Row[]> {
          if (sql.includes('current_database()')) {
            return [{ database_name: safety.expectedDatabase, user_name: safety.expectedUser }];
          }
          reads++;
          return reads === 1 ? baseline : enlarged;
        },
        release() { releases++; },
      };
    },
  };
  await assert.rejects(assertNoMutation({
    db: pool, tables, safety,
    action: async () => { actions++; },
  }), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /snapshot total size limit exceeded \(32 MiB\) in table tasks/);
    assert.doesNotMatch(error.message, /xxxxxx/);
    return true;
  });
  assert.equal(actions, 1);
  assert.equal(reads, 2);
  assert.equal(connects, 1);
  assert.equal(releases, 1);
});


test('aggregate snapshot budget is independently reset between baseline and after snapshots', async () => {
  const row = { id: 1, payload: 'p'.repeat(600_000) };
  let reads = 0;
  let actions = 0;
  const db = {
    async query(sql: string): Promise<Row[]> {
      if (sql.includes('current_database()')) return [{ database_name: safety.expectedDatabase, user_name: safety.expectedUser }];
      reads++;
      return [row];
    },
  };
  await assertNoMutation({
    db, tables, safety,
    action: async () => { actions++; },
  });
  assert.equal(reads, 2);
  assert.equal(actions, 1);
});

test('post-action snapshot budget rejection retains action error when cleanup itself fails', async () => {
  const largeRows = Array.from({ length: 41 }, (_, i) => ({
    id: i + 1, payload: 'v'.repeat(850_000),
  }));
  const releaseError = new Error('release broke');
  let reads = 0;
  let releases = 0;
  const pool = {
    async connect() {
      return {
        async query(sql: string): Promise<Row[]> {
          if (sql.includes('current_database()')) return [{ database_name: safety.expectedDatabase, user_name: safety.expectedUser }];
          reads++;
          return reads === 1 ? [{ id: 1, payload: 'initial' }] : largeRows;
        },
        release() { releases++; throw releaseError; },
      };
    },
  };
  await assert.rejects(assertNoMutation({
    db: pool, tables, safety,
    action: async () => { throw new Error('action failed before overlarge snapshot'); },
  }), (received: unknown) => {
    assert.equal(received, releaseError);
    assert.ok((received as Error & { cause?: unknown }).cause instanceof Error);
    assert.match(String((received as Error & { cause?: unknown }).cause), /snapshot total size limit exceeded/);
    assert.doesNotMatch(JSON.stringify(received), /initial|vvvvvv/);
    return true;
  });
  assert.equal(reads, 2);
  assert.equal(releases, 1);
});
