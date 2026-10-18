# Release process and historical verification checklist

MutationBoundary v0.2.0 is the current released experimental version; v0.1.0 was the initial release. Package listing: [mutation-boundary on npm](https://www.npmjs.com/package/mutation-boundary).

The library must only be used against disposable, isolated PostgreSQL test databases. The published API is experimental and does not guarantee detection of transient, rolled-back, or concurrent writes.

## Release verification

The following items were part of the original v0.1.0 pre-release checklist. Checked items are evidenced by the repository history; unchecked items require explicit verification and are **not** claims that release validation failed.

- [ ] Confirm the published npm tarball metadata, exports and contents match the GitHub v0.1.0 source. Run `npm run test:registry -- mutation-boundary@0.1.0` to validate a registry-installed consumer; that smoke **does not establish byte-for-byte source provenance**.
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

## Automated future npm releases

The [publish.yml](../.github/workflows/publish.yml) workflow triggers when a version tag such as `v0.2.0` is pushed. It validates that the tag matches `package.json`, runs TypeScript/unit/PostgreSQL/package-consumer checks, and then publishes with npm Trusted Publishing (OIDC) without a stored npm token.

**One-time npm setup (required):** on the `mutation-boundary` npm package settings page, configure Trusted Publisher → GitHub Actions with owner `vlovers`, repository `mutation-boundary`, workflow filename `publish.yml`, and no GitHub environment. OIDC cannot work before this npm-side trust is established.

For the next release:
1. Review changes and update version via `npm version patch` (or minor/major), making sure `package-lock.json` matches.
2. Push the version commit to `main`, await green CI, then push its `vX.Y.Z` tag.
3. Watch the [publish workflow](https://github.com/vlovers/mutation-boundary/actions/workflows/publish.yml) and verify the new version on npm.
4. Create a GitHub Release with reviewed notes from the same tag. GitHub Releases are not yet automatically created.

Already-published `0.1.0`, `0.1.1`, and `0.2.0` cannot be re-published under the same version. Do not re-run completed publish workflows for existing versions: npm may reject them with a staged-version or immutable-version conflict. Do not change the tag/version mapping to bypass npm's immutable version rule.

This workflow does **not** automatically bump versions or release every commit; publishing is deliberately an explicit version-tag event.
