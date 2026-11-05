# MutationBoundary safety notes (v0.6.0 released; next changes unreleased)

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
- Row keys must be unique and non-null. Simple identifier names support optionally schema-qualified tables (`schema.table`); arbitrary SQL identifiers and expressions are unsupported.
- Action errors are rethrown if no mutation is detected. If mutations are detected, the mutation contract error takes precedence.
- v0.6.0 was published through npm Trusted Publishing; continue verifying PostgreSQL CI, package contents, connection safety and clean external installation for subsequent releases.
- Since v0.1.1, unsupported driver values (undefined, non-finite numbers, bigint, functions and symbols) and cyclic structures fail closed rather than silently comparing ambiguous snapshots. This is not a guarantee that every custom driver representation is handled.

## v0.2: bounded snapshot representations

v0.2.0 rejects snapshot nesting deeper than 64 levels, individual text/binary scalars above 1 MiB, arrays/objects with more than 10,000 entries, and a requested row cap above 50,000. These limits may reject legitimate large test fixtures and are intentionally fail-closed before the action for initial snapshots. Since v0.6.0 there is also a 32 MiB retained canonical-data limit per snapshot across selected tables. Neither that limit nor the per-value bounds caps driver allocations, peak process RSS or execution time; even a small table selection can temporarily consume more memory. Use small isolated fixtures and enforce CI process limits separately. No constraint guarantees stability for concurrent writes.

## v0.2: snapshot value types

Snapshot comparisons retain type distinctions between text, JavaScript dates, and binary values. A date with the same ISO text as a string and a byte buffer whose Base64 text matches a string must not compare equal. `Buffer` and `Uint8Array` containing the same bytes are treated as equivalent binary values. Custom driver value representations still require compatibility tests; do not assume every exotic class is supported.

## Unreleased canonical snapshot safety checks

The next snapshot-integrity update validates nested array indices and descriptors without executing custom index getters, rejects symbol keys and unsafe accessors, and avoids calling adapter-overridden array/binary methods. Row keys must be own enumerable data properties rather than inherited or non-enumerable values. It also uses a brand check for genuine Date objects instead of invoking `Symbol.toStringTag`. These changes are **not yet published**; the last released npm version is v0.6.0. Normal dense JSONB arrays, Date and binary values remain supported. Never assume arbitrary custom adapter objects are safe or universally supported.
