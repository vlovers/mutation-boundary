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

## Merge gate
- [ ] Required checks passed
- [ ] Independent review obtained (not author self-review)
- [ ] Blocking findings resolved

Do not merge while any required gate is missing.
