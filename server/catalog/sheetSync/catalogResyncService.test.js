import assert from 'node:assert/strict';
import test from 'node:test';
import { cloneSeedCategories } from '../categories/catalogCategories.js';
import { buildFullSyncCandidate, createCatalogResyncService, productSourceKeyFor, variantSourceKeyFor } from './catalogResyncService.js';
import { createInMemorySheetSyncRepository } from './sheetSyncRepository.js';

const timestamp = '2026-08-16T00:00:00.000Z';
const rowData = {
  sku: 'SKU-CN-10', medium: 'physical_sim', productName: 'Trung Quốc 500MB/ngày', dataPolicy: 'daily', dataLimit: '500MB', duration: '10 ngày', durationDays: 10,
  price: 70000, wmproductId: 'WM-CN-10', networkLabel: 'China Unicom', publicNote: 'Gói thử', activationPolicy: 'Reset hàng ngày', cancellable: true,
};
const offer = { id: 'offer-1', provider: 'worldmove', wmproductId: 'WM-CN-10', providerProductType: 1, active: true, leSIM: false };

test('full sync keeps exact previous media and enrichment while draft-safe', async () => {
  const previousProduct = {
    id: 'product-old', sourceKey: productSourceKeyFor(rowData), slug: 'trung-quoc-cu', name: 'Tên cũ', operation: 'new_subscription',
    categoryId: null, coverageType: 'not_applicable', coverageIds: [], primaryMediaId: 'media-old', galleryMediaIds: ['media-gallery'],
    description: 'Mô tả HICO', installationGuide: '<p>Hướng dẫn HICO</p>', featured: true, status: 'active', version: 4, createdAt: timestamp, updatedAt: timestamp,
  };
  const previousVariant = { id: 'variant-old', sourceKey: variantSourceKeyFor(rowData), productId: previousProduct.id, sku: rowData.sku, medium: rowData.medium, wmproductId: rowData.wmproductId, stock: 7 };
  const candidate = await buildFullSyncCandidate({
    rows: [{ id: 'row-1', sourceMedium: rowData.medium, normalizedData: rowData, errors: [], status: 'VALID' }],
    categories: cloneSeedCategories(), offers: [offer], previousCatalog: { products: [previousProduct], variants: [previousVariant] },
    now: () => new Date(timestamp),
  });
  assert.equal(candidate.products[0].id, previousProduct.id);
  assert.equal(candidate.products[0].primaryMediaId, 'media-old');
  assert.deepEqual(candidate.products[0].galleryMediaIds, ['media-gallery']);
  assert.equal(candidate.products[0].description, 'Mô tả HICO');
  assert.equal(candidate.products[0].installationGuide, '<p>Hướng dẫn HICO</p>');
  assert.equal(candidate.products[0].status, 'draft');
  assert.equal(candidate.variants[0].id, previousVariant.id);
  assert.equal(candidate.variants[0].active, false);
  assert.equal(candidate.variants[0].stock, 7);
  assert.equal(candidate.summary.imagesReused, 1);
  assert.equal(candidate.summary.descriptionsReused, 1);
  assert.equal(candidate.summary.installationGuideReused, 1);
});

test('full sync uses internal Sheet image then a safe existing placeholder', async () => {
  const withSheet = await buildFullSyncCandidate({
    rows: [{ id: 'row-1', sourceMedium: 'physical_sim', normalizedData: { ...rowData, imageUrl: '/uploads/catalog-a.webp' }, errors: [], status: 'VALID' }],
    categories: cloneSeedCategories(), offers: [offer], previousCatalog: { products: [], variants: [] },
  });
  assert.equal(withSheet.products[0].image, '/uploads/catalog-a.webp');
  assert.equal(withSheet.summary.imagesFromSheet, 1);
  const withFallback = await buildFullSyncCandidate({
    rows: [{ id: 'row-1', sourceMedium: 'physical_sim', normalizedData: rowData, errors: [], status: 'VALID' }],
    categories: cloneSeedCategories(), offers: [offer], previousCatalog: { products: [], variants: [] },
  });
  assert.equal(withFallback.products[0].image, '/images/art_sim_compare.png');
  assert.equal(withFallback.summary.imagesFallback, 1);
});

test('full preview after reset reads the nearest previous non-empty catalog version', async () => {
  const reference = { spreadsheetId: 'sheet-1', sheetTab: 'HICO GỐC', sheetRange: 'A1:Y2', syncSettings: {}, values: [Array(25).fill('header'), (() => { const cells = Array(25).fill(''); cells[1] = rowData.productName; cells[2] = '10'; cells[3] = 'Chia ngày'; cells[4] = '70000'; cells[10] = 'internet'; cells[11] = rowData.networkLabel; cells[13] = rowData.activationPolicy; cells[15] = 'Có thể'; cells[16] = rowData.sku; cells[23] = rowData.wmproductId; return cells; })()] };
  const oldProduct = { id: 'product-old', sourceKey: productSourceKeyFor(rowData), slug: 'trung-quoc', name: rowData.productName, operation: 'new_subscription', categoryId: null, coverageType: 'not_applicable', coverageIds: [], primaryMediaId: 'media-old', description: 'Mô tả cũ', installationGuide: 'Hướng dẫn cũ', status: 'active', version: 1, createdAt: timestamp, updatedAt: timestamp };
  const oldVariant = { id: 'variant-old', sourceKey: variantSourceKeyFor(rowData), productId: oldProduct.id, sku: rowData.sku, medium: rowData.medium, wmproductId: rowData.wmproductId, stock: null };
  const repository = createInMemorySheetSyncRepository();
  let committedInput;
  const service = createCatalogResyncService({
    repository,
    referenceClient: { readRows: async () => reference },
    canonicalRepository: { readCatalog: async () => ({ products: [], variants: [], categories: cloneSeedCategories(), manifest: { versionId: 'catalog-reset-1' } }) },
    providerRepository: { listOffers: async () => [offer] },
    auditRepository: { append: async (record) => record, remove: async () => undefined },
    commitService: {
      listVersions: async () => [{ versionId: 'catalog-reset-1', createdAt: '2026-08-16T01:00:00.000Z' }, { versionId: 'catalog-old-1', createdAt: '2026-08-15T01:00:00.000Z' }],
      readVersion: async (versionId) => versionId === 'catalog-old-1' ? { products: [oldProduct], variants: [oldVariant], categories: cloneSeedCategories(), manifest: { versionId } } : { products: [], variants: [], categories: cloneSeedCategories(), manifest: { versionId } },
      commit: async (input) => { committedInput = input; await input.beforePointer(); return { manifest: { versionId: input.versionId }, warnings: [] }; },
    },
    logger: { info() {} },
  });
  const preview = await service.fullPreview({ actor: { id: 'admin-1' } });
  assert.equal(preview.batch.mode, 'full');
  assert.equal(preview.batch.summary.enrichmentSourceVersionId, 'catalog-old-1');
  assert.equal(preview.batch.summary.imagesReused, 1);
  assert.equal(preview.batch.summary.products, 1);
  assert.equal(preview.batch.summary.variants, 1);
  const applied = await service.fullApply(preview.batch.id, { actor: { id: 'admin-1' } });
  assert.equal(applied.versionId, committedInput.versionId);
  assert.equal(committedInput.products[0].primaryMediaId, 'media-old');
  assert.equal(committedInput.products[0].description, 'Mô tả cũ');
});
