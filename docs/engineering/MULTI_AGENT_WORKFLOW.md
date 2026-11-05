# Multi-agent GitHub delivery — MutationBoundary

This is the repository-specific coordination protocol for [Issue #75](https://github.com/vlovers/mutation-boundary/issues/75). It supplements [AGENTS.md](../../AGENTS.md), [Definition of Done](DEFINITION_OF_DONE.md), [Independent Review Policy](REVIEW_POLICY.md), [Release Checklist](RELEASE_CHECKLIST.md), [Contributing](../../CONTRIBUTING.md), and [Database Safety](../SAFETY.md). It grants no GitHub, database or npm permissions.

## One issue, one coherent integration batch

Before work, inspect actual `main`, open Issues and PRs, and the working tree. Reuse a tracked parent Issue and any existing relevant PR; do not open a new PR for each small edit. Record outcome, non-goals, observable acceptance criteria, owner, independent reviewer, dependencies, owned paths, base SHA, tests, rollback and security implications. Use 2–5 parallel agents **only** when independent tasks genuinely benefit from parallelism; a single agent is preferable for shared contracts.

One coordinator maintains the Issue ledger and integration order. Each implementer has a separate branch and worktree and one agreed set of paths. The reviewer independently reads the real base-to-head diff; a validation agent reports only checks actually executed on that head. AI feedback is advisory and never substitutes for authorized GitHub review or maintainer acceptance.

## Ownership and dependency ledger

| Task / owner | Branch / worktree | Owned files or shared contract | Depends on | PR | Exact head SHA | Verification / blocker |
| --- | --- | --- | --- | --- | --- | --- |
| Example: documentation | docs/issue-... | docs/engineering/ | none | pending | pending | links not checked |

- Assign a **single writer** to `package.json`, lockfile, public API/types, SQL snapshot/adapter contracts, release workflow and other shared files. Parallel agents must not silently edit them.
- Coordinate schema/API/package changes before dependent tasks; do not merge dependent work until upstream contracts are reconciled.
- When paths collide, preserve both branches, stop competing writes, name one integration owner, and resolve the real diff. Do not reset, force-push or overwrite a peer's work.
- Prefer one integration PR per coherent deliverable. A coordination Issue or worktree reservation is not an enforced lock or merge permission.

## Project-specific safety and verification

MutationBoundary measures **net** PostgreSQL row-state differences, not transient writes, external effects or concurrent changes. Never test on production, shared, sensitive or otherwise non-disposable PostgreSQL. Independently verify the disposable environment, quiescence, restricted role and expected connection target before `npm run test:postgres`; a name or confirmation flag alone is not proof. Keep credentials, connection URLs, row values/keys and raw driver errors out of logs, PRs, screenshots and artifacts. Never execute untrusted hooks or lifecycle scripts to satisfy a check.

Use Node.js 24+ and npm, not commands borrowed from Bun/pnpm projects. Choose applicable checks from [AGENTS.md](../../AGENTS.md) and [CONTRIBUTING.md](../../CONTRIBUTING.md): `npm run typecheck`, `npm test`, `npm run build`, `npm run check:package`, `npm run test:package-audit`, `npm run test:consumer`; release-specific checks are separate. Docs-only edits may mark runtime tests N/A with a reason, but must validate changed links and commands.

Record the **full base/head/tested SHA**, command, environment, exit code, CI URL, and skipped checks. Do not treat queued, skipped, failed, stale-SHA or mock-only checks as passing. Revalidate after a material change.

## Evidence artifacts, retention and redaction

For every retained artifact, record the producing Issue/PR, accountable owner, exact tested head SHA, verification command and exit status, environment class (local, disposable PostgreSQL, CI, or consumer), workflow/run URL where applicable, creation date, retention or expiry, and a reproducible regeneration command. Keep this ledger in the parent Issue or PR handoff; a temporary local pathname is not a durable artifact location.

- **Minimize and sanitize:** keep only the smallest reviewable logs, test summaries, coverage, package checks and relevant screenshots. Remove connection URLs, credentials, tokens, row values, primary keys, private SQL parameters, raw driver errors, environment files, and database exports before upload or linking. Do not assume a private artifact is safe for sensitive data.
- **Disposable PostgreSQL:** evidence must identify the isolated environment class and safety preconditions without exposing the actual connection target or credentials. Never attach snapshots, table dumps or unredacted query traces. A successful mock or static check is not evidence of a live disposable-DB integration run.
- **Verification states:** distinguish `PASS`, `FAIL`, `NOT RUN`, `N/A`, `QUEUED`, `STALE` and `UNAVAILABLE`. Only a completed check against the stated exact SHA can be reported as passing. Do not use expired artifacts, deleted runs, a different SHA, or an implementer's assertion as current evidence.
- **Retention and recovery:** note when CI will delete an artifact, whether the reviewer can still access it, and how to regenerate it safely after expiry. Re-check source refs, the current branch, Issue ownership and evidence availability after interruption or a material rebase; do not automatically rerun Actions to manufacture a green result.
- **Access and approval:** artifacts support review but never grant GitHub privileges, database access, merge approval or npm release authorization. The independent reviewer records which evidence was inspected and which claims remain unverified.

A documentation-only change may report PostgreSQL and package/runtime checks as `N/A` with a concrete reason; it still requires checking changed documentation links and command references.

## Independent review, recovery and handoff

The reviewer examines acceptance criteria, actual diff, security boundaries, compatibility, negative cases and evidence. Record findings with severity and disposition; high-severity correctness, disclosure and DB-safety findings block acceptance. An author cannot self-approve. The maintainer must separately authorize merge, tagging and npm publication; a passing PR does not authorize release.

On interruption, fetch the actual branch and PR state, inspect worktree changes, Issue ownership, CI/review SHA and artifact availability before resuming. If a prior remote action's outcome is uncertain, query authoritative GitHub/npm state first; do not blindly retry a push, merge or publish. Mark missing review, ambiguous ownership or unverifiable database safety **blocked**.

### Required handoff

```text
Parent Issue / outcome / acceptance criteria:
Owner / independent reviewer / integration owner:
Base branch + full SHA / head branch + full SHA:
Owned paths / dependencies / conflicting PRs:
DB safety, API/package compatibility and rollback:
Checks actually run (command, exit status, environment, CI URL):
Disposable PostgreSQL validation (or NOT RUN):
Artifact owner / exact tested SHA / producing command and environment:\nSanitized artifact location / CI run / creation and expiry / safe regeneration:\nEvidence state (PASS, FAIL, NOT RUN, N/A, QUEUED, STALE, UNAVAILABLE):
Review findings / blocked decisions / next owner:
Maintainer authorization required for merge or release:
```

This document describes coordination, not automatic enforcement of GitHub branch protections, database isolation, CI, independent review or release approval.
