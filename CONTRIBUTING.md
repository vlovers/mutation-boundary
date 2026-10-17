# Contributing

Issues and narrowly scoped pull requests are welcome. Please discuss new database adapters or broad API additions before implementation: v0.1 focuses on PostgreSQL net-state assertions.

## Local checks

Use Node.js 24+.

```sh
npm install
npm run typecheck
npm test
npm run build
```

For PostgreSQL integration tests, provision a **disposable** database named `mutation_boundary_test` and role `mutation_boundary_ci`, set `MUTATION_BOUNDARY_TEST_DATABASE_URL`, and run `npm run test:postgres`. Do not use production credentials.

Keep new diagnostics free of row values and keys. Add a regression test for every bug fix. Do not log credentials, connection strings or database rows in issues and CI.
