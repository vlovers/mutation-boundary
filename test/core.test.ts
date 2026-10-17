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
