import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import express from 'express';
import { createCatalogMigrationRouter } from './catalogMigrationRouter.js';

const withServer = async (migrationService, callback) => {
  const app = express();
  app.use(express.json());
  app.use('/api', createCatalogMigrationRouter({ migrationService }));
  const server = app.listen(0);
  await once(server, 'listening');
  try {
    const { port } = server.address();
    await callback(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
    await once(server, 'close');
  }
};

test('migration validate, run, status and report APIs return controlled data', async () => {
  const migrationService = {
    validate: async () => ({ valid: true, products: 2, variants: 4 }),
    run: async () => ({ migrationId: 'catalog-test', created: true }),
    getStatus: async () => ({ migrated: true }),
    getReport: async (id) => (
      id === 'catalog-test' ? { migrationId: id, success: true } : null
    ),
  };
  await withServer(migrationService, async (baseUrl) => {
    const validateResponse = await fetch(
      `${baseUrl}/api/admin/catalog/migration/validate`,
      { method: 'POST' },
    );
    assert.equal(validateResponse.status, 200);
    const runResponse = await fetch(
      `${baseUrl}/api/admin/catalog/migration/run`,
      { method: 'POST' },
    );
    assert.equal(runResponse.status, 200);
    const statusResponse = await fetch(
      `${baseUrl}/api/admin/catalog/migration/status`,
    );
    assert.equal(statusResponse.status, 200);
    const reportResponse = await fetch(
      `${baseUrl}/api/admin/catalog/migration/reports/catalog-test`,
    );
    assert.equal(reportResponse.status, 200);
    const missingResponse = await fetch(
      `${baseUrl}/api/admin/catalog/migration/reports/missing`,
    );
    assert.equal(missingResponse.status, 404);
  });
});

test('migration API errors do not expose stacks or secrets', async () => {
  const migrationService = {
    validate: async () => {
      const error = new Error('internal');
      error.stack = 'SECRET_STACK';
      throw error;
    },
  };
  await withServer(migrationService, async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/api/admin/catalog/migration/validate`,
      { method: 'POST' },
    );
    assert.equal(response.status, 500);
    const body = JSON.stringify(await response.json());
    assert.doesNotMatch(body, /SECRET_STACK|token|merchant/i);
  });
});
