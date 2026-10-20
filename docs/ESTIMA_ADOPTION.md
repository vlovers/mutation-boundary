# Estima adoption evidence and migration checklist (v0.5 planning)

## Status: not an integrated external-consumer success

Reviewed on 2026-10-21:
- [Estima issue #10](https://github.com/vlovers/estima/issues/10) documents an observed non-atomic `PATCH /api/tasks/:id/clarify` failure: final-estimate INSERT fails after other task/child writes survive.
- [Estima draft PR #11](https://github.com/vlovers/estima/pull/11) is a **characterization experiment** and explicitly says not to merge. Its local snapshot helper returns row values and does not enforce the disposable-DB safety guard. It is not equivalent to published MutationBoundary.
- Estima `develop` does not yet import `mutation-boundary` in the provider-error integration test or declare the package as a dependency. Do not claim that Estima currently uses MutationBoundary.
- MutationBoundary [PR #40](https://github.com/vlovers/mutation-boundary/pull/40) verifies the **packed npm artifact** in a separate ESM project against disposable PostgreSQL and a failure that leaves a committed row.
- MutationBoundary [PR #41](https://github.com/vlovers/mutation-boundary/pull/41) verifies the analogous **real NestJS HTTP + TypeORM** scenario, including rollback and redacted report. These are representative fixtures, not execution of Estima's endpoint.

## Requirements for an actual Estima adoption claim

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
