# Architecture and v0.1 scope

MutationBoundary is a small, TypeORM-independent PostgreSQL test assertion library, not an ORM, migration tool or database auditor.

## Public contract

- `assertNoMutation(options)`: verify test DB identity, snapshot selected tables, await action, snapshot again, compare and throw a redacted summary if any net changes remain.
- `MutationBoundaryError`: table-level counts; no raw row keys or values.
- `MutationBoundarySafetyError`: fail-closed identity/confirmation errors.

## Possible future module boundaries

```text
src/
  index.ts          public exports only
  assert.ts         assertion orchestration and error precedence
  safety.ts         database identity verification
  snapshot.ts       bounded table reads and key validation
  diff.ts           stable canonical comparison
  identifiers.ts    SQL identifier validation
  types.ts          adapter and public options
test/
  core.test.ts      canonical comparison unit tests
  safety.test.ts    fail-closed and redaction tests
  postgres.test.ts  real PostgreSQL behavior
```

This is a *target* structure; avoid unnecessary refactors before CI and package validation.

The current implementation is primarily in `src/index.ts` and `src/safety.ts`; the tree above is a **proposed refactor**, not the current repository layout.

## Important decisions

1. Never run actions if safety verification or baseline snapshot fails.
2. No implicit `NODE_ENV` bypass. Exact database/user expectations plus an explicit test-only acknowledgement are required.
3. Only simple SQL identifiers in v0.1. No arbitrary SQL expressions, schema-qualified names or composite keys.
4. Snapshot size cap must fail closed, not truncate silently.
5. Compare net state only; avoid claiming transaction tracing, transient write detection, or full database coverage.
6. Avoid raw row data in public errors, logs, serialization and normal return values. Audit low-level functions before exposing them in the release.
7. The high-level assertion pins a pg.Pool client for the identity check and both snapshots; the action may use another connection. A single-connection pool may deadlock. Custom adapters must guarantee stable session identity.
8. Prefer no runtime dependencies; `pg` is a dev/test dependency.
9. Keep Estima integration as a separate consumer proof, not a dependency of the library.
