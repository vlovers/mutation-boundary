# Tested integration matrix (v0.5 released; v0.6 in development)

MutationBoundary is a PostgreSQL **net-state** assertion intended only for disposable,
isolated, quiescent test databases. These are test observations, not universal
compatibility promises.

| Consumer / environment | Evidence | Limits |
| --- | --- | --- |
| Node.js 24 ESM, `pg.Client` and `pg.Pool`, PostgreSQL 16 | Library CI, integration tests and external packed-package consumer ([PR #40](https://github.com/vlovers/mutation-boundary/pull/40)) | `pg.Pool` snapshots pin one connection. Provide another connection for actions; `max: 1` can deadlock. |
| Node.js 24, TypeORM DataSource, NestJS application context | Disposable PostgreSQL CI, `test/typeorm-nestjs.test.mjs` | This is a thin adapter, not a NestJS module or repository plugin. |
| Real NestJS HTTP PATCH, TypeORM, PostgreSQL 16 | `test/nest-http.test.mjs`, [PR #41](https://github.com/vlovers/mutation-boundary/pull/41) | Representative failure injection. Not proof of every application endpoint or every transaction isolation level. |
| Jest 30 and Vitest 3 using ESM consumers | CI runner suites | Existing test runners use ESM-compatible configuration. |
| Estima Bun 1.3.2, Jest/ts-jest CommonJS test suite, NestJS HTTP, PostgreSQL 17 | [Estima PR #12](https://github.com/vlovers/estima/pull/12), [PostgreSQL CI](https://github.com/vlovers/estima/actions/runs/39513022289) and [Bun migration CI](https://github.com/vlovers/estima/actions/runs/39513022315) | Test-only dependency `mutation-boundary@0.4.0`. Estima uses a native dynamic ESM import because static import is transformed to CommonJS `require()` by its Jest setup. |
| Published npm v0.4.0 and packed ESM / TS consumer | Registry consumer smoke in CI and [PR #35](https://github.com/vlovers/mutation-boundary/pull/35) | Passing registry installation does not establish byte-for-byte source-to-tarball identity. |

## Adapter shape and connection identity

The current implementation treats an object with only `connect()` as a pool and pins the returned client for safety and both snapshots. For an object exposing both `query()` and `connect()`, it treats the object as a pool **only** if numeric `totalCount` and `idleCount` are also present, as in `pg.Pool`. Otherwise the direct `query()` interface is used. This protects query-first adapters such as TypeORM DataSource from accidental checkout, but a custom dual-interface pool **without** counters is not guaranteed to have snapshot connection affinity. Supply a pinned `pg.Client`, a supported `pg.Pool`, or a query adapter with an explicitly stable session. Do not infer pinning solely from a `connect` method.

This is a documented limitation, not a new public API or promise of compatibility with arbitrary custom pool shims.


## Cleanup error precedence (v0.6 unreleased main)

`assertNoMutation()` releases checked-out pool clients following verification. When `release()` throws, that error still takes precedence over a prior action or snapshot error.
This is now characterized by [PR #50](https://github.com/vlovers/mutation-boundary/pull/50).

On the unreleased main branch (PR #52), if the release error is an `Error` without an existing `cause`, the earlier failure is retained as a non-enumerable `cause`. A release failure can indicate a damaged connection or
an invalid custom adapter, so silently suppressing it would also be dangerous.

**Implemented in unreleased main, not yet shipped to npm:** Preserve the exact thrown cleanup error and its precedence, but attach the prior verification failure as a non-enumerable `cause` only when the cleanup error is an `Error` without its own cause. This retains `instanceof`/identity while improving diagnostics. Existing cleanup causes remain untouched. This is a narrowly scoped behavior addition, not a new public method. Logging exception chains may expose caller-owned details; do not publish unsanitized traces.

## Unsupported or not proven

- No production, shared-database, CDC, transaction tracing or comprehensive concurrency guarantees.
- No claim that MutationBoundary fixes Estima [issue #10](https://github.com/vlovers/estima/issues/10) (the clarification path can still require an application-level atomicity fix).
- No automatic Jest CommonJS `require()` interoperability guarantee. Use an ESM-compatible test environment or carefully verified native dynamic import where needed.
- No generic NestJS/TypeORM wrappers or support guarantee for other framework/database versions.
- Driver exceptions and callback errors can contain sensitive details; only library-generated mutation summaries are redacted.
- Unsupported exotic driver representations are rejected rather than silently equated, but the tested value matrix is not exhaustive.

## Release boundaries

Changes after the published 0.4.0 tag are **unreleased**. Do not use v0.5.0
installation instructions until an actual tagged release and npm publication
have completed. For the release process, see [RELEASING](RELEASING.md).

## Aggregate snapshot budget (unreleased main)

Per-value/collection and row-count checks are supplemented by a 32 MiB cap on retained canonical key+row string bytes **per snapshot across all selected tables** (PR #56). Both baseline and post-action snapshots enforce it; a post-action failure still releases pinned pool connections (PR #57). This is a change in accepted input size: tests that previously selected very large snapshots must narrow selection or projection. It does not bound driver query-result allocation, transient serializer memory, or peak process RSS. It is not a production OOM defense.


## Failure-path and cleanup evidence (unreleased v0.6 main)

The disposable PostgreSQL lifecycle regression suite covers a committed INSERT, UPDATE and DELETE, plus transaction rollback and a post-action row-cap failure. The library checks **net** changes to selected tables: a rolled-back transaction does not count as a persisted mutation. A committed mutation can take precedence over an action exception, and resulting `MutationBoundaryError` exposes aggregate counts, not row values. The snapshot connection should be released even when validation or a follow-up query fails; the pooled database remains reusable.

These are regression scenarios, **not** claims of automatic transaction management, protection against concurrent writers, detection of transient writes or control over PostgreSQL driver peak allocations.


## Custom query adapters and projection safety (unreleased v0.6)

When `excludeColumns` is used, MutationBoundary rejects accessor properties and symbol-keyed properties on returned row objects before constructing the selected projection. This avoids invoking untrusted getters while building snapshots, including getters on excluded fields, and prevents hidden unsupported values from silently bypassing validation. Plain data rows from `pg` remain supported. This is fail-closed behavior for custom adapters, not an ORM integration guarantee.

## PostgreSQL data-integrity regression matrix (unreleased v0.6)

Disposable PostgreSQL integration tests exercise JSONB object-field reordering versus nested value mutations, Unicode text transitions, bytea changes, NULL-to-text transitions, and composite-key identity changes. A change to a non-key column is an UPDATE, while replacing one component of a composite key is a DELETE plus INSERT in net-state diagnostics. These tests use real PostgreSQL; they are not a blanket assertion that every custom parser, extension type or transaction isolation mode is supported.

Mutation reports deliberately omit keys and row values. Snapshot selection remains bounded by the configured row limit and the internal 32 MiB retained-canonical-data limit; neither measure caps driver buffers or concurrent writers.
