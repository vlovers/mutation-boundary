# Independent AI review policy

AI review complements CI and maintainer judgment; it does not prove correctness. A different model is useful but not sufficient by itself.

## Inputs

Give the reviewer the PR acceptance criteria, target/base commit, actual diff, affected files, existing tests, and the relevant README/SECURITY/SAFETY contracts. Do not rely on the implementer's prose summary as the primary source of truth.

## Priority order

1. Unsafe or inadequately verified database use; secret/row disclosure in errors or logs.
2. Invalid net-state assertions, missed boundary cases, driver/session/concurrency assumptions and partial cleanup.
3. Backward-incompatible public API, packaging, type definitions, Node version or consumer expectations.
4. Tests that do not exercise the claim, fixtures masking real behavior, and errors lost behind successful exit codes.
5. Complexity, duplication, maintainability, and documentation inconsistency.

## Finding format

Each finding includes severity (blocking/high, medium, low), file and location, actionable explanation, reproducible scenario or evidence, and suggested test/fix. Explicitly say when a concern is an unverified hypothesis.

## Decisions

- High/blocking findings prevent approval until fixed and rechecked.
- Medium findings require a fix or explicit rationale and follow-up issue.
- Reviewer should not silently edit author code or certify unexecuted tests.
- Record reviewer identity, base/head SHA, CI evidence and disposition of findings. Reassess material changes after the reviewed head SHA. AI assessment, even from a different model, is not an authorized GitHub approval.
- Sensitive changes require a second independent review or explicit maintainer security sign-off.
- Docs-only changes can use a lightweight independent review focusing on internal links and factual claims.

Final merge, release tag, and npm publishing are maintainer decisions.
