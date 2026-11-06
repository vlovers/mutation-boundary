## Outcome and scope

Describe the concrete change for consumers or maintainers.

**Linked issue:** <!-- e.g. Closes #123; omit if no issue -->

**Acceptance criteria:**

- [ ]

**Explicitly out of scope:**

## Multi-agent ownership and integration

- Delivery owner, integration owner and independent reviewer:
- Dedicated worktree / branch and reserved files:
- Related PRs, overlapping changes and dependency order:
- Exact base SHA and final head SHA reviewed:
- Changes since the last independent review (or none):
- [ ] No unrelated changes, conflicting worktree writes or unreviewed integration edits
- [ ] No duplicate PR or CI rerun created solely for evidence

See [multi-agent workflow](../docs/engineering/MULTI_AGENT_WORKFLOW.md).

## Verification (report actual results)

| Check | Result (PASS / FAIL / N/A / NOT RUN / QUEUED / STALE) | Evidence / reason |
| --- | --- | --- |
| Typecheck / unit tests | | |
| Build / package checks | | |
| PostgreSQL integration (disposable DB only) | | |
| Consumer / registry checks (if applicable) | | |
| Documentation and links | | |

For every applicable check, identify the **tested head SHA**, exact command, environment, CI run URL and relevant artifact. Never report a check from an earlier SHA as passing for the final diff.

- PostgreSQL service/fixture and cleanup evidence (or N/A):
- Consumer package version and isolated test environment (or N/A):
- Artifact owner, access scope, expiry and reproduction steps:
- Redactions: no secrets, tokens, personal data or production database exports in evidence.
- Remaining unverified claims and reason:

## Risk and compatibility

- Public API / Node / type definitions:
- Safety, secrets and database scope:
- Race or transaction assumptions:
- Rollback / release impact:

## Independent review

- Reviewer/session (not the author):
- Exact diff and head SHA reviewed:
- Findings, severity and resolution evidence:
- Outstanding blockers and follow-up owner:
- [ ] Review remains valid after the final change, or was repeated on the final SHA

## Definition of Done

- [ ] Relevant acceptance criteria implemented
- [ ] Required checks executed, or N/A/not run explicitly justified
- [ ] No unresolved blocking correctness/security/data-safety findings
- [ ] Documentation and limitations accurately describe behavior
- [ ] Release approval tracked separately (if applicable)

See [Definition of Done](../docs/engineering/DEFINITION_OF_DONE.md), [review policy](../docs/engineering/REVIEW_POLICY.md) and [release checklist](../docs/engineering/RELEASE_CHECKLIST.md).
