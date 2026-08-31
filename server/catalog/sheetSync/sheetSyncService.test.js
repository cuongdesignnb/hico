import assert from 'node:assert/strict';
import test from 'node:test';
import { parseSheetRows } from './sheetRowParser.js';
import { matchSheetVariant } from './sheetVariantMatcher.js';
import { createInMemorySheetSyncRepository } from './sheetSyncRepository.js';
import { createSheetSyncService } from './sheetSyncService.js';

const product = { id: 'product-1', slug: 'viet-nam', status: 'active', operation: 'new_subscription' };
const variant = { id: 'variant-1', productId: product.id, sku: 'VN-1GB', price: 100000, currency: 'VND', medium: 'esim', supplier: 'worldmove', fulfillmentMethod: 'WORLDMOVE_ESIM_REDEEM', providerOfferId: 'offer-1', wmproductId: 'WM-1' };
const offer = { id: 'offer-1', provider: 'worldmove', wmproductId: 'WM-1', providerProductName: 'VN 1GB', productRegion: 'VN', providerProductType: 0, leSIM: true, providerCost: 1, providerCurrency: 'TWD', active: true, syncedAt: '2026-08-04T00:00:00.000Z' };

test('Sheet row parser keeps an explicit clear only for supported public text fields', () => {
  const [row] = parseSheetRows([['variant_id', 'retail_price', 'apn', 'network_label'], ['variant-1', '135000', '__CLEAR__', '  LTE\n5G  ']]);
  assert.equal(row.normalizedData.price, 135000);
  assert.equal(row.normalizedData.apn, null);
  assert.equal(row.normalizedData.networkLabel, 'LTE\n5G');
  assert.deepEqual(row.errors, []);
});

test('Sheet row parser rejects mojibake and formatted currency', () => {
  const [row] = parseSheetRows([['variant_id', 'retail_price', 'public_note'], ['variant-1', '135.000đ', 'Ã¢m thanh']]);
  assert.deepEqual(row.errors.map((error) => error.code).sort(), ['MOJIBAKE_DETECTED', 'PRICE_INVALID']);
});

test('matcher requires an exact non-archived variant identity', () => {
  const row = { normalizedData: { productSlug: 'viet-nam', sku: 'VN-1GB' } };
  assert.equal(matchSheetVariant({ row, products: [product], variants: [variant] }).variant.id, variant.id);
  assert.equal(matchSheetVariant({ row, products: [product], variants: [{ ...variant }, { ...variant, id: 'variant-2' }] }).error.code, 'AMBIGUOUS_VARIANT');
});

test('preview is idempotent and does not expose raw Sheet rows', async () => {
  const repository = createInMemorySheetSyncRepository();
  const service = createSheetSyncService({
    repository,
    referenceClient: { readRows: async () => ({ spreadsheetId: 'sheet-id', sheetTab: 'Catalog', sheetRange: 'A:I', values: [['variant_id', 'retail_price', 'public_note'], ['variant-1', '135000', 'Cập nhật']] }) },
    canonicalRepository: { readCatalog: async () => ({ products: [product], variants: [variant], manifest: { versionId: 'catalog-base' } }) },
    providerRepository: { listOffers: async () => [offer] },
  });
  const first = await service.preview({ actor: { id: 'admin-1' } });
  const second = await service.preview({ actor: { id: 'admin-1' } });
  assert.equal(first.rows[0].status, 'VALID');
  assert.equal(first.rows[0].raw, undefined);
  assert.equal(second.idempotent, true);
  assert.equal(second.batch.id, first.batch.id);
});

test('preview blocks duplicate targets and provider metadata conflicts', async () => {
  const duplicateRepo = createInMemorySheetSyncRepository();
  const duplicateService = createSheetSyncService({
    repository: duplicateRepo,
    referenceClient: { readRows: async () => ({ spreadsheetId: 'sheet-id', sheetTab: 'Catalog', sheetRange: 'A:C', values: [['variant_id', 'retail_price'], ['variant-1', '135000'], ['variant-1', '140000']] }) },
    canonicalRepository: { readCatalog: async () => ({ products: [product], variants: [variant], manifest: { versionId: 'catalog-base' } }) },
    providerRepository: { listOffers: async () => [offer] },
    logger: { info() {} },
  });
  const duplicate = await duplicateService.preview();
  assert.deepEqual(duplicate.rows.map((row) => row.errors.map((error) => error.code)), [['DUPLICATE_TARGET'], ['DUPLICATE_TARGET']]);

  const secondVariant = { ...variant, id: 'variant-2', sku: 'VN-2GB' };
  const conflictRepo = createInMemorySheetSyncRepository();
  const conflictService = createSheetSyncService({
    repository: conflictRepo,
    referenceClient: { readRows: async () => ({ spreadsheetId: 'sheet-id', sheetTab: 'Catalog', sheetRange: 'A:D', values: [['variant_id', 'retail_price', 'apn'], ['variant-1', '135000', 'apn-a'], ['variant-2', '140000', 'apn-b']] }) },
    canonicalRepository: { readCatalog: async () => ({ products: [product], variants: [variant, secondVariant], manifest: { versionId: 'catalog-base' } }) },
    providerRepository: { listOffers: async () => [offer] },
    logger: { info() {} },
  });
  const conflict = await conflictService.preview();
  assert.ok(conflict.rows.every((row) => row.errors.some((error) => error.code === 'PROVIDER_METADATA_CONFLICT')));
});

test('apply claims a batch and returns an idempotent result on repeat', async () => {
  const repository = createInMemorySheetSyncRepository();
  let applyCalls = 0;
  const service = createSheetSyncService({
    repository,
    referenceClient: { readRows: async () => ({ spreadsheetId: 'sheet-id', sheetTab: 'Catalog', sheetRange: 'A:C', values: [['variant_id', 'retail_price'], ['variant-1', '135000']] }) },
    canonicalRepository: { readCatalog: async () => ({ products: [product], variants: [variant], manifest: { versionId: 'catalog-base' } }) },
    providerRepository: { listOffers: async () => [offer] },
    applyService: { apply: async () => { applyCalls += 1; return { versionId: 'catalog-applied', applied: { 'row-1': { status: 'APPLIED', appliedFields: ['price'], appliedAt: '2026-08-04T00:00:00.000Z' } } }; } },
    idFactory: (() => { const ids = ['row-1', 'batch-1']; return () => ids.shift() ?? 'unused'; })(),
    logger: { info() {} },
  });
  const preview = await service.preview();
  const first = await service.apply(preview.batch.id, { actor: { id: 'admin-1' } });
  const second = await service.apply(preview.batch.id, { actor: { id: 'admin-1' } });
  assert.equal(applyCalls, 1);
  assert.equal(first.idempotent, false);
  assert.equal(second.idempotent, true);
  assert.equal(second.versionId, 'catalog-applied');
});
