import assert from 'node:assert/strict';
import test from 'node:test';
import { validateCanonicalCart } from './checkoutValidation.js';

const product = { id: 'p-1', slug: 'p-1', name: 'Gói Nhật', operation: 'new_subscription', status: 'active', coverageType: 'country', coverageIds: ['jp'] };
const baseVariant = {
  id: 'v-1', productId: 'p-1', sku: 'SKU-1', price: 280000, currency: 'VND', medium: 'esim', supplier: 'hico', fulfillmentMethod: 'HICO_MANUAL_QR', active: true, needsReview: false, skuConflict: null,
};
const catalog = { products: [product], variants: [baseVariant] };
const request = { items: [{ variantId: 'v-1', quantity: 1 }], shipping: null, topup: null, customer: { name: 'A', email: 'a@example.com', phone: '0900000000' } };

test('canonical validation uses variant price and rejects empty or unavailable carts', () => {
  assert.throws(() => validateCanonicalCart({ catalog, request: { ...request, items: [] } }), (error) => error.code === 'CART_EMPTY');
  assert.throws(() => validateCanonicalCart({ catalog, request: { ...request, items: [{ variantId: 'missing', quantity: 1 }] } }), (error) => error.code === 'VARIANT_NOT_FOUND');
  assert.throws(() => validateCanonicalCart({ catalog, request: { ...request, items: [{ variantId: 'v-1', quantity: 1, price: 1 }] } }), (error) => error.code === 'PRICE_CHANGED');
  assert.equal(validateCanonicalCart({ catalog, request }).subtotal, 280000);
});

test('canonical validation blocks mixed currency, shipping, and invalid top-up input', () => {
  const usd = { ...baseVariant, id: 'v-usd', sku: 'USD-1', currency: 'USD' };
  assert.throws(() => validateCanonicalCart({ catalog: { products: [product], variants: [baseVariant, usd] }, request: { ...request, items: [{ variantId: 'v-1', quantity: 1 }, { variantId: 'v-usd', quantity: 1 }] } }), (error) => error.code === 'MIXED_CURRENCY_CART');
  const physical = { ...baseVariant, medium: 'physical_sim', fulfillmentMethod: 'HICO_PHYSICAL_STOCK', id: 'v-physical' };
  assert.throws(() => validateCanonicalCart({ catalog: { products: [product], variants: [physical] }, request: { ...request, items: [{ variantId: 'v-physical', quantity: 1 }] } }), (error) => error.code === 'SHIPPING_REQUIRED');
  const topup = { ...baseVariant, operation: 'topup', supplier: 'worldmove', providerProductType: 2, fulfillmentMethod: 'WORLDMOVE_TOPUP', providerOfferId: 'offer-topup', wmproductId: 'WM-TOPUP', id: 'v-topup' };
  const topupCatalog = { products: [product], variants: [topup] };
  assert.throws(() => validateCanonicalCart({ catalog: topupCatalog, providerOffers: [{ id: 'offer-topup', wmproductId: 'WM-TOPUP', active: true }], request: { ...request, items: [{ variantId: 'v-topup', quantity: 1 }] } }), (error) => error.code === 'TOPUP_INPUT_INVALID');
});
