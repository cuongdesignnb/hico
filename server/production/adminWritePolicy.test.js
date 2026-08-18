import assert from 'node:assert/strict';
import test from 'node:test';
import { isCatalogMaintenanceMutation, isProductionSafeAdminMutation, SAFE_ADMIN_MUTATIONS } from './adminWritePolicy.js';

test('safe Google Sheet and preview mutations are explicitly allowlisted', () => {
  assert.ok(SAFE_ADMIN_MUTATIONS.includes('PUT /settings/integrations/google-sheet/credential'));
  assert.equal(isProductionSafeAdminMutation({ method: 'PUT', originalUrl: '/api/admin/settings/integrations/google-sheet' }), true);
  assert.equal(isProductionSafeAdminMutation({ method: 'POST', originalUrl: '/api/admin/settings/integrations/google-sheet/discover' }), true);
  assert.equal(isProductionSafeAdminMutation({ method: 'POST', originalUrl: '/api/admin/catalog-sheet-sync/full-preview' }), true);
});

test('catalog mutations are not allowlisted by name similarity', () => {
  for (const originalUrl of [
    '/api/admin/catalog/reset',
    '/api/admin/catalog-sheet-sync/batch-1/apply',
    '/api/admin/catalog-sheet-sync/batch-1/quick-apply',
    '/api/admin/catalog-sheet-sync/batch-1/full-apply',
    '/api/admin/catalog/products',
    '/api/admin/catalog/versions/v1/rollback',
  ]) {
    assert.equal(isProductionSafeAdminMutation({ method: 'POST', originalUrl }), false, originalUrl);
  }
});

test('catalog maintenance classifier is narrower than the production-safe allowlist', () => {
  assert.equal(isCatalogMaintenanceMutation({ method: 'POST', originalUrl: '/api/admin/catalog/reset' }), true);
  assert.equal(isCatalogMaintenanceMutation({ method: 'POST', originalUrl: '/api/admin/catalog-sheet-sync/batch-1/full-apply' }), true);
  assert.equal(isCatalogMaintenanceMutation({ method: 'POST', originalUrl: '/api/admin/catalog-sheet-sync/batch-1/quick-apply' }), false);
  assert.equal(isCatalogMaintenanceMutation({ method: 'POST', originalUrl: '/api/admin/catalog/products' }), false);
});
