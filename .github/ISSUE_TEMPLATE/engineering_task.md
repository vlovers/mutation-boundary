---
name: Engineering task
about: Propose a scoped engineering, maintenance or quality task
title: "task: "
---

## Desired outcome

What user-visible or operational problem are we solving?

## Existing evidence

Link relevant files, PRs, tests and prior issues. Identify the exact baseline commit and distinguish implemented, unit-tested, disposable-PostgreSQL-verified, independently accepted, merged and published.

## Scope and non-goals

**In scope:**

**Out of scope:**

## Acceptance criteria

- [ ] A concrete behavior or artifact can be verified.
- [ ] Relevant unit, integration and end-to-end evidence is specified.
- [ ] Disposable, restricted PostgreSQL fixtures are used; identity guardrails are not treated as proof of isolation.
- [ ] Net-state limitations (transient/reverted writes, unselected tables and concurrent writers), snapshot limits and fail-closed error behavior are considered.
- [ ] Public API/types, packed package and clean installed consumers are verified where affected. Mark non-applicable checks N/A with a reason.
- [ ] Security, compatibility and rollback implications are evaluated.
- [ ] Independent reviewer findings, exact commit/CI evidence and untested scenarios are recorded; npm publication is separately authorized.

## Dependencies and risks

- Blocked by:
- Related PR:
- Rollback / migration:
- Required independent reviewer:
- Unverified assumptions:
