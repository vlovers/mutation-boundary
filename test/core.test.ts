import assert from 'node:assert/strict';
import { test } from 'node:test';
import { observeFailureBoundary, takeBoundarySnapshot } from '../src/index.ts';

const tables = [{ name: 'tasks', key: 'id' }];
type Row = Record<string, unknown>;
function fakeDb(before: Row[], after: Row[]) {
  let reads = 0;
  return {
    async query(_sql: string): Promise<Row[]> {
      return structuredClone(reads++ === 0 ? before : after);
    },
  };
}
test('inserted row', async () => {
  const changes = await observeFailureBoundary(fakeDb([{ id: 1 }], [{ id: 1 }, { id: 2 }]), tables, async () => {});
  assert.equal(changes.length, 1);
  assert.deepEqual({ table: changes[0].table, kind: changes[0].kind }, { table: 'tasks', kind: 'inserted' });
});
test('deleted row', async () => {
  const changes = await observeFailureBoundary(fakeDb([{ id: 1 }, { id: 2 }], [{ id: 1 }]), tables, async () => {});
  assert.equal(changes[0].kind, 'deleted');
});
test('updated row', async () => {
  const changes = await observeFailureBoundary(fakeDb([{ id: 1, status: 'a' }], [{ id: 1, status: 'b' }]), tables, async () => {});
  assert.equal(changes[0].kind, 'updated');
  assert.equal(changes[0].before?.status, 'a');
  assert.equal(changes[0].after?.status, 'b');
});
test('JSON key ordering is ignored', async () => {
  const changes = await observeFailureBoundary(fakeDb([{ id: 1, data: { a: 1, b: 2 } }], [{ id: 1, data: { b: 2, a: 1 } }]), tables, async () => {});
  assert.equal(changes.length, 0);
});
test('Date changes are detected', async () => {
  const changes = await observeFailureBoundary(fakeDb([{ id: 1, at: new Date('2026-01-01') }], [{ id: 1, at: new Date('2026-01-02') }]), tables, async () => {});
  assert.equal(changes.length, 1);
});
test('unsafe identifiers are rejected', async () => {
  await assert.rejects(() => takeBoundarySnapshot(fakeDb([], []), [{ name: 'tasks;drop', key: 'id' }]), /unsafe SQL identifier/);
});
test('row caps fail closed', async () => {
  await assert.rejects(() => takeBoundarySnapshot(fakeDb([{ id: 1 }, { id: 2 }], []), tables, 1), /row limit exceeded/);
});
test('action failure propagates rather than being mistaken for success', async () => {
  await assert.rejects(() => observeFailureBoundary(fakeDb([], []), tables, async () => { throw new Error('injected'); }), /injected/);
});
