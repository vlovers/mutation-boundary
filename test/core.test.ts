import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertNoMutation, MutationBoundaryError } from '../src/index.ts';

type Row = Record<string, unknown>;
const tables = [{ name: 'tasks', key: 'id' }];
const safety = {
  expectedDatabase: 'mutation_boundary_test',
  expectedUser: 'test_user',
  confirmDisposableTestDatabase: true as const,
};
function fakeDb(before: Row[], after: Row[]) {
  let reads = 0;
  return {
    async query(sql: string): Promise<Row[]> {
      if (sql.includes('current_database()')) return [{ database_name: 'mutation_boundary_test', user_name: 'test_user' }];
      return structuredClone(reads++ === 0 ? before : after);
    },
  };
}
async function expectMutation(before: Row[], after: Row[], kind: 'inserted' | 'updated' | 'deleted') {
  await assert.rejects(
    assertNoMutation({ db: fakeDb(before, after), tables, safety, action: async () => {} }),
    (error: unknown) => {
      assert.ok(error instanceof MutationBoundaryError);
      assert.equal(error.counts[0][kind], 1);
      return true;
    },
  );
}
test('inserted row', () => expectMutation([{ id: 1 }], [{ id: 1 }, { id: 2 }], 'inserted'));
test('deleted row', () => expectMutation([{ id: 1 }, { id: 2 }], [{ id: 1 }], 'deleted'));
test('updated row', () => expectMutation([{ id: 1, status: 'a' }], [{ id: 1, status: 'b' }], 'updated'));
test('JSON key ordering is ignored', async () => {
  await assertNoMutation({ db: fakeDb([{ id: 1, data: { a: 1, b: 2 } }], [{ id: 1, data: { b: 2, a: 1 } }]), tables, safety, action: async () => {} });
});
test('Date changes are detected', () => expectMutation([{ id: 1, at: new Date('2026-01-01') }], [{ id: 1, at: new Date('2026-01-02') }], 'updated'));
test('unsafe identifiers are rejected', async () => {
  await assert.rejects(assertNoMutation({ db: fakeDb([], []), tables: [{ name: 'tasks;drop', key: 'id' }], safety, action: async () => {} }), /unsafe SQL identifier/);
});
test('row caps fail closed', async () => {
  await assert.rejects(assertNoMutation({ db: fakeDb([{ id: 1 }, { id: 2 }], []), tables, safety, maxRowsPerTable: 1, action: async () => {} }), /row limit exceeded/);
});
test('action failure propagates', async () => {
  await assert.rejects(assertNoMutation({ db: fakeDb([], []), tables, safety, action: async () => { throw new Error('injected'); } }), /injected/);
});
test('pg QueryResult rows adapter works', () => expectMutation([{ id: 1, status: 'pending' }], [{ id: 1, status: 'done' }], 'updated'));

test('cyclic driver values fail closed instead of overflowing the stack', async () => {
  const cyclic: Row = { id: 1 };
  cyclic.self = cyclic;
  await assert.rejects(
    assertNoMutation({ db: fakeDb([cyclic], [cyclic]), tables, safety, action: async () => {} }),
    /cyclic snapshot value/,
  );
});

test('unsupported numeric and bigint driver values fail closed', async () => {
  for (const value of [Number.NaN, Infinity, -Infinity, 2n, undefined]) {
    let called = false;
    await assert.rejects(
      assertNoMutation({
        db: fakeDb([{ id: 1, amount: value }], [{ id: 1, amount: value }]),
        tables, safety, action: async () => { called = true; },
      }),
      /unsupported snapshot value/,
    );
    assert.equal(called, false);
  }
});

test('snapshot rejects excessively deep values before action', async () => {
  let nested: Row = { leaf: true };
  for (let i = 0; i < 70; i++) nested = { nested };
  let called = false;
  await assert.rejects(assertNoMutation({
    db: fakeDb([{ id: 1, nested }], [{ id: 1, nested }]),
    tables, safety, action: async () => { called = true; },
  }), /snapshot nesting limit exceeded/);
  assert.equal(called, false);
});

test('snapshot rejects oversized text and binary scalars before action', async () => {
  for (const payload of ['x'.repeat(1024 * 1024 + 1), Buffer.alloc(1024 * 1024 + 1)]) {
    let called = false;
    await assert.rejects(assertNoMutation({
      db: fakeDb([{ id: 1, payload }], [{ id: 1, payload }]),
      tables, safety, action: async () => { called = true; },
    }), /snapshot scalar size limit exceeded/);
    assert.equal(called, false);
  }
});

test('snapshot rejects oversized arrays and extreme row caps before action', async () => {
  let called = false;
  await assert.rejects(assertNoMutation({
    db: fakeDb([{ id: 1, payload: Array(10001).fill(1) }], [{ id: 1 }]),
    tables, safety, action: async () => { called = true; },
  }), /snapshot collection size limit exceeded/);
  assert.equal(called, false);
  await assert.rejects(assertNoMutation({
    db: fakeDb([], []), tables, safety, maxRowsPerTable: 50001,
    action: async () => { called = true; },
  }), /invalid snapshot limit/);
  assert.equal(called, false);
});

test('typed scalar transitions are not hidden by identical formatted text', async () => {
  const iso = '2026-01-01T00:00:00.000Z';
  await expectMutation([{ id: 1, value: new Date(iso) }], [{ id: 1, value: iso }], 'updated');
  await expectMutation([{ id: 1, value: Buffer.from([0, 255]) }], [{ id: 1, value: 'AP8=' }], 'updated');
  await expectMutation([{ id: 1, value: new Uint8Array([0, 255]) }], [{ id: 1, value: 'AP8=' }], 'updated');
});

test('typed Date and binary values with identical contents compare as unchanged', async () => {
  await assertNoMutation({
    db: fakeDb([{ id: 1, at: new Date('2026-01-01'), payload: Buffer.from([0, 255]) }],
      [{ id: 1, at: new Date('2026-01-01'), payload: new Uint8Array([0, 255]) }]),
    tables, safety, action: async () => {},
  });
});

test('unsupported Map Set and class values fail closed before running the action', async () => {
  class CustomValue { value = 1; }
  for (const payload of [new Map([['a', 1]]), new Set([1]), new CustomValue()]) {
    let executed = false;
    await assert.rejects(assertNoMutation({
      db: {
        async query(sql: string) {
          if (sql.includes('current_database()')) {
            return [{ database_name: 'mutation_boundary_test', user_name: 'test_user' }];
          }
          return [{ id: 1, payload }];
        },
      },
      tables, safety, action: async () => { executed = true; },
    }), /unsupported snapshot object type/);
    assert.equal(executed, false);
  }
});

test('sparse arrays and accessors fail closed without executing the action', async () => {
  const sparse = new Array(2); sparse[1] = 'visible';
  const accessor = { get hidden() { throw new Error('getter must never run'); } };
  for (const payload of [sparse, accessor]) {
    let executed = false;
    await assert.rejects(assertNoMutation({
      db: {
        async query(sql: string) {
          if (sql.includes('current_database()')) {
            return [{ database_name: 'mutation_boundary_test', user_name: 'test_user' }];
          }
          return [{ id: 1, payload }];
        },
      },
      tables, safety, action: async () => { executed = true; },
    }), /unsupported snapshot array|unsupported snapshot accessor/);
    assert.equal(executed, false);
  }
});


test('snapshot limit diagnostics identify the selected table without row values', async () => {
  const fixture = {
    async query(sql: string) {
      if (sql.includes('current_database()')) return [{ database_name: 'mutation_boundary_test', user_name: 'test_user' }];
      return [{ id: 1, secret: 'do-not-leak' }, { id: 2, secret: 'do-not-leak' }];
    },
  };
  let actionCalled = false;
  await assert.rejects(assertNoMutation({
    db: fixture, tables: [{ name: 'tasks', key: 'id' }],
    safety, maxRowsPerTable: 1,
    action: async () => { actionCalled = true; },
  }), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /snapshot row limit exceeded for table tasks \(limit 1\)/);
    assert.doesNotMatch(error.message, /do-not-leak/);
    return true;
  });
  assert.equal(actionCalled, false);
});

test('unsupported snapshot values report a table but never disclose contents', async () => {
  const fixture = {
    async query(sql: string) {
      if (sql.includes('current_database()')) return [{ database_name: 'mutation_boundary_test', user_name: 'test_user' }];
      return [{ id: 1, secret: { private: 'do-not-leak', invalid: undefined } }];
    },
  };
  let actionCalled = false;
  await assert.rejects(assertNoMutation({
    db: fixture, tables: [{ name: 'tasks', key: 'id' }], safety,
    action: async () => { actionCalled = true; },
  }), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /unsupported snapshot value in table tasks/);
    assert.doesNotMatch(error.message, /do-not-leak/);
    return true;
  });
  assert.equal(actionCalled, false);
});

test('machine-readable error reports contain only aggregate counts', async () => {
  const secret = 'sensitive-row-value-not-for-logs';
  await assert.rejects(assertNoMutation({
    db: fakeDb([{ id: 42, password: secret }], [{ id: 42, password: 'new-private-data' }]),
    tables, safety, action: async () => {},
  }), (error: unknown) => {
    assert.ok(error instanceof MutationBoundaryError);
    assert.deepEqual(error.toJSON(), {
      name: 'MutationBoundaryError',
      counts: [{ table: 'tasks', inserted: 0, updated: 1, deleted: 0 }],
    });
    assert.equal(error.counts[0]?.updated, 1, 'existing counts property is preserved');
    const json = JSON.stringify(error);
    assert.doesNotMatch(json, /sensitive-row|new-private|password|42/);
    assert.doesNotMatch(error.message, /sensitive-row|new-private|password|42/);
    return true;
  });
});

test('diagnostics are alphabetically deterministic while counts retain caller selection order', async () => {
  const selected = [
    { name: 'zebra', key: 'id' },
    { name: 'alpha', key: 'id' },
  ];
  const makeDb = () => {
    let index = 0;
    return {
      async query(sql: string) {
        if (sql.includes('current_database()')) return [{ database_name: 'mutation_boundary_test', user_name: 'test_user' }];
        // before snapshots of both tables, then after snapshots of both tables
        return index++ < 2 ? [] : [{ id: 1 }];
      },
    };
  };
  await assert.rejects(assertNoMutation({
    db: makeDb(), tables: selected, safety, action: async () => {},
  }), (error: unknown) => {
    assert.ok(error instanceof MutationBoundaryError);
    assert.deepEqual(error.counts.map(c => c.table), ['zebra', 'alpha']);
    assert.ok(error.message.indexOf('alpha:') < error.message.indexOf('zebra:'));
    return true;
  });
});

test('human diagnostic text is capped without losing structured counts', async () => {
  const selected = Array.from({ length: 30 }, (_, i) => ({
    name: 'table_' + String(i).padStart(2, '0'), key: 'id',
  }));
  let index = 0;
  const db = {
    async query(sql: string) {
      if (sql.includes('current_database()')) return [{ database_name: 'mutation_boundary_test', user_name: 'test_user' }];
      return index++ < selected.length ? [] : [{ id: 1, privateValue: 'secret-row' }];
    },
  };
  await assert.rejects(assertNoMutation({
    db, tables: selected, safety, action: async () => {},
  }), (error: unknown) => {
    assert.ok(error instanceof MutationBoundaryError);
    assert.equal(error.counts.length, 30);
    assert.equal(error.toJSON().counts.length, 30);
    assert.match(error.message, /and 10 more selected tables/);
    assert.doesNotMatch(error.message, /table_29:|secret-row/);
    assert.equal((error.message.match(/table_\\d{2}:/g) ?? []).length, 20);
    return true;
  });
});
