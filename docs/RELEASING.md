# Release notes and verification checklist (v0.1.0)

MutationBoundary v0.1.0 is the initial experimental release. Package listing: [mutation-boundary on npm](https://www.npmjs.com/package/mutation-boundary).

The library must only be used against disposable, isolated PostgreSQL test databases. The published API is experimental and does not guarantee detection of transient, rolled-back, or concurrent writes.

## Release verification

The following items were part of the original pre-release checklist. Checked items are evidenced by the repository history; unchecked items require explicit verification and are **not** claims that release validation failed.

- [ ] Confirm the published npm tarball metadata, exports and contents match the GitHub v0.1.0 source.
- [x] GitHub Actions on documentation head `599f9479ace26155b85abb26464edb3cce0ffb07` passed `npm run typecheck`, `npm test`, `npm run test:postgres`, `npm run build`, and `npm run test:consumer` ([run 39070196988](https://github.com/vlovers/mutation-boundary/actions/runs/39070196988)). This proves source CI, not npm tarball identity.
- [x] GitHub Actions successfully ran `npm pack --dry-run` on commit `599f9479ace26155b85abb26464edb3cce0ffb07`. The exact published npm tarball contents remain unverified.
- [ ] Confirm PostgreSQL integration coverage for INSERT, UPDATE, DELETE, JSONB, timestamps, action throws, empty/large snapshots, unsafe identifiers and identity mismatches.
- [ ] Confirm snapshots and safety checks use a pinned connection or a documented adapter constraint.
- [x] Do not export low-level snapshot helpers that expose raw row values without the safety guard.
- [ ] Verify Estima issue #10 regression: fails before the application fix and passes after it.
- [ ] Confirm that the npm account and package maintainers are authorized to publish future versions.
- [ ] Verify Git tag/release `v0.1.0` points to the source corresponding to the published artifact.

## Security and release process

`MutationBoundaryError` redacts row values and keys from its high-level report. The original action error and driver errors may contain sensitive details and should be sanitized by callers before logging or sharing.

The package uses `publishConfig.access: public` and currently advertises Node.js 24+. Publishing a version does not by itself establish that every verification item above passed.

For future releases, prefer npm trusted publishing with GitHub Actions OIDC, explicit minimal workflow permissions, a protected release process and npm provenance. Avoid long-lived npm tokens.

See [README](../README.md), [Safety](SAFETY.md), [Architecture](ARCHITECTURE.md), [Security policy](../SECURITY.md), and [Contributing](../CONTRIBUTING.md).
