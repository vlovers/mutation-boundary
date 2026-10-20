# MutationBoundary

**Detect unexpected PostgreSQL writes after an operation that should leave the database unchanged.**

[![CI](https://github.com/vlovers/mutation-boundary/actions/workflows/ci.yml/badge.svg)](https://github.com/vlovers/mutation-boundary/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![npm version](https://img.shields.io/npm/v/mutation-boundary.svg)](https://www.npmjs.com/package/mutation-boundary)

> **v0.3.0 published release** · [npm package](https://www.npmjs.com/package/mutation-boundary). The API remains experimental; use only isolated disposable test databases.

An HTTP endpoint returns 500, an authorization check rejects a request, or a background job fails. **Did any committed row changes survive?** MutationBoundary compares the net state of selected PostgreSQL tables before and after an awaited action and fails the test when unexpected INSERT, UPDATE or DELETE changes remain.

The initial real-world evaluation is [Estima issue #10](https://github.com/vlovers/estima/issues/10) and [draft PR #11](https://github.com/vlovers/estima/pull/11).

See [the real-world failed-request regression walkthrough](docs/EXAMPLE.md) for a before/after test pattern and redacted failure output.

## Why use it?

Ordinary assertions check the status code and expected fields. MutationBoundary checks a different invariant: **no selected database rows changed at all**. It can reveal partial writes in an otherwise failing request without requiring you to predict which column might have changed.

Use focused SQL assertions when only a few specific fields matter. MutationBoundary is useful when multiple related tables must remain untouched.

## Installation

```sh
npm install -D mutation-boundary@^0.3.0
```

## Example

```ts
import { assertNoMutation } from 'mutation-boundary';

await assertNoMutation({
  db: testDb, // a PostgreSQL pg Client/Pool or compatible query adapter
  tables: [
    { name: 'tasks', key: 'id' },
    { name: 'estimates', key: 'id' },
  ],
  safety: {
    expectedDatabase: 'application_test',
    expectedUser: 'application_test_user',
    confirmDisposableTestDatabase: true,
  },
  action: async () => {
    await request(app.getHttpServer())
      .patch('/api/tasks/123/clarify')
      .send(payload)
      .expect(500);
  },
});
```

An unexpected mutation throws `MutationBoundaryError`:

```text
Unexpected mutations after operation

tasks: 1 updated
estimates: no changes

Database mutation contract violated.
```

The high-level mutation report contains counts and table names, **not row values or keys**.

## Schema-qualified tables and composite keys (v0.2.0)

Use schema-qualified names and composite identifiers:

```ts
tables: [
  { name: 'tenant_data.memberships', key: ['tenant_id', 'member_id'] },
]
```

The existing `{ name: 'tasks', key: 'id' }` API remains valid. Names must consist of one or two simple SQL identifiers separated by a dot; columns must be unique and non-empty. Quoted/complex PostgreSQL identifiers are not supported. Composite keys are required to uniquely identify each row, and the library still checks **net state** only.

These capabilities are available in v0.2.0.

## Parameterized row filters (v0.2.0)

Optionally scope snapshots to rows matching one column by exact equality:

```ts
tables: [
  { name: 'public.tasks', key: 'id', where: { column: 'tenant_id', equals: 'tenant-a' } },
]
```

`equals: null` matches SQL NULL using `IS NOT DISTINCT FROM`. Filter values are sent as PostgreSQL bind parameters, not interpolated into SQL. Column and table identifiers are validated separately. Only one equality condition per table is supported in this increment; arbitrary SQL fragments, operators, and OR predicates are not accepted. The same filter is applied before and after the action. A row changing into or out of scope appears as an insertion or deletion within that selected subset.

Available in v0.2.0. Use isolated disposable PostgreSQL test databases.

## Column selection (v0.2.0)

Opt in to compare selected columns or exclude expected volatile values:

```ts
tables: [
  { name: 'public.tasks', key: 'id', excludeColumns: ['updated_at'] },
  { name: 'public.estimates', key: ['tenant_id', 'id'], includeColumns: ['status'] },
]
```

`includeColumns` selects the listed comparison columns **plus all row-key columns**. `excludeColumns` ignores named comparison columns but cannot exclude row keys. The two options are mutually exclusive. Unselected changes will not be detected; only use this when that behavior is intentional. The exclude path still fetches all table columns from PostgreSQL before dropping excluded fields in memory; do not use it to hide sensitive columns from the application process. Identifiers must be simple and safely quoted.

Available in v0.2.0.

For executable integration patterns and connection-lifecycle caveats, see [pg.Client and pg.Pool recipes](docs/PG_RECIPES.md).

## Machine-readable diagnostics (v0.4 development)

When unexpected net changes survive, `MutationBoundaryError` preserves its existing `counts`
property and exposes `toJSON()` for CI reporters. It returns only selected table
names and inserted/updated/deleted counts, never row keys or values.

```ts
import { MutationBoundaryError } from 'mutation-boundary';

try {
  await assertNoMutation(options);
} catch (error) {
  if (error instanceof MutationBoundaryError) {
    console.error(JSON.stringify(error.toJSON()));
  } else {
    throw error;
  }
}
```

The human-readable error message sorts tables by name and displays at most 20
table summaries. The `counts` property and JSON report retain all selected
tables in the original selection order for compatibility. JSON serialization
is safe for mutation errors generated by the library; arbitrary exceptions
from your application and database driver are not redacted. This feature is
under development and **not** part of published v0.3.0.

## Safety first

**Only use disposable, isolated, quiescent PostgreSQL test databases.** The explicit confirmation and database/user identity check help catch mistakes, but do **not** prove a database is disposable. Never reuse production credentials. See [Safety and limitations](docs/SAFETY.md).

When given a `pg.Pool`, the high-level assertion now checks out one client for the safety query and both snapshots, releasing it afterward. **The action runs while that client is checked out**: ensure the pool has enough free connections for the action (a `max: 1` pool can deadlock if the action queries the same pool). Prefer a dedicated `pg.Client` for test setups with temporary tables. Other custom query adapters must themselves guarantee stable connection identity. This guard does not prove the database is disposable. Raw snapshot helpers are internal and are not exported from the package. They still hold row values in process memory; use disposable test data only.

## What it detects

| Scenario | Detects? |
| --- | --- |
| Committed INSERT/UPDATE/DELETE in selected tables | Yes |
| JSONB or timestamp column changes | Yes |
| Action throws after a surviving write | Yes; mutation error takes precedence |
| Unchanged selected tables | Pass |
| Write then rollback, or write then restore original values | No; net-state only |
| Writes to unselected tables, sequences or external services | No |
| Concurrent writes / delayed background tasks | Not reliable |
| Large tables beyond configured row limit | Fails closed |

## Development

Requires Node.js 24+ and a disposable PostgreSQL instance for integration tests.

```sh
npm install
npm run typecheck
npm test
npm run build
npm pack --dry-run
```

The PostgreSQL integration suite requires `MUTATION_BOUNDARY_TEST_DATABASE_URL` pointing to a disposable database named `mutation_boundary_test` with session user `mutation_boundary_ci`:

```sh
npm run test:postgres
```

CI provisions its own PostgreSQL 16 service and executes both suites.

## Integration compatibility (v0.3.0)

The published v0.3.0 release includes tested Node 24 + PostgreSQL 16 integration consumers for TypeORM DataSource, NestJS application context, Jest and Vitest. See [integration evidence and limitations](docs/V030_INTEGRATIONS.md). The evidence is limited to the explicitly exercised configurations, not arbitrary framework adapters.

## Project status

**v0.3.0** has a successful GitHub tag publishing workflow and is listed in [GitHub Releases](https://github.com/vlovers/mutation-boundary/releases/tag/v0.3.0). Confirm npm registry artifact availability with the pinned external consumer smoke before relying on it. **v0.2.0** was previously published on [npm](https://www.npmjs.com/package/mutation-boundary) and [GitHub Releases](https://github.com/vlovers/mutation-boundary/releases/tag/v0.2.0). The API is not yet stable; use only isolated disposable PostgreSQL test databases.

For release process and verification history see [v0.2.0 release notes](docs/RELEASE_NOTES_v0.2.0.md) and [Release checklist](docs/RELEASING.md), [Architecture](docs/ARCHITECTURE.md), [Security policy](SECURITY.md), and [Contributing](CONTRIBUTING.md).

MIT licensed.
