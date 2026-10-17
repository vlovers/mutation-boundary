# MutationBoundary v0.1 safety notes (experimental)

MutationBoundary is a PostgreSQL net-state assertion tool for **disposable, isolated test databases only**. It compares snapshots of selected tables before and after an action. It cannot detect writes that were reverted before the second snapshot, mutations in unselected tables, or changes outside PostgreSQL.

## Safe high-level usage

```ts
import { assertNoMutation } from 'mutation-boundary';

await assertNoMutation({
  db: dedicatedTestConnection,
  tables: [{ name: 'tasks', key: 'id' }],
  safety: {
    expectedDatabase: 'application_test',
    expectedUser: 'application_test_user',
    confirmDisposableTestDatabase: true,
  },
  action: async () => {
    // Run an HTTP request expected to fail.
  },
});
```

The confirmation flag and identity checks are **guardrails, not proof of isolation**. A production database can be misnamed. Always provision a disposable database and restricted credentials separately. Never reuse production credentials. The guard checks database name and session user. For supported pg.Pool instances, the assertion checks out one connection for the identity query and both snapshots, and releases it in a finally block. Other custom adapters must guarantee stable connection identity themselves. The action may require a second pool connection; a pool limited to one connection can deadlock.

By default `assertNoMutation` reports only table names and counts. It never includes row keys or before/after column values in its own mutation error. However, SQL-driver errors and exceptions thrown by user actions may include sensitive details; sanitize them in your own logging pipeline.

Raw snapshot and diff helpers are internal implementation details, not public package exports. The supported assertion is `assertNoMutation`; its errors include table names and mutation counts but no row contents. Do not log sensitive database driver errors or action exceptions.

## Limitations and release gates

- No guarantee of consistency under concurrent writes; use a quiescent isolated test DB.
- Snapshot size is capped; exceeding the cap fails the assertion rather than passing.
- Row keys must be unique, non-null, and SQL identifiers must be simple unqualified names.
- Action errors are rethrown if no mutation is detected. If mutations are detected, the mutation contract error takes precedence.
- Do not publish to npm until PostgreSQL CI passes, low-level APIs are secured or removed, connection-pinning behavior is documented and tested, and a clean external installation succeeds.
