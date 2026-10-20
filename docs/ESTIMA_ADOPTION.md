# Estima adoption evidence and migration checklist (v0.5 planning)

## Verified adoption: Estima PR #12 (2026-10-21)

Estima [PR #12](https://github.com/vlovers/estima/pull/12) was merged into `develop` at `5c6eb38b3b035b40849adb540f8b401923c81e01`. Its final SHA `e5feea7c6166c1f3c1fe0b8701e9fc9e7152dc16` passed the [PostgreSQL integration validation](https://github.com/vlovers/estima/actions/runs/39513022289) and [Bun migration validation](https://github.com/vlovers/estima/actions/runs/39513022315). The test uses published `mutation-boundary@0.4.0`, a frozen Bun lockfile, real Nest HTTP, disposable PostgreSQL, a controlled failed manual estimate INSERT and asserts no surviving changes in `tasks` and `estimates`. Jest CommonJS uses native dynamic import for the ESM package.

**Limit:** This proves that specific failed manual-estimate path, not the still-reported clarification partial-write issue #10; the old experimental PR #11 is not a fix.

## Historical pre-adoption evidence

Reviewed on 2026-10-21:
- [Estima issue #10](https://github.com/vlovers/estima/issues/10) documents an observed non-atomic `PATCH /api/tasks/:id/clarify` failure: final-estimate INSERT fails after other task/child writes survive.
- [Estima draft PR #11](https://github.com/vlovers/estima/pull/11) is a **characterization experiment** and explicitly says not to merge. Its local snapshot helper returns row values and does not enforce the disposable-DB safety guard. It is not equivalent to published MutationBoundary.
- Before PR #12, Estima `develop` did not import `mutation-boundary`; PR #12 subsequently introduced the published test dependency and executed the integration.
- MutationBoundary [PR #40](https://github.com/vlovers/mutation-boundary/pull/40) verifies the **packed npm artifact** in a separate ESM project against disposable PostgreSQL and a failure that leaves a committed row.
- MutationBoundary [PR #41](https://github.com/vlovers/mutation-boundary/pull/41) verifies the analogous **real NestJS HTTP + TypeORM** scenario, including rollback and redacted report. These are representative fixtures, not execution of Estima's endpoint.

## Checklist for extending adoption to clarification issue #10

1. Work in a dedicated Estima branch, **not** the MutationBoundary repository. Base it on the current Estima integration branch, not an outdated experimental helper. Review package manager and lockfile before adding a dependency.
2. Reuse the existing disposable PostgreSQL harness, local deterministic OpenAI stub and Nest HTTP test environment. Never test against a shared/prod database or call a paid AI provider.
3. Use a separate snapshot connection/adapter; the action must be able to obtain its own database connection. Pass exact test database and session user from the disposable harness into the `safety` object and set `confirmDisposableTestDatabase: true` only after the test harness verifies isolation.
4. Observe `tasks`, `estimates`, and any persistently modified related tables (e.g. task breakdown children). Use stable row keys and, where needed, an explicit opt-in filter, understanding that rows crossing the filter boundary count as inserted/deleted.
5. With the known injected failure, assert the expected behavior according to **the application's current correctness contract**. If partial writes remain a known bug, a characterization test should explicitly expect `MutationBoundaryError`; a passing `assertNoMutation` regression should be introduced **only after atomic persistence is fixed**.
6. After the Estima transaction fix, rerun the same HTTP trigger-failure scenario and require no surviving changes on the selected tables. Verify no second clarification overwrites an in-flight one; do not hold PostgreSQL transactions across provider calls.
7. Confirm clean installs with the project's actual package manager and frozen lockfile; run the full Estima HTTP/PostgreSQL CI and review output for secrets.

## Why this matters

Do not confuse a failing-request invariant test with a fix to Estima's transaction logic. MutationBoundary detects surviving **net** database changes; it cannot prove that a transaction used the correct isolation level, that a rollback occurred, or that no transient/unselected/concurrent writes happened.

The public surface remains `assertNoMutation`, `MutationBoundaryError`, and structured counts. There is no reason to add NestJS-specific wrappers to the library until concrete integration failures justify them.
