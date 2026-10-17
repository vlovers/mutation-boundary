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
