import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import express from 'express';
import { createCatalogMaintenanceRouter } from './catalogMaintenanceRouter.js';

const start = async (app) => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  return server;
};

test('maintenance status is masked and keeps global readiness independent', async () => {
  const app = express();
  app.use((req, _res, next) => {
    req.auth = { user: { roles: ['super_admin'] } };
    next();
  });
  app.use(createCatalogMaintenanceRouter({
    env: { CATALOG_MAINTENANCE_WRITES_ENABLED: 'true' },
    catalogHealthService: { async getHealth() { return { status: 'healthy' }; }, isCanonicalSource() { return true; } },
    readinessService: { async evaluate() { return { status: 'not_ready' }; } },
  }));
  const server = await start(app);
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/admin/catalog/maintenance/status`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      enabled: true,
      globalProductionReady: false,
      resetAllowed: true,
      fullSyncAllowed: true,
      blockers: [],
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
