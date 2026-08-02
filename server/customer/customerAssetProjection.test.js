import assert from 'node:assert/strict';
import test from 'node:test';
import { projectCustomerAsset, projectOwnedAssets } from './customerAssetProjection.js';
import { createCustomerAssetRevealService } from './customerAssetRevealService.js';
import { createCustomerAssetRepository } from './customerAssetRepository.js';

const order = (ownershipStatus = 'OWNED') => ({
  orderId: 'HICO-ASSET-1',
  customerId: ownershipStatus === 'OWNED' ? 'customer-1' : null,
  ownershipStatus,
  status: 'PROVISIONED',
  currency: 'VND',
  createdAt: '2026-08-02T00:00:00.000Z',
  items: [{ productName: 'eSIM Japan', productId: 'product-1', variantId: 'variant-1', sku: 'SKU-1', operation: 'new_subscription', medium: 'esim', fulfillmentMethod: 'WORLDMOVE_ESIM_REDEEM', quantity: 1, unitPrice: 100000, currency: 'VND' }],
});

test('customer asset projection is owner-scoped, redacted and mock-safe', () => {
  const result = projectOwnedAssets({
    orders: [order(), order('LEGACY_UNRESOLVED')],
    fulfillments: [
      { id: 'ful-real', orderId: 'HICO-ASSET-1', orderItemId: 'HICO-ASSET-1:item:0', itemIndex: 0, state: 'PROVISIONED', itemData: { iccid: '898520400001234567', qrcode: 'https://example.test/qr/secret', qrcodeContent: 'LPA:1$secret', pin1: '1234', puk1: '12345678', apnExplain: 'internet' } },
      { id: 'ful-mock', orderId: 'HICO-ASSET-1', orderItemId: 'HICO-ASSET-1:item:0', itemIndex: 0, state: 'PROVISIONED', itemData: { iccid: '898520400001234567', redemptionCode: 'RC_MOCK' } },
    ],
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].iccidMasked, '**************4567');
  assert.equal(result[0].hasQr, true);
  assert.equal(result[0].hasLpa, true);
  assert.equal(JSON.stringify(result).includes('LPA:1$secret'), false);
  assert.equal(JSON.stringify(result).includes('1234'), false);
  assert.equal(JSON.stringify(result).includes('898520400001234567'), false);
});

test('asset reveal requires recent re-auth and records only safe field names', async () => {
  const audits = [];
  const service = createCustomerAssetRevealService({
    assetRepository: {
      sourceFor: async () => ({ asset: { assetType: 'ESIM', id: 'asset-1', orderId: 'order-1' }, record: { itemData: { iccid: '898520400001234567', qrcodeContent: 'LPA:1$secret', pin1: '1234' } } }),
    },
    auditRepository: { recordReveal: async (event) => audits.push(event) },
    env: { CUSTOMER_REAUTH_WINDOW_MINUTES: '10' },
    now: () => new Date('2026-08-02T00:10:00.000Z'),
  });
  await assert.rejects(() => service.reveal({ customerId: 'customer-1', assetId: 'asset-1', session: { lastAuthenticatedAt: '2026-08-01T23:59:00.000Z' } }), (error) => error.code === 'ESIM_REVEAL_REAUTH_REQUIRED');
  const result = await service.reveal({ customerId: 'customer-1', assetId: 'asset-1', session: { lastAuthenticatedAt: '2026-08-02T00:05:00.000Z' } });
  assert.deepEqual(result.fields, { iccid: '898520400001234567', qrCode: null, lpa: 'LPA:1$secret', pin: '1234', puk: null, apn: null });
  assert.deepEqual(audits[0].fieldsRevealed, ['iccid', 'lpa', 'pin']);
  assert.equal(JSON.stringify(audits).includes('LPA:1$secret'), false);
});

test('asset repository fails closed when fulfillment persistence is missing', async () => {
  const repository = createCustomerAssetRepository({
    orderRepository: { countForCustomer: async () => 0, listForCustomer: async () => [] },
    fulfillmentRepository: { persistenceReady: async () => false, findByOrderId: async () => [], list: async () => [] },
    env: { CUSTOMER_ASSETS_ENABLED: 'true' },
  });
  assert.deepEqual((await repository.health()).status, 'not_ready');
  assert.equal((await repository.summary('customer-1')).available.esims, false);
});
