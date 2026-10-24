# Contributing to MutationBoundary

MutationBoundary v0.6.0 is an experimental PostgreSQL **net-state** assertion library for disposable integration-test databases. It does not prove that no transient write occurred and cannot observe unselected tables, concurrent writers or external systems. Read [SECURITY.md](SECURITY.md) and [docs/SAFETY.md](docs/SAFETY.md) before testing it.

## Issue intake and disclosure

Search existing issues and PRs first. Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md) for sanitized, reproducible non-security defects and the [engineering task template](.github/ISSUE_TEMPLATE/engineering_task.md) for scoped proposals. Include exact versions, regression evidence, non-goals and unresolved assumptions.

**Never publish a vulnerability, credential, database URL, SQL dump, row value, row key, customer record or exploitable reproduction in a public issue.** Use the private disclosure process in [SECURITY.md](SECURITY.md). Use synthetic fixtures and redact driver exceptions: library-generated mutation summaries contain counts/table names, but errors from user actions and database drivers can contain sensitive content.

## Local checks

Use Node.js 24+ and the committed lockfile:

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run test:release-candidate
npm run test:package-audit
npm run check:package
npm run test:consumer
```

For PostgreSQL integration tests, provision a **disposable, isolated** database named `mutation_boundary_test` with a restricted role `mutation_boundary_ci`, set `MUTATION_BOUNDARY_TEST_DATABASE_URL` to that disposable instance and run `npm run test:postgres`. The database name and explicit confirmation flag are only guardrails, not proof of isolation. Never use shared/production databases or credentials. The CI workflow additionally tests NestJS/TypeORM, Jest/Vitest and an external PostgreSQL consumer; report local coverage separately from those CI jobs.

## Behavior and compatibility

Add a regression test for each bug fix. Preserve fail-closed handling of unsafe database identity, unsupported snapshot values, duplicate/non-null key requirements, size limits and action failures. The v0.6.0 snapshot canonical representation is capped at **32 MiB per snapshot** across selected tables; this does not bound overall process memory or driver buffers. Keep tests small, isolated and free of concurrent writers.

Public compatibility includes `assertNoMutation`, package exports/types, Node.js 24+, PostgreSQL integration and clean installed-package consumers. New adapters, API changes or behavior that changes snapshot/exception precedence require a documented rationale and separate review. Do not publish internal snapshot helpers as public exports by accident.

## PR acceptance and releases

Explain what changed, exact commit, tests and CI run links, packaging/API impact, PostgreSQL safety impact, migration/rollback implications and known gaps. **Green CI is not independent acceptance**; blocking reviewer findings must be resolved before merging. npm publishing and release tagging require separate authorization and provenance checks. Never publish a package merely because the release workflow or preflight passes.
