# v0.3.0 released: integration evidence and limitations

The v0.3.0 GitHub release was published on 2026-10-18 and its tag CI and npm publish workflow completed successfully. The original PR evidence below describes the configurations exercised before release, not broad framework compatibility. External npm artifact verification is a separate gate.

## Evidence and supported claims

| Environment | Verified behavior | Evidence and limits |
| --- | --- | --- |
| Node.js 24, Linux | Typecheck, unit suite, ESM package smoke | Existing main GitHub Actions CI; other Node versions are not CI-tested |
| PostgreSQL 16 + `pg.Client` | Snapshot of session-local temporary tables and surviving writes | Existing PostgreSQL integration suite; example in PR #24 |
| PostgreSQL 16 + `pg.Pool` | Pinned snapshot connection, released in `finally` | Existing PostgreSQL integration suite and PR #24; action may need additional connections |
| PostgreSQL 16 + TypeORM `DataSource` | Repository read and surviving update with real DB | PR #25 CI, only its tested `DataSource` configuration |
| NestJS 11 application context + TypeORM | Service read and surviving write | PR #25 CI; **not** evidence for full NestJS HTTP or `@nestjs/typeorm` |
| Jest 30 and Vitest 3 | Async success, mutation rejection and callback error | PR #26 CI completed successfully on final tested commit |
| CommonJS, Bun, other Node/PostgreSQL versions | Not verified | No compatibility claim |

## Usage notes

- The API is plain Promise-based: `await assertNoMutation({...})`. Jest/Vitest wrappers are not required.
- For `pg.Pool`, `max: 1` can block when the action also acquires a connection. Configure a bounded connection timeout in test setups and provide spare capacity.
- Prefer a dedicated `pg.Client` for temporary tables. TypeORM's `DataSource.query()` is compatible with the minimal adapter shape in the exercised setup, but this is not transaction-pinned.
- If an action uses a transaction on a separate connection, uncommitted changes may not be visible to snapshots.
- Do not use the tool against production, shared, or concurrently written databases.
- Row values are held in memory for comparisons; library-generated mutation summaries contain only table names and counts, but database-driver and application errors may leak caller-specific information.
- The implementation detects surviving **net** changes to explicitly selected table rows, not transient or restored changes, changes outside selected tables, sequences, or external effects.

## Historical v0.3.0 integration gates

1. PR #23: release documentation and npm 0.2.0 registry smoke.
2. PR #24: `pg.Client` / `pg.Pool` recipes and pool-contention regression.
3. PR #25: real TypeORM and NestJS application-context consumer tests.
4. PR #26: Jest/Vitest ESM consumer checks passed on the final tested commit; scope is restricted to the exercised async assertions.
5. PR #27: sanitized table-scoped diagnostics and fail-closed unit regressions.
6. Combined-branch verification completed during release preparation, including unit, real PostgreSQL integration, source consumer smoke, `npm pack --dry-run`, and lockfile hygiene.
7. The GitHub v0.3.0 release and successful tag publish workflow are recorded. Future releases still require human review.

The individual PR CI jobs verified their own changes; the later combined release checks ran against the integrated tree. Green CI does not prove database isolation, support for untested versions, or artifact provenance.
