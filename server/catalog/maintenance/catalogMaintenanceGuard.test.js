import assert from 'node:assert/strict';
import test from 'node:test';
import { createCatalogMaintenanceGuard } from './catalogMaintenanceGuard.js';

const runGuard = async ({ env, request, health = { status: 'healthy' }, canonicalSource = true, readiness = { status: 'not_ready' } }) => {
  const result = await new Promise((resolve) => {
    const response = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(body) { resolve({ statusCode: this.statusCode, body }); },
    };
    const guard = createCatalogMaintenanceGuard({
      env,
      catalogHealthService: {
        async getHealth() { return health; },
        isCanonicalSource() { return canonicalSource; },
      },
      readinessService: { async evaluate(options) { return { ...readiness, options }; } },
    });
    guard(request, response, () => resolve({ next: true, request }));
  });
  return result;
};

const resetRequest = (roles = ['super_admin']) => ({
  method: 'POST',
  originalUrl: '/api/admin/catalog/reset',
  auth: { user: { roles } },
});

test('disabled maintenance writes return the dedicated disabled response', async () => {
  const result = await runGuard({ env: { CATALOG_MAINTENANCE_WRITES_ENABLED: 'false' }, request: resetRequest() });
  assert.equal(result.statusCode, 423);
  assert.equal(result.body.code, 'CATALOG_MAINTENANCE_DISABLED');
});

test('enabled maintenance writes require an explicit super_admin role', async () => {
  const result = await runGuard({ env: { CATALOG_MAINTENANCE_WRITES_ENABLED: 'true' }, request: resetRequest(['catalog_manager']) });
  assert.equal(result.statusCode, 403);
  assert.equal(result.body.code, 'CATALOG_MAINTENANCE_SUPER_ADMIN_REQUIRED');
});

test('enabled super admin maintenance writes require a healthy canonical catalog', async () => {
  const unhealthy = await runGuard({ env: { CATALOG_MAINTENANCE_WRITES_ENABLED: 'true' }, request: resetRequest(), health: { status: 'unhealthy' } });
  assert.equal(unhealthy.statusCode, 503);
  assert.equal(unhealthy.body.code, 'CATALOG_MAINTENANCE_CATALOG_UNHEALTHY');

  const legacy = await runGuard({ env: { CATALOG_MAINTENANCE_WRITES_ENABLED: 'true' }, request: resetRequest(), canonicalSource: false });
  assert.equal(legacy.statusCode, 503);
  assert.equal(legacy.body.code, 'CATALOG_MAINTENANCE_CATALOG_UNHEALTHY');
});

test('enabled super admin maintenance writes pass the dedicated gate and preserve global not_ready', async () => {
  const result = await runGuard({
    env: { CATALOG_MAINTENANCE_WRITES_ENABLED: 'true' },
    request: { ...resetRequest(), originalUrl: '/api/admin/catalog-sheet-sync/batch-1/full-apply' },
    readiness: { status: 'not_ready' },
  });
  assert.deepEqual(result.request.catalogMaintenance, { maintenanceMode: true, globalProductionReady: false });
});

test('non-maintenance routes are transparent to the dedicated gate', async () => {
  const result = await runGuard({ env: { CATALOG_MAINTENANCE_WRITES_ENABLED: 'false' }, request: { ...resetRequest(), originalUrl: '/api/admin/catalog-sheet-sync/batch-1/quick-apply' } });
  assert.equal(result.next, true);
});
