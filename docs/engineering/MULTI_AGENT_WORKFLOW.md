# Multi-agent development and GitHub integration — MutationBoundary

This protocol coordinates independent AI coding agents in MutationBoundary. It supplements [AGENTS.md](../../AGENTS.md), [Definition of Done](DEFINITION_OF_DONE.md), and [review policy](REVIEW_POLICY.md); it does not grant additional permissions, bypass GitHub review controls or authorize database access.

## Outcome-driven engineering batches

A batch is **one coherent acceptance outcome**: feature or correctness fix, tests (including negative cases), documentation, package and runtime impact, and a verifiable PR. Prefer comprehensive logical batches over numerous trivial PRs. Existing open PRs must be reviewed before creating duplicates.

Every proposed batch states: parent Issue, accountable author, acceptance and non-goals, paths owned, dependencies, migration/API risk, review owner, validation plan and evidence/handoff. Split only for real independence or a safety/review boundary; a shared public API or snapshot contract should land before dependent callers.

## Parallelism and Git isolation

1. **Inventory** the current branch and existing PRs, record target SHA and overlapping work. Search for a prior Draft PR implementing the same change before opening another.
2. **Plan** a dependency graph with named owners and explicit path ownership recorded in the parent issue. Ownership is a social convention, not a filesystem lock.
3. **Assign** an independent implementer per non-overlapping batch; use a dedicated Git branch and worktree, never a shared index or working directory.
4. **Contract first:** serialize edits to shared package API, test harness, database fixture/provisioning, snapshot format, lockfile and CI workflows, or designate one integration owner. Agents may concurrently work on separate functions after the common contract is fixed.
5. **Implement + prove:** add focused regression tests and failure-path cases. Document limitations and backward compatibility; avoid unrelated refactoring and generated-file churn.
6. **Verify** the exact proposed commit with locally executed checks and GitHub CI. Include commands, statuses, runtime assumptions and immutable SHA links. Unrun tests are `not run`, never `passed`.
7. **Review** the actual base-to-head diff using a different reviewer. An AI reviewer is advisory, not a GitHub branch-protection approval. Revalidate and re-review material changes.
8. **Integrate** approved PRs in dependency order, refresh against the actual integration branch, resolve conflicts without discarding colleagues' edits and rerun impacted checks.
9. **Handoff:** update the tracking issue with the final PR/head SHA, evidence, risks, blocked decisions, accepted/released distinction and next owner.

Role boundaries: Coordinator tracks dependencies, conflicts, and evidence; Implementer owns code/tests/docs; Independent Reviewer checks correctness, security and actual diff; Validation Agent captures reproducible execution evidence; Maintainer authorizes acceptance/merge/release. One agent may serve distinct roles on separate batches, never as its own independent reviewer.

## PostgreSQL-specific safety: non-negotiable

- MutationBoundary observes **net PostgreSQL row-state changes**, not all transient writes or external effects. Never expand product claims without tests.
- Do **not** run destructive database tests against any production/shared database or unverified host. Only use an independently verified isolated disposable PostgreSQL test instance. Expected role `mutation_boundary_ci` and database `mutation_boundary_test` plus `MUTATION_BOUNDARY_TEST_DATABASE_URL` are required by the documented test contract but names/flags **alone do not establish isolation**.
- Never copy, expose, upload or log credentials, full connection strings, row values or row keys. Test fixtures must use disposable non-sensitive data.
- Every bug fix includes a focused regression; consider transaction rollback/commit, failure cleanup, concurrent writes, isolation assumptions, deterministic snapshots and resource limits where applicable.
- Any changes to snapshot canonicalization, resource guards, database cleanup, adapter selection or public API are cross-cutting; reserve ownership and require independent, security-aware review.
- Use Node.js 24+ and applicable documented commands: `npm run typecheck`, `npm test`, `npm run build`, `npm run check:package`, `npm run test:package-audit`, `npm run test:consumer`. Only run `npm run test:postgres` after independent disposable-database verification. Do not automatically publish packages.

## Issue-level dependency ledger

Keep one parent tracking issue with an up-to-date table:

| Batch | Owner | Branch / PR | Depends on | Reserved shared paths | State | Verified head SHA | Review / CI evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Snapshot canonicalization (example) | Agent A | PR #... | none | snapshot contract, oracle | in review | full SHA | exact CI link + reviewer |
| Consumer regression (example) | Agent B | PR #... | snapshot canonicalization | consumer fixture | blocked | — | prerequisite |

Statuses: `planned`, `claimed`, `in progress`, `blocked`, `in review`, `changes requested`, `verified`, `accepted`, `integrated`, `released`. These states are distinct. A claimed path is **not** a GitHub permission or lock.

## Collision, failure and restart playbook

- **Overlapping changes:** pause both agents on shared paths; preserve each commit/worktree; coordinator assigns an integration owner and a conflict-resolution plan. Never force-push or delete another agent's work.
- **Partial execution/crash:** inspect the remote PR, worktree status, commit SHA, test outputs and any DB fixture before deciding whether to resume. Don't replay writes or cleanup steps blindly.
- **Failed or stale CI:** report blocked; rerun after material head changes and record fresh evidence.
- **Uncertain test database:** do not connect. Escalate for verification with non-sensitive metadata and a disposable setup.
- **Security finding or sensitive logs:** stop and follow [SECURITY.md](../../SECURITY.md). Never paste secrets into Issue comments.
- **Merge/release uncertainty:** query authoritative GitHub/package state before any retry, require explicit maintainer authorization.

## Required PR handoff

```markdown
Parent issue / outcome:
Author + independent reviewer + integration owner:
Scope and explicitly excluded behavior:
Dependencies / other PRs / owned paths:
Target base branch and SHA:
Head SHA actually reviewed:
Checks: command, status, environment, CI run URL:
PostgreSQL disposable-environment verification (or NOT RUN):
Regression and failure-path cases:
Compatibility / package and docs impact:
Findings and resolutions / remaining blockers:
Rollback and cleanup considerations:
Maintainer decision needed: merge / release / neither
```

This is a collaboration standard, not an automated scheduler, branch-protection rule or verified sandbox.
