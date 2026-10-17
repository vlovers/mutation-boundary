# MutationBoundary

**Experimental, unpublished** TypeScript helper for detecting *net committed PostgreSQL row changes* around failed HTTP requests, background jobs, and integration-test actions.

MutationBoundary answers: **“The API returned an error; did it leave unexpected data behind?”**

The first real characterization test runs against [Estima issue #10](https://github.com/vlovers/estima/issues/10) in [Estima Draft PR #11](https://github.com/vlovers/estima/pull/11). An injected PostgreSQL failure after clarification results in HTTP 500 **while the task status has already changed**. This helper reveals that surviving row change.

## Development

Requires Node.js 24+.

```sh
npm install
npm run typecheck
npm test
npm run build
```

No package has been published to npm.

## Concept API (test databases only)

```ts
import { observeFailureBoundary } from 'mutation-boundary';

const changes = await observeFailureBoundary(
  db, // TypeORM DataSource or pg Client/Pool query() interface
  [
    { name: 'tasks', key: 'id' },
    { name: 'estimates', key: 'id' }
  ],
  async () => {
    await request(app.getHttpServer())
      .patch('/api/tasks/123/clarify')
      .send(payload)
      .expect(500);
  }
);

expect(changes).toEqual([]);
```

The helper returns `inserted`, `deleted`, and `updated` entries with before/after row data. It does not log or redact those values by default.

## Important limitations

**Do not connect this prototype to a production or shared database.** The current API does **not** enforce disposable DB isolation. It may snapshot sensitive columns and operates by reading entire selected tables up to the configured per-table limit (default 5000). Never log raw diffs if data may contain secrets.

- Observes only **net state** after the awaited action; transient writes, rolled-back writes, and reversed changes are not visible.
- Only specified tables are checked; external effects, sequences, async work finishing after the action and unselected tables are invisible.
- Snapshots are sequential, **not a single cross-table consistent transaction snapshot**.
- Assumes a quiet test DB without unrelated concurrent writers and a stable unique row key.
- Currently supports simple table/key identifiers, not schemas or composite keys.
- Does not automatically check the expected HTTP status; do so in the supplied action.
- An action that rejects propagates its error rather than converting that into a false PASS.

**Not yet ready for an npm release.** Before a stable API, implement a fail-closed disposable database guard, safe/redacted diagnostic formatter, PostgreSQL integration coverage, and tests for unsupported drivers/types.

## Why not manual SQL assertions?

Focused SQL assertions are often preferable for one or two fields. MutationBoundary becomes useful if a failure scenario might leave *unexpected INSERT/UPDATE/DELETE changes across several tables* and a structured diff makes the failure quicker to diagnose.

This repository is an experiment. It will be archived if it does not deliver measurable value over normal integration-test assertions.

MIT licensed.
