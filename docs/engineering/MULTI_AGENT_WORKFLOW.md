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

Record the **full base/head/tested SHA**, command, environment, exit code, CI URL, and skipped checks. Do not treat queued, skipped, failed, stale-SHA or mock-only checks as passing. Retain only sanitized artifacts, recording their workflow/run, retention/expiry and how to reproduce evidence if artifacts expire. Revalidate after a material change.

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
Sanitized artifacts, retention and reproduction:
Review findings / blocked decisions / next owner:
Maintainer authorization required for merge or release:
```

This document describes coordination, not automatic enforcement of GitHub branch protections, database isolation, CI, independent review or release approval.
