import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertNoMutation, MutationBoundaryError, MutationBoundarySafetyError } from '../src/index.ts';

const safety = { expectedDatabase: 'mutation_boundary_test', expectedUser: 'test_user', confirmDisposableTestDatabase: true as const };
const tables = [{ name: 'tasks', key: 'id' }];
function db(before: Record<string, unknown>[], after: Record<string, unknown>[], database = 'mutation_boundary_test') {
  let reads = 0;
  return { async query(sql: string) {
    if (sql.includes('current_database()')) return [{ database_name: database, user_name: 'test_user' }];
    return structuredClone(reads++ === 0 ? before : after);
  } };
}
test('rejects unconfirmed environment before invoking action', async () => {
  let invoked = false;
  await assert.rejects(assertNoMutation({ db: db([], []), tables, safety: { ...safety, confirmDisposableTestDatabase: false as never }, action: async () => { invoked = true; } }), MutationBoundarySafetyError);
  assert.equal(invoked, false);
});
test('rejects mismatched database before invoking action', async () => {
  let invoked = false;
  await assert.rejects(assertNoMutation({ db: db([], [], 'production'), tables, safety, action: async () => { invoked = true; } }), MutationBoundarySafetyError);
  assert.equal(invoked, false);
});
test('reports changes without leaking values or row keys', async () => {
  await assert.rejects(assertNoMutation({
    db: db([{ id: 123, token: 'SECRET_BEFORE' }], [{ id: 123, token: 'SECRET_AFTER' }]),
    tables, safety, action: async () => {},
  }), (error: unknown) => {
    assert.ok(error instanceof MutationBoundaryError);
    assert.match(error.message, /1 updated/);
    assert.doesNotMatch(JSON.stringify(error), /SECRET_|123/);
    return true;
  });
});
test('detects mutation even when action throws', async () => {
  await assert.rejects(assertNoMutation({
    db: db([{ id: 1 }], [{ id: 1 }, { id: 2 }]),
    tables, safety, action: async () => { throw new Error('request failed'); },
  }), MutationBoundaryError);
});
test('passes on unchanged database', async () => {
  await assertNoMutation({ db: db([{ id: 1 }], [{ id: 1 }]), tables, safety, action: async () => {} });
});

test('does not mistake a thrown undefined for a successful action', async () => {
  await assert.rejects(
    assertNoMutation({
      db: db([], []), tables, safety,
      action: async () => { throw undefined; },
    }).then(() => { throw new Error('unexpected successful resolution'); }, error => {
      assert.equal(error, undefined);
      throw new Error('expected undefined rejection observed');
    }),
    /expected undefined rejection observed/,
  );
});
test('duplicate table selection fails before invoking action', async () => {
  let called = false;
  await assert.rejects(assertNoMutation({
    db: db([], []), tables: [...tables, ...tables], safety,
    action: async () => { called = true; },
  }), /duplicate table selection/);
  assert.equal(called, false);
});

test('pins a pool connection and releases it after verification', async () => {
  let connects = 0;
  let releases = 0;
  const client = { ...db([{ id: 1 }], [{ id: 1 }]), release() { releases++; } };
  const pool = { async connect() { connects++; return client; } };
  await assertNoMutation({ db: pool, tables, safety, action: async () => {} });
  assert.equal(connects, 1);
  assert.equal(releases, 1);
});
test('releases pinned pool connection when mutation assertion fails', async () => {
  let releases = 0;
  const client = { ...db([{ id: 1 }], [{ id: 1 }, { id: 2 }]), release() { releases++; } };
  await assert.rejects(assertNoMutation({
    db: { async connect() { return client; } }, tables, safety, action: async () => {},
  }), MutationBoundaryError);
  assert.equal(releases, 1);
});

test('pg-like Pool with query method still pins a client', async () => {
  let releases = 0;
  let acquisitions = 0;
  const client = { ...db([{ id: 1 }], [{ id: 1 }]), release() { releases++; } };
  const pool = {
    totalCount: 1, idleCount: 1,
    async query(_sql: string) { throw new Error('pool.query must not be used for snapshots'); },
    async connect() { acquisitions++; return client; },
  };
  await assertNoMutation({ db: pool, tables, safety, action: async () => {} });
  assert.equal(acquisitions, 1);
  assert.equal(releases, 1);
});

test('pg-like Client with connect and query is not connected twice', async () => {
  let connects = 0;
  const client = {
    ...db([{ id: 1 }], [{ id: 1 }]),
    async connect() { connects++; },
  };
  await assertNoMutation({ db: client, tables, safety, action: async () => {} });
  assert.equal(connects, 0);
});

test('rejects empty table selection before invoking action', async () => {
  let invoked = false;
  await assert.rejects(assertNoMutation({
    db: db([], []), tables: [], safety,
    action: async () => { invoked = true; },
  }), /select at least one table/);
  assert.equal(invoked, false);
});

test('rejects invalid snapshot limit before invoking action', async () => {
  let invoked = false;
  await assert.rejects(assertNoMutation({
    db: db([], []), tables, safety, maxRowsPerTable: 0,
    action: async () => { invoked = true; },
  }), /invalid snapshot limit/);
  assert.equal(invoked, false);
});

test('releases pinned pool connection when safety verification fails', async () => {
  let releases = 0;
  let invoked = false;
  const client = { ...db([], [], 'production'), release() { releases++; } };
  await assert.rejects(assertNoMutation({
    db: { async connect() { return client; } }, tables, safety,
    action: async () => { invoked = true; },
  }), MutationBoundarySafetyError);
  assert.equal(invoked, false);
  assert.equal(releases, 1);
});

test('pool releases pinned client when the action throws', async () => {
  let releases = 0;
  const client = { ...db([{ id: 1 }], [{ id: 1 }]), release() { releases++; } };
  await assert.rejects(assertNoMutation({
    db: { async connect() { return client; } }, tables, safety,
    action: async () => { throw new Error('application failure'); },
  }), /application failure/);
  assert.equal(releases, 1);
});

test('pool releases pinned client when the after snapshot fails', async () => {
  let releases = 0;
  let reads = 0;
  const client = {
    async query(sql: string) {
      if (sql.includes('current_database()')) return [{ database_name: 'mutation_boundary_test', user_name: 'test_user' }];
      if (++reads === 2) throw new Error('after snapshot failed');
      return [{ id: 1 }];
    },
    release() { releases++; },
  };
  await assert.rejects(assertNoMutation({
    db: { async connect() { return client; } }, tables, safety,
    action: async () => {},
  }), /after snapshot failed/);
  assert.equal(releases, 1);
});

test('composite keys reject empty and repeated columns before executing action', async () => {
  for (const key of [[], ['id', 'id'], ['id', 'bad;column']]) {
    let executed = false;
    await assert.rejects(assertNoMutation({
      db: db([], []), tables: [{ name: 'tasks', key }],
      safety, action: async () => { executed = true; },
    }), /invalid row key|unsafe SQL identifier/);
    assert.equal(executed, false);
  }
});

test('schema-qualified name rejects extra dot or unsafe component', async () => {
  for (const name of ['one.two.three', 'public.tasks;drop', '.tasks']) {
    let executed = false;
    await assert.rejects(assertNoMutation({
      db: db([], []), tables: [{ name, key: 'id' }],
      safety, action: async () => { executed = true; },
    }), /invalid schema-qualified table|unsafe SQL identifier/);
    assert.equal(executed, false);
  }
});

test('row filters reject injection in column names before action', async () => {
  let called = false;
  await assert.rejects(assertNoMutation({
    db: db([], []),
    tables: [{ name: 'tasks', key: 'id', where: { column: 'tenant_id; DROP TABLE tasks', equals: 'other' } }],
    safety,
    action: async () => { called = true; },
  }), /unsafe SQL identifier/);
  assert.equal(called, false);
});

test('row filter forwards user text only as a query parameter', async () => {
  const injection = "' OR true --";
  let seenSQL = '';
  let seenValues: readonly unknown[] | undefined;
  let executed = false;
  const adapter = {
    async query(sql: string, values?: readonly unknown[]) {
      if (sql.includes('current_database()')) return [{ database_name: 'mutation_boundary_test', user_name: 'test_user' }];
      seenSQL = sql; seenValues = values;
      return [];
    },
  };
  await assertNoMutation({
    db: adapter, tables: [{ name: 'tasks', key: 'id', where: { column: 'tenant_id', equals: injection } }],
    safety, action: async () => { executed = true; },
  });
  assert.equal(executed, true);
  assert.doesNotMatch(seenSQL, /OR true/);
  assert.ok(seenSQL.includes('IS NOT DISTINCT FROM $1'));
  assert.deepEqual(seenValues, [injection]);
});

test('row filters reject unsupported values before action', async () => {
  for (const value of [Number.NaN, Infinity, undefined, { nested: 1 }]) {
    let called = false;
    await assert.rejects(assertNoMutation({
      db: db([], []),
      tables: [{ name: 'tasks', key: 'id', where: { column: 'tenant_id', equals: value as never } }],
      safety, action: async () => { called = true; },
    }), /invalid row filter/);
    assert.equal(called, false);
  }
});

test('column selection rejects unsafe, conflicting and key-excluding specifications', async () => {
  const cases = [
    { name: 'tasks', key: 'id', includeColumns: [] },
    { name: 'tasks', key: 'id', includeColumns: ['status', 'status'] },
    { name: 'tasks', key: 'id', excludeColumns: ['id'] },
    { name: 'tasks', key: 'id', excludeColumns: ['status;DROP'] },
    { name: 'tasks', key: 'id', includeColumns: ['status'], excludeColumns: ['timestamp'] },
  ];
  for (const table of cases) {
    let called = false;
    await assert.rejects(assertNoMutation({
      db: db([], []), tables: [table], safety, action: async () => { called = true; },
    }), /column selection|key columns|unsafe SQL identifier/);
    assert.equal(called, false);
  }
});
