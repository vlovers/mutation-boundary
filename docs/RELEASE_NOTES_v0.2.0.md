# MutationBoundary v0.2.0 release notes

Released: [GitHub v0.2.0](https://github.com/vlovers/mutation-boundary/releases/tag/v0.2.0) · [npm](https://www.npmjs.com/package/mutation-boundary)

## Shipped capabilities

- Schema-qualified tables (`schema.table`) and composite keys.
- Parameterized single-column equality row filters, including SQL NULL equality.
- `includeColumns` or `excludeColumns` per table, never both. Row key columns are always compared.
- Limits on snapshot depth (64), scalar strings/bytes (1 MiB), collection entries (10,000), and requested per-table row cap (50,000).
- Fail-closed handling of unsupported object types, accessors, sparse arrays, and ambiguous date/binary representations.

## Upgrade example

```sh
npm install -D mutation-boundary@^0.2.0
```

```ts
import { assertNoMutation } from 'mutation-boundary';

await assertNoMutation({
  db: testDb,
  tables: [{
    name: 'public.tasks',
    key: ['tenant_id', 'id'],
    where: { column: 'tenant_id', equals: 'tenant-a' },
    excludeColumns: ['updated_at'],
  }],
  safety: {
    expectedDatabase: 'application_test',
    expectedUser: 'application_test_user',
    confirmDisposableTestDatabase: true,
  },
  action: async () => { /* run the operation under test */ },
});
```

The original `{ name: 'tasks', key: 'id' }` form remains supported.

## Scope and limitations

Requires Node.js 24+ and an isolated, disposable PostgreSQL test database. Only **surviving net changes** in selected tables/columns are detected. Concurrent writes, transient/rolled-back operations, external side effects, full memory/time budgets and custom driver representation semantics are not guaranteed. Errors from the underlying DB driver or user action can contain sensitive details even though `MutationBoundaryError` redacts row contents.

Release CI: [Publish to npm](https://github.com/vlovers/mutation-boundary/actions/runs/39109086862) and [Checks](https://github.com/vlovers/mutation-boundary/actions/runs/39109086883) completed successfully. See [CHANGELOG](../CHANGELOG.md) and [SAFETY](SAFETY.md).
