import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CATALOG_MAINTENANCE_DISABLED_CODE,
  CATALOG_MAINTENANCE_ROLE_CODE,
  isCatalogMaintenanceMutation,
  maintenanceStatus,
  maintenanceWritesEnabled,
} from './catalogMaintenancePolicy.js';

test('maintenance mutation classifier only recognizes reset and full apply', () => {
  assert.equal(isCatalogMaintenanceMutation({ method: 'POST', originalUrl: '/api/admin/catalog/reset' }), true);
  assert.equal(isCatalogMaintenanceMutation({ method: 'POST', originalUrl: '/api/admin/catalog-sheet-sync/batch-1/full-apply?x=1' }), true);
  assert.equal(isCatalogMaintenanceMutation({ method: 'POST', originalUrl: '/api/admin/catalog-sheet-sync/batch-1/quick-apply' }), false);
  assert.equal(isCatalogMaintenanceMutation({ method: 'POST', originalUrl: '/api/admin/catalog-sheet-sync/batch-1/full-apply/extra' }), false);
  assert.equal(isCatalogMaintenanceMutation({ method: 'GET', originalUrl: '/api/admin/catalog/reset' }), false);
});

test('maintenance writes require the exact normalized true value', () => {
  assert.equal(maintenanceWritesEnabled({ CATALOG_MAINTENANCE_WRITES_ENABLED: 'true' }), true);
  assert.equal(maintenanceWritesEnabled({ CATALOG_MAINTENANCE_WRITES_ENABLED: ' true ' }), true);
  assert.equal(maintenanceWritesEnabled({ CATALOG_MAINTENANCE_WRITES_ENABLED: 'TRUE' }), false);
  assert.equal(maintenanceWritesEnabled({ CATALOG_MAINTENANCE_WRITES_ENABLED: '1' }), false);
  assert.equal(maintenanceWritesEnabled({}), false);
});

test('status keeps global readiness separate from the maintenance switch', () => {
  const status = maintenanceStatus({ enabled: false, globalProductionReady: false, superAdmin: true, catalogHealthy: true });
  assert.equal(status.globalProductionReady, false);
  assert.equal(status.resetAllowed, false);
  assert.equal(status.fullSyncAllowed, false);
  assert.deepEqual(status.blockers, [CATALOG_MAINTENANCE_DISABLED_CODE]);

  const roleStatus = maintenanceStatus({ enabled: true, globalProductionReady: false, superAdmin: false, catalogHealthy: true });
  assert.deepEqual(roleStatus.blockers, [CATALOG_MAINTENANCE_ROLE_CODE]);
});
