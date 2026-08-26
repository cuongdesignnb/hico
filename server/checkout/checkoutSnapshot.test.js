import assert from 'node:assert/strict';
import test from 'node:test';
import { createOrderItemSnapshot } from './checkoutSnapshot.js';

test('order item snapshot keeps sold catalog data and provider fulfillment evidence separately', () => {
  const snapshot = createOrderItemSnapshot({
    product: { id: 'product-1', name: 'China eSIM', operation: 'new_subscription' },
    variant: { id: 'variant-1', sku: 'SKU-1', medium: 'esim', price: 100000, currency: 'VND', supplier: 'hico', fulfillmentMethod: 'MANUAL_PROCESSING', wmproductId: null },
    providerOffer: { providerProductType: 0, leSIM: true },
    providerResolution: {
      provider: 'WORLDMOVE', providerOfferId: 'offer-2', providerWmproductId: 'WM-CN-500MB-2D', requestedDays: 1, providerDurationDays: 2, strategy: 'NEXT_LONGER', upgradeDays: 1, bindingVersion: null, providerSnapshotHash: 'hash', fulfillmentMethod: 'WORLDMOVE_ESIM_REDEEM',
    },
    quantity: 1,
  });
  assert.equal(snapshot.soldVariantId, 'variant-1');
  assert.match(snapshot.sku, /^HICO-[A-F0-9]{8}$/);
  assert.equal(snapshot.soldSku, 'SKU-1');
  assert.equal(snapshot.soldDurationDays, 1);
  assert.equal(snapshot.providerWmproductId, 'WM-CN-500MB-2D');
  assert.equal(snapshot.providerDurationDays, 2);
  assert.equal(snapshot.fulfillmentStrategy, 'NEXT_LONGER');
  assert.equal(snapshot.provider, 'WORLDMOVE');
});

test('order item snapshot stores customer trip intent separately from provider duration', () => {
  const snapshot = createOrderItemSnapshot({
    product: { id: 'product-trip', name: 'Japan eSIM', operation: 'new_subscription' },
    variant: { id: 'variant-trip', sku: 'SKU-TRIP', medium: 'esim', price: 100000, currency: 'VND', tripDayOptions: [11, 12, 13], supplier: 'hico', fulfillmentMethod: 'MANUAL_PROCESSING', wmproductId: 'WM-JP-TRIP' },
    providerResolution: { requestedDays: null, providerDurationDays: null },
    quantity: 1,
    requestedTripDays: 12,
  });
  assert.equal(snapshot.requestedTripDays, 12);
  assert.deepEqual(snapshot.tripDayOptions, [11, 12, 13]);
  assert.equal(snapshot.soldDurationDays, null);
  assert.equal(snapshot.providerDurationDays, null);
});
