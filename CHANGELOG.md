# Changelog

All notable changes will be documented here.

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
