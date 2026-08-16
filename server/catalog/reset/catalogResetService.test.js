import assert from 'node:assert/strict';
import test from 'node:test';
import { cloneSeedCategories } from '../categories/catalogCategories.js';
import { createCatalogResetService, CATALOG_RESET_CONFIRMATION } from './catalogResetService.js';

test('reset creates an empty version without deleting media or fulfillment stores', async () => {
  let commitInput;
  let auditInput;
  const service = createCatalogResetService({
    canonicalRepository: { readCatalog: async () => ({ products: [{ id: 'p1', primaryMediaId: 'media-1', galleryMediaIds: ['media-2'] }], variants: [{ id: 'v1' }], categories: cloneSeedCategories(), manifest: { versionId: 'catalog-live' } }) },
    providerRepository: { listOffers: async () => [{ id: 'offer-1' }] },
    commandService: { execute: ({ handler }) => handler({ commandId: 'cmd-1', requestHash: 'hash-1' }).then((result) => ({ ...result, replayed: false })) },
    commitService: { commit: async (input) => { commitInput = input; await input.beforePointer(); return { manifest: { versionId: input.versionId }, warnings: [] }; } },
    auditRepository: { append: async (record) => { auditInput = record; return record; }, remove: async () => undefined },
    uploadsDirectory: 'C:/__hico_reset_test_missing__',
  });
  const preview = await service.preview();
  assert.equal(preview.products, 1);
  assert.equal(preview.variants, 1);
  assert.equal(preview.linkedMedia, 2);
  const result = await service.reset({ request: { catalogVersionId: 'catalog-live', confirmation: CATALOG_RESET_CONFIRMATION, idempotencyKey: 'reset-1' }, actor: { id: 'admin-1' } });
  assert.equal(result.body.reset, true);
  assert.deepEqual(commitInput.products, []);
  assert.deepEqual(commitInput.variants, []);
  assert.equal(auditInput.action, 'CATALOG_RESET');
  assert.equal(auditInput.mediaDeleted, 0);
});

test('reset requires the exact typed confirmation', async () => {
  const service = createCatalogResetService({
    canonicalRepository: { readCatalog: async () => ({ products: [], variants: [], categories: cloneSeedCategories(), manifest: { versionId: 'catalog-live' } }) },
    providerRepository: { listOffers: async () => [] },
    commandService: { execute: ({ handler }) => handler({ commandId: 'cmd-1', requestHash: 'hash-1' }) },
    uploadsDirectory: 'C:/__hico_reset_test_missing__',
  });
  await assert.rejects(() => service.reset({ request: { catalogVersionId: 'catalog-live', confirmation: 'XOA HET' } }), (error) => error.code === 'CATALOG_RESET_CONFIRMATION_REQUIRED');
});
