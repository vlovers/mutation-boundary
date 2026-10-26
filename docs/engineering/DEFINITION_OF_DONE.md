# Definition of Done — MutationBoundary

A change is **implemented** when the agreed scope exists, **verified** when relevant checks and independent review have evidence, **accepted** when the maintainer confirms requirements, and **released** only after publication and external verification. These states are distinct.

## Required evidence
- Acceptance criteria, scope, compatibility and explicit non-goals are recorded.
- Describe MutationBoundary accurately as observing net PostgreSQL row-state changes; do not claim it detects transient writes, external effects or all concurrent writes.
- Every bug fix includes a focused regression test. Preserve fail-closed safety, resource limits, public API and package compatibility.
- Record actual Node.js 24 checks as relevant: `npm run typecheck`, `npm test`, `npm run build`, `npm run check:package`, `npm run test:package-audit`, `npm run test:consumer`. PostgreSQL tests run only against an independently verified isolated disposable database using `MUTATION_BOUNDARY_TEST_DATABASE_URL`, database `mutation_boundary_test`, and role `mutation_boundary_ci`; names or confirmation flags alone do not prove disposability.
- Diagnostics must not expose credentials, connection strings, row values or row keys.
- Independent reviewer records identity, reviewed head SHA, findings and disposition. AI review is not authorized GitHub approval. Re-review material changes and resolve blocking findings.
- Documentation matches actual behavior and relevant package/consumer checks are evidenced. Never use production credentials or automatically publish.

Docs-only changes may mark irrelevant runtime checks N/A with a reason; verify changed links and command references. Release requires the separate checklist and explicit maintainer authorization.
