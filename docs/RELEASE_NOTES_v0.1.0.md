# MutationBoundary v0.1.0

Initial experimental release of **MutationBoundary**, a TypeScript assertion helper for detecting unexpected net PostgreSQL row changes after an awaited operation in isolated integration tests.

## Highlights

- **`assertNoMutation()`** compares selected PostgreSQL table snapshots before and after a test action.
- Detects surviving **INSERT**, **UPDATE** and **DELETE** changes, including JSONB and timestamp updates.
- Supports a `pg.Client`, `pg.Pool`, or compatible query adapter with documented connection constraints.
- Uses explicit database/user checks and a disposable-database confirmation guard.
- Produces redacted mutation summaries without exposing changed row values or keys.
- Provides TypeScript declarations and Node.js 24+ ESM packaging.

## Install

```bash
npm install --save-dev mutation-boundary@0.1.0
```

## Verified source checks

GitHub Actions [run 39070196988](https://github.com/vlovers/mutation-boundary/actions/runs/39070196988) succeeded for commit `599f9479ace26155b85abb26464edb3cce0ffb07`: typecheck, unit tests, PostgreSQL integration tests, build, npm package dry-run, packaged consumer smoke test and ESM import smoke test.

**Artifact identity:** The published npm tarball has not been independently compared against this Git revision. Verify it before claiming provenance or byte-for-byte correspondence.

## Limitations

Only the **net state** of explicitly selected tables is checked. Rollbacks and changes later restored to their initial values are not detected. Concurrent writers, unselected tables, external services, and sequences fall outside reliable coverage. **Never use production databases or credentials**; this tool is intended for isolated disposable test environments.

See [README](https://github.com/vlovers/mutation-boundary#readme), [Safety](https://github.com/vlovers/mutation-boundary/blob/main/docs/SAFETY.md), and [real-world regression example](https://github.com/vlovers/mutation-boundary/blob/main/docs/EXAMPLE.md).

MIT licensed. The v0.1.0 API is experimental.
