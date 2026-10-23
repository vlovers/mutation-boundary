# AI engineering instructions

Applies to Codex and other coding agents working in this repository. Read [README.md](README.md), [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and [docs/SAFETY.md](docs/SAFETY.md) before changing behavior. [CLAUDE.md](CLAUDE.md) provides Claude-specific entry points without overriding this document.

## Mission and constraints

MutationBoundary asserts **net PostgreSQL row-state changes** across an awaited operation in disposable test databases. It cannot prove absence of transient writes, external effects, or concurrent writes. Do not describe it as a transaction tracer or a production monitoring product.

- **Never** execute examples or verification against production, shared, sensitive, or non-disposable databases. Never infer disposability from a database name alone.
- Keep credentials, connection strings, row values, and keys out of logs, generated reports, issues, and PR text.
- Preserve fail-closed safety checks, resource limits, package compatibility, and public API semantics unless a reviewed change explicitly requires otherwise.
- Preserve existing source and test changes by other contributors; do not reset, force-push, or silently rewrite unrelated work.
- Do not weaken test assertions, skip checks, or invent evidence to obtain a green result.
- No automatic npm publishing, release tagging, merging, or production deployments.

## Delivery workflow

1. **Discover:** inspect current branch, open PRs/issues, implementation, tests, and existing docs. Note existing patterns and any user changes.
2. **Plan:** specify the user-visible outcome, in-scope files, compatibility requirements, risk, verification, and acceptance criteria.
3. **Implement:** favor one cohesive, reviewable feature over many trivial PRs. For parallel agents use isolated branches/worktrees and agree on shared contracts in advance.
4. **Verify:** run checks relevant to changed behavior. Record the exact commands, environments, and failures.
5. **Review:** arrange independent AI or human review for meaningful changes; reviewers inspect requirements and diff independently of the implementer's summary. Security, DB safety, package/release work require enhanced review.
6. **Deliver:** use the [PR template](.github/PULL_REQUEST_TEMPLATE.md), satisfy [Definition of Done](docs/engineering/DEFINITION_OF_DONE.md), and follow [release checklist](docs/engineering/RELEASE_CHECKLIST.md) for publishing.
7. **Handoff:** report resulting commit, checks actually executed, outstanding findings, blockers and next action.

## Verification commands

Use Node.js 24+ and the committed lockfile. Prefer `npm ci --ignore-scripts --no-audit --no-fund` for clean installs.

```sh
npm run typecheck
npm test
npm run build
npm run check:package
npm run test:package-audit
npm run test:consumer
```

For actual PostgreSQL integration tests, configure **only an isolated disposable database**, following CONTRIBUTING.md and CI, before running `npm run test:postgres`. Release candidates additionally require the scripts in `npm run check:release` and the applicable CI jobs; do not claim those ran merely because this file lists them. For a published package, verify clean registry consumer installation when releasing.

## Pull request review

The implementer and independent reviewer should be separate sessions/context where practical. Reviewers prioritize correctness, misuse of DB safety settings, data exposure, API compatibility, error handling, race assumptions, and test effectiveness over style. Classify findings as blocking or non-blocking, link code locations and provide reproduction when possible.

Documentation-only PRs may mark non-applicable runtime checks N/A with reasoning; link checks relevant to docs such as changed internal Markdown links. Approval and merge remain human-controlled.
