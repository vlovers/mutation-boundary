# Contributing

Issues and narrowly scoped pull requests are welcome. MutationBoundary is an **experimental PostgreSQL net-state assertion library** (current package version: v0.6.0). Discuss broad API changes or additional database adapters before implementation. Read [the safety contract](docs/SAFETY.md), [security policy](SECURITY.md), and [agent instructions](AGENTS.md) before changing behavior.

## Local verification

Use Node.js 24+ and the committed npm lockfile. For a clean, reproducible install consistent with CI:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run typecheck
npm test
npm run build
npm run check:package
npm run test:package-audit
npm run test:consumer
```

These checks do **not** replace real PostgreSQL integration tests. Run `npm run test:postgres` only after independently provisioning and verifying an **isolated, disposable, quiescent** PostgreSQL database and restricted credentials. The integration suite expects `MUTATION_BOUNDARY_TEST_DATABASE_URL`, database `mutation_boundary_test`, and session role `mutation_boundary_ci`. **Matching names and an explicit confirmation flag are not proof of disposability.** Never point the suite at production, shared, or sensitive data. CI provisions its own PostgreSQL 16 service; follow [the workflow](.github/workflows/ci.yml) for its tested setup.

Changes to adapters, database safety, packaging or releases may also require the TypeORM/NestJS/Jest/Vitest integration consumers and `npm run check:release` (which includes the release-candidate tests). Record which checks were actually run, which were not run, and why. A passing CI run on an earlier SHA is not evidence for a changed head.

## Pull requests and releases

Use [the PR template](.github/PULL_REQUEST_TEMPLATE.md) and [Definition of Done](docs/engineering/DEFINITION_OF_DONE.md). Include acceptance criteria, compatibility and database-safety impact, exact verification results, and a rollback or mitigation path where relevant. Request independent review of meaningful changes, especially database behavior and releases. Do not merge, tag or publish without maintainer authorization.

Keep diagnostics and issue reports free of credentials, connection strings, row values, row keys and sensitive driver errors. Add focused regression coverage for every bug fix. MutationBoundary observes **net state only**: it cannot prove absence of transient writes, concurrent writes, or effects outside the selected PostgreSQL rows.
