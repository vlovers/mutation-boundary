# MutationBoundary v0.1.1

Reliability-only patch release. No new public API.

## Changes
- Validate snapshot values before running the action; fail closed for ambiguous unsupported values or cyclic objects.
- Extend real PostgreSQL regression coverage for nested JSONB, bytea, NULL, rollback and pool behavior.
- Ensure pooled client cleanup is tested when an action or after-snapshot fails.
- Add clean npm registry consumer validation to CI (tests published v0.1.0).
- Update release documentation and roadmap.

## Compatibility and limits
- Requires Node.js 24+; PostgreSQL testing is designed for disposable, isolated databases only.
- Custom database adapters that return unsupported JS values may now throw where earlier builds could silently compare ambiguously.
- Detects final net changes only, not transient/rolled-back writes. Concurrency and asynchronous background work remain unsupported.
- Single-connection pools may deadlock when the callback obtains another connection from the same pool.

## Verification before publish
- [ ] Confirm release PR CI passes PostgreSQL 16, Node 24, typecheck, unit tests, source tarball consumer and registry-installed 0.1.0 consumer.
- [ ] Confirm package-lock version matches package.json and the release build exports/types resolve.
- [ ] Confirm npm Trusted Publisher is configured for `vlovers/mutation-boundary` with workflow `publish.yml`.
- [ ] After merge, confirm CI on main and immutable `v0.1.1` tag points to the reviewed source.
- [ ] Confirm npm publish workflow succeeds and registry returns 0.1.1.
- [ ] Publish GitHub Release from precisely the same tag.

Do not treat this document as evidence that npm publication or tag creation occurred.
