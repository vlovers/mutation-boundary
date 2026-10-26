# Independent review policy

Every change requires an independent assessment of the actual base-to-head diff, acceptance criteria, tests, documentation and security implications. The author and the reviewer must be distinct. A second AI model may supply useful independent technical findings, but **AI feedback is not an authorized GitHub approval**. Required human approvals and branch protections must still be satisfied.

Record the reviewer, reviewed head SHA, scope, evidence, and each finding with severity, concrete failure scenario and resolution. Security/correctness findings of high severity block acceptance. Material changes after review require a fresh review or documented revalidation. A green CI run is not a substitute for independent review.

Project-specific focus:
- RuleWitness: independent permission oracle, unknown-vs-allow semantics, provider conformance limits, package safety.
- MutationBoundary: isolated PostgreSQL, no leaked row values or credentials, negative mutation cases.
- Estima: tenant isolation, atomic authorization/mutations, JWT lifecycle, migrations.
- Last Chapter: narrative knowledge boundaries, deterministic flags/consequences, Ukrainian copy, asset provenance.

No reviewer may silently merge, deploy, publish or weaken security settings without explicit maintainer authorization.
