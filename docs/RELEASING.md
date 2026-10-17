# Release checklist (v0.1.0)

No automatic npm publication until every gate is verified.

- [ ] `npm run typecheck`, `npm test`, `npm run test:postgres`, `npm run build` pass on the final commit.
- [ ] PostgreSQL integration tests cover INSERT, UPDATE, DELETE, JSONB, timestamps, action throws, empty/large snapshots, unsafe identifiers and identity mismatches.
- [ ] Verify the safety check and snapshots use an appropriate pinned connection, or explicitly constrain the supported adapter API.
- [ ] Remove or harden low-level exports that expose raw row values without the safety guard.
- [ ] Audit action-error and driver-error propagation for sensitive information.
- [ ] Run `npm pack --dry-run` and inspect included files; exclude tests, secrets and local build caches.
- [ ] Install the generated tarball into a **separate** Node 24 TypeScript consumer and check both runtime exports and declaration resolution.
- [ ] Verify actual npm name availability with the npm registry and publishing permissions. Search results alone do not reserve the name.
- [ ] Add a lockfile and switch CI to `npm ci` for reproducibility.
- [ ] Confirm MIT license, README, security policy, changelog and repository links.
- [ ] Verify Estima issue #10 regression: fails before the application fix and passes after it.
- [ ] Merge reviewed PRs and tag a release only after green checks.
- [ ] Publish an experimental 0.1.0 package only with explicit release approval.

Recommended publishing approach: npm provenance via GitHub Actions OIDC and npm trusted publishing, no long-lived npm token. Publish from a protected release workflow after reviewing its exact permissions.
