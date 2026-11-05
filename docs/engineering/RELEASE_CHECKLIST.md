# Package release checklist

This checklist applies to MutationBoundary npm releases. It does **not** authorize publishing. Follow existing workflows and version-specific documented requirements in addition to these checks.

## Before release

- [ ] Confirm the intended version, changelog, current `main` SHA, open issues/PRs, outstanding security findings, and semantic-version impact.
- [ ] Obtain independent review of public API, TypeScript declarations, safety behavior, errors, and compatibility changes.
- [ ] Verify exact release commit and clean lockfile install on supported Node versions; run typecheck, tests, build, package audit and consumer checks.
- [ ] Verify PostgreSQL integration and ORM/HTTP consumers only in isolated disposable databases; never run against shared or production data.
- [ ] Inspect actual packed tarball contents, exports and typings; independently install the tarball in a clean external consumer.
- [ ] Check package version, lockfile root version, changelog, repository tag and publishing workflow expectations match.
- [ ] Confirm Actions permissions/pins, registry authentication/provenance and no credentials or row contents are present in artifacts/logs.
- [ ] Record unresolved limitations (net-state only; no transient/external/concurrent-write guarantee), manual checks and rollback/mitigation.
- [ ] Get explicit maintainer approval before creating a release or triggering publishing.

## After release

- [ ] Verify published npm registry version and dist-tag independently of cached local state.
- [ ] Install **registry** package in clean consumer and test imports, typings and representative PostgreSQL assertions against disposable DB.
- [ ] Confirm GitHub release/tag, npm provenance if supported, release notes and download artifact correspond to intended commit.
- [ ] Record links to exact Actions run, release/tag and consumer verification, plus any known follow-up issues.

If any mandatory safety or publishing check is blocked, mark release **not approved**; do not replace it with a mock or assumption.
