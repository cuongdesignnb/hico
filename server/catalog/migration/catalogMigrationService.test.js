import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  createCanonicalCatalogRepository,
} from '../canonical/canonicalCatalogRepository.js';
import { createCatalogMigrationService } from './catalogMigrationService.js';

const at = '2026-07-30T00:00:00.000Z';
const offer = (overrides = {}) => ({
  id: 'offer-esim',
  wmproductId: 'WM-ESIM',
  providerProductId: 'provider-esim',
  providerProductType: 0,
  leSIM: true,
  active: true,
  ...overrides,
});
const record = (overrides = {}) => ({
  productId: 'p1',
  variantId: 'v-esim',
  sku: 'SKU-ESIM',
  wmproductId: 'WM-ESIM',
  providerOfferId: 'offer-esim',
  status: 'MATCHED',
  suggestedResolution: 'WORLDMOVE_ESIM_REDEEM',
  reason: 'Exact',
  createdAt: at,
  updatedAt: at,
  ...overrides,
});

const sources = {
  destinations: [{
    id: 'p1',
    name: 'eSIM Nhật Bản',
    description: 'Nội dung',
    seoTitle: 'SEO title',
    variants: [
      {
        id: 'v-esim',
        sku: 'SKU-ESIM',
        price: 100000,
        compareAtPrice: 120000,
        wmproductId: 'WM-ESIM',
        simType: 'eSIM',
      },
      {
        id: 'v-manual',
        sku: 'SKU-MANUAL',
        price: 90000,
        simType: 'manual',
      },
      {
        id: 'v-physical',
        sku: 'SKU-PHYSICAL',
        price: 80000,
        simType: 'physical',
      },
    ],
  }, {
    id: 'p-topup',
    name: 'Nạp thêm',
    operation: 'topup',
    variants: [{
      id: 'v-topup',
      sku: 'SKU-TOPUP',
      price: 50000,
      wmproductId: 'WM-TOPUP',
      simType: 'eSIM',
    }],
  }],
  packages: [],
  providerOffers: [
    offer(),
    offer({
      id: 'offer-topup',
      wmproductId: 'WM-TOPUP',
      providerProductId: 'provider-topup',
      providerProductType: 2,
      leSIM: null,
    }),
  ],
  reconciliationRecords: [
    record(),
    record({
      variantId: 'v-manual',
      sku: 'SKU-MANUAL',
      wmproductId: undefined,
      providerOfferId: undefined,
      status: 'CONFIRMED_BY_ADMIN',
      suggestedResolution: undefined,
      confirmedResolution: 'HICO_MANUAL_QR',
      reviewedBy: 'admin',
      reviewedAt: at,
    }),
    record({
      variantId: 'v-physical',
      sku: 'SKU-PHYSICAL',
      wmproductId: undefined,
      providerOfferId: undefined,
      status: 'LEGACY_CONFLICT',
      suggestedResolution: undefined,
    }),
    record({
      productId: 'p-topup',
      variantId: 'v-topup',
      sku: 'SKU-TOPUP',
      wmproductId: 'WM-TOPUP',
      providerOfferId: 'offer-topup',
      status: 'CONFIRMED_BY_ADMIN',
      suggestedResolution: undefined,
      confirmedResolution: 'WORLDMOVE_TOPUP',
      reviewedBy: 'admin',
      reviewedAt: at,
    }),
  ],
  manualQrs: [{ id: 'qr-1', variantId: 'v-manual', assignedOrderId: null }],
};

const createHarness = async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'hico-migration-'));
  const repository = createCanonicalCatalogRepository({
    uploadsDirectory: directory,
  });
  let tick = 0;
  const service = createCatalogMigrationService({
    sourceRepository: { readSources: async () => structuredClone(sources) },
    canonicalRepository: repository,
    now: () => new Date(Date.parse(at) + tick++ * 1000),
  });
  return { directory, repository, service };
};

test('preserves legacy parity and applies only safe reconciliation', async () => {
  const harness = await createHarness();
  try {
    const result = await harness.service.validate();
    assert.equal(result.valid, true);
    assert.equal(result.products, 2);
    assert.equal(result.variants, 4);
    assert.deepEqual(result.report.missingProductIds, []);
    assert.deepEqual(result.report.missingVariantIds, []);
    assert.deepEqual(result.report.changedSkus, []);
    assert.deepEqual(result.report.changedWmproductIds, []);
    assert.deepEqual(result.report.changedPrices, []);
    assert.deepEqual(result.report.changedCompareAtPrices, []);
    assert.equal(result.report.reconciliationApplied.matched, 1);
    assert.equal(result.report.reconciliationApplied.confirmedByAdmin, 2);
    assert.equal(result.report.reconciliationApplied.leftNeedsReview, 1);
  } finally {
    await rm(harness.directory, { recursive: true, force: true });
  }
});

test('keeps IDs, content, prices and manual QR relationships unchanged', async () => {
  const harness = await createHarness();
  try {
    await harness.service.run();
    const { products, variants } = await harness.repository.readCatalog({
      required: true,
    });
    assert.deepEqual(products.map((item) => item.id), ['p1', 'p-topup']);
    assert.equal(products[0].slug, 'esim-nhat-ban');
    assert.equal(products[0].description, 'Nội dung');
    assert.equal(products[0].seoTitle, 'SEO title');
    assert.deepEqual(
      variants.map(({ id, sku, wmproductId, price, compareAtPrice }) => ({
        id,
        sku,
        wmproductId,
        price,
        compareAtPrice,
      })),
      [
        {
          id: 'v-esim',
          sku: 'SKU-ESIM',
          wmproductId: 'WM-ESIM',
          price: 100000,
          compareAtPrice: 120000,
        },
        {
          id: 'v-manual',
          sku: 'SKU-MANUAL',
          wmproductId: undefined,
          price: 90000,
          compareAtPrice: null,
        },
        {
          id: 'v-physical',
          sku: 'SKU-PHYSICAL',
          wmproductId: undefined,
          price: 80000,
          compareAtPrice: null,
        },
        {
          id: 'v-topup',
          sku: 'SKU-TOPUP',
          wmproductId: 'WM-TOPUP',
          price: 50000,
          compareAtPrice: null,
        },
      ],
    );
    assert.equal(variants[0].fulfillmentMethod, 'WORLDMOVE_ESIM_REDEEM');
    assert.equal(variants[1].fulfillmentMethod, 'HICO_MANUAL_QR');
    assert.equal(variants[1].reviewedBy, 'admin');
    assert.equal(variants[2].fulfillmentMethod, 'HICO_PHYSICAL_STOCK');
    assert.equal(variants[2].needsReview, true);
    assert.equal(variants[3].fulfillmentMethod, 'WORLDMOVE_TOPUP');
    assert.equal(variants[3].requiresExistingSim, true);
  } finally {
    await rm(harness.directory, { recursive: true, force: true });
  }
});

test('rerun is idempotent and preserves createdAt', async () => {
  const harness = await createHarness();
  try {
    const first = await harness.service.run();
    const firstCatalog = await harness.repository.readCatalog({ required: true });
    const second = await harness.service.run();
    const secondCatalog = await harness.repository.readCatalog({ required: true });
    assert.equal(first.created, true);
    assert.equal(second.created, false);
    assert.equal(second.unchanged, true);
    assert.equal(first.businessChecksum, second.businessChecksum);
    assert.equal(
      firstCatalog.products[0].createdAt,
      secondCatalog.products[0].createdAt,
    );
  } finally {
    await rm(harness.directory, { recursive: true, force: true });
  }
});

test('invalid source data fails without creating a canonical pointer', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'hico-migration-'));
  try {
    const repository = createCanonicalCatalogRepository({
      uploadsDirectory: directory,
    });
    const invalid = structuredClone(sources);
    invalid.destinations[0].variants[0].price = -1;
    const service = createCatalogMigrationService({
      sourceRepository: { readSources: async () => invalid },
      canonicalRepository: repository,
      now: () => new Date(at),
    });
    await assert.rejects(service.run(), /validation failed/);
    assert.equal(await repository.readCurrentManifest(), null);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
