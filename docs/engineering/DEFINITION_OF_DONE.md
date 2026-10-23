# Definition of Done

The conditions below determine whether a change is **implemented**, **verified**, **accepted**, and (separately) **released**. A green CI run is not itself a release approval.

## Implementation

- The PR includes a concise user/developer-facing outcome, linked issue when available, acceptance criteria, and out-of-scope decisions.
- Any changed public API/CLI semantics, safety behavior, Node support, and failure modes are documented and compatibility impact is stated.
- New behavior has appropriate regression tests including expected success, failure, uncertain/unsupported cases, and cleanup.
- Database changes retain explicit disposable-database authorization and do not reveal raw row values or secrets.
- No unrelated code or test changes, disabled tests, unsafe fallback, or silent broadening of supported behavior.

## Verification

- Record exactly which commands were executed and their outcomes. Do not infer local verification from CI or vice versa.
- Default checks for code changes: `npm run typecheck`, `npm test`, `npm run build`, and relevant package verification.
- For DB behavior: run `npm run test:postgres` **only** against verified disposable PostgreSQL, plus relevant ORM/HTTP consumers as appropriate.
- For packaging/release changes: run package audit, packed consumer and version-specific release checks on the exact proposed commit.
- For documentation-only changes: check links, references, command names and accuracy; runtime tests may be N/A with an explanation.
- Any failed or unexecuted required check must be a visible blocker, not represented as passing.

## Independent review and acceptance

- A separate reviewer examines acceptance criteria, full diff, safety boundary, public API compatibility and test value.
- Resolve blocking correctness/security/data-safety/compatibility findings, then revalidate changed behavior.
- PR template records reviewer, evidence, remaining risks, and rollback/restore plan where relevant.
- Maintainer accepts the scope and authorizes merge; a release requires **separate** approval and the [release checklist](RELEASE_CHECKLIST.md).

## States

`Implemented`: code/docs authored.  
`Verified`: applicable tests and review evidence exist.  
`Accepted`: maintainer confirms acceptance criteria.  
`Released`: publication completed and independently confirmed.
