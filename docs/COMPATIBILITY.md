# Tested integration matrix (v0.5 development)

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


## Cleanup error precedence (v0.6 evaluation)

`assertNoMutation()` currently runs `release()` in a `finally` block for a checked-out pool client.
If `release()` itself throws, its error replaces a prior action or snapshot error.
This is now characterized by [PR #50](https://github.com/vlovers/mutation-boundary/pull/50).

Do **not** assume both exceptions will be returned, or that the earlier exception is
available through `cause`. A release failure can indicate a damaged connection or
an invalid custom adapter, so silently suppressing it would also be dangerous.

**Compatibility decision pending:** Changing the thrown error to `AggregateError`,
attaching `cause`, or prioritizing the action error would alter observable behavior
for consumers. A future fix should use executable consumer regression tests first
and explicitly specify precedence when both mutation detection and cleanup fail.
No v0.6 runtime API change is implied by this note.

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
