# Real-world regression: a failed request that still writes

MutationBoundary's first integration is [Estima issue #10](https://github.com/vlovers/estima/issues/10), exercised in [experimental PR #11](https://github.com/vlovers/estima/pull/11).

## The problem

An API request can return HTTP 500 after an earlier database write has already committed. Checking only the response status misses the surviving change.

## Test pattern

```ts
import { assertNoMutation } from '@vlovers/mutation-boundary';

it('does not partially update a task when clarification fails', async () => {
  await assertNoMutation({
    db: dedicatedTestDb,
    tables: [{ name: 'tasks', key: 'id' }],
    safety: {
      expectedDatabase: 'application_test',
      expectedUser: 'application_test_user',
      confirmDisposableTestDatabase: true,
    },
    action: async () => {
      await request(app.getHttpServer())
        .patch('/api/tasks/123/clarify')
        .send(invalidPayload)
        .expect(500);
    },
  });
});
```

Replace the illustrative table, route, credentials and payload with your own test fixtures. The test requires a disposable, isolated PostgreSQL database and an HTTP test client; it is not a standalone executable demo.

When a row survives the failed operation, the assertion fails with a **redacted** summary:

```text
Unexpected mutations after operation

tasks: 1 updated

Database mutation contract violated.
```

After the application fix prevents the partial write, the same assertion passes. This is a *net state* check: it cannot detect a write that was later rolled back or restored, concurrent writes, or mutations outside the selected tables.

## Why code instead of a GIF?

A short failing test and its output are copyable, searchable, accessible, and reviewable in pull requests. A terminal recording may be added later as a supplement, but should not replace the runnable example.
