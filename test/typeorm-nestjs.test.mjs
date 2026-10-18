import assert from 'node:assert/strict';
import { test } from 'node:test';
import 'reflect-metadata';
import { DataSource, EntitySchema } from 'typeorm';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { assertNoMutation, MutationBoundaryError, assertDisposableDatabase } from '../src/index.ts';

const url = process.env.MUTATION_BOUNDARY_TEST_DATABASE_URL;
if (!url) throw new Error('Disposable PostgreSQL database URL required');

const safety = {
  expectedDatabase: 'mutation_boundary_test',
  expectedUser: 'mutation_boundary_ci',
  confirmDisposableTestDatabase: true,
};

const Task = new EntitySchema({
  name: 'BoundaryTask',
  tableName: 'boundary_typeorm_probe',
  columns: {
    id: { type: 'integer', primary: true },
    state: { type: 'varchar', nullable: false },
  },
});

test('real TypeORM DataSource observes repository writes', async () => {
  const ds = new DataSource({ type: 'postgres', url, entities: [Task], synchronize: false, extra: { max: 3 } });
  await ds.initialize();
  try {
    await assertDisposableDatabase(ds, safety);
    await ds.query('CREATE TABLE boundary_typeorm_probe (id integer PRIMARY KEY, state varchar NOT NULL)');
    const repository = ds.getRepository('BoundaryTask');
    await repository.save({ id: 1, state: 'pending' });
    const options = { db: ds, tables: [{ name: 'boundary_typeorm_probe', key: 'id' }], safety };
    await assertNoMutation({ ...options, action: async () => { await repository.findOneByOrFail({ id: 1 }); } });
    await assert.rejects(
      assertNoMutation({ ...options, action: async () => { await repository.update({ id: 1 }, { state: 'changed' }); } }),
      error => {
        assert.ok(error instanceof MutationBoundaryError);
        assert.equal(error.counts[0].updated, 1);
        assert.doesNotMatch(error.message, /changed|pending/);
        return true;
      },
    );
  } finally {
    try { await ds.query('DROP TABLE IF EXISTS boundary_typeorm_probe'); }
    finally { await ds.destroy(); }
  }
});

test('NestJS application-context service using TypeORM exposes net writes', async () => {
  const ds = new DataSource({ type: 'postgres', url, entities: [], synchronize: false, extra: { max: 3 } });
  await ds.initialize();
  let app;
  try {
    await assertDisposableDatabase(ds, safety);
    await ds.query('CREATE TABLE boundary_nest_probe (id integer PRIMARY KEY, state varchar NOT NULL)');
    await ds.query("INSERT INTO boundary_nest_probe VALUES (1, 'pending')");

    const SERVICE = Symbol('BoundaryService');
    class TestModule {}
    Module({
      providers: [{ provide: SERVICE, useFactory: () => ({
        async read() { return ds.query('SELECT state FROM boundary_nest_probe WHERE id = 1'); },
        async write() { return ds.query("UPDATE boundary_nest_probe SET state = 'changed' WHERE id = 1"); },
      }) }],
      exports: [SERVICE],
    })(TestModule);
    app = await NestFactory.createApplicationContext(TestModule, { logger: false });
    const service = app.get(SERVICE);
    const options = { db: ds, tables: [{ name: 'boundary_nest_probe', key: 'id' }], safety };
    await assertNoMutation({ ...options, action: () => service.read() });
    await assert.rejects(assertNoMutation({ ...options, action: () => service.write() }), MutationBoundaryError);
  } finally {
    if (app) await app.close();
    try { await ds.query('DROP TABLE IF EXISTS boundary_nest_probe'); }
    finally { await ds.destroy(); }
  }
});
