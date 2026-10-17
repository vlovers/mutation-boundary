/** Minimal adapter: works with pg Pool/Client, TypeORM DataSource and compatible clients. */
export type BoundaryRow = Record<string, unknown>;
export type BoundaryDatabase = { query(sql: string): Promise<BoundaryRow[] | { rows: BoundaryRow[] }> };
export type BoundaryPool = { connect(): Promise<BoundaryDatabase & { release(): void }> };

/**
 * Experimental snapshot-based failure boundary probe.
 * Disposable, quiescent PostgreSQL databases ONLY.
 * Detects net row changes, not transient writes or writes outside selected tables.
 */
export type RowChange = {
  table: string;
  key: string;
  kind: 'inserted' | 'deleted' | 'updated';
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
};

export type TableSpec = { name: string; key: string };
type Snapshot = Map<string, Map<string, Record<string, unknown>>>;
const identifier = (value: string) => {
  if (!/^[a-z_][a-z_0-9]*$/i.test(value)) {
    throw new Error('MutationBoundary: unsafe SQL identifier');
  }
  return '"' + value.replace(/"/g, '""') + '"';
};
const stable = (value: unknown): string => {
  if (Object.prototype.toString.call(value) === '[object Date]') return JSON.stringify(Date.prototype.toISOString.call(value));
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) return JSON.stringify(value.toString('base64'));
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, part]) => JSON.stringify(key) + ':' + stable(part)).join(',') + '}';
  }
  return JSON.stringify(value) ?? 'undefined';
};

export async function takeBoundarySnapshot(
  db: BoundaryDatabase,
  tables: readonly TableSpec[],
  maxRowsPerTable = 5000
): Promise<Snapshot> {
  if (!tables.length) throw new Error('MutationBoundary: select at least one table');
  if (!Number.isSafeInteger(maxRowsPerTable) || maxRowsPerTable < 1) throw new Error('MutationBoundary: invalid snapshot limit');
  const snapshot: Snapshot = new Map();
  const seenTables = new Set<string>();
  for (const table of tables) {
    if (seenTables.has(table.name)) throw new Error('MutationBoundary: duplicate table selection');
    seenTables.add(table.name);
    const name = identifier(table.name);
    const key = identifier(table.key);
    const result = await db.query(
      `SELECT * FROM ${name} ORDER BY ${key} LIMIT ${maxRowsPerTable + 1}`
    );
    const rows = Array.isArray(result) ? result : result.rows;
    if (!Array.isArray(rows)) throw new Error('MutationBoundary: unsupported query result');
    if (rows.length > maxRowsPerTable) throw new Error('MutationBoundary: snapshot row limit exceeded');
    const values = new Map<string, Record<string, unknown>>();
    for (const row of rows) {
      if (row[table.key] == null) throw new Error('MutationBoundary: missing row key');
      const id = stable(row[table.key]);
      if (values.has(id)) throw new Error('MutationBoundary: duplicate row key');
      values.set(id, row);
    }
    snapshot.set(table.name, values);
  }
  return snapshot;
}

export function diffBoundarySnapshots(before: Snapshot, after: Snapshot): RowChange[] {
  const changes: RowChange[] = [];
  for (const [table, oldRows] of before) {
    const newRows = after.get(table);
    if (!newRows) throw new Error('MutationBoundary: incomplete after snapshot');
    for (const [key, previous] of oldRows) {
      const current = newRows.get(key);
      if (!current) changes.push({ table, key, kind: 'deleted', before: previous });
      else if (stable(previous) !== stable(current)) changes.push({
        table, key, kind: 'updated', before: previous, after: current,
      });
    }
    for (const [key, current] of newRows) if (!oldRows.has(key)) {
      changes.push({ table, key, kind: 'inserted', after: current });
    }
  }
  return changes;
}

export async function observeFailureBoundary(
  db: BoundaryDatabase,
  tables: readonly TableSpec[],
  action: () => Promise<void>
): Promise<RowChange[]> {
  const before = await takeBoundarySnapshot(db, tables);
  let actionError: unknown;
  let actionFailed = false;
  try { await action(); } catch (error) { actionFailed = true; actionError = error; }
  const after = await takeBoundarySnapshot(db, tables);
  if (actionFailed) throw actionError;
  return diffBoundarySnapshots(before, after);
}

export { assertDisposableDatabase, MutationBoundarySafetyError } from './safety.ts';
export type { DatabaseSafety } from './safety.ts';
import { assertDisposableDatabase, type DatabaseSafety } from './safety.ts';

export type AssertNoMutationOptions = {
  db: BoundaryDatabase;
  tables: readonly TableSpec[];
  action: () => Promise<unknown>;
  safety: DatabaseSafety;
  maxRowsPerTable?: number;
};

export class MutationBoundaryError extends Error {
  readonly counts: ReadonlyArray<Readonly<{ table: string; inserted: number; updated: number; deleted: number }>>;
  constructor(changes: readonly RowChange[], tables: readonly TableSpec[]) {
    const counts = tables.map(({ name }) => ({
      table: name,
      inserted: changes.filter(c => c.table === name && c.kind === 'inserted').length,
      updated: changes.filter(c => c.table === name && c.kind === 'updated').length,
      deleted: changes.filter(c => c.table === name && c.kind === 'deleted').length,
    }));
    super('Unexpected mutations after operation\n\n' + counts.map(c =>
      c.table + ': ' + (c.inserted + c.updated + c.deleted === 0 ? 'no changes' :
        [c.inserted && c.inserted + ' inserted', c.updated && c.updated + ' updated', c.deleted && c.deleted + ' deleted'].filter(Boolean).join(', '))
    ).join('\n') + '\n\nDatabase mutation contract violated.');
    this.name = 'MutationBoundaryError';
    this.counts = counts;
  }
}

/** Safe high-level API: no row values or keys in errors or returned results. */
export async function assertNoMutation(options: AssertNoMutationOptions): Promise<void> {
  const { db, tables, action, safety, maxRowsPerTable = 5000 } = options;
  // Pool adapters are pinned for the complete verification/snapshot lifecycle.
  // The action may use a separate connection to commit its own changes.
  const client = 'connect' in db ? await db.connect() : db;
  try {
    await assertDisposableDatabase(client, safety);
    const before = await takeBoundarySnapshot(client, tables, maxRowsPerTable);
    let actionError: unknown;
    let actionFailed = false;
    try { await action(); } catch (error) { actionFailed = true; actionError = error; }
    const after = await takeBoundarySnapshot(client, tables, maxRowsPerTable);
    const changes = diffBoundarySnapshots(before, after);
    if (changes.length) throw new MutationBoundaryError(changes, tables);
    if (actionFailed) throw actionError;
  } finally {
    if ('connect' in db) client.release();
  }
}
