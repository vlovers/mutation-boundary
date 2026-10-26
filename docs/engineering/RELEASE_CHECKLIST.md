# Release checklist

This checklist is a gate, **not authorization** to release.

- [ ] Identify target integration branch, candidate commit SHA, scope, known issues and release owner.
- [ ] Verify Definition of Done and all required CI checks on the actual candidate; disclose unrun or unavailable checks rather than marking them green.
- [ ] Confirm independent review covers the candidate SHA, and resolve blocking findings.
- [ ] Verify applicable project-specific integration, security and compatibility checks; use disposable test environments and never production credentials.
- [ ] Confirm documentation, changelog, version/schema changes and third-party asset/licensing obligations where relevant.
- [ ] Document rollback or recovery, compatibility/migration impact, and how the published artifact or deployed version will be verified.
- [ ] Obtain explicit maintainer authorization before merge, package publication or deployment.
- [ ] After authorized release, verify the actual published artifact or deployment independently; record SHA, version, evidence and unresolved follow-ups.

Special requirements: RuleWitness requires offline package-consumer validation and no automated npm publication; MutationBoundary requires isolated PostgreSQL checks and redacted diagnostics; Estima requires tenant/authorization and migration checks; Last Chapter requires narrative regression and Ukrainian-language review. Do not treat this cross-project list as a replacement for stricter local instructions.
