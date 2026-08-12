import assert from 'node:assert/strict';
import test from 'node:test';
import { createCatalogService } from './catalogService.js';

const products = [
  { id: 'p-1', slug: 'p-1', name: 'Japan', operation: 'new_subscription', status: 'active', coverageType: 'country', coverageIds: ['jp'], featured: false },
  { id: 'p-2', slug: 'p-2', name: 'Korea', operation: 'new_subscription', status: 'active', coverageType: 'country', coverageIds: ['kr'], featured: false },
  { id: 'p-3', slug: 'p-3', name: 'Top up', operation: 'topup', status: 'draft', coverageType: 'not_applicable', coverageIds: [], featured: false },
];
const variants = [
  { id: 'v-1', productId: 'p-1', sku: 'JP-1', wmproductId: 'WM-JP-1', price: 10000, currency: 'VND', medium: 'esim', supplier: 'worldmove', fulfillmentMethod: 'WORLDMOVE_ESIM_REDEEM', active: true, needsReview: true },
  { id: 'v-2', productId: 'p-2', sku: 'KR-1', wmproductId: 'WM-KR-1', price: 20000, currency: 'VND', medium: 'esim', supplier: 'worldmove', fulfillmentMethod: 'WORLDMOVE_ESIM_REDEEM', active: true, needsReview: false },
  { id: 'v-3', productId: 'p-3', sku: 'TOP-1', wmproductId: 'WM-TOP-1', price: 30000, currency: 'VND', medium: 'esim', supplier: 'hico', fulfillmentMethod: 'WORLDMOVE_TOPUP', active: true, needsReview: false },
];

test('admin catalog searches WMID server-side and returns summaries only', async () => {
  const service = createCatalogService({ readCatalog: async () => ({ products, variants, manifest: { versionId: 'admin-test' } }) });
  const result = await service.listAdminProducts({ paginate: true, filters: { search: 'WM-KR-1', page: 1, pageSize: 1 } });
  assert.equal(result.pagination.total, 1);
  assert.equal(result.items[0].id, 'p-2');
  assert.equal(result.items[0].variants[0].wmproductId, 'WM-KR-1');
  assert.equal(result.summary.products, 3);
  assert.equal(result.summary.variants, 3);
  assert.equal(result.summary.needsReview, 1);
  assert.equal(result.items[0].variants[0].providerToken, undefined);
});
