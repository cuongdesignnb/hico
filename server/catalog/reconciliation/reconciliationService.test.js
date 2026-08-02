import assert from 'node:assert/strict';
import test from 'node:test';
import { createReconciliationService } from './reconciliationService.js';

const product = {
  id: 'japan',
  name: 'Nhật Bản',
  operation: 'new_subscription',
  variants: [{
    id: 'variant-1',
    productId: 'japan',
    sku: 'JP-10GB',
    wmproductId: 'WM-JP-10GB',
    medium: 'esim',
    fulfillmentMethod: 'MANUAL_PROCESSING',
  }],
};

const offer = {
  id: 'worldmove:WM-JP-10GB',
  wmproductId: 'WM-JP-10GB',
  providerProductId: 'jp-esim',
  providerProductName: 'Japan eSIM',
  productRegion: 'Japan',
  providerProductType: 0,
  leSIM: true,
  active: true,
  providerCost: 600,
  providerCurrency: 'TWD',
  syncedAt: '2026-07-28T11:00:00.000Z',
  rawHash: 'hash-1',
};

const createMemoryRepository = () => {
  let records = [];
  return {
    async listRecords() {
      return structuredClone(records);
    },
    async saveRecords(nextRecords) {
      records = structuredClone(nextRecords);
    },
  };
};

test('rerun is idempotent and unchanged record keeps its timestamp', async () => {
  const reconciliationRepository = createMemoryRepository();
  const dates = [
    new Date('2026-07-28T12:00:00.000Z'),
    new Date('2026-07-28T13:00:00.000Z'),
  ];
  const service = createReconciliationService({
    catalogService: { listAdminProducts: async () => [product] },
    providerRepository: { listOffers: async () => [offer] },
    reconciliationRepository,
    now: () => dates.shift(),
  });

  const first = await service.run();
  const firstRecord = (await reconciliationRepository.listRecords())[0];
  const second = await service.run();
  const secondRecord = (await reconciliationRepository.listRecords())[0];

  assert.deepEqual(
    { created: first.created, updated: first.updated, unchanged: first.unchanged },
    { created: 1, updated: 0, unchanged: 0 },
  );
  assert.deepEqual(
    { created: second.created, updated: second.updated, unchanged: second.unchanged },
    { created: 0, updated: 0, unchanged: 1 },
  );
  assert.equal(secondRecord.updatedAt, firstRecord.updatedAt);
});

test('admin confirmation survives rerun and provider drift', async () => {
  const reconciliationRepository = createMemoryRepository();
  let currentOffer = offer;
  const dates = [
    new Date('2026-07-28T12:00:00.000Z'),
    new Date('2026-07-28T12:30:00.000Z'),
    new Date('2026-07-28T13:00:00.000Z'),
  ];
  const service = createReconciliationService({
    catalogService: { listAdminProducts: async () => [product] },
    providerRepository: { listOffers: async () => [currentOffer] },
    reconciliationRepository,
    now: () => dates.shift(),
  });

  await service.run();
  await service.updateItem('variant-1', {
    resolution: 'WORLDMOVE_ESIM_REDEEM',
    reviewedBy: 'qa@hico.vn',
  });
  currentOffer = {
    ...offer,
    providerCost: 700,
    rawHash: 'hash-2',
  };

  const rerun = await service.run();
  const record = (await reconciliationRepository.listRecords())[0];

  assert.equal(rerun.adminConfirmedPreserved, 1);
  assert.equal(record.status, 'CONFIRMED_BY_ADMIN');
  assert.equal(record.confirmedResolution, 'WORLDMOVE_ESIM_REDEEM');
  assert.equal(record.reviewedBy, 'qa@hico.vn');
  assert.match(record.reason, /provider drift/);
});
