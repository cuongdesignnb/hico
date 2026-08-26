import assert from 'node:assert/strict';
import test from 'node:test';
import { validateCanonicalCart } from './checkoutValidation.js';

const product = { id: 'p-1', slug: 'p-1', name: 'Gói Nhật', operation: 'new_subscription', status: 'active', coverageType: 'country', coverageIds: ['jp'] };
const baseVariant = {
  id: 'v-1', productId: 'p-1', sku: 'SKU-1', price: 280000, currency: 'VND', medium: 'esim', supplier: 'hico', fulfillmentMethod: 'HICO_MANUAL_QR', active: true, needsReview: false, skuConflict: null,
};
const catalog = { products: [product], variants: [baseVariant] };
const request = { items: [{ variantId: 'v-1', quantity: 1 }], shipping: null, topup: null, customer: { name: 'A', email: 'a@example.com', phone: '0900000000' } };

const topupProduct = { ...product, id: 'p-topup-rules', name: 'Nạp SIM', operation: 'topup' };
const topupVariant = {
  ...baseVariant,
  id: 'v-topup-rules',
  productId: topupProduct.id,
  medium: 'physical_sim',
  supplier: 'worldmove',
  fulfillmentMethod: 'WORLDMOVE_TOPUP',
  providerProductType: 2,
  providerOfferId: 'offer-topup-rules',
  wmproductId: 'WM-TOPUP-RULES',
  topupDays: 10,
};
const topupOffer = { id: 'offer-topup-rules', wmproductId: 'WM-TOPUP-RULES', providerProductType: 2, active: true };
const topupRequest = { ...request, items: [{ variantId: topupVariant.id, quantity: 1, clientPrice: topupVariant.price }], topup: { simNum: '12345678901234567890', day: 10 } };

test('canonical validation uses variant price and rejects empty or unavailable carts', () => {
  assert.throws(() => validateCanonicalCart({ catalog, request: { ...request, items: [] } }), (error) => error.code === 'CART_EMPTY');
  assert.throws(() => validateCanonicalCart({ catalog, request: { ...request, items: [{ variantId: 'missing', quantity: 1 }] } }), (error) => error.code === 'VARIANT_NOT_FOUND');
  assert.throws(() => validateCanonicalCart({ catalog, request: { ...request, items: [{ variantId: 'v-1', quantity: 1, clientPrice: 1 }] } }), (error) => error.code === 'PRICE_CHANGED');
  assert.equal(validateCanonicalCart({ catalog, request }).subtotal, 280000);
  assert.equal(validateCanonicalCart({ catalog, request: { ...request, items: [{ variantId: 'v-1', quantity: 1, medium: 'physical_sim', operation: 'device_sale' }] } }).shipping, null);
});

test('canonical validation blocks mixed currency, shipping, and invalid top-up input', () => {
  const usd = { ...baseVariant, id: 'v-usd', sku: 'USD-1', currency: 'USD' };
  assert.throws(() => validateCanonicalCart({ catalog: { products: [product], variants: [baseVariant, usd] }, request: { ...request, items: [{ variantId: 'v-1', quantity: 1 }, { variantId: 'v-usd', quantity: 1 }] } }), (error) => error.code === 'MIXED_CURRENCY_CART');
  const physical = { ...baseVariant, medium: 'physical_sim', fulfillmentMethod: 'HICO_PHYSICAL_STOCK', id: 'v-physical' };
  assert.throws(() => validateCanonicalCart({ catalog: { products: [product], variants: [physical] }, request: { ...request, items: [{ variantId: 'v-physical', quantity: 1 }] } }), (error) => error.code === 'SHIPPING_REQUIRED');
  const topup = { ...baseVariant, operation: 'topup', medium: 'physical_sim', topupDays: 10, supplier: 'worldmove', providerProductType: 2, fulfillmentMethod: 'WORLDMOVE_TOPUP', providerOfferId: 'offer-topup', wmproductId: 'WM-TOPUP', id: 'v-topup' };
  const topupCatalog = { products: [{ ...product, operation: 'topup' }], variants: [topup] };
  assert.throws(() => validateCanonicalCart({ catalog: topupCatalog, providerOffers: [{ id: 'offer-topup', wmproductId: 'WM-TOPUP', providerProductType: 2, active: true }], request: { ...request, items: [{ variantId: 'v-topup', quantity: 1 }] } }), (error) => error.code === 'TOPUP_INPUT_INVALID');
});

test('canonical validation does not request shipping for a physical top-up', () => {
  const topupProduct = { ...product, id: 'p-topup', operation: 'topup' };
  const topupVariant = {
    ...baseVariant,
    id: 'v-physical-topup',
    productId: topupProduct.id,
    sku: 'TOPUP-PHYSICAL',
    medium: 'physical_sim',
    supplier: 'worldmove',
    providerProductType: 2,
    fulfillmentMethod: 'WORLDMOVE_TOPUP',
    providerOfferId: 'offer-physical-topup',
    wmproductId: 'WM-PHYSICAL-TOPUP',
    requiresExistingSim: true,
    topupDays: 10,
  };
  const result = validateCanonicalCart({
    catalog: { products: [topupProduct], variants: [topupVariant] },
    providerOffers: [{ id: 'offer-physical-topup', wmproductId: 'WM-PHYSICAL-TOPUP', providerProductType: 2, active: true }],
    request: { ...request, items: [{ variantId: topupVariant.id, quantity: 1 }], topup: { simNum: '12345678901234567890', day: 10 } },
  });
  assert.equal(result.shipping, null);
  assert.deepEqual(result.topup, { simNum: '12345678901234567890', day: 10 });
});

test('canonical validation accepts an owned SIM asset without a client SIM number', () => {
  const topupProduct = { ...product, id: 'p-topup-asset', operation: 'topup' };
  const topupVariant = {
    ...baseVariant,
    id: 'v-topup-asset',
    productId: topupProduct.id,
    medium: 'physical_sim',
    supplier: 'worldmove',
    providerProductType: 2,
    fulfillmentMethod: 'WORLDMOVE_TOPUP',
    providerOfferId: 'offer-topup-asset',
    wmproductId: 'WM-TOPUP-ASSET',
    topupDays: 10,
  };
  const result = validateCanonicalCart({
    catalog: { products: [topupProduct], variants: [topupVariant] },
    providerOffers: [{ id: 'offer-topup-asset', wmproductId: 'WM-TOPUP-ASSET', providerProductType: 2, active: true }],
    request: { ...request, items: [{ variantId: topupVariant.id, quantity: 1 }], topup: { simAssetId: 'asset-1', day: 10 } },
  });
  assert.deepEqual(result.topup, { day: 10, simAssetId: 'asset-1' });
});

test('canonical validation allows one top-up at quantity one and rejects unsafe top-up carts', () => {
  const topupCatalog = { products: [topupProduct, product], variants: [topupVariant, baseVariant] };
  const valid = validateCanonicalCart({ catalog: topupCatalog, providerOffers: [topupOffer], request: topupRequest });
  assert.equal(valid.items.length, 1);
  assert.equal(valid.items[0].requested.quantity, 1);

  assert.throws(() => validateCanonicalCart({
    catalog: topupCatalog,
    providerOffers: [topupOffer],
    request: { ...topupRequest, items: [{ ...topupRequest.items[0], quantity: 2 }] },
  }), (error) => error.code === 'TOPUP_QUANTITY_INVALID' && error.status === 422);

  const secondTopup = { ...topupVariant, id: 'v-topup-rules-2' };
  assert.throws(() => validateCanonicalCart({
    catalog: { products: [topupProduct], variants: [topupVariant, secondTopup] },
    providerOffers: [topupOffer],
    request: { ...topupRequest, items: [{ variantId: topupVariant.id, quantity: 1 }, { variantId: secondTopup.id, quantity: 1 }] },
  }), (error) => error.code === 'TOPUP_CART_MIXED_UNSUPPORTED' && error.status === 422);

  assert.throws(() => validateCanonicalCart({
    catalog: topupCatalog,
    providerOffers: [topupOffer],
    request: { ...topupRequest, items: [{ variantId: topupVariant.id, quantity: 1 }, { variantId: baseVariant.id, quantity: 1 }] },
  }), (error) => error.code === 'TOPUP_CART_MIXED_UNSUPPORTED' && error.status === 422);
});

test('canonical checkout rejects unresolved operation with a typed reason', () => {
  const unresolvedProduct = { ...product, operationResolution: 'UNRESOLVED' };
  assert.throws(() => validateCanonicalCart({
    catalog: { products: [unresolvedProduct], variants: [{ ...baseVariant, productId: unresolvedProduct.id, active: true, needsReview: false }] },
    request: { items: [{ variantId: baseVariant.id, quantity: 1 }], customer: { name: 'A', email: 'a@example.com', phone: '0900000000' } },
    requireCustomer: true,
  }), (error) => error.code === 'CANONICAL_OPERATION_UNRESOLVED');
});

test('canonical checkout validates requested eSIM trip days against the variant bucket', () => {
  const tripVariant = { ...baseVariant, tripDayOptions: [2, 3] };
  const tripCatalog = { products: [product], variants: [tripVariant] };
  assert.throws(() => validateCanonicalCart({
    catalog: tripCatalog,
    request: { ...request, items: [{ variantId: tripVariant.id, quantity: 1 }] },
  }), (error) => error.code === 'TRIP_DAY_REQUIRED');
  const valid = validateCanonicalCart({
    catalog: tripCatalog,
    request: { ...request, items: [{ variantId: tripVariant.id, quantity: 1, requestedTripDays: 3 }] },
  });
  assert.equal(valid.items[0].requested.requestedTripDays, 3);
  assert.throws(() => validateCanonicalCart({
    catalog: tripCatalog,
    request: { ...request, items: [{ variantId: tripVariant.id, quantity: 1, requestedTripDays: 4 }] },
  }), (error) => error.code === 'TRIP_DAY_MISMATCH');

  assert.throws(() => validateCanonicalCart({
    catalog: { products: [topupProduct], variants: [topupVariant] },
    providerOffers: [topupOffer],
    request: { ...topupRequest, items: [{ variantId: topupVariant.id, quantity: 1, requestedTripDays: 3 }] },
  }), (error) => error.code === 'TRIP_DAY_NOT_APPLICABLE');
});

test('canonical checkout blocks Worldmove physical order before resolving or calling a provider', () => {
  let providerCalls = 0;
  const physical = {
    ...baseVariant,
    id: 'v-worldmove-physical',
    medium: 'physical_sim',
    supplier: 'worldmove',
    fulfillmentMethod: 'WORLDMOVE_PHYSICAL_ORDER',
    providerProductType: 1,
    providerOfferId: 'offer-physical',
    wmproductId: 'WM-PHYSICAL',
    durationDays: 1,
    familyKey: 'worldmove-physical',
  };
  assert.throws(() => validateCanonicalCart({
    catalog: { products: [product], variants: [physical] },
    providerOffers: [{ id: 'offer-physical', wmproductId: 'WM-PHYSICAL', providerProductType: 1, active: true }],
    providerResolver: () => {
      providerCalls += 1;
      throw new Error('provider resolver must not run');
    },
    request: { ...request, items: [{ variantId: physical.id, quantity: 1 }] },
  }), (error) => error.code === 'WORLDMOVE_PHYSICAL_ORDER_NOT_READY' && error.status === 503);
  assert.equal(providerCalls, 0);
});
