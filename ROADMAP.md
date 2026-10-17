# Roadmap

MutationBoundary is a narrowly scoped PostgreSQL testing library: assert that an awaited operation leaves **no unexpected net committed changes** in selected tables. Prioritize safety, reproducibility and an excellent developer experience over feature breadth.

This roadmap is directional, not a release promise. Do not merge or publish without review.

## v0.1.0 — dependable first release (P0)

- [x] Typed `assertNoMutation` API, redacted error counts, explicit disposable-database confirmation and identity checks.
- [x] PostgreSQL-backed integration tests, CI, and external package consumer smoke test.
- [x] Real-world Estima characterization: the failed clarification HTTP request leaves a surviving task status update; Estima PostgreSQL CI passed 182/182 tests.
- [ ] Resolve Git dependency packaging and Bun frozen lockfile in Estima; remove experimental CI source-checkout/build workaround and restore `bun ci --ignore-scripts`.
- [ ] Validate clean installs and module resolution in npm, Bun, Node ESM and a CommonJS Jest consumer. Document supported module systems precisely.
- [ ] Review the public API, failure precedence, connection ownership and security limitations.
- [ ] Add copy-paste quickstart and complete minimal PostgreSQL test example.
- [ ] Tag v0.1.0, publish to npm and verify the published tarball **only after explicit approval**.

**Exit criteria:** reproducible green library CI, green Estima CI with frozen lockfile and no workaround, verified external consumer install, reviewed release artifact.

## v0.2.0 — targeted comparisons (P1)

- [ ] Optional include/exclude columns and deterministic normalization for expected volatile values.
- [ ] Safe row filters with parameterized queries; explicitly bound scope.
- [ ] Tests for JSONB, null, composite identifiers, schema-qualified tables and tricky identifiers.
- [ ] Maintain fail-closed limits and redact values in high-level errors.

**Exit criteria:** every new option has a PostgreSQL-backed regression test and a documented safety model.

## v0.3.0 — test-runner ergonomics (P1)

- [ ] Optional lightweight Jest and Vitest helpers; core stays framework-independent.
- [ ] Recipes for NestJS/TypeORM and `pg` Client/Pool.
- [ ] Clarify pool deadlock risks and asynchronous work that continues after the awaited action.
- [ ] Verify support matrix in CI rather than claiming universal compatibility.

## v0.4.0 — actionable diagnostics (P2)

- [ ] Concise human-readable summaries and opt-in machine-readable JSON reports.
- [ ] GitHub Actions-friendly failure output without leaking row values or secrets.
- [ ] Deterministic diff ordering and clear errors for unsupported table sizes or unstable environments.

## v1.0.0 — stable contract

- [ ] Versioned API and compatibility policy; changelog and migration guide.
- [ ] Maintained Node/PostgreSQL/test-runner compatibility matrix.
- [ ] Security review, documented threat model and release automation.
- [ ] Examples proven against real disposable databases.

## Non-goals

- Production database monitoring, CDC, audit logs or a generic SQL security scanner.
- Detecting transient writes that are rolled back or restored to the same final values.
- Guaranteed correctness with concurrent writers or delayed background jobs.
- Inspecting tables not explicitly selected, sequences, external APIs or side effects outside PostgreSQL.

## Adoption

Start with a minimal example and Estima case study; then share a small reproducible failing-request test with PostgreSQL/NestJS maintainers. Track actual adoption and issue reports before expanding scope.
