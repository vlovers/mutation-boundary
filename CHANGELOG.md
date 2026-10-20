# Changelog

## 0.5.0 — adoption verification (published 2026-10-21)

- Verify published v0.4.0 through an independently installed packed-tarball ESM consumer using real disposable PostgreSQL (PR #40).
- Add real NestJS HTTP + TypeORM regressions for a failed operation that leaves a write versus one rolled back (PR #41).
- Confirm package adoption in the Estima HTTP integration suite using Bun and Jest/ts-jest; native dynamic import is needed for the ESM package in Estima's CommonJS Jest tests (Estima PR #12).
- Add adapter-shape unit regressions for pg.Pool and compatible query interfaces (PR #45).
- Document scope, remaining clarification atomicity issue #10, and supported consumer configurations.

**Compatibility:** No MutationBoundary public runtime API changes in this section. [GitHub release](https://github.com/vlovers/mutation-boundary/releases/tag/v0.5.0); tagged npm Trusted Publishing and release CI completed successfully.


## 0.4.0 — diagnostics and reliability (published 2026-10-21)

- Preserve `MutationBoundaryError.counts` and add JSON-safe `toJSON()` / typed `MutationBoundaryReport` for CI diagnostics.
- Sort human-readable table diagnostics deterministically and cap display at 20 tables; full aggregate counts remain available.
- Add disposable PostgreSQL transaction, savepoint, pooling, failure-path and cleanup regressions.
- Validate the new diagnostics contract in a clean external ESM and TypeScript tarball consumer.

**Release:** [GitHub v0.4.0](https://github.com/vlovers/mutation-boundary/releases/tag/v0.4.0). The tagged publish workflow succeeded, including npm Trusted Publishing with provenance. The subsequently verified registry consumer installs `mutation-boundary@0.4.0` in CI.


## 0.3.0 — integration ergonomics

- Add PostgreSQL pg.Client and pg.Pool usage recipes and a real single-connection pool timeout/recovery regression.
- Verify TypeORM DataSource and NestJS application-context services against disposable PostgreSQL 16 in CI.
- Verify ESM consumer usage with Jest 30 and Vitest 3; no framework-specific runtime wrappers.
- Improve snapshot validation diagnostics with selected table context while preserving row-value redaction.
- Add integration support matrix and release gates; unify CI dependency installation to avoid no-save package pruning.

**Compatibility:** The existing assertion API and disposable-database guardrails remain unchanged. NestJS verification is limited to application context, not HTTP or @nestjs/typeorm. Requires Node.js 24+. Published v0.3.0 requires successful tag CI and npm publish verification.

All notable changes will be documented here.

## 0.2.0 — scoped snapshots (published 2026-10-18)

- Add safely quoted schema-qualified PostgreSQL table names and composite row identifiers.
- Add opt-in, parameterized single-column equality row filters, including NULL matching.
- Add mutually exclusive include/exclude snapshot columns while retaining all key columns.
- Add snapshot depth, scalar, collection and row-count limits; unsupported driver data fails closed.
- Prevent snapshot false negatives from collisions between Date/text and binary/Base64 representations.
- Harden handling of unsupported custom objects, sparse arrays and property accessors.
- Expand PostgreSQL and unit regression tests for new options and failure cases.

**Compatibility:** v0.1.x `{ name, key }` table specifications remain accepted. New table options deliberately change comparison scope. The API remains experimental; this is not a production monitoring tool.

**Release:** [GitHub v0.2.0](https://github.com/vlovers/mutation-boundary/releases/tag/v0.2.0) and [npm v0.2.0](https://www.npmjs.com/package/mutation-boundary/v/0.2.0). Historical release gates are complete; future releases require independent verification.

## 0.1.1 — reliability and integration hardening

- Fail closed on ambiguous, cyclic, or unsupported snapshot representations before invoking the test action.
- Add regression tests for JSONB, bytea, NULL transitions, and rolled-back PostgreSQL writes.
- Add tests for pool client cleanup after action and snapshot failures, including a single-connection no-contention case.
- Verify the published v0.1.0 npm package in a clean consumer alongside existing source tarball checks.
- Improve the documented reliability-first roadmap and release safety limitations.

**Compatibility:** No new public API. This release intentionally rejects unusual custom driver values that could previously be ambiguously serialized. Requires Node.js 24+. Disposable, isolated PostgreSQL test databases only.

**Limitations:** Net-state checks cannot detect rolled-back or restored writes, unselected tables, concurrent writers, delayed jobs, or external side effects. Single-connection pools can deadlock if the action itself acquires from the same pool.

## 0.1.0 — initial experimental release

- Experimental PostgreSQL net-state snapshot assertions.
- Guarded `assertNoMutation` API with redacted mutation counts.
- PostgreSQL integration tests and GitHub Actions checks.
- Initial safety, architecture, contribution and release documentation.

GitHub release: https://github.com/vlovers/mutation-boundary/releases/tag/v0.1.0 . Published package listing: https://www.npmjs.com/package/mutation-boundary . The v0.1.0 API remains experimental; package artifact provenance has not been independently verified in this audit.
