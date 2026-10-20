# MutationBoundary roadmap

MutationBoundary is an **isolated PostgreSQL integration-test assertion**, not a production monitoring system. It compares the net state of explicitly selected tables around an awaited operation. Roadmap items are proposals, not compatibility or release promises.

## Released — v0.1.0 (experimental)

- Typed `assertNoMutation()` API with test-database identity and explicit disposal acknowledgement.
- Table snapshots with bounded row count; net INSERT/UPDATE/DELETE reports without row values or keys.
- Node 24, PostgreSQL CI and package-consumer smoke tests.
- Published GitHub v0.1.0 release and documented npm package listing.

**Known scope:** No support for composite keys or schema-qualified names, transient writes, concurrent writers, external effects or production databases. A pool with only one connection may deadlock when the action uses the same pool.

## Released — v0.1.1: correctness and packaging (P0)

Historical hardening checklist. Unchecked items remain verification or adoption follow-ups, not claims that the released package failed.

- [ ] Verify npm registry tarball version, `dist` exports/types, pack allowlist and provenance against the tagged source. Exercise a clean external Node ESM consumer and document actual CommonJS/Bun behavior.
- [ ] Test the snapshot serializer against PostgreSQL dates, buffers, bigint/numeric representations, JSONB nested values, nulls and tricky key encodings. Fail closed on unsupported/cyclic or ambiguous values rather than misreport equivalence.
- [ ] Test and document transaction isolation, pending/uncommitted changes, connection pinning, connection release on all errors and pool exhaustion/deadlock risks.
- [ ] Validate oversized snapshot and unsafe identifiers before executing the action. Verify sorting and duplicate-key behavior against real PostgreSQL.
- [ ] Verify high-level error redaction, including error chains, driver errors and application callback exceptions; never promise full redaction of caller exceptions.
- [ ] Add actionable error diagnostics for unsupported cases without leaking row data.
- [ ] Reconcile outdated PR #5 and release docs; ensure changelog and install instructions agree with registry facts.
- [ ] Investigate Estima external-consumer integration, frozen lockfile and reproducibility; document evidence rather than assuming success.

**Exit:** green Linux CI plus disposable PostgreSQL integration coverage, clean install smoke, reviewed release tarball and zero known correctness regressions. No automatic publishing of an already released version.

## Released — v0.2.0: scoped snapshots (P1)

Released on GitHub and published through npm Trusted Publishing. The following capabilities shipped:
- [x] Explicit support for schema-qualified tables and composite row identifiers (PR #14).
- [x] Parameterized opt-in row filters, validated without interpolating arbitrary SQL (PR #15).
- [x] Optional include/exclude columns with clear treatment of volatile fields (PR #16).
- [x] Per-value depth, size, collection and row-count safety bounds and PostgreSQL-backed option tests (PR #17); aggregate memory/time bounds remain **unsupported**, as documented.

## Released — v0.3.0: integration ergonomics (P1)

The v0.3.0 GitHub release and successful publish workflow are recorded on 2026-10-18. Consult [v0.3.0 integrations](docs/V030_INTEGRATIONS.md) for exactly tested scenarios. npm artifact verification remains a separate external-consumer check.

- [x] Verified minimal `pg.Client` and `pg.Pool` recipes, including connection-pool sizing.
- [x] Runnable NestJS/TypeORM example based on a disposable database.
- [x] Jest/Vitest async compatibility verified; no wrappers needed.
- [x] Document tested Node 24/PostgreSQL 16/ESM/Jest/Vitest combinations; CommonJS remains unverified.

## Released — v0.4.0: diagnostics and hardening (P2)

- [x] Run disposable-PostgreSQL transaction/lifecycle regressions (commits, savepoints, failures, exhaustion); PostgreSQL CI passed in PR #32.
- [x] Verify unit failure-path matrix for safety failures, baseline/after queries, callback exception precedence and connection release (passed in PR #34).
- [x] Reconcile README/release docs and pinned npm registry smoke with v0.3.0; CI registry consumer passed in PR #32.
- [x] Validate v0.4.0 diagnostics through a newly packed external consumer (PR #35) and complete release CI (#36).

- [x] Structured machine-readable reports exposing selected table names and counts only (CI passed in PR #33).
- [x] Deterministically ordered text, capped at 20 table summaries; full structured counts remain available (CI passed in PR #33).
- [x] JSON error representation contains table metadata and counts only; caller/driver exceptions remain outside this guarantee (released in v0.4.0).

## v0.5.0 — adoption evidence and targeted compatibility (proposed)

- [x] Verify published v0.4.0 registry consumer with CI and verify packaged ESM/PostgreSQL usage in PR #40; Estima's Bun frozen-lockfile installation remains a separate unverified adoption gate.
- [x] Verify a real Estima failed-manual-estimate HTTP regression with published v0.4.0 on disposable PostgreSQL (Estima PR #12, full CI green). **Issue #10 clarification atomicity remains unverified/unfixed by this test.** See [adoption evidence](docs/ESTIMA_ADOPTION.md).
- [ ] Extend Estima's real HTTP mutation assertion to the clarification failure from issue #10 after the product transaction contract is fixed.
- [ ] Review `pg.Pool` versus compatible query adapters for connection identity and cleanup with focused failing tests before changing detection logic.
- [x] Document field-tested integration limitations, including Jest CommonJS native ESM import and Estima's verified Bun consumer (see [compatibility evidence](docs/COMPATIBILITY.md)); further field reports remain welcome.
- [ ] Keep dependency-free runtime and safety guardrails; no speculative framework helpers.

## v1.0.0 — stable contract

- [ ] Public API/versioning policy, migration guidance, proven support matrix, reliability and security review.
- [ ] Maintained release workflow and reproducible real-world examples.

## Explicit non-goals

Production database monitoring, CDC, SQL interception, ORM replacement, guaranteed concurrent-write detection, rollback/transient-write tracing, and side effects outside selected PostgreSQL tables.

## Adoption

Start with a reproducible failing-request regression, one minimal fixture and the Estima case study. Improve docs and GitHub discoverability; prioritize reported problems rather than speculative features.

All releases require a human review of test evidence and artifact provenance. A green CI alone is not proof of runtime safety or complete database isolation.
