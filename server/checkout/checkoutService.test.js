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
