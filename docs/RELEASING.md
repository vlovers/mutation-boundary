# Release checklist (v0.1.0)

No automatic npm publication until every gate is verified. The package remains `private: true` in this release candidate; explicitly remove it only in the approved publishing change.

- [ ] `npm run typecheck`, `npm test`, `npm run test:postgres`, `npm run build` pass on the final commit.
- [ ] PostgreSQL integration tests cover INSERT, UPDATE, DELETE, JSONB, timestamps, action throws, empty/large snapshots, unsafe identifiers and identity mismatches.
- [ ] Verify the safety check and snapshots use an appropriate pinned connection, or explicitly constrain the supported adapter API.
- [x] Remove low-level exports that expose raw row values without the safety guard.
- [ ] Review error propagation: `MutationBoundaryError` redacts row values and keys; the original thrown action error and driver errors are forwarded and may themselves contain sensitive values. Document that callers must sanitize their own errors.
- [ ] Verify final CI tarball inspection: `npm pack --dry-run`, archive file allowlist and exclusion of tests, secrets and build caches.
- [ ] Confirm final CI passes the independent Node 24 ESM/CommonJS/TypeScript tarball consumer checks.
- [ ] Verify actual npm name availability with the npm registry and publishing permissions. Search results alone do not reserve the name.
- [x] Add a lockfile and switch CI to `npm ci` for reproducibility.
- [x] Confirm MIT license, README, security policy, changelog and repository links.
- [ ] Verify Estima issue #10 regression: fails before the application fix and passes after it.
- [ ] Merge reviewed PRs and tag a release only after green checks.
- [ ] Publish an experimental 0.1.0 package only with explicit release approval.

Recommended publishing approach: npm provenance via GitHub Actions OIDC and npm trusted publishing, no long-lived npm token. Publish from a protected release workflow after reviewing its exact permissions.
