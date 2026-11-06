# Claude Code instructions

Follow [AGENTS.md](AGENTS.md) as the shared engineering contract; it applies to Claude Code as well as Codex. Do not duplicate or override database safety rules here.

- Before code changes, read README.md, CONTRIBUTING.md, SECURITY.md, docs/SAFETY.md and the relevant code/tests.
- Prefer Explore → Plan → Implement → Verify → Independent Review → Handoff.
- If working alongside another agent, follow [the multi-agent delivery protocol](docs/engineering/MULTI_AGENT_WORKFLOW.md): use your own Git branch/worktree, record owned paths in the parent Issue, and avoid concurrent edits to shared contracts.
- Reviewers should read the actual diff and acceptance criteria, not rely on another agent's completion statement.
- Never use live, shared, or sensitive PostgreSQL databases for testing; never claim test results without executing commands.
- Before a release, follow docs/engineering/RELEASE_CHECKLIST.md. Do not tag, publish, or merge without explicit maintainer authorization.
