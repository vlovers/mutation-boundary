# MutationBoundary roadmap

MutationBoundary is an **isolated PostgreSQL integration-test assertion**, not a production monitoring system. It compares the net state of explicitly selected tables around an awaited operation. Roadmap items are proposals, not compatibility or release promises.

## Shipped — v0.1.0 (experimental)

- Typed `assertNoMutation()` API with test-database identity and explicit disposal acknowledgement.
- Table snapshots with bounded row count; net INSERT/UPDATE/DELETE reports without row values or keys.
- Node 24, PostgreSQL CI and package-consumer smoke tests.
- Published GitHub v0.1.0 release and documented npm package listing.

**Known scope:** No support for composite keys or schema-qualified names, transient writes, concurrent writers, external effects or production databases. A pool with only one connection may deadlock when the action uses the same pool.

## Next — v0.1.1: correctness and packaging (P0)

Do not ship until the following items are either verified with real PostgreSQL tests or explicitly documented as unsupported.

- [ ] Verify npm registry tarball version, `dist` exports/types, pack allowlist and provenance against the tagged source. Exercise a clean external Node ESM consumer and document actual CommonJS/Bun behavior.
- [ ] Test the snapshot serializer against PostgreSQL dates, buffers, bigint/numeric representations, JSONB nested values, nulls and tricky key encodings. Fail closed on unsupported/cyclic or ambiguous values rather than misreport equivalence.
- [ ] Test and document transaction isolation, pending/uncommitted changes, connection pinning, connection release on all errors and pool exhaustion/deadlock risks.
- [ ] Validate oversized snapshot and unsafe identifiers before executing the action. Verify sorting and duplicate-key behavior against real PostgreSQL.
- [ ] Verify high-level error redaction, including error chains, driver errors and application callback exceptions; never promise full redaction of caller exceptions.
- [ ] Add actionable error diagnostics for unsupported cases without leaking row data.
- [ ] Reconcile outdated PR #5 and release docs; ensure changelog and install instructions agree with registry facts.
- [ ] Investigate Estima external-consumer integration, frozen lockfile and reproducibility; document evidence rather than assuming success.

**Exit:** green Linux CI plus disposable PostgreSQL integration coverage, clean install smoke, reviewed release tarball and zero known correctness regressions. No automatic publishing of an already released version.

## v0.2.0 — narrowly scoped capabilities (P1)

Only after v0.1.1 hardening and user evidence:
- [ ] Explicit support for schema-qualified tables and composite row identifiers.
- [ ] Parameterized opt-in row filters, validated without interpolating arbitrary SQL.
- [ ] Optional include/exclude columns with clear treatment of volatile fields.
- [ ] Bounds for memory, work and output; PostgreSQL-backed regression tests for each option.

## v0.3.0 — integration ergonomics (P1)

- [ ] Verified minimal `pg.Client` and `pg.Pool` recipes, including connection-pool sizing.
- [ ] Runnable NestJS/TypeORM example based on a disposable database.
- [ ] Jest/Vitest helpers only if they remove real repeated setup; avoid unnecessary framework coupling.
- [ ] Document supported Node, PostgreSQL, ESM/CJS and test-runner combinations based on CI.

## v0.4.0 — diagnostics (P2)

- [ ] Structured machine-readable reports that expose counts and metadata only.
- [ ] Deterministic ordering and bounded CI-friendly failures.
- [ ] No raw rows, keys or credentials in exported diagnostics.

## v1.0.0 — stable contract

- [ ] Public API/versioning policy, migration guidance, proven support matrix, reliability and security review.
- [ ] Maintained release workflow and reproducible real-world examples.

## Explicit non-goals

Production database monitoring, CDC, SQL interception, ORM replacement, guaranteed concurrent-write detection, rollback/transient-write tracing, and side effects outside selected PostgreSQL tables.

## Adoption

Start with a reproducible failing-request regression, one minimal fixture and the Estima case study. Improve docs and GitHub discoverability; prioritize reported problems rather than speculative features.

All releases require a human review of test evidence and artifact provenance. A green CI alone is not proof of runtime safety or complete database isolation.
