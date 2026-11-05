# Memory and PostgreSQL reliability evidence (unreleased)

MutationBoundary is a **net-state** test assertion for a disposable, quiescent PostgreSQL database. The published v0.6.0 contract caps **retained canonical key/row string bytes at 32 MiB per snapshot**, not process RSS, query-result allocations, network buffers, peak heap use, or elapsed time. A rejected baseline prevents `action()`; a rejected post-action snapshot fails closed after the action has run.

## Executable PostgreSQL scenarios

The additional `test/postgres-reliability.test.ts` suite runs with `npm run test:postgres` in CI against a disposable PostgreSQL 16 service. It verifies:

- 48 × 700,000-byte selected text cells, each under the 1 MiB per-scalar limit, collectively exceed the 32 MiB retained-data cap. A baseline overflow must reject **before** calling `action()`.
- `includeColumns: ['state']` avoids reading and retaining unselected text payloads and still detects a selected committed update.
- A large post-action result fails closed while a pinned `pg.Pool` connection is released and the pool remains usable for a narrower read.
- Loss of the pinned snapshot-reader connection during an action produces an observable failure, not a successful no-mutation assertion; a separate healthy pool connection can subsequently be used.
- A separately committed writer's row update is detected when it commits **before the after-snapshot**. This is not a concurrent-writer guarantee; arbitrary concurrent activity still makes snapshot comparisons unreliable.

**Scope:** These are reproducible finite fixtures, not peak-memory load certification. CI is intentionally not fitted with an absolute RSS threshold that would be flaky across runner configurations. The large fixtures use synthetic data only; never point these tests at a shared environment.

## Optional observational memory profile

With Node 24+, a verified disposable PostgreSQL database, and `MUTATION_BOUNDARY_TEST_DATABASE_URL` explicitly set:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run profile:memory
```

The script first checks database and user identity and creates only a session-local temporary table. It measures four fixtures: small, valid-large, over-budget, and a narrow projection of the over-budget dataset. CI executes this profile against the disposable PostgreSQL service and fails if the expected pass/pass/reject/pass outcomes change. It emits only durations, outcomes, point-in-time `rss`, `heapUsed`, `external`, and `arrayBuffers` byte counts, and the operating-system `process.resourceUsage().maxRSS` high-water mark (KiB on Linux), not rows or connection secrets.

Samples are **not per-fixture peak values**: the point-in-time resident/heap numbers can be affected by GC, allocator reuse, Node/pg versions and other activity. The `maxRSS` high-water mark is cumulative for the whole Node process; it cannot attribute memory to one query or distinguish driver allocations from the canonical snapshot. Record OS, Node, PostgreSQL version and runner size separately when comparing runs. For reliable peak measurements use an isolated process profiler and define a representative fixture first. Running this command does not prove a hard memory ceiling.

## Release decision

These tests and profiling utilities are unreleased until the containing PR is reviewed and merged. They do not change the public API, add runtime dependencies, or claim support for concurrent writes. Follow `docs/engineering/RELEASE_CHECKLIST.md` before any future tag or npm publish.
