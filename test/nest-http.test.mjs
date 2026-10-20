import assert from 'node:assert/strict';
import { test } from 'node:test';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Controller, Module, Patch } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { assertNoMutation, MutationBoundaryError, assertDisposableDatabase } from '../src/index.ts';

const url = process.env.MUTATION_BOUNDARY_TEST_DATABASE_URL;
if (!url) throw new Error('Disposable PostgreSQL URL required');
const safety = {
  expectedDatabase: 'mutation_boundary_test',
  expectedUser: 'mutation_boundary_ci',
  confirmDisposableTestDatabase: true,
};
const table = 'boundary_nest_http_probe';
test('NestJS HTTP 500 exposes committed partial writes, but rolled-back writes pass', async () => {
  const ds = new DataSource({ type: 'postgres', url, entities: [], synchronize: false, extra: { max: 4 } });
  await ds.initialize();
  let app;
  try {
    await assertDisposableDatabase(ds, safety);
    await ds.query('CREATE TABLE ' + table + ' (id integer PRIMARY KEY, state text NOT NULL)');
    class FailureController {
      async partial() {
        await ds.query("INSERT INTO " + table + " VALUES (1, 'private HTTP partial value')");
        throw new Error('intentional endpoint failure');
      }
      async atomic() {
        await ds.transaction(async manager => {
          await manager.query("INSERT INTO " + table + " VALUES (2, 'private rollback value')");
          throw new Error('intentional transaction failure');
        });
      }
    }
    Controller('boundary')(FailureController);
    Patch('partial')(FailureController.prototype, 'partial',
      Object.getOwnPropertyDescriptor(FailureController.prototype, 'partial'));
    Patch('atomic')(FailureController.prototype, 'atomic',
      Object.getOwnPropertyDescriptor(FailureController.prototype, 'atomic'));
    class HttpModule {}
    Module({ controllers: [FailureController] })(HttpModule);
    app = await NestFactory.create(HttpModule, { logger: false });
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address();
    assert.ok(address && typeof address !== 'string');
    const endpoint = 'http://127.0.0.1:' + address.port + '/boundary/';
    async function request(name) {
      const response = await fetch(endpoint + name, { method: 'PATCH' });
      assert.equal(response.status, 500);
    }
    const options = { db: ds, safety, tables: [{ name: table, key: 'id' }] };
    await assert.rejects(assertNoMutation({
      ...options, action: () => request('partial'),
    }), error => {
      assert.ok(error instanceof MutationBoundaryError);
      assert.deepEqual(error.toJSON().counts, [{ table, inserted: 1, updated: 0, deleted: 0 }]);
      assert.doesNotMatch(error.message + JSON.stringify(error), /private HTTP partial value/);
      return true;
    });
    await assertNoMutation({ ...options, action: () => request('atomic') });
    const rows = await ds.query('SELECT id FROM ' + table + ' ORDER BY id');
    assert.deepEqual(rows.map(row => row.id), [1]);
  } finally {
    if (app) await app.close();
    try { await ds.query('DROP TABLE IF EXISTS ' + table); }
    finally { await ds.destroy(); }
  }
});
