# Changelog

All notable changes will be documented here.

## 0.2.0 — release candidate (not yet published)

- Add safely quoted schema-qualified PostgreSQL table names and composite row identifiers.
- Add opt-in, parameterized single-column equality row filters, including NULL matching.
- Add mutually exclusive include/exclude snapshot columns while retaining all key columns.
- Add snapshot depth, scalar, collection and row-count limits; unsupported driver data fails closed.
- Prevent snapshot false negatives from collisions between Date/text and binary/Base64 representations.
- Harden handling of unsupported custom objects, sparse arrays and property accessors (pending audit PR #19).
- Expand PostgreSQL and unit regression tests for new options and failure cases.

**Compatibility:** v0.1.x `{ name, key }` table specifications remain accepted. New table options deliberately change comparison scope. The API remains experimental; this is not a production monitoring tool.

**Release gate:** do not tag or publish 0.2.0 until the v0.1.1 npm authorization issue is resolved, PR #19 has green CI and is merged, the final source checks pass, and the npm package and GitHub release are verified separately.

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
