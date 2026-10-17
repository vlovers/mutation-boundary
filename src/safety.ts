import type { BoundaryDatabase, BoundaryRow } from './index.ts';

export type DatabaseSafety = {
  /** Exact database name that must be returned by PostgreSQL. */
  expectedDatabase: string;
  /** Exact session role; strongly recommended for isolated CI databases. */
  expectedUser: string;
  /** Explicit opt-in, not inferred from NODE_ENV. */
  confirmDisposableTestDatabase: true;
};

export class MutationBoundarySafetyError extends Error {
  constructor(message: string) {
    super('MutationBoundary safety check failed: ' + message);
    this.name = 'MutationBoundarySafetyError';
  }
}

function rows(result: BoundaryRow[] | { rows: BoundaryRow[] }): BoundaryRow[] {
  const value = Array.isArray(result) ? result : result?.rows;
  if (!Array.isArray(value)) throw new MutationBoundarySafetyError('invalid database response');
  return value;
}

/**
 * Fail closed before reading application tables or invoking an action.
 * This is a guardrail, NOT proof that a database is disposable.
 * Never point this library at production or a shared environment.
 */
export async function assertDisposableDatabase(
  db: BoundaryDatabase,
  safety: DatabaseSafety,
): Promise<void> {
  if (safety?.confirmDisposableTestDatabase !== true) {
    throw new MutationBoundarySafetyError('explicit disposable database confirmation required');
  }
  if (!safety.expectedDatabase?.trim() || !safety.expectedUser?.trim()) {
    throw new MutationBoundarySafetyError('expected database and user are required');
  }
  if (!/(^|[_-])(test|testing|ci)([_-]|$)/i.test(safety.expectedDatabase)) {
    throw new MutationBoundarySafetyError('database name must contain a test/ci marker');
  }
  let actual: BoundaryRow[];
  try {
    actual = rows(await db.query(
      'SELECT current_database() AS database_name, session_user AS user_name'
    ));
  } catch {
    throw new MutationBoundarySafetyError('could not verify database identity');
  }
  if (actual.length !== 1 ||
      typeof actual[0]?.database_name !== 'string' ||
      typeof actual[0]?.user_name !== 'string') {
    throw new MutationBoundarySafetyError('database identity is unknown');
  }
  if (actual[0].database_name !== safety.expectedDatabase ||
      actual[0].user_name !== safety.expectedUser) {
    throw new MutationBoundarySafetyError('database identity does not match expected test connection');
  }
}
