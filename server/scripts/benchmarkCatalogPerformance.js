import { performance } from 'node:perf_hooks';
import { createCatalogService } from '../catalog/catalogService.js';

const products = Array.from({ length: 93 }, (_, index) => ({
  id: `product-${index + 1}`,
  slug: `product-${index + 1}`,
  name: `Product ${index + 1}`,
  operation: 'new_subscription',
  status: 'active',
  coverageType: 'country',
  coverageIds: ['vn'],
  featured: false,
}));
const variants = Array.from({ length: 21879 }, (_, index) => ({
  id: `variant-${index + 1}`,
  productId: products[index % products.length].id,
  sku: `SKU-${index + 1}`,
  price: 10000 + index,
  currency: 'VND',
  medium: 'esim',
  supplier: 'worldmove',
  fulfillmentMethod: 'WORLDMOVE_ESIM_REDEEM',
  active: true,
  requiresExistingSim: false,
}));

const service = createCatalogService({ readCatalog: async () => ({ products, variants, manifest: { versionId: 'benchmark-1' } }) });
const coldStart = performance.now();
await service.listAdminProducts({ filters: { page: 1, pageSize: 20 }, paginate: true });
const coldMs = performance.now() - coldStart;
const warmStart = performance.now();
for (let index = 0; index < 20; index += 1) await service.listAdminProducts({ filters: { page: 1, pageSize: 20 }, paginate: true });
const warmMs = performance.now() - warmStart;
console.log(JSON.stringify({ products: products.length, variants: variants.length, coldMs: Number(coldMs.toFixed(2)), warm20Ms: Number(warmMs.toFixed(2)), averageWarmMs: Number((warmMs / 20).toFixed(2)) }));
