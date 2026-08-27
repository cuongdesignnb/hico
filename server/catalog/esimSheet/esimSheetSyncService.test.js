import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { sha256 } from '../canonical/canonicalCatalogChecksum.js';
import { cloneSeedCategories } from '../categories/catalogCategories.js';
import { atomicWriteJson } from '../write/catalogWritePersistence.js';
import { sourceKeyForWmid } from './esimSheetSource.js';
import { createEsimSheetSyncService } from './esimSheetSyncService.js';

const headers = Array.from({ length: 25 }, () => '');
Object.assign(headers, {
  0: 'Loại SIM',
  1: 'BẢNG GIÁ SIM DU LỊCH - HICO.VN',
  2: 'Ngày',
  3: 'Loại data',
  5: 'Giá eSim',
  10: 'APN',
  11: 'Quốc gia/ nhà mạng',
  13: 'mốc thời gian reset',
  15: 'Được huỷ gói',
  23: 'wmid_sim',
  24: 'wmid_esim',
});

const row = Array.from({ length: 25 }, () => '');
Object.assign(row, {
  0: 'eSIM',
  1: 'Mainland China, 1 Day, 500MB /day, 128kbps',
  2: '1',
  3: 'Chia ngày',
  5: '55000',
  10: 'mobile',
  11: 'Trung Quốc : China Unicom, China Telecom',
  13: 'Reset dung lượng: 23:00 hàng ngày',
  15: 'Có thể',
  24: 'WM-e-CN-500MB-1D',
});

test('eSIM Sheet preview/apply uses SimHICO eSIM columns and only creates drafts', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'hico-esim-sheet-'));
  let commitInput;
  try {
    const providerOffer = {
      id: 'offer-cn-1d',
      provider: 'worldmove',
      wmproductId: 'WM-e-CN-500MB-1D',
      providerProductId: 'provider-cn-1d',
      providerProductType: 0,
      leSIM: true,
      active: true,
    };
    const service = createEsimSheetSyncService({
      env: { CATALOG_READ_SOURCE: 'canonical' },
      uploadsDirectory: directory,
      referenceClient: {
        async readRows() {
          return { spreadsheetId: 'sheet-1', sheetTab: 'SimHICO', sheetRange: 'A1:AT18315', values: [headers, row] };
        },
      },
      catalogRepository: {
        async readCatalog() {
          return { manifest: { versionId: 'catalog-v1' }, products: [], variants: [], categories: cloneSeedCategories() };
        },
      },
      providerRepository: { async listOffers() { return [providerOffer]; } },
      commandService: {
        async execute({ handler }) {
          const result = await handler({ commandId: 'command-1', requestHash: 'request-hash' });
          return { ...result, replayed: false };
        },
      },
      commitService: {
        async commit(input) {
          commitInput = input;
          return { manifest: { versionId: input.versionId }, warnings: [] };
        },
      },
      auditRepository: { async append() {}, async remove() {} },
    });

    const preview = await service.preview({ catalogVersionId: 'catalog-v1', categoryId: 'cat-esim-du-lich' }, { id: 'admin-1' });
    assert.equal(preview.source, 'HICO_ESIM_SHEET');
    assert.equal(preview.rowCount, 1);
    assert.equal(preview.eligible, 1);
    assert.equal(preview.blocked, 0);

    const applied = await service.apply({
      previewId: preview.previewId,
      catalogVersionId: 'catalog-v1',
      idempotencyKey: 'apply-1',
      confirm: true,
    }, { id: 'admin-1' });
    assert.equal(applied.body.status, 'SYNC_APPLIED');
    assert.equal(commitInput.products[0].status, 'draft');
    assert.equal(commitInput.variants[0].active, false);
    assert.equal(commitInput.variants[0].fulfillmentMethod, 'WORLDMOVE_ESIM_REDEEM');
    assert.equal(commitInput.variants[0].wmproductId, 'WM-e-CN-500MB-1D');
    assert.equal(commitInput.variants[0].price, 55000);
    assert.equal(commitInput.variants[0].shippingRequired, false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('eSIM Sheet sync skips non-eSIM rows and never substitutes the SIM price column', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'hico-esim-sheet-'));
  try {
    const physicalRow = [...row];
    physicalRow[0] = 'Sim vật lý';
    physicalRow[4] = '70000';
    physicalRow[5] = '';
    const service = createEsimSheetSyncService({
      env: { CATALOG_READ_SOURCE: 'canonical' },
      uploadsDirectory: directory,
      referenceClient: { async readRows() { return { values: [headers, physicalRow] }; } },
      catalogRepository: { async readCatalog() { return { manifest: { versionId: 'catalog-v1' }, products: [], variants: [], categories: cloneSeedCategories() }; } },
      providerRepository: { async listOffers() { return []; } },
    });
    const preview = await service.preview({ catalogVersionId: 'catalog-v1', categoryId: 'cat-esim-du-lich' });
    assert.equal(preview.eligible, 0);
    assert.equal(preview.blocked, 0);
    assert.equal(preview.skipped, 1);
    assert.deepEqual(preview.errors, []);
    assert.equal(preview.rows[0].status, 'SKIPPED_NON_ESIM');
    assert.equal(preview.rows[0].skipReason, 'SKIPPED_NON_ESIM');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('eSIM Sheet apply commits eligible rows while reporting blocked rows', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'hico-esim-sheet-partial-'));
  let commitInput;
  try {
    const invalid = [...row];
    invalid[1] = 'Mainland China, 2 Day, 500MB /day, 128kbps';
    invalid[2] = '2';
    invalid[5] = '';
    invalid[24] = 'WM-e-CN-500MB-2D';
    const offers = [
      { id: 'offer-cn-1d', provider: 'worldmove', wmproductId: 'WM-e-CN-500MB-1D', providerProductId: 'provider-cn-1d', providerProductType: 0, leSIM: true, active: true },
      { id: 'offer-cn-2d', provider: 'worldmove', wmproductId: 'WM-e-CN-500MB-2D', providerProductId: 'provider-cn-2d', providerProductType: 0, leSIM: true, active: true },
    ];
    const service = createEsimSheetSyncService({
      env: { CATALOG_READ_SOURCE: 'canonical' },
      uploadsDirectory: directory,
      referenceClient: { async readRows() { return { sheetTab: 'SimHICO', values: [headers, row, invalid] }; } },
      catalogRepository: { async readCatalog() { return { manifest: { versionId: 'catalog-v1' }, products: [], variants: [], categories: cloneSeedCategories() }; } },
      providerRepository: { async listOffers() { return offers; } },
      commandService: { async execute({ handler }) { return { ...(await handler({ commandId: 'partial-command', requestHash: 'partial-hash' })), replayed: false }; } },
      commitService: { async commit(input) { commitInput = input; return { manifest: { versionId: 'catalog-v2' }, warnings: [] }; } },
      auditRepository: { async append() {}, async remove() {} },
    });
    const preview = await service.preview({ catalogVersionId: 'catalog-v1', categoryId: 'cat-esim-du-lich' });
    assert.equal(preview.eligible, 1);
    assert.equal(preview.blocked, 1);
    assert.equal(preview.skipped, 0);
    assert.equal(preview.partial, true);
    const applied = await service.apply({ previewId: preview.previewId, catalogVersionId: 'catalog-v1', idempotencyKey: 'partial-apply', confirm: true });
    assert.equal(applied.body.status, 'SYNC_APPLIED');
    assert.equal(applied.body.eligible, 1);
    assert.equal(applied.body.blocked, 1);
    assert.equal(applied.body.partial, true);
    assert.equal(commitInput.variants.length, 1);
    assert.equal(commitInput.variants[0].wmproductId, 'WM-e-CN-500MB-1D');
    assert.equal(applied.body.errors.length, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('repeated SimHICO apply reuses source product and variant identity', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'hico-esim-sheet-repeat-'));
  try {
    const providerOffer = {
      id: 'offer-cn-1d', provider: 'worldmove', wmproductId: 'WM-e-CN-500MB-1D', providerProductId: 'provider-cn-1d',
      providerProductType: 0, leSIM: true, active: true,
    };
    const familyKey = row[1].trim().toLocaleUpperCase('vi-VN');
    const existingProductId = 'product-existing';
    const existingVariantId = 'variant-existing';
    const timestamp = new Date().toISOString();
    let currentCatalog = {
      manifest: { versionId: 'catalog-v1' },
      products: [{
        id: existingProductId, slug: 'existing-esim', name: row[1], operation: 'new_subscription', categoryId: 'cat-esim-du-lich',
        coverageType: 'country', coverageIds: [], status: 'draft', featured: false, version: 1, createdAt: timestamp, updatedAt: timestamp,
        source: 'HICO_ESIM_SHEET', sourceKey: `HICO_ESIM_SHEET:FAMILY:${sha256(familyKey).slice(0, 24)}`,
      }],
      variants: [{
        id: existingVariantId, productId: existingProductId, sku: 'OLD-SKU', publicSku: 'HICO-ABCDEF12', price: 55000, currency: 'VND', medium: 'esim', supplier: 'worldmove',
        fulfillmentMethod: 'WORLDMOVE_ESIM_REDEEM', providerOfferId: providerOffer.id, wmproductId: providerOffer.wmproductId, providerProductId: providerOffer.providerProductId,
        providerProductType: 0, leSIM: true, requiresExistingSim: false, shippingRequired: false, durationDays: 1, duration: '1 ngày', durationValue: 1, durationUnit: 'day',
        tripDayOptions: [], dataLimit: '500 MB', dataPolicy: 'daily', networkLabel: 'China Unicom, China Telecom', apn: 'mobile', resetPolicy: 'Reset dung lượng: 23:00 hàng ngày',
        cancellable: true, active: false, archived: false, needsReview: false, stock: null, source: 'HICO_ESIM_SHEET', sourceKey: sourceKeyForWmid(row[24]), sourceWmid: row[24], sourceRevision: 1,
        version: 1, createdAt: timestamp, updatedAt: timestamp,
      }],
      categories: cloneSeedCategories(),
    };
    let lastCommit;
    const service = createEsimSheetSyncService({
      env: { CATALOG_READ_SOURCE: 'canonical' },
      uploadsDirectory: directory,
      referenceClient: { async readRows() { return { spreadsheetId: 'sheet-1', sheetTab: 'SimHICO', sheetRange: 'A1:Y2', values: [headers, row] }; } },
      catalogRepository: { async readCatalog() { return currentCatalog; } },
      providerRepository: { async listOffers() { return [providerOffer]; } },
      commandService: { async execute({ handler }) { return { ...(await handler({ commandId: `command-${Date.now()}`, requestHash: 'request-hash' })), replayed: false }; } },
      commitService: { async commit(input) { lastCommit = input; currentCatalog = { manifest: { versionId: input.versionId }, products: input.products, variants: input.variants, categories: input.categories }; return { manifest: { versionId: input.versionId }, warnings: [] }; } },
      auditRepository: { async append() {}, async remove() {} },
    });

    const firstPreview = await service.preview({ catalogVersionId: 'catalog-v1', categoryId: 'cat-esim-du-lich' });
    const firstApply = await service.apply({ previewId: firstPreview.previewId, catalogVersionId: 'catalog-v1', idempotencyKey: 'repeat-1', confirm: true });
    const secondPreview = await service.preview({ catalogVersionId: firstApply.body.catalogVersionId, categoryId: 'cat-esim-du-lich' });
    const secondApply = await service.apply({ previewId: secondPreview.previewId, catalogVersionId: firstApply.body.catalogVersionId, idempotencyKey: 'repeat-2', confirm: true });

    assert.equal(firstApply.body.productsCreated, 0);
    assert.equal(firstApply.body.variantsCreated, 0);
    assert.equal(secondApply.body.productsCreated, 0);
    assert.equal(secondApply.body.variantsCreated, 0);
    assert.equal(currentCatalog.products.length, 1);
    assert.equal(currentCatalog.variants.length, 1);
    assert.equal(lastCommit.products[0].id, existingProductId);
    assert.equal(lastCommit.variants[0].id, existingVariantId);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('apply rejects a preview with an obsolete parser revision', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'hico-esim-sheet-stale-'));
  try {
    const providerOffer = { id: 'offer-cn-1d', provider: 'worldmove', wmproductId: 'WM-e-CN-500MB-1D', providerProductType: 0, leSIM: true, active: true };
    const service = createEsimSheetSyncService({
      env: { CATALOG_READ_SOURCE: 'canonical' }, uploadsDirectory: directory,
      referenceClient: { async readRows() { return { sheetTab: 'SimHICO', values: [headers, row] }; } },
      catalogRepository: { async readCatalog() { return { manifest: { versionId: 'catalog-v1' }, products: [], variants: [], categories: cloneSeedCategories() }; } },
      providerRepository: { async listOffers() { return [providerOffer]; } },
      commandService: { async execute({ handler }) { return handler({ commandId: 'command-stale', requestHash: 'request-stale' }); } },
      auditRepository: { async append() {}, async remove() {} },
    });
    const preview = await service.preview({ catalogVersionId: 'catalog-v1', categoryId: 'cat-esim-du-lich' });
    const stored = JSON.parse(await readFile(path.join(directory, 'esim_sheet_previews.json'), 'utf8'));
    stored[0].parserRevision = 0;
    await atomicWriteJson(path.join(directory, 'esim_sheet_previews.json'), stored);
    await assert.rejects(
      service.apply({ previewId: preview.previewId, catalogVersionId: 'catalog-v1', idempotencyKey: 'stale-1', confirm: true }),
      (error) => error.code === 'ESIM_SHEET_PREVIEW_STALE' && error.status === 409,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('same-WMID identical total rows collapse and union trip-day options', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'hico-esim-sheet-collapse-'));
  try {
    const totalA = [...row];
    totalA[1] = 'Mainland China, 5 Days, 3GB, 128kbps';
    totalA[2] = '5';
    totalA[3] = 'Gói tổng';
    totalA[24] = 'WM-e-CN-TOTAL-5D';
    const totalB = [...totalA];
    totalB[2] = '7';
    const offer = { id: 'offer-total', provider: 'worldmove', wmproductId: 'WM-e-CN-TOTAL-5D', providerProductType: 0, leSIM: true, active: true };
    const service = createEsimSheetSyncService({
      env: { CATALOG_READ_SOURCE: 'canonical' }, uploadsDirectory: directory,
      referenceClient: { async readRows() { return { sheetTab: 'SimHICO', values: [headers, totalA, totalB] }; } },
      catalogRepository: { async readCatalog() { return { manifest: { versionId: 'catalog-v1' }, products: [], variants: [], categories: cloneSeedCategories() }; } },
      providerRepository: { async listOffers() { return [offer]; } },
      auditRepository: { async append() {}, async remove() {} },
    });
    const preview = await service.preview({ catalogVersionId: 'catalog-v1', categoryId: 'cat-esim-du-lich' });
    assert.equal(preview.rowCount, 1);
    assert.deepEqual(preview.rows[0].sourceRowNumbers, [2, 3]);
    assert.deepEqual(preview.rows[0].tripDayOptions, [5, 7]);
    assert.deepEqual(preview.errors, []);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('same-WMID commercial conflicts remain blocked instead of collapsing', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'hico-esim-sheet-conflict-'));
  try {
    const first = [...row];
    first[24] = 'WM-e-CN-CONFLICT';
    const second = [...first];
    second[5] = '56000';
    const offer = { id: 'offer-conflict', provider: 'worldmove', wmproductId: 'WM-e-CN-CONFLICT', providerProductType: 0, leSIM: true, active: true };
    const service = createEsimSheetSyncService({
      env: { CATALOG_READ_SOURCE: 'canonical' }, uploadsDirectory: directory,
      referenceClient: { async readRows() { return { sheetTab: 'SimHICO', values: [headers, first, second] }; } },
      catalogRepository: { async readCatalog() { return { manifest: { versionId: 'catalog-v1' }, products: [], variants: [], categories: cloneSeedCategories() }; } },
      providerRepository: { async listOffers() { return [offer]; } },
      auditRepository: { async append() {}, async remove() {} },
    });
    const preview = await service.preview({ catalogVersionId: 'catalog-v1', categoryId: 'cat-esim-du-lich' });
    assert.equal(preview.rowCount, 2);
    assert.equal(preview.errors.every((error) => error.errors.includes('SAME_WMID_COMMERCIAL_CONFLICT')), true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('legacy WMID collision is review-only and cannot be applied', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'hico-esim-sheet-legacy-'));
  try {
    const offer = { id: 'offer-legacy', provider: 'worldmove', wmproductId: 'WM-e-CN-500MB-1D', providerProductType: 0, leSIM: true, active: true };
    const service = createEsimSheetSyncService({
      env: { CATALOG_READ_SOURCE: 'canonical' }, uploadsDirectory: directory,
      referenceClient: { async readRows() { return { sheetTab: 'SimHICO', values: [headers, row] }; } },
      catalogRepository: { async readCatalog() { return {
        manifest: { versionId: 'catalog-v1' }, products: [], variants: [{ id: 'legacy-v', source: 'LEGACY', wmproductId: row[24] }], categories: cloneSeedCategories(),
      }; } },
      providerRepository: { async listOffers() { return [offer]; } },
      commandService: { async execute({ handler }) { return handler({ commandId: 'command-legacy', requestHash: 'request-legacy' }); } },
      auditRepository: { async append() {}, async remove() {} },
    });
    const preview = await service.preview({ catalogVersionId: 'catalog-v1', categoryId: 'cat-esim-du-lich' });
    assert.equal(preview.rows[0].legacyCollision, true);
    assert.ok(preview.errors[0].errors.includes('LEGACY_WMID_COLLISION'));
    await assert.rejects(
      service.apply({ previewId: preview.previewId, catalogVersionId: 'catalog-v1', idempotencyKey: 'legacy-1', confirm: true }),
      (error) => error.code === 'ESIM_SHEET_APPLY_BLOCKED',
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
