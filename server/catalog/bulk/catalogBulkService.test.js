import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createCanonicalCatalogRepository } from '../canonical/canonicalCatalogRepository.js';
import { createCatalogAuditRepository } from '../write/catalogAuditRepository.js';
import { createCatalogCommandService } from '../write/catalogCommandService.js';
import { createCatalogIdempotencyRepository } from '../write/catalogIdempotencyRepository.js';
import { createCatalogVersionCommitService } from '../write/catalogVersionCommitService.js';
import { createCatalogBulkService } from './catalogBulkService.js';

const timestamp = '2026-07-31T00:00:00.000Z';
const product = {
  id: 'product-1',
  name: 'Product 1',
  slug: 'product-1',
  operation: 'new_subscription',
  coverageType: 'country',
  coverageIds: ['vn'],
  featured: false,
  status: 'draft',
  version: 1,
  createdAt: timestamp,
  updatedAt: timestamp,
};

const variant = (id, changes = {}) => ({
  id,
  productId: 'product-1',
  sku: `SKU-${id}`,
  price: 100,
  compareAtPrice: null,
  currency: 'VND',
  medium: 'esim',
  supplier: 'hico',
  fulfillmentMethod: 'HICO_MANUAL_QR',
  providerProductType: null,
  leSIM: null,
  requiresExistingSim: false,
  stock: null,
  active: false,
  needsReview: false,
  version: 1,
  createdAt: timestamp,
  updatedAt: timestamp,
  ...changes,
});

const setup = async (t, variants = [variant('variant-1')]) => {
  const uploadsDirectory = await mkdtemp(path.join(os.tmpdir(), 'hico-bulk-service-'));
  t.after(() => rm(uploadsDirectory, { recursive: true, force: true }));
  const commitService = createCatalogVersionCommitService({
    uploadsDirectory,
    logger: { warn() {} },
  });
  await commitService.commit({
    versionId: 'catalog-base',
    parentVersionId: null,
    products: [product],
    variants,
    commandType: 'MIGRATE',
    commandId: 'migration',
    requestHash: 'migration',
    createdAt: timestamp,
  });
  return {
    uploadsDirectory,
    commitService,
    service: createCatalogBulkService({
      env: { CATALOG_READ_SOURCE: 'canonical' },
      uploadsDirectory,
      catalogRepository: createCanonicalCatalogRepository({ uploadsDirectory }),
      commitService,
      commandService: createCatalogCommandService({
        env: { CATALOG_READ_SOURCE: 'canonical' },
        idempotencyRepository: createCatalogIdempotencyRepository({
          recordsFile: path.join(uploadsDirectory, 'catalog_idempotency.json'),
        }),
      }),
      providerOfferRepository: { listOffers: async () => [] },
      auditRepository: createCatalogAuditRepository({
        recordsFile: path.join(uploadsDirectory, 'catalog_audit.json'),
      }),
    }),
  };
};

test('bulk preview executes one canonical version and idempotent retry replays', async (t) => {
  const { service } = await setup(t);
  const preview = await service.preview({
    idempotencyKey: 'preview-key',
    catalogVersionId: 'catalog-base',
    entityType: 'variant',
    selection: { mode: 'ids', ids: ['variant-1'] },
    operation: { type: 'SET_PRICE', value: 250, currency: 'VND' },
  });
  assert.equal(preview.eligible, 1);
  assert.equal(preview.blocked, 0);
  const request = {
    idempotencyKey: 'execute-key',
    previewId: preview.previewId,
    catalogVersionId: preview.catalogVersionId,
    selectionHash: preview.selectionHash,
    confirm: true,
  };
  const first = await service.execute(request);
  const replay = await service.execute(request);
  assert.equal(first.body.affectedCount, 1);
  assert.equal(replay.replayed, true);
  assert.equal(replay.body.catalogVersionId, first.body.catalogVersionId);
});

test('bulk execute is all-or-nothing when one selected item is blocked', async (t) => {
  const { service } = await setup(t, [variant('variant-1'), variant('variant-2', { needsReview: true })]);
  const preview = await service.preview({
    idempotencyKey: 'preview-blocked',
    catalogVersionId: 'catalog-base',
    entityType: 'variant',
    selection: { mode: 'ids', ids: ['variant-1', 'variant-2'] },
    operation: { type: 'PUBLISH' },
  });
  assert.equal(preview.eligible, 1);
  assert.equal(preview.blocked, 1);
  await assert.rejects(
    service.execute({
      idempotencyKey: 'execute-blocked',
      previewId: preview.previewId,
      catalogVersionId: preview.catalogVersionId,
      selectionHash: preview.selectionHash,
      confirm: true,
    }),
    (error) => error.code === 'BULK_BLOCKED' && error.status === 409,
  );
  const current = await service.readContext();
  assert.equal(current.manifest.versionId ?? current.manifest.migrationId, 'catalog-base');
});

test('bulk execute rejects a changed catalog after preview', async (t) => {
  const { service, commitService } = await setup(t);
  const preview = await service.preview({
    idempotencyKey: 'preview-stale',
    catalogVersionId: 'catalog-base',
    entityType: 'variant',
    selection: { mode: 'ids', ids: ['variant-1'] },
    operation: { type: 'SET_PRICE', value: 300, currency: 'VND' },
  });
  await commitService.commit({
    versionId: 'catalog-other',
    parentVersionId: 'catalog-base',
    products: [product],
    variants: [variant('variant-1', { price: 120 })],
    commandType: 'OTHER_WRITE',
    commandId: 'other-write',
    requestHash: 'other-write',
    createdAt: timestamp,
  });
  await assert.rejects(
    service.execute({
      idempotencyKey: 'execute-stale',
      previewId: preview.previewId,
      catalogVersionId: preview.catalogVersionId,
      selectionHash: preview.selectionHash,
      confirm: true,
    }),
    (error) => error.code === 'BULK_PREVIEW_STALE' && error.status === 409,
  );
});
