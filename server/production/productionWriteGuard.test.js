import assert from 'node:assert/strict';
import test from 'node:test';
import { createProductionWriteGuard } from './productionWriteGuard.js';
import { isCatalogMaintenanceMutation, isProductionSafeAdminMutation } from './adminWritePolicy.js';

const runGuard = async (request, { maintenance = false } = {}) => new Promise((resolve) => {
  let readinessCalls = 0;
  const response = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { resolve({ statusCode: this.statusCode, body }); },
  };
  const guard = createProductionWriteGuard({
    env: { NODE_ENV: 'production' },
    readinessService: {
      async assertWriteReady() { readinessCalls += 1; return null; },
      async evaluate() { return { failedChecks: ['CHECKOUT_HEALTHY'] }; },
    },
    allowWhenNotReady: isProductionSafeAdminMutation,
    isMaintenanceMutation: maintenance ? isCatalogMaintenanceMutation : undefined,
  });
  guard(request, response, () => resolve({ next: true, readinessCalls }));
});

test('maintenance mutations reach the dedicated maintenance gate before readiness', async () => {
  for (const originalUrl of [
    '/api/admin/catalog/reset',
    '/api/admin/catalog-sheet-sync/batch-1/full-apply',
  ]) {
    assert.deepEqual(await runGuard({ method: 'POST', originalUrl }, { maintenance: true }), { next: true, readinessCalls: 0 });
  }
});

test('safe Google Sheet write proceeds while production readiness is not ready', async () => {
  assert.deepEqual(await runGuard({ method: 'PUT', originalUrl: '/api/admin/settings/integrations/google-sheet' }), { next: true, readinessCalls: 0 });
  assert.deepEqual(await runGuard({ method: 'POST', originalUrl: '/api/admin/catalog-sheet-sync/full-preview' }), { next: true, readinessCalls: 0 });
  assert.deepEqual(await runGuard({ method: 'POST', originalUrl: '/api/admin/catalog-sheet-sync/preview-jobs' }), { next: true, readinessCalls: 0 });
  assert.deepEqual(await runGuard({ method: 'POST', originalUrl: '/api/admin/catalog-sheet-sync/preview-jobs/job-123/cancel' }), { next: true, readinessCalls: 0 });
});

test('catalog mutation remains blocked while production readiness is not ready', async () => {
  for (const originalUrl of [
    '/api/admin/catalog/reset',
    '/api/admin/catalog-sheet-sync/batch-1/quick-apply',
    '/api/admin/catalog-sheet-sync/batch-1/full-apply',
    '/api/admin/catalog/products/product-1/publish',
    '/api/admin/catalog/bulk/batch-1/execute',
    '/api/admin/catalog/versions/v1/rollback',
  ]) {
    const result = await runGuard({ method: 'POST', originalUrl });
    assert.equal(result.statusCode, 503, originalUrl);
    assert.equal(result.body.code, 'PRODUCTION_NOT_READY', originalUrl);
    assert.deepEqual(result.body.failedChecks, ['CHECKOUT_HEALTHY'], originalUrl);
  }
});
