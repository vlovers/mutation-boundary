# v0.6.0 compatibility and release verification

## Status and evidence

Tag `v0.6.0` points to `6dad293698f2230312659102c8462d7571953f34`. The tagged CI and npm Trusted Publishing workflow [succeeded](https://github.com/vlovers/mutation-boundary/actions/runs/39586698688). This confirms the workflow completed, not independent registry tarball provenance. The GitHub Release page and independent npm v0.6.0 consumer verification are separate follow-ups.

## Behavioral compatibility review

| Case | Published v0.5.0 | v0.6.0 | Recommended action |
| --- | --- | --- | --- |
| Normal `pg.Client` and `pg.Pool` result rows within budget | Net-state comparison | Same public API, with stricter internal snapshot handling | Keep existing integration tests |
| Custom adapter reuses and mutates the same row objects | May miss a surviving mutation due to object aliasing | Stores canonical row strings; detects net updates | Upgrade recommended after consumer verification |
| Combined canonical rows/keys exceed 32 MiB in one snapshot | No aggregate retained-byte cap | Fails closed, before action for the baseline; after action for later snapshot | Narrow `tables`, use `includeColumns` / `excludeColumns`, reduce fixture size |
| Custom `excludeColumns` adapter row with accessors or symbol keys | Earlier projection could invoke getters / omit symbols | Rejects before action; does not execute getter | Return ordinary plain data rows or normalize your adapter |
| Pool `release()` fails after a primary error | Cleanup error wins | Same thrown cleanup error, optional non-enumerable `cause` retains prior failure | Read `cause` diagnostically; do not rely on serialized exception contents |

**Semver decision:** The public API signatures are unchanged, but accepted inputs are narrower because of fail-closed validations and an aggregate size cap. The package is pre-1.0 and v0.6.0 was tagged/published; consumers should review these behavior changes before upgrading.

## Memory and concurrency caveats

The 32 MiB budget counts UTF-8 bytes of retained canonical row strings and keys independently for each snapshot; it is not an RSS ceiling. A PostgreSQL driver may materialize a full query result before validation; intermediate JS strings can temporarily exceed the retained data budget. A snapshot detects the **net state of selected rows** only. It cannot prove the absence of transient writes, rolled-back writes, concurrent interference, or effects outside selected tables.

## Mandatory release procedure

1. Check the proposed immutable source SHA and final CI for unit, disposable PostgreSQL, NestJS/TypeORM, Jest/Vitest, clean package consumers, package-audit and registry v0.5.0 smoke.
2. Review `npm pack --json --dry-run --ignore-scripts` allowlist and `dist/index.d.ts` declarations, plus `README.md`, `CHANGELOG.md` and compatibility notes.
3. Verify any Estima adoption work independently; clarification atomicity is an application-side blocker, not a MutationBoundary guarantee.
4. Only after maintainer approval, update version and lockfile coherently, rerun all checks, review diff and publish from an immutable matching tag through trusted publishing.
5. Check the GitHub release and npm artifact actually exist and match intended version. Do not mark a release complete based only on green source CI.
