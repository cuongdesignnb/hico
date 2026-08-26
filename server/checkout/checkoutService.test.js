import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { atomicWriteJson } from '../catalog/write/catalogWritePersistence.js';
import { createCheckoutIdempotencyRepository } from './checkoutIdempotencyRepository.js';
import { createCheckoutService } from './checkoutService.js';

const request = { idempotencyKey: 'key-1', items: [{ variantId: 'v-1', quantity: 1 }], customer: { name: 'A', email: 'a@example.com', phone: '0900000000' }, shipping: null, topup: null };

test('checkout idempotency serializes duplicate concurrent creates and rejects payload drift', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'hico-checkout-'));
  const offers = path.join(directory, 'provider_offers.json');
  await atomicWriteJson(offers, []);
  let creates = 0;
  const service = createCheckoutService({
    env: { CHECKOUT_ENGINE: 'canonical' },
    providerOffersFile: offers,
    catalogReader: { readCatalog: async () => ({
      products: [{ id: 'p-1', name: 'Gói', operation: 'new_subscription', status: 'active' }],
      variants: [{ id: 'v-1', productId: 'p-1', sku: 'S-1', price: 100, currency: 'VND', medium: 'esim', supplier: 'hico', fulfillmentMethod: 'HICO_MANUAL_QR', active: true, needsReview: false }],
    }) },
    idempotencyRepository: createCheckoutIdempotencyRepository({ filePath: path.join(directory, 'idempotency.json') }),
    orderService: { createCanonicalOrder: async ({ snapshotFactory, request: payload, validated }) => {
      creates += 1;
      return snapshotFactory({ orderId: `o-${creates}`, request: payload, validated, createdAt: new Date().toISOString() });
    } },
  });
  const [first, second] = await Promise.all([service.createOrder(request), service.createOrder(request)]);
  assert.equal(first.orderId, second.orderId);
  assert.match(first.order.items[0].sku, /^HICO-[A-F0-9]{8}$/);
  assert.equal(JSON.stringify(first).includes('S-1'), false);
  assert.equal(creates, 1);
  await assert.rejects(service.createOrder({ ...request, items: [{ variantId: 'v-1', quantity: 2 }] }), (error) => error.code === 'CHECKOUT_IDEMPOTENCY_CONFLICT');
});

test('customer-owned top-up resolves simAssetId server-side and ignores client sim number', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'hico-checkout-asset-'));
  const offers = path.join(directory, 'provider_offers.json');
  await atomicWriteJson(offers, [{ id: 'offer-topup', wmproductId: 'WM-TOPUP', providerProductType: 2, active: true }]);
  let resolved = null;
  let createdRequest = null;
  const service = createCheckoutService({
    env: { CHECKOUT_ENGINE: 'canonical' },
    providerOffersFile: offers,
    customerAssetRepository: {
      resolveTopupSimNumber: async (customerId, assetId) => {
        resolved = { customerId, assetId };
        return '12345678901234567890';
      },
    },
    catalogReader: { readCatalog: async () => ({
      products: [{ id: 'p-topup', name: 'Nạp SIM', operation: 'topup', status: 'active' }],
      variants: [{ id: 'v-topup', productId: 'p-topup', price: 80000, currency: 'VND', medium: 'physical_sim', supplier: 'worldmove', fulfillmentMethod: 'WORLDMOVE_TOPUP', providerProductType: 2, active: true, needsReview: false, topupDays: 10, providerOfferId: 'offer-topup', wmproductId: 'WM-TOPUP' }],
    }) },
    idempotencyRepository: createCheckoutIdempotencyRepository({ filePath: path.join(directory, 'idempotency.json') }),
    orderService: { createCanonicalOrder: async ({ snapshotFactory, request: payload, validated }) => {
      createdRequest = payload;
      return snapshotFactory({ orderId: 'o-topup', request: payload, validated, createdAt: new Date().toISOString() });
    } },
  });
  const topupRequest = {
    idempotencyKey: 'asset-key',
    items: [{ variantId: 'v-topup', quantity: 1, clientPrice: 80000 }],
    customer: { name: 'A', email: 'a@example.com', phone: '0900000000' },
    shipping: null,
    topup: { simAssetId: 'asset-1', simNum: 'not-a-client-authority', day: 10 },
  };
  const response = await service.createOrder(topupRequest, { id: 'customer-1', displayName: 'A', email: 'a@example.com', phone: '0900000000' });
  assert.equal(response.orderId, 'o-topup');
  assert.deepEqual(resolved, { customerId: 'customer-1', assetId: 'asset-1' });
  assert.equal(createdRequest.topup.simNum, '12345678901234567890');
  await assert.rejects(service.validate(topupRequest), (error) => error.code === 'CUSTOMER_AUTH_REQUIRED');
});
