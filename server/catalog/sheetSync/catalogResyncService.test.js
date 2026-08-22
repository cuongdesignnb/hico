import assert from 'node:assert/strict';
import test from 'node:test';
import { cloneSeedCategories } from '../categories/catalogCategories.js';
import { buildFullSyncCandidate, createCatalogResyncService, productSourceKeyFor, sourceHashFor, variantSourceKeyFor } from './catalogResyncService.js';
import { createInMemorySheetSyncRepository } from './sheetSyncRepository.js';

const timestamp = '2026-08-16T00:00:00.000Z';
const rowData = {
  sku: 'SKU-CN-10', medium: 'physical_sim', productName: 'Trung Quốc 500MB/ngày', dataPolicy: 'daily', dataLimit: '500MB', duration: '10 ngày', durationDays: 10,
  price: 70000, wmproductId: 'WM-CN-10', networkLabel: 'China Unicom', publicNote: 'Gói thử', activationPolicy: 'Reset hàng ngày', cancellable: true,
};
const offer = { id: 'offer-1', provider: 'worldmove', wmproductId: 'WM-CN-10', providerProductType: 1, active: true, leSIM: false };

test('source hash is stable when only batch metadata changes', () => {
  const reference = { spreadsheetId: 'sheet-1', sheetTab: 'HICO GỐC', sheetRange: 'A1:Y17666', values: [['header'], ['row']] };
  const settings = { fieldMapping: { productName: 1 }, priceMapping: { physical: 'pricePhysical' } };
  const first = sourceHashFor({ ...reference, batching: { batchCount: 4, maxRowsPerBatch: 5000 } }, settings, [offer]);
  const second = sourceHashFor({ ...reference, batching: { batchCount: 18, maxRowsPerBatch: 1000 } }, settings, [offer]);
  assert.equal(first, second);
});

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
  assert.equal(candidate.summary.provider.resolved, 1);
  assert.equal(candidate.variants[0].providerResolution, 'RESOLVED');
});

test('full sync keeps structurally valid rows when provider offers are unavailable', async () => {
  const knownRow = { ...rowData, sourceCategoryLabel: 'Sim' };
  const candidate = await buildFullSyncCandidate({
    rows: [{ id: 'row-unresolved', sourceMedium: knownRow.medium, normalizedData: knownRow, errors: [], status: 'VALID' }],
    categories: cloneSeedCategories(), offers: [], previousCatalog: { products: [], variants: [] },
  });
  const [variant] = candidate.variants;
  assert.equal(candidate.products.length, 1);
  assert.equal(candidate.variants.length, 1);
  assert.equal(candidate.products[0].categoryId, 'cat-sim-vat-ly');
  assert.equal(candidate.products[0].categoryNeedsReview, false);
  assert.equal(candidate.products[0].operationResolution, 'UNRESOLVED');
  assert.equal(candidate.rows[0].status, 'VALID');
  assert.equal(candidate.rows[0].providerResolution, 'UNRESOLVED');
  assert.deepEqual(candidate.rows[0].errors, []);
  assert.ok(candidate.rows[0].warnings.some((warning) => warning.code === 'PROVIDER_NOT_FOUND'));
  assert.equal(variant.supplier, 'other');
  assert.equal(variant.fulfillmentMethod, 'MANUAL_PROCESSING');
  assert.equal(variant.providerProductType, null);
  assert.equal(variant.leSIM, null);
  assert.equal(variant.requiresExistingSim, false);
  assert.equal(variant.wmproductId, rowData.wmproductId);
  assert.equal(variant.active, false);
  assert.equal(variant.needsReview, true);
  assert.equal(variant.providerResolution, 'UNRESOLVED');
  assert.deepEqual(candidate.summary.provider, { resolved: 0, unresolved: 1, ambiguous: 0, inactive: 0, needsReviewVariants: 1 });
});

test('full sync keeps ambiguous and inactive provider rows as reviewable fallbacks', async () => {
  const build = (offers) => buildFullSyncCandidate({
    rows: [{ id: 'row-provider', sourceMedium: rowData.medium, normalizedData: rowData, errors: [], status: 'VALID' }],
    categories: cloneSeedCategories(), offers, previousCatalog: { products: [], variants: [] },
  });
  const ambiguous = await build([
    { ...offer, id: 'offer-a' },
    { ...offer, id: 'offer-b' },
  ]);
  assert.equal(ambiguous.variants[0].fulfillmentMethod, 'MANUAL_PROCESSING');
  assert.equal(ambiguous.variants[0].providerResolution, 'AMBIGUOUS');
  assert.ok(ambiguous.rows[0].warnings.some((warning) => warning.code === 'PROVIDER_AMBIGUOUS'));
  assert.equal(ambiguous.summary.provider.ambiguous, 1);

  const inactive = await build([{ ...offer, active: false }]);
  assert.equal(inactive.variants[0].fulfillmentMethod, 'MANUAL_PROCESSING');
  assert.equal(inactive.variants[0].providerResolution, 'INACTIVE');
  assert.ok(inactive.rows[0].warnings.some((warning) => warning.code === 'PROVIDER_INACTIVE'));
  assert.equal(inactive.summary.provider.inactive, 1);
});

test('full sync splits one package family by medium and uses operation-aware fulfillment', async () => {
  const physical = { ...rowData, sourceCategoryLabel: 'Sim & eSIM', sku: 'SKU-FAMILY-SIM', wmproductId: 'WM-FAMILY-SIM', medium: 'physical_sim' };
  const esim = { ...rowData, sourceCategoryLabel: 'Sim & eSIM', sku: 'SKU-FAMILY-ESIM', wmproductId: 'WM-FAMILY-ESIM', medium: 'esim' };
  const candidate = await buildFullSyncCandidate({
    rows: [
      { id: 'row-family-sim', sourceMedium: 'physical_sim', normalizedData: physical, errors: [], warnings: [], status: 'VALID' },
      { id: 'row-family-esim', sourceMedium: 'esim', normalizedData: esim, errors: [], warnings: [], status: 'VALID' },
    ],
    categories: cloneSeedCategories(),
    offers: [
      { id: 'offer-family-sim', provider: 'worldmove', wmproductId: physical.wmproductId, providerProductType: 1, active: true, leSIM: false },
      { id: 'offer-family-esim', provider: 'worldmove', wmproductId: esim.wmproductId, providerProductType: 0, active: true, leSIM: true },
    ],
    previousCatalog: { products: [], variants: [] },
  });
  assert.equal(candidate.products.length, 2);
  assert.equal(new Set(candidate.products.map((product) => product.packageFamilyKey)).size, 1);
  assert.equal(candidate.summary.packageFamilies, 1);
  assert.equal(candidate.summary.packageFamilyMediumGroups, 2);
  assert.equal(candidate.summary.packageFamilyDiagnostics.familiesWithBothMediums, 1);
  assert.deepEqual(new Set(candidate.products.map((product) => product.categoryId)), new Set(['cat-sim-vat-ly', 'cat-esim-du-lich']));
  assert.equal(candidate.variants.find((variant) => variant.medium === 'physical_sim')?.shippingRequired, true);
  assert.equal(candidate.variants.find((variant) => variant.medium === 'esim')?.shippingRequired, false);
});

test('full sync keeps package class and parsed coverage separate from family identity', async () => {
  const row = {
    ...rowData,
    sourceCategoryLabel: 'Sẵn gói',
    medium: 'esim',
    sku: 'SKU-PRELOADED-ESIM',
    wmproductId: 'WM-PRELOADED-ESIM',
    coverageLabel: 'Trung Quốc: China Unicom, China Telecom',
    coverage: {
      rawLabel: 'Trung Quốc: China Unicom, China Telecom',
      destinations: [{ id: 'coverage-trung-quoc', name: 'Trung Quốc' }],
      networks: ['China Unicom', 'China Telecom'],
      needsReview: false,
      carrierOnly: false,
    },
  };
  const candidate = await buildFullSyncCandidate({
    rows: [{ id: 'row-preloaded', sourceMedium: 'esim', normalizedData: row, errors: [], warnings: [], status: 'VALID' }],
    categories: cloneSeedCategories(),
    offers: [{ id: 'offer-preloaded', provider: 'worldmove', wmproductId: row.wmproductId, providerProductType: 0, active: true, leSIM: true }],
    previousCatalog: { products: [], variants: [] },
  });
  assert.equal(candidate.products[0].packageClass, 'PRELOADED');
  assert.equal(candidate.products[0].categoryId, 'cat-esim-san-goi');
  assert.deepEqual(candidate.products[0].coverageIds, ['coverage-trung-quoc']);
  assert.deepEqual(candidate.products[0].coverageFilter, { rawLabel: 'Trung Quốc', normalizedLabel: 'trung quốc', id: 'coverage-trung-quoc' });
  assert.equal(candidate.products[0].coverageStatus, 'RESOLVED');
  assert.deepEqual(candidate.summary.coverage.uniqueDestinationNames, { 'coverage-trung-quoc': 'Trung Quốc' });
  assert.equal(candidate.products[0].networkLabel, 'China Unicom, China Telecom');
});

test('full sync does not reuse one legacy product identity across operations', async () => {
  const subscription = { ...rowData, sourceCategoryLabel: 'Sim & eSIM' };
  const topup = { ...rowData, sourceCategoryLabel: 'Nạp thêm', sku: 'SKU-TOPUP-LEGACY', wmproductId: 'WM-TOPUP-LEGACY' };
  const previousProduct = {
    id: 'product-legacy',
    sourceKey: productSourceKeyFor({ ...rowData, operation: 'new_subscription' }),
    slug: 'trung-quoc-legacy',
    name: rowData.productName,
    operation: 'new_subscription',
    medium: rowData.medium,
    categoryId: 'cat-sim-vat-ly',
    coverageType: 'not_applicable',
    coverageIds: [],
    status: 'active',
    version: 2,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const previousVariant = {
    id: 'variant-legacy',
    sourceKey: variantSourceKeyFor(rowData),
    productId: previousProduct.id,
    sku: rowData.sku,
    medium: rowData.medium,
    wmproductId: rowData.wmproductId,
    stock: 3,
  };
  const candidate = await buildFullSyncCandidate({
    rows: [
      { id: 'row-subscription', sourceMedium: subscription.medium, normalizedData: subscription, errors: [], warnings: [], status: 'VALID' },
      { id: 'row-topup', sourceMedium: topup.medium, normalizedData: topup, errors: [], warnings: [], status: 'VALID' },
    ],
    categories: cloneSeedCategories(),
    offers: [
      { id: 'offer-subscription', provider: 'worldmove', wmproductId: subscription.wmproductId, providerProductType: 1, active: true, leSIM: false },
      { id: 'offer-topup', provider: 'worldmove', wmproductId: topup.wmproductId, providerProductType: 2, active: true, leSIM: false },
    ],
    previousCatalog: { products: [previousProduct], variants: [previousVariant] },
  });

  assert.equal(candidate.products.length, 2);
  assert.equal(new Set(candidate.products.map((product) => product.id)).size, 2);
  assert.equal(new Set(candidate.products.map((product) => product.slug)).size, 2);
  assert.equal(candidate.products.find((product) => product.id === previousProduct.id)?.operation, 'new_subscription');
  assert.notEqual(candidate.products.find((product) => product.operation === 'topup')?.id, previousProduct.id);
  assert.equal(new Set(candidate.variants.map((variant) => variant.id)).size, 2);
  assert.equal(candidate.variants.filter((variant) => variant.id === previousVariant.id).length, 1);
  assert.equal(candidate.summary.products, 2);
  assert.equal(candidate.summary.variants, 2);
});

test('full sync keeps physical top-up as a no-shipping operation', async () => {
  const topup = { ...rowData, sourceCategoryLabel: 'Nạp thêm', sku: 'SKU-TOPUP', wmproductId: 'WM-TOPUP', medium: 'physical_sim' };
  const candidate = await buildFullSyncCandidate({
    rows: [{ id: 'row-topup', sourceMedium: 'physical_sim', normalizedData: topup, errors: [], warnings: [], status: 'VALID' }],
    categories: cloneSeedCategories(),
    offers: [{ id: 'offer-topup', provider: 'worldmove', wmproductId: topup.wmproductId, providerProductType: 2, active: true, leSIM: false }],
    previousCatalog: { products: [], variants: [] },
  });
  assert.equal(candidate.products[0].operation, 'topup');
  assert.equal(candidate.products[0].categoryId, 'cat-nap-them');
  assert.equal(candidate.variants[0].shippingRequired, false);
  assert.equal(candidate.variants[0].requiresExistingSim, true);
});

test('full sync blocks a resolved provider APN or network conflict', async () => {
  const row = { ...rowData, apn: 'internet', networkLabel: 'China Unicom', sku: 'SKU-CONFLICT', wmproductId: 'WM-CONFLICT' };
  const candidate = await buildFullSyncCandidate({
    rows: [{ id: 'row-conflict', sourceMedium: 'physical_sim', normalizedData: row, errors: [], warnings: [], status: 'VALID' }],
    categories: cloneSeedCategories(),
    offers: [{ id: 'offer-conflict', provider: 'worldmove', wmproductId: row.wmproductId, providerProductType: 1, active: true, leSIM: false, apnHint: 'mobile', networkLabel: 'China Telecom' }],
    previousCatalog: { products: [], variants: [] },
  });
  assert.equal(candidate.products.length, 0);
  assert.ok(candidate.rows[0].errors.some((error) => error.code === 'APN_PROVIDER_CONFLICT'));
  assert.ok(candidate.rows[0].errors.some((error) => error.code === 'NETWORK_PROVIDER_CONFLICT'));
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
  assert.equal(preview.batch.summary.diagnostics.source.rowsRead, 1);
  assert.equal(preview.batch.summary.diagnostics.parser.rowsParsed, 1);
  assert.equal(preview.batch.summary.diagnostics.candidate.products, 1);
  assert.equal(preview.batch.summary.diagnostics.candidate.variants, 1);
  const applied = await service.fullApply(preview.batch.id, { actor: { id: 'admin-1' } });
  assert.equal(applied.versionId, committedInput.versionId);
  assert.equal(committedInput.products[0].primaryMediaId, 'media-old');
  assert.equal(committedInput.products[0].description, 'Mô tả cũ');
});

const fullSyncReference = ({ range = 'A1:Y2', row = null } = {}) => ({
  spreadsheetId: 'sheet-1', sheetTab: 'HICO GỐC', sheetRange: range, syncSettings: {},
  values: [Array(25).fill('header'), ...(row ? [row] : [])],
});

const emptyCanonical = () => ({ products: [], variants: [], categories: cloneSeedCategories(), manifest: { versionId: 'catalog-current' } });

test('full preview blocks rows with no candidates and does not create a batch', async () => {
  const repository = createInMemorySheetSyncRepository();
  const row = Array(25).fill(''); row[1] = 'Trung Quốc 500MB/ngày'; row[3] = 'Chia ngày';
  const service = createCatalogResyncService({
    repository,
    referenceClient: { readRows: async () => fullSyncReference({ row }) },
    canonicalRepository: { readCatalog: async () => emptyCanonical() },
    providerRepository: { listOffers: async () => [] },
    logger: { info() {} },
  });
  await assert.rejects(() => service.fullPreview(), (error) => error.code === 'FULL_SYNC_EMPTY_CANDIDATE' && error.details.rowsRead === 1 && error.details.products === 0 && error.details.variants === 0);
  assert.equal((await repository.listBatches()).length, 0);
});

test('full preview blocks an empty Sheet and keeps the canonical repository untouched', async () => {
  const repository = createInMemorySheetSyncRepository();
  const service = createCatalogResyncService({
    repository,
    referenceClient: { readRows: async () => fullSyncReference() },
    canonicalRepository: { readCatalog: async () => emptyCanonical() },
    providerRepository: { listOffers: async () => [] },
    logger: { info() {} },
  });
  await assert.rejects(() => service.fullPreview(), (error) => error.code === 'FULL_SYNC_SOURCE_EMPTY' && error.details.rowsRead === 0);
  assert.equal((await repository.listBatches()).length, 0);
});

test('full preview rejects an HICO GỐC range that cannot reach SKU and WMID', async () => {
  const repository = createInMemorySheetSyncRepository();
  const row = Array(11).fill(''); row[1] = 'Trung Quốc 500MB/ngày';
  const service = createCatalogResyncService({
    repository,
    referenceClient: { readRows: async () => fullSyncReference({ range: 'A1:K17666', row: row.slice(0, 11) }) },
    canonicalRepository: { readCatalog: async () => emptyCanonical() },
    providerRepository: { listOffers: async () => [] },
    logger: { info() {} },
  });
  await assert.rejects(() => service.fullPreview(), (error) => error.code === 'SHEET_RANGE_INCOMPLETE' && error.details.requiredLastColumn === 'Y');
});

test('full apply rejects a persisted empty batch before calling the commit service', async () => {
  const repository = createInMemorySheetSyncRepository();
  await repository.createBatch({ id: 'batch-empty', mode: 'full', status: 'READY_FOR_REVIEW', summary: { total: 1, products: 0, variants: 0 } }, []);
  let commitCalled = false;
  const service = createCatalogResyncService({
    repository,
    commitService: { commit: async () => { commitCalled = true; throw new Error('must not commit'); } },
    referenceClient: { readRows: async () => fullSyncReference() },
  });
  await assert.rejects(() => service.fullApply('batch-empty'), (error) => error.code === 'FULL_SYNC_EMPTY_CANDIDATE');
  assert.equal(commitCalled, false);
});
