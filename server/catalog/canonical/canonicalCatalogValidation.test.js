import assert from 'node:assert/strict';
import test from 'node:test';
import { validateCanonicalCatalog } from './canonicalCatalogValidation.js';
import { cloneSeedCategories } from '../categories/catalogCategories.js';

const product = (overrides = {}) => ({
  id: 'p1',
  slug: 'san-pham',
  name: 'Sản phẩm',
  operation: 'new_subscription',
  coverageType: 'country',
  coverageIds: ['p1'],
  featured: false,
  status: 'active',
  version: 1,
  createdAt: '2026-07-30T00:00:00.000Z',
  updatedAt: '2026-07-30T00:00:00.000Z',
  ...overrides,
});

const variant = (overrides = {}) => ({
  id: 'v1',
  productId: 'p1',
  sku: 'SKU-1',
  price: 1000,
  compareAtPrice: null,
  currency: 'VND',
  medium: 'esim',
  supplier: 'other',
  fulfillmentMethod: 'MANUAL_PROCESSING',
  requiresExistingSim: false,
  active: true,
  needsReview: true,
  version: 1,
  createdAt: '2026-07-30T00:00:00.000Z',
  updatedAt: '2026-07-30T00:00:00.000Z',
  ...overrides,
});

test('validates canonical product and variant contracts', () => {
  const result = validateCanonicalCatalog({
    products: [product()],
    variants: [variant()],
  });
  assert.equal(result.valid, true);
});

test('allows a missing source SKU when WMID is present', () => {
  const result = validateCanonicalCatalog({
    products: [product()],
    variants: [variant({ sku: undefined, wmproductId: 'WM-1' })],
  });
  assert.equal(result.valid, true);
});

test('does not treat a shared SKU with distinct WMIDs as a publish blocker', () => {
  const variants = [
    variant({ id: 'v-a', sku: 'SHARED', wmproductId: 'WM-A', needsReview: false, active: true }),
    variant({ id: 'v-b', sku: 'SHARED', wmproductId: 'WM-B', needsReview: false, active: true }),
  ];
  const result = validateCanonicalCatalog({ products: [product()], variants });
  assert.equal(result.duplicateSkus.length, 0);
  assert.equal(result.publishSafety.blockedReasons.duplicateSku, undefined);
});

test('does not treat one legacy SKU reused across top-up days as a publish blocker', () => {
  const topupProduct = product({
    id: 'p-topup',
    slug: 'nap-sim',
    operation: 'topup',
    coverageType: 'not_applicable',
    coverageIds: [],
  });
  const topupOffer = {
    id: 'offer-topup',
    wmproductId: 'WM-TOPUP',
    providerProductType: 2,
    active: true,
  };
  const variants = [3, 5].map((topupDays, index) => variant({
    id: `v-topup-${topupDays}`,
    productId: topupProduct.id,
    sku: 'SHARED-TOPUP-SKU',
    medium: 'physical_sim',
    supplier: 'worldmove',
    fulfillmentMethod: 'WORLDMOVE_TOPUP',
    providerProductType: 2,
    providerOfferId: topupOffer.id,
    wmproductId: topupOffer.wmproductId,
    topupDays,
    requiresExistingSim: true,
    needsReview: false,
    active: index === 0,
  }));
  const result = validateCanonicalCatalog({
    products: [topupProduct],
    variants,
    providerOffers: [topupOffer],
  });
  assert.equal(result.valid, true);
  assert.deepEqual(result.duplicateSkus, ['SHARED-TOPUP-SKU']);
  assert.equal(result.publishSafety.blockedReasons.duplicateSku, undefined);
  assert.equal(result.publishSafety.publishableVariants, variants.length);
});

test('accepts an unresolved manual provider fallback while keeping it review-only', () => {
  const result = validateCanonicalCatalog({
    products: [product()],
    variants: [variant({
      wmproductId: 'WM-MISSING',
      providerProductType: null,
      leSIM: null,
      active: false,
      needsReview: true,
    })],
    providerOffers: [],
  });
  assert.equal(result.valid, true);
  assert.equal(result.publishSafety.blockedVariants, 1);
});

test('reports duplicate IDs, SKU and slug', () => {
  const result = validateCanonicalCatalog({
    products: [product(), product({ name: 'Duplicate' })],
    variants: [variant(), variant({ productId: 'missing' })],
  });
  assert.equal(result.valid, false);
  assert.deepEqual(result.duplicateProductIds, ['p1']);
  assert.deepEqual(result.duplicateVariantIds, ['v1']);
  assert.deepEqual(result.duplicateSkus, ['SKU-1']);
  assert.deepEqual(result.duplicateSlugs, ['san-pham']);
  assert.deepEqual(result.orphanVariants, ['v1']);
});

test('reports invalid currency, price, stock and top-up mapping', () => {
  const result = validateCanonicalCatalog({
    products: [product({ operation: 'topup' })],
    variants: [variant({
      price: -1,
      currency: 'TWD',
      stock: 1.5,
      fulfillmentMethod: 'WORLDMOVE_TOPUP',
      supplier: 'worldmove',
      providerOfferId: 'offer-1',
      wmproductId: 'WM-1',
      requiresExistingSim: false,
    })],
    providerOffers: [{
      id: 'offer-1',
      wmproductId: 'WM-1',
      providerProductType: 2,
      active: true,
    }],
  });
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /price/);
  assert.match(result.errors.join(' '), /currency/);
  assert.match(result.errors.join(' '), /stock/);
  assert.match(result.errors.join(' '), /existing SIM/);
});

test('reports invalid provider mapping and orphan manual QR', () => {
  const result = validateCanonicalCatalog({
    products: [product()],
    variants: [variant({
      supplier: 'worldmove',
      fulfillmentMethod: 'WORLDMOVE_ESIM_REDEEM',
      providerOfferId: 'missing',
      wmproductId: 'WM-1',
      needsReview: false,
    })],
    providerOffers: [],
    manualQrs: [{ id: 'qr-1', variantId: 'missing' }],
  });
  assert.equal(result.valid, false);
  assert.deepEqual(result.orphanManualQrs, ['qr-1']);
  assert.match(result.errors.join(' '), /missing provider offer/);
});

test('rejects a fulfillment medium that conflicts with the assigned category kind', () => {
  const result = validateCanonicalCatalog({
    products: [product({ categoryId: 'cat-esim-du-lich', categoryNeedsReview: false })],
    variants: [variant({
      medium: 'physical_sim',
      supplier: 'hico',
      fulfillmentMethod: 'HICO_PHYSICAL_STOCK',
      stock: 1,
      needsReview: false,
    })],
    categories: cloneSeedCategories(),
  });
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /does not match its eSIM category/);
});
