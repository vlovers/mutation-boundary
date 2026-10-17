# Security policy

MutationBoundary is experimental and intended exclusively for disposable PostgreSQL integration-test databases. **Never run it against production or shared data.**

## Reporting vulnerabilities

Please report security issues privately through the repository's GitHub Security Advisories, if enabled, rather than opening a public issue containing credentials or sensitive database content.

Do not attach connection strings, access tokens, SQL dumps or customer records to bug reports.

## Threat model

- A database named `*_test` is not necessarily disposable; naming and role checks are only guardrails.
- The current low-level APIs can expose raw rows and must not be used with secrets.
- Query-driver errors and exceptions from user-supplied actions can contain sensitive information.
- Snapshot comparisons cannot prove that no transient write occurred, and cannot observe other systems.
- Concurrent writers, asynchronous jobs and pooled connection switching can invalidate assumptions.

See [docs/SAFETY.md](docs/SAFETY.md).
