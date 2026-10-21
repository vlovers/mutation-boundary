# v0.6.0 compatibility and release decision (unreleased)

## Status and evidence

Published npm `latest` is **v0.5.0**. The `main` branch contains proposed v0.6.0 reliability changes, but its package manifest remains at `0.5.0`; do **not** claim this is published v0.6.0. CI verifies the current source and independently installs published v0.5.0. Running CI is not an npm release.

## Behavioral compatibility review

| Case | Published v0.5.0 | Unreleased main | Recommended action |
| --- | --- | --- | --- |
| Normal `pg.Client` and `pg.Pool` result rows within budget | Net-state comparison | Same public API, with stricter internal snapshot handling | Keep existing integration tests |
| Custom adapter reuses and mutates the same row objects | May miss a surviving mutation due to object aliasing | Stores canonical row strings; detects net updates | Upgrade recommended after consumer verification |
| Combined canonical rows/keys exceed 32 MiB in one snapshot | No aggregate retained-byte cap | Fails closed, before action for the baseline; after action for later snapshot | Narrow `tables`, use `includeColumns` / `excludeColumns`, reduce fixture size |
| Custom `excludeColumns` adapter row with accessors or symbol keys | Earlier projection could invoke getters / omit symbols | Rejects before action; does not execute getter | Return ordinary plain data rows or normalize your adapter |
| Pool `release()` fails after a primary error | Cleanup error wins | Same thrown cleanup error, optional non-enumerable `cause` retains prior failure | Read `cause` diagnostically; do not rely on serialized exception contents |

**Semver decision:** The public API signatures are unchanged, but accepted inputs are narrower because of fail-closed validations and an aggregate size cap. Since the package is still pre-1.0, a minor version candidate is proposed, **not automatically approved**. Consumer review must explicitly accept these behavior changes before a tag.

## Memory and concurrency caveats

The 32 MiB budget counts UTF-8 bytes of retained canonical row strings and keys independently for each snapshot; it is not an RSS ceiling. A PostgreSQL driver may materialize a full query result before validation; intermediate JS strings can temporarily exceed the retained data budget. A snapshot detects the **net state of selected rows** only. It cannot prove the absence of transient writes, rolled-back writes, concurrent interference, or effects outside selected tables.

## Mandatory release procedure

1. Check the proposed immutable source SHA and final CI for unit, disposable PostgreSQL, NestJS/TypeORM, Jest/Vitest, clean package consumers, package-audit and registry v0.5.0 smoke.
2. Review `npm pack --json --dry-run --ignore-scripts` allowlist and `dist/index.d.ts` declarations, plus `README.md`, `CHANGELOG.md` and compatibility notes.
3. Verify any Estima adoption work independently; clarification atomicity is an application-side blocker, not a MutationBoundary guarantee.
4. Only after maintainer approval, update version and lockfile coherently, rerun all checks, review diff and publish from an immutable matching tag through trusted publishing.
5. Check the GitHub release and npm artifact actually exist and match intended version. Do not mark a release complete based only on green source CI.
