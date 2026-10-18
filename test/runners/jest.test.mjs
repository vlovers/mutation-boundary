import { test, expect } from '@jest/globals';
import { assertNoMutation, MutationBoundaryError } from '../../dist/index.js';

const safety = {
  expectedDatabase: 'mutation_boundary_test',
  expectedUser: 'mutation_boundary_ci',
  confirmDisposableTestDatabase: true,
};

function fixture() {
  const rows = [{ id: 1, state: 'unchanged' }];
  const db = {
    async query(sql) {
      if (sql.includes('current_database()')) return [{ database_name: 'mutation_boundary_test', user_name: 'mutation_boundary_ci' }];
      return rows.map(row => ({ ...row }));
    },
  };
  return { db, rows };
}

test('async assertion passes when the selected row is unchanged', async () => {
  const { db } = fixture();
  await expect(assertNoMutation({
    db, tables: [{ name: 'tasks', key: 'id' }], safety,
    action: async () => {},
  })).resolves.toBeUndefined();
});

test('async assertion rejects with sanitized counts after a surviving mutation', async () => {
  const { db, rows } = fixture();
  try {
    await assertNoMutation({
      db, tables: [{ name: 'tasks', key: 'id' }], safety,
      action: async () => { rows[0].state = 'private-value'; },
    });
    throw new Error('expected mutation assertion to fail');
  } catch (error) {
    expect(error).toBeInstanceOf(MutationBoundaryError);
    expect(error.counts[0].updated).toBe(1);
    expect(error.message).not.toContain('private-value');
  }
});

test('async callback failures propagate on unchanged snapshots', async () => {
  const { db } = fixture();
  await expect(assertNoMutation({
    db, tables: [{ name: 'tasks', key: 'id' }], safety,
    action: async () => { throw new Error('operation rejected'); },
  })).rejects.toThrow('operation rejected');
});
