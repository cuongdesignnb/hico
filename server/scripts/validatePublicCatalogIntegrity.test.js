import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { validatePublicCatalogIntegrity } from './validatePublicCatalogIntegrity.js';
import { checksumRecords } from '../catalog/canonical/canonicalCatalogChecksum.js';

test('public catalog integrity reports canonical product and variant gaps without fixing data', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'hico-public-catalog-'));
  await mkdir(path.join(directory, 'catalog_versions', 'v1'), { recursive: true });
  const createdAt = new Date().toISOString();
  const products = [{ id: 'p1', slug: 'philippines', name: 'Philippines', operation: 'new_subscription', status: 'active', coverageType: 'country', coverageIds: ['ph'], image: '/images/ph.png', version: 1, createdAt, updatedAt: createdAt }];
  const variants = [{ id: 'v1', productId: 'p1', sku: 'PH-1', price: 100, currency: 'VND', active: true, needsReview: false, archived: false, skuConflict: false, medium: 'esim', supplier: 'hico', fulfillmentMethod: 'HICO_MANUAL_QR', version: 1, createdAt, updatedAt: createdAt }];
  await writeFile(path.join(directory, 'catalog_current.json'), JSON.stringify({ migrationId: 'v1', productsFile: 'catalog_versions/v1/catalog_products.json', variantsFile: 'catalog_versions/v1/catalog_variants.json', productsChecksum: checksumRecords(products), variantsChecksum: checksumRecords(variants) }));
  await writeFile(path.join(directory, 'catalog_versions', 'v1', 'catalog_products.json'), JSON.stringify(products));
  await writeFile(path.join(directory, 'catalog_versions', 'v1', 'catalog_variants.json'), JSON.stringify(variants));
  const result = await validatePublicCatalogIntegrity({ uploadsDirectory: directory });
  assert.equal(result.success, true);
  assert.equal(result.productsChecked, 1);
  assert.equal(result.variantsChecked, 1);
});
