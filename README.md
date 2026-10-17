# MutationBoundary

**Detect unexpected PostgreSQL writes after an operation that should leave the database unchanged.**

[![CI](https://github.com/vlovers/mutation-boundary/actions/workflows/ci.yml/badge.svg)](https://github.com/vlovers/mutation-boundary/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> v0.1.0 release candidate (not yet published). The API remains experimental; use only isolated disposable test databases.

An HTTP endpoint returns 500, an authorization check rejects a request, or a background job fails. **Did any committed row changes survive?** MutationBoundary compares the net state of selected PostgreSQL tables before and after an awaited action and fails the test when unexpected INSERT, UPDATE or DELETE changes remain.

The initial real-world evaluation is [Estima issue #10](https://github.com/vlovers/estima/issues/10) and [draft PR #11](https://github.com/vlovers/estima/pull/11).

See [the real-world failed-request regression walkthrough](docs/EXAMPLE.md) for a before/after test pattern and redacted failure output.

## Why use it?

Ordinary assertions check the status code and expected fields. MutationBoundary checks a different invariant: **no selected database rows changed at all**. It can reveal partial writes in an otherwise failing request without requiring you to predict which column might have changed.

Use focused SQL assertions when only a few specific fields matter. MutationBoundary is useful when multiple related tables must remain untouched.

## Installation

```sh
npm install -D @vlovers/mutation-boundary
```

## Example

```ts
import { assertNoMutation } from '@vlovers/mutation-boundary';

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

## Project status

The package is **not published**. The current milestone is an unpublished v0.1.0 release candidate. Final CI, reproducible installation and publication approval are required before release.

For release preparation see [Release checklist](docs/RELEASING.md), [Architecture](docs/ARCHITECTURE.md), [Security policy](SECURITY.md), and [Contributing](CONTRIBUTING.md).

MIT licensed.
