# v0.7.0 release review

**Status: release candidate only — not published or approved.** Last documented published package is v0.6.0.

## Source provenance

- Reliability [PR #74](https://github.com/vlovers/mutation-boundary/pull/74), SHA `464ce8526818fbf8923263d6e4083fb20b4a00c2`, separate CI [42235829832](https://github.com/vlovers/mutation-boundary/actions/runs/42235829832) passed.
- Governance [PR #76](https://github.com/vlovers/mutation-boundary/pull/76), SHA `36e03488027ef5a18cc3f45553f402499aad20b3`, separate CI passed.
- Release gates [PR #77](https://github.com/vlovers/mutation-boundary/pull/77), SHA `15a713bd579885d74e8d33fe3e261a702ba28b8b`, separate CI passed.
- Integration candidate is assembled on PR #74 head, preserving both workflow CI changes and README additions. Separate green PRs are **not** evidence of integrated build correctness.

## Compatibility and safety

The public exported API and runtime dependency set stay unchanged. Strict canonical snapshot validation can reject unusual custom adapters; that fail-closed change deserves explicit compatibility review. `assertNoMutation` compares **net state only** in chosen PostgreSQL tables; a long-lived REPEATABLE READ transaction can hide external commits. Pinned readers consume one pool slot. Writer transactions must rollback on failures before returning clients to the pool. Snapshot cap 32 MiB applies to retained canonical strings, **not** driver buffers or peak RSS. The optional memory profile has no hard performance threshold.

Use **only isolated disposable, quiescent PostgreSQL**; not production/shared databases.

## Release audit finding — pooled reader cleanup

The candidate review found a gap between removal of the temporary pinned-reader `error` listener and normal `release()`. Runtime now keeps the observer attached through the release attempt; failed release is propagated without a second release attempt, and the observer is then detached. Two unit regressions assert ordering, single release, and listener cleanup. Confirm these on the exact updated head before accepting v0.7.0.

## Release audit finding — external tarball consumer DDL safety

The external tarball consumer previously created its PostgreSQL fixture before checking disposable database identity and dropped the same-name table even if CREATE failed. This violated the repository's fixture-ownership invariant and was fixed before release: identity verification and CREATE now use one pinned client, `fixtureCreated` is set only on successful CREATE, and DROP runs only for an owned fixture. The smoke-test writer also attempts rollback and discards a client after failed rollback. Confirm the external PostgreSQL consumer step passes on the exact final SHA.

## Mandatory release gates

- [ ] Authorized independent review of combined runtime, regression tests, CI and publishing changes, including new pinned-reader EventEmitter observation.
- [ ] Full Node 24 CI on final candidate exact SHA with disposable PostgreSQL, NestJS/TypeORM, Jest/Vitest, memory profile and error-path regressions. Previous integrated SHA `7b6bc9a0acc827ac5a90975feba734e137c9235e` passed all 28 workflow steps ([CI 42312133198](https://github.com/vlovers/mutation-boundary/actions/runs/42312133198)), but does not certify later corrections.
- [ ] Inspect `npm pack --json --dry-run --ignore-scripts` allowlist, compiled exports/types, lockfile reproducibility and external ESM/TS/PostgreSQL consumer.
- [ ] Independently verify live npm registry: v0.7.0 must be unpublished; do not assume npm freshness based on source README.
- [ ] Confirm package and root lockfile at 0.7.0, changelog, README's last *published* 0.6.0 pointer, and trusted publish workflow/preflight consistency.
- [ ] Maintainer approves merge to main and exact SHA tagged `v0.7.0` after the previous gates.
- [ ] Trusted Publishing succeeds with provenance, public artifact and consumer verified; only then update README published version, installation command and GitHub release notes.

Evidence must be attached to exact SHAs. The historical v0.6.0 tag and [workflow](https://github.com/vlovers/mutation-boundary/actions/runs/39586698688) do not prove v0.7.0 publication.
