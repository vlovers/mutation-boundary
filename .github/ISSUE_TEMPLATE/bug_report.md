---
name: Bug report
about: Report a reproducible, non-sensitive MutationBoundary defect
title: "bug: "
---

## Disclosure and test-database safety

**Do not publish security vulnerabilities, credentials, connection strings, SQL dumps, row values/keys, production data or exploit details.** Follow [SECURITY.md](../../SECURITY.md) for private reporting. Reproduce only against a **disposable, isolated** PostgreSQL database with synthetic data. A `*_test` database name and confirmation flag do not prove isolation.

## Observed versus expected behavior

Describe what `assertNoMutation` actually reported or threw and what it should report for the **selected tables and columns**. The library compares net state; it does **not** detect transient writes later reverted, concurrent writes or changes outside the selection.

## Minimal sanitized reproduction

1. MutationBoundary version / exact commit:
2. Node.js and PostgreSQL versions, client adapter (`pg.Client`, `pg.Pool`, custom):
3. Synthetic schema and selected table/key/column configuration (no real identifiers):
4. Awaited action and expected error/return:
5. Actual sanitized result or exception:

## Safety and edge-case context

- Disposable DB and restricted role verified independently of naming? (yes/no):
- Pool/connection identity stable across both snapshots? (yes/no/unknown):
- Concurrent writers, background jobs or transactions? (yes/no/unknown):
- Key uniqueness, null keys, unsupported values or snapshot-size limits involved? (yes/no/unknown):
- Driver/action errors sanitized before sharing? (yes/no):

## Verification evidence

- Failing regression test or minimal independent fixture:
- Local checks actually run (`npm test`, `npm run test:postgres`, packaging/consumer checks):
- Exact CI run and commit, if available:
- Not tested / remaining uncertainty:

## Acceptance criteria

- [ ] A sanitized regression test reproduces the defect without sensitive or shared data.
- [ ] The fix preserves fail-closed database identity checks, snapshot limits and exception precedence.
- [ ] PostgreSQL net-state semantics, package exports/types and installed consumer behavior are checked when affected.
- [ ] Actual test results and untested scenarios are recorded.
- [ ] Independent review resolves blocking findings before merge; publishing requires separate authorization.
