/** Minimal adapter: works with pg Pool/Client, TypeORM DataSource and compatible clients. */
export type BoundaryRow = Record<string, unknown>;
export type BoundaryDatabase = { query(sql: string, values?: readonly unknown[]): Promise<BoundaryRow[] | { rows: BoundaryRow[] }> };
export type BoundaryPool = { connect(): Promise<BoundaryDatabase & { release(): void }> };

/**
 * Experimental snapshot-based failure boundary probe.
 * Disposable, quiescent PostgreSQL databases ONLY.
 * Detects net row changes, not transient writes or writes outside selected tables.
 */
type RowChange = {
  table: string;
  key: string;
  kind: 'inserted' | 'deleted' | 'updated';
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
};

export type TableSpec = { name: string; key: string | readonly string[]; where?: { column: string; equals: string | number | boolean | null }; includeColumns?: readonly string[]; excludeColumns?: readonly string[] };
type Snapshot = Map<string, Map<string, Record<string, unknown>>>;
const identifier = (value: string) => {
  if (!/^[a-z_][a-z_0-9]*$/i.test(value)) {
    throw new Error('MutationBoundary: unsafe SQL identifier');
  }
  return '"' + value.replace(/"/g, '""') + '"';
};
const tableIdentifier = (name: string): string => {
  const parts = name.split('.');
  if (parts.length < 1 || parts.length > 2) {
    throw new Error('MutationBoundary: invalid schema-qualified table');
  }
  return parts.map(identifier).join('.');
};
const keyColumns = (key: TableSpec['key']): readonly string[] => {
  const columns = typeof key === 'string' ? [key] : key;
  if (!Array.isArray(columns) || columns.length === 0 ||
      new Set(columns).size !== columns.length) {
    throw new Error('MutationBoundary: invalid row key');
  }
  for (const column of columns) identifier(column);
  return columns;
};
const stable = (value: unknown): string => {
  const active = new WeakSet<object>();
  const encode = (part: unknown, depth = 0): string => {
    if (depth > 64) throw new Error('MutationBoundary: snapshot nesting limit exceeded');
    if (typeof part === 'string' && Buffer.byteLength(part, 'utf8') > 1024 * 1024) {
      throw new Error('MutationBoundary: snapshot scalar size limit exceeded');
    }
    // PostgreSQL drivers may be customized. Reject values whose snapshot
    // representation is ambiguous instead of reporting a false no-op.
    if (part === undefined || typeof part === 'function' || typeof part === 'symbol' ||
        typeof part === 'bigint' || (typeof part === 'number' && !Number.isFinite(part))) {
      throw new Error('MutationBoundary: unsupported snapshot value');
    }
    if (part === null || typeof part !== 'object') return JSON.stringify(part);
    if (active.has(part)) throw new Error('MutationBoundary: cyclic snapshot value');
    active.add(part);
    try {
      if (Object.prototype.toString.call(part) === '[object Date]') {
        const date = Date.prototype.toISOString.call(part);
        return 'D' + JSON.stringify(date);
      }
      if (typeof Buffer !== 'undefined' && Buffer.isBuffer(part)) {
        if (part.byteLength > 1024 * 1024) throw new Error('MutationBoundary: snapshot scalar size limit exceeded');
        return 'B' + JSON.stringify(part.toString('base64'));
      }
      if (part instanceof Uint8Array) {
        if (part.byteLength > 1024 * 1024) throw new Error('MutationBoundary: snapshot scalar size limit exceeded');
        return 'B' + JSON.stringify(Buffer.from(part).toString('base64'));
      }
      if (Array.isArray(part)) {
        if (part.length > 10000) throw new Error('MutationBoundary: snapshot collection size limit exceeded');
        if (Object.keys(part).length !== part.length) {
          throw new Error('MutationBoundary: unsupported snapshot array');
        }
        return '[' + part.map(item => encode(item, depth + 1)).join(',') + ']';
      }
      const prototype = Object.getPrototypeOf(part);
      if (prototype !== Object.prototype && prototype !== null) {
        throw new Error('MutationBoundary: unsupported snapshot object type');
      }
      if (Object.getOwnPropertySymbols(part).length) {
        throw new Error('MutationBoundary: unsupported snapshot symbol keys');
      }
      const descriptors = Object.getOwnPropertyDescriptors(part);
      if (Object.values(descriptors).some(descriptor => !('value' in descriptor))) {
        throw new Error('MutationBoundary: unsupported snapshot accessor');
      }
      const entries = Object.entries(part);
      if (entries.length > 10000) throw new Error('MutationBoundary: snapshot collection size limit exceeded');
      return '{' + entries.sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => JSON.stringify(key) + ':' + encode(item, depth + 1)).join(',') + '}';
    } finally {
      active.delete(part);
    }
  };
  return encode(value);
};

async function takeBoundarySnapshot(
  db: BoundaryDatabase,
  tables: readonly TableSpec[],
  maxRowsPerTable = 5000
): Promise<Snapshot> {
  if (!tables.length) throw new Error('MutationBoundary: select at least one table');
  if (!Number.isSafeInteger(maxRowsPerTable) || maxRowsPerTable < 1 || maxRowsPerTable > 50000) throw new Error('MutationBoundary: invalid snapshot limit');
  const snapshot: Snapshot = new Map();
  const seenTables = new Set<string>();
  for (const table of tables) {
    if (seenTables.has(table.name)) throw new Error('MutationBoundary: duplicate table selection');
    seenTables.add(table.name);
    const name = tableIdentifier(table.name);
    const columns = keyColumns(table.key);
    const order = columns.map(identifier).join(', ');
    const filter = table.where;
    if (filter && (!filter.column || !['string', 'number', 'boolean'].includes(typeof filter.equals) && filter.equals !== null)) {
      throw new Error('MutationBoundary: invalid row filter');
    }
    if (filter && typeof filter.equals === 'number' && !Number.isFinite(filter.equals)) {
      throw new Error('MutationBoundary: invalid row filter');
    }
    const included = table.includeColumns;
    const excluded = table.excludeColumns;
    if (included !== undefined && excluded !== undefined) {
      throw new Error('MutationBoundary: choose includeColumns or excludeColumns');
    }
    const selected = included ?? excluded;
    if (selected !== undefined && (!Array.isArray(selected) || selected.length === 0 ||
        new Set(selected).size !== selected.length)) {
      throw new Error('MutationBoundary: invalid column selection');
    }
    for (const column of selected ?? []) identifier(column);
    if (excluded?.some(column => columns.includes(column))) {
      throw new Error('MutationBoundary: cannot exclude key columns');
    }
    const projection = included
      ? [...new Set([...columns, ...included])].map(identifier).join(', ')
      : '*';
    const whereClause = filter ? ` WHERE ${identifier(filter.column)} IS NOT DISTINCT FROM $1` : '';
    const result = await db.query(
      `SELECT ${projection} FROM ${name}${whereClause} ORDER BY ${order} LIMIT ${maxRowsPerTable + 1}`,
      filter ? [filter.equals] : undefined,
    );
    const rows = Array.isArray(result) ? result : result.rows;
    if (!Array.isArray(rows)) throw new Error('MutationBoundary: unsupported query result');
    if (rows.length > maxRowsPerTable) throw new Error('MutationBoundary: snapshot row limit exceeded');
    const values = new Map<string, Record<string, unknown>>();
    for (const row of rows) {
      // Validate the full driver value before invoking the action.
      // Otherwise unsupported data could be discovered only after writes.
      const comparisonRow = excluded
        ? Object.fromEntries(Object.entries(row).filter(([column]) => !excluded.includes(column)))
        : row;
      stable(comparisonRow);
      const parts = columns.map(column => row[column]);
      if (parts.some(part => part == null)) throw new Error('MutationBoundary: missing row key');
      const id = stable(parts);
      if (values.has(id)) throw new Error('MutationBoundary: duplicate row key');
      values.set(id, comparisonRow);
    }
    snapshot.set(table.name, values);
  }
  return snapshot;
}

function diffBoundarySnapshots(before: Snapshot, after: Snapshot): RowChange[] {
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

export { assertDisposableDatabase, MutationBoundarySafetyError } from './safety.ts';
export type { DatabaseSafety } from './safety.ts';
import { assertDisposableDatabase, type DatabaseSafety } from './safety.ts';

export type AssertNoMutationOptions = {
  db: BoundaryDatabase | BoundaryPool;
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
  const isPool = (value: BoundaryDatabase | BoundaryPool): value is BoundaryPool => 
    'connect' in value && typeof value.connect === 'function' && (
      !('query' in value && typeof value.query === 'function') ||
      ('totalCount' in value && typeof value.totalCount === 'number' &&
       'idleCount' in value && typeof value.idleCount === 'number')
    ); 
  const pool = isPool(db) ? db : undefined; 
  const client = pool ? await pool.connect() : db as BoundaryDatabase;
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
    if (pool) (client as BoundaryDatabase & { release(): void }).release();
  }
}
