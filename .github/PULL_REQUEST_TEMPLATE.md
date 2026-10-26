## Purpose and scope
- Linked issue:
- Acceptance criteria:
- Changes made:
- Out of scope:

## Project-specific checks
- [ ] `npm run typecheck`, `npm test`, `npm run build`.
- [ ] If PostgreSQL behavior changed, run `npm run test:postgres` only against disposable `mutation_boundary_test` with the dedicated `mutation_boundary_ci` role and `MUTATION_BOUNDARY_TEST_DATABASE_URL`.
- [ ] Diagnostics contain no row values, keys, credentials, or connection strings; bug fix includes regression test.

## Verification evidence
Record commands and results (do not check a box for an unrun command).
- [ ] Formatting / lint
- [ ] Typecheck (if applicable)
- [ ] Unit / integration tests
- [ ] Build (if applicable)
- [ ] Smoke / end-to-end tests (if applicable)
- [ ] Negative / failure-path regression tests (if applicable)

CI run links and known failures:

## Risk, documentation and release
- Security / authorization / secrets / data impact:
- Documentation and migration changes:
- Rollback or recovery plan (if applicable):
- Unresolved risks / blockers:


## MutationBoundary database safety gates
- [ ] Every bug fix includes a focused regression test.
- [ ] PostgreSQL tests, if relevant, use only an independently verified disposable, isolated database via `MUTATION_BOUNDARY_TEST_DATABASE_URL`, database `mutation_boundary_test`, and role `mutation_boundary_ci`; names/confirmation flags alone do not establish disposability.
- [ ] Diagnostics/logs/reports contain no credentials, connection strings, row values or row keys.
- [ ] Broad API additions/new database adapters discussed before implementation; release/package checks are reported with exact evidence.

See [Definition of Done](../docs/engineering/DEFINITION_OF_DONE.md), [independent review policy](../docs/engineering/REVIEW_POLICY.md), and [release checklist](../docs/engineering/RELEASE_CHECKLIST.md).

## Merge gate
- [ ] Required checks passed
- [ ] Independent review obtained (not author self-review)
- [ ] Blocking findings resolved

Do not merge while any required gate is missing.
